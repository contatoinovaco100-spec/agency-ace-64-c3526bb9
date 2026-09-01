import { CheckCircle2, Loader2, XCircle, Clock, Instagram, AtSign, Music2 } from 'lucide-react';
import type { PublishTarget } from '@/types/social';

const meta = {
  pending: { icon: Clock, label: 'Aguardando', cls: 'text-muted-foreground' },
  publishing: { icon: Loader2, label: 'Publicando...', cls: 'text-primary animate-spin' },
  published: { icon: CheckCircle2, label: 'Publicado', cls: 'text-emerald-500' },
  failed: { icon: XCircle, label: 'Erro', cls: 'text-destructive' },
} as const;

export function TargetStatusList({ targets }: { targets: PublishTarget[] }) {
  if (!targets.length) {
    return <p className="text-xs text-muted-foreground">Nenhuma conta nesta publicação.</p>;
  }
  return (
    <div className="space-y-1.5 min-w-0">
      {targets.map(t => {
        const m = meta[t.status] ?? meta.pending;
        const Icon = m.icon;
        const Platform = t.platform === 'instagram' ? Instagram : t.platform === 'threads' ? AtSign : Music2;
        return (
          <div
            key={t.id}
            className="flex flex-col gap-1 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs"
          >
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <Platform className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">@{t.username}</span>
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                {t.permalink && (
                  <a href={t.permalink} target="_blank" rel="noreferrer" className="text-[10px] underline text-muted-foreground hover:text-foreground">
                    ver post
                  </a>
                )}
                <Icon className={`h-3.5 w-3.5 ${m.cls}`} />
                <span className={m.cls.replace('animate-spin', '')}>{m.label}</span>
              </span>
            </div>
            {t.status === 'failed' && t.error_message && (
              <p className="text-[11px] text-destructive/90 bg-destructive/10 rounded px-2 py-1 leading-tight break-words">
                {t.error_message}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
