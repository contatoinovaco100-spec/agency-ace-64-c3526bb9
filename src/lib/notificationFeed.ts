import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { clearHistory, getHistory, markAllRead, routeForEntry, subscribeHistory } from '@/lib/taskMoveHistory';
import {
  clearNotifications, getNotifications, markAllNotificationsRead, subscribeNotifications,
  type NotificationHistoryEntry,
} from '@/lib/notificationHistory';

export type FeedKind = NotificationHistoryEntry['kind'] | 'kanban';

export interface FeedItem {
  id: string;
  kind: FeedKind;
  title: string;
  description?: string;
  at: number;
  read: boolean;
  link?: string;
}

/** Filtros da central: cada um junta os tipos de aviso que fazem sentido lado a lado */
export const FEED_FILTERS: { id: string; label: string; kinds: FeedKind[] | null }[] = [
  { id: 'todas', label: 'Todas', kinds: null },
  { id: 'tarefas', label: 'Tarefas', kinds: ['kanban', 'task'] },
  { id: 'aprovacoes', label: 'Aprovações', kinds: ['approval'] },
  { id: 'chat', label: 'Menções', kinds: ['mention'] },
  { id: 'leads', label: 'Leads', kinds: ['lead'] },
  { id: 'vendas', label: 'Vendas', kinds: ['sale', 'signature'] },
];

/**
 * Uma lista só com tudo que chega para a pessoa: movimentações do Kanban, aprovações do cliente,
 * menções no chat, leads novos e vendas. Fica salvo neste navegador.
 */
export function useNotificationFeed() {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeHistory(() => setTick((t) => t + 1)), []);
  useEffect(() => subscribeNotifications(() => setTick((t) => t + 1)), []);

  const items = useMemo<FeedItem[]>(() => {
    if (!user) return [];
    const kanban = getHistory(user.id).map<FeedItem>((e) => ({
      id: e.id, kind: 'kanban', title: e.title, description: `${e.fromStatus || '—'} → ${e.toStatus}`,
      at: e.at, read: !!e.read, link: routeForEntry(e),
    }));
    const events = getNotifications(user.id).map<FeedItem>((e) => ({ ...e, read: !!e.read }));
    return [...kanban, ...events].sort((a, b) => b.at - a.at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tick]);

  const unread = items.filter((i) => !i.read).length;

  const markRead = () => {
    if (!user) return;
    markAllRead(user.id);
    markAllNotificationsRead(user.id);
  };
  const clear = () => {
    if (!user) return;
    clearHistory(user.id);
    clearNotifications(user.id);
  };

  return { items, unread, markRead, clear };
}

export function timeAgo(ts: number) {
  const m = Math.floor(Math.max(0, Date.now() - ts) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
