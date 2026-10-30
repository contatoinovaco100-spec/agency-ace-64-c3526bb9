/** Catálogo dos gatilhos das Automações do WhatsApp: rótulos, parâmetros e variáveis de cada um. */
export type TriggerKey =
  | 'approval_pending' | 'monthly_report' | 'invoice_due_soon' | 'invoice_due_today' | 'invoice_overdue'
  | 'shooting_tomorrow' | 'post_today' | 'team_daily_summary' | 'manual';

export type Automation = {
  id: string; name: string; description: string; trigger: TriggerKey; enabled: boolean; template: string;
  days_of_week: number[]; send_time: string; params: Record<string, number>;
  audience: { type: 'all' | 'clients' | 'team'; client_ids?: string[]; to?: string; to_name?: string };
  destination: 'group_then_phone' | 'group' | 'phone';
  scheduled_at: string | null; sent_at: string | null; last_run_at: string | null; created_at: string;
};

export type AutomationLog = {
  id: string; automation_id: string | null; client_id: string | null; ref: string; recipient: string;
  message: string; status: 'enviado' | 'sem_contato' | 'erro' | 'teste'; error: string; created_at: string;
};

type Param = { key: string; label: string; suffix: string; default: number };

export const CLIENT_VARS = [
  { key: 'nome', label: 'Primeiro nome do contato', sample: 'Maria' },
  { key: 'empresa', label: 'Nome da empresa', sample: 'Padaria Exemplo' },
  { key: 'link_aprovacao', label: 'Link de aprovação', sample: 'https://inovamarketing.online/conteudo/…' },
  { key: 'link_relatorio', label: 'Link do relatório', sample: 'https://inovamarketing.online/relatorio/…' },
  { key: 'link_portal', label: 'Link do portal', sample: 'https://inovamarketing.online/portal/…' },
];

export const TRIGGERS: Record<TriggerKey, {
  label: string; group: 'Cliente' | 'Financeiro' | 'Produção' | 'Equipe' | 'Disparo';
  description: string; params: Param[]; vars: { key: string; label: string; sample: string }[];
  audience: 'client' | 'team'; schedule: 'weekly' | 'monthly' | 'once';
}> = {
  approval_pending: {
    label: 'Aprovação pendente', group: 'Cliente', audience: 'client', schedule: 'weekly',
    description: 'Cliente com vídeo ou arte esperando aprovação há alguns dias.',
    params: [
      { key: 'wait_days', label: 'Esperando há pelo menos', suffix: 'dias', default: 2 },
      { key: 'gap_days', label: 'Intervalo entre lembretes', suffix: 'dias', default: 3 },
      { key: 'max_per_item', label: 'Máximo de lembretes por conteúdo', suffix: 'vezes', default: 3 },
    ],
    vars: [
      { key: 'qtd', label: 'Quantidade', sample: '2' },
      { key: 'qtd_texto', label: '"Tem 2 conteúdos prontos"', sample: 'Tem 2 conteúdos prontos' },
      { key: 'lista_conteudos', label: 'Lista dos títulos', sample: '• Dicas de verão\n• Promoção de novembro' },
    ],
  },
  monthly_report: {
    label: 'Relatório mensal', group: 'Cliente', audience: 'client', schedule: 'monthly',
    description: 'Link do relatório do mês anterior, para quem teve conteúdo publicado.',
    params: [{ key: 'day_of_month', label: 'Dia do mês', suffix: '', default: 1 }],
    vars: [{ key: 'mes', label: 'Mês', sample: 'outubro' }, { key: 'qtd', label: 'Conteúdos no ar', sample: '12' }],
  },
  invoice_due_soon: {
    label: 'Fatura vence em breve', group: 'Financeiro', audience: 'client', schedule: 'weekly',
    description: 'Fatura em aberto que vence daqui a alguns dias.',
    params: [{ key: 'days_before', label: 'Avisar', suffix: 'dias antes', default: 3 }],
    vars: [
      { key: 'descricao', label: 'Descrição', sample: 'Mensalidade novembro' }, { key: 'valor', label: 'Valor', sample: 'R$ 1.500,00' },
      { key: 'vencimento', label: 'Vencimento', sample: '10/11/2026' }, { key: 'link_fatura', label: 'Link da fatura', sample: 'https://inovamarketing.online/fatura/…' },
    ],
  },
  invoice_due_today: {
    label: 'Fatura vence hoje', group: 'Financeiro', audience: 'client', schedule: 'weekly',
    description: 'Fatura em aberto que vence no dia.', params: [],
    vars: [
      { key: 'descricao', label: 'Descrição', sample: 'Mensalidade novembro' }, { key: 'valor', label: 'Valor', sample: 'R$ 1.500,00' },
      { key: 'vencimento', label: 'Vencimento', sample: '10/11/2026' }, { key: 'link_fatura', label: 'Link da fatura', sample: 'https://inovamarketing.online/fatura/…' },
    ],
  },
  invoice_overdue: {
    label: 'Fatura vencida', group: 'Financeiro', audience: 'client', schedule: 'weekly',
    description: 'Fatura que venceu há alguns dias e continua em aberto.',
    params: [{ key: 'days_after', label: 'Cobrar', suffix: 'dias depois do vencimento', default: 3 }],
    vars: [
      { key: 'descricao', label: 'Descrição', sample: 'Mensalidade novembro' }, { key: 'valor', label: 'Valor', sample: 'R$ 1.500,00' },
      { key: 'vencimento', label: 'Vencimento', sample: '10/11/2026' }, { key: 'link_fatura', label: 'Link da fatura', sample: 'https://inovamarketing.online/fatura/…' },
    ],
  },
  shooting_tomorrow: {
    label: 'Lembrete de gravação', group: 'Produção', audience: 'client', schedule: 'weekly',
    description: 'Gravações da agenda de Gravações: avisa alguns dias antes ou no próprio dia (0 = no dia).',
    params: [{ key: 'days_before', label: 'Avisar', suffix: 'dias antes (0 = no dia)', default: 1 }],
    vars: [
      { key: 'quando', label: 'hoje / amanhã / em 2 dias', sample: 'amanhã' },
      { key: 'titulo', label: 'Título', sample: 'Gravação de Reels' }, { key: 'data', label: 'Data', sample: '31/10/2026' },
      { key: 'hora', label: 'Horário', sample: '14:00' }, { key: 'local', label: 'Local', sample: 'Estúdio INOVA' },
    ],
  },
  post_today: {
    label: 'Post vai ao ar hoje', group: 'Produção', audience: 'client', schedule: 'weekly',
    description: 'Posts com publicação marcada para o dia.', params: [],
    vars: [{ key: 'qtd', label: 'Quantidade', sample: '1' }, { key: 'lista_conteudos', label: 'Lista com horários', sample: '• Dicas de verão às 18:00' }],
  },
  team_daily_summary: {
    label: 'Resumo diário da equipe', group: 'Equipe', audience: 'team', schedule: 'weekly',
    description: 'Pendências do dia num grupo ou número da equipe.', params: [],
    vars: [
      { key: 'aprovados', label: 'Aprovados para agendar', sample: '3' }, { key: 'atrasados', label: 'Posts atrasados', sample: '5' },
      { key: 'sem_legenda', label: 'Sem legenda (3 dias)', sample: '2' }, { key: 'aguardando', label: 'Esperando aprovação', sample: '4' },
      { key: 'link_meu_dia', label: 'Link do Meu dia', sample: 'https://inovamarketing.online/meu-dia' },
    ],
  },
  manual: {
    label: 'Disparo manual', group: 'Disparo', audience: 'client', schedule: 'once',
    description: 'Mensagem única para os clientes escolhidos, na data e hora marcadas.', params: [], vars: [],
  },
};

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function scheduleLabel(a: Pick<Automation, 'trigger' | 'days_of_week' | 'send_time' | 'params' | 'scheduled_at'>) {
  const time = a.send_time?.slice(0, 5);
  const t = TRIGGERS[a.trigger];
  if (t.schedule === 'once') return a.scheduled_at ? new Date(a.scheduled_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Sem data';
  if (t.schedule === 'monthly') return `Todo dia ${a.params?.day_of_month ?? 1} · ${time}`;
  const d = [...(a.days_of_week ?? [])].sort();
  const days = d.length === 7 ? 'Todos os dias' : d.join() === '1,2,3,4,5' ? 'Seg a sex' : d.map((i) => WEEKDAYS[i]).join(', ');
  return `${days} · ${time}`;
}

/** Texto de exemplo com as variáveis trocadas por dados fictícios (prévia do editor) */
export function sampleRender(template: string, trigger: TriggerKey) {
  const vars = Object.fromEntries([...CLIENT_VARS, ...TRIGGERS[trigger].vars].map((v) => [v.key, v.sample]));
  return template.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}
