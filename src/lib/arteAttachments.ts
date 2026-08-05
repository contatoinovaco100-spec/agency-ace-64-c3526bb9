import { supabase } from '@/integrations/supabase/client';

export interface AttachmentRow {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
}

export interface PreparedAttachment {
  id: string;
  name: string;
  path: string;
  isImage: boolean;
  signedUrl?: string;
}

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i;

export function isImageFile(name: string, type: string | null): boolean {
  return (type || '').startsWith('image/') || IMAGE_EXT.test(name);
}

// Extrai o caminho de storage de qualquer forma de URL gravada
// (public, sign ou caminho simples): https://<proj>.supabase.co/storage/v1/object/(public|sign)/task-attachments/<path>
export function extractStoragePath(fileUrl: string): string | null {
  const m = fileUrl.match(/\/task-attachments\/(.+?)(\?|$)/);
  if (m) return decodeURIComponent(m[1]);
  return null;
}

// Cache global para signed URLs (evita regenerar a cada render)
const signedUrlCache = new Map<string, { url: string; expires: number }>();
const CACHE_DURATION = 55 * 60 * 1000; // 55 minutos (signed URL expira em 60)

export function getCachedSignedUrl(path: string): string | null {
  const cached = signedUrlCache.get(path);
  if (cached && cached.expires > Date.now()) return cached.url;
  if (cached) signedUrlCache.delete(path);
  return null;
}

export function setCachedSignedUrl(path: string, url: string): void {
  signedUrlCache.set(path, { url, expires: Date.now() + CACHE_DURATION });
}

/**
 * Prepara attachments para preview.
 *
 * IMPORTANTE: a URL gravada em `file_url` NÃO pode ser confiada. Uploads antigos
 * guardaram URLs públicas (`/storage/v1/object/public/...`) que quebraram quando
 * o bucket ficou privado, e URLs assinadas expiram. Para imagens em storage,
 * sempre extraímos o caminho e agendamos uma re-assinatura com URL nova.
 */
export function prepareImageAttachments(rows: AttachmentRow[]): {
  prepared: PreparedAttachment[];
  pathsToSign: string[];
} {
  const prepared: PreparedAttachment[] = [];
  const pathsToSign: string[] = [];
  const seen = new Set<string>();

  for (const r of rows) {
    const fileUrl = r.file_url || '';
    const name = r.file_name;
    const isImage = isImageFile(name, r.file_type);

    if (!isImage) {
      prepared.push({ id: r.id, name, path: fileUrl, isImage });
      continue;
    }

    const path = extractStoragePath(fileUrl);
    if (!path) {
      // Não é caminho de storage: usa a URL como está (ex.: link externo)
      prepared.push({ id: r.id, name, path: fileUrl, isImage, signedUrl: fileUrl });
      continue;
    }

    const cachedUrl = getCachedSignedUrl(path);
    prepared.push({ id: r.id, name, path, isImage, signedUrl: cachedUrl || undefined });
    if (!cachedUrl && !seen.has(path)) {
      seen.add(path);
      pathsToSign.push(path);
    }
  }

  return { prepared, pathsToSign };
}

/** Assina os caminhos pendentes e atualiza os itens preparados. */
export async function signPreparedAttachments(
  prepared: PreparedAttachment[],
  pathsToSign: string[]
): Promise<PreparedAttachment[]> {
  if (pathsToSign.length === 0) return prepared;
  const { data: signed } = await supabase.storage
    .from('task-attachments')
    .createSignedUrls(pathsToSign, 60 * 60);

  if (signed) {
    const byPath = new Map(signed.map((s) => [s.path, s.signedUrl]));
    for (const p of prepared) {
      const url = p.path ? byPath.get(p.path) : undefined;
      if (url) {
        p.signedUrl = url;
        setCachedSignedUrl(p.path, url);
      }
    }
  }
  return prepared;
}
