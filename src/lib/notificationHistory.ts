// Generic notification history persisted in localStorage per user.
// Used by the NotificationsPage to show a saved log of app events.

export interface NotificationHistoryEntry {
  id: string;
  title: string;
  description?: string;
  kind: 'sale' | 'signature' | 'task' | 'info';
  at: number; // epoch ms
  read?: boolean;
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
