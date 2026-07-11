import { useEffect, useState } from 'react';
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

function extractPath(fileUrl: string): string | null {
  // URL format: https://<proj>.supabase.co/storage/v1/object/(public|sign)/task-attachments/<path>
  const m = fileUrl.match(/\/task-attachments\/(.+?)(\?|$)/);
  if (m) return decodeURIComponent(m[1]);
  return null;
}

export default function ArteAttachmentsPreview({
  taskId,
  compact = true,
}: {
  taskId: string;
  compact?: boolean;
}) {
  const [items, setItems] = useState<PreparedAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('task_attachments')
        .select('id, file_name, file_url, file_type')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      const rows = (data || []) as AttachmentRow[];
      const prepared: PreparedAttachment[] = [];
      for (const r of rows) {
        const path = extractPath(r.file_url || '');
        if (!path) continue;
        const isImage =
          (r.file_type || '').startsWith('image/') || IMAGE_EXT.test(r.file_name);
        prepared.push({ id: r.id, name: r.file_name, path, isImage });
      }

      // Sign image URLs for preview
      const imagePaths = prepared.filter((p) => p.isImage).map((p) => p.path);
      if (imagePaths.length) {
        const { data: signed } = await supabase.storage
          .from('task-attachments')
          .createSignedUrls(imagePaths, 60 * 60);
        if (signed) {
          const map = new Map(signed.map((s) => [s.path, s.signedUrl]));
          for (const p of prepared) {
            const u = map.get(p.path);
            if (u) p.signedUrl = u;
          }
        }
      }

      if (!cancelled) {
        setItems(prepared);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const handleDownload = async (a: PreparedAttachment, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDownloadingId(a.id);
    try {
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
      toast.success('Download concluído (qualidade original)');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao baixar arquivo');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Carregando artes...
      </div>
    );
  }

  if (!items.length) return null;

  const previewItem = items.find((i) => i.isImage && i.signedUrl);

  return (
    <div className={cn("space-y-2", compact ? "mt-1" : "mt-2")} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      {previewItem && (
        <div className="relative overflow-hidden rounded-md border border-border bg-muted">
          <img
            src={previewItem.signedUrl}
            alt={previewItem.name}
            className={compact ? 'h-16 w-full object-cover' : 'max-h-72 w-full object-contain bg-black/40'}
            loading="lazy"
          />
          {!compact && (
            <button
              type="button"
              onClick={(e) => handleDownload(previewItem, e)}
              disabled={downloadingId === previewItem.id}
              className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur hover:bg-black/85 disabled:opacity-60"
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
        <div className="flex flex-wrap gap-1">
          {items.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={(e) => handleDownload(a, e)}
              disabled={downloadingId === a.id}
              className="inline-flex max-w-full items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted disabled:opacity-60"
              title={`Baixar ${a.name}`}
            >
              {downloadingId === a.id ? (
                <Loader2 className="h-3 w-3 animate-spin shrink-0" />
              ) : a.isImage ? (
                <ImageIcon className="h-3 w-3 shrink-0" />
              ) : (
                <Download className="h-3 w-3 shrink-0" />
              )}
              <span className="truncate max-w-[120px]">{a.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
