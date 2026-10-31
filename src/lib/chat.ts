/** Canais e conversas do Chat Interno (página /chat e janelinha flutuante) */
export interface ChatMessage {
  id: string;
  channel: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  content: string;
  created_at: string;
}

export interface ChatEmployee {
  id: string;
  full_name: string;
  username: string | null;
  job_title: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

export const CHAT_CHANNELS = [
  { id: 'geral', name: 'geral' },
  { id: 'producao', name: 'produção' },
  { id: 'comercial', name: 'comercial' },
  { id: 'avisos', name: 'avisos' },
];

/** Conversa privada: o mesmo id para os dois lados */
export const dmChannel = (a: string, b: string) => `dm_${[a, b].sort().join('_')}`;

export const chatInitials = (name: string) =>
  name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';

export const chatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// Última vez que cada conversa foi vista neste navegador (para o contador de não lidas)
const SEEN_KEY = 'chat-seen';
export function readSeen(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}'); } catch { return {}; }
}
export function markSeen(channel: string) {
  const seen = readSeen();
  seen[channel] = new Date().toISOString();
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch { /* sem armazenamento */ }
  window.dispatchEvent(new Event('chat-seen'));
}
