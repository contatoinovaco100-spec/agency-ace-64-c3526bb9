import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Client, Task } from '@/types/agency';

/**
 * Saúde do cliente: sinal verde / amarelo / vermelho com os motivos, para ver de relance quem está em risco.
 * Usa só dados que a plataforma já tem: posts no kanban, faturas, nota do cliente e onboarding.
 */
export type HealthLevel = 'ok' | 'atencao' | 'risco';
export type ClientHealth = { level: HealthLevel; reasons: { level: Exclude<HealthLevel, 'ok'>; text: string }[] };

const DONE = /postado|publicado|conclu|programado/i;
const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);

type Invoice = { client_name: string; due_date: string | null; status: string };
type Score = { client_id: string; score: number; score_date: string };
type Onboarding = { client_id: string; status: string; updated_at: string };

export function useClientHealth(clients: Client[], tasks: Task[], includeFinance: boolean) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [onboardings, setOnboardings] = useState<Onboarding[]>([]);

  useEffect(() => {
    const since = isoDay(new Date(Date.now() - 45 * 86_400_000));
    if (includeFinance) {
      supabase.from('invoices').select('client_name, due_date, status').eq('status', 'pendente')
        .then(({ data }) => setInvoices((data ?? []) as Invoice[]));
    }
    supabase.from('client_daily_scores').select('client_id, score, score_date').gte('score_date', since)
      .order('score_date', { ascending: false })
      .then(({ data }) => setScores((data ?? []) as Score[]));
    supabase.from('client_onboardings' as never).select('client_id, status, updated_at')
      .then(({ data }) => setOnboardings((data ?? []) as unknown as Onboarding[]));
  }, [includeFinance]);

  return useMemo(() => {
    const today = isoDay(new Date());
    const in7 = isoDay(new Date(Date.now() + 7 * 86_400_000));
    const since45 = isoDay(new Date(Date.now() - 45 * 86_400_000));
    const since30 = isoDay(new Date(Date.now() - 30 * 86_400_000));
    const out: Record<string, ClientHealth> = {};

    for (const c of clients) {
      if (c.status !== 'Ativo') continue;
      const reasons: ClientHealth['reasons'] = [];
      const mine = tasks.filter((t) => t.clientId === c.id && !t.deletedAt);

      // Posts com data de publicação que já passou e ainda não foram ao ar
      // Mais antigos que 30 dias são cards nunca remarcados, não sinal de risco
      const late = mine.filter((t) => t.postDate && t.postDate < today && t.postDate >= since30 && !DONE.test(t.status)).length;
      if (late >= 3) reasons.push({ level: 'risco', text: `${late} posts atrasados` });
      else if (late > 0) reasons.push({ level: 'atencao', text: `${late} ${late === 1 ? 'post atrasado' : 'posts atrasados'}` });

      // Só para quem tem calendário ativo (posts nos últimos 45 dias): clientes sem social media não entram
      const active = mine.some((t) => t.postDate && t.postDate >= since45 && t.postDate < today);
      if (active && !mine.some((t) => t.postDate && t.postDate >= today && t.postDate <= in7)) {
        reasons.push({ level: 'atencao', text: 'Nenhum post nos próximos 7 dias' });
      }

      if (includeFinance) {
        const overdue = invoices.filter((i) => i.due_date && i.due_date < today && norm(i.client_name) === norm(c.companyName));
        if (overdue.length) {
          const worst = Math.max(...overdue.map((i) => daysBetween(i.due_date!, today)));
          reasons.push({ level: worst > 10 ? 'risco' : 'atencao', text: `Fatura vencida há ${worst} ${worst === 1 ? 'dia' : 'dias'}` });
        }
      }

      const lastScore = scores.find((s) => s.client_id === c.id);
      if (lastScore && lastScore.score <= 6) reasons.push({ level: 'risco', text: `Nota do cliente ${lastScore.score}/10` });
      else if (lastScore && lastScore.score <= 8) reasons.push({ level: 'atencao', text: `Nota do cliente ${lastScore.score}/10` });

      const onb = onboardings.find((o) => o.client_id === c.id);
      if (onb && onb.status !== 'concluido' && daysBetween(onb.updated_at, new Date().toISOString()) >= 3) {
        reasons.push({ level: 'atencao', text: 'Onboarding travado' });
      }

      reasons.sort((a, b) => (a.level === b.level ? 0 : a.level === 'risco' ? -1 : 1));
      out[c.id] = {
        level: reasons.some((r) => r.level === 'risco') ? 'risco' : reasons.length ? 'atencao' : 'ok',
        reasons,
      };
    }
    return out;
  }, [clients, tasks, invoices, scores, onboardings, includeFinance]);
}
