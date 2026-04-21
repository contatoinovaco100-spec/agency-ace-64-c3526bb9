import { useAgency } from '@/contexts/AgencyContext';
import { useModuleAccess } from '@/hooks/useUserRole';
import { ExpensesPanel } from '@/components/dashboard/ExpensesPanel';
import { SmartAlerts } from '@/components/dashboard/SmartAlerts';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  Users, DollarSign, Target, CheckSquare, FolderOpen,
  TrendingUp, PieChart, BarChart3, ArrowUpRight, ArrowDownRight,
  Clock, AlertTriangle, CheckCircle2, Briefcase, FileText, BellRing,
  EyeOff, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotification } from '@/hooks/usePushNotification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';

const statusColors: Record<string, string> = {
  'Ativo': 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]',
  'Pausado': 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]',
  'Cancelado': 'bg-destructive/10 text-destructive',
};

const CHART_COLORS = [
  'hsl(73, 93%, 55%)',    // verde limão (primary)
  'hsl(174, 98%, 19%)',   // verde escuro
  'hsl(38, 92%, 50%)',    // warning/amber
  'hsl(217, 91%, 60%)',   // info/blue
  'hsl(338, 78%, 12%)',   // vinho
  'hsl(180, 60%, 45%)',   // teal
];

const anim = (i: number) => ({ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.04, duration: 0.35 } });

function formatCurrency(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

export default function Dashboard() {
  const { clients, tasks, leads } = useAgency();
  const { isAdmin } = useModuleAccess();
  const { triggerNotification, requestPermission } = usePushNotification();

  const [alertsHidden, setAlertsHidden] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('dashboard.smartAlertsHidden') === '1';
  });
  const toggleAlerts = () => {
    setAlertsHidden(prev => {
      const next = !prev;
      try { localStorage.setItem('dashboard.smartAlertsHidden', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  const activeClients = clients.filter(c => c.status === 'Ativo');
  const pausedClients = clients.filter(c => c.status === 'Pausado');
  const mrr = activeClients.reduce((acc, c) => acc + c.monthlyValue, 0);
  const pendingTasks = tasks.filter(t => !['Concluído', 'Finalizado'].includes(t.status));
  const completedTasks = tasks.filter(t => ['Concluído', 'Finalizado'].includes(t.status));

  // If not admin, show simplified dashboard
  if (!isAdmin) {
    return <SimpleDashboard clients={clients} tasks={tasks} leads={leads} mrr={mrr} activeClients={activeClients} pendingTasks={pendingTasks} />;
  }

  // --- Admin Dashboard ---

  // Financial data
  const revenueByClient = activeClients
    .sort((a, b) => b.monthlyValue - a.monthlyValue)
    .map(c => ({ name: c.companyName.length > 15 ? c.companyName.slice(0, 15) + '…' : c.companyName, valor: c.monthlyValue }));

  // Revenue by service
  const serviceRevenue: Record<string, number> = {};
  activeClients.forEach(c => {
    const perService = c.monthlyValue / (c.serviceType.length || 1);
    c.serviceType.forEach(s => { serviceRevenue[s] = (serviceRevenue[s] || 0) + perService; });
  });
  const serviceRevenueData = Object.entries(serviceRevenue)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: Math.round(value) }));

  // Client status distribution
  const clientStatusData = [
    { name: 'Ativos', value: activeClients.length, color: CHART_COLORS[1] },
    { name: 'Pausados', value: pausedClients.length, color: CHART_COLORS[3] },
    { name: 'Cancelados', value: clients.filter(c => c.status === 'Cancelado').length, color: 'hsl(0, 62%, 50%)' },
  ].filter(d => d.value > 0);

  // Task status distribution
  const taskStatusMap: Record<string, number> = {};
  tasks.forEach(t => { taskStatusMap[t.status] = (taskStatusMap[t.status] || 0) + 1; });
  const taskStatusData = Object.entries(taskStatusMap).map(([name, value], i) => ({
    name, value, color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  // Overdue tasks
  const today = new Date().toISOString().split('T')[0];
  const overdueTasks = pendingTasks.filter(t => t.dueDate && t.dueDate < today);

  // Completion rate
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  // Revenue simulated monthly trend (last 6 months based on current MRR)
  const months = ['Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar'];
  const revenueHistory = months.map((m, i) => ({
    month: m,
    receita: Math.round(mrr * (0.7 + (i * 0.06) + Math.random() * 0.05)),
  }));
  // Make the last one the actual MRR
  revenueHistory[revenueHistory.length - 1].receita = mrr;

  // Revenue history (last 12 months) — based on real contract_start_date.
  // For each month, sum monthlyValue of clients whose contract started on/before
  // the end of that month and that aren't cancelled.
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const now = new Date();
  const revenueHistory = Array.from({ length: 12 }, (_, idx) => {
    const i = 11 - idx; // from 11 months ago to current
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const endOfMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59);
    const total = clients.reduce((sum, c) => {
      if (!c.contractStartDate) return sum;
      if (c.status === 'Cancelado') return sum;
      const start = new Date(c.contractStartDate);
      if (isNaN(start.getTime())) return sum;
      if (start <= endOfMonth) return sum + (c.monthlyValue || 0);
      return sum;
    }, 0);
    const label = ref.getMonth() === 0 || idx === 0
      ? `${monthNames[ref.getMonth()]}/${String(ref.getFullYear()).slice(2)}`
      : monthNames[ref.getMonth()];
    return { month: label, receita: Math.round(total) };
  });

  // New clients (recent - last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newClients = clients.filter(c => {
    if (!c.contractStartDate) return false;
    return new Date(c.contractStartDate) >= thirtyDaysAgo;
  });

  return (
    <div className="space-y-6 relative">
      {/* Futuristic ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/[0.07] blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[400px] w-[400px] rounded-full bg-[hsl(174,98%,19%)]/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[350px] w-[350px] rounded-full bg-[hsl(var(--info))]/10 blur-[100px]" />
      </div>

      {/* Smart Alerts */}
      <SmartAlerts />

      {/* Header — Futuristic */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-card/40 p-6 backdrop-blur-xl"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(73,93%,55%,0.08),_transparent_60%)]" />
        <div className="absolute -top-px left-10 right-10 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/30">
              <BarChart3 className="h-6 w-6 text-primary" />
              <div className="absolute inset-0 rounded-xl bg-primary/20 blur-lg" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">Live · Painel Admin</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mt-0.5 tracking-tight">
                Visão <span className="text-primary">Estratégica</span>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Financeiro, entregas e performance da agência em tempo real
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => requestPermission()}
              className="hidden sm:flex gap-2 border-border/50 backdrop-blur"
            >
              Habilitar Push
            </Button>
            <Button
              size="sm"
              onClick={() => triggerNotification("Nova Venda Realizada! 🎉", "O cliente fechou o contrato de R$ 5.000,00.", "success", "sale")}
              className="gap-2 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white shadow-[0_0_20px_hsl(var(--success)/0.3)]"
            >
              <BellRing className="h-4 w-4" /> Venda
            </Button>
            <Button
              size="sm"
              onClick={() => triggerNotification("Reunião em 10 minutos 📅", "Alinhamento com Cliente X.", "info", "agenda")}
              className="gap-2 shadow-[0_0_20px_hsl(73,93%,55%/0.25)]"
            >
              <BellRing className="h-4 w-4" /> Agenda
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => triggerNotification("Tarefa Atrasada 🚨", "A entrega da Landing Page está atrasada.", "error", "overdue")}
              className="gap-2"
            >
              <AlertTriangle className="h-4 w-4" /> Atraso
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="financeiro" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-none sm:inline-flex bg-card/60 backdrop-blur-xl border border-border/50 p-1">
          <TabsTrigger value="financeiro" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_15px_hsl(73,93%,55%/0.2)]">
            <DollarSign className="h-4 w-4" /> Financeiro
          </TabsTrigger>
          <TabsTrigger value="entregas" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_15px_hsl(73,93%,55%/0.2)]">
            <CheckSquare className="h-4 w-4" /> Entregas
          </TabsTrigger>
        </TabsList>

        {/* ==================== FINANCIAL TAB ==================== */}
        <TabsContent value="financeiro" className="space-y-6">
          {/* Top KPIs — Futuristic */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'MRR', value: formatCurrency(mrr), icon: DollarSign, accent: 'text-[hsl(var(--success))]', bg: 'bg-[hsl(var(--success))]/10', glow: 'hsl(var(--success))', ring: 'ring-[hsl(var(--success))]/30' },
              { label: 'Receita Anual Projetada', value: formatCurrency(mrr * 12), icon: TrendingUp, accent: 'text-primary', bg: 'bg-primary/10', glow: 'hsl(73,93%,55%)', ring: 'ring-primary/30' },
              { label: 'Clientes Ativos', value: activeClients.length.toString(), icon: Users, accent: 'text-[hsl(var(--info))]', bg: 'bg-[hsl(var(--info))]/10', glow: 'hsl(var(--info))', ring: 'ring-[hsl(var(--info))]/30' },
              { label: 'Ticket Médio', value: formatCurrency(activeClients.length > 0 ? mrr / activeClients.length : 0), icon: BarChart3, accent: 'text-[hsl(var(--warning))]', bg: 'bg-[hsl(var(--warning))]/10', glow: 'hsl(var(--warning))', ring: 'ring-[hsl(var(--warning))]/30' },
            ].map((kpi, i) => (
              <motion.div key={kpi.label} {...anim(i)}>
                <Card className="group relative overflow-hidden border-border/50 bg-gradient-to-br from-card via-card to-card/30 backdrop-blur-xl transition-all duration-300 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-5px_hsl(73,93%,55%/0.15)]">
                  <div
                    className="absolute -top-12 -right-12 h-32 w-32 rounded-full blur-2xl opacity-20 transition-opacity duration-500 group-hover:opacity-40"
                    style={{ background: kpi.glow }}
                  />
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <CardContent className="relative p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">{kpi.label}</span>
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${kpi.bg} ring-1 ${kpi.ring} backdrop-blur`}>
                        <kpi.icon className={`h-4 w-4 ${kpi.accent}`} />
                      </div>
                    </div>
                    <p className="mt-4 text-2xl sm:text-3xl font-bold tabular-nums text-foreground tracking-tight">{kpi.value}</p>
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                      <span className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                      <span>Atualizado agora</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Revenue Trend */}
            <motion.div {...anim(4)} className="lg:col-span-2">
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4 text-primary" /> Evolução de Receita
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={revenueHistory}>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(73, 93%, 55%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(73, 93%, 55%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 3.7%, 15.9%)" />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(240, 5%, 64.9%)', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'hsl(240, 5%, 64.9%)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ background: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 3.7%, 15.9%)', borderRadius: 8, fontSize: 13 }}
                        labelStyle={{ color: 'hsl(0, 0%, 98%)' }}
                        formatter={(v: number) => [formatCurrency(v), 'Receita']}
                      />
                      <Area type="monotone" dataKey="receita" stroke="hsl(73, 93%, 55%)" strokeWidth={2.5} fill="url(#revenueGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Client Status Pie */}
            <motion.div {...anim(5)}>
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PieChart className="h-4 w-4 text-primary" /> Status dos Clientes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <RechartsPie>
                      <Pie data={clientStatusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                        {clientStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 3.7%, 15.9%)', borderRadius: 8 }} />
                    </RechartsPie>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Revenue by Client & by Service */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Revenue by Client */}
            <motion.div {...anim(6)}>
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-4 w-4 text-primary" /> Receita por Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={revenueByClient} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 3.7%, 15.9%)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'hsl(240, 5%, 64.9%)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                      <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(240, 5%, 64.9%)', fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                      <Tooltip contentStyle={{ background: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 3.7%, 15.9%)', borderRadius: 8 }} formatter={(v: number) => [formatCurrency(v), 'Valor']} />
                      <Bar dataKey="valor" fill="hsl(73, 93%, 55%)" radius={[0, 6, 6, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Revenue by Service */}
            <motion.div {...anim(7)}>
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Briefcase className="h-4 w-4 text-primary" /> Receita por Serviço
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <RechartsPie>
                      <Pie data={serviceRevenueData} cx="50%" cy="50%" outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}`}>
                        {serviceRevenueData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 3.7%, 15.9%)', borderRadius: 8 }} formatter={(v: number) => [formatCurrency(v), 'Receita']} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </RechartsPie>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Recent / New Clients */}
          {newClients.length > 0 && (
            <motion.div {...anim(8)}>
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ArrowUpRight className="h-4 w-4 text-[hsl(var(--success))]" /> Novos Clientes (últimos 30 dias)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {newClients.map(c => (
                      <div key={c.id} className="flex items-center justify-between rounded-lg bg-secondary/30 p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--success))]/15 font-bold text-[hsl(var(--success))]">
                            {c.companyName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{c.companyName}</p>
                            <p className="text-xs text-muted-foreground">{c.scope || c.serviceType.join(', ')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold tabular-nums text-[hsl(var(--success))]">{formatCurrency(c.monthlyValue)}</p>
                          <p className="text-xs text-muted-foreground">/mês</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* All Clients Table */}
          <motion.div {...anim(9)}>
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderOpen className="h-4 w-4 text-primary" /> Todos os Contratos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="px-5 py-3 text-left font-medium">Cliente</th>
                        <th className="px-5 py-3 text-left font-medium">Escopo</th>
                        <th className="px-5 py-3 text-left font-medium">Serviços</th>
                        <th className="px-5 py-3 text-right font-medium">Valor</th>
                        <th className="px-5 py-3 text-center font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map(c => (
                        <tr key={c.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-medium text-foreground">{c.companyName}</p>
                            <p className="text-xs text-muted-foreground">{c.contactName}</p>
                          </td>
                          <td className="px-5 py-3 max-w-[200px]">
                            <p className="text-xs text-muted-foreground truncate">{c.scope || '—'}</p>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap gap-1">
                              {c.serviceType.slice(0, 3).map(s => (
                                <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                              ))}
                              {c.serviceType.length > 3 && <Badge variant="secondary" className="text-xs">+{c.serviceType.length - 3}</Badge>}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right font-semibold tabular-nums text-foreground">
                            {formatCurrency(c.monthlyValue)}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${statusColors[c.status] || 'bg-secondary text-foreground'}`}>
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border bg-secondary/20">
                        <td colSpan={3} className="px-5 py-3 text-sm font-medium text-muted-foreground">Total MRR</td>
                        <td className="px-5 py-3 text-right text-lg font-bold tabular-nums text-[hsl(var(--success))]">
                          {formatCurrency(mrr)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          {/* Expenses & Investments */}
          <ExpensesPanel mrr={mrr} />
        </TabsContent>

        {/* ==================== DELIVERY TAB ==================== */}
        <TabsContent value="entregas" className="space-y-6">
          {/* Delivery KPIs — Futuristic */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total de Tarefas', value: tasks.length, icon: CheckSquare, accent: 'text-primary', bg: 'bg-primary/10', glow: 'hsl(73,93%,55%)', ring: 'ring-primary/30' },
              { label: 'Concluídas', value: completedTasks.length, icon: CheckCircle2, accent: 'text-[hsl(var(--success))]', bg: 'bg-[hsl(var(--success))]/10', glow: 'hsl(var(--success))', ring: 'ring-[hsl(var(--success))]/30' },
              { label: 'Em Andamento', value: pendingTasks.length, icon: Clock, accent: 'text-[hsl(var(--info))]', bg: 'bg-[hsl(var(--info))]/10', glow: 'hsl(var(--info))', ring: 'ring-[hsl(var(--info))]/30' },
              { label: 'Atrasadas', value: overdueTasks.length, icon: AlertTriangle, accent: 'text-[hsl(var(--warning))]', bg: 'bg-[hsl(var(--warning))]/10', glow: 'hsl(var(--warning))', ring: 'ring-[hsl(var(--warning))]/30' },
            ].map((kpi, i) => (
              <motion.div key={kpi.label} {...anim(i)}>
                <Card className="group relative overflow-hidden border-border/50 bg-gradient-to-br from-card via-card to-card/30 backdrop-blur-xl transition-all duration-300 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-5px_hsl(73,93%,55%/0.15)]">
                  <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full blur-2xl opacity-20 transition-opacity duration-500 group-hover:opacity-40" style={{ background: kpi.glow }} />
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <CardContent className="relative p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">{kpi.label}</span>
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${kpi.bg} ring-1 ${kpi.ring} backdrop-blur`}>
                        <kpi.icon className={`h-4 w-4 ${kpi.accent}`} />
                      </div>
                    </div>
                    <p className="mt-4 text-2xl sm:text-3xl font-bold tabular-nums text-foreground tracking-tight">{kpi.value}</p>
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                      <span className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                      <span>Em tempo real</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Completion Progress */}
          <motion.div {...anim(4)}>
            <Card className="border-border/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-foreground">Taxa de Conclusão</span>
                  <span className="text-2xl font-bold tabular-nums text-primary">{completionRate}%</span>
                </div>
                <Progress value={completionRate} className="h-3" />
                <p className="mt-2 text-xs text-muted-foreground">{completedTasks.length} de {tasks.length} tarefas concluídas</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Task Status Chart + Overdue List */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Task Status Distribution */}
            <motion.div {...anim(5)}>
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PieChart className="h-4 w-4 text-primary" /> Distribuição de Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <RechartsPie>
                      <Pie data={taskStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, value }) => `${value}`}>
                        {taskStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 3.7%, 15.9%)', borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </RechartsPie>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Overdue Tasks */}
            <motion.div {...anim(6)}>
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" /> Tarefas Atrasadas
                    {overdueTasks.length > 0 && (
                      <Badge variant="destructive" className="ml-auto">{overdueTasks.length}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {overdueTasks.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                      <CheckCircle2 className="h-10 w-10 text-[hsl(var(--success))]" />
                      <p className="text-sm text-muted-foreground">Nenhuma tarefa atrasada 🎉</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[250px] overflow-y-auto">
                      {overdueTasks.map(t => {
                        const client = clients.find(c => c.id === t.clientId);
                        const daysLate = Math.ceil((Date.now() - new Date(t.dueDate).getTime()) / 86400000);
                        return (
                          <div key={t.id} className="flex items-center justify-between rounded-lg bg-destructive/5 p-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">{t.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {client?.companyName || 'Sem cliente'} · {t.assignee || 'Sem responsável'}
                              </p>
                            </div>
                            <Badge variant="destructive" className="text-xs shrink-0">
                              {daysLate}d atraso
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Tasks by Client */}
          <motion.div {...anim(7)}>
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4 text-primary" /> Tarefas por Cliente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeClients.map(c => {
                    const clientTasks = tasks.filter(t => t.clientId === c.id);
                    const done = clientTasks.filter(t => ['Concluído', 'Finalizado'].includes(t.status)).length;
                    const total = clientTasks.length;
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    return (
                      <div key={c.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground">{c.companyName}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">{done}/{total} ({pct}%)</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                    );
                  })}
                  {activeClients.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhum cliente ativo</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Task-focused dashboard for team members (non-admin)
function SimpleDashboard({ clients, tasks, leads, mrr, activeClients, pendingTasks }: {
  clients: any[]; tasks: any[]; leads: any[]; mrr: number; activeClients: any[]; pendingTasks: any[];
}) {
  const completedTasks = tasks.filter((t: any) => ['Concluído', 'Finalizado'].includes(t.status));
  const today = new Date().toISOString().split('T')[0];
  const overdueTasks = pendingTasks.filter((t: any) => t.dueDate && t.dueDate < today);
  const inProgressTasks = tasks.filter((t: any) => t.status === 'Em andamento' || t.status === 'Em progresso');
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  const kpis = [
    { label: 'Tarefas Pendentes', value: pendingTasks.length.toString(), icon: CheckSquare, accent: 'text-[hsl(var(--warning))]', bg: 'bg-[hsl(var(--warning))]/10' },
    { label: 'Em Andamento', value: inProgressTasks.length.toString(), icon: Clock, accent: 'text-[hsl(var(--info))]', bg: 'bg-[hsl(var(--info))]/10' },
    { label: 'Concluídas', value: completedTasks.length.toString(), icon: CheckCircle2, accent: 'text-[hsl(var(--success))]', bg: 'bg-[hsl(var(--success))]/10' },
    { label: 'Atrasadas', value: overdueTasks.length.toString(), icon: AlertTriangle, accent: overdueTasks.length > 0 ? 'text-destructive' : 'text-muted-foreground', bg: overdueTasks.length > 0 ? 'bg-destructive/10' : 'bg-muted/50' },
  ];

  const { triggerNotification, requestPermission } = usePushNotification();

  return (
    <div className="space-y-6 relative">
      {/* Futuristic ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/[0.07] blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[400px] w-[400px] rounded-full bg-[hsl(174,98%,19%)]/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[350px] w-[350px] rounded-full bg-[hsl(var(--info))]/10 blur-[100px]" />
      </div>

      <SmartAlerts />

      {/* Header — Futuristic */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-card/40 p-6 backdrop-blur-xl"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(73,93%,55%,0.08),_transparent_60%)]" />
        <div className="absolute -top-px left-10 right-10 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/30">
              <CheckSquare className="h-6 w-6 text-primary" />
              <div className="absolute inset-0 rounded-xl bg-primary/20 blur-lg" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">Live · Suas Tarefas</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mt-0.5 tracking-tight">
                Painel <span className="text-primary">de Trabalho</span>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">Visão geral das suas tarefas e entregas</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => requestPermission()}
              className="hidden sm:flex gap-2 border-border/50 backdrop-blur"
            >
              Habilitar Push
            </Button>
            <Button
              size="sm"
              onClick={() => triggerNotification("Lembrete da Agenda 📅", "Sua próxima gravação é em breve.", "info", "agenda")}
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_hsl(73,93%,55%/0.3)]"
            >
              <BellRing className="h-4 w-4" /> Testar Agenda
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => triggerNotification("Tarefa Atrasada 🚨", "O roteiro do cliente atrasou.", "error", "overdue")}
              className="gap-2"
            >
              <AlertTriangle className="h-4 w-4" /> Testar Atraso
            </Button>
          </div>
        </div>
      </motion.div>

      {/* KPIs — Futuristic */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => {
          const glow = kpi.accent.includes('warning') ? 'hsl(var(--warning))' : kpi.accent.includes('info') ? 'hsl(var(--info))' : kpi.accent.includes('success') ? 'hsl(var(--success))' : kpi.accent.includes('destructive') ? 'hsl(0,84%,60%)' : 'hsl(73,93%,55%)';
          return (
            <motion.div key={kpi.label} {...anim(i)}>
              <Card className="group relative overflow-hidden border-border/50 bg-gradient-to-br from-card via-card to-card/30 backdrop-blur-xl transition-all duration-300 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-5px_hsl(73,93%,55%/0.15)]">
                <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full blur-2xl opacity-20 transition-opacity duration-500 group-hover:opacity-40" style={{ background: glow }} />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <CardContent className="relative p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">{kpi.label}</span>
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${kpi.bg} ring-1 ring-border/50 backdrop-blur`}>
                      <kpi.icon className={`h-4 w-4 ${kpi.accent}`} />
                    </div>
                  </div>
                  <p className="mt-4 text-2xl sm:text-3xl font-bold tabular-nums text-foreground tracking-tight">{kpi.value}</p>
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                    <span className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                    <span>Em tempo real</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Completion Rate */}
      <motion.div {...anim(4)}>
        <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-card via-card to-card/30 backdrop-blur-xl">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <CardContent className="relative p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(73,93%,55%)]" />
                <span className="text-sm font-semibold text-foreground">Taxa de Conclusão</span>
              </div>
              <span className="text-3xl font-bold tabular-nums text-primary tracking-tight">{completionRate}%</span>
            </div>
            <Progress value={completionRate} className="h-3" />
            <p className="mt-2 text-xs text-muted-foreground">{completedTasks.length} de {tasks.length} tarefas concluídas</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Overdue + Pending Lists */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Overdue */}
        <motion.div {...anim(5)}>
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" /> Tarefas Atrasadas
                {overdueTasks.length > 0 && <Badge variant="destructive" className="ml-auto">{overdueTasks.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overdueTasks.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <CheckCircle2 className="h-10 w-10 text-[hsl(var(--success))]" />
                  <p className="text-sm text-muted-foreground">Nenhuma tarefa atrasada 🎉</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {overdueTasks.map((t: any) => {
                    const client = clients.find((c: any) => c.id === t.clientId);
                    const daysLate = Math.ceil((Date.now() - new Date(t.dueDate).getTime()) / 86400000);
                    return (
                      <div key={t.id} className="flex items-center justify-between rounded-lg bg-destructive/5 p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                          <p className="text-xs text-muted-foreground">{client?.companyName || 'Sem cliente'}</p>
                        </div>
                        <Badge variant="destructive" className="text-xs shrink-0">{daysLate}d atraso</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Pending tasks */}
        <motion.div {...anim(6)}>
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-[hsl(var(--info))]" /> Próximas Tarefas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingTasks.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <CheckCircle2 className="h-10 w-10 text-[hsl(var(--success))]" />
                  <p className="text-sm text-muted-foreground">Tudo em dia!</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {pendingTasks
                    .sort((a: any, b: any) => {
                      if (!a.dueDate) return 1;
                      if (!b.dueDate) return -1;
                      return a.dueDate.localeCompare(b.dueDate);
                    })
                    .slice(0, 10)
                    .map((t: any) => {
                      const client = clients.find((c: any) => c.id === t.clientId);
                      return (
                        <div key={t.id} className="flex items-center justify-between rounded-lg bg-secondary/30 p-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {client?.companyName || 'Sem cliente'}
                              {t.dueDate && ` · Entrega: ${new Date(t.dueDate).toLocaleDateString('pt-BR')}`}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs shrink-0">{t.status}</Badge>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
