import { useMemo, useState, useEffect } from 'react';
import { useAgency } from '@/contexts/AgencyContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, Clock, TrendingDown, UserX, Bell,
  ChevronRight, CalendarClock, DollarSign, X
} from 'lucide-react';

interface Alert {
  id: string;
  type: 'danger' | 'warning' | 'info';
  icon: any;
  title: string;
  description: string;
  action?: string;
}

const typeStyles: Record<string, { border: string; bg: string; icon: string; badge: string }> = {
  danger: {
    border: 'border-l-4 border-l-destructive',
    bg: 'bg-destructive/5',
    icon: 'text-destructive',
    badge: 'bg-destructive/10 text-destructive',
  },
  warning: {
    border: 'border-l-4 border-l-[hsl(var(--warning))]',
    bg: 'bg-[hsl(var(--warning))]/5',
    icon: 'text-[hsl(var(--warning))]',
    badge: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]',
  },
  info: {
    border: 'border-l-4 border-l-[hsl(var(--info))]',
    bg: 'bg-[hsl(var(--info))]/5',
    icon: 'text-[hsl(var(--info))]',
    badge: 'bg-[hsl(var(--info))]/10 text-[hsl(var(--info))]',
  },
};

export function SmartAlerts() {
  const { clients, tasks } = useAgency();
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('smart_alerts_dismissed');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('smart_alerts_dismissed', JSON.stringify(dismissedIds));
  }, [dismissedIds]);

  const dismissAlert = (id: string) => {
    setDismissedIds(prev => [...prev, id]);
  };

  const alerts = useMemo(() => {
    const result: Alert[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // 🚨 Tarefas atrasadas (por cliente)
    const pendingTasks = tasks.filter(t => !['Concluído', 'Finalizado'].includes(t.status));
    const overdueTasks = pendingTasks.filter(t => t.dueDate && t.dueDate < todayStr);
    if (overdueTasks.length > 0) {
      // Group by client
      const byClient: Record<string, typeof overdueTasks> = {};
      overdueTasks.forEach(t => {
        const key = t.clientId || '_sem_cliente';
        if (!byClient[key]) byClient[key] = [];
        byClient[key].push(t);
      });
      Object.entries(byClient).forEach(([clientId, tasks]) => {
        const client = clients.find(c => c.id === clientId);
        const maxDays = Math.max(...tasks.map(t => Math.ceil((today.getTime() - new Date(t.dueDate).getTime()) / 86400000)));
        result.push({
          id: `overdue-${clientId}`,
          type: maxDays > 7 ? 'danger' : 'warning',
          icon: AlertTriangle,
          title: `${tasks.length} entrega${tasks.length > 1 ? 's' : ''} atrasada${tasks.length > 1 ? 's' : ''} — ${client?.companyName || 'Sem cliente'}`,
          description: `Maior atraso: ${maxDays} dias. Tarefas: ${tasks.map(t => t.title).join(', ')}`,
          action: 'Verificar tarefas',
        });
      });
    }

    // ⏰ Entregas próximas do prazo (próximos 3 dias)
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysStr = threeDaysFromNow.toISOString().split('T')[0];
    const urgentTasks = pendingTasks.filter(t => t.dueDate && t.dueDate >= todayStr && t.dueDate <= threeDaysStr);
    if (urgentTasks.length > 0) {
      urgentTasks.forEach(t => {
        const client = clients.find(c => c.id === t.clientId);
        const daysLeft = Math.ceil((new Date(t.dueDate).getTime() - today.getTime()) / 86400000);
        result.push({
          id: `urgent-${t.id}`,
          type: daysLeft === 0 ? 'danger' : 'warning',
          icon: CalendarClock,
          title: daysLeft === 0
            ? `"${t.title}" vence HOJE`
            : `"${t.title}" vence em ${daysLeft} dia${daysLeft > 1 ? 's' : ''}`,
          description: `${client?.companyName || 'Sem cliente'} · Responsável: ${t.assignee || 'Não definido'}`,
          action: 'Priorizar',
        });
      });
    }

    // ⚠️ Clientes sem tarefas ativas (sem atividade)
    const activeClients = clients.filter(c => c.status === 'Ativo');
    activeClients.forEach(c => {
      const clientTasks = tasks.filter(t => t.clientId === c.id);
      const hasActiveTasks = clientTasks.some(t => !['Concluído', 'Finalizado'].includes(t.status));
      if (!hasActiveTasks && clientTasks.length === 0) {
        result.push({
          id: `inactive-${c.id}`,
          type: 'info',
          icon: UserX,
          title: `${c.companyName} sem nenhuma atividade`,
          description: `Cliente ativo sem tarefas cadastradas. Risco de churn.`,
          action: 'Criar tarefa',
        });
      } else if (!hasActiveTasks && clientTasks.length > 0) {
        // All tasks done, no new ones
        const lastCompleted = clientTasks
          .filter(t => ['Concluído', 'Finalizado'].includes(t.status))
          .sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''))[0];
        if (lastCompleted?.dueDate) {
          const daysSince = Math.ceil((today.getTime() - new Date(lastCompleted.dueDate).getTime()) / 86400000);
          if (daysSince > 7) {
            result.push({
              id: `idle-${c.id}`,
              type: daysSince > 14 ? 'warning' : 'info',
              icon: UserX,
              title: `${c.companyName} sem atividade há ${daysSince} dias`,
              description: `Última entrega: "${lastCompleted.title}". Considere agendar uma reunião ou criar novas demandas.`,
              action: 'Entrar em contato',
            });
          }
        }
      }
    });

    // 📉 Queda de receita - clientes pausados/cancelados recentemente
    const pausedClients = clients.filter(c => c.status === 'Pausado');
    const cancelledClients = clients.filter(c => c.status === 'Cancelado');
    if (pausedClients.length > 0) {
      const lostRevenue = pausedClients.reduce((s, c) => s + c.monthlyValue, 0);
      result.push({
        id: 'paused-revenue',
        type: 'warning',
        icon: TrendingDown,
        title: `${pausedClients.length} cliente${pausedClients.length > 1 ? 's' : ''} pausado${pausedClients.length > 1 ? 's' : ''} — R$ ${lostRevenue.toLocaleString('pt-BR')} em risco`,
        description: `Clientes: ${pausedClients.map(c => c.companyName).join(', ')}. Receita que pode ser recuperada.`,
        action: 'Reativar',
      });
    }
    if (cancelledClients.length > 0) {
      const lostRevenue = cancelledClients.reduce((s, c) => s + c.monthlyValue, 0);
      result.push({
        id: 'cancelled-revenue',
        type: 'danger',
        icon: DollarSign,
        title: `R$ ${lostRevenue.toLocaleString('pt-BR')}/mês perdidos — ${cancelledClients.length} cancelamento${cancelledClients.length > 1 ? 's' : ''}`,
        description: `${cancelledClients.map(c => c.companyName).join(', ')}`,
      });
    }

    // Sort: danger first, then warning, then info
    const order: Record<string, number> = { danger: 0, warning: 1, info: 2 };
    const sorted = result.sort((a, b) => order[a.type] - order[b.type]);
    
    // Filter out dismissed alerts
    return sorted.filter(a => !dismissedIds.includes(a.id));
  }, [clients, tasks, dismissedIds]);

  if (alerts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-border/50 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base w-full">
            <div className="relative">
              <Bell className="h-4 w-4 text-primary" />
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
              </span>
            </div>
            Alertas Inteligentes
            <Badge variant="secondary" className="text-xs">{alerts.length}</Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setDismissedIds(prev => [...prev, ...alerts.map(a => a.id)])}
              className="ml-auto h-7 px-2 text-[10px] font-bold uppercase tracking-wider hover:text-destructive"
            >
              Limpar Tudo
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          <AnimatePresence>
            {alerts.map((alert, i) => {
              const styles = typeStyles[alert.type];
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  className={`flex items-start gap-3 rounded-lg p-3 ${styles.bg} ${styles.border}`}
                >
                  <alert.icon className={`h-5 w-5 mt-0.5 shrink-0 ${styles.icon}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground leading-tight">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{alert.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.action && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap ${styles.badge}`}>
                        {alert.action} <ChevronRight className="h-3 w-3" />
                      </span>
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissAlert(alert.id);
                      }}
                      className="p-1 rounded-full hover:bg-foreground/10 text-muted-foreground transition-colors"
                      title="Dispensar alerta"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
