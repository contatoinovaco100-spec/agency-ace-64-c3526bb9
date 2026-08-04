import { CheckCircle2, Loader2, XCircle, Clock, Instagram, Music2 } from 'lucide-react';
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
        const Platform = t.platform === 'instagram' ? Instagram : Music2;
        return (
          <div
            key={t.id}
            className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Platform className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">@{t.username}</span>
            </span>
            <span className="flex items-center gap-1.5 shrink-0">
              {t.status === 'failed' && t.error_message && (
                <span className="max-w-[140px] truncate text-[10px] text-destructive/80" title={t.error_message}>
                  {t.error_message}
                </span>
              )}
              {t.permalink && (
                <a href={t.permalink} target="_blank" rel="noreferrer" className="text-[10px] underline text-muted-foreground">
                  ver
                </a>
              )}
              <Icon className={`h-3.5 w-3.5 ${m.cls}`} />
              <span className={m.cls.replace('animate-spin', '')}>{m.label}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
