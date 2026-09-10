import { useAgency } from '@/contexts/AgencyContext';
import { useModuleAccess } from '@/hooks/useUserRole';
import { ExpensesPanel } from '@/components/dashboard/ExpensesPanel';
import type { Client } from '@/types/agency';

import { motion } from 'framer-motion';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, DollarSign, Target, CheckSquare, FolderOpen,
  TrendingUp, PieChart, BarChart3, ArrowUpRight, ArrowDownRight,
  Clock, AlertTriangle, CheckCircle2, Briefcase, FileText, BellRing,
  EyeOff, Eye, ArrowUpDown, ArrowUp, ArrowDown, Trophy, CalendarClock, Rocket, Minus, Medal, TrendingDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotification } from '@/hooks/usePushNotification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

type SignedContract = {
  id: string;
  client_id: string | null;
  client_name: string;
  monthly_value: number;
  duration_months: number;
  sent_at: string | null;
  created_at: string;
  status: string;
  contract_signatures?: { signed_at: string }[];
};

export default function Dashboard() {
  const { clients: contextClients, tasks: allTasks, leads } = useAgency();
  const { isAdmin } = useModuleAccess();
  const { triggerNotification, requestPermission } = usePushNotification();

  const [signedContracts, setSignedContracts] = useState<SignedContract[]>([]);

  // ---- Normalização dos clientes ----
  const normName = (s: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const STATUS_RANK: Record<string, number> = { Ativo: 2, Pausado: 1, Cancelado: 0 };

  // Ignora a Lixeira e agrupa por nome: clientes duplicados (mesmo nome)
  // contam uma única vez — evita MRR/contagens infladas.
  const clientGroups = useMemo(() => {
    const map = new Map<string, Client[]>();
    contextClients.filter(c => !c.deletedAt).forEach(c => {
      const key = normName(c.companyName);
      const list = map.get(key);
      if (list) list.push(c); else map.set(key, [c]);
    });
    return map;
  }, [contextClients]);

  // Representante de cada grupo → melhor status / maior valor / com data.
  const uniqueClients = useMemo(() => {
    return [...clientGroups.values()].map(group => group.reduce<Client>((best, c) => {
      const score = (cc: Client) =>
        (STATUS_RANK[cc.status] ?? -1) * 1e9 + (Number(cc.monthlyValue) || 0) * 1e3 + (cc.contractStartDate ? 1 : 0);
      return score(c) > score(best) ? c : best;
    }, group[0]));
  }, [clientGroups]);

  // Cancelados só aparecem na seção de Churn dedicada.
  const churnedClients = useMemo(() => uniqueClients.filter(c => c.status === 'Cancelado'), [uniqueClients]);
  const cancelledIds = useMemo(
    () => new Set(contextClients.filter(c => c.status === 'Cancelado' && !c.deletedAt).map(c => c.id)),
    [contextClients],
  );
  const clients = useMemo(() => uniqueClients.filter(c => c.status !== 'Cancelado'), [uniqueClients]);
  const tasks = useMemo(
    () => allTasks.filter(t => !t.clientId || !cancelledIds.has(t.clientId)),
    [allTasks, cancelledIds],
  );

  const fetchSignedContracts = useCallback(async () => {
    const { data } = await supabase
      .from('contracts')
      .select('id, client_id, client_name, monthly_value, duration_months, sent_at, created_at, status, contract_signatures(signed_at)')
      .eq('status', 'assinado');
    if (data) setSignedContracts(data as SignedContract[]);
  }, []);

  // Mantém o LTV sempre sincronizado com a lista de clientes:
  // refaz a busca sempre que a lista de clientes muda (realtime do AgencyContext)
  // e também quando algum contrato é criado/assinado/alterado.
  useEffect(() => {
    if (!isAdmin) return;
    fetchSignedContracts();
  }, [isAdmin, fetchSignedContracts, contextClients]);

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel('dashboard-contracts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => fetchSignedContracts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contract_signatures' }, () => fetchSignedContracts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, fetchSignedContracts]);



  // Valor mensal confiável: usa o contrato assinado quando o cadastro
  // do cliente está zerado/errado (fallback) e também evita duplicidade.
  const contractValueByKey = useMemo(() => {
    const map = new Map<string, number>();
    signedContracts.forEach(ct => {
      const v = Number(ct.monthly_value) || 0;
      const key = normName(ct.client_name);
      if (v > (map.get(key) || 0)) map.set(key, v);
    });
    return map;
  }, [signedContracts]);
  const effectiveMonthlyValue = (c: Client) =>
    Math.max(Number(c.monthlyValue) || 0, contractValueByKey.get(normName(c.companyName)) || 0);

  const activeClients = clients.filter(c => c.status === 'Ativo');
  const pausedClients = clients.filter(c => c.status === 'Pausado');
  const mrr = activeClients.reduce((acc, c) => acc + effectiveMonthlyValue(c), 0);
  const pendingTasks = tasks.filter(t => !['Concluído', 'Finalizado'].includes(t.status));
  const completedTasks = tasks.filter(t => ['Concluído', 'Finalizado'].includes(t.status));

// --- Churn (geral e últimos 30 dias) ---
  const totalBase = contextClients.length;
  const churnRateAllTime = totalBase > 0 ? (churnedClients.length / totalBase) * 100 : 0;
  const churn30 = churnedClients.filter(c => {
    if (!c.cancelledAt) return false;
    const d = new Date(c.cancelledAt);
    return !isNaN(d.getTime()) && (Date.now() - d.getTime()) <= 30 * 86400000;
  });
  const baseStart30 = activeClients.length + pausedClients.length + churn30.length;
  const churnRate30 = baseStart30 > 0 ? (churn30.length / baseStart30) * 100 : 0;
  const churnedMrr = churnedClients.reduce((s, c) => s + effectiveMonthlyValue(c), 0);

  // Tarefas efetivamente em produção (não conta backlog/"Ideias").
  const inProgressStatuses = new Set([
    'Em Copy', 'Em Direção', 'Em Gravação', 'Em Edição', 'Revisão',
    'Em andamento', 'Em progresso', 'Em produção', 'Em revisão',
    'Aguardando Aprovação', 'Aguardando aprovação',
  ]);
  const inProgressTasks = tasks.filter(t => inProgressStatuses.has(t.status));

  // If not admin, show simplified dashboard
  if (!isAdmin) {
    return <SimpleDashboard clients={clients} tasks={tasks} leads={leads} mrr={mrr} activeClients={activeClients} pendingTasks={pendingTasks} />;
  }

  // --- Admin Dashboard ---

  // Financial data
  const revenueByClient = activeClients
    .sort((a, b) => effectiveMonthlyValue(b) - effectiveMonthlyValue(a))
    .map(c => ({ name: c.companyName.length > 15 ? c.companyName.slice(0, 15) + '…' : c.companyName, valor: effectiveMonthlyValue(c) }));

  // Revenue by service
  const serviceRevenue: Record<string, number> = {};
  activeClients.forEach(c => {
    const perService = effectiveMonthlyValue(c) / (c.serviceType.length || 1);
    c.serviceType.forEach(s => { serviceRevenue[s] = (serviceRevenue[s] || 0) + perService; });
  });
  const serviceRevenueData = Object.entries(serviceRevenue)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: Math.round(value) }));

  // LTV por cliente — meses pagos desde o início do contrato até hoje
  // (ou até a data de cancelamento). Base: clientes cadastrados; contratos
  // assinados servem como fallback de data/valor e para clientes sem cadastro.
  const todayDate = new Date();
  const norm = (s: string) => (s || '').trim().toLowerCase();

  const monthsBetween = (start: Date, end: Date) => {
    // cobranças no dia 10; primeira cobrança no mês seguinte se iniciou após o dia 10
    let cur = new Date(start.getFullYear(), start.getMonth(), 10);
    if (start.getDate() > 10) cur.setMonth(cur.getMonth() + 1);
    let months = 0;
    while (cur <= end) {
      months++;
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  };

  // Menor data de início por nome, a partir dos contratos assinados (fallback
  // de data quando o cadastro do cliente está sem contract_start_date).
  const startDateByKey = useMemo(() => {
    const map = new Map<string, Date>();
    signedContracts.forEach(ct => {
      const raw = ct.contract_signatures?.[0]?.signed_at || ct.sent_at || ct.created_at;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return;
      const key = norm(ct.client_name);
      const prev = map.get(key);
      if (!prev || d < prev) map.set(key, d);
    });
    return map;
  }, [signedContracts]);
  const effectiveStartDate = (c: Client): Date | null => {
    if (c.contractStartDate) {
      const d = new Date(c.contractStartDate);
      if (!isNaN(d.getTime())) return d;
    }
    return startDateByKey.get(norm(c.companyName)) || null;
  };

  // Melhor data e valor de contrato por nome de cliente
  const contractInfo: Record<string, { date: Date; monthlyValue: number; count: number }> = {};
  signedContracts.forEach(ct => {
    const raw = ct.contract_signatures?.[0]?.signed_at || ct.sent_at || ct.created_at;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return;
    const key = norm(ct.client_name);
    const prev = contractInfo[key];
    contractInfo[key] = {
      date: prev && prev.date < d ? prev.date : d,
      monthlyValue: ct.monthly_value || prev?.monthlyValue || 0,
      count: (prev?.count || 0) + 1,
    };
  });

  const ltvMap: Record<string, {
    name: string;
    clientId: string | null;
    ltv: number;
    monthsPaid: number;
    contractsCount: number;
    monthlyValue: number;
    status: string;
  }> = {};

  // 1) Clientes cadastrados (incluindo cancelados, com LTV congelado)
  uniqueClients.forEach(c => {
    const info = contractInfo[norm(c.companyName)];
    const start = effectiveStartDate(c);
    if (!start) return;

    let limit = todayDate;
    if (c.status === 'Cancelado' && c.cancelledAt) {
      const cd = new Date(c.cancelledAt);
      if (!isNaN(cd.getTime())) limit = cd;
    }

    const monthsPaid = monthsBetween(start, limit);
    if (monthsPaid < 1) return;

    const monthlyValue = effectiveMonthlyValue(c) || info?.monthlyValue || 0;
    if (monthlyValue <= 0) return;

    ltvMap[c.id] = {
      name: c.companyName,
      clientId: c.id,
      ltv: monthsPaid * monthlyValue,
      monthsPaid,
      contractsCount: info?.count || 0,
      monthlyValue,
      status: c.status,
    };
  });

  // 2) Contratos assinados de quem ainda não tem cadastro de cliente
  const registeredNames = new Set(uniqueClients.map(c => norm(c.companyName)));
  Object.entries(contractInfo).forEach(([key, info]) => {
    if (!key || registeredNames.has(key)) return;
    const monthsPaid = monthsBetween(info.date, todayDate);
    if (monthsPaid < 1 || info.monthlyValue <= 0) return;
    const original = signedContracts.find(ct => norm(ct.client_name) === key);
    ltvMap[`name:${key}`] = {
      name: original?.client_name?.trim() || key,
      clientId: null,
      ltv: monthsPaid * info.monthlyValue,
      monthsPaid,
      contractsCount: info.count,
      monthlyValue: info.monthlyValue,
      status: 'Sem cadastro',
    };
  });

  const ltvByClient = Object.entries(ltvMap)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.ltv - a.ltv);
  const totalLtv = ltvByClient.reduce((sum, c) => sum + c.ltv, 0);
  const avgLtv = ltvByClient.length > 0 ? totalLtv / ltvByClient.length : 0;


  // Client status distribution (cancelled clients live in the Churn section)
  const clientStatusData = [
    { name: 'Ativos', value: activeClients.length, color: CHART_COLORS[1] },
    { name: 'Pausados', value: pausedClients.length, color: CHART_COLORS[3] },
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



  // Revenue history (last 12 months) — baseada na data real de início
  // (cadastro ou assinatura do contrato, o que vier antes). Clientes duplicados
  // e cancelados não são contados; o valor usa o contrato assinado quando o
  // cadastro está zerado.
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const now = new Date();
  const revenueHistory = Array.from({ length: 12 }, (_, idx) => {
    const i = 11 - idx; // from 11 months ago to current
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const endOfMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59);
    const total = clients.reduce((sum, c) => {
      if (c.status === 'Cancelado') return sum;
      const start = effectiveStartDate(c);
      if (!start || start > endOfMonth) return sum;
      return sum + effectiveMonthlyValue(c);
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
    const start = effectiveStartDate(c);
    return !!start && start >= thirtyDaysAgo;
  });

  // === MoM (mês atual vs anterior) ===
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const lastMonthMrr = clients.reduce((sum, c) => {
    if (c.status === 'Cancelado') return sum;
    const start = effectiveStartDate(c);
    return start && start <= endOfLastMonth ? sum + effectiveMonthlyValue(c) : sum;
  }, 0);
  const mrrDelta = mrr - lastMonthMrr;
  const mrrPct = lastMonthMrr > 0 ? (mrrDelta / lastMonthMrr) * 100 : (mrr > 0 ? 100 : 0);

  const newClientsThisMonth = clients.filter(c => {
    const d = effectiveStartDate(c);
    return !!d && d >= startOfThisMonth;
  }).length;
  const newClientsLastMonth = clients.filter(c => {
    const d = effectiveStartDate(c);
    return !!d && d >= startOfLastMonth && d <= endOfLastMonth;
  }).length;

  // === Churn (clientes e MRR perdidos) ===
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Clientes cancelados NO mês atual (base para a taxa do mês)
  const churnedThisMonth = churnedClients.filter(c => {
    const cd = c.cancelledAt ? new Date(c.cancelledAt) : null;
    return !!cd && !isNaN(cd.getTime()) && cd >= startOfThisMonth && cd < startOfNextMonth;
  });
  // Clientes cancelados no mês anterior (para comparar)
  const churnedLastMonth = churnedClients.filter(c => {
    const cd = c.cancelledAt ? new Date(c.cancelledAt) : null;
    return !!cd && !isNaN(cd.getTime()) && cd >= startOfLastMonth && cd < startOfThisMonth;
  });

  // Base: quem era cliente no início do mês (exclui quem começou depois)
  const startedBefore = (c: Client, limit: Date) => {
    const start = effectiveStartDate(c);
    return !!start && start < limit;
  };
  const baseAtStartOfMonth = uniqueClients.filter(c => {
    if (!startedBefore(c, startOfThisMonth)) return false;
    if (c.status === 'Cancelado') return churnedThisMonth.includes(c);
    return true;
  }).length;
  const lastMonthBase = uniqueClients.filter(c => {
    if (!startedBefore(c, startOfLastMonth)) return false;
    if (c.status === 'Cancelado') return churnedLastMonth.includes(c);
    return true;
  }).length;

  const churnRate = baseAtStartOfMonth > 0 ? (churnedThisMonth.length / baseAtStartOfMonth) * 100 : 0;
  const churnRateLastMonth = lastMonthBase > 0 ? (churnedLastMonth.length / lastMonthBase) * 100 : 0;

  const lostMrrThisMonth = churnedThisMonth.reduce((s, c) => s + effectiveMonthlyValue(c), 0);
  const mrrAtStartOfMonth = clients.reduce((sum, c) => {
    const start = effectiveStartDate(c);
    return start && start < startOfThisMonth ? sum + effectiveMonthlyValue(c) : sum;
  }, 0);
  const mrrChurnRate = mrrAtStartOfMonth > 0 ? (lostMrrThisMonth / mrrAtStartOfMonth) * 100 : 0;

  const receitaPerdidaTotal = churnedClients.reduce((s, c) => s + effectiveMonthlyValue(c), 0);

  // Evolução mensal da taxa de churn (12 meses) para o gráfico
  const churnHistory = Array.from({ length: 12 }, (_, idx) => {
    const mStart = new Date(now.getFullYear(), now.getMonth() - (11 - idx), 1);
    const mNext = new Date(now.getFullYear(), now.getMonth() - (10 - idx), 1);
    const churned = churnedClients.filter(c => {
      const cd = c.cancelledAt ? new Date(c.cancelledAt) : null;
      return !!cd && !isNaN(cd.getTime()) && cd >= mStart && cd < mNext;
    }).length;
    const base = uniqueClients.filter(c => {
      const start = effectiveStartDate(c);
      if (!start || start >= mStart) return false;
      if (c.status === 'Cancelado') {
        const cd = c.cancelledAt ? new Date(c.cancelledAt) : null;
        return !!cd && !isNaN(cd.getTime()) && cd >= mStart && cd < mNext;
      }
      return true;
    }).length;
    const pct = base > 0 ? (churned / base) * 100 : 0;
    const label = idx === 0
      ? `${monthNames[mStart.getMonth()]}/${String(mStart.getFullYear()).slice(2)}`
      : monthNames[mStart.getMonth()];
    return { month: label, churn: Math.round(pct * 10) / 10 };
  });

  const contractsSignedThisMonth = signedContracts.filter(ct => {
    const ds = ct.contract_signatures?.[0]?.signed_at || ct.sent_at || ct.created_at;
    const d = new Date(ds);
    return !isNaN(d.getTime()) && d >= startOfThisMonth;
  }).length;
  const contractsSignedLastMonth = signedContracts.filter(ct => {
    const ds = ct.contract_signatures?.[0]?.signed_at || ct.sent_at || ct.created_at;
    const d = new Date(ds);
    return !isNaN(d.getTime()) && d >= startOfLastMonth && d <= endOfLastMonth;
  }).length;

  // === Meta de faturamento (10k → 100k → 1M) ===
  const milestones = [10000, 100000, 1000000];
  const nextGoal = milestones.find(m => mrr < m) || milestones[milestones.length - 1];
  const prevGoal = [0, ...milestones].filter(m => m < nextGoal).pop() || 0;
  const goalProgress = nextGoal > prevGoal ? Math.min(100, ((mrr - prevGoal) / (nextGoal - prevGoal)) * 100) : 100;
  const goalLabel = nextGoal >= 1000000 ? 'R$ 1M' : nextGoal >= 100000 ? 'R$ 100k' : 'R$ 10k';

  // === Próximas renovações (próximos 60 dias) ===
  const today60 = new Date();
  const in60 = new Date();
  in60.setDate(in60.getDate() + 60);
  const upcomingRenewals = signedContracts
    .map(ct => {
      const ds = ct.contract_signatures?.[0]?.signed_at || ct.sent_at || ct.created_at;
      const start = new Date(ds);
      if (isNaN(start.getTime())) return null;
      const end = new Date(start);
      end.setMonth(end.getMonth() + (ct.duration_months || 12));
      return { id: ct.id, name: ct.client_name, value: ct.monthly_value || 0, endDate: end };
    })
    .filter((x): x is { id: string; name: string; value: number; endDate: Date } => !!x && x.endDate >= today60 && x.endDate <= in60)
    .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());

  // === Ranking de equipe (tarefas concluídas) ===
  const completionByMember: Record<string, number> = {};
  completedTasks.forEach(t => {
    if (!t.assignee) return;
    completionByMember[t.assignee] = (completionByMember[t.assignee] || 0) + 1;
  });
  const teamRanking = Object.entries(completionByMember)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const maxCompletion = teamRanking[0]?.count || 1;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'BOM DIA' : hour < 18 ? 'BOA TARDE' : 'BOA NOITE';

  return (
    <div className="space-y-8 relative">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/[0.05] blur-[140px]" />
        <div className="absolute top-1/3 -right-40 h-[400px] w-[400px] rounded-full bg-primary/[0.04] blur-[120px]" />
      </div>


      {/* Header — Bento moderno */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6"
      >
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.2em]">Dashboard Principal</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            {greeting}, <span className="text-primary">INOVA CO.</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => requestPermission()}
            className="hidden sm:flex gap-2 rounded-xl border-border/60"
          >
            <BellRing className="h-4 w-4" /> Habilitar Push
          </Button>
          <Button
            size="sm"
            onClick={() => triggerNotification("Nova Venda Realizada! 🎉", "O cliente fechou o contrato de R$ 5.000,00.", "success", "sale")}
            className="gap-2 rounded-xl bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white"
          >
            <BellRing className="h-4 w-4" /> Venda
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => triggerNotification("Tarefa Atrasada 🚨", "A entrega da Landing Page está atrasada.", "error", "overdue")}
            className="gap-2 rounded-xl"
          >
            <AlertTriangle className="h-4 w-4" /> Atraso
          </Button>
        </div>
      </motion.div>

      {/* Tabs — pill style */}
      <Tabs defaultValue="financeiro" className="space-y-6">
        <TabsList className="inline-flex h-auto bg-card/70 backdrop-blur-xl border border-border/60 rounded-2xl p-1.5 gap-1">
          <TabsTrigger value="financeiro" className="gap-2 rounded-xl px-5 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_24px_-4px_hsl(73,93%,55%/0.5)]">
            <DollarSign className="h-4 w-4" /> Financeiro
          </TabsTrigger>
          <TabsTrigger value="entregas" className="gap-2 rounded-xl px-5 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_24px_-4px_hsl(73,93%,55%/0.5)]">
            <CheckSquare className="h-4 w-4" /> Entregas
          </TabsTrigger>
        </TabsList>


        {/* ==================== FINANCIAL TAB ==================== */}
        <TabsContent value="financeiro" className="space-y-6">
          {/* Top KPIs — Bento */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {[
              { label: 'MRR', value: formatCurrency(mrr), icon: DollarSign, accent: 'text-primary', highlight: true, hint: '' },
              { label: 'Receita Anual Projetada', value: formatCurrency(mrr * 12), icon: TrendingUp, accent: 'text-muted-foreground', highlight: false, hint: '' },
              { label: 'Clientes Ativos', value: activeClients.length.toString(), icon: Users, accent: 'text-muted-foreground', highlight: false, hint: `${pausedClients.length} pausado(s)` },
              { label: 'Ticket Médio', value: formatCurrency(activeClients.length > 0 ? mrr / activeClients.length : 0), icon: BarChart3, accent: 'text-muted-foreground', highlight: false, hint: '' },
              { label: 'Churn', value: `${churnRate.toFixed(1)}%`, icon: TrendingDown, accent: 'text-destructive', highlight: false, hint: `${churnedClients.length} cancelados · ${churnRate30.toFixed(1)}% em 30 dias · ${formatCurrency(churnedMrr)}/mês perdidos` },
            ].map((kpi, i) => (
              <motion.div key={kpi.label} {...anim(i)}>
                <div className="group relative bg-card p-6 rounded-[2rem] border border-border/60 hover:border-primary/40 transition-all duration-300 hover:-translate-y-0.5">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`p-2.5 rounded-xl bg-secondary/70 ${kpi.accent}`}>
                      <kpi.icon className="h-5 w-5" />
                    </div>
                    {kpi.highlight && (
                      <span className="text-primary text-[10px] font-bold bg-primary/10 px-2.5 py-1 rounded-full uppercase tracking-wider">Live</span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1.5">{kpi.label}</p>
                  <h3 className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums text-foreground">{kpi.value}</h3>
                  {kpi.hint && <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{kpi.hint}</p>}
                </div>
              </motion.div>
            ))}
          </div>

          {/* === Meta de Faturamento === */}
          <motion.div {...anim(4)}>
            <div className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.04] p-6">
              <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-primary/10 blur-3xl" />
              <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
                    <Rocket className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">Próxima Meta</p>
                    <h3 className="text-xl font-bold text-foreground">Faturamento mensal · <span className="text-primary">{goalLabel}</span></h3>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold tabular-nums text-foreground">{formatCurrency(mrr)}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Faltam {formatCurrency(Math.max(0, nextGoal - mrr))} para bater a meta
                  </p>
                </div>
              </div>
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(var(--success))] shadow-[0_0_20px_hsl(73,93%,55%/0.5)] transition-all duration-700"
                  style={{ width: `${goalProgress}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>{formatCurrency(prevGoal)}</span>
                <span className="font-semibold text-primary">{goalProgress.toFixed(1)}%</span>
                <span>{formatCurrency(nextGoal)}</span>
              </div>
            </div>
          </motion.div>

          {/* === Mês atual vs anterior · Renovações · Ranking equipe === */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* MoM comparison */}
            <motion.div {...anim(5)}>
              <Card className="border-border/60 rounded-[2rem] bg-card h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4 text-primary" /> Mês atual vs anterior
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: 'MRR', current: mrr, previous: lastMonthMrr, delta: mrrDelta, pct: mrrPct, currency: true },
                    { label: 'Novos clientes', current: newClientsThisMonth, previous: newClientsLastMonth, delta: newClientsThisMonth - newClientsLastMonth, pct: newClientsLastMonth > 0 ? ((newClientsThisMonth - newClientsLastMonth) / newClientsLastMonth) * 100 : (newClientsThisMonth > 0 ? 100 : 0), currency: false },
                    { label: 'Contratos assinados', current: contractsSignedThisMonth, previous: contractsSignedLastMonth, delta: contractsSignedThisMonth - contractsSignedLastMonth, pct: contractsSignedLastMonth > 0 ? ((contractsSignedThisMonth - contractsSignedLastMonth) / contractsSignedLastMonth) * 100 : (contractsSignedThisMonth > 0 ? 100 : 0), currency: false },
                    { label: 'Clientes perdidos', current: churnedThisMonth.length, previous: churnedLastMonth.length, delta: churnedThisMonth.length - churnedLastMonth.length, pct: churnedLastMonth.length > 0 ? ((churnedThisMonth.length - churnedLastMonth.length) / churnedLastMonth.length) * 100 : (churnedThisMonth.length > 0 ? 100 : 0), currency: false },
                  ].map(row => {
                    const up = row.delta > 0;
                    const flat = row.delta === 0;
                    const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
                    const color = flat ? 'text-muted-foreground' : up ? 'text-[hsl(var(--success))]' : 'text-destructive';
                    const bg = flat ? 'bg-muted/50' : up ? 'bg-[hsl(var(--success))]/10' : 'bg-destructive/10';
                    return (
                      <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/30 p-3">
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{row.label}</p>
                          <p className="text-lg font-bold tabular-nums text-foreground mt-0.5">
                            {row.currency ? formatCurrency(row.current) : row.current}
                          </p>
                          <p className="text-[10px] text-muted-foreground tabular-nums">
                            anterior: {row.currency ? formatCurrency(row.previous) : row.previous}
                          </p>
                        </div>
                        <div className={`flex flex-col items-end gap-0.5 px-2.5 py-1.5 rounded-lg ${bg} ${color} shrink-0`}>
                          <Icon className="h-3.5 w-3.5" />
                          <span className="text-xs font-bold tabular-nums">{flat ? '0%' : `${up ? '+' : ''}${row.pct.toFixed(0)}%`}</span>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </motion.div>

            {/* Renewals */}
            <motion.div {...anim(6)}>
              <Card className="border-border/60 rounded-[2rem] bg-card h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarClock className="h-4 w-4 text-[hsl(var(--warning))]" /> Renovações em até 60 dias
                    {upcomingRenewals.length > 0 && (
                      <Badge variant="secondary" className="ml-auto text-[10px]">{upcomingRenewals.length}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {upcomingRenewals.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                      <CheckCircle2 className="h-10 w-10 text-[hsl(var(--success))]" />
                      <p className="text-sm text-muted-foreground">Nenhum contrato vencendo nos próximos 60 dias.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                      {upcomingRenewals.map(r => {
                        const daysLeft = Math.ceil((r.endDate.getTime() - Date.now()) / 86400000);
                        const urgent = daysLeft <= 15;
                        return (
                          <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-card/40 p-2.5">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                              <p className="text-[10px] text-muted-foreground tabular-nums">
                                Vence em {r.endDate.toLocaleDateString('pt-BR')} · {formatCurrency(r.value)}/mês
                              </p>
                            </div>
                            <Badge
                              variant="secondary"
                              className={`text-[10px] shrink-0 ${urgent ? 'bg-destructive/15 text-destructive' : 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]'}`}
                            >
                              {daysLeft}d
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Team ranking */}
            <motion.div {...anim(7)}>
              <Card className="border-border/60 rounded-[2rem] bg-card h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Trophy className="h-4 w-4 text-primary" /> Ranking de Equipe
                    <span className="ml-auto text-[10px] text-muted-foreground font-normal">tarefas concluídas</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {teamRanking.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">Nenhuma tarefa concluída ainda.</div>
                  ) : (
                    <div className="space-y-2.5">
                      {teamRanking.map((m, i) => {
                        const pct = (m.count / maxCompletion) * 100;
                        const isTop = i === 0;
                        return (
                          <div key={m.name} className="group">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold tabular-nums ${i < 3 ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'bg-secondary text-muted-foreground'}`}>
                                  {i === 0 ? <Medal className="h-3.5 w-3.5" /> : i + 1}
                                </span>
                                <span className="text-sm font-medium text-foreground truncate">{m.name}</span>
                              </div>
                              <span className={`text-sm font-bold tabular-nums shrink-0 ${isTop ? 'text-primary' : 'text-foreground'}`}>{m.count}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-secondary/60 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(var(--success))] transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
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

          {/* Charts Row */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Revenue Trend */}
            <motion.div {...anim(4)} className="lg:col-span-2">
              <Card className="border-border/60 rounded-[2rem] bg-card">
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
              <Card className="border-border/60 rounded-[2rem] bg-card">
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
              <Card className="border-border/60 rounded-[2rem] bg-card">
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
              <Card className="border-border/60 rounded-[2rem] bg-card">
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

          {/* LTV por Cliente — quem mais gerou receita histórica */}
          {ltvByClient.length > 0 && (
            <motion.div {...anim(8)}>
              <Card className="border-border/60 rounded-[2rem] bg-card overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <DollarSign className="h-4 w-4 text-[hsl(var(--success))]" /> LTV por Cliente
                      <Badge variant="secondary" className="ml-1 text-[10px] font-normal">
                        Baseado em contratos assinados
                      </Badge>
                    </CardTitle>
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">LTV total: </span>
                        <span className="font-semibold text-foreground tabular-nums">{formatCurrency(totalLtv)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Médio: </span>
                        <span className="font-semibold text-primary tabular-nums">{formatCurrency(avgLtv)}</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {ltvByClient.map((c, i) => {
                      const pct = ltvByClient[0].ltv > 0 ? (c.ltv / ltvByClient[0].ltv) * 100 : 0;
                      const statusColor = c.status === 'Ativo'
                        ? 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]'
                        : c.status === 'Pausado'
                        ? 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]'
                        : c.status === 'Cancelado'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-muted text-muted-foreground';
                      return (
                        <div key={c.id} className="group rounded-lg border border-border/40 bg-card/40 p-3 hover:border-primary/40 hover:bg-card/80 transition-all">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold tabular-nums ${i < 3 ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'bg-secondary text-muted-foreground'}`}>
                                {i + 1}
                              </span>
                              <span className="font-medium text-sm text-foreground truncate">{c.name}</span>
                              <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 ${statusColor}`}>{c.status}</Badge>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-bold text-sm text-foreground tabular-nums">{formatCurrency(c.ltv)}</div>
                              <div className="text-[10px] text-muted-foreground tabular-nums">
                                {c.monthsPaid} {c.monthsPaid === 1 ? 'mês pago' : 'meses pagos'}
                                {c.contractsCount > 1 ? ` · ${c.contractsCount} contratos` : ''}
                              </div>
                            </div>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-secondary/60 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(var(--success))] transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* LTV — Tabela completa ordenável */}
          {ltvByClient.length > 0 && (
            <motion.div {...anim(9)}>
              <LtvTable rows={ltvByClient.map(c => ({
                id: c.id,
                name: c.name,
                status: c.status,
                monthlyValue: c.monthlyValue,
                monthsPaid: c.monthsPaid,
                contractsCount: c.contractsCount,
                ltv: c.ltv,
              }))} />
            </motion.div>
          )}

          {newClients.length > 0 && (
            <motion.div {...anim(8)}>
              <Card className="border-border/60 rounded-[2rem] bg-card">
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
                          <p className="font-semibold tabular-nums text-[hsl(var(--success))]">{formatCurrency(effectiveMonthlyValue(c))}</p>
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
            <Card className="border-border/60 rounded-[2rem] bg-card">
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
                            {formatCurrency(effectiveMonthlyValue(c))}
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

          {/* Churn — taxa + receita perdida + histórico */}
          <motion.div {...anim(10)}>
            <Card className="border-destructive/30 rounded-[2rem] bg-card overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowDownRight className="h-4 w-4 text-destructive" />
                  Churn & Retenção
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Taxas do mês */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Taxa de Churn (mês)</p>
                    <p className="mt-1 text-3xl font-bold tabular-nums text-destructive">
                      {churnRate.toFixed(churnRate % 1 === 0 ? 0 : 1)}%
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                      {churnedThisMonth.length} {churnedThisMonth.length === 1 ? 'cliente saiu' : 'clientes saíram'} · mês passado {churnRateLastMonth.toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">MRR perdido (mês)</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{formatCurrency(lostMrrThisMonth)}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">equivalente a {mrrChurnRate.toFixed(1)}% do MRR</p>
                  </div>
                  <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Receita perdida total</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-destructive">{formatCurrency(receitaPerdidaTotal)}/mês</p>
                    <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">{churnedClients.length} {churnedClients.length === 1 ? 'cliente cancelado' : 'clientes cancelados'}</p>
                  </div>
                  <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Base no início do mês</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{baseAtStartOfMonth}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">clientes para cálculo da taxa</p>
                  </div>
                </div>

                {/* Histórico + lista */}
                <div className="grid gap-5 lg:grid-cols-2">
                  {/* Evolução da taxa */}
                  <div className="rounded-2xl border border-border/50 bg-card/40 p-4">
                    <p className="mb-2 text-xs font-semibold text-foreground">Evolução da taxa de churn (12 meses)</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={churnHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 3.7%, 15.9%)" vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: 'hsl(240, 5%, 64.9%)', fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
                        <YAxis tick={{ fill: 'hsl(240, 5%, 64.9%)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={38} />
                        <Tooltip
                          contentStyle={{ background: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 3.7%, 15.9%)', borderRadius: 8, fontSize: 12 }}
                          formatter={(v: number) => [`${v}%`, 'Taxa de churn']}
                        />
                        <Bar dataKey="churn" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Lista de cancelados */}
                  <div className="rounded-2xl border border-border/50 bg-card/40 p-4">
                    <p className="mb-2 text-xs font-semibold text-foreground">
                      Clientes cancelados {churnedClients.length > 0 && `(${churnedClients.length})`}
                    </p>
                    {churnedClients.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">Nenhum cancelamento.</p>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {churnedClients.map(c => (
                          <div key={c.id} className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive font-bold">
                                {c.companyName.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-foreground truncate">{c.companyName}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {c.cancelledAt ? `Cancelado em ${new Date(c.cancelledAt).toLocaleDateString('pt-BR')}` : 'Sem data de cancelamento'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold tabular-nums text-destructive">{formatCurrency(effectiveMonthlyValue(c))}</p>
                              <p className="text-[10px] text-muted-foreground">valor cancelado</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Expenses & Investments */}
          <ExpensesPanel mrr={mrr} clients={clients} />
        </TabsContent>

        {/* ==================== DELIVERY TAB ==================== */}
        <TabsContent value="entregas" className="space-y-6">
          {/* Delivery KPIs — Bento */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total de Tarefas', value: tasks.length, icon: CheckSquare, accent: 'text-primary', highlight: true },
              { label: 'Concluídas', value: completedTasks.length, icon: CheckCircle2, accent: 'text-[hsl(var(--success))]', highlight: false },
              { label: 'Em Andamento', value: inProgressTasks.length, icon: Clock, accent: 'text-muted-foreground', highlight: false },
              { label: 'Atrasadas', value: overdueTasks.length, icon: AlertTriangle, accent: 'text-[hsl(var(--warning))]', highlight: false },
            ].map((kpi, i) => (
              <motion.div key={kpi.label} {...anim(i)}>
                <div className="group relative bg-card p-6 rounded-[2rem] border border-border/60 hover:border-primary/40 transition-all duration-300 hover:-translate-y-0.5">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`p-2.5 rounded-xl bg-secondary/70 ${kpi.accent}`}>
                      <kpi.icon className="h-5 w-5" />
                    </div>
                    {kpi.highlight && (
                      <span className="text-primary text-[10px] font-bold bg-primary/10 px-2.5 py-1 rounded-full uppercase tracking-wider">Total</span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1.5">{kpi.label}</p>
                  <h3 className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums text-foreground">{kpi.value}</h3>
                </div>
              </motion.div>
            ))}
          </div>


          {/* Completion Progress */}
          <motion.div {...anim(4)}>
            <Card className="border-border/60 rounded-[2rem] bg-card">
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
              <Card className="border-border/60 rounded-[2rem] bg-card">
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
              <Card className="border-border/60 rounded-[2rem] bg-card">
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
            <Card className="border-border/60 rounded-[2rem] bg-card">
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

// Sortable LTV table
type LtvRow = {
  id: string;
  name: string;
  status: string;
  monthlyValue: number;
  monthsPaid: number;
  contractsCount: number;
  ltv: number;
};
type SortKey = 'name' | 'status' | 'monthlyValue' | 'monthsPaid' | 'contractsCount' | 'ltv';

function LtvTable({ rows }: { rows: LtvRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('ltv');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'status' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />;
  };

  const headerBtn = (label: string, k: SortKey, align: 'left' | 'right' = 'left') => (
    <button
      onClick={() => toggleSort(k)}
      className={`inline-flex items-center gap-1.5 hover:text-foreground transition-colors ${align === 'right' ? 'justify-end w-full' : ''}`}
    >
      {label}
      <SortIcon k={k} />
    </button>
  );

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const statusColor = (s: string) =>
    s === 'Ativo' ? 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]'
    : s === 'Pausado' ? 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]'
    : s === 'Cancelado' ? 'bg-destructive/10 text-destructive'
    : 'bg-muted text-muted-foreground';

  return (
    <Card className="border-border/60 rounded-[2rem] bg-card overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-primary" /> Ranking Completo de LTV
          <Badge variant="secondary" className="ml-1 text-[10px] font-normal">
            {rows.length} {rows.length === 1 ? 'cliente' : 'clientes'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="text-muted-foreground text-xs font-semibold">{headerBtn('Cliente', 'name')}</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold">{headerBtn('Status', 'status')}</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold text-right">{headerBtn('Valor mensal', 'monthlyValue', 'right')}</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold text-right">{headerBtn('Meses pagos', 'monthsPaid', 'right')}</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold text-right hidden sm:table-cell">{headerBtn('Contratos', 'contractsCount', 'right')}</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold text-right">{headerBtn('LTV total', 'ltv', 'right')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => (
                <TableRow key={r.id} className="border-border/40 hover:bg-secondary/30">
                  <TableCell className="font-medium text-sm">{r.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`text-[10px] px-2 py-0 ${statusColor(r.status)}`}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{fmt(r.monthlyValue)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{r.monthsPaid}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm hidden sm:table-cell">{r.contractsCount}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-bold text-primary">{fmt(r.ltv)}</TableCell>
                </TableRow>
              ))}
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    Nenhum contrato assinado encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}


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
          <Card className="border-border/60 rounded-[2rem] bg-card">
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
          <Card className="border-border/60 rounded-[2rem] bg-card">
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
