import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Avisos do kanban (Administração → Avisos do kanban): banner no topo do kanban de todo mundo. */
export type NoticeTone = 'destaque' | 'aviso' | 'urgente';
export type KanbanNotice = {
  id: string; title: string; message: string; tone: NoticeTone; link: string;
  /** Foto opcional (URL pública no bucket task-attachments) */
  image_url?: string;
  starts_on: string | null; ends_on: string | null; enabled: boolean; created_by: string; updated_at: string;
};

export const TONES: { value: NoticeTone; label: string; hint: string }[] = [
  { value: 'destaque', label: 'Destaque', hint: 'Azul, para novidades e combinados' },
  { value: 'aviso', label: 'Atenção', hint: 'Laranja, para prazos e mudanças' },
  { value: 'urgente', label: 'Urgente', hint: 'Vermelho, para o que não pode esperar' },
];

// Tabela nova, ainda fora dos tipos gerados do Supabase
export const noticesTable = () => (supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>)('kanban_notices');

const pad = (n: number) => String(n).padStart(2, '0');
export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

/** No ar hoje: ligado e dentro do período (datas vazias = sem limite) */
export const isLive = (n: KanbanNotice, today = todayIso()) =>
  n.enabled && (!n.starts_on || n.starts_on <= today) && (!n.ends_on || n.ends_on >= today);

/** Avisos no ar, atualizados em tempo real */
export function useLiveNotices() {
  const [list, setList] = useState<KanbanNotice[]>([]);
  useEffect(() => {
    const load = () => noticesTable().select('*').eq('enabled', true).order('created_at', { ascending: false })
      .then(({ data, error }) => { if (!error) setList(((data ?? []) as unknown as KanbanNotice[]).filter((n) => isLive(n))); });
    load();
    const ch = supabase.channel(`kanban-notices-${Math.random().toString(36).slice(2)}`).on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_notices' }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  return list;
}
