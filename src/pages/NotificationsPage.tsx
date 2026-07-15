import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Trash2, Inbox } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  clearHistory,
  getHistory,
  routeForEntry,
  subscribeHistory,
  type TaskMoveHistoryEntry,
} from '@/lib/taskMoveHistory';
import {
  clearNotifications,
  getNotifications,
  subscribeNotifications,
  type NotificationHistoryEntry,
} from '@/lib/notificationHistory';
import notifIcon from '@/assets/notif-icon.png.asset.json';

type Item =
  | { kind: 'kanban'; at: number; entry: TaskMoveHistoryEntry }
  | { kind: 'event'; at: number; entry: NotificationHistoryEntry };

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

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeHistory(() => setTick(t => t + 1)), []);
  useEffect(() => subscribeNotifications(() => setTick(t => t + 1)), []);

  const items = useMemo<Item[]>(() => {
    if (!user) return [];
    const kanban = getHistory(user.id).map<Item>(e => ({ kind: 'kanban', at: e.at, entry: e }));
    const events = getNotifications(user.id).map<Item>(e => ({ kind: 'event', at: e.at, entry: e }));
    return [...kanban, ...events].sort((a, b) => b.at - a.at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tick]);

  const handleClear = () => {
    if (!user) return;
    clearHistory(user.id);
    clearNotifications(user.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src={notifIcon.url} alt="" className="h-10 w-10 object-contain" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Central de Notificações</h1>
            <p className="text-sm text-muted-foreground">
              Histórico salvo de movimentações e eventos importantes
            </p>
          </div>
        </div>
        {items.length > 0 && (
          <Button variant="outline" onClick={handleClear} className="gap-2">
            <Trash2 className="h-4 w-4" /> Limpar histórico
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            Histórico
            <Badge variant="secondary" className="text-xs">{items.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Inbox className="mx-auto h-10 w-10 opacity-40" />
              <p className="mt-3 text-sm">Nenhuma notificação por aqui ainda.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[70vh]">
              <ul className="divide-y divide-border">
                {items.map((item, i) => (
                  <motion.li
                    key={item.entry.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  >
                    {item.kind === 'kanban' ? (
                      <button
                        onClick={() => navigate(routeForEntry(item.entry))}
                        className="w-full text-left px-4 py-3 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium truncate">{item.entry.title}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(item.at)}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="truncate">{item.entry.fromStatus || '—'}</span>
                          <ArrowRight className="h-3 w-3 shrink-0" />
                          <span className="truncate text-foreground">{item.entry.toStatus}</span>
                        </div>
                      </button>
                    ) : (
                      <div className="w-full px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium truncate">{item.entry.title}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(item.at)}</span>
                        </div>
                        {item.entry.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{item.entry.description}</p>
                        )}
                      </div>
                    )}
                  </motion.li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
