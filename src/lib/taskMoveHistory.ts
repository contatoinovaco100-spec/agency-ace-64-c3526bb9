// Persistent history of Kanban task moves for the current user.
// Stored in localStorage and broadcast via a lightweight event bus so
// UI components (like the bell dropdown) update in real time.

export interface TaskMoveHistoryEntry {
  id: string;
  taskId: string;
  title: string;
  fromStatus: string;
  toStatus: string;
  taskType?: string | null;
  clientId?: string | null;
  at: number; // epoch ms
  read?: boolean;
}

const MAX_ENTRIES = 1000;
const EVT = 'task-move-history-updated';


const keyFor = (userId: string) => `taskMoveHistory:${userId}`;

export function getHistory(userId: string): TaskMoveHistoryEntry[] {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const arr = JSON.parse(raw) as TaskMoveHistoryEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function addHistoryEntry(userId: string, entry: Omit<TaskMoveHistoryEntry, 'id' | 'at' | 'read'>) {
  const list = getHistory(userId);
  const next: TaskMoveHistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    at: Date.now(),
    read: false,
  };
  const updated = [next, ...list].slice(0, MAX_ENTRIES);
  localStorage.setItem(keyFor(userId), JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function markAllRead(userId: string) {
  const list = getHistory(userId).map(e => ({ ...e, read: true }));
  localStorage.setItem(keyFor(userId), JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function clearHistory(userId: string) {
  localStorage.removeItem(keyFor(userId));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function subscribeHistory(cb: () => void) {
  const handler = () => cb();
  window.addEventListener(EVT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVT, handler);
    window.removeEventListener('storage', handler);
  };
}

export function routeForEntry(entry: TaskMoveHistoryEntry): string {
  const base = entry.taskType === 'Arte' ? '/artes' : '/tarefas';
  return `${base}?taskId=${entry.taskId}`;
}
