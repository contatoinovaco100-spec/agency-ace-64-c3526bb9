import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Plus, Trash2, TrendingDown, TrendingUp, Wallet, Receipt, Loader2,
  Sparkles, FileBarChart, Edit2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { toast } from 'sonner';
import { Client } from '@/types/agency';

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  type: string; // 'gasto' | 'investimento' | 'ganho_extra' | 'faturamento'
  month_ref: string;
  created_at: string;
}

const EXPENSE_CATEGORIES = [
  'Ferramentas/Software',
  'Tráfego Pago',
  'Salários/Freelancers',
  'Infraestrutura',
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

const CHART_COLORS = [
  'hsl(73, 93%, 55%)',
  'hsl(142, 70%, 45%)',
  'hsl(217, 91%, 60%)',
  'hsl(38, 92%, 50%)',
  'hsl(340, 75%, 55%)',
  'hsl(180, 60%, 45%)',
  'hsl(0, 62%, 50%)',
  'hsl(280, 50%, 60%)',
];

const anim = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.04, duration: 0.35 },
});

function formatCurrency(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function getCurrentMonthRef() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatMonth(m: string) {
  const d = new Date(m + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function formatMonthShort(m: string) {
  const d = new Date(m + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

export function ExpensesPanel({ mrr, clients = [] }: { mrr: number; clients?: Client[] }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthRef());
  const [form, setForm] = useState({
    category: '',
    description: '',
    amount: 0,
    type: 'gasto',
  });

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setExpenses(data as Expense[]);
    setLoading(false);
  };

  // Automação: Travar faturamento do mês anterior automaticamente se não existir
  useEffect(() => {
    const autoSnapshot = async () => {
      if (loading || expenses.length === 0 || clients.length === 0) return;
      
      const today = new Date();
      // O mês anterior
      const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-01`;
      
      const hasSnapshot = expenses.some(e => e.type === 'faturamento' && e.month_ref === prevMonthStr);
      
      if (!hasSnapshot) {
        // Calcula o faturamento daquele mês
        const [year, month] = prevMonthStr.split('-');
        const endOfPrevMonth = new Date(Number(year), Number(month), 0, 23, 59, 59);
        const faturamentoPrevMonth = clients.reduce((sum, c) => {
          if (!c.contractStartDate) return sum;
          if (c.status === 'Cancelado') return sum;
          const start = new Date(c.contractStartDate);
          if (isNaN(start.getTime())) return sum;
          if (start <= endOfPrevMonth) return sum + (c.monthlyValue || 0);
          return sum;
        }, 0);

        if (faturamentoPrevMonth > 0) {
          await supabase.from('expenses').insert({
             type: 'faturamento',
             amount: faturamentoPrevMonth,
             category: 'Faturamento Mensal (Trava)',
             description: `Fechamento Automático de ${formatMonth(prevMonthStr)}`,
             month_ref: prevMonthStr
          });
          loadExpenses();
        }
      }
    };

    autoSnapshot();
  }, [loading, expenses.length, clients.length]);

  const handleSave = async () => {
    if (!form.category || !form.description.trim() || form.amount <= 0) {
      toast.error('Preencha todos os campos');
      return;
    }
    setSaving(true);
    
    if (editingId) {
      await supabase.from('expenses').update({
        ...form,
        month_ref: selectedMonth,
      }).eq('id', editingId);
      toast.success('Lançamento atualizado');
    } else {
      await supabase.from('expenses').insert({
        ...form,
        month_ref: selectedMonth,
      });
      const labels: Record<string, string> = {
        gasto: 'Gasto adicionado',
        investimento: 'Investimento adicionado',
        ganho_extra: 'Ganho extra adicionado',
        faturamento: 'Faturamento manual salvo',
      };
      toast.success(labels[form.type] || 'Lançamento adicionado');
    }
    
    setSaving(false);
    setDialogOpen(false);
    setEditingId(null);
    setForm({ category: '', description: '', amount: 0, type: 'gasto' });
    await loadExpenses();
  };

  const handleEdit = (e: Expense) => {
    setEditingId(e.id);
    setForm({
      category: e.category,
      description: e.description,
      amount: Number(e.amount),
      type: e.type,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('expenses').delete().eq('id', id);
    toast.success('Removido');
    await loadExpenses();
  };

  // ----- Filtered (current month) -----
  const monthExpenses = expenses.filter(e => e.month_ref === selectedMonth);
  const totalGastos = monthExpenses.filter(e => e.type === 'gasto').reduce((a, e) => a + Number(e.amount), 0);
  const totalInvestimentos = monthExpenses.filter(e => e.type === 'investimento').reduce((a, e) => a + Number(e.amount), 0);
  const totalGanhosExtras = monthExpenses.filter(e => e.type === 'ganho_extra').reduce((a, e) => a + Number(e.amount), 0);
  const totalDespesas = totalGastos + totalInvestimentos;
  // O Faturamento Manual no mês atual substitui o dinâmico (MRR) se existir.
  const faturamentoManualAtual = monthExpenses.filter(e => e.type === 'faturamento').reduce((a, e) => a + Number(e.amount), 0);
  const faturamentoAtivo = faturamentoManualAtual > 0 ? faturamentoManualAtual : mrr;
  const lucro = faturamentoAtivo + totalGanhosExtras - totalDespesas;

  // Category breakdown (despesas only)
  const categoryMap: Record<string, number> = {};
  monthExpenses.filter(e => e.type === 'gasto' || e.type === 'investimento').forEach(e => {
    categoryMap[e.category] = (categoryMap[e.category] || 0) + Number(e.amount);
  });
  const categoryData = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: Math.round(value) }));

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
    const map = new Map<string, { faturamento: number; gastos: number; investimentos: number; ganhos: number }>();

    // Apenas garante que o mês atual exista na linha do tempo
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
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
      
      if (cur.faturamentoManual > 0) {
        cur.faturamento = cur.faturamentoManual;
      } else {
        const [year, month] = monthStr.split('-');
        const endOfMonth = new Date(Number(year), Number(month), 0, 23, 59, 59);
        const faturamento = clients.reduce((sum, c) => {
          if (!c.contractStartDate) return sum;
          if (c.status === 'Cancelado') return sum;
          const start = new Date(c.contractStartDate);
          if (isNaN(start.getTime())) return sum;
          if (start <= endOfMonth) return sum + (c.monthlyValue || 0);
          return sum;
        }, 0);
        cur.faturamento = faturamento;
      }
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
  }, [expenses, clients]);

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

  const formCategoriesByType =
    form.type === 'ganho_extra' ? FREELA_CATEGORIES : form.type === 'faturamento' ? ['Faturamento Mensal (Trava)'] : EXPENSE_CATEGORIES;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
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
              setForm({ category: '', description: '', amount: 0, type: 'gasto' });
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => {
                setEditingId(null);
                setForm({ category: '', description: '', amount: 0, type: 'gasto' });
              }}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
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
                    onValueChange={v => setForm(p => ({ ...p, type: v, category: '' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gasto">Gasto</SelectItem>
                      <SelectItem value="investimento">Investimento</SelectItem>
                      <SelectItem value="ganho_extra">Ganho Extra (Freela)</SelectItem>
                      <SelectItem value="faturamento">Travar Faturamento do Mês</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {formCategoriesByType.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <div>
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    value={form.amount || ''}
                    onChange={e => setForm(p => ({ ...p, amount: Number(e.target.value) }))}
                  />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Adicionar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="mes" className="space-y-5">
        <TabsList>
          <TabsTrigger value="mes" className="gap-2">
            <Wallet className="h-4 w-4" /> Mês atual
          </TabsTrigger>
          <TabsTrigger value="relatorio" className="gap-2">
            <FileBarChart className="h-4 w-4" /> Relatório Completo
          </TabsTrigger>
        </TabsList>

        {/* ============ ABA MÊS ATUAL ============ */}
        <TabsContent value="mes" className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            {[
              { label: 'Faturamento', value: formatCurrency(faturamentoAtivo), icon: Wallet, accent: 'text-[hsl(var(--success))]', bg: 'bg-[hsl(var(--success))]/10' },
              { label: 'Gastos', value: formatCurrency(totalGastos), icon: TrendingDown, accent: 'text-destructive', bg: 'bg-destructive/10' },
              { label: 'Investimentos', value: formatCurrency(totalInvestimentos), icon: TrendingUp, accent: 'text-[hsl(var(--info))]', bg: 'bg-[hsl(var(--info))]/10' },
              { label: 'Ganhos Extras', value: formatCurrency(totalGanhosExtras), icon: Sparkles, accent: 'text-primary', bg: 'bg-primary/10' },
              { label: 'Total Despesas', value: formatCurrency(totalDespesas), icon: Receipt, accent: 'text-[hsl(var(--warning))]', bg: 'bg-[hsl(var(--warning))]/10' },
              { label: 'Lucro Estimado', value: formatCurrency(lucro), icon: Wallet, accent: lucro >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive', bg: lucro >= 0 ? 'bg-[hsl(var(--success))]/10' : 'bg-destructive/10' },
            ].map((kpi, i) => (
              <motion.div key={kpi.label} {...anim(i)}>
                <Card className="border-border/50">
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
              </motion.div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {categoryData.length > 0 && (
              <motion.div {...anim(5)}>
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Receipt className="h-4 w-4 text-primary" /> Despesas por Categoria
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <RechartsPie>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name }) => name}
                        >
                          {categoryData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 3.7%, 15.9%)', borderRadius: 8 }}
                          formatter={(v: number) => [formatCurrency(v), 'Valor']}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Lista */}
            <motion.div {...anim(6)}>
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wallet className="h-4 w-4 text-primary" /> Lançamentos do Mês
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {monthExpenses.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                      <Receipt className="h-10 w-10 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">Nenhum lançamento neste mês</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[280px] overflow-y-auto">
                      {monthExpenses.map(e => {
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
                                <p className="text-xs text-muted-foreground">{e.category}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-sm font-semibold tabular-nums ${
                                isGanho ? 'text-primary' : isFat ? 'text-[hsl(var(--success))]' : 'text-foreground'
                              }`}>
                                {isGanho || isFat ? '+ ' : ''}{formatCurrency(Number(e.amount))}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                                onClick={() => handleEdit(e)}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(e.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
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
                    <Bar dataKey="Ganhos Extras" fill="hsl(73, 93%, 55%)" radius={[4, 4, 0, 0]} />
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
                          onClick={() => handleDelete(f.id)}
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
