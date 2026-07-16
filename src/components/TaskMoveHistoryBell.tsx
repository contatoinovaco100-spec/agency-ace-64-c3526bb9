import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, ArrowRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  clearHistory,
  getHistory,
  markAllRead,
  routeForEntry,
  subscribeHistory,
  type TaskMoveHistoryEntry,
} from '@/lib/taskMoveHistory';
import { cn } from '@/lib/utils';

function timeAgo(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function TaskMoveHistoryBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeHistory(() => setTick(t => t + 1)), []);

  const entries = useMemo<TaskMoveHistoryEntry[]>(
    () => (user ? getHistory(user.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, tick],
  );
  const unread = entries.filter(e => !e.read).length;

  useEffect(() => {
    if (open && user && unread > 0) markAllRead(user.id);
  }, [open, user, unread]);

  const handleOpen = (entry: TaskMoveHistoryEntry) => {
    setOpen(false);
    navigate(routeForEntry(entry));
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Histórico de movimentações"
        >
          <span className="text-base leading-none" aria-label="Histórico">📬</span>
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Histórico do Kanban</span>
          {entries.length > 0 && (
            <button
              onClick={() => clearHistory(user.id)}
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
              title="Limpar histórico"
            >
              <Trash2 className="h-3 w-3" /> Limpar
            </button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {entries.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Nenhuma movimentação ainda.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {entries.map(e => (
                <li key={e.id}>
                  <button
                    onClick={() => handleOpen(e)}
                    className={cn(
                      'w-full text-left px-3 py-2 hover:bg-muted transition-colors',
                      !e.read && 'bg-primary/5',
                    )}
                  >
                    <div className="text-sm font-medium truncate">{e.title}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span className="truncate">{e.fromStatus || '—'}</span>
                      <ArrowRight className="h-3 w-3 shrink-0" />
                      <span className="truncate text-foreground">{e.toStatus}</span>
                      <span className="ml-auto shrink-0">{timeAgo(e.at)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t border-border">
          <button
            onClick={() => {
              setOpen(false);
              navigate('/historico-kanban');
            }}
            className="w-full px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 transition-colors text-center"
          >
            Ver histórico completo →
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

