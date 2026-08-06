import { useEffect, useState, useCallback, useRef } from 'react';
import { Download, Image as ImageIcon, Loader2, ZoomIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { prepareImageAttachments, signPreparedAttachments, type PreparedAttachment, type AttachmentRow } from '@/lib/arteAttachments';

export default function ArteAttachmentsPreview({
  taskId,
  compact = true,
  onPreviewClick,
}: {
  taskId: string;
  compact?: boolean;
  /** Opcional: dispara com as URLs de todas as imagens e o índice da clicada (ex.: abrir lightbox). */
  onPreviewClick?: (urls: string[], index: number) => void;
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

    // Nunca confiar na URL gravada (pode ser pública antiga em bucket privado
    // ou assinada expirada): extrai o caminho e re-assina com URL nova.
    const { prepared, pathsToSign } = prepareImageAttachments(rows);
    const signed = await signPreparedAttachments(prepared, pathsToSign);

    if (mountedRef.current) {
      setItems(signed);
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

  const images = items.filter((i) => i.isImage && i.signedUrl);
  const imageUrls = images.map((i) => i.signedUrl as string);

  return (
    <div
      className={cn("space-y-2", compact ? "mt-1" : "mt-2")}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {images.length > 0 && (
        <div className={cn("flex gap-1.5", compact ? "flex-nowrap overflow-x-auto scroller-hide" : "flex-wrap")}>
          {images.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              title={`Ampliar: ${img.name}`}
              onClick={(e) => { e.stopPropagation(); onPreviewClick?.(imageUrls, idx); }}
              className="group/img relative overflow-hidden rounded-md border border-border bg-muted/50 transition-colors hover:border-primary/50"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-muted via-muted/80 to-muted animate-pulse" />
              <img
                src={img.signedUrl}
                alt={img.name}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className={cn(
                  "relative object-cover",
                  compact ? "h-12 w-12" : "h-24 w-24"
                )}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover/img:bg-black/30 group-hover/img:opacity-100">
                <ZoomIn className={cn("text-white", compact ? "h-4 w-4" : "h-6 w-6")} />
              </div>
            </button>
          ))}
        </div>
      )}

      {items.length > 0 && (
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
