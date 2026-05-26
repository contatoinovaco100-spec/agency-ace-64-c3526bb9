export type ClientStatus = 'Ativo' | 'Pausado' | 'Cancelado';
export type ServiceType = 'Gestor de trafego' | 'Social Media' | 'Estrategista digital' | 'Editor de Video' | 'Copywritter' | 'Design';
export type TaskStatus = 'A fazer' | 'Em andamento' | 'Revisão' | 'Concluído';
export type TaskPriority = 'Alta' | 'Média' | 'Baixa';
export type LeadStage = 'Lead novo' | 'Contato iniciado' | 'Reunião agendada' | 'Proposta enviada' | 'Negociação' | 'Cliente fechado' | 'Perdido';
export type TaskType = 'Geral' | 'Produção de Vídeo';

export type VideoStage = 'Em copy' | 'Em direção' | 'Em gravação' | 'Em edição' | 'Finalizado';

export const VIDEO_STAGES: VideoStage[] = ['Em copy', 'Em direção', 'Em gravação', 'Em edição', 'Finalizado'];

export const VIDEO_STAGE_OWNERS: Record<VideoStage, string> = {
  'Em copy': 'Copywriter',
  'Em direção': 'Diretor',
  'Em gravação': 'Videomaker',
  'Em edição': 'Editor',
  'Finalizado': '',
};

export const VIDEO_STAGE_ACTIONS: Record<string, string> = {
  'Em copy': 'Enviar para Direção',
  'Em direção': 'Enviar para Gravação',
  'Em gravação': 'Enviar para Edição',
  'Em edição': 'Finalizar tarefa',
};

export interface Client {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  contractStartDate: string;
  monthlyValue: number;
  scope: string;
  serviceType: ServiceType[];
  accountManager: string;
  status: ClientStatus;
  notes: string;
  scopeDetails: ScopeDetails;
}

export interface ScopeDetails {
  monthlyDeliverables: string[];
  includedServices: string[];
  demandLimits: string;
  platforms: string[];
  strategicNotes: string;
}

export interface Task {
  id: string;
  clientId: string;
  title: string;
  description: string;
  assignee: string;
  priority: TaskPriority;
  dueDate: string;
  status: TaskStatus | VideoStage;
  taskType: TaskType;
  // Video fields
  videoName: string;
  platform: string;
  format: string;
  videoObjective: string;
  scriptWriter: string;
  editor: string;
  videoIdea: string;
  fullScript: string;
  videoReferences: string;
  observations: string;
  // Pipeline fields
  creativeDirection: string;
  editingStyle: string;
  strategicNotes: string;
  recordingNotes: string;
  editorComments: string;
  currentStageOwner: string;
  copywriter: string;
  director: string;
  videomaker: string;
  // Final delivery
  videoUrl?: string;
  // Post scheduling
  postDate?: string;
  postTime?: string;
}

export interface TaskChecklistItem {
  id: string;
  taskId: string;
  label: string;
  checked: boolean;
  sortOrder: number;
}

export interface TaskComment {
  id: string;
  taskId: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  createdAt: string;
}

export interface TaskStageHistory {
  id: string;
  taskId: string;
  fromStage: string;
  toStage: string;
  changedBy: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  assignee: string;
  notes: string;
  stage: LeadStage;
  estimatedValue: number;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  permissions: string;
  avatar?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'task' | 'delivery' | 'meeting';
  clientId?: string;
}
