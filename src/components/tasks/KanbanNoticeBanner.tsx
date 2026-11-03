import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Megaphone, Siren, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLiveNotices, type KanbanNotice } from '@/lib/kanbanNotices';

const HIDDEN_KEY = 'inova:avisos-fechados';
const readHidden = (): string[] => { try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'); } catch { return []; } };
// Editar o aviso muda a chave, então ele volta a aparecer para quem já tinha fechado
const keyOf = (n: KanbanNotice) => `${n.id}:${n.updated_at}`;

const TONE_STYLE = {
  destaque: { box: 'spotlight-panel text-spotlight-foreground', icon: Megaphone, iconBox: 'bg-spotlight-foreground/15', muted: 'text-spotlight-foreground/80' },
  aviso: { box: 'border border-warning/40 bg-warning/10 text-foreground', icon: AlertTriangle, iconBox: 'bg-warning/15 text-warning', muted: 'text-muted-foreground' },
  urgente: { box: 'border border-destructive/40 bg-destructive/10 text-foreground', icon: Siren, iconBox: 'bg-destructive/15 text-destructive', muted: 'text-muted-foreground' },
} as const;

/** Banner de avisos do admin no topo do kanban */
export function KanbanNoticeBanner({ preview }: { preview?: KanbanNotice[] }) {
  const live = useLiveNotices();
  const [hidden, setHidden] = useState(readHidden);
  const list = (preview ?? live).filter((n) => preview || !hidden.includes(keyOf(n)));
  if (!list.length) return null;

  const close = (n: KanbanNotice) => {
    const next = [...hidden, keyOf(n)].slice(-50);
    setHidden(next);
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)); } catch { /* sem armazenamento: some só nesta visita */ }
  };

  return (
    <div className="space-y-2">
      {list.map((n) => {
        const s = TONE_STYLE[n.tone] ?? TONE_STYLE.destaque;
        const external = /^https?:\/\//.test(n.link);
        return (
          <div key={n.id} role="status" className={cn('relative flex items-start gap-3 overflow-hidden rounded-xl p-3 pr-10 sm:items-center sm:p-4 sm:pr-12', s.box)}>
            <div className={cn('relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', s.iconBox)}>
              <s.icon className="h-4 w-4" />
            </div>
            <div className="relative z-[1] min-w-0 flex-1">
              <p className="font-display text-sm font-semibold leading-snug sm:text-[15px]">{n.title}</p>
              {n.message && <p className={cn('mt-0.5 whitespace-pre-line text-xs leading-relaxed sm:text-sm', s.muted)}>{n.message}</p>}
            </div>
            {n.link && (external
              ? <a href={n.link} target="_blank" rel="noreferrer" className="relative z-[1] inline-flex shrink-0 items-center gap-1 text-xs font-semibold underline-offset-4 hover:underline">Abrir <ArrowRight className="h-3.5 w-3.5" /></a>
              : <Link to={n.link} className="relative z-[1] inline-flex shrink-0 items-center gap-1 text-xs font-semibold underline-offset-4 hover:underline">Abrir <ArrowRight className="h-3.5 w-3.5" /></Link>)}
            {!preview && (
              <button type="button" onClick={() => close(n)} aria-label="Fechar aviso"
                className={cn('absolute right-2 top-2 z-[1] rounded-md p-1.5 transition-colors hover:bg-foreground/10 sm:top-1/2 sm:-translate-y-1/2', s.muted)}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
