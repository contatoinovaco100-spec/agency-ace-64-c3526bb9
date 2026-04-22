export const UI_TO_DB_TASK_STATUS: Record<string, string> = {
  'Ideias / Backlog': 'A fazer',
  'Em Copy': 'Em copy',
  'Em Direção': 'Em direção',
  'Em Gravação': 'Em gravação',
  'Em Edição': 'Em edição',
  'Finalizado': 'Finalizado',
  'Concluído': 'Concluído',
};

export const DB_TO_UI_TASK_STATUS: Record<string, string> = {
  'A fazer': 'Ideias / Backlog',
  'Em andamento': 'Em Copy',
  'Em copy': 'Em Copy',
  'Em direção': 'Em Direção',
  'Em gravação': 'Em Gravação',
  'Em edição': 'Em Edição',
  'Revisão': 'Revisão',
  'Concluído': 'Concluído',
  'Finalizado': 'Finalizado',
};

export function toDatabaseTaskStatus(status: string | undefined) {
  if (!status) return 'A fazer';
  return UI_TO_DB_TASK_STATUS[status] || status;
}

export function toUiTaskStatus(status: string | undefined) {
  if (!status) return 'Ideias / Backlog';
  return DB_TO_UI_TASK_STATUS[status] || status;
}
