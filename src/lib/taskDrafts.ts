/** Rascunhos de cards do Kanban salvos localmente (aba "Rascunhos"). */

export interface TaskDraft {
  id: string;
  form: Record<string, unknown>;
  savedAt: string;
}

const LIST_KEY = 'inova:task-drafts';
const LEGACY_KEY = 'inova:task-draft';
export const DRAFTS_EVENT = 'inova:task-drafts-changed';

const hasContent = (form: Record<string, unknown> | undefined) =>
  !!form && Object.entries(form).some(([k, v]) =>
    !['taskType', 'status', 'priority', 'dueDate', 'clientId'].includes(k) &&
    typeof v === 'string' && v.trim().length > 0
  );

const emit = () => {
  try { window.dispatchEvent(new Event(DRAFTS_EVENT)); } catch { /* ignore */ }
};

export function listDrafts(): TaskDraft[] {
  let drafts: TaskDraft[] = [];
  try {
    const raw = localStorage.getItem(LIST_KEY);
    if (raw) drafts = JSON.parse(raw) as TaskDraft[];
  } catch { drafts = []; }
  if (!Array.isArray(drafts)) drafts = [];

  // Migração do formato antigo (rascunho único)
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as { form: Record<string, unknown>; savedAt: string };
      if (hasContent(parsed?.form)) {
        drafts.push({ id: `legacy-${Date.now()}`, form: parsed.form, savedAt: parsed.savedAt || new Date().toISOString() });
        localStorage.setItem(LIST_KEY, JSON.stringify(drafts));
      }
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch { /* ignore */ }

  return drafts
    .filter(d => d && d.id && hasContent(d.form))
    .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
}

export function getDraft(id: string): TaskDraft | null {
  return listDrafts().find(d => d.id === id) ?? null;
}

export function saveDraft(id: string, form: Record<string, unknown>): string | null {
  if (!hasContent(form)) return null;
  const savedAt = new Date().toISOString();
  const drafts = listDrafts().filter(d => d.id !== id);
  drafts.unshift({ id, form, savedAt });
  try { localStorage.setItem(LIST_KEY, JSON.stringify(drafts.slice(0, 30))); } catch { /* ignore */ }
  emit();
  return savedAt;
}

export function deleteDraft(id: string) {
  const drafts = listDrafts().filter(d => d.id !== id);
  try { localStorage.setItem(LIST_KEY, JSON.stringify(drafts)); } catch { /* ignore */ }
  emit();
}

export function clearDrafts() {
  try { localStorage.removeItem(LIST_KEY); localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
  emit();
}

export function draftTitle(d: TaskDraft): string {
  const f = d.form as Record<string, string>;
  return (f?.title || f?.videoName || '').trim() || 'Card sem título';
}

export function newDraftId(): string {
  return `d-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
