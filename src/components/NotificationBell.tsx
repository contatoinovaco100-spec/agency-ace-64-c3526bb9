import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AtSign, Bell, Bug, CheckCircle2, Columns3, DollarSign, Info, PenLine, Target, type LucideIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { FEED_FILTERS, timeAgo, useNotificationFeed, type FeedItem, type FeedKind } from '@/lib/notificationFeed';
import { cn } from '@/lib/utils';

const KIND_ICON: Record<FeedKind, { icon: LucideIcon; tone: string }> = {
  kanban: { icon: Columns3, tone: 'text-muted-foreground' },
  task: { icon: Columns3, tone: 'text-muted-foreground' },
  approval: { icon: CheckCircle2, tone: 'text-success' },
  mention: { icon: AtSign, tone: 'text-primary' },
  lead: { icon: Target, tone: 'text-warning' },
  sale: { icon: DollarSign, tone: 'text-success' },
  signature: { icon: PenLine, tone: 'text-success' },
  error: { icon: Bug, tone: 'text-destructive' },
  info: { icon: Info, tone: 'text-muted-foreground' },
};

/** Uma linha da central (no sino e na página de notificações) */
export function FeedRow({ item, onOpen }: { item: FeedItem; onOpen: (item: FeedItem) => void }) {
  const { icon: Icon, tone } = KIND_ICON[item.kind] ?? KIND_ICON.info;
  return (
    <button
      onClick={() => onOpen(item)}
      disabled={!item.link}
      className={cn(
        'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors enabled:hover:bg-muted disabled:cursor-default',
        !item.read && 'bg-primary/5',
      )}
    >
      <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted', tone)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.title}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(item.at)}</span>
        </span>
        {item.description && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{item.description}</span>}
      </span>
      {!item.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Não lida" />}
    </button>
  );
}

/** Sino da central de notificações: tudo que chegou, num lugar só */
export function NotificationBell({ className, side = 'top' }: { className?: string; side?: 'top' | 'bottom' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { items, unread, markRead } = useNotificationFeed();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('todas');
  const wasOpen = useRef(false);

  // Ao fechar, o que foi visto deixa de contar como novo
  useEffect(() => {
    if (!open && unread > 0 && wasOpen.current) markRead();
    wasOpen.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!user) return null;

  const kinds = FEED_FILTERS.find((f) => f.id === filter)?.kinds;
  const shown = items.filter((i) => !kinds || kinds.includes(i.kind)).slice(0, 40);
  const openItem = (item: FeedItem) => { if (!item.link) return; setOpen(false); navigate(item.link); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn('relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
          title="Notificações"
          aria-label={unread ? `Notificações (${unread} novas)` : 'Notificações'}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rec px-1 text-[10px] font-semibold text-rec-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align={side === 'top' ? 'start' : 'end'} side={side} className="w-[min(380px,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between px-3 pb-2 pt-3">
          <span className="text-sm font-semibold">Notificações</span>
          {unread > 0 && (
            <button onClick={markRead} className="text-xs text-muted-foreground hover:text-foreground">Marcar como lidas</button>
          )}
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-border px-3 pb-2">
          {FEED_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                filter === f.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="max-h-[min(60dvh,420px)] overflow-y-auto">
          {shown.length === 0 ? (
            <p className="px-6 py-10 text-center text-xs text-muted-foreground">Nada por aqui ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {shown.map((item) => <li key={item.id}><FeedRow item={item} onOpen={openItem} /></li>)}
            </ul>
          )}
        </div>
        <button
          onClick={() => { setOpen(false); navigate('/notificacoes'); }}
          className="w-full border-t border-border px-3 py-2 text-center text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Ver todas
        </button>
      </PopoverContent>
    </Popover>
  );
}
