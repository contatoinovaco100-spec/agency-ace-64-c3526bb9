// Generic notification history persisted in localStorage per user.
// Used by the NotificationsPage to show a saved log of app events.

export interface NotificationHistoryEntry {
  id: string;
  title: string;
  description?: string;
  kind: 'sale' | 'signature' | 'task' | 'approval' | 'mention' | 'lead' | 'error' | 'info';
  at: number; // epoch ms
  read?: boolean;
  /** Para onde a notificação leva ao clicar */
  link?: string;
}

const MAX = 500;
const EVT = 'notification-history-updated';
const keyFor = (userId: string) => `notificationHistory:${userId}`;

export function getNotifications(userId: string): NotificationHistoryEntry[] {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const arr = JSON.parse(raw) as NotificationHistoryEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function addNotification(
  userId: string,
  entry: Omit<NotificationHistoryEntry, 'id' | 'at' | 'read'>,
) {
  const list = getNotifications(userId);
  const next: NotificationHistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    at: Date.now(),
    read: false,
  };
  const updated = [next, ...list].slice(0, MAX);
  localStorage.setItem(keyFor(userId), JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function markAllNotificationsRead(userId: string) {
  const list = getNotifications(userId);
  if (!list.some((n) => !n.read)) return;
  localStorage.setItem(keyFor(userId), JSON.stringify(list.map((n) => ({ ...n, read: true }))));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function clearNotifications(userId: string) {
  localStorage.removeItem(keyFor(userId));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function subscribeNotifications(cb: () => void) {
  const handler = () => cb();
  window.addEventListener(EVT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVT, handler);
    window.removeEventListener('storage', handler);
  };
}
