import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BarChart3, CalendarDays, CheckCircle2, ChevronRight, FileSignature, Loader2, Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchClientReviews, type ClientReview } from '@/lib/clientApprovals';
import { useSeo } from '@/lib/seo';
import logoInova from '@/assets/logo-inova.png';
import { cn } from '@/lib/utils';

/**
 * Portal do cliente (/portal/:clientId): o único link que o cliente precisa guardar.
 * Reúne aprovações pendentes, relatório do mês, calendário dos próximos dias, faturas e contrato.
 */
type Task = { id: string; title: string; video_name: string; task_type: string | null; status: string; post_date: string | null; post_time?: string | null; client_id: string };
type Contract = { id: string; title: string; plan_name: string; status: string; created_at: string; duration_months: number };
type Invoice = { id: string; description: string; amount: number; due_date: string | null; status: string; paid_at: string | null };

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const titleOf = (t: Task) => ((t.task_type === 'Arte' ? t.title : t.video_name || t.title) || 'Sem título').replace(/^(vídeo|video|arte)\s*\d*\s*\|\s*/i, '');
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const AWAITING = /revis|finalizado/i;

export default function ClientPortalPage() {
  useSeo({ title: 'Portal do cliente — INOVA Co.', description: 'Aprovações, relatório, calendário e faturas da sua marca.', noindex: true });
  const { clientId = '' } = useParams();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [name, setName] = useState('');
  const [reviews, setReviews] = useState<Record<string, ClientReview>>({});
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [resolvedId, setResolvedId] = useState(clientId);
  const [contracts, setContracts] = useState<Contract[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).rpc('get_public_client_tasks', { _anchor: clientId });
      const list = (data ?? []) as Task[];
      setTasks(list);
      // O link pode vir com o id de uma tarefa: o cliente de verdade vem das tarefas
      const cid = list[0]?.client_id ?? clientId;
      setResolvedId(cid);
      const [{ data: n }, inv, ct] = await Promise.all([
        (supabase as any).rpc('get_public_client_name', { _id: cid }),
        // Faturas e contratos: se a função ainda não existir no banco, o bloco não aparece
        (supabase as any).rpc('get_public_client_invoices', { _client_id: cid }),
        (supabase as any).rpc('get_public_client_contracts', { _client_id: cid }),
      ]);
      if (n) setName(n as string);
      setInvoices(inv.error ? null : inv.data ?? []);
      setContracts(ct.error ? [] : ct.data ?? []);
      setReviews(await fetchClientReviews(list.map((t) => t.id)));
    })();
  }, [clientId]);

  const view = useMemo(() => {
    if (!tasks) return null;
    const today = isoDay(new Date());
    const in14 = isoDay(new Date(Date.now() + 14 * 86_400_000));
    return {
      toApprove: tasks.filter((t) => AWAITING.test(t.status) && !reviews[t.id]?.approved && !reviews[t.id]?.changeRequested).length,
      upcoming: tasks.filter((t) => t.post_date && t.post_date >= today && t.post_date <= in14 && !/^ideia|backlog/i.test(t.status))
        .sort((a, b) => (a.post_date! + (a.post_time ?? '')).localeCompare(b.post_date! + (b.post_time ?? ''))),
    };
  }, [tasks, reviews]);

  if (!tasks) return <div className="flex min-h-[100dvh] items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!tasks.length) return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <img src={logoInova} alt="INOVA Co." className="h-10 brightness-0 dark:brightness-100" />
      <p className="font-display text-xl font-semibold">Portal não encontrado</p>
      <p className="text-sm text-muted-foreground">Confira o link ou fale com a equipe da INOVA.</p>
    </div>
  );

  const v = view!;
  const openInvoices = (invoices ?? []).filter((i) => i.status !== 'pago');
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="border-b">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <img src={logoInova} alt="INOVA Co." className="h-8 brightness-0 dark:brightness-100" />
        </div>
      </div>
      <main className="mx-auto max-w-2xl space-y-6 px-4 pb-16 pt-8">
        <header className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Portal do cliente</p>
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">{name || 'Sua marca'}</h1>
          <p className="text-sm text-muted-foreground">Tudo da sua marca com a INOVA em um só lugar. Salve este link.</p>
        </header>

        {/* Ação principal: o que depende do cliente agora */}
        <Link to={`/conteudo/${resolvedId}`}
          className={cn('flex items-center gap-4 rounded-xl border p-5 transition-colors',
            v.toApprove ? 'border-brand bg-brand/15 hover:bg-brand/20' : 'bg-card hover:bg-foreground/[0.03]')}>
          <CheckCircle2 className={cn('h-6 w-6 shrink-0', v.toApprove ? 'text-primary' : 'text-muted-foreground')} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{v.toApprove ? `${v.toApprove} ${v.toApprove === 1 ? 'conteúdo esperando' : 'conteúdos esperando'} sua aprovação` : 'Nada para aprovar agora'}</p>
            <p className="text-sm text-muted-foreground">Veja os vídeos e artes, aprove ou peça ajuste.</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Link>

        <Link to={`/relatorio/${resolvedId}`} className="flex items-center gap-4 rounded-xl border bg-card p-5 transition-colors hover:bg-foreground/[0.03]">
          <BarChart3 className="h-6 w-6 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Relatório do mês</p>
            <p className="text-sm text-muted-foreground">O que foi ao ar e o que vem por aí.</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Link>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" /> Próximos 14 dias
          </h2>
          {v.upcoming.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma publicação marcada para os próximos dias.</p>
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {v.upcoming.slice(0, 10).map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-20 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                    {new Date(t.post_date!.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{titleOf(t)}</span>
                  {t.post_time && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{t.post_time.slice(0, 5)}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {invoices && invoices.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <Receipt className="h-3.5 w-3.5" /> Faturas {openInvoices.length > 0 && <span className="text-warning">· {openInvoices.length} em aberto</span>}
            </h2>
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {invoices.slice(0, 6).map((i) => {
                const late = i.status !== 'pago' && i.due_date && i.due_date < isoDay(new Date());
                return (
                  <li key={i.id}>
                    <Link to={`/fatura/${i.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03]">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{i.description || 'Fatura'}</p>
                        <p className={cn('text-xs', late ? 'text-destructive' : 'text-muted-foreground')}>
                          {i.status === 'pago' ? 'Paga' : late ? 'Vencida' : 'Em aberto'}
                          {i.due_date && ` · vence ${new Date(i.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{brl(Number(i.amount))}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {contracts.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <FileSignature className="h-3.5 w-3.5" /> Contrato
              {contracts.some((c) => c.status !== 'assinado') && <span className="text-warning">· aguardando sua assinatura</span>}
            </h2>
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {contracts.map((c) => (
                <li key={c.id}>
                  <Link to={`/contrato/${c.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.plan_name || c.title || 'Contrato de serviços'}</p>
                      <p className={cn('text-xs', c.status === 'assinado' ? 'text-muted-foreground' : 'text-warning')}>
                        {c.status === 'assinado' ? 'Assinado' : 'Assinar agora'}
                        {c.duration_months > 0 && ` · ${c.duration_months} ${c.duration_months === 1 ? 'mês' : 'meses'}`}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="pt-4 text-center text-xs text-muted-foreground">Dúvidas? Fale com a equipe da INOVA pelo WhatsApp.</p>
      </main>
    </div>
  );
}
