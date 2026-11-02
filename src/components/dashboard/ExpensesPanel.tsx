import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Plus, Trash2, TrendingDown, TrendingUp, Wallet, Receipt, Loader2,
  Sparkles, FileBarChart, Edit2, Repeat, Search, X,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { toast } from 'sonner';
import { Client } from '@/types/agency';
import { recurringValue } from '@/lib/clientBilling';

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  type: string; // 'gasto' | 'investimento' | 'ganho_extra' | 'faturamento'
  month_ref: string;
  created_at: string;
  spent_on?: string | null; // dia do lançamento (migração 20261101090000)
  recurring?: boolean; // gasto fixo: repete todo mês
}

const EXPENSE_CATEGORIES = [
  'Ferramentas/Software',
  'Tráfego Pago',
  'Salários/Freelancers',
  'Infraestrutura',
  'Alimentação',
  'Transporte',
  'Escritório',
  'Marketing',
  'Impostos',
  'Equipamentos',
  'Outros',
];

const FREELA_CATEGORIES = [
  'Freela - Vídeo',
  'Freela - Foto',
  'Freela - Edição',
  'Freela - Social Media',
  'Freela - Tráfego',
  'Freela - Consultoria',
  'Freela - Outros',
];

const SNAPSHOT_CATEGORY = 'Faturamento Mensal (Trava)';

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(142, 70%, 45%)',
  'hsl(217, 91%, 60%)',
  'hsl(38, 92%, 50%)',
  'hsl(340, 75%, 55%)',
  'hsl(180, 60%, 45%)',
  'hsl(0, 62%, 50%)',
  'hsl(280, 50%, 60%)',
];

const TYPE_LABELS: Record<string, string> = {
  gasto: 'Gasto',
  investimento: 'Investimento',
  ganho_extra: 'Ganho extra',
  faturamento: 'Faturamento',
};

const anim = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.04, duration: 0.35 },
});

function formatCurrency(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** "2026-10-14" → "2026-10-01" */
const monthOf = (day: string) => `${day.slice(0, 7)}-01`;

function getCurrentMonthRef() {
  return monthOf(isoDate(new Date()));
}

function shiftMonth(m: string, n: number) {
  const [y, mo] = m.split('-').map(Number);
  return isoDate(new Date(y, mo - 1 + n, 1));
}

/** Data padrão de um lançamento novo no mês aberto: hoje no mês atual, dia 1 nos outros */
function defaultDay(m: string) {
  const today = isoDate(new Date());
  return monthOf(today) === m ? today : m;
}

/** Dia do lançamento; os antigos (sem data) usam o dia do cadastro se caiu no mês, senão o dia 1 */
function dayOf(e: Expense) {
  if (e.spent_on) return e.spent_on;
  const created = isoDate(new Date(e.created_at));
  return monthOf(created) === e.month_ref ? created : e.month_ref;
}

/** Mesmo dia do mês em outro mês (31 vira o último dia de um mês curto) */
function sameDayIn(day: string, m: string) {
  const [y, mo] = m.split('-').map(Number);
  const last = new Date(y, mo, 0).getDate();
  return `${m.slice(0, 7)}-${pad(Math.min(Number(day.slice(8, 10)), last))}`;
}

/** "85,80", "1.234,56" ou "30.5" → número */
function parseAmount(s: string) {
  const t = s.replace(/[^\d.,]/g, '');
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ''));
  return Number(t);
}

const norm = (s: string) => s.trim().toLowerCase();
const sameItem = (a: Expense, b: Expense) =>
  a.type === b.type && a.category === b.category && norm(a.description) === norm(b.description);

/** Id fixo da trava automática de cada mês: com o painel aberto em dois lugares, a segunda gravação falha em vez de duplicar */
const snapshotId = (m: string) => `00000000-0000-4000-8000-${m.slice(0, 4)}${m.slice(5, 7)}000000`;

function formatMonth(m: string) {
  const d = new Date(m + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function formatMonthShort(m: string) {
  const d = new Date(m + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

function formatDay(day: string) {
  const d = new Date(day + 'T00:00:00');
  const s = d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

let legacyWarned = false;
/** Grava lançamentos; se a migração da data/gasto fixo ainda não foi aplicada, grava sem esses campos */
async function saveExpenses(rows: Record<string, unknown>[], id?: string) {
  const write = (r: Record<string, unknown>[]) => {
    const table = (supabase as any).from('expenses');
    return id ? table.update(r[0]).eq('id', id) : table.insert(r);
  };
  let { error } = await write(rows);
  if (error && /spent_on|recurring/.test(error.message ?? '')) {
    ({ error } = await write(rows.map(({ spent_on, recurring, ...r }) => r)));
    if (!error && !legacyWarned) {
      legacyWarned = true;
      toast.warning('Salvo, mas sem a data e o gasto fixo', { description: 'Peça ao Lovable para aplicar a migração 20261101090000_expenses_date_recurring.' });
    }
  }
  return error as { message: string } | null;
}

const emptyForm = (m: string) => ({
  category: '', description: '', amount: 0, type: 'gasto', spent_on: defaultDay(m), recurring: false,
});

export function ExpensesPanel({ mrr, clients = [] }: { mrr: number; clients?: Client[] }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthRef());
  const [form, setForm] = useState(emptyForm(getCurrentMonthRef()));
  const [toDelete, setToDelete] = useState<Expense | null>(null);
  // Lançamento rápido
  const [quick, setQuick] = useState({ description: '', amount: '', category: '', type: 'gasto', recurring: false, spent_on: defaultDay(getCurrentMonthRef()) });
  const [quickSaving, setQuickSaving] = useState(false);
  // Lista
  const [kind, setKind] = useState<'todos' | 'gasto' | 'investimento' | 'ganho'>('todos');
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadExpenses();
  }, []);

  // Trocou de mês: o lançamento rápido passa a cair nele
  useEffect(() => setQuick(q => ({ ...q, spent_on: defaultDay(selectedMonth) })), [selectedMonth]);

  const loadExpenses = async () => {
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setExpenses(data as Expense[]);
    setLoading(false);
  };

  /** Faturamento estimado de um mês passado: contratos ativos até o fim dele */
  const estimateRevenue = (m: string) => {
    const [year, month] = m.split('-');
    const endOfMonth = new Date(Number(year), Number(month), 0, 23, 59, 59);
    return clients.reduce((sum, c) => {
      if (!c.contractStartDate) return sum;
      if (c.status === 'Cancelado') return sum;
      const start = new Date(c.contractStartDate);
      if (isNaN(start.getTime())) return sum;
      if (start <= endOfMonth) return sum + recurringValue(c);
      return sum;
    }, 0);
  };

  // Automação: Travar faturamento do mês anterior automaticamente se não existir
  useEffect(() => {
    const autoSnapshot = async () => {
      if (loading || expenses.length === 0 || clients.length === 0) return;
      const prevMonthStr = shiftMonth(getCurrentMonthRef(), -1);
      if (expenses.some(e => e.type === 'faturamento' && e.month_ref === prevMonthStr)) return;

      const faturamentoPrevMonth = estimateRevenue(prevMonthStr);
      if (faturamentoPrevMonth > 0) {
        // Id fixo do mês: se outra aba já travou, o insert falha e nada duplica
        await supabase.from('expenses').insert({
          id: snapshotId(prevMonthStr),
          type: 'faturamento',
          amount: faturamentoPrevMonth,
          category: SNAPSHOT_CATEGORY,
          description: `Fechamento Automático de ${formatMonth(prevMonthStr)}`,
          month_ref: prevMonthStr,
        });
        loadExpenses();
      }
    };

    autoSnapshot();
  }, [loading, expenses.length, clients.length]);

  const handleSave = async () => {
    if (!form.category.trim() || !form.description.trim() || form.amount <= 0) {
      toast.error('Preencha todos os campos');
      return;
    }
    setSaving(true);
    const row = {
      ...form,
      category: form.category.trim(),
      description: form.description.trim(),
      recurring: form.type !== 'faturamento' && form.recurring,
      month_ref: monthOf(form.spent_on),
    };
    const error = await saveExpenses([row], editingId ?? undefined);
    setSaving(false);
    if (error) { toast.error('Não foi possível salvar', { description: error.message }); return; }

    if (editingId) {
      toast.success('Lançamento atualizado');
    } else {
      const labels: Record<string, string> = {
        gasto: 'Gasto adicionado',
        investimento: 'Investimento adicionado',
        ganho_extra: 'Ganho extra adicionado',
        faturamento: 'Faturamento manual salvo',
      };
      toast.success(labels[form.type] || 'Lançamento adicionado');
    }
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm(selectedMonth));
    await loadExpenses();
  };

  const handleEdit = (e: Expense) => {
    setEditingId(e.id);
    setForm({
      category: e.category,
      description: e.description,
      amount: Number(e.amount),
      type: e.type,
      spent_on: dayOf(e),
      recurring: !!e.recurring,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) { toast.error('Não foi possível excluir', { description: error.message }); return; }
    toast.success('Removido');
    await loadExpenses();
  };

  // ----- Sugestões do lançamento rápido: o último lançamento com cada descrição -----
  const known = useMemo(() => {
    const map = new Map<string, Expense>();
    for (const e of expenses) {
      if (e.type === 'faturamento') continue;
      const k = norm(e.description);
      if (k && !map.has(k)) map.set(k, e); // já vem do mais novo para o mais antigo
    }
    return map;
  }, [expenses]);

  /** Categorias de um tipo: as padrão + as que você já criou */
  const categoriesFor = (type: string) => {
    if (type === 'faturamento') return [SNAPSHOT_CATEGORY];
    const base = type === 'ganho_extra' ? FREELA_CATEGORIES : EXPENSE_CATEGORIES;
    const used = expenses.filter(e => (type === 'ganho_extra' ? e.type === 'ganho_extra' : e.type === 'gasto' || e.type === 'investimento')).map(e => e.category);
    return [...new Set([...base, ...used.filter(c => c && !base.includes(c))])];
  };

  const onQuickDescription = (description: string) => {
    const hit = known.get(norm(description));
    setQuick(q => hit
      ? { ...q, description, type: hit.type, category: hit.category, recurring: !!hit.recurring, amount: q.amount || String(Number(hit.amount)).replace('.', ',') }
      : { ...q, description });
  };

  const quickAdd = async () => {
    const amount = parseAmount(quick.amount);
    if (!quick.description.trim()) { toast.error('Escreva o que foi'); return; }
    if (!(amount > 0)) { toast.error('Coloque o valor'); return; }
    if (!quick.category.trim()) { toast.error('Escolha a categoria'); return; }
    setQuickSaving(true);
    const error = await saveExpenses([{
      type: quick.type,
      category: quick.category.trim(),
      description: quick.description.trim(),
      amount,
      recurring: quick.recurring,
      spent_on: quick.spent_on,
      month_ref: monthOf(quick.spent_on),
    }]);
    setQuickSaving(false);
    if (error) { toast.error('Não foi possível lançar', { description: error.message }); return; }
    const m = monthOf(quick.spent_on);
    toast.success(`${TYPE_LABELS[quick.type]} lançado`, m !== selectedMonth ? { description: `Entrou em ${formatMonth(m)}` } : undefined);
    setQuick(q => ({ ...q, description: '', amount: '', category: '', recurring: false }));
    await loadExpenses();
  };

  // ----- Filtered (current month) -----
  const monthExpenses = expenses.filter(e => e.month_ref === selectedMonth);
  const isCurrentMonth = selectedMonth === getCurrentMonthRef();

  /** Totais de um mês (o faturamento travado manda; senão a estimativa pelos contratos) */
  const monthTotals = (m: string) => {
    const list = expenses.filter(e => e.month_ref === m);
    const sum = (t: string) => list.filter(e => e.type === t).reduce((a, e) => a + Number(e.amount), 0);
    const gastos = sum('gasto');
    const investimentos = sum('investimento');
    const ganhos = sum('ganho_extra');
    const manual = sum('faturamento');
    const faturamento = manual > 0 ? manual : m === getCurrentMonthRef() ? mrr : estimateRevenue(m);
    return { gastos, investimentos, ganhos, faturamento, lucro: faturamento + ganhos - gastos - investimentos, hasData: list.length > 0 };
  };

  const cur = monthTotals(selectedMonth);
  const prevMonth = shiftMonth(selectedMonth, -1);
  const prev = monthTotals(prevMonth);
  const totalGastos = cur.gastos;
  const totalInvestimentos = cur.investimentos;
  const totalDespesas = totalGastos + totalInvestimentos;

  // Category breakdown (despesas only)
  const categoryMap: Record<string, number> = {};
  monthExpenses.filter(e => e.type === 'gasto' || e.type === 'investimento').forEach(e => {
    categoryMap[e.category] = (categoryMap[e.category] || 0) + Number(e.amount);
  });
  const categoryData = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  // Gastos fixos do mês anterior que ainda não entraram neste
  const pendingFixed = selectedMonth <= getCurrentMonthRef()
    ? expenses.filter(e => e.recurring && e.month_ref === prevMonth && e.type !== 'faturamento' && !monthExpenses.some(m => sameItem(m, e)))
    : [];
  const [launchingFixed, setLaunchingFixed] = useState(false);

  const launchFixed = async () => {
    setLaunchingFixed(true);
    const error = await saveExpenses(pendingFixed.map(e => ({
      type: e.type,
      category: e.category,
      description: e.description,
      amount: Number(e.amount),
      recurring: true,
      spent_on: sameDayIn(dayOf(e), selectedMonth),
      month_ref: selectedMonth,
    })));
    setLaunchingFixed(false);
    if (error) { toast.error('Não foi possível lançar os fixos', { description: error.message }); return; }
    toast.success(`${pendingFixed.length} gasto${pendingFixed.length > 1 ? 's' : ''} fixo${pendingFixed.length > 1 ? 's' : ''} lançado${pendingFixed.length > 1 ? 's' : ''}`);
    await loadExpenses();
  };

  /** Para de repetir: desmarca o fixo no mês anterior */
  const stopFixed = async (e: Expense) => {
    const error = await saveExpenses([{ recurring: false }], e.id);
    if (error) { toast.error('Não foi possível alterar', { description: error.message }); return; }
    toast.success(`"${e.description}" não repete mais`);
    await loadExpenses();
  };

  // Lista: filtro por tipo, busca e agrupado por dia
  const listed = monthExpenses
    .filter(e => kind === 'todos' || (kind === 'ganho' ? e.type === 'ganho_extra' || e.type === 'faturamento' : e.type === kind))
    .filter(e => !query.trim() || `${e.description} ${e.category}`.toLowerCase().includes(norm(query)));
  const byDay = new Map<string, Expense[]>();
  for (const e of listed) byDay.set(dayOf(e), [...(byDay.get(dayOf(e)) ?? []), e]);
  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  // Available months: always show last 12 months + months with data + selected
  const monthsSet = new Set<string>(expenses.map(e => e.month_ref));
  const today = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
  }
  monthsSet.add(selectedMonth);
  const allMonths = [...monthsSet].sort((a, b) => b.localeCompare(a));

  // ----- Full report data (all months) -----
  // Fill in continuous timeline: all months with data + last 12 months window,
  // so the report is always visible even right after deletions.
  const reportRows = useMemo(() => {
    const map = new Map<string, { faturamentoManual: number; faturamento: number; gastos: number; investimentos: number; ganhos: number }>();

    // Apenas garante que o mês atual exista na linha do tempo
    const currentMonthKey = getCurrentMonthRef();
    map.set(currentMonthKey, { faturamentoManual: 0, faturamento: 0, gastos: 0, investimentos: 0, ganhos: 0 });

    expenses.forEach(e => {
      const cur = map.get(e.month_ref) || { faturamentoManual: 0, faturamento: 0, gastos: 0, investimentos: 0, ganhos: 0 };
      const v = Number(e.amount);
      if (e.type === 'gasto') cur.gastos += v;
      else if (e.type === 'investimento') cur.investimentos += v;
      else if (e.type === 'ganho_extra') cur.ganhos += v;
      else if (e.type === 'faturamento') cur.faturamentoManual += v;
      map.set(e.month_ref, cur);
    });

    for (const monthStr of map.keys()) {
      const cur = map.get(monthStr)!;
      if (cur.faturamentoManual > 0) cur.faturamento = cur.faturamentoManual;
      else cur.faturamento = monthStr === currentMonthKey ? mrr : estimateRevenue(monthStr);
      map.set(monthStr, cur);
    }

    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, v]) => ({
        month,
        ...v,
        total: v.gastos + v.investimentos,
        liquido: v.faturamento + v.ganhos - (v.gastos + v.investimentos),
      }));
  }, [expenses, clients, mrr]);

  const reportChart = [...reportRows].reverse().map(r => ({
    mes: formatMonthShort(r.month),
    Faturamento: Math.round(r.faturamento),
    Gastos: Math.round(r.gastos),
    Investimentos: Math.round(r.investimentos),
    'Ganhos Extras': Math.round(r.ganhos),
    Líquido: Math.round(r.liquido),
  }));

  const totals = reportRows.reduce(
    (acc, r) => ({
      faturamento: acc.faturamento + r.faturamento,
      gastos: acc.gastos + r.gastos,
      investimentos: acc.investimentos + r.investimentos,
      ganhos: acc.ganhos + r.ganhos,
      liquido: acc.liquido + r.liquido,
    }),
    { faturamento: 0, gastos: 0, investimentos: 0, ganhos: 0, liquido: 0 },
  );

  // Freelas only (all months)
  const freelas = expenses
    .filter(e => e.type === 'ganho_extra')
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  /** "▲ 12% vs set." — subir é bom para entradas e ruim para saídas */
  const delta = (now: number, before: number, upIsGood: boolean) => {
    if (!prev.hasData || before <= 0) return null;
    const pct = Math.round(((now - before) / before) * 100);
    if (pct === 0) return { text: `igual a ${formatMonthShort(prevMonth)}`, cls: 'text-muted-foreground' };
    const good = pct > 0 === upIsGood;
    return {
      text: `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs ${formatMonthShort(prevMonth)}`,
      cls: good ? 'text-[hsl(var(--success))]' : 'text-destructive',
    };
  };

  const typeOptions = (
    <>
      <SelectItem value="gasto">Gasto</SelectItem>
      <SelectItem value="investimento">Investimento</SelectItem>
      <SelectItem value="ganho_extra">Ganho Extra (Freela)</SelectItem>
    </>
  );

  return (
    <div className="space-y-5">
      {/* Sugestões de descrição e categorias (o campo aceita categoria nova) */}
      <datalist id="expense-descriptions">
        {[...known.values()].map(e => <option key={e.id} value={e.description}>{`${e.category} · ${formatCurrency(Number(e.amount))}`}</option>)}
      </datalist>
      {['gasto', 'ganho_extra', 'faturamento'].map(t => (
        <datalist key={t} id={`expense-cats-${t}`}>
          {categoriesFor(t).map(c => <option key={c} value={c} />)}
        </datalist>
      ))}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Wallet className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Gastos, Investimentos & Ganhos</h3>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allMonths.map(m => (
                <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingId(null);
              setForm(emptyForm(selectedMonth));
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={() => {
                setEditingId(null);
                setForm(emptyForm(selectedMonth));
              }}><Plus className="h-4 w-4 mr-1" /> Lançamento completo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Editar Lançamento' : 'Novo Lançamento'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={form.type}
                    onValueChange={v => setForm(p => ({ ...p, type: v, category: v === 'faturamento' ? SNAPSHOT_CATEGORY : '' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions}
                      <SelectItem value="faturamento">Travar Faturamento do Mês</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Input
                    list={`expense-cats-${form.type === 'investimento' ? 'gasto' : form.type}`}
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    placeholder="Escolha ou escreva uma nova"
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder={
                      form.type === 'ganho_extra'
                        ? 'Ex: Edição de vídeo para Cliente X'
                        : form.type === 'faturamento'
                        ? 'Ex: Fechamento de Maio/26'
                        : 'Ex: Assinatura Adobe Creative Cloud'
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Valor (R$)</Label>
                    <Input
                      type="number"
                      value={form.amount || ''}
                      onChange={e => setForm(p => ({ ...p, amount: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={form.spent_on}
                      onChange={e => e.target.value && setForm(p => ({ ...p, spent_on: e.target.value }))}
                    />
                  </div>
                </div>
                {form.type !== 'faturamento' && (
                  <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <Checkbox checked={form.recurring} onCheckedChange={v => setForm(p => ({ ...p, recurring: v === true }))} />
                    Repetir todo mês (gasto fixo)
                  </label>
                )}
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Adicionar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={open => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && `"${toDelete.description}" de ${formatCurrency(Number(toDelete.amount))} será apagado. Não dá para desfazer.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (toDelete) handleDelete(toDelete.id); setToDelete(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue="mes" className="space-y-5">
        <TabsList>
          <TabsTrigger value="mes" className="gap-2">
            <Wallet className="h-4 w-4" /> {isCurrentMonth ? 'Mês atual' : 'Mês'}
          </TabsTrigger>
          <TabsTrigger value="relatorio" className="gap-2">
            <FileBarChart className="h-4 w-4" /> Relatório Completo
          </TabsTrigger>
        </TabsList>

        {/* ============ ABA MÊS ATUAL ============ */}
        <TabsContent value="mes" className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {[
              { label: 'Faturamento', value: cur.faturamento, d: delta(cur.faturamento, prev.faturamento, true), icon: Wallet, accent: 'text-[hsl(var(--success))]', bg: 'bg-[hsl(var(--success))]/10' },
              { label: 'Gastos', value: totalGastos, d: delta(totalGastos, prev.gastos, false), icon: TrendingDown, accent: 'text-destructive', bg: 'bg-destructive/10' },
              { label: 'Investimentos', value: totalInvestimentos, d: delta(totalInvestimentos, prev.investimentos, false), icon: TrendingUp, accent: 'text-[hsl(var(--info))]', bg: 'bg-[hsl(var(--info))]/10' },
              { label: 'Ganhos Extras', value: cur.ganhos, d: delta(cur.ganhos, prev.ganhos, true), icon: Sparkles, accent: 'text-primary', bg: 'bg-primary/10' },
              { label: 'Lucro Estimado', value: cur.lucro, d: delta(cur.lucro, prev.lucro, true), icon: Wallet, accent: cur.lucro >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive', bg: cur.lucro >= 0 ? 'bg-[hsl(var(--success))]/10' : 'bg-destructive/10' },
            ].map((kpi, i) => (
              <motion.div key={kpi.label} {...anim(i)} className={i === 4 ? 'col-span-2 lg:col-span-1' : ''}>
                <Card className="border-border/50 h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${kpi.bg}`}>
                        <kpi.icon className={`h-3.5 w-3.5 ${kpi.accent}`} />
                      </div>
                    </div>
                    <p className="mt-2 text-xl font-bold tabular-nums text-foreground">{formatCurrency(kpi.value)}</p>
                    <p className={`mt-1 text-xs tabular-nums ${kpi.d?.cls ?? 'text-muted-foreground'}`}>{kpi.d?.text ?? ' '}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Lançamento rápido */}
          <Card className="border-border/50">
            <CardContent className="p-4">
              <form
                className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_120px_minmax(0,1.3fr)_150px_140px_auto_auto] lg:items-center"
                onSubmit={e => { e.preventDefault(); quickAdd(); }}
              >
                <Input
                  list="expense-descriptions"
                  value={quick.description}
                  onChange={e => onQuickDescription(e.target.value)}
                  placeholder="O que foi? Ex: Gasolina, Adobe, Freela de vídeo…"
                  aria-label="Descrição"
                  className="sm:col-span-2 lg:col-span-1"
                />
                <Input
                  inputMode="decimal"
                  value={quick.amount}
                  onChange={e => setQuick(q => ({ ...q, amount: e.target.value }))}
                  placeholder="R$ 0,00"
                  aria-label="Valor"
                  className="tabular-nums"
                />
                <Input
                  list={`expense-cats-${quick.type === 'investimento' ? 'gasto' : quick.type}`}
                  value={quick.category}
                  onChange={e => setQuick(q => ({ ...q, category: e.target.value }))}
                  placeholder="Categoria"
                  aria-label="Categoria"
                />
                <Select value={quick.type} onValueChange={v => setQuick(q => ({ ...q, type: v, category: '' }))}>
                  <SelectTrigger aria-label="Tipo"><SelectValue /></SelectTrigger>
                  <SelectContent>{typeOptions}</SelectContent>
                </Select>
                <Input
                  type="date"
                  value={quick.spent_on}
                  onChange={e => e.target.value && setQuick(q => ({ ...q, spent_on: e.target.value }))}
                  aria-label="Data"
                />
                <label className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground cursor-pointer" title="Repete todo mês">
                  <Checkbox checked={quick.recurring} onCheckedChange={v => setQuick(q => ({ ...q, recurring: v === true }))} />
                  Fixo
                </label>
                <Button type="submit" disabled={quickSaving}>
                  {quickSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  Lançar
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Gastos fixos que ainda não entraram neste mês */}
          {pendingFixed.length > 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Repeat className="h-4 w-4 text-primary" />
                    <span>
                      <b>{pendingFixed.length}</b> fixo{pendingFixed.length > 1 ? 's' : ''} de {formatMonth(prevMonth)} ainda não {pendingFixed.length > 1 ? 'estão' : 'está'} em {formatMonth(selectedMonth)}
                      {' · '}<span className="tabular-nums">{formatCurrency(pendingFixed.reduce((a, e) => a + Number(e.amount), 0))}</span>
                    </span>
                  </div>
                  <Button size="sm" onClick={launchFixed} disabled={launchingFixed}>
                    {launchingFixed && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Lançar {pendingFixed.length > 1 ? 'todos' : ''}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {pendingFixed.map(e => (
                    <span key={e.id} className="inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-xs text-foreground border border-border/60">
                      {e.description} <span className="tabular-nums text-muted-foreground">{formatCurrency(Number(e.amount))}</span>
                      <button
                        type="button"
                        onClick={() => stopFixed(e)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Não repetir mais"
                        aria-label={`Não repetir mais ${e.description}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-5">
            {/* Despesas por categoria: barras com valor e % */}
            <motion.div {...anim(5)} className="lg:col-span-2">
              <Card className="border-border/50 h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span className="flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" /> Despesas por Categoria</span>
                    <span className="text-sm font-semibold tabular-nums text-muted-foreground">{formatCurrency(totalDespesas)}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {categoryData.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma despesa neste mês</p>
                  ) : (
                    <div className="space-y-3">
                      {categoryData.map((c, i) => {
                        const pct = totalDespesas > 0 ? (c.value / totalDespesas) * 100 : 0;
                        return (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => setQuery(query === c.name ? '' : c.name)}
                            className={`block w-full text-left rounded-md -mx-1 px-1 py-0.5 transition-colors hover:bg-secondary/40 ${query === c.name ? 'bg-secondary/50' : ''}`}
                            title="Filtrar a lista por esta categoria"
                          >
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                              <span className="truncate text-foreground">{c.name}</span>
                              <span className="shrink-0 tabular-nums text-foreground">
                                {formatCurrency(c.value)} <span className="text-muted-foreground text-xs">{Math.round(pct)}%</span>
                              </span>
                            </div>
                            <div className="mt-1 h-2 rounded-full bg-secondary/50 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Lista */}
            <motion.div {...anim(6)} className="lg:col-span-3">
              <Card className="border-border/50 h-full">
                <CardHeader className="pb-2 space-y-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wallet className="h-4 w-4 text-primary" /> Lançamentos do Mês
                    <span className="text-sm font-normal text-muted-foreground">({monthExpenses.length})</span>
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    {([['todos', 'Todos'], ['gasto', 'Gastos'], ['investimento', 'Investimentos'], ['ganho', 'Ganhos']] as const).map(([k, label]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setKind(k)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${kind === k ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                      >
                        {label}
                      </button>
                    ))}
                    <div className="relative ml-auto w-full sm:w-48">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar" className="h-8 pl-8 text-sm" aria-label="Buscar lançamentos" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {monthExpenses.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                      <Receipt className="h-10 w-10 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">Nenhum lançamento neste mês</p>
                    </div>
                  ) : days.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">Nada encontrado com esse filtro</p>
                  ) : (
                    <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
                      {days.map(([day, items]) => {
                        const out = items.filter(e => e.type === 'gasto' || e.type === 'investimento').reduce((a, e) => a + Number(e.amount), 0);
                        return (
                          <div key={day} className="space-y-1.5">
                            <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
                              <span>{formatDay(day)}</span>
                              {out > 0 && <span className="tabular-nums">− {formatCurrency(out)}</span>}
                            </div>
                            {items.map(e => {
                              const isGanho = e.type === 'ganho_extra';
                              const isInv = e.type === 'investimento';
                              const isFat = e.type === 'faturamento';
                              return (
                                <div key={e.id} className="flex items-center justify-between rounded-lg bg-secondary/30 p-3 group">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                      isGanho || isFat ? 'bg-primary/15'
                                        : isInv ? 'bg-[hsl(var(--info))]/15'
                                        : 'bg-destructive/10'
                                    }`}>
                                      {isGanho || isFat
                                        ? <Sparkles className={`h-3.5 w-3.5 ${isFat ? 'text-[hsl(var(--success))]' : 'text-primary'}`} />
                                        : isInv
                                          ? <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--info))]" />
                                          : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-foreground truncate">{e.description}</p>
                                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        {e.category}
                                        {e.recurring && <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1 text-primary"><Repeat className="h-2.5 w-2.5" /> Fixo</span>}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className={`text-sm font-semibold tabular-nums ${
                                      isGanho ? 'text-primary' : isFat ? 'text-[hsl(var(--success))]' : 'text-foreground'
                                    }`}>
                                      {isGanho || isFat ? '+ ' : ''}{formatCurrency(Number(e.amount))}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                                      onClick={() => handleEdit(e)}
                                      aria-label="Editar"
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                      onClick={() => setToDelete(e)}
                                      aria-label="Excluir"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* ============ ABA RELATÓRIO COMPLETO ============ */}
        <TabsContent value="relatorio" className="space-y-5">
          {/* Totais gerais */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {[
              { label: 'Total Faturamento', value: formatCurrency(totals.faturamento), icon: Wallet, accent: 'text-[hsl(var(--success))]', bg: 'bg-[hsl(var(--success))]/10' },
              { label: 'Total Gastos', value: formatCurrency(totals.gastos), icon: TrendingDown, accent: 'text-destructive', bg: 'bg-destructive/10' },
              { label: 'Total Investimentos', value: formatCurrency(totals.investimentos), icon: TrendingUp, accent: 'text-[hsl(var(--info))]', bg: 'bg-[hsl(var(--info))]/10' },
              { label: 'Total Ganhos Extras', value: formatCurrency(totals.ganhos), icon: Sparkles, accent: 'text-primary', bg: 'bg-primary/10' },
              { label: 'Saldo Líquido', value: formatCurrency(totals.liquido), icon: Wallet, accent: totals.liquido >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive', bg: 'bg-secondary/30' },
            ].map((kpi, i) => (
              <Card key={kpi.label} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${kpi.bg}`}>
                      <kpi.icon className={`h-3.5 w-3.5 ${kpi.accent}`} />
                    </div>
                  </div>
                  <p className="mt-2 text-xl font-bold tabular-nums text-foreground">{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Gráfico de evolução */}
          {reportChart.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileBarChart className="h-4 w-4 text-primary" /> Evolução mensal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reportChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 3.7%, 15.9%)" />
                    <XAxis dataKey="mes" stroke="hsl(240, 5%, 64.9%)" fontSize={12} />
                    <YAxis stroke="hsl(240, 5%, 64.9%)" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 3.7%, 15.9%)', borderRadius: 8 }}
                      formatter={(v: number) => formatCurrency(Number(v))}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Faturamento" fill="hsl(142, 70%, 45%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Gastos" fill="hsl(0, 62%, 50%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Investimentos" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Ganhos Extras" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Tabela mensal */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4 text-primary" /> Resumo por mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reportRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sem dados ainda</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead className="text-right">Faturamento</TableHead>
                      <TableHead className="text-right">Gastos</TableHead>
                      <TableHead className="text-right">Investimentos</TableHead>
                      <TableHead className="text-right">Ganhos Extras</TableHead>
                      <TableHead className="text-right">Saldo Líquido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportRows.map(r => (
                      <TableRow key={r.month}>
                        <TableCell className="font-medium capitalize">{formatMonth(r.month)}</TableCell>
                        <TableCell className="text-right tabular-nums text-[hsl(var(--success))]">{formatCurrency(r.faturamento)}</TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">{formatCurrency(r.gastos)}</TableCell>
                        <TableCell className="text-right tabular-nums text-[hsl(var(--info))]">{formatCurrency(r.investimentos)}</TableCell>
                        <TableCell className="text-right tabular-nums text-primary">{formatCurrency(r.ganhos)}</TableCell>
                        <TableCell className={`text-right tabular-nums font-semibold ${r.liquido >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
                          {formatCurrency(r.liquido)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Histórico de freelas */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" /> Histórico de Ganhos Extras (Freelas)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {freelas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhum freela registrado ainda</p>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto">
                  {freelas.map(f => (
                    <div key={f.id} className="flex items-center justify-between rounded-lg bg-secondary/30 p-3 group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{f.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {f.category} • <span className="capitalize">{formatMonth(f.month_ref)}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold tabular-nums text-primary">
                          + {formatCurrency(Number(f.amount))}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                          onClick={() => handleEdit(f)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          onClick={() => setToDelete(f)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
