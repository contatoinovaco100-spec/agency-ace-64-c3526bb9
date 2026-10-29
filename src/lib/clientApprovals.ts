import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Aprovações do cliente pelo link /conteudo.
 * A fonte é o histórico de comentários da tarefa (task_comments), que funciona mesmo sem as colunas
 * approved_by_client/publish_job_id no banco: o último evento de cada tarefa diz o estado atual.
 */
export const CLIENT_REVIEW_AUTHOR = 'Cliente (link de aprovação)';
export const PLANNER_AUTHOR = 'Planner';
const APPROVED_PREFIX = '✅ Aprovado pelo cliente';
const CHANGE_PREFIX = '✏️ Ajuste pedido pelo cliente';
const SCHEDULED_PREFIX = '📅 Publicação agendada';

export type ClientReview = {
  approved: boolean;
  at: string | null;
  changeRequested: boolean;
  /** Já agendado pelo Planner depois da aprovação */
  scheduled: boolean;
};

type CommentRow = { task_id: string; author: string; content: string; created_at: string };

function reduce(rows: CommentRow[]): Record<string, ClientReview> {
  const out: Record<string, ClientReview> = {};
  // Do mais antigo para o mais novo: cada evento sobrescreve o anterior
  [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach((r) => {
    const cur = out[r.task_id] ?? { approved: false, at: null, changeRequested: false, scheduled: false };
    if (r.content.startsWith(APPROVED_PREFIX)) out[r.task_id] = { approved: true, at: r.created_at, changeRequested: false, scheduled: false };
    else if (r.content.startsWith(CHANGE_PREFIX)) out[r.task_id] = { approved: false, at: null, changeRequested: true, scheduled: false };
    else if (r.content.startsWith(SCHEDULED_PREFIX)) out[r.task_id] = { ...cur, scheduled: true };
  });
  return out;
}

/** Estado de aprovação das tarefas (de todas, quando `taskIds` não é passado) */
export async function fetchClientReviews(taskIds?: string[]): Promise<Record<string, ClientReview>> {
  const rows: CommentRow[] = [];
  const base = () => supabase.from('task_comments').select('task_id, author, content, created_at')
    .in('author', [CLIENT_REVIEW_AUTHOR, PLANNER_AUTHOR]);
  if (taskIds) {
    for (let i = 0; i < taskIds.length; i += 200) {
      const { data } = await base().in('task_id', taskIds.slice(i, i + 200));
      rows.push(...((data ?? []) as CommentRow[]));
    }
  } else {
    const { data } = await base().order('created_at', { ascending: false }).limit(2000);
    rows.push(...((data ?? []) as CommentRow[]));
  }
  return reduce(rows);
}

/** Registra no histórico da tarefa que a publicação foi agendada (tira o post da fila de aprovados) */
export async function recordScheduled(taskId: string, when: string) {
  await supabase.from('task_comments').insert({
    task_id: taskId, author: PLANNER_AUTHOR, content: `${SCHEDULED_PREFIX} para ${when}`,
  });
}

// Cache compartilhado para os cards do kanban (uma consulta para todos)
let cache: Promise<Record<string, ClientReview>> | null = null;
let cacheAt = 0;
const listeners = new Set<(r: Record<string, ClientReview>) => void>();

export function refreshClientReviews() {
  cache = fetchClientReviews();
  cacheAt = Date.now();
  cache.then((r) => listeners.forEach((l) => l(r)));
  return cache;
}

/** Aprovações de todas as tarefas, compartilhadas entre os componentes e atualizadas a cada 2 min */
export function useClientReviews() {
  const [reviews, setReviews] = useState<Record<string, ClientReview>>({});
  useEffect(() => {
    listeners.add(setReviews);
    if (!cache || Date.now() - cacheAt > 2 * 60 * 1000) refreshClientReviews();
    else cache.then(setReviews);
    return () => { listeners.delete(setReviews); };
  }, []);
  return reviews;
}
