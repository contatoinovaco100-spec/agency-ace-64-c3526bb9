import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Copy, Loader2, RefreshCw, Gauge } from 'lucide-react';

/* ---------------- date helpers (local, no UTC shift) ---------------- */
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const DONE = ['concluído', 'concluido', 'finalizado', 'postado', 'programado'];
const isDone = (s: string) => DONE.includes((s || '').trim().toLowerCase());
const isRework = (s: string) => (s || '').toLowerCase().includes('altera');

const dot = (pct: number) => (pct >= 90 ? '🟢' : pct >= 75 ? '🟡' : '🔴');
const pad = (label: string, size = 16) =>
  label.length >= size ? label : label + ' '.repeat(size - label.length);
const avg = (n: number[]) => (n.length ? Math.round(n.reduce((a, b) => a + b, 0) / n.length) : null);

const SEP = '━'.repeat(28);

type Task = any;

interface Sector {
  name: string;
  score: number;
  total: number;
}

export default function CockpitPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState('');

  const build = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const today = iso(now);
    const tomorrow = iso(addDays(now, 1));
    const weekAgo = iso(addDays(now, -7));

    const [tasksRes, clientsRes, leadsRes, meetingsRes, shootRes, scoresRes] = await Promise.all([
      supabase.from('tasks').select('*'),
      supabase.from('clients').select('id, company_name, status'),
      supabase.from('leads').select('id, created_at, stage'),
      supabase
        .from('meetings')
        .select('id, title, client_name, meeting_date')
        .gte('meeting_date', `${tomorrow}T00:00:00`)
        .lte('meeting_date', `${tomorrow}T23:59:59`),
      supabase.from('shooting_schedules').select('id, title, shooting_date').eq('shooting_date', tomorrow),
      supabase.from('client_daily_scores').select('client_id, score, score_date').gte('score_date', weekAgo),
    ]);

    const clients = (clientsRes.data || []).filter((c: any) => c.status !== 'Cancelado');
    const activeIds = new Set(clients.map((c: any) => c.id));
    const allTasks: Task[] = (tasksRes.data || []).filter(
      (t: any) => !t.client_id || activeIds.has(t.client_id),
    );

    /* ---------------- sectors ---------------- */
    const openTasks = allTasks.filter((t) => !isDone(t.status));
    const sectorDefs: { name: string; match: (t: Task) => boolean }[] = [
      { name: 'SOCIAL MEDIA', match: (t) => !!(t.copywriter || '').trim() || t.task_type === 'Geral' },
      { name: 'FILMMAKER', match: (t) => !!(t.videomaker || '').trim() },
      { name: 'EDITOR', match: (t) => !!(t.editor || '').trim() },
      { name: 'DESIGNER', match: (t) => t.task_type === 'Arte' },
      { name: 'ACCOUNT', match: (t) => !!(t.assignee || '').trim() },
    ];

    const sectors: Sector[] = [];
    for (const def of sectorDefs) {
      const list = allTasks.filter(def.match);
      if (!list.length) continue;

      const due = list.filter((t) => t.due_date && t.due_date <= today);
      const entregas = due.length ? (due.filter((t) => isDone(t.status)).length / due.length) * 100 : 100;

      const open = list.filter((t) => !isDone(t.status));
      const atrasadas = open.filter((t) => t.due_date && t.due_date < today).length;
      const prazos = open.length ? ((open.length - atrasadas) / open.length) * 100 : 100;

      const retrabalho = list.length
        ? 100 - (list.filter((t) => isRework(t.status)).length / list.length) * 100
        : 100;

      sectors.push({
        name: def.name,
        score: Math.round((entregas + prazos + retrabalho) / 3),
        total: list.length,
      });
    }

    const geral = avg(sectors.map((s) => s.score)) ?? 0;
    const equipe = geral;

    /* ---------------- produção do dia ---------------- */
    const todayTasks = allTasks.filter((t) => t.due_date === today || t.post_date === today);
    const entregues = todayTasks.filter((t) => isDone(t.status)).length;

    /* ---------------- clientes ---------------- */
    const scoreByClient = new Map<string, number[]>();
    for (const s of scoresRes.data || []) {
      const arr = scoreByClient.get(s.client_id) || [];
      arr.push(Number(s.score));
      scoreByClient.set(s.client_id, arr);
    }
    let verdes = 0,
      amarelos = 0,
      vermelhos = 0;
    const criticos: string[] = [];
    const atencaoClientes: string[] = [];

    for (const c of clients) {
      const notas = scoreByClient.get(c.id) || [];
      const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
      const tarefasCliente = openTasks.filter((t) => t.client_id === c.id);
      const atrasadas = tarefasCliente.filter((t) => t.due_date && t.due_date < today).length;
      const aguardando = tarefasCliente.filter((t) => isRework(t.status)).length;

      if (atrasadas > 0 || (media !== null && media < 5)) {
        vermelhos++;
        criticos.push(c.company_name);
        atencaoClientes.push(
          `🔴 ${c.company_name} — ${atrasadas > 0 ? `${atrasadas} tarefa(s) em atraso` : 'nota crítica'}`,
        );
      } else if (aguardando > 0 || (media !== null && media < 7)) {
        amarelos++;
        atencaoClientes.push(
          `🟡 ${c.company_name} — ${aguardando > 0 ? 'aguardando aprovação/alteração' : 'nota em queda'}`,
        );
      } else {
        verdes++;
      }
    }

    /* ---------------- SLA ---------------- */
    const tarefasAtrasadas = openTasks.filter((t) => t.due_date && t.due_date < today);
    const colabAtrasados = new Set<string>();
    for (const t of tarefasAtrasadas) {
      for (const f of ['assignee', 'copywriter', 'editor', 'director', 'videomaker', 'script_writer']) {
        const v = (t[f] || '').trim();
        if (v) colabAtrasados.add(v.toLowerCase());
      }
    }
    const clientesAtrasados = new Set(tarefasAtrasadas.map((t) => t.client_id).filter(Boolean));

    /* ---------------- comercial ---------------- */
    const leads = (leadsRes.data || []).filter((l: any) => (l.created_at || '').slice(0, 10) === today);

    /* ---------------- atenção ---------------- */
    const atencao: string[] = [];
    if (tarefasAtrasadas.length)
      atencao.push(`🔴 ${tarefasAtrasadas.length} tarefa(s) com prazo vencido`);
    const semResponsavel = openTasks.filter(
      (t) => !['assignee', 'copywriter', 'editor', 'director', 'videomaker'].some((f) => (t[f] || '').trim()),
    ).length;
    if (semResponsavel) atencao.push(`🟡 ${semResponsavel} tarefa(s) sem responsável definido`);
    const emAlteracao = openTasks.filter((t) => isRework(t.status)).length;
    if (emAlteracao) atencao.push(`🟡 ${emAlteracao} entrega(s) em alteração`);
    const semNota = clients.filter((c) => !(scoreByClient.get(c.id) || []).length).length;
    if (semNota) atencao.push(`🟡 ${semNota} cliente(s) sem nota na semana`);
    atencao.push(...atencaoClientes.slice(0, 5));
    for (const s of sectors.filter((s) => s.score < 75))
      atencao.push(`🔴 Setor ${s.name} abaixo da meta (${s.score}%)`);
    if (!atencao.length) atencao.push('🟢 Nenhum risco ativo');

    /* ---------------- prioridades ---------------- */
    const prioridades: string[] = [];
    if (tarefasAtrasadas.length)
      prioridades.push(`Destravar ${tarefasAtrasadas.length} tarefa(s) vencida(s)`);
    if (emAlteracao) prioridades.push(`Concluir ${emAlteracao} alteração(ões) pendente(s)`);
    if (criticos.length) prioridades.push(`Acionar cliente(s) crítico(s): ${criticos.slice(0, 3).join(', ')}`);
    if (semResponsavel) prioridades.push(`Atribuir responsável em ${semResponsavel} tarefa(s)`);
    if (semNota) prioridades.push(`Lançar nota de ${semNota} cliente(s)`);
    if (!prioridades.length) prioridades.push('Manter ritmo de entregas do dia');

    /* ---------------- amanhã ---------------- */
    const amanhaTasks = allTasks.filter(
      (t) => !isDone(t.status) && (t.due_date === tomorrow || t.post_date === tomorrow),
    );
    const amanha: string[] = [];
    const capt = shootRes.data?.length || 0;
    if (capt) amanha.push(`🎥 ${capt} captação(ões)`);
    const videos = amanhaTasks.filter((t) => t.task_type === 'Produção de Vídeo').length;
    if (videos) amanha.push(`🎬 ${videos} vídeo(s)`);
    const artes = amanhaTasks.filter((t) => t.task_type === 'Arte').length;
    if (artes) amanha.push(`🎨 ${artes} arte(s)`);
    const reunioes = meetingsRes.data?.length || 0;
    if (reunioes) amanha.push(`📞 ${reunioes} reunião(ões)`);
    if (!amanha.length) amanha.push('Sem carga agendada');

    const dataStr = now.toLocaleDateString('pt-BR');
    const horaStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const out = [
      SEP,
      '       OPERAÇÃO INOVA',
      `       ${dataStr} • ${horaStr}`,
      SEP,
      `${dot(geral)} ${pad('OPERAÇÃO')}${geral}%`,
      `🎥 ${pad('PRODUÇÃO')}${entregues}/${todayTasks.length}`,
      `👥 ${pad('CLIENTES')}${verdes} 🟢 | ${amarelos} 🟡 | ${vermelhos} 🔴`,
      `👨‍💻 ${pad('EQUIPE')}${equipe}%`,
      `📈 ${pad('COMERCIAL')}${leads.length} LEADS`,
      SEP,
      '🚨 ATENÇÃO',
      ...atencao.slice(0, 8),
      SEP,
      '🎯 PRIORIDADES',
      ...prioridades.slice(0, 3).map((p, i) => `${i + 1}. ${p}`),
      SEP,
      '📊 SETORES',
      ...sectors.map((s) => `${pad(s.name, 18)}${dot(s.score)} ${s.score}%`),
      SEP,
      '⏱ SLA VIOLADO',
      `${tarefasAtrasadas.length} tarefas`,
      `${colabAtrasados.size} colaboradores`,
      `${clientesAtrasados.size} cliente(s)`,
      SEP,
      '📅 AMANHÃ',
      ...amanha,
      SEP,
    ].join('\n');

    setReport(out);
    setLoading(false);
  }, []);

  useEffect(() => {
    build();
  }, [build]);

  const copy = () => {
    navigator.clipboard.writeText(report);
    toast.success('Cockpit copiado');
  };

  const header = useMemo(
    () => (
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Cockpit do Gestor</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={build} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Atualizar</span>
          </Button>
          <Button size="sm" onClick={copy} disabled={!report}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar
          </Button>
        </div>
      </div>
    ),
    [build, loading, report],
  );

  return (
    <div className="space-y-4">
      {header}
      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <pre className="font-mono text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
              {report}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
