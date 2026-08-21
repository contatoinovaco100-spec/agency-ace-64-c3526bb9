import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Copy, Download, Instagram, AtSign, Music2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { publishingService } from '@/services/publishing';
import type { PublishTarget } from '@/types/social';

interface Props {
  jobId: string;
  mediaPath: string;
  caption: string;
  firstComment?: string;
  targets: PublishTarget[];
  onChanged?: () => void;
}

export function ManualPublishPanel({
  jobId, mediaPath, caption, firstComment, targets, onChanged,
}: Props) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    publishingService.mediaUrl(mediaPath).then(setMediaUrl).catch(() => setMediaUrl(null));
  }, [mediaPath]);

  const copy = async (text: string, label: string) => {
    if (!text) { toast.error(`Nada para copiar em ${label}`); return; }
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiada`);
  };

  const toggle = async (t: PublishTarget) => {
    setBusy(t.id);
    try {
      await publishingService.markTarget(t.id, t.status === 'published' ? 'pending' : 'published');
      await publishingService.refreshJobStatus(jobId);
      onChanged?.();
    } catch (e: any) {
      toast.error('Erro ao atualizar', { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => copy(caption, 'Legenda')}>
          <Copy className="mr-1 h-3.5 w-3.5" /> Copiar legenda
        </Button>
        {firstComment ? (
          <Button size="sm" variant="outline" onClick={() => copy(firstComment, 'Primeiro comentário')}>
            <Copy className="mr-1 h-3.5 w-3.5" /> Copiar 1º comentário
          </Button>
        ) : null}
        <Button size="sm" variant="outline" asChild disabled={!mediaUrl}>
          <a href={mediaUrl ?? '#'} download target="_blank" rel="noreferrer">
            <Download className="mr-1 h-3.5 w-3.5" /> Baixar mídia
          </a>
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Baixe a mídia, cole a legenda no app e marque abaixo cada conta já publicada.
      </p>

      <div className="space-y-1.5">
        {targets.map(t => {
          const Icon = t.platform === 'instagram' ? Instagram : t.platform === 'threads' ? AtSign : Music2;
          const done = t.status === 'published';
          return (
            <div
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">@{t.username}</span>
              </span>
              <Button
                size="sm"
                variant={done ? 'secondary' : 'default'}
                className="h-7 px-2 text-[11px]"
                disabled={busy === t.id}
                onClick={() => toggle(t)}
              >
                {done
                  ? <><RotateCcw className="mr-1 h-3 w-3" /> Desfazer</>
                  : <><Check className="mr-1 h-3 w-3" /> Publiquei</>}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
