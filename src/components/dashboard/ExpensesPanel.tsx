import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Trash2, TrendingDown, TrendingUp, Wallet, Receipt, Loader2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, Legend,
} from 'recharts';
import { toast } from 'sonner';

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  type: string;
  month_ref: string;
  created_at: string;
}

const CATEGORIES = [
  'Ferramentas/Software',
  'Tráfego Pago',
  'Salários/Freelancers',
  'Infraestrutura',
  'Marketing',
  'Impostos',
  'Equipamentos',
  'Outros',
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

export function ExpensesPanel({ mrr }: { mrr: number }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const handleSave = async () => {
    if (!form.category || !form.description.trim() || form.amount <= 0) {
      toast.error('Preencha todos os campos');
      return;
    }
    setSaving(true);
    await supabase.from('expenses').insert({
      ...form,
      month_ref: selectedMonth,
    });
    toast.success(form.type === 'gasto' ? 'Gasto adicionado' : 'Investimento adicionado');
    setSaving(false);
    setDialogOpen(false);
    setForm({ category: '', description: '', amount: 0, type: 'gasto' });
    await loadExpenses();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('expenses').delete().eq('id', id);
    toast.success('Removido');
    await loadExpenses();
  };

  // Filter by selected month
  const monthExpenses = expenses.filter(e => e.month_ref === selectedMonth);
  const totalGastos = monthExpenses.filter(e => e.type === 'gasto').reduce((a, e) => a + Number(e.amount), 0);
  const totalInvestimentos = monthExpenses.filter(e => e.type === 'investimento').reduce((a, e) => a + Number(e.amount), 0);
  const totalDespesas = totalGastos + totalInvestimentos;
  const lucro = mrr - totalDespesas;

  // Category breakdown
  const categoryMap: Record<string, number> = {};
  monthExpenses.forEach(e => {
    categoryMap[e.category] = (categoryMap[e.category] || 0) + Number(e.amount);
  });
  const categoryData = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: Math.round(value) }));

  // Available months: always show last 12 months + any month with expenses + selected month
  const monthsSet = new Set<string>(expenses.map(e => e.month_ref));
  const today = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
  }
  monthsSet.add(selectedMonth);
  const allMonths = [...monthsSet].sort((a, b) => b.localeCompare(a));

  const formatMonth = (m: string) => {
    const d = new Date(m + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header with month selector and add button */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Wallet className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Gastos & Investimentos</h3>
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Gasto / Investimento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gasto">Gasto</SelectItem>
                      <SelectItem value="investimento">Investimento</SelectItem>
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
                      {CATEGORIES.map(c => (
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
                    placeholder="Ex: Assinatura Adobe Creative Cloud"
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
                  {saving ? 'Salvando...' : 'Adicionar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Gastos', value: formatCurrency(totalGastos), icon: TrendingDown, accent: 'text-destructive', bg: 'bg-destructive/10' },
          { label: 'Investimentos', value: formatCurrency(totalInvestimentos), icon: TrendingUp, accent: 'text-[hsl(var(--info))]', bg: 'bg-[hsl(var(--info))]/10' },
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

      {/* Charts + List */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Category Pie */}
        {categoryData.length > 0 && (
          <motion.div {...anim(4)}>
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

        {/* Items List */}
        <motion.div {...anim(5)}>
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
                  {monthExpenses.map(e => (
                    <div key={e.id} className="flex items-center justify-between rounded-lg bg-secondary/30 p-3 group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${e.type === 'investimento' ? 'bg-[hsl(var(--info))]/15' : 'bg-destructive/10'}`}>
                          {e.type === 'investimento'
                            ? <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--info))]" />
                            : <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{e.description}</p>
                          <p className="text-xs text-muted-foreground">{e.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {formatCurrency(Number(e.amount))}
                        </span>
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
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
