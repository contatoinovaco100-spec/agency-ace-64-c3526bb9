import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAgency } from '@/contexts/AgencyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Loader2, ChevronLeft, ChevronRight, AlertTriangle, TrendingDown, Copy,
  Gauge, History, CalendarClock,
} from 'lucide-react';

type ScoreRow = {
  id: string;
  client_id: string;
  score_date: string;
  score: number;
  note: string;
};

const DAY_LABELS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

/* ---------- helpers de data (locais, sem UTC shift) ---------- */
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function mondayOf(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay(); // 0 dom, 1 seg
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
const fmtShort = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

function statusOf(avg: number | null) {
  if (avg === null) return { emoji: '⚪', label: 'Sem dados', cls: 'bg-muted text-muted-foreground' };
  if (avg >= 7) return { emoji: '🟢', label: 'Positivo', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' };
  if (avg >= 5) return { emoji: '🟡', label: 'Atenção', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' };
  return { emoji: '🔴', label: 'Crítico', cls: 'bg-red-500/15 text-red-500 border-red-500/30' };
}

const avgOf = (nums: number[]) =>
  nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;

export default function ClientScoresPage() {
  const { clients, loading: clientsLoading } = useAgency();
  const [weekOffset, setWeekOffset] = useState(0);
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [prevRows, setPrevRows] = useState<ScoreRow[]>([]);
  const [history, setHistory] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'todos' | 'verde' | 'amarelo' | 'vermelho' | 'sem'>('todos');

  const activeClients = useMemo(
    () => clients.filter(c => c.status !== 'Cancelado').sort((a, b) => a.companyName.localeCompare(b.companyName)),
    [clients],
  );

  const weekStart = useMemo(() => addDays(mondayOf(new Date()), weekOffset * 7), [weekOffset]);
  const weekDays = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const prevStart = useMemo(() => addDays(weekStart, -7), [weekStart]);

  const load = useCallback(async () => {
    setLoading(true);
    const from = iso(addDays(weekStart, -70));
    const to = iso(addDays(weekStart, 6));
    const { data, error } = await supabase
      .from('client_daily_scores')
      .select('id, client_id, score_date, score, note')
      .gte('score_date', from)
      .lte('score_date', to)
      .order('score_date');
    if (error) {
      toast.error('Erro ao carregar notas: ' + error.message);
      setLoading(false);
      return;
    }
    const all = (data ?? []) as ScoreRow[];
    const ws = iso(weekStart), we = iso(addDays(weekStart, 4));
    const ps = iso(prevStart), pe = iso(addDays(prevStart, 4));
    setRows(all.filter(r => r.score_date >= ws && r.score_date <= we));
    setPrevRows(all.filter(r => r.score_date >= ps && r.score_date <= pe));
    setHistory(all.filter(r => r.score_date < ws));
    setLoading(false);
  }, [weekStart, prevStart]);

  useEffect(() => { load(); }, [load]);

  /* ---------- índice cliente/dia ---------- */
  const key = (clientId: string, date: string) => `${clientId}|${date}`;
  const index = useMemo(() => {
    const m = new Map<string, ScoreRow>();
    rows.forEach(r => m.set(key(r.client_id, r.score_date), r));
    return m;
  }, [rows]);

  async function upsert(clientId: string, date: string, patch: { score?: number | null; note?: string }) {
    const existing = index.get(key(clientId, date));
    const k = key(clientId, date);
    setSaving(k);
    try {
      if (patch.score === null) {
        if (existing) {
          await supabase.from('client_daily_scores').delete().eq('id', existing.id);
          setRows(prev => prev.filter(r => r.id !== existing.id));
        }
        return;
      }
      const score = patch.score ?? existing?.score;
      if (score === undefined) { toast.error('Informe a nota antes da observação.'); return; }
      const note = patch.note ?? existing?.note ?? '';
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('client_daily_scores')
        .upsert(
          { client_id: clientId, score_date: date, score, note, created_by: userData.user?.id ?? null },
          { onConflict: 'client_id,score_date' },
        )
        .select('id, client_id, score_date, score, note')
        .single();
      if (error) throw error;
      const saved = data as ScoreRow;
      setRows(prev => {
        const others = prev.filter(r => !(r.client_id === clientId && r.score_date === date));
        return [...others, saved];
      });
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + (e.message || e));
    } finally {
      setSaving(null);
    }
  }

  /* ---------- cálculos por cliente ---------- */
  const perClient = useMemo(() => {
    return activeClients.map(c => {
      const daily = weekDays.map(d => index.get(key(c.id, iso(d))) ?? null);
      const nums = daily.filter(Boolean).map(r => r!.score);
      const avg = avgOf(nums);
      const prevNums = prevRows.filter(r => r.client_id === c.id).map(r => r.score);
      const prevAvg = avgOf(prevNums);

      // alertas
      const alerts: string[] = [];
      for (let i = 1; i < daily.length; i++) {
        const a = daily[i - 1], b = daily[i];
        if (a && b && a.score - b.score >= 3) {
          alerts.push(`Queda brusca (${a.score} → ${b.score}) entre ${DAY_LABELS[i - 1]} e ${DAY_LABELS[i]}`);
        }
      }
      for (let i = 1; i < daily.length; i++) {
        const a = daily[i - 1], b = daily[i];
        if (a && b && a.score <= 5 && b.score <= 5) {
          alerts.push(`Nota ≤ 5 em ${DAY_LABELS[i - 1]} e ${DAY_LABELS[i]} — escalar para o gestor`);
          break;
        }
      }
      if (nums.length === 0) alerts.push('Sem acompanhamento nesta semana');

      const notes = daily
        .map((r, i) => (r && r.note.trim() ? { day: DAY_LABELS[i], score: r.score, note: r.note.trim() } : null))
        .filter(Boolean) as { day: string; score: number; note: string }[];

      return { client: c, daily, avg, prevAvg, delta: avg !== null && prevAvg !== null ? Math.round((avg - prevAvg) * 10) / 10 : null, alerts, notes };
    });
  }, [activeClients, weekDays, index, prevRows]);

  const filtered = useMemo(() => perClient.filter(r => {
    if (statusFilter === 'todos') return true;
    if (statusFilter === 'sem') return r.avg === null;
    if (r.avg === null) return false;
    if (statusFilter === 'verde') return r.avg >= 7;
    if (statusFilter === 'amarelo') return r.avg >= 5 && r.avg < 7;
    return r.avg < 5;
  }), [perClient, statusFilter]);

  const counts = useMemo(() => ({
    verde: perClient.filter(r => r.avg !== null && r.avg >= 7).length,
    amarelo: perClient.filter(r => r.avg !== null && r.avg >= 5 && r.avg < 7).length,
    vermelho: perClient.filter(r => r.avg !== null && r.avg < 5).length,
    sem: perClient.filter(r => r.avg === null).length,
  }), [perClient]);

  const scored = perClient.filter(r => r.avg !== null);
  const best = scored.length ? scored.reduce((a, b) => (b.avg! > a.avg! ? b : a)) : null;
  const worst = scored.length ? scored.reduce((a, b) => (b.avg! < a.avg! ? b : a)) : null;
  const withDelta = perClient.filter(r => r.delta !== null);
  const biggestDrop = withDelta.length ? withDelta.reduce((a, b) => (b.delta! < a.delta! ? b : a)) : null;

  /* ---------- histórico semanal (derivado das notas) ---------- */
  const historyWeeks = useMemo(() => {
    const map = new Map<string, Map<string, number[]>>(); // weekStartIso -> clientId -> scores
    [...history, ...prevRows, ...rows].forEach(r => {
      const ws = iso(mondayOf(new Date(r.score_date + 'T12:00:00')));
      if (!map.has(ws)) map.set(ws, new Map());
      const cm = map.get(ws)!;
      cm.set(r.client_id, [...(cm.get(r.client_id) ?? []), r.score]);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([ws, cm]) => {
        const start = new Date(ws + 'T12:00:00');
        return {
          weekIso: ws,
          label: `${fmtShort(start)} a ${fmtShort(addDays(start, 4))}`,
          items: Array.from(cm.entries())
            .map(([clientId, scores]) => ({
              clientId,
              name: clients.find(c => c.id === clientId)?.companyName ?? '—',
              avg: avgOf(scores)!,
            }))
            .sort((a, b) => b.avg - a.avg),
        };
      });
  }, [history, prevRows, rows, clients]);

  /* ---------- resumo de fechamento ---------- */
  const summaryText = useMemo(() => {
    const line = (r: typeof perClient[number]) => `- ${r.client.companyName}: ${r.avg?.toFixed(1)} ${statusOf(r.avg).emoji}`;
    const crit = perClient.filter(r => r.avg !== null && r.avg < 5);
    const aten = perClient.filter(r => r.avg !== null && r.avg >= 5 && r.avg < 7);
    const pos = perClient.filter(r => r.avg !== null && r.avg >= 7);
    const obs = perClient.flatMap(r => r.notes.map(n => `- ${r.client.companyName} (${n.day}, nota ${n.score}): ${n.note}`));
    return [
      `RESUMO DA SEMANA ${fmtShort(weekStart)} a ${fmtShort(addDays(weekStart, 4))}`,
      '',
      `Status: ${counts.verde}🟢 / ${counts.amarelo}🟡 / ${counts.vermelho}🔴${counts.sem ? ` / ${counts.sem}⚪ sem dados` : ''}`,
      best ? `Maior média: ${best.client.companyName} (${best.avg?.toFixed(1)})` : '',
      worst ? `Menor média: ${worst.client.companyName} (${worst.avg?.toFixed(1)})` : '',
      biggestDrop && biggestDrop.delta! < 0
        ? `Maior queda vs. semana anterior: ${biggestDrop.client.companyName} (${biggestDrop.delta})`
        : 'Maior queda vs. semana anterior: nenhuma queda registrada',
      '',
      '🔴 Clientes Críticos',
      crit.length ? crit.map(line).join('\n') : '- Nenhum',
      '',
      '🟡 Clientes em Atenção',
      aten.length ? aten.map(line).join('\n') : '- Nenhum',
      '',
      '🟢 Clientes Positivos',
      pos.length ? pos.map(line).join('\n') : '- Nenhum',
      '',
      'Observações do período',
      obs.length ? obs.join('\n') : '- Nenhuma',
    ].filter(Boolean).join('\n');
  }, [perClient, counts, best, worst, biggestDrop, weekStart]);

  const allAlerts = perClient.flatMap(r => r.alerts.map(a => ({ name: r.client.companyName, text: a })));

  if (clientsLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Gauge className="h-6 w-6 text-primary" /> Nota do Cliente
          </h1>
          <p className="text-sm text-muted-foreground">
            Avaliação diária de 0 a 10 por cliente — média e status calculados automaticamente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[150px] text-center text-sm font-medium">
            {fmtShort(weekStart)} a {fmtShort(addDays(weekStart, 4))}
            {weekOffset === 0 && <span className="ml-1 text-xs text-muted-foreground">(atual)</span>}
          </div>
          <Button variant="outline" size="icon" disabled={weekOffset >= 0} onClick={() => setWeekOffset(w => w + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="semana">
        <TabsList>
          <TabsTrigger value="semana"><CalendarClock className="mr-1 h-4 w-4" /> Semana</TabsTrigger>
          <TabsTrigger value="resumo">Resumo de fechamento</TabsTrigger>
          <TabsTrigger value="historico"><History className="mr-1 h-4 w-4" /> Histórico de Médias</TabsTrigger>
        </TabsList>

        {/* ---------------- SEMANA ---------------- */}
        <TabsContent value="semana" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Positivos 🟢', value: counts.verde },
              { label: 'Atenção 🟡', value: counts.amarelo },
              { label: 'Críticos 🔴', value: counts.vermelho },
              { label: 'Sem dados ⚪', value: counts.sem },
            ].map(s => (
              <Card key={s.label}><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </CardContent></Card>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtrar por status:</span>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="verde">🟢 Positivos (≥ 7)</SelectItem>
                <SelectItem value="amarelo">🟡 Atenção (5 – 6,9)</SelectItem>
                <SelectItem value="vermelho">🔴 Críticos (&lt; 5)</SelectItem>
                <SelectItem value="sem">⚪ Sem dados</SelectItem>
              </SelectContent>
            </Select>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="p-3 text-left font-medium">Cliente</th>
                    {weekDays.map((d, i) => (
                      <th key={i} className="p-2 text-center font-medium">
                        {DAY_LABELS[i]}<div className="text-[10px] font-normal text-muted-foreground">{fmtShort(d)}</div>
                      </th>
                    ))}
                    <th className="p-2 text-center font-medium">Média</th>
                    <th className="p-2 text-center font-medium">Status</th>
                    <th className="p-3 text-left font-medium">Observação do dia</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => {
                    const st = statusOf(row.avg);
                    const todayIdx = weekDays.findIndex(d => iso(d) === iso(new Date()));
                    const noteIdx = todayIdx >= 0 ? todayIdx : 4;
                    const noteCell = row.daily[noteIdx];
                    return (
                      <tr key={row.client.id} className="border-b border-border/60 hover:bg-muted/20">
                        <td className="p-3 font-medium">{row.client.companyName}</td>
                        {weekDays.map((d, i) => {
                          const cell = row.daily[i];
                          const k = key(row.client.id, iso(d));
                          return (
                            <td key={i} className="p-1 text-center">
                              <Input
                                type="number" min={0} max={10}
                                className="mx-auto h-9 w-16 text-center"
                                defaultValue={cell ? String(cell.score) : ''}
                                key={`${k}-${cell?.score ?? 'empty'}`}
                                disabled={saving === k}
                                onBlur={(e) => {
                                  const raw = e.target.value.trim();
                                  if (raw === '') {
                                    if (cell) upsert(row.client.id, iso(d), { score: null });
                                    return;
                                  }
                                  const n = Math.max(0, Math.min(10, Math.round(Number(raw))));
                                  if (isNaN(n)) return;
                                  if (cell && cell.score === n) return;
                                  upsert(row.client.id, iso(d), { score: n });
                                }}
                              />
                            </td>
                          );
                        })}
                        <td className="p-2 text-center font-semibold">
                          {row.avg === null ? <span className="text-xs text-muted-foreground">Sem dados</span> : row.avg.toFixed(1)}
                        </td>
                        <td className="p-2 text-center">
                          <Badge variant="outline" className={st.cls}>{st.emoji} {st.label}</Badge>
                        </td>
                        <td className="p-2">
                          <Input
                            placeholder={`Observação (${DAY_LABELS[noteIdx]})`}
                            defaultValue={noteCell?.note ?? ''}
                            key={`${row.client.id}-note-${noteIdx}-${noteCell?.id ?? 'none'}`}
                            className="h-9"
                            onBlur={(e) => {
                              const v = e.target.value;
                              if ((noteCell?.note ?? '') === v) return;
                              if (!noteCell) {
                                if (v.trim()) toast.error('Lance a nota do dia antes de escrever a observação.');
                                return;
                              }
                              upsert(row.client.id, iso(weekDays[noteIdx]), { note: v });
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {!filtered.length && (
                    <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Nenhum cliente para este filtro.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas automáticos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {allAlerts.length ? allAlerts.map((a, i) => (
                <p key={i}><span className="font-medium">{a.name}:</span> <span className="text-muted-foreground">{a.text}</span></p>
              )) : <p className="text-muted-foreground">Nenhum alerta nesta semana.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Escala de referência</CardTitle></CardHeader>
            <CardContent className="grid gap-1 text-sm text-muted-foreground md:grid-cols-2">
              <p><strong className="text-foreground">9–10</strong> — tranquilo, sem pendências</p>
              <p><strong className="text-foreground">7–8</strong> — normal, pequenas pendências</p>
              <p><strong className="text-foreground">5–6</strong> — atenção (atrasos, muitas alterações)</p>
              <p><strong className="text-foreground">3–4</strong> — crítico (reclamação, insatisfação)</p>
              <p><strong className="text-foreground">0–2</strong> — risco real de cancelamento</p>
              <p>Dias em branco não entram no cálculo da média.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- RESUMO ---------------- */}
        <TabsContent value="resumo" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Maior média</p>
              <p className="text-lg font-semibold">{best ? `${best.client.companyName} — ${best.avg?.toFixed(1)}` : '—'}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Menor média</p>
              <p className="text-lg font-semibold">{worst ? `${worst.client.companyName} — ${worst.avg?.toFixed(1)}` : '—'}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="flex items-center gap-1 text-xs text-muted-foreground"><TrendingDown className="h-3 w-3" /> Maior queda vs. semana anterior</p>
              <p className="text-lg font-semibold">
                {biggestDrop && biggestDrop.delta! < 0 ? `${biggestDrop.client.companyName} (${biggestDrop.delta})` : '—'}
              </p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Relatório para o gestor (17:30)</CardTitle>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => {
                navigator.clipboard.writeText(summaryText);
                toast.success('Resumo copiado!');
              }}><Copy className="h-4 w-4" /> Copiar</Button>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm">{summaryText}</pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- HISTÓRICO ---------------- */}
        <TabsContent value="historico" className="space-y-4">
          {historyWeeks.length ? historyWeeks.map(w => (
            <Card key={w.weekIso}>
              <CardHeader className="pb-2"><CardTitle className="text-base">{w.label}</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40">
                    <tr>
                      <th className="p-3 text-left font-medium">Cliente</th>
                      <th className="p-3 text-center font-medium">Média</th>
                      <th className="p-3 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {w.items.map(it => {
                      const st = statusOf(it.avg);
                      return (
                        <tr key={it.clientId} className="border-b border-border/60">
                          <td className="p-3">{it.name}</td>
                          <td className="p-3 text-center font-semibold">{it.avg.toFixed(1)}</td>
                          <td className="p-3 text-center"><Badge variant="outline" className={st.cls}>{st.emoji} {st.label}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )) : <p className="text-muted-foreground">Ainda não há histórico de semanas anteriores.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
