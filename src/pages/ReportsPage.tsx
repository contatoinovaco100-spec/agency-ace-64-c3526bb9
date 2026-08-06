import { useAgency } from '@/contexts/AgencyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import {
  BarChart3, DollarSign, Users, CheckSquare, TrendingUp,
  Download, FileText, PieChart, Calendar,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, Legend,
} from 'recharts';

const COLORS = [
  'hsl(73, 93%, 55%)', 'hsl(174, 98%, 19%)', 'hsl(217, 91%, 60%)',
  'hsl(38, 92%, 50%)', 'hsl(338, 78%, 12%)', 'hsl(180, 60%, 45%)',
];

const anim = (i: number) => ({ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.04, duration: 0.35 } });
const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function ReportsPage() {
  const { clients, tasks, leads } = useAgency();

  const activeClients = clients.filter(c => c.status === 'Ativo');
  const mrr = activeClients.reduce((a, c) => a + c.monthlyValue, 0);
  const completedTasks = tasks.filter(t => ['Concluído', 'Finalizado'].includes(t.status));
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  // Revenue by manager
  const managerRevenue: Record<string, number> = {};
  activeClients.forEach(c => {
    const managers = (c.accountManager || []).length > 0 ? c.accountManager : ['Sem responsável'];
    managers.forEach(mgr => { managerRevenue[mgr] = (managerRevenue[mgr] || 0) + c.monthlyValue; });
  });
  const managerData = Object.entries(managerRevenue).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

  // Tasks by assignee
  const assigneeTasks: Record<string, { total: number; done: number }> = {};
  tasks.forEach(t => {
    const a = t.assignee || 'Sem responsável';
    if (!assigneeTasks[a]) assigneeTasks[a] = { total: 0, done: 0 };
    assigneeTasks[a].total++;
    if (['Concluído', 'Finalizado'].includes(t.status)) assigneeTasks[a].done++;
  });
  const assigneeData = Object.entries(assigneeTasks).sort((a, b) => b[1].total - a[1].total);

  // Leads by stage
  const leadStages: Record<string, number> = {};
  leads.forEach(l => { leadStages[l.stage] = (leadStages[l.stage] || 0) + 1; });
  const leadStageData = Object.entries(leadStages).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));

  // Service breakdown
  const serviceCount: Record<string, number> = {};
  activeClients.forEach(c => c.serviceType.forEach(s => { serviceCount[s] = (serviceCount[s] || 0) + 1; }));
  const serviceData = Object.entries(serviceCount).sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));

  const today = new Date().toISOString().split('T')[0];
  const overdue = tasks.filter(t => t.dueDate && t.dueDate < today && !['Concluído', 'Finalizado'].includes(t.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
            <p className="text-sm text-muted-foreground">Análise detalhada de performance da agência</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { label: 'MRR', value: fmt(mrr), icon: DollarSign, accent: 'text-[hsl(var(--success))]' },
          { label: 'Clientes Ativos', value: activeClients.length, icon: Users, accent: 'text-[hsl(var(--info))]' },
          { label: 'Tarefas Concluídas', value: `${completionRate}%`, icon: CheckSquare, accent: 'text-primary' },
          { label: 'Leads Ativos', value: leads.length, icon: TrendingUp, accent: 'text-[hsl(var(--warning))]' },
          { label: 'Tarefas Atrasadas', value: overdue.length, icon: Calendar, accent: 'text-destructive' },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} {...anim(i)}>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{kpi.label}</span>
                  <kpi.icon className={`h-4 w-4 ${kpi.accent}`} />
                </div>
                <p className="mt-2 text-xl font-bold tabular-nums text-foreground">{kpi.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue by Manager */}
        <motion.div {...anim(5)}>
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /> Receita por Responsável</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={managerData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 3.7%, 15.9%)" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(240, 5%, 64.9%)', fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: 'hsl(240, 5%, 64.9%)', fontSize: 11 }} axisLine={false} tickFormatter={v => `R$${v}`} />
                  <Tooltip contentStyle={{ background: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 3.7%, 15.9%)', borderRadius: 8 }} formatter={(v: number) => [fmt(v), 'Receita']} />
                  <Bar dataKey="value" fill="hsl(73, 93%, 55%)" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Services Distribution */}
        <motion.div {...anim(6)}>
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><PieChart className="h-4 w-4 text-primary" /> Serviços Contratados</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPie>
                  <Pie data={serviceData} cx="50%" cy="50%" outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                    {serviceData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 3.7%, 15.9%)', borderRadius: 8 }} />
                </RechartsPie>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Lead Pipeline */}
        <motion.div {...anim(7)}>
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Pipeline de Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={leadStageData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 3.7%, 15.9%)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'hsl(240, 5%, 64.9%)', fontSize: 11 }} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(240, 5%, 64.9%)', fontSize: 10 }} axisLine={false} width={120} />
                  <Tooltip contentStyle={{ background: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 3.7%, 15.9%)', borderRadius: 8 }} />
                  <Bar dataKey="value" fill="hsl(217, 91%, 60%)" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Team Performance */}
        <motion.div {...anim(8)}>
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Performance da Equipe</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {assigneeData.map(([name, stats]) => {
                  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
                  return (
                    <div key={name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">{name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{stats.done}/{stats.total} ({pct}%)</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })}
                {assigneeData.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Sem dados</p>}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Client Detail Table */}
      <motion.div {...anim(9)}>
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Detalhamento por Cliente</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-5 py-3 text-left font-medium">Cliente</th>
                    <th className="px-5 py-3 text-left font-medium">Responsável</th>
                    <th className="px-5 py-3 text-center font-medium">Tarefas</th>
                    <th className="px-5 py-3 text-center font-medium">Concluídas</th>
                    <th className="px-5 py-3 text-right font-medium">Valor</th>
                    <th className="px-5 py-3 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => {
                    const ct = tasks.filter(t => t.clientId === c.id);
                    const cd = ct.filter(t => ['Concluído', 'Finalizado'].includes(t.status));
                    return (
                      <tr key={c.id} className="border-b border-border/30 hover:bg-secondary/30">
                        <td className="px-5 py-3 font-medium text-foreground">{c.companyName}</td>
                        <td className="px-5 py-3 text-muted-foreground">{(c.accountManager || []).join(', ') || '—'}</td>
                        <td className="px-5 py-3 text-center tabular-nums">{ct.length}</td>
                        <td className="px-5 py-3 text-center tabular-nums">{cd.length}</td>
                        <td className="px-5 py-3 text-right tabular-nums font-semibold">{fmt(c.monthlyValue)}</td>
                        <td className="px-5 py-3 text-center">
                          <Badge variant={c.status === 'Ativo' ? 'default' : 'secondary'} className="text-xs">{c.status}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
