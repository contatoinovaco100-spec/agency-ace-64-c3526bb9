import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DailyPoint {
  date: string;
  reach?: number;
  impressions?: number;
  profile_views?: number;
  follower_count?: number;
}

const nf = (n: number) => new Intl.NumberFormat('pt-BR').format(Math.round(n || 0));

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
function shiftDays(dateStr: string, n: number) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return iso(new Date(Date.UTC(y, m - 1, d + n)));
}
function diffDays(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}
function fmt(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

interface Props {
  daily: DailyPoint[];
  /** Informs the parent of the oldest date needed so it can widen the fetch window. */
  onEarliestDateChange?: (date: string) => void;
}

const METRICS = [
  { key: 'reach', label: 'Alcance' },
  { key: 'impressions', label: 'Impressões' },
  { key: 'profile_views', label: 'Visitas ao perfil' },
  { key: 'follower_count', label: 'Novos seguidores' },
] as const;

export default function DateComparison({ daily, onEarliestDateChange }: Props) {
  const today = iso(new Date());
  const [aEnd, setAEnd] = useState(shiftDays(today, -1));
  const [aStart, setAStart] = useState(shiftDays(today, -7));
  const [bEnd, setBEnd] = useState(shiftDays(today, -8));
  const [bStart, setBStart] = useState(shiftDays(today, -14));

  useEffect(() => {
    const earliest = [aStart, bStart].sort()[0];
    onEarliestDateChange?.(earliest);
  }, [aStart, bStart, onEarliestDateChange]);

  const sum = useMemo(() => {
    const range = (start: string, end: string) => {
      const rows = daily.filter(d => d.date >= start && d.date <= end);
      return {
        days: rows.length,
        reach: rows.reduce((s, d) => s + (d.reach || 0), 0),
        impressions: rows.reduce((s, d) => s + (d.impressions || 0), 0),
        profile_views: rows.reduce((s, d) => s + (d.profile_views || 0), 0),
        follower_count: rows.reduce((s, d) => s + (d.follower_count || 0), 0),
      };
    };
    return { a: range(aStart, aEnd), b: range(bStart, bEnd) };
  }, [daily, aStart, aEnd, bStart, bEnd]);

  const chartData = METRICS.map(m => ({
    metric: m.label,
    'Período A': sum.a[m.key],
    'Período B': sum.b[m.key],
  }));

  const applyPreset = (n: number) => {
    const end = shiftDays(today, -1);
    setAEnd(end);
    setAStart(shiftDays(end, -(n - 1)));
    const bE = shiftDays(end, -n);
    setBEnd(bE);
    setBStart(shiftDays(bE, -(n - 1)));
  };

  const lenA = diffDays(aStart, aEnd) + 1;
  const lenB = diffDays(bStart, bEnd) + 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarRange className="h-4 w-4 text-primary" /> Comparativo de períodos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[7, 14, 30].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => applyPreset(n)}
              className="rounded-md border border-border px-3 py-1 text-xs transition-colors hover:border-primary/60"
            >
              Últimos {n} dias vs anteriores
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-primary/40 p-3">
            <p className="mb-2 text-xs font-semibold text-primary">Período A ({lenA} dias)</p>
            <div className="flex items-center gap-2">
              <Input type="date" value={aStart} max={aEnd} onChange={e => setAStart(e.target.value)} className="h-9" />
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input type="date" value={aEnd} min={aStart} max={today} onChange={e => setAEnd(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Período B ({lenB} dias)</p>
            <div className="flex items-center gap-2">
              <Input type="date" value={bStart} max={bEnd} onChange={e => setBStart(e.target.value)} className="h-9" />
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input type="date" value={bEnd} min={bStart} max={today} onChange={e => setBEnd(e.target.value)} className="h-9" />
            </div>
          </div>
        </div>

        {lenA !== lenB && (
          <p className="text-xs text-muted-foreground">
            Os períodos têm tamanhos diferentes ({lenA} vs {lenB} dias) — a variação pode ser distorcida.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {METRICS.map(m => {
            const a = sum.a[m.key];
            const b = sum.b[m.key];
            const delta = b > 0 ? ((a - b) / b) * 100 : a > 0 ? 100 : 0;
            const up = delta >= 0;
            return (
              <div key={m.key} className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-2xl font-bold">{nf(a)}</p>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Antes: {nf(b)}</span>
                  <Badge
                    variant="secondary"
                    className={cn('gap-1', up ? 'text-emerald-500' : 'text-red-500')}
                  >
                    {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {delta.toFixed(1).replace('.', ',')}%
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="metric" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v: any) => nf(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Período A" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Período B" fill="hsl(var(--muted-foreground) / 0.5)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Período A: {fmt(aStart)} a {fmt(aEnd)} · Período B: {fmt(bStart)} a {fmt(bEnd)}
        </p>
      </CardContent>
    </Card>
  );
}
