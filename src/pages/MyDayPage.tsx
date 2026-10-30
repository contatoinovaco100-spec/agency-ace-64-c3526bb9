import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BadgeCheck, CalendarClock, Camera, ChevronRight, Clock, MessageCircle, MessageSquareWarning, PenLine, Sun } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAgency } from '@/contexts/AgencyContext';
import { usePageAccess } from '@/hooks/useUserRole';
import { useClientReviews } from '@/lib/clientApprovals';
import { PageHeader } from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/agency';

/**
 * Meu dia: o que cada pessoa precisa fazer hoje, sem caçar em várias páginas.
 * Tarefas são "minhas" quando o nome do perfil aparece em algum papel da tarefa (como em Minhas Tarefas).
 * Quem tem acesso ao Planner (social media) vê também as pendências de postagem de todos os clientes.
 */
const ROLE_KEYS = ['assignee', 'copywriter', 'editor', 'director', 'videomaker', 'scriptWriter'] as const;
const DONE = /postado|publicado|conclu|programado/i;

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (n: number) => isoDay(new Date(Date.now() + n * 86_400_000));
const shortDate = (d: string) => new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');
const hasCaption = (t: Task) => /[\p{L}\p{N}]{2,}/u.test(t.caption ?? '');
const taskLink = (t: Task) => `${t.taskType === 'Arte' ? '/artes' : '/tarefas'}?taskId=${t.id}`;
const taskName = (t: Task) => (t.videoName || t.title || 'Sem título').replace(/^(vídeo|video|arte)\s*\d*\s*\|\s*/i, '');
const dateOf = (t: Task) => t.postDate || t.dueDate || '';

type ReminderRow = { client_id: string; status: 'enviado' | 'sem_telefone' | 'erro'; created_at: string };

type Shooting = { id: string; title: string; shooting_date: string; start_time: string | null; location: string; client_id: string | null };

export default function MyDayPage() {
  const { user } = useAuth();
  const { tasks, clients } = useAgency();
  const { hasPageAccess, isAdmin } = usePageAccess();
  const reviews = useClientReviews();
  const [name, setName] = useState('');
  const [shootings, setShootings] = useState<Shooting[]>([]);
  const [brokenAccounts, setBrokenAccounts] = useState<string[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const social = isAdmin || hasPageAccess('/planner');

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      .then(({ data }) => setName((data?.full_name ?? '').trim()));
    supabase.from('shooting_schedules').select('id, title, shooting_date, start_time, location, client_id')
      .gte('shooting_date', addDays(0)).lte('shooting_date', addDays(7)).order('shooting_date')
      .then(({ data }) => setShootings((data ?? []) as Shooting[]));
  }, [user]);

  useEffect(() => {
    if (!social) return;
    // Lembretes de aprovação dos últimos 3 dias (tabela pode ainda não existir no banco)
    supabase.from('approval_reminders' as never).select('client_id, status, created_at')
      .gte('created_at', new Date(Date.now() - 3 * 86_400_000).toISOString()).order('created_at', { ascending: false })
      .then(({ data, error }) => { if (!error) setReminders((data ?? []) as unknown as ReminderRow[]); });
    supabase.from('social_accounts').select('username, token_status').eq('platform', 'instagram')
      .then(({ data }) => setBrokenAccounts(((data ?? []) as { username: string; token_status: string | null }[])
        .filter((a) => a.token_status && a.token_status !== 'ok').map((a) => a.username)));
  }, [social]);

  const clientName = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c.companyName])), [clients]);
  const today = addDays(0);

  const data = useMemo(() => {
    const me = name.toLowerCase();
    const open = tasks.filter((t) => !t.deletedAt && !DONE.test(t.status));
    const mine = me ? open.filter((t) => ROLE_KEYS.some((k) => ((t[k] as string) || '').trim().toLowerCase() === me)) : [];
    const sortByDate = (a: Task, b: Task) => dateOf(a).localeCompare(dateOf(b));
    return {
      changes: (social ? open : mine).filter((t) => reviews[t.id]?.changeRequested),
      approved: social ? open.filter((t) => reviews[t.id]?.approved && !reviews[t.id]?.scheduled) : [],
      todayList: mine.filter((t) => dateOf(t) === today).sort(sortByDate),
      late: mine.filter((t) => dateOf(t) && dateOf(t) < today && dateOf(t) >= addDays(-30)).sort(sortByDate),
      next: mine.filter((t) => dateOf(t) > today && dateOf(t) <= addDays(7)).sort(sortByDate),
      noCaption: social ? open.filter((t) => t.postDate && t.postDate >= today && t.postDate <= addDays(3) && !hasCaption(t)).sort(sortByDate) : [],
    };
  }, [tasks, name, reviews, social, today]);

  const firstName = name.split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const nothing = !data.changes.length && !data.approved.length && !data.todayList.length && !data.late.length
    && !data.noCaption.length && !brokenAccounts.length;

  const row = (t: Task, meta?: string) => (
    <li key={t.id}>
      <Link to={taskLink(t)} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{taskName(t)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {(t.clientId && clientName[t.clientId]) || 'Sem cliente'} · {t.status}{meta ? ` · ${meta}` : ''}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={firstName ? `${greeting}, ${firstName}` : greeting}
        description="O que precisa da sua atenção hoje, em um só lugar."
      />

      {/* Placar do dia: o número grande é o que pede ação agora */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Para hoje" value={data.todayList.length} icon={Sun} />
        <Stat label="Atrasadas" value={data.late.length} icon={Clock} tone={data.late.length ? 'warning' : undefined} />
        <Stat label="Ajustes do cliente" value={data.changes.length} icon={MessageSquareWarning} tone={data.changes.length ? 'warning' : undefined} />
        {social
          ? <Stat label="Aprovados para agendar" value={data.approved.length} icon={BadgeCheck} tone={data.approved.length ? 'success' : undefined} to="/planner?cliente=todos" />
          : <Stat label="Próximos 7 dias" value={data.next.length} icon={CalendarClock} />}
      </div>

      {!name && (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Seu perfil está sem nome completo, então não dá para saber quais tarefas são suas. Peça para um admin preencher em Equipe → Funcionários.
        </p>
      )}

      {nothing && name && (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-display text-lg font-semibold">Dia tranquilo ☀️</p>
          <p className="mt-1 text-sm text-muted-foreground">Nada pendente para hoje. Veja o que vem nos próximos dias abaixo.</p>
        </div>
      )}

      {data.changes.length > 0 && (
        <Block title="O cliente pediu ajuste" hint="Abra a tarefa para ver o comentário do cliente" tone="warning" icon={MessageSquareWarning}>
          {data.changes.map((t) => row(t))}
        </Block>
      )}

      {data.todayList.length > 0 && (
        <Block title="Para hoje" icon={Sun}>{data.todayList.map((t) => row(t, t.postTime ? `posta às ${t.postTime.slice(0, 5)}` : undefined))}</Block>
      )}

      {data.late.length > 0 && (
        <Block title="Atrasadas" hint="Data já passou e ainda não foi concluída" tone="warning" icon={Clock}>
          {data.late.map((t) => row(t, shortDate(dateOf(t))))}
        </Block>
      )}

      {social && (data.approved.length > 0 || data.noCaption.length > 0 || brokenAccounts.length > 0 || reminders.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.approved.length > 0 && (
            <Block title="Aprovados pelo cliente, falta agendar" tone="success" icon={BadgeCheck} action={{ label: 'Abrir fila', to: '/planner?cliente=todos' }}>
              {data.approved.slice(0, 6).map((t) => row(t, t.postDate ? shortDate(t.postDate) : 'sem data'))}
            </Block>
          )}
          {data.noCaption.length > 0 && (
            <Block title="Posts dos próximos 3 dias sem legenda" tone="warning" icon={PenLine}>
              {data.noCaption.slice(0, 8).map((t) => row(t, shortDate(t.postDate!)))}
            </Block>
          )}
          {reminders.length > 0 && (() => {
            const sent = reminders.filter((r) => r.status === 'enviado');
            const noPhone = [...new Set(reminders.filter((r) => r.status === 'sem_telefone').map((r) => r.client_id))];
            const failed = reminders.filter((r) => r.status === 'erro').length;
            return (
              <Block title="Lembretes de aprovação pelo WhatsApp" hint="Enviados nos últimos 3 dias para quem tem conteúdo esperando há 2 dias ou mais"
                tone={noPhone.length || failed ? 'warning' : 'success'} icon={MessageCircle} action={noPhone.length ? { label: 'Completar telefones', to: '/clientes' } : undefined}>
                <li className="px-4 py-3 text-sm">
                  {sent.length} {sent.length === 1 ? 'cliente lembrado' : 'clientes lembrados'}
                  {sent.length > 0 && `: ${[...new Set(sent.map((r) => clientName[r.client_id]).filter(Boolean))].join(', ')}`}
                </li>
                {noPhone.length > 0 && (
                  <li className="px-4 py-3 text-sm text-warning">
                    Sem telefone no cadastro: {noPhone.map((id) => clientName[id] || 'cliente').join(', ')}
                  </li>
                )}
                {failed > 0 && <li className="px-4 py-3 text-sm text-destructive">{failed} envio(s) falharam no WhatsApp</li>}
              </Block>
            );
          })()}
          {brokenAccounts.length > 0 && (
            <Block title="Instagram com acesso vencido" hint="Reconecte em Redes Sociais para não falhar o agendamento" tone="danger" icon={AlertTriangle} action={{ label: 'Redes Sociais', to: '/redes-sociais' }}>
              <li className="px-4 py-3 text-sm">{brokenAccounts.map((u) => '@' + u).join(', ')}</li>
            </Block>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {shootings.length > 0 && (
          <Block title="Gravações nos próximos 7 dias" icon={Camera} action={{ label: 'Agenda', to: '/gravacoes' }}>
            {shootings.slice(0, 6).map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {shortDate(s.shooting_date)}{s.start_time ? ` · ${s.start_time.slice(0, 5)}` : ''}
                    {s.client_id && clientName[s.client_id] ? ` · ${clientName[s.client_id]}` : ''}{s.location ? ` · ${s.location}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </Block>
        )}
        {data.next.length > 0 && (
          <Block title="Próximos 7 dias" icon={CalendarClock}>{data.next.slice(0, 8).map((t) => row(t, shortDate(dateOf(t))))}</Block>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone, to }: { label: string; value: number; icon: typeof Sun; tone?: 'warning' | 'success'; to?: string }) {
  const body = (
    <div className="rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className={cn('mt-1 font-display text-2xl font-semibold tabular-nums',
        tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-success' : 'text-foreground')}>{value}</p>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function Block({ title, hint, icon: Icon, tone, action, children }: {
  title: string; hint?: string; icon: typeof Sun; tone?: 'warning' | 'success' | 'danger';
  action?: { label: string; to: string }; children: React.ReactNode;
}) {
  return (
    <section className={cn('overflow-hidden rounded-xl border bg-card',
      tone === 'warning' && 'border-l-[3px] border-l-warning', tone === 'success' && 'border-l-[3px] border-l-success', tone === 'danger' && 'border-l-[3px] border-l-destructive')}>
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-muted-foreground" /> {title}</h2>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {action && <Link to={action.to} className="shrink-0 text-xs font-medium text-primary hover:underline">{action.label}</Link>}
      </div>
      <ul className="divide-y">{children}</ul>
    </section>
  );
}
