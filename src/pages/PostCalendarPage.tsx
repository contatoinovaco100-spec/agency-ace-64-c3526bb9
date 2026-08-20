import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Clock, Building2, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAgency } from '@/contexts/AgencyContext';
import { Task, TaskType } from '@/types/agency';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAYS_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DAYS_FULL = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];

const TASK_TYPE_COLORS: Record<TaskType, { bg: string; text: string; border: string }> = {
  'Geral':              { bg: '#3b82f61A', text: '#3b82f6', border: '#3b82f640' },
  'Arte':               { bg: '#a855f71A', text: '#a855f7', border: '#a855f740' },
  'Produção de Vídeo':  { bg: '#10b9811A', text: '#10b981', border: '#10b98140' },
};

const PRIORITY_COLORS: Record<string, { bg: string; dot: string }> = {
  'Alta':   { bg: '#ef444420', dot: '#ef4444' },
  'Média':  { bg: '#f59e0b20', dot: '#f59e0b' },
  'Baixa':  { bg: '#22c55e20', dot: '#22c55e' },
};

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay();
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function PostCalendarPage() {
  const { tasks, clients } = useAgency();
  const today = useMemo(() => new Date(), []);

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedClientId, setSelectedClientId] = useState<string>('all');

  const weekStart = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + weekOffset * 7);
    return getWeekStart(d);
  }, [today, weekOffset]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    }),
  [weekStart]);

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach(c => { map[c.id] = c.companyName; });
    return map;
  }, [clients]);

  const scheduledTasks = useMemo(() => {
    return tasks.filter(t =>
      t.postDate &&
      !t.deletedAt
    );
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (selectedClientId === 'all') return scheduledTasks;
    return scheduledTasks.filter(t => t.clientId === selectedClientId);
  }, [scheduledTasks, selectedClientId]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    weekDays.forEach(d => {
      map[formatDateISO(d)] = [];
    });
    filteredTasks.forEach(task => {
      const key = task.postDate!;
      if (map[key]) {
        map[key].push(task);
      }
    });
    Object.keys(map).forEach(key => {
      map[key].sort((a, b) => (a.postTime || '').localeCompare(b.postTime || ''));
    });
    return map;
  }, [filteredTasks, weekDays]);

  const totalPostsThisWeek = useMemo(() => {
    return Object.values(tasksByDate).reduce((sum, arr) => sum + arr.length, 0);
  }, [tasksByDate]);

  const weekLabel = `${weekDays[0].getDate()} ${MONTHS[weekDays[0].getMonth()].slice(0, 3)} – ${weekDays[6].getDate()} ${MONTHS[weekDays[6].getMonth()].slice(0, 3)} ${weekDays[6].getFullYear()}`;

  const isCurrentWeek = weekDays.some(d => isSameDay(d, today));

  const clientsWithPosts = useMemo(() => {
    const ids = new Set(scheduledTasks.map(t => t.clientId).filter(Boolean));
    return clients.filter(c => ids.has(c.id));
  }, [clients, scheduledTasks]);

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl shadow-inner">
              <CalendarDays className="h-7 w-7 text-primary" />
            </div>
            Calendário de Postagens
          </h1>
          <p className="text-muted-foreground text-sm font-medium ml-1">
            Visualize as postagens agendadas por semana
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Client filter */}
          <div className="flex items-center gap-2 bg-secondary/40 backdrop-blur-md rounded-xl border border-border/50 px-2 py-1">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="w-[180px] h-9 border-0 bg-transparent text-sm font-semibold focus:ring-0">
                <SelectValue placeholder="Todos os clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clientsWithPosts.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedClientId !== 'all' && (
              <button onClick={() => setSelectedClientId('all')} className="p-1 hover:bg-destructive/10 rounded-md transition-colors">
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 bg-card/60 backdrop-blur-md border border-border/50 rounded-xl px-4 py-2.5 shadow-sm">
          <CalendarDays className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">{totalPostsThisWeek}</span>
          <span className="text-xs font-medium text-muted-foreground">postagens na semana</span>
        </div>
        <div className="flex items-center gap-2 bg-card/60 backdrop-blur-md border border-border/50 rounded-xl px-4 py-2.5 shadow-sm">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-bold text-foreground">{clientsWithPosts.length}</span>
          <span className="text-xs font-medium text-muted-foreground">clientes ativos</span>
        </div>
      </div>

      {/* Calendar navigation */}
      <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-md shadow-sm overflow-hidden">
        {/* Nav header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-secondary/20">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekOffset(w => w - 1)}
              className="rounded-xl bg-background/50 hover:bg-background shadow-sm border-border/50 h-9 w-9"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-bold tracking-tight text-foreground min-w-[220px] text-center">
              {weekLabel}
            </h2>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekOffset(w => w + 1)}
              className="rounded-xl bg-background/50 hover:bg-background shadow-sm border-border/50 h-9 w-9"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {!isCurrentWeek && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset(0)}
              className="rounded-xl text-xs font-semibold gap-1.5 border-border/50 bg-background/50 hover:bg-background shadow-sm"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Hoje
            </Button>
          )}
        </div>

        {/* Week grid */}
        <div className="grid grid-cols-7 divide-x divide-border/30">
          {weekDays.map((day, idx) => {
            const dateKey = formatDateISO(day);
            const dayTasks = tasksByDate[dateKey] || [];
            const isToday = isSameDay(day, today);
            const isWeekend = idx === 0 || idx === 6;

            return (
              <div
                key={dateKey}
                className={cn(
                  'min-h-[520px] flex flex-col',
                  isWeekend && 'bg-muted/20'
                )}
              >
                {/* Day header */}
                <div
                  className={cn(
                    'sticky top-0 px-2 py-3 text-center border-b border-border/40 transition-all duration-200',
                    isToday
                      ? 'bg-primary/10 border-b-primary/30'
                      : 'bg-secondary/10'
                  )}
                >
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                    {DAYS_SHORT[idx]}
                  </div>
                  <div
                    className={cn(
                      'text-2xl font-bold mt-1 inline-flex w-10 h-10 items-center justify-center rounded-full transition-all',
                      isToday
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30 ring-4 ring-primary/10'
                        : 'text-foreground'
                    )}
                  >
                    {day.getDate()}
                  </div>
                  {dayTasks.length > 0 && (
                    <div className="mt-1.5">
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
                      >
                        {dayTasks.length} {dayTasks.length === 1 ? 'post' : 'posts'}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Tasks */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {dayTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 px-2">
                      <div className="h-8 w-8 rounded-full bg-muted/30 flex items-center justify-center mb-2">
                        <CalendarDays className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                      <p className="text-[11px] font-medium text-muted-foreground/40 text-center">Sem posts</p>
                    </div>
                  ) : (
                    dayTasks.map(task => {
                      const typeColor = TASK_TYPE_COLORS[task.taskType] || TASK_TYPE_COLORS['Geral'];
                      const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS['Média'];
                      const clientName = clientMap[task.clientId] || 'Sem cliente';

                      return (
                        <div
                          key={task.id}
                          className={cn(
                            'group relative rounded-xl border p-3 transition-all duration-200',
                            'hover:shadow-md hover:-translate-y-0.5 cursor-default',
                            'bg-background/80'
                          )}
                          style={{
                            backgroundColor: typeColor.bg,
                            borderColor: typeColor.border,
                          }}
                        >
                          {/* Priority dot */}
                          <div className="flex items-start gap-2">
                            <div
                              className="mt-1.5 h-2 w-2 rounded-full shrink-0 ring-2 ring-background/50"
                              style={{ backgroundColor: priorityColor.dot }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-foreground leading-tight line-clamp-2">
                                {task.title}
                              </p>
                              <p className="text-[11px] font-medium mt-1.5 flex items-center gap-1 truncate" style={{ color: typeColor.text }}>
                                <Building2 className="h-3 w-3 shrink-0" />
                                {clientName}
                              </p>
                            </div>
                          </div>

                          {/* Time */}
                          {task.postTime && (
                            <div className="flex items-center gap-1 mt-2 text-[11px] font-semibold text-muted-foreground bg-background/40 w-fit px-2 py-0.5 rounded-md">
                              <Clock className="h-3 w-3" />
                              {task.postTime.slice(0, 5)}
                            </div>
                          )}

                          {/* Type badge */}
                          <div className="mt-2">
                            <Badge
                              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0 rounded-md border"
                              style={{
                                backgroundColor: typeColor.bg,
                                color: typeColor.text,
                                borderColor: typeColor.border,
                              }}
                            >
                              {task.taskType === 'Produção de Vídeo' ? 'Vídeo' : task.taskType}
                            </Badge>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming posts list */}
      <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-md shadow-sm p-6">
        <h3 className="text-lg font-extrabold tracking-tight text-foreground mb-5 flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          Próximas Postagens
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredTasks
            .filter(t => t.postDate! >= formatDateISO(today))
            .sort((a, b) => {
              const dateCmp = a.postDate!.localeCompare(b.postDate!);
              if (dateCmp !== 0) return dateCmp;
              return (a.postTime || '').localeCompare(b.postTime || '');
            })
            .slice(0, 9)
            .map(task => {
              const typeColor = TASK_TYPE_COLORS[task.taskType] || TASK_TYPE_COLORS['Geral'];
              const clientName = clientMap[task.clientId] || 'Sem cliente';
              const postDate = new Date(task.postDate! + 'T12:00:00');

              return (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-4 rounded-xl border bg-background/80 hover:bg-background hover:shadow-md hover:border-primary/20 transition-all duration-200"
                  style={{ borderColor: typeColor.border }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0"
                    style={{ backgroundColor: typeColor.bg }}
                  >
                    <span className="text-[10px] font-bold uppercase" style={{ color: typeColor.text }}>
                      {MONTHS[postDate.getMonth()].slice(0, 3)}
                    </span>
                    <span className="text-lg font-extrabold leading-none" style={{ color: typeColor.text }}>
                      {postDate.getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground line-clamp-1">{task.title}</p>
                    <p className="text-xs font-medium text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                      <Building2 className="h-3 w-3 shrink-0" />
                      {clientName}
                    </p>
                    {task.postTime && (
                      <p className="text-xs font-semibold mt-1.5 flex items-center gap-1" style={{ color: typeColor.text }}>
                        <Clock className="h-3 w-3" />
                        {task.postTime.slice(0, 5)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

          {filteredTasks.filter(t => t.postDate! >= formatDateISO(today)).length === 0 && (
            <div className="col-span-full py-10 text-center bg-secondary/30 rounded-2xl border border-dashed border-border flex flex-col items-center justify-center">
              <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <CalendarDays className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-semibold text-foreground">Nenhuma postagem futura</p>
              <p className="text-xs text-muted-foreground">Agende postagens no Kanban para vê-las aqui.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
