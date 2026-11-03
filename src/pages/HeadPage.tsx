import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, ClipboardCheck, Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAgency } from '@/contexts/AgencyContext';
import { useClientReviews } from '@/lib/clientApprovals';
import { useClientAbc, ABC_STYLES } from '@/lib/clientAbc';
import { defaultTrackedPeople, findPostIssues } from '@/lib/postIssues';
import { PostIssuesPanel } from '@/components/myday/PostIssuesPanel';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Period = 'diario' | 'semanal' | 'mensal';
type Item = { id: string; period: Period; title: string; hint: string; link: string; sort: number };
type CheckRow = { id: string; item_id: string; period_key: string; checked_by: string; checked_at: string };

const PERIODS: { key: Period; label: string; scope: string }[] = [
  { key: 'diario', label: 'Hoje', scope: 'todo dia' },
  { key: 'semanal', label: 'Semana', scope: 'toda semana' },
  { key: 'mensal', label: 'Mês', scope: 'todo mês' },
];
/** Mesma chave do Meu dia: quem aparece nos Erros nos posts */
const TRACKED_KEY = 'myday:tracked-people';
const DONE = /postado|publicado|conclu|programado/i;
const IN_APPROVAL = /revis|finaliz|aprova/i;

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Chave do período atual: dia, segunda-feira da semana ou mês */
function periodKey(p: Period, now = new Date()) {
  if (p === 'diario') return iso(now);
  if (p === 'semanal') return 'S' + iso(addDays(now, -((now.getDay() + 6) % 7)));
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

// Tabelas novas, ainda fora dos tipos gerados do Supabase
const table = (t: string) => (supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>)(t);

/** Painel do Head de marketing: a rotina (diária, semanal, mensal) e a saúde da operação por social media e por cliente */
export default function HeadPage() {
  const { user } = useAuth();
  const { tasks, clients, team } = useAgency();
  const reviews = useClientReviews();
  const abc = useClientAbc();
  const [items, setItems] = useState<Item[]>([]);
  const [checks, setChecks] = useState<CheckRow[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [tab, setTab] = useState<Period>('diario');
  const [editing, setEditing] = useState(false);
  const [me, setMe] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [picked, setPicked] = useState<string[] | null>(() => {
    try { const v = localStorage.getItem(TRACKED_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
  });

  const keys = useMemo(() => ({ diario: periodKey('diario'), semanal: periodKey('semanal'), mensal: periodKey('mensal') }), []);

  const load = async () => {
    const { data, error } = await table('head_routine_items').select('*').order('sort');
    if (error) { setState('missing'); return; }
    setItems((data ?? []) as unknown as Item[]);
    const { data: c } = await table('head_routine_checks').select('*').in('period_key', Object.values(keys));
    setChecks((c ?? []) as unknown as CheckRow[]);
    setState('ready');
  };
  useEffect(() => {
    load();
    if (user) supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle().then(({ data }) => setMe((data?.full_name ?? '').trim()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const checkOf = (it: Item) => checks.find((c) => c.item_id === it.id && c.period_key === keys[it.period]);
  const progress = (p: Period) => {
    const list = items.filter((i) => i.period === p);
    return { done: list.filter((i) => checkOf(i)).length, total: list.length };
  };

  const toggle = async (it: Item) => {
    setBusy(it.id);
    const c = checkOf(it);
    if (c) {
      const { error } = await table('head_routine_checks').delete().eq('id', c.id);
      if (!error) setChecks((prev) => prev.filter((x) => x.id !== c.id));
    } else {
      const { data, error } = await table('head_routine_checks').insert({ item_id: it.id, period_key: keys[it.period], checked_by: me } as never).select('*').single();
      if (error) toast.error('Não foi possível marcar', { description: error.message });
      else setChecks((prev) => [...prev, data as unknown as CheckRow]);
    }
    setBusy(null);
  };

  const saveItem = async (it: Item, patch: Partial<Item>) => {
    const { error } = await table('head_routine_items').update(patch as never).eq('id', it.id);
    if (error) { toast.error('Não foi possível salvar'); return; }
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, ...patch } : x)));
  };
  const addItem = async () => {
    const title = newTitle.trim();
    if (!title) return;
    const sort = Math.max(0, ...items.filter((i) => i.period === tab).map((i) => i.sort)) + 1;
    const { data, error } = await table('head_routine_items').insert({ period: tab, title, sort } as never).select('*').single();
    if (error) { toast.error('Não foi possível adicionar'); return; }
    setItems((prev) => [...prev, data as unknown as Item]); setNewTitle('');
  };
  const removeItem = async (it: Item) => {
    const { error } = await table('head_routine_items').delete().eq('id', it.id);
    if (error) { toast.error('Não foi possível excluir'); return; }
    setItems((prev) => prev.filter((x) => x.id !== it.id));
  };

  // ── Operação ──
  const people = picked ?? defaultTrackedPeople(team);
  const choosePeople = (names: string[]) => {
    setPicked(names);
    try { localStorage.setItem(TRACKED_KEY, JSON.stringify(names)); } catch { /* armazenamento indisponível */ }
  };
  const posts = useMemo(() => findPostIssues(tasks, clients, reviews, people), [tasks, clients, reviews, people]);
  const clientName = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c.companyName])), [clients]);

  const rows = useMemo(() => {
    const now = new Date(); const today = iso(now);
    const next7 = iso(addDays(now, 7));
    const monday = addDays(now, 7 - ((now.getDay() + 6) % 7));
    const nwFrom = iso(monday), nwTo = iso(addDays(monday, 6));
    const open = tasks.filter((t) => !t.deletedAt);
    return clients.filter((c) => !c.deletedAt && c.status === 'Ativo').map((c) => {
      const mine = open.filter((t) => t.clientId === c.id);
      const live = mine.filter((t) => !DONE.test(t.status));
      return {
        c,
        week: mine.filter((t) => t.postDate && t.postDate >= today && t.postDate <= next7).length,
        nextWeek: mine.filter((t) => t.postDate && t.postDate >= nwFrom && t.postDate <= nwTo).length,
        approval: live.filter((t) => IN_APPROVAL.test(t.status) && !reviews[t.id]?.approved && !reviews[t.id]?.changeRequested).length,
        changes: live.filter((t) => reviews[t.id]?.changeRequested).length,
      };
    }).sort((a, b) => (a.nextWeek === 0 ? 0 : 1) - (b.nextWeek === 0 ? 0 : 1) || b.changes - a.changes
      || (abc[a.c.id]?.letter ?? 'C').localeCompare(abc[b.c.id]?.letter ?? 'C') || a.c.companyName.localeCompare(b.c.companyName));
  }, [clients, tasks, reviews, abc]);

  const noPlan = rows.filter((r) => r.nextWeek === 0).length;
  const changes = rows.reduce((s, r) => s + r.changes, 0);
  const today = progress('diario');
  const list = items.filter((i) => i.period === tab).sort((a, b) => a.sort - b.sort);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Head de marketing" title="Painel do Head"
        description="A rotina do head e a saúde da operação: erros por social media e como está cada cliente." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Rotina de hoje" value={state === 'ready' ? `${today.done}/${today.total}` : '–'} tone={today.total && today.done === today.total ? 'success' : undefined} />
        <Stat label="Posts com erro" value={String(posts.length)} tone={posts.length ? 'warning' : 'success'} />
        <Stat label="Sem post na próxima semana" value={String(noPlan)} tone={noPlan ? 'warning' : 'success'} />
        <Stat label="Ajustes do cliente" value={String(changes)} tone={changes ? 'warning' : undefined} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <h2 className="flex flex-1 items-center gap-2 text-sm font-semibold"><ClipboardCheck className="h-4 w-4 text-muted-foreground" /> Rotina do head</h2>
            {state === 'ready' && (
              <Button size="sm" variant={editing ? 'default' : 'outline'} onClick={() => setEditing(!editing)}>
                {editing ? <><Check className="mr-1.5 h-3.5 w-3.5" />Pronto</> : <><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar rotina</>}
              </Button>
            )}
          </div>
          {state === 'loading' && <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
          {state === 'missing' && <p className="p-4 text-sm text-foreground">Falta aplicar a migração <code className="text-xs">20261103140000_head_routine</code> no Lovable.</p>}
          {state === 'ready' && (
            <>
              <div className="flex gap-1 border-b p-2">
                {PERIODS.map((p) => {
                  const pr = progress(p.key);
                  return (
                    <button key={p.key} type="button" onClick={() => setTab(p.key)}
                      className={cn('flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                        tab === p.key ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                      {p.label} <span className="tabular-nums text-xs text-muted-foreground">{pr.done}/{pr.total}</span>
                    </button>
                  );
                })}
              </div>
              {(() => {
                const pr = progress(tab);
                return (
                  <div className="px-4 pt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pr.total ? (pr.done / pr.total) * 100 : 0}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Repete {PERIODS.find((p) => p.key === tab)!.scope}. Os checks zeram no próximo período.</p>
                  </div>
                );
              })()}
              <ul className="divide-y">
                {list.map((it) => {
                  const c = checkOf(it);
                  return editing ? (
                    <li key={it.id} className="space-y-1.5 px-4 py-3">
                      <div className="flex gap-2">
                        <Input defaultValue={it.title} aria-label="Tarefa" onBlur={(e) => e.target.value.trim() && e.target.value !== it.title && saveItem(it, { title: e.target.value.trim() })} />
                        <Button size="icon" variant="ghost" className="shrink-0 text-destructive hover:text-destructive" aria-label="Excluir" onClick={() => removeItem(it)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                      <div className="flex gap-2">
                        <Input defaultValue={it.hint} placeholder="Dica (opcional)" aria-label="Dica" className="h-8 text-xs" onBlur={(e) => e.target.value !== it.hint && saveItem(it, { hint: e.target.value })} />
                        <Input defaultValue={it.link} placeholder="Atalho, ex.: /planner" aria-label="Atalho" className="h-8 w-36 text-xs" onBlur={(e) => e.target.value !== it.link && saveItem(it, { link: e.target.value.trim() })} />
                      </div>
                    </li>
                  ) : (
                    <li key={it.id} className="flex items-start gap-3 px-4 py-3">
                      <button type="button" onClick={() => toggle(it)} disabled={busy === it.id} aria-pressed={!!c} aria-label={c ? 'Desmarcar' : 'Marcar como feito'}
                        className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                          c ? 'border-success bg-success text-success-foreground' : 'hover:border-foreground/40')}>
                        {busy === it.id ? <Loader2 className="h-3 w-3 animate-spin" /> : c && <Check className="h-3.5 w-3.5" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm', c ? 'text-muted-foreground line-through' : 'font-medium text-foreground')}>{it.title}</p>
                        {c ? (
                          <p className="text-[11px] text-muted-foreground">Feito{c.checked_by ? ` por ${c.checked_by.split(' ')[0]}` : ''} · {new Date(c.checked_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                        ) : it.hint && <p className="text-xs text-muted-foreground">{it.hint}</p>}
                      </div>
                      {it.link && it.link !== '/head' && (
                        <Link to={it.link} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Abrir" title="Abrir"><ArrowUpRight className="h-4 w-4" /></Link>
                      )}
                    </li>
                  );
                })}
                {list.length === 0 && !editing && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Nada nessa rotina. Clique em Editar rotina.</li>}
              </ul>
              {editing && (
                <div className="flex gap-2 border-t p-3">
                  <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()}
                    placeholder={`Nova tarefa (${PERIODS.find((p) => p.key === tab)!.scope})`} />
                  <Button variant="outline" onClick={addItem} disabled={!newTitle.trim()}><Plus className="mr-1.5 h-4 w-4" />Adicionar</Button>
                </div>
              )}
            </>
          )}
        </section>

        <PostIssuesPanel posts={posts} clientName={clientName} isAdmin me={me} team={team} people={people} onPeopleChange={choosePeople} />
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-muted-foreground" /> Clientes</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Primeiro quem está sem post na próxima semana e com ajuste pendente.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                <th className="px-4 py-2 font-semibold">Cliente</th>
                <th className="px-3 py-2 font-semibold">Social media</th>
                <th className="px-3 py-2 text-right font-semibold">Próx. 7 dias</th>
                <th className="px-3 py-2 text-right font-semibold">Próx. semana</th>
                <th className="px-3 py-2 text-right font-semibold">Em aprovação</th>
                <th className="px-4 py-2 text-right font-semibold">Ajustes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const letter = abc[r.c.id]?.letter;
                return (
                  <tr key={r.c.id} className="hover:bg-foreground/[0.03]">
                    <td className="px-4 py-2.5">
                      <Link to={`/planner?cliente=${r.c.id}`} className="flex items-center gap-2 font-medium text-foreground hover:underline">
                        {letter && <span className={cn('rounded px-1.5 text-[11px] font-bold', ABC_STYLES[letter])}>{letter}</span>}
                        <span className="truncate">{r.c.companyName}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{(r.c.accountManager ?? []).join(', ') || '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.week}</td>
                    <td className={cn('px-3 py-2.5 text-right tabular-nums', r.nextWeek === 0 && 'font-semibold text-warning')}>{r.nextWeek === 0 ? 'nenhum' : r.nextWeek}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.approval || '—'}</td>
                    <td className={cn('px-4 py-2.5 text-right tabular-nums', r.changes > 0 && 'font-semibold text-warning')}>{r.changes || '—'}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Nenhum cliente ativo</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warning' | 'success' }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className={cn('mt-1 font-display text-2xl font-semibold tabular-nums',
        tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-success' : 'text-foreground')}>{value}</p>
    </div>
  );
}
