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

/** Modelo pronto "Rotina do coordenador" (expediente 9h–18h): os blocos do dia e da semana do documento de processo, um lembrete por bloco */
export type RoutineItem = Pick<TeamReminder, 'title' | 'kind' | 'message' | 'items' | 'weekdays' | 'send_times'>;
const WEEKDAYS = [1, 2, 3, 4, 5];
export const COORDINATOR_ROUTINE: RoutineItem[] = [
  { title: 'Abertura do dia', kind: 'checklist', weekdays: WEEKDAYS, send_times: ['09:00'], message: 'Bom dia, {nome}! Abertura de {dia} (20 min):',
    items: ['Abrir o Meu Dia e o kanban', 'Ver os atrasados e as entregas de hoje', 'Conferir na agenda as gravações e calls de venda de hoje', 'Separar 15 min antes de cada call para ler o que já se sabe do lead', 'Separar a lista de quem fez call e não fechou', 'Ler só os grupos de cliente com urgência'] },
  { title: 'Follow-up das calls', kind: 'checklist', weekdays: WEEKDAYS, send_times: ['09:20'], message: '{nome}, hora do follow-up (até 10h): ligue para quem já fez call com você e não fechou.',
    items: ['Ligar para cada lead da lista', 'Tentar fechar ou marcar a decisão para hoje', 'Mandar o resultado de cada ligação para quem cuida do CRM'] },
  { title: 'Coordenação de produção', kind: 'checklist', weekdays: WEEKDAYS, send_times: ['10:00'], message: 'Bloco de produção até 11h30:',
    items: ['Ver no kanban o que cada um entrega hoje', 'Destravar quem está parado', 'Cobrar quem está atrasado', 'Dar dono e nova data a cada atraso'] },
  { title: 'Agenda de amanhã', kind: 'checklist', weekdays: WEEKDAYS, send_times: ['11:30'], message: 'Hora de fechar a agenda de amanhã:',
    items: ['Confirmar as gravações de amanhã com os clientes', 'Confirmar as calls de amanhã', 'Resolver conflitos de horário', 'Avisar o videomaker'] },
  { title: 'Volta do almoço', kind: 'checklist', weekdays: WEEKDAYS, send_times: ['13:00'], message: 'Volta do almoço, {nome}:',
    items: ['Mandar o resumo das calls da manhã para quem cuida do CRM', 'Conferir as calls de venda da tarde', 'Mandar o lembrete "daqui a 1 hora"'] },
  { title: 'Checagem da tarde', kind: 'checklist', weekdays: WEEKDAYS, send_times: ['15:30'], message: 'Checagem das 15h30:',
    items: ['As entregas de hoje vão sair no prazo?', 'Resumo das calls de hoje enviado', 'Propostas enviadas em até 2 horas'] },
  { title: 'Fechamento do dia', kind: 'checklist', weekdays: WEEKDAYS, send_times: ['17:30'], message: 'Fechando o dia, {nome}:',
    items: ['Kanban atualizado', 'Nenhum atraso sem nova data', 'Agenda de amanhã pronta', 'Resumo do dia enviado para o dono'] },
  { title: 'Planejamento da semana', kind: 'checklist', weekdays: [1], send_times: ['10:00'], message: 'Segunda: planejamento da semana (até 11h):',
    items: ['Todas as entregas da semana com dono e data no kanban', 'Gravações da semana confirmadas', 'Meta de calls da semana definida'] },
  { title: 'Meio da semana', kind: 'lembrete', weekdays: [3], send_times: ['16:55'], message: '{nome}, o que vai atrasar até sexta? Redistribua, avise o cliente ou ajuste a data hoje.', items: [] },
  { title: 'Agenda da próxima semana', kind: 'checklist', weekdays: [4], send_times: ['11:30'], message: 'Quinta: agenda da próxima semana:',
    items: ['Gravações da próxima semana marcadas e confirmadas', 'Calls da próxima semana marcadas'] },
  { title: 'Revisão da semana', kind: 'checklist', weekdays: [5], send_times: ['16:00'], message: 'Sexta: revisão da semana com o dono. Leve os números:',
    items: ['Calls feitas e taxa de fechamento', 'Propostas enviadas em até 2 horas', 'Entregas no prazo', 'Atrasados sem nova data (meta: zero)', 'O que muda na próxima semana'] },
];
