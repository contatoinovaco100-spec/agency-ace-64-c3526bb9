import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Loader2, RefreshCw, Users, AlertTriangle, Timer, Star, Gauge, Save,
} from 'lucide-react';

/* ------------------------- helpers ------------------------- */
const ROLE_FIELDS = ['assignee', 'copywriter', 'director', 'videomaker', 'editor', 'script_writer'] as const;

const DONE = ['concluído', 'concluido', 'finalizado', 'postado', 'programado'];
const isDone = (s: string) => DONE.includes((s || '').trim().toLowerCase());
const isRework = (s: string) => (s || '').toLowerCase().includes('altera');
const norm = (s: string) => (s || '').trim().toLowerCase();

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const daysBetween = (a: string | Date, b: string | Date) =>
  Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));

function statusOf(score: number) {
  if (score >= 90) return { emoji: '🟢', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' };
  if (score >= 75) return { emoji: '🟡', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' };
  return { emoji: '🔴', cls: 'bg-red-500/15 text-red-500 border-red-500/30' };
}

type Period = 'semana' | '30dias' | 'mesPassado';

function periodRange(p: Period): { start: string; end: string; label: string } {
  const now = new Date();
  if (p === 'semana') {
    const dow = now.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const monday = addDays(now, diff);
    return { start: iso(monday), end: iso(now), label: 'Semana atual' };
  }
  if (p === '30dias') return { start: iso(addDays(now, -30)), end: iso(now), label: 'Últimos 30 dias' };
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start: iso(first), end: iso(last), label: 'Mês passado' };
}

type Task = any;
type Evaluation = { id: string; task_id: string; member_name: string; score: number; comment: string };

interface MemberStats {
  name: string;
  jobTitle: string;
  tasks: Task[];
  entregues: number;
  noPrazo: number;
  atrasadas: number;
  retrabalho: number;
  emAberto: number;
  tempoMedio: number | null;
  notaGestor: number | null;
  score: number;
}

export default function DesempenhoPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [evals, setEvals] = useState<Evaluation[]>([]);

  const [period, setPeriod] = useState<Period>('30dias');
  const [clientFilter, setClientFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [memberFilter, setMemberFilter] = useState('all');
  const [openMember, setOpenMember] = useState<MemberStats | null>(null);

  const range = useMemo(() => periodRange(period), [period]);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, c, p, h, e] = await Promise.all([
      supabase.from('tasks').select('*'),
      supabase.from('clients').select('id, company_name, status'),
      supabase.from('profiles').select('id, full_name, job_title, is_active'),
      supabase.from('task_stage_history').select('task_id, from_stage, to_stage, created_at'),
      supabase.from('task_evaluations' as any).select('*'),
    ]);
    setTasks(t.data || []);
    setClients(c.data || []);
    setProfiles(p.data || []);
    setHistory(h.data || []);
    setEvals(((e.data as any) || []) as Evaluation[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* -------------------- base filtrada -------------------- */
  const activeClientIds = useMemo(
    () => new Set(clients.filter((c) => c.status !== 'Cancelado').map((c) => c.id)),
    [clients],
  );
  const clientName = useCallback(
    (id: string | null) => clients.find((c) => c.id === id)?.company_name || 'Sem cliente',
    [clients],
  );

  const scopedTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.client_id && !activeClientIds.has(t.client_id)) return false;
      if (clientFilter !== 'all' && t.client_id !== clientFilter) return false;
      if (typeFilter !== 'all' && (t.task_type || 'Geral') !== typeFilter) return false;
      return true;
    });
  }, [tasks, activeClientIds, clientFilter, typeFilter]);

  // tarefas do período: due_date ou atualização dentro da janela
  const periodTasks = useMemo(() => {
    return scopedTasks.filter((t) => {
      const ref = (t.due_date as string) || (t.updated_at || '').slice(0, 10);
      return ref >= range.start && ref <= range.end;
    });
  }, [scopedTasks, range]);

  const historyByTask = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const h of history) {
      const arr = m.get(h.task_id) || [];
      arr.push(h);
      m.set(h.task_id, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return m;
  }, [history]);

  const evalByKey = useMemo(() => {
    const m = new Map<string, Evaluation>();
    for (const e of evals) m.set(`${e.task_id}|${norm(e.member_name)}`, e);
    return m;
  }, [evals]);

  const hadRework = useCallback(
    (t: Task) =>
      isRework(t.status) || (historyByTask.get(t.id) || []).some((h) => isRework(h.to_stage)),
    [historyByTask],
  );

  const conclusionDays = useCallback(
    (t: Task): number | null => {
      if (!isDone(t.status)) return null;
      const hist = historyByTask.get(t.id) || [];
      const doneEvt = [...hist].reverse().find((h) => isDone(h.to_stage));
      const end = doneEvt?.created_at || t.updated_at;
      if (!end) return null;
      return daysBetween(t.created_at, end);
    },
    [historyByTask],
  );

  /* -------------------- estatísticas por funcionário -------------------- */
  const members: MemberStats[] = useMemo(() => {
    const people = profiles.filter((p) => p.is_active !== false && (p.full_name || '').trim());
    const out: MemberStats[] = [];
    const today = iso(new Date());

    for (const p of people) {
      const name = (p.full_name as string).trim();
      const key = norm(name);
      const mine = periodTasks.filter((t) => ROLE_FIELDS.some((f) => norm(t[f]) === key));
      if (!mine.length) continue;

      const entregues = mine.filter((t) => isDone(t.status)).length;
      const comPrazo = mine.filter((t) => t.due_date);
      const noPrazo = comPrazo.filter(
        (t) => isDone(t.status) && (!t.due_date || (t.updated_at || '').slice(0, 10) <= t.due_date),
      ).length;
      const abertos = mine.filter((t) => !isDone(t.status));
      const atrasadas = abertos.filter((t) => t.due_date && t.due_date < today).length;
      const retrabalho = mine.filter(hadRework).length;

      const tempos = mine.map(conclusionDays).filter((d): d is number => d !== null);
      const tempoMedio = tempos.length
        ? Math.round((tempos.reduce((a, b) => a + b, 0) / tempos.length) * 10) / 10
        : null;

      const notas = mine
        .map((t) => evalByKey.get(`${t.id}|${key}`)?.score)
        .filter((n): n is number => typeof n === 'number');
      const notaGestor = notas.length
        ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10
        : null;

      const mPrazo = comPrazo.length ? (noPrazo / comPrazo.length) * 100 : 100;
      const mVolume = mine.length ? (entregues / mine.length) * 100 : 0;
      const mQualidade = mine.length ? 100 - (retrabalho / mine.length) * 100 : 100;
      const parts = [mPrazo, mVolume, mQualidade];
      if (notaGestor !== null) parts.push(notaGestor * 10);
      const score = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);

      out.push({
        name,
        jobTitle: p.job_title || '—',
        tasks: mine,
        entregues,
        noPrazo,
        atrasadas,
        retrabalho,
        emAberto: abertos.length,
        tempoMedio,
        notaGestor,
        score,
      });
    }
    return out
      .filter((m) => memberFilter === 'all' || m.name === memberFilter)
      .sort((a, b) => b.score - a.score);
  }, [profiles, periodTasks, hadRework, conclusionDays, evalByKey, memberFilter]);

  const allMemberNames = useMemo(
    () =>
      Array.from(
        new Set(
          profiles
            .filter((p) => p.is_active !== false && (p.full_name || '').trim())
            .map((p) => (p.full_name as string).trim()),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [profiles],
  );

  /* -------------------- gargalos -------------------- */
  const today = iso(new Date());
  const openTasks = useMemo(() => scopedTasks.filter((t) => !isDone(t.status)), [scopedTasks]);

  const stageStuckAt = useCallback(
    (t: Task) => {
      const hist = historyByTask.get(t.id) || [];
      const last = [...hist].reverse().find((h) => h.to_stage === t.status);
      return last?.created_at || t.updated_at || t.created_at;
    },
    [historyByTask],
  );

  const byStage = useMemo(() => {
    const m = new Map<string, { count: number; days: number[] }>();
    for (const t of openTasks) {
      const k = t.status || 'Sem etapa';
      const e = m.get(k) || { count: 0, days: [] };
      e.count++;
      e.days.push(daysBetween(stageStuckAt(t), new Date()));
      m.set(k, e);
    }
    return Array.from(m.entries())
      .map(([stage, v]) => ({
        stage,
        count: v.count,
        avgDays: Math.round((v.days.reduce((a, b) => a + b, 0) / v.days.length) * 10) / 10,
      }))
      .sort((a, b) => b.count * b.avgDays - a.count * a.avgDays);
  }, [openTasks, stageStuckAt]);

  const byMemberQueue = useMemo(() => {
    const m = new Map<string, { fila: number; atrasadas: number; dias: number[] }>();
    for (const t of openTasks) {
      const names = new Set(ROLE_FIELDS.map((f) => (t[f] || '').trim()).filter(Boolean));
      for (const n of names) {
        const e = m.get(n) || { fila: 0, atrasadas: 0, dias: [] };
        e.fila++;
        if (t.due_date && t.due_date < today) e.atrasadas++;
        e.dias.push(daysBetween(stageStuckAt(t), new Date()));
        m.set(n, e);
      }
    }
    return Array.from(m.entries())
      .map(([name, v]) => ({
        name,
        fila: v.fila,
        atrasadas: v.atrasadas,
        avgDays: Math.round((v.dias.reduce((a, b) => a + b, 0) / v.dias.length) * 10) / 10,
      }))
      .sort((a, b) => b.atrasadas - a.atrasadas || b.fila - a.fila);
  }, [openTasks, stageStuckAt, today]);

  const byClientQueue = useMemo(() => {
    const m = new Map<string, { fila: number; atrasadas: number; dias: number[] }>();
    for (const t of openTasks) {
      const k = clientName(t.client_id);
      const e = m.get(k) || { fila: 0, atrasadas: 0, dias: [] };
      e.fila++;
      if (t.due_date && t.due_date < today) e.atrasadas++;
      e.dias.push(daysBetween(stageStuckAt(t), new Date()));
      m.set(k, e);
    }
    return Array.from(m.entries())
      .map(([name, v]) => ({
        name,
        fila: v.fila,
        atrasadas: v.atrasadas,
        avgDays: Math.round((v.dias.reduce((a, b) => a + b, 0) / v.dias.length) * 10) / 10,
      }))
      .sort((a, b) => b.atrasadas - a.atrasadas || b.fila - a.fila);
  }, [openTasks, stageStuckAt, today, clientName]);

  /* -------------------- salvar avaliação -------------------- */
  const saveEval = async (taskId: string, memberName: string, score: number, comment: string) => {
    if (score < 0 || score > 10 || Number.isNaN(score)) {
      toast.error('A nota deve ser de 0 a 10.');
      return;
    }
    const { data, error } = await supabase
      .from('task_evaluations' as any)
      .upsert(
        { task_id: taskId, member_name: memberName, score, comment, evaluated_by: user?.id ?? null },
        { onConflict: 'task_id,member_name' },
      )
      .select()
      .single();
    if (error) {
      toast.error('Não foi possível salvar a avaliação.');
      return;
    }
    setEvals((prev) => {
      const rest = prev.filter(
        (e) => !(e.task_id === taskId && norm(e.member_name) === norm(memberName)),
      );
      return [...rest, data as any as Evaluation];
    });
    toast.success('Avaliação salva');
  };

  /* -------------------- render -------------------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const topStage = byStage[0];
  const topMember = byMemberQueue[0];
  const topClient = byClientQueue[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Desempenho da Equipe</h1>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* filtros */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semana">Semana atual</SelectItem>
            <SelectItem value="30dias">Últimos 30 dias</SelectItem>
            <SelectItem value="mesPassado">Mês passado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients
              .filter((c) => c.status !== 'Cancelado')
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="Produção de Vídeo">Vídeo</SelectItem>
            <SelectItem value="Arte">Arte</SelectItem>
            <SelectItem value="Geral">Geral</SelectItem>
          </SelectContent>
        </Select>
        <Select value={memberFilter} onValueChange={setMemberFilter}>
          <SelectTrigger><SelectValue placeholder="Funcionário" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os funcionários</SelectItem>
            {allMemberNames.map((n) => (
              <SelectItem key={n} value={n}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="equipe">
        <TabsList>
          <TabsTrigger value="equipe"><Users className="h-4 w-4 mr-2" />Equipe</TabsTrigger>
          <TabsTrigger value="gargalos"><AlertTriangle className="h-4 w-4 mr-2" />Gargalos</TabsTrigger>
        </TabsList>

        {/* ---------------- EQUIPE ---------------- */}
        <TabsContent value="equipe" className="space-y-3 mt-4">
          <p className="text-sm text-muted-foreground">
            {range.label} • clique em um funcionário para avaliar cada demanda
          </p>
          {members.length === 0 && (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              Nenhuma demanda encontrada com esses filtros.
            </CardContent></Card>
          )}
          {members.map((m) => {
            const st = statusOf(m.score);
            return (
              <Card
                key={m.name}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setOpenMember(m)}
              >
                <CardContent className="p-4 flex flex-wrap items-center gap-4">
                  <div className="min-w-[180px] flex-1">
                    <p className="font-semibold">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.jobTitle}</p>
                  </div>
                  <Badge className={st.cls}>{st.emoji} {m.score}%</Badge>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                    <span>{m.tasks.length} demandas</span>
                    <span>{m.entregues} entregues</span>
                    <span>{m.noPrazo} no prazo</span>
                    <span className={m.atrasadas ? 'text-red-500' : ''}>{m.atrasadas} atrasadas</span>
                    <span className={m.retrabalho ? 'text-amber-500' : ''}>{m.retrabalho} retrabalho</span>
                    <span><Timer className="inline h-3 w-3 mr-1" />{m.tempoMedio ?? '—'} d</span>
                    <span><Star className="inline h-3 w-3 mr-1" />{m.notaGestor ?? 'sem nota'}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ---------------- GARGALOS ---------------- */}
        <TabsContent value="gargalos" className="mt-4">
          <Tabs defaultValue="etapa">
            <TabsList>
              <TabsTrigger value="etapa">Por etapa</TabsTrigger>
              <TabsTrigger value="funcionario">Por funcionário</TabsTrigger>
              <TabsTrigger value="cliente">Por cliente</TabsTrigger>
            </TabsList>

            <TabsContent value="etapa" className="mt-4 space-y-3">
              {topStage && (
                <Card className="border-amber-500/40 bg-amber-500/5">
                  <CardContent className="p-4 text-sm">
                    <strong>Maior gargalo:</strong> {topStage.stage} — {topStage.count} tarefa(s) paradas,
                    média de {topStage.avgDays} dia(s).
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader><CardTitle className="text-base">Fila por etapa</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {byStage.map((s) => (
                    <div key={s.stage} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                      <span>{s.stage}</span>
                      <span className="text-muted-foreground">{s.count} paradas • {s.avgDays} d</span>
                    </div>
                  ))}
                  {!byStage.length && <p className="text-sm text-muted-foreground">Sem tarefas em aberto.</p>}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="funcionario" className="mt-4 space-y-3">
              {topMember && (
                <Card className="border-amber-500/40 bg-amber-500/5">
                  <CardContent className="p-4 text-sm">
                    <strong>Maior gargalo:</strong> {topMember.name} — {topMember.fila} na fila,{' '}
                    {topMember.atrasadas} atrasada(s), média de {topMember.avgDays} dia(s) parada.
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="p-4 space-y-2">
                  {byMemberQueue.map((m) => (
                    <div key={m.name} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                      <span>{m.name}</span>
                      <span className="text-muted-foreground">
                        {m.fila} na fila • <span className={m.atrasadas ? 'text-red-500' : ''}>{m.atrasadas} atrasadas</span> • {m.avgDays} d
                      </span>
                    </div>
                  ))}
                  {!byMemberQueue.length && <p className="text-sm text-muted-foreground">Sem fila em aberto.</p>}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cliente" className="mt-4 space-y-3">
              {topClient && (
                <Card className="border-amber-500/40 bg-amber-500/5">
                  <CardContent className="p-4 text-sm">
                    <strong>Maior gargalo:</strong> {topClient.name} — {topClient.fila} demanda(s) travadas,{' '}
                    {topClient.atrasadas} atrasada(s).
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="p-4 space-y-2">
                  {byClientQueue.map((c) => (
                    <div key={c.name} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                      <span>{c.name}</span>
                      <span className="text-muted-foreground">
                        {c.fila} na fila • <span className={c.atrasadas ? 'text-red-500' : ''}>{c.atrasadas} atrasadas</span> • {c.avgDays} d
                      </span>
                    </div>
                  ))}
                  {!byClientQueue.length && <p className="text-sm text-muted-foreground">Sem fila em aberto.</p>}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* ---------------- dialog de avaliação ---------------- */}
      <Dialog open={!!openMember} onOpenChange={(o) => !o && setOpenMember(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Demandas de {openMember?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {openMember?.tasks.map((t) => (
              <EvalRow
                key={t.id}
                task={t}
                memberName={openMember.name}
                clientName={clientName(t.client_id)}
                atrasada={!isDone(t.status) && !!t.due_date && t.due_date < today}
                current={evalByKey.get(`${t.id}|${norm(openMember.name)}`)}
                onSave={saveEval}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------- linha de avaliação ------------------------- */
function EvalRow({
  task, memberName, clientName, atrasada, current, onSave,
}: {
  task: Task;
  memberName: string;
  clientName: string;
  atrasada: boolean;
  current?: Evaluation;
  onSave: (taskId: string, member: string, score: number, comment: string) => Promise<void>;
}) {
  const [score, setScore] = useState<string>(current ? String(current.score) : '');
  const [comment, setComment] = useState<string>(current?.comment || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave(task.id, memberName, Number(score), comment);
    setSaving(false);
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{task.title || task.video_name || 'Demanda'}</span>
        <Badge variant="outline">{clientName}</Badge>
        <Badge variant="secondary">{task.status}</Badge>
        {task.due_date && (
          <span className={`text-xs ${atrasada ? 'text-red-500' : 'text-muted-foreground'}`}>
            prazo {task.due_date.split('-').reverse().join('/')}{atrasada ? ' • atrasada' : ''}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          type="number"
          min={0}
          max={10}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder="Nota"
          className="w-20"
        />
        <Input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Comentário do gestor"
          className="flex-1 min-w-[180px]"
        />
        <Button size="sm" onClick={save} disabled={saving || score === ''}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
