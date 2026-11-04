// Fluxos do WhatsApp (/fluxos-whatsapp): tipos e textos do editor. O motor fica em supabase/functions/_shared/flows.ts.
import {
  Clock, FileText, Flag, Image, ListChecks, MessageCircle, MessageSquareReply, Mic, MoveRight, BellRing, Video, BellOff,
  type LucideIcon,
} from 'lucide-react';

export type StepType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'delay' | 'wait_reply' | 'move_stage' | 'notify' | 'stop_followup' | 'end';
export type TimeUnit = 'segundos' | 'minutos' | 'horas' | 'dias';
export type Branch = { id: string; label: string; keywords: string; steps: FlowStep[] };
export type FlowStep = {
  id: string; type: StepType;
  text?: string; url?: string; caption?: string; fileName?: string;
  amount?: number; unit?: TimeUnit;
  branches?: Branch[]; other?: FlowStep[]; timeout?: FlowStep[];
  stage?: string; phone?: string;
};
export type FlowTrigger = 'first_reply' | 'new_contact' | 'keyword';
export type WaFlow = {
  id: string; name: string; enabled: boolean; session_id: string | null;
  trigger: FlowTrigger; trigger_config: { keywords?: string; match?: 'contains' | 'exact'; once?: boolean };
  steps: FlowStep[]; created_at: string; updated_at: string;
};
export type FlowRun = {
  id: string; flow_id: string; phone: string; contact_name: string; status: string; current_step: string | null;
  next_at: string; last_error: string; created_at: string; updated_at: string;
};

export const TRIGGERS: Record<FlowTrigger, { label: string; hint: string }> = {
  first_reply: { label: 'Respondeu a primeira mensagem', hint: 'O contato respondeu pela primeira vez a uma mensagem que você mandou (prospecção, follow-up ou disparo).' },
  new_contact: { label: 'Contato novo chamou', hint: 'Alguém que nunca conversou com o número mandou a primeira mensagem.' },
  keyword: { label: 'Mandou uma palavra-chave', hint: 'A mensagem tem uma das palavras escolhidas (ex.: preço, orçamento).' },
};

export const STEP_TYPES: Record<StepType, { label: string; icon: LucideIcon; group: 'Mensagem' | 'Tempo' | 'CRM' | 'Fim' }> = {
  text: { label: 'Mensagem de texto', icon: MessageCircle, group: 'Mensagem' },
  image: { label: 'Foto', icon: Image, group: 'Mensagem' },
  video: { label: 'Vídeo', icon: Video, group: 'Mensagem' },
  audio: { label: 'Áudio', icon: Mic, group: 'Mensagem' },
  document: { label: 'Arquivo (PDF…)', icon: FileText, group: 'Mensagem' },
  delay: { label: 'Esperar um tempo', icon: Clock, group: 'Tempo' },
  wait_reply: { label: 'Esperar resposta', icon: MessageSquareReply, group: 'Tempo' },
  move_stage: { label: 'Mover etapa no CRM', icon: MoveRight, group: 'CRM' },
  notify: { label: 'Avisar a equipe', icon: BellRing, group: 'CRM' },
  stop_followup: { label: 'Parar follow-ups', icon: BellOff, group: 'CRM' },
  end: { label: 'Encerrar fluxo', icon: Flag, group: 'Fim' },
};
export const STEP_GROUPS = ['Mensagem', 'Tempo', 'CRM', 'Fim'] as const;
export const RUN_STATUS: Record<string, string> = {
  ativo: 'Esperando o tempo', aguardando: 'Esperando resposta', executando: 'Enviando',
  concluido: 'Concluído', parado: 'Parado', erro: 'Erro',
};
export const FLOW_VARS = ['{nome}', '{empresa}', '{telefone}'];
export const FlowIcon = ListChecks;

export const newId = () => Math.random().toString(36).slice(2, 10);

export function newStep(type: StepType): FlowStep {
  const id = newId();
  switch (type) {
    case 'text': return { id, type, text: '' };
    case 'image': case 'video': return { id, type, url: '', caption: '' };
    case 'audio': return { id, type, url: '' };
    case 'document': return { id, type, url: '', fileName: '' };
    case 'delay': return { id, type, amount: 5, unit: 'minutos' };
    case 'wait_reply': return {
      id, type, amount: 1, unit: 'dias',
      branches: [{ id: newId(), label: 'Sim', keywords: 'sim, quero, pode, bora', steps: [] }],
      other: [], timeout: [],
    };
    case 'move_stage': return { id, type, stage: '' };
    case 'notify': return { id, type, phone: '', text: 'Lead respondeu o fluxo e quer falar com alguém' };
    default: return { id, type };
  }
}

const unitLabel = (n: number, u: TimeUnit = 'minutos') => `${n} ${n === 1 ? u.replace(/s$/, '') : u}`;
export const durationLabel = (s: FlowStep) => unitLabel(Number(s.amount) || 0, s.unit);

/** Modelo pronto: primeira resposta da prospecção, com caminhos de sim / não / sem resposta */
export function prospectTemplate(): Pick<WaFlow, 'name' | 'trigger' | 'trigger_config' | 'steps'> {
  return {
    name: 'Resposta da prospecção', trigger: 'first_reply', trigger_config: { once: true },
    steps: [
      { id: newId(), type: 'delay', amount: 20, unit: 'segundos' },
      { id: newId(), type: 'text', text: 'Oi, {nome}! Que bom que respondeu 😊 Vou te mandar um exemplo do que fazemos aqui na INOVA.' },
      { id: newId(), type: 'image', url: '', caption: 'Resultado de um cliente nosso' },
      { id: newId(), type: 'text', text: 'Faz sentido marcarmos 15 minutos para eu te mostrar como ficaria para a {empresa}? Responda *SIM* ou *NÃO*.' },
      {
        id: newId(), type: 'wait_reply', amount: 1, unit: 'dias',
        branches: [
          { id: newId(), label: 'Sim', keywords: 'sim, quero, pode, bora, claro, vamos', steps: [
            { id: newId(), type: 'text', text: 'Perfeito! Já vou avisar o time para combinar o melhor horário com você.' },
            { id: newId(), type: 'move_stage', stage: '' },
            { id: newId(), type: 'notify', phone: '', text: 'Lead quer marcar reunião pelo fluxo da prospecção' },
          ] },
          { id: newId(), label: 'Não', keywords: 'nao, agora nao, sem interesse', steps: [
            { id: newId(), type: 'text', text: 'Sem problemas, {nome}! Se mudar de ideia é só chamar por aqui.' },
            { id: newId(), type: 'end' },
          ] },
        ],
        other: [{ id: newId(), type: 'notify', phone: '', text: 'Lead respondeu algo diferente no fluxo da prospecção' }],
        timeout: [{ id: newId(), type: 'text', text: 'Oi, {nome}! Conseguiu ver minha mensagem? 🙂' }],
      },
    ],
  };
}

/** Conta passos (com os dos caminhos) para o resumo da lista */
export function countSteps(steps: FlowStep[]): number {
  return steps.reduce((n, s) => n + 1 + (s.type === 'wait_reply'
    ? (s.branches ?? []).reduce((m, b) => m + countSteps(b.steps), 0) + countSteps(s.other ?? []) + countSteps(s.timeout ?? [])
    : 0), 0);
}

/** Problemas que impedem o fluxo de funcionar direito (mostrados antes de ligar) */
export function flowIssues(steps: FlowStep[]): string[] {
  const out: string[] = [];
  const walk = (list: FlowStep[]) => list.forEach((s) => {
    const label = STEP_TYPES[s.type].label;
    if (s.type === 'text' && !s.text?.trim()) out.push(`${label} vazia`);
    if (['image', 'video', 'audio', 'document'].includes(s.type) && !s.url) out.push(`${label} sem arquivo`);
    if (s.type === 'move_stage' && !s.stage) out.push('Mover etapa sem etapa escolhida');
    if (s.type === 'notify' && !s.phone?.trim()) out.push('Avisar a equipe sem telefone');
    if (s.type === 'wait_reply') {
      (s.branches ?? []).forEach((b) => { if (!b.keywords.trim()) out.push(`Caminho "${b.label || 'sem nome'}" sem palavras`); walk(b.steps); });
      walk(s.other ?? []); walk(s.timeout ?? []);
    }
  });
  walk(steps);
  return [...new Set(out)];
}
