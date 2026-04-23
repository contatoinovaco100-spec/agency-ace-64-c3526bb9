import { useState, useMemo } from 'react';
import { Target, Plus, Trash2, TrendingUp, CheckCircle2, Circle, AlertCircle, Edit2, Activity, Clock, Trophy, Target as TargetIcon, Search, Calendar, Filter, PieChart, Info, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts';

// Types
interface Goal {
  id: string;
  title: string;
  target: number;
  current: number;
  unit: string;
  category: string;
  deadline: string;
  period: 'Diária' | 'Semanal' | 'Mensal' | 'Anual';
}

const CATEGORIES = ['Financeiro', 'Vendas', 'Leads', 'Produção', 'Equipe', 'Marketing'];
const PERIODS = ['Diária', 'Semanal', 'Mensal', 'Anual'];

const COLORS: Record<string, string> = {
  Financeiro: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  Vendas: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  Leads: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  Produção: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
  Equipe: 'text-pink-500 bg-pink-500/10 border-pink-500/20',
  Marketing: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
  default: 'text-slate-500 bg-slate-500/10 border-slate-500/20'
};

const CHART_DATA = [
  { name: 'Nov', performance: 65, metas: 2 },
  { name: 'Dez', performance: 75, metas: 3 },
  { name: 'Jan', performance: 85, metas: 4 },
  { name: 'Fev', performance: 100, metas: 5 },
  { name: 'Mar', performance: 92, metas: 4 },
  { name: 'Abr', performance: 110, metas: 6 },
];

const INITIAL_GOALS: Goal[] = [
  { id: '1', title: 'Faturamento Mensal', target: 50000, current: 35000, unit: 'R$', category: 'Financeiro', deadline: '2026-05-30', period: 'Mensal' },
  { id: '2', title: 'Fechamento de Contratos', target: 20, current: 22, unit: 'vendas', category: 'Vendas', deadline: '2026-05-15', period: 'Mensal' },
  { id: '3', title: 'Leads Qualificados', target: 100, current: 45, unit: 'leads', category: 'Leads', deadline: '2026-04-30', period: 'Semanal' },
  { id: '4', title: 'Vídeos Produzidos', target: 50, current: 20, unit: 'vídeos', category: 'Produção', deadline: '2026-04-25', period: 'Semanal' },
  { id: '5', title: 'ROAS Global', target: 3, current: 1.5, unit: 'x', category: 'Marketing', deadline: '2026-05-01', period: 'Mensal' },
];

const formatValue = (val: number, unit: string) => {
  if (unit.toLowerCase() === 'r$') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  }
  if (unit === '%') return `${val}%`;
  return `${val.toLocaleString()} ${unit}`;
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>(INITIAL_GOALS);
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  
  const [filterPeriod, setFilterPeriod] = useState<string>('Todos');
  const [filterCategory, setFilterCategory] = useState<string>('Todas');

  const [form, setForm] = useState<Partial<Goal>>({
    title: '', target: 0, current: 0, unit: 'R$', category: 'Financeiro', period: 'Mensal', deadline: new Date().toISOString().split('T')[0]
  });

  const openForm = (goal?: Goal) => {
    if (goal) {
      setEditingGoal(goal);
      setForm(goal);
    } else {
      setEditingGoal(null);
      setForm({ title: '', target: 0, current: 0, unit: 'R$', category: 'Financeiro', period: 'Mensal', deadline: new Date().toISOString().split('T')[0] });
    }
    setShowModal(true);
  };

  const saveGoal = () => {
    if (!form.title || !form.target) return;
    
    if (editingGoal) {
      setGoals(g => g.map(x => x.id === editingGoal.id ? { ...x, ...form, target: Number(form.target), current: Number(form.current || 0) } as Goal : x));
    } else {
      setGoals(g => [...g, { id: crypto.randomUUID(), ...form, target: Number(form.target), current: Number(form.current || 0) } as Goal]);
    }
    setShowModal(false);
  };

  const updateProgress = (id: string, val: number) => {
    setGoals(g => g.map(x => x.id === id ? { ...x, current: Math.max(0, val) } : x));
  };
  
  const deleteGoal = (id: string) => {
    setGoals(g => g.filter(x => x.id !== id));
  };

  const filteredGoals = useMemo(() => {
    return goals.filter(g => {
      const matchPeriod = filterPeriod === 'Todos' || g.period === filterPeriod;
      const matchCategory = filterCategory === 'Todas' || g.category === filterCategory;
      return matchPeriod && matchCategory;
    });
  }, [goals, filterPeriod, filterCategory]);

  const totalComplete = goals.filter(g => g.current >= g.target).length;
  const totalGoals = goals.length;
  const overallPerformance = totalGoals > 0 
    ? Math.round(goals.reduce((acc, g) => acc + Math.min((g.current / g.target) * 100, 100), 0) / totalGoals) 
    : 0;

  const getStatus = (current: number, target: number, deadline: string) => {
    const pct = current / target;
    if (pct >= 1) return { color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', barColor: 'bg-emerald-500', msg: 'Meta Alcançada!', id: 'done', icon: Trophy, animation: 'animate-bounce' };
    
    const today = new Date();
    const dDate = new Date(deadline);
    const msLeft = dDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) return { color: 'text-rose-500 bg-rose-500/10 border-rose-500/20', barColor: 'bg-rose-500', msg: 'Atrasada', id: 'late', icon: AlertCircle, animation: '' };
    if (daysLeft <= 3 && pct < 0.8) return { color: 'text-orange-500 bg-orange-500/10 border-orange-500/20', barColor: 'bg-orange-500', msg: 'Atenção (prazo curto)', id: 'warning', icon: Clock, animation: 'animate-pulse' };
    
    if (pct >= 0.5) return { color: 'text-blue-500 bg-blue-500/10 border-blue-500/20', barColor: 'bg-blue-500', msg: 'Em progresso', id: 'ok', icon: Activity, animation: '' };
    return { color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', barColor: 'bg-amber-500', msg: 'Requer atenção', id: 'slow', icon: TrendingUp, animation: '' };
  };

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <TargetIcon className="h-8 w-8 text-primary" />
            Acompanhamento de Metas
          </h1>
          <p className="text-muted-foreground mt-1.5 flex items-center gap-2">
            Acompanhe o desempenho e alcance seus objetivos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => openForm()} size="lg" className="shadow-lg shadow-primary/20 transition-all hover:scale-105">
            <Plus className="h-5 w-5 mr-2" /> Nova Meta
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-border/50 shadow-sm hover:shadow-md transition-all overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <TargetIcon className="h-24 w-24" />
            </div>
            <CardHeader className="pb-2">
              <CardDescription className="font-medium">Total de Metas</CardDescription>
              <CardTitle className="text-4xl flex items-baseline gap-2">
                {totalGoals} <span className="text-sm font-normal text-muted-foreground">ativas</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" /> Em {CATEGORIES.length} categorias diferentes
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-border/50 shadow-sm hover:shadow-md transition-all overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Trophy className="h-24 w-24 text-emerald-500" />
            </div>
            <CardHeader className="pb-2">
              <CardDescription className="font-medium text-emerald-600 dark:text-emerald-400">Metas Concluídas</CardDescription>
              <CardTitle className="text-4xl text-emerald-600 dark:text-emerald-400">
                {totalComplete}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={(totalComplete / (totalGoals || 1)) * 100} className="h-1.5 bg-emerald-100 dark:bg-emerald-950" indicatorClassName="bg-emerald-500" />
              <p className="text-sm text-muted-foreground mt-2">
                {Math.round((totalComplete / (totalGoals || 1)) * 100)}% de taxa de conclusão
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-border/50 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardDescription className="font-medium text-primary">Performance Geral</CardDescription>
              <CardTitle className="text-4xl text-primary flex items-center gap-2">
                {overallPerformance}% 
                {overallPerformance > 80 && <Sparkles className="h-6 w-6 text-yellow-400 animate-pulse" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-20 -mx-4 -mb-4 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={CHART_DATA}>
                  <defs>
                    <linearGradient id="colorPerf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                  />
                  <Area type="monotone" dataKey="performance" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorPerf)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters & Control */}
      <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-xl border border-border/50 shadow-sm">
        <div className="flex items-center gap-2 mr-auto">
          <PieChart className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold text-lg">Painel de Metas</h2>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Select value={filterPeriod} onValueChange={setFilterPeriod}>
            <SelectTrigger className="w-[140px] bg-background">
              <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /><SelectValue placeholder="Período" /></div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos os Prazos</SelectItem>
              {PERIODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[140px] bg-background">
              <div className="flex items-center gap-2"><Filter className="h-4 w-4" /><SelectValue placeholder="Categoria" /></div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todas">Todas as Áreas</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {filteredGoals.map((goal, i) => {
            const pct = Math.min((goal.current / goal.target) * 100, 100);
            const status = getStatus(goal.current, goal.target, goal.deadline);
            const StatusIcon = status.icon;
            const isDone = goal.current >= goal.target;

            return (
              <motion.div 
                key={goal.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                transition={{ delay: i * 0.05 }}
              >
                <div className={cn(
                  'relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm hover:shadow-md transition-all group hover:-translate-y-1 block',
                  isDone ? 'border-emerald-500/30' : 'border-border/50'
                )}>
                  {isDone && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full -z-0 opacity-50 pointer-events-none" />
                  )}
                  
                  {/* Card Header */}
                  <div className="flex items-start justify-between relative z-10 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('p-2.5 rounded-xl border', COLORS[goal.category] || COLORS['default'])}>
                        <TargetIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground text-lg leading-tight">{goal.title}</h3>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider">{goal.period}</Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {new Date(goal.deadline).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openForm(goal)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteGoal(goal.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Insight Message */}
                  <div className={cn("text-xs font-medium px-3 py-1.5 rounded-lg mb-4 flex items-center gap-2 w-fit border", status.color)}>
                    <StatusIcon className={cn("h-3.5 w-3.5", status.animation)} />
                    {isDone ? '✨ Objetivo superado!' : `Faltam ${formatValue(goal.target - goal.current, goal.unit)}`}
                  </div>

                  {/* Progress Area */}
                  <div className="space-y-2 relative z-10">
                    <div className="flex justify-between items-end mb-1">
                      <div className="text-sm">
                        <span className="text-muted-foreground mr-1">Progresso:</span>
                        <span className="font-bold text-foreground text-base">
                          {formatValue(goal.current, goal.unit)}
                        </span>
                        <span className="text-muted-foreground mx-1">/</span>
                        <span className="text-muted-foreground text-sm">{formatValue(goal.target, goal.unit)}</span>
                      </div>
                      <span className={cn('font-bold text-lg leading-none', isDone ? 'text-emerald-500' : 'text-foreground')}>
                        {Math.round(pct)}%
                      </span>
                    </div>
                    
                    <div className="relative pt-1">
                      <Progress 
                        value={pct} 
                        className={cn("h-2.5 bg-secondary/50 overflow-hidden", isDone && "shadow-[0_0_10px_rgba(16,185,129,0.3)]")} 
                        indicatorClassName={cn("transition-all duration-1000", status.barColor)} 
                      />
                    </div>
                  </div>

                  {/* Quick Action */}
                  <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between relative z-10">
                    <span className="text-xs text-muted-foreground font-medium">Atualizar valor:</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={goal.current}
                        onChange={e => updateProgress(goal.id, Number(e.target.value))}
                        className="w-24 h-8 text-sm font-medium bg-background border-border shadow-sm focus-visible:ring-primary/50"
                        min={0}
                        step={goal.target > 1000 ? 100 : 1}
                      />
                    </div>
                  </div>
                  
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {filteredGoals.length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-center opacity-50">
            <TargetIcon className="h-16 w-16 mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Nenhuma meta encontrada</h3>
            <p className="text-sm">Ajuste os filtros ou crie uma nova meta.</p>
          </div>
        )}
      </div>

      {/* Goal Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-card border-border sm:max-w-[500px] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              {editingGoal ? <Edit2 className="h-5 w-5 text-primary"/> : <Plus className="h-5 w-5 text-primary"/>}
              {editingGoal ? 'Editar Meta' : 'Criar Nova Meta'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">O que você quer alcançar?</Label>
              <Input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Faturamento Mensal de R$ 50k" className="h-11" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Valor Alvo</Label>
                <Input type="number" value={form.target || ''} onChange={e => setForm(f=>({...f,target:Number(e.target.value)}))} placeholder="Ex: 50000" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Valor Atual</Label>
                <Input type="number" value={form.current || ''} onChange={e => setForm(f=>({...f,current:Number(e.target.value)}))} placeholder="Ex: 0" className="h-11" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Unidade de Medida</Label>
                <Input value={form.unit} onChange={e => setForm(f=>({...f,unit:e.target.value}))} placeholder="Ex: R$, unidades, %" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Prazo Limite</Label>
                <Input type="date" value={form.deadline} onChange={e => setForm(f=>({...f,deadline:e.target.value}))} className="h-11" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Categoria</Label>
                <Select value={form.category} onValueChange={v => setForm(f=>({...f,category:v}))}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Frequência</Label>
                <Select value={form.period} onValueChange={(v:any) => setForm(f=>({...f,period:v}))}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{PERIODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="ghost" onClick={() => setShowModal(false)} className="mr-auto">Cancelar</Button>
            <Button onClick={saveGoal} size="lg" className="w-32">
              {editingGoal ? 'Salvar' : 'Criar Meta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
