/** Catálogo dos gatilhos das Automações do WhatsApp: rótulos, parâmetros e variáveis de cada um. */
export type TriggerKey =
  | 'approval_pending' | 'monthly_report' | 'invoice_due_soon' | 'invoice_due_today' | 'invoice_overdue'
  | 'shooting_tomorrow' | 'post_today' | 'team_daily_summary' | 'manual'
  | 'welcome_contract' | 'onboarding_stalled' | 'content_ready' | 'change_received' | 'approved_ack' | 'partnership_anniversary' | 'satisfaction_survey'
  | 'payment_confirmed' | 'invoice_created' | 'contract_ending' | 'post_published' | 'next_week'
  | 'task_assigned' | 'deadline_tomorrow' | 'client_at_risk' | 'instagram_disconnected' | 'sale_closed' | 'lead_stalled'
  | 'script_missing' | 'change_request_team' | 'shooting_team' | 'manager_report'
  | 'recurring_clients' | 'recurring_team';

export type Automation = {
  id: string; name: string; description: string; trigger: TriggerKey; enabled: boolean; template: string;
  days_of_week: number[]; send_time: string; params: Record<string, number>;
  audience: { type: 'all' | 'clients' | 'team'; client_ids?: string[]; to?: string; to_name?: string };
  destination: 'group_then_phone' | 'group' | 'phone';
  scheduled_at: string | null; sent_at: string | null; last_run_at: string | null; created_at: string;
  /** Texto por dia da semana (0 = domingo); dia sem texto usa `template` */
  templates_by_day?: Record<string, string>;
  /** Número que envia (sessão do servidor); vazio = principal */
  session_id?: string | null;
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
  label: string; group: 'Cliente' | 'Financeiro' | 'Produção' | 'Equipe' | 'Comercial' | 'Recorrente' | 'Disparo';
  description: string; params: Param[]; vars: { key: string; label: string; sample: string }[];
  /** client = cliente; team = grupo/número da equipe; people = WhatsApp de cada pessoa responsável */
  audience: 'client' | 'team' | 'people';
  /** event = assim que acontece (conferido a cada 15 min, dentro da janela de horário) */
  schedule: 'weekly' | 'monthly' | 'once' | 'event';
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
  welcome_contract: {
    label: 'Boas-vindas (contrato assinado)', group: 'Cliente', audience: 'client', schedule: 'event',
    description: 'Assim que o cliente assina o contrato.', params: [{ key: 'start_hour', label: 'Enviar a partir das', suffix: 'h', default: 8 }, { key: 'end_hour', label: 'Até as', suffix: 'h', default: 20 }], vars: [],
  },
  onboarding_stalled: {
    label: 'Onboarding parado', group: 'Cliente', audience: 'client', schedule: 'weekly',
    description: 'Onboarding sem avanço há alguns dias (inclui materiais pendentes), com o link para continuar.',
    params: [{ key: 'days_after', label: 'Parado há pelo menos', suffix: 'dias', default: 3 }, { key: 'gap_days', label: 'Intervalo entre lembretes', suffix: 'dias', default: 3 }],
    vars: [{ key: 'link_onboarding', label: 'Link do onboarding', sample: 'https://inovamarketing.online/bem-vindo/…' }],
  },
  content_ready: {
    label: 'Conteúdo novo para aprovar', group: 'Cliente', audience: 'client', schedule: 'event',
    description: 'Avisa o cliente assim que um vídeo ou arte fica pronto para aprovação, com o link do portal.',
    params: [{ key: 'start_hour', label: 'Enviar a partir das', suffix: 'h', default: 9 }, { key: 'end_hour', label: 'Até as', suffix: 'h', default: 19 }],
    vars: [
      { key: 'qtd', label: 'Quantidade', sample: '2' },
      { key: 'qtd_texto', label: '"Tem 2 conteúdos novos"', sample: 'Tem 2 conteúdos novos' },
      { key: 'lista_conteudos', label: 'Lista dos títulos', sample: '• Dicas de verão\n• Promoção de novembro' },
    ],
  },
  change_received: {
    label: 'Pedido de ajuste recebido', group: 'Cliente', audience: 'client', schedule: 'event',
    description: 'Confirma para o cliente que o pedido de ajuste chegou.', params: [{ key: 'start_hour', label: 'Enviar a partir das', suffix: 'h', default: 8 }, { key: 'end_hour', label: 'Até as', suffix: 'h', default: 20 }],
    vars: [{ key: 'titulo', label: 'Conteúdo', sample: 'Dicas de verão' }, { key: 'pedido', label: 'O que ele pediu', sample: 'trocar a música' }],
  },
  approved_ack: {
    label: 'Conteúdo aprovado', group: 'Cliente', audience: 'client', schedule: 'event',
    description: 'Agradece a aprovação e diz quando vai ao ar.', params: [{ key: 'start_hour', label: 'Enviar a partir das', suffix: 'h', default: 8 }, { key: 'end_hour', label: 'Até as', suffix: 'h', default: 20 }],
    vars: [{ key: 'titulo', label: 'Conteúdo', sample: 'Dicas de verão' }, { key: 'data_post', label: 'Data e hora do post', sample: '05/11/2026 às 18:00' }],
  },
  partnership_anniversary: {
    label: 'Aniversário de parceria', group: 'Cliente', audience: 'client', schedule: 'weekly',
    description: '6 meses e cada ano desde o início do contrato.', params: [],
    vars: [{ key: 'tempo', label: '6 meses / 1 ano…', sample: '1 ano' }],
  },
  satisfaction_survey: {
    label: 'Pesquisa de satisfação', group: 'Cliente', audience: 'client', schedule: 'monthly',
    description: 'Pergunta mensal de 0 a 10 (a resposta chega no WhatsApp).',
    params: [{ key: 'day_of_month', label: 'Dia do mês', suffix: '', default: 25 }],
    vars: [{ key: 'mes', label: 'Mês', sample: 'novembro' }],
  },
  payment_confirmed: {
    label: 'Pagamento confirmado', group: 'Financeiro', audience: 'client', schedule: 'event',
    description: 'Quando a fatura é marcada como paga.', params: [{ key: 'start_hour', label: 'Enviar a partir das', suffix: 'h', default: 8 }, { key: 'end_hour', label: 'Até as', suffix: 'h', default: 20 }],
    vars: [{ key: 'descricao', label: 'Descrição', sample: 'Mensalidade novembro' }, { key: 'valor', label: 'Valor', sample: 'R$ 1.500,00' }],
  },
  invoice_created: {
    label: 'Fatura nova', group: 'Financeiro', audience: 'client', schedule: 'event',
    description: 'Quando uma fatura nova é gerada para o cliente.', params: [{ key: 'start_hour', label: 'Enviar a partir das', suffix: 'h', default: 8 }, { key: 'end_hour', label: 'Até as', suffix: 'h', default: 20 }],
    vars: [
      { key: 'descricao', label: 'Descrição', sample: 'Mensalidade novembro' }, { key: 'valor', label: 'Valor', sample: 'R$ 1.500,00' },
      { key: 'vencimento', label: 'Vencimento', sample: '10/11/2026' }, { key: 'link_fatura', label: 'Link da fatura', sample: 'https://inovamarketing.online/fatura/…' },
    ],
  },
  contract_ending: {
    label: 'Contrato perto do fim', group: 'Financeiro', audience: 'client', schedule: 'weekly',
    description: 'Alguns dias antes do fim do contrato, para falar de renovação.',
    params: [{ key: 'days_before', label: 'Avisar', suffix: 'dias antes', default: 30 }],
    vars: [{ key: 'fim_contrato', label: 'Fim do contrato', sample: '30/11/2026' }],
  },
  post_published: {
    label: 'Post publicado', group: 'Produção', audience: 'client', schedule: 'event',
    description: 'Quando um post agendado pela plataforma vai ao ar.', params: [{ key: 'start_hour', label: 'Enviar a partir das', suffix: 'h', default: 8 }, { key: 'end_hour', label: 'Até as', suffix: 'h', default: 20 }],
    vars: [{ key: 'link_post', label: 'Link do post', sample: 'https://instagram.com/p/…' }],
  },
  next_week: {
    label: 'O que vai ao ar na próxima semana', group: 'Produção', audience: 'client', schedule: 'weekly',
    description: 'Lista dos posts de segunda a domingo da semana seguinte.', params: [],
    vars: [{ key: 'qtd', label: 'Quantidade', sample: '4' }, { key: 'lista_conteudos', label: 'Lista com datas', sample: '• 03/11 — Dicas de verão' }],
  },
  task_assigned: {
    label: 'Tarefa nova para você', group: 'Equipe', audience: 'people', schedule: 'event',
    description: 'Avisa cada pessoa marcada numa tarefa nova do kanban.', params: [{ key: 'start_hour', label: 'Enviar a partir das', suffix: 'h', default: 8 }, { key: 'end_hour', label: 'Até as', suffix: 'h', default: 20 }],
    vars: [
      { key: 'pessoa', label: 'Nome da pessoa', sample: 'Lucas' }, { key: 'titulo', label: 'Tarefa', sample: 'Vídeo de verão' },
      { key: 'cliente', label: 'Cliente', sample: 'Padaria Exemplo' }, { key: 'prazo', label: 'Prazo', sample: '05/11/2026' },
      { key: 'link_tarefa', label: 'Link da tarefa', sample: 'https://inovamarketing.online/tarefas?taskId=…' },
    ],
  },
  deadline_tomorrow: {
    label: 'Prazo vencendo', group: 'Equipe', audience: 'people', schedule: 'weekly',
    description: 'Tarefas com entrega próxima que ainda não estão prontas, para cada responsável.',
    params: [{ key: 'days_before', label: 'Avisar', suffix: 'dias antes da entrega', default: 1 }],
    vars: [
      { key: 'pessoa', label: 'Nome da pessoa', sample: 'Lucas' }, { key: 'qtd', label: 'Quantidade', sample: '2' },
      { key: 'data', label: 'Data da entrega', sample: '31/10/2026' }, { key: 'lista_tarefas', label: 'Lista de tarefas', sample: '• Vídeo de verão (Padaria) — Em edição' },
    ],
  },
  script_missing: {
    label: 'Roteiro pendente', group: 'Equipe', audience: 'people', schedule: 'weekly',
    description: 'Vídeo na fila de gravação (ou com gravação próxima) sem roteiro, para o copywriter.',
    params: [{ key: 'days_before', label: 'Gravações nos próximos', suffix: 'dias', default: 3 }],
    vars: [{ key: 'pessoa', label: 'Nome da pessoa', sample: 'Lucas' }, { key: 'qtd', label: 'Quantidade', sample: '2' }, { key: 'lista_tarefas', label: 'Lista', sample: '• Vídeo de verão (Padaria)' }],
  },
  change_request_team: {
    label: 'Cliente pediu ajuste (equipe)', group: 'Equipe', audience: 'people', schedule: 'event',
    description: 'Avisa quem está marcado na tarefa, com o pedido do cliente.', params: [{ key: 'start_hour', label: 'Enviar a partir das', suffix: 'h', default: 8 }, { key: 'end_hour', label: 'Até as', suffix: 'h', default: 20 }],
    vars: [
      { key: 'pessoa', label: 'Nome da pessoa', sample: 'Lucas' }, { key: 'cliente', label: 'Cliente', sample: 'Padaria Exemplo' },
      { key: 'titulo', label: 'Conteúdo', sample: 'Dicas de verão' }, { key: 'pedido', label: 'Pedido', sample: 'trocar a música' },
      { key: 'link_tarefa', label: 'Link da tarefa', sample: 'https://inovamarketing.online/tarefas?taskId=…' },
    ],
  },
  shooting_team: {
    label: 'Gravações do dia seguinte (equipe)', group: 'Equipe', audience: 'team', schedule: 'weekly',
    description: 'Agenda de gravações do dia seguinte no grupo da equipe.',
    params: [{ key: 'days_before', label: 'Gravações daqui a', suffix: 'dias (0 = hoje)', default: 1 }],
    vars: [{ key: 'data', label: 'Data', sample: '31/10/2026' }, { key: 'qtd', label: 'Quantidade', sample: '3' }, { key: 'lista_gravacoes', label: 'Lista com horários', sample: '• 14:00 — Captação Padaria (Centro)' }],
  },
  manager_report: {
    label: 'Relatório de produção (gestores)', group: 'Equipe', audience: 'team', schedule: 'weekly',
    description: 'O que a equipe entregou hoje: finalizados, concluídos, aprovações, ajustes e quem mais movimentou. Crie uma para cada horário (ex.: 12h e 18h).',
    params: [],
    vars: [
      { key: 'data', label: 'Data', sample: '30/10/2026' }, { key: 'hora', label: 'Hora do envio', sample: '18:00' },
      { key: 'finalizados_hoje', label: 'Finalizados hoje', sample: '4' }, { key: 'videos_finalizados_hoje', label: 'Vídeos finalizados hoje', sample: '3' },
      { key: 'lista_finalizados', label: 'Lista dos finalizados', sample: '• Dicas de verão — Padaria\n• Promoção — Ótica' },
      { key: 'concluidos_hoje', label: 'Concluídos/postados hoje', sample: '6' }, { key: 'lista_concluidos', label: 'Lista dos concluídos', sample: '• Reels de outubro — Academia' },
      { key: 'revisao_hoje', label: 'Foram para revisão', sample: '5' }, { key: 'alteracoes_hoje', label: 'Voltaram para alteração', sample: '2' },
      { key: 'aprovados_hoje', label: 'Aprovados pelos clientes hoje', sample: '3' }, { key: 'em_finalizado_agora', label: 'Em Finalizado agora', sample: '9' },
      { key: 'atrasados', label: 'Posts atrasados (30 dias)', sample: '12' }, { key: 'movimentacoes', label: 'Movimentações no kanban', sample: '48' },
      { key: 'ranking_equipe', label: 'Quem mais movimentou', sample: '🥇 Stefani (20)  🥈 Petrus (14)  🥉 Íris (9)' },
    ],
  },
  client_at_risk: {
    label: 'Clientes em risco', group: 'Equipe', audience: 'team', schedule: 'weekly',
    description: 'Clientes com 3+ posts atrasados ou fatura vencida há mais de 10 dias.', params: [],
    vars: [{ key: 'qtd', label: 'Quantidade', sample: '2' }, { key: 'lista_clientes', label: 'Lista', sample: '• Padaria — 4 posts atrasados' }, { key: 'link_clientes', label: 'Link de Clientes', sample: 'https://inovamarketing.online/clientes' }],
  },
  instagram_disconnected: {
    label: 'Instagram desconectado', group: 'Equipe', audience: 'team', schedule: 'event',
    description: 'Contas do Instagram que perderam o acesso.', params: [{ key: 'start_hour', label: 'Enviar a partir das', suffix: 'h', default: 8 }, { key: 'end_hour', label: 'Até as', suffix: 'h', default: 20 }],
    vars: [{ key: 'qtd', label: 'Quantidade', sample: '1' }, { key: 'lista_contas', label: 'Contas', sample: '• @padariaexemplo' }, { key: 'link_redes', label: 'Link de Redes Sociais', sample: 'https://inovamarketing.online/redes-sociais' }],
  },
  sale_closed: {
    label: 'Venda fechada 🎉', group: 'Comercial', audience: 'team', schedule: 'event',
    description: 'Contrato assinado: comemora no grupo da equipe.', params: [{ key: 'start_hour', label: 'Enviar a partir das', suffix: 'h', default: 8 }, { key: 'end_hour', label: 'Até as', suffix: 'h', default: 20 }],
    vars: [{ key: 'empresa', label: 'Empresa', sample: 'Padaria Exemplo' }, { key: 'valor', label: 'Valor mensal', sample: 'R$ 1.500,00' }, { key: 'plano', label: 'Plano', sample: 'Social Media' }],
  },
  lead_stalled: {
    label: 'Lead parado', group: 'Comercial', audience: 'people', schedule: 'weekly',
    description: 'Leads sem contato há alguns dias, para o vendedor responsável.',
    params: [{ key: 'days_after', label: 'Sem contato há', suffix: 'dias', default: 3 }],
    vars: [{ key: 'pessoa', label: 'Nome do vendedor', sample: 'Lucas' }, { key: 'qtd', label: 'Quantidade', sample: '5' }, { key: 'lista_leads', label: 'Lista', sample: '• Padaria Exemplo — Proposta enviada' }, { key: 'link_crm', label: 'Link do CRM', sample: 'https://inovamarketing.online/crm' }],
  },
  recurring_clients: {
    label: 'Mensagem recorrente para clientes', group: 'Recorrente', audience: 'client', schedule: 'weekly',
    description: 'Mensagem nos dias e horário escolhidos, com um texto diferente para cada dia da semana (ex.: dica de segunda, bom fim de semana na sexta).',
    params: [], vars: [{ key: 'data', label: 'Data de hoje', sample: '30/10/2026' }],
  },
  recurring_team: {
    label: 'Mensagem recorrente para a equipe', group: 'Recorrente', audience: 'team', schedule: 'weekly',
    description: 'Mensagem para o grupo ou números da equipe, com um texto diferente para cada dia da semana (ex.: metas de segunda, recado de sexta).',
    params: [], vars: [{ key: 'data', label: 'Data de hoje', sample: '30/10/2026' }],
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
  if (t.schedule === 'event') return `Na hora · ${a.params?.start_hour ?? 8}h às ${a.params?.end_hour ?? 20}h`;
  const d = [...(a.days_of_week ?? [])].sort();
  const days = d.length === 7 ? 'Todos os dias' : d.join() === '1,2,3,4,5' ? 'Seg a sex' : d.map((i) => WEEKDAYS[i]).join(', ');
  return `${days} · ${time}`;
}

/** Texto de exemplo com as variáveis trocadas por dados fictícios (prévia do editor) */
export function sampleRender(template: string, trigger: TriggerKey) {
  const vars = Object.fromEntries([...CLIENT_VARS, ...TRIGGERS[trigger].vars].map((v) => [v.key, v.sample]));
  return template.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}
