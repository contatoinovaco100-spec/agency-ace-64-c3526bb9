import { useEffect, useState, useCallback, useRef } from 'react';
import { Download, Image as ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AttachmentRow {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
}

interface PreparedAttachment {
  id: string;
  name: string;
  path: string;
  isImage: boolean;
  signedUrl?: string;
}

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i;

// Cache global para signed URLs (evita regenerar a cada render)
const signedUrlCache = new Map<string, { url: string; expires: number }>();
const CACHE_DURATION = 55 * 60 * 1000; // 55 minutos (signed URL expira em 60)

function extractPath(fileUrl: string): string | null {
  // URL format: https://<proj>.supabase.co/storage/v1/object/(public|sign)/task-attachments/<path>
  const m = fileUrl.match(/\/task-attachments\/(.+?)(\?|$)/);
  if (m) return decodeURIComponent(m[1]);
  return null;
}

function getCachedSignedUrl(path: string): string | null {
  const cached = signedUrlCache.get(path);
  if (cached && cached.expires > Date.now()) {
    return cached.url;
  }
  if (cached) signedUrlCache.delete(path);
  return null;
}

function setCachedSignedUrl(path: string, url: string): void {
  signedUrlCache.set(path, { url, expires: Date.now() + CACHE_DURATION });
}

export default function ArteAttachmentsPreview({
  taskId,
  compact = true,
  onPreviewClick,
}: {
  taskId: string;
  compact?: boolean;
  /** Opcional: dispara com a URL da imagem preview (ex.: abrir lightbox). */
  onPreviewClick?: (url: string) => void;
}) {
  const [items, setItems] = useState<PreparedAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const loadAttachments = useCallback(async () => {
    if (!taskId) return;
    
    setLoading(true);

    // Try public RPC first (works for unauthenticated users on /conteudo pages)
    const { data: rpcData } = await (supabase as any).rpc('get_public_arte_attachments', { _task_id: taskId });
    let rows: AttachmentRow[];
    if (rpcData && rpcData.length > 0) {
      rows = rpcData as AttachmentRow[];
    } else {
      // Fallback to direct query (works for authenticated users)
      const { data } = await supabase
        .from('task_attachments')
        .select('id, file_name, file_url, file_type')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      rows = (data || []) as AttachmentRow[];
    }
    const prepared: PreparedAttachment[] = [];
    const pathsToSign: string[] = [];
    const pathToIndex = new Map<string, number>();

    for (const r of rows) {
      const fileUrl = r.file_url || '';
      const isImage =
        (r.file_type || '').startsWith('image/') || IMAGE_EXT.test(r.file_name);

      // If file_url is already a signed or public URL, use it directly
      const isReadyUrl = /\/storage\/v1\/object\/(sign|public)\//i.test(fileUrl);
      if (isReadyUrl) {
        prepared.push({ id: r.id, name: r.file_name, path: fileUrl, isImage, signedUrl: fileUrl });
        continue;
      }

      // Otherwise extract the storage path and sign it
      const path = extractPath(fileUrl);
      if (!path) continue;

      if (isImage) {
        const cachedUrl = getCachedSignedUrl(path);
        prepared.push({
          id: r.id,
          name: r.file_name,
          path,
          isImage,
          signedUrl: cachedUrl || undefined,
        });
        if (!cachedUrl) {
          pathToIndex.set(path, prepared.length - 1);
          pathsToSign.push(path);
        }
      } else {
        prepared.push({ id: r.id, name: r.file_name, path, isImage });
      }
    }

    // Só busca signed URLs para imagens que não estão em cache
    if (pathsToSign.length > 0) {
      const { data: signed } = await supabase.storage
        .from('task-attachments')
        .createSignedUrls(pathsToSign, 60 * 60);
      
      if (signed) {
        for (const s of signed) {
          const idx = pathToIndex.get(s.path);
          if (idx !== undefined && prepared[idx]) {
            prepared[idx].signedUrl = s.signedUrl;
            setCachedSignedUrl(s.path, s.signedUrl);
          }
        }
      }
    }

    if (mountedRef.current) {
      setItems(prepared);
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    mountedRef.current = true;
    loadAttachments();
    return () => { mountedRef.current = false; };
  }, [loadAttachments]);

  const handleDownload = async (a: PreparedAttachment, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDownloadingId(a.id);
    try {
      // If path is already a full URL (signed or public), fetch it directly
      if (/^https?:\/\//i.test(a.path)) {
        const res = await fetch(a.path);
        if (!res.ok) throw new Error('Falha no download');
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = a.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } else {
        const { data, error } = await supabase.storage
          .from('task-attachments')
          .download(a.path);
        if (error || !data) throw error || new Error('Falha no download');
        const blobUrl = URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = a.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }
      toast.success('Download concluído (qualidade original)');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao baixar arquivo');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className={cn("flex items-center gap-1.5 text-[10px] text-muted-foreground", compact ? "mt-1" : "mt-2")}>
        <Loader2 className="h-3 w-3 animate-spin" /> 
        <span className="animate-pulse">Carregando artes...</span>
      </div>
    );
  }

  if (!items.length) return null;

  const previewItem = items.find((i) => i.isImage && i.signedUrl);

  return (
    <div
      className={cn("space-y-2", compact ? "mt-1" : "mt-2")}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (previewItem?.signedUrl) onPreviewClick?.(previewItem.signedUrl);
      }}
    >
      {previewItem && (
        <div className={cn("relative overflow-hidden rounded-md border border-border bg-muted/50", compact && "h-10")}>
           <div className="absolute inset-0 bg-gradient-to-br from-muted via-muted/80 to-muted animate-pulse" />
           <img
             src={previewItem.signedUrl}
             alt={previewItem.name}
             className={cn(
               "relative",
               compact ? 'h-10 w-full object-cover' : 'max-h-72 w-full object-contain bg-black/40'
             )}
             loading="eager"
             decoding="async"
             fetchPriority="high"
           />
          {!compact && (
            <button
              type="button"
              onClick={(e) => handleDownload(previewItem, e)}
              disabled={downloadingId === previewItem.id}
              className="absolute right-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur hover:bg-black/85 disabled:opacity-60"
              title="Baixar em qualidade original"
            >
              {downloadingId === previewItem.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              Baixar
            </button>
          )}
        </div>
      )}

      {items.length > 1 && (
        <div className={cn("flex flex-wrap gap-1", compact && "mt-1")}>
          {items.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={(e) => handleDownload(a, e)}
              disabled={downloadingId === a.id}
              className={cn(
                "inline-flex max-w-full items-center gap-1 rounded border border-border bg-background text-foreground hover:bg-muted disabled:opacity-60 transition-colors",
                compact ? "px-1 py-[1px] text-[8px]" : "px-1.5 py-0.5 text-[10px]"
              )}
              title={`Baixar ${a.name}`}
            >
              {downloadingId === a.id ? (
                <Loader2 className={cn("animate-spin shrink-0", compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
              ) : a.isImage ? (
                <ImageIcon className={cn("shrink-0", compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
              ) : (
                <Download className={cn("shrink-0", compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
              )}
              <span className={cn("truncate", compact ? "max-w-[80px]" : "max-w-[120px]")}>{a.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
