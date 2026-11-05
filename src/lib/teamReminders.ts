/** Lembretes e checklists da equipe (Equipe → Lembretes), enviados no WhatsApp de cada funcionário. */
export type TeamReminder = {
  id: string; title: string; kind: 'checklist' | 'lembrete'; message: string; items: string[];
  weekdays: number[]; send_time: string; people: string[]; enabled: boolean; last_run_on: string | null;
  /** Horários do dia, "08:00" e "14:00" */
  send_times: string[];
};

export type ReminderLog = { reminder_id: string; person: string; sent_on: string; status: 'enviado' | 'sem_contato' | 'erro' | 'teste'; error: string };

export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
/** Segunda primeiro, como a semana de trabalho */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const emptyReminder = (): Omit<TeamReminder, 'id' | 'last_run_on'> => ({
  send_times: ['08:00'],
  title: '', kind: 'checklist', message: 'Bom dia, {nome}! Checklist de {dia}:', items: [''],
  weekdays: [1, 2, 3, 4, 5], send_time: '08:00', people: [], enabled: true,
});

/** Texto que chega no WhatsApp (o mesmo de supabase/functions/wa-automations) */
export function reminderMessage(r: Pick<TeamReminder, 'title' | 'kind' | 'message' | 'items'>, person: string, dow: number) {
  const vars: Record<string, string> = { nome: person.trim().split(/\s+/)[0] || '', dia: WEEKDAY_NAMES[dow] };
  const items = (r.items ?? []).map((i) => i.trim()).filter(Boolean);
  return [
    `${r.kind === 'checklist' ? '📋' : '🔔'} *${r.title}*`,
    r.message.trim() ? r.message.trim().replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m) : '',
    items.map((i) => `${r.kind === 'checklist' ? '☐' : '•'} ${i}`).join('\n'),
  ].filter(Boolean).join('\n\n');
}

export const phoneOf = (raw?: string | null) => {
  const d = (raw ?? '').replace(/\D/g, '');
  if (d.length < 10) return null;
  return d.length <= 11 ? `55${d}` : d;
};
