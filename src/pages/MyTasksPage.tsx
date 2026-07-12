import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ListChecks, Loader2, AlertCircle, Calendar, Search,
  KanbanSquare, List as ListIcon, LayoutGrid, ArrowUpDown, X,
} from 'lucide-react';
import { format, isPast, isToday, isThisWeek, parseISO, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string | null;
  client_id: string | null;
  assignee: string;
  copywriter: string;
  editor: string;
  director: string;
  videomaker: string;
  script_writer: string;
  task_type: string;
}

interface Client { id: string; company_name: string; status?: string | null; }

const STATUSES = ['A fazer', 'Em andamento', 'Em revisão', 'Concluído'];
const PRIORITY_ORDER: Record<string, number> = { Alta: 0, Média: 1, Baixa: 2 };
const ROLE_FIELDS: (keyof Task)[] = ['assignee', 'copywriter', 'editor', 'director', 'videomaker', 'script_writer'];

type View = 'kanban' | 'list' | 'grouped';
type SortKey = 'smart' | 'due_asc' | 'due_desc' | 'priority' | 'title';
type GroupKey = 'client' | 'status' | 'type' | 'priority';
type QuickFilter = 'all' | 'today' | 'overdue' | 'week' | 'no_date' | 'open';

export default function MyTasksPage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<View>('kanban');
  const [quick, setQuick] = useState<QuickFilter>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('smart');
  const [groupBy, setGroupBy] = useState<GroupKey>('client');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
      const name = profile?.full_name ?? '';
      setFullName(name);

      const [{ data: t }, { data: c }] = await Promise.all([
        supabase.from('tasks').select('*'),
        supabase.from('clients').select('id, company_name'),
      ]);

      const mine = (t ?? []).filter((task: any) =>
        ROLE_FIELDS.some(f => (task[f] || '').trim().toLowerCase() === name.trim().toLowerCase())
      );
      setTasks(mine as Task[]);
      setClients((c ?? []) as Client[]);
      setLoading(false);
    })();
  }, [user]);

  const moveTask = async (taskId: string, newStatus: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
  };

  const taskTypes = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach(t => t.task_type && s.add(t.task_type));
    return Array.from(s);
  }, [tasks]);

  const isOverdue = (t: Task) =>
    !!t.due_date && t.status !== 'Concluído' && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date));

  const filtered = useMemo(() => {
    let list = tasks.filter(t => {
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (filterClient !== 'all' && t.client_id !== filterClient) return false;
      if (filterType !== 'all' && t.task_type !== filterType) return false;
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false;
      }
      if (quick === 'today') return !!t.due_date && isToday(parseISO(t.due_date));
      if (quick === 'overdue') return isOverdue(t);
      if (quick === 'week') return !!t.due_date && isThisWeek(parseISO(t.due_date), { weekStartsOn: 1 });
      if (quick === 'no_date') return !t.due_date;
      if (quick === 'open') return t.status !== 'Concluído';
      return true;
    });

    const cmpDue = (a: Task, b: Task, dir: 1 | -1) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return (parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime()) * dir;
    };

    list = [...list].sort((a, b) => {
      if (sortBy === 'due_asc') return cmpDue(a, b, 1);
      if (sortBy === 'due_desc') return cmpDue(a, b, -1);
      if (sortBy === 'priority') return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      // smart: atrasadas > hoje > prioridade > data
      const aOver = isOverdue(a) ? 0 : 1;
      const bOver = isOverdue(b) ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      const aToday = a.due_date && isToday(parseISO(a.due_date)) ? 0 : 1;
      const bToday = b.due_date && isToday(parseISO(b.due_date)) ? 0 : 1;
      if (aToday !== bToday) return aToday - bToday;
      const pr = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      if (pr !== 0) return pr;
      return cmpDue(a, b, 1);
    });

    return list;
  }, [tasks, filterPriority, filterClient, filterType, filterStatus, search, quick, sortBy]);

  const stats = useMemo(() => {
    const pendentes = tasks.filter(t => t.status !== 'Concluído').length;
    const atrasadas = tasks.filter(isOverdue).length;
    const hoje = tasks.filter(t => t.due_date && isToday(parseISO(t.due_date)) && t.status !== 'Concluído').length;
    const semana = tasks.filter(t => t.due_date && isThisWeek(parseISO(t.due_date), { weekStartsOn: 1 }) && t.status !== 'Concluído').length;
    return { pendentes, atrasadas, hoje, semana };
  }, [tasks]);

  const clientName = (id: string | null) => clients.find(c => c.id === id)?.company_name ?? 'Sem cliente';

  const groups = useMemo(() => {
    if (view !== 'grouped') return [] as { key: string; label: string; items: Task[] }[];
    const map = new Map<string, { key: string; label: string; items: Task[] }>();
    filtered.forEach(t => {
      let key = 'sem'; let label = '—';
      if (groupBy === 'client') { key = t.client_id || 'sem'; label = clientName(t.client_id); }
      else if (groupBy === 'status') { key = t.status; label = t.status; }
      else if (groupBy === 'type') { key = t.task_type || 'sem'; label = t.task_type || 'Sem tipo'; }
      else if (groupBy === 'priority') { key = t.priority; label = t.priority; }
      if (!map.has(key)) map.set(key, { key, label, items: [] });
      map.get(key)!.items.push(t);
    });
    return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length);
  }, [filtered, groupBy, view, clients]);

  const activeFiltersCount =
    (filterPriority !== 'all' ? 1 : 0) +
    (filterClient !== 'all' ? 1 : 0) +
    (filterType !== 'all' ? 1 : 0) +
    (filterStatus !== 'all' ? 1 : 0) +
    (quick !== 'all' ? 1 : 0) +
    (search ? 1 : 0);

  const clearFilters = () => {
    setFilterPriority('all'); setFilterClient('all'); setFilterType('all');
    setFilterStatus('all'); setQuick('all'); setSearch('');
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ListChecks className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Minhas Tarefas</h1>
          <p className="text-sm text-muted-foreground">Olá {fullName.split(' ')[0] || ''} — organize seu dia</p>
        </div>
      </div>

      {/* Stats — clicáveis */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Pendentes" value={stats.pendentes} active={quick === 'open'} onClick={() => setQuick(quick === 'open' ? 'all' : 'open')} />
        <StatCard label="Atrasadas" value={stats.atrasadas} tone="danger" active={quick === 'overdue'} onClick={() => setQuick(quick === 'overdue' ? 'all' : 'overdue')} />
        <StatCard label="Para hoje" value={stats.hoje} tone="primary" active={quick === 'today'} onClick={() => setQuick(quick === 'today' ? 'all' : 'today')} />
        <StatCard label="Esta semana" value={stats.semana} active={quick === 'week'} onClick={() => setQuick(quick === 'week' ? 'all' : 'week')} />
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tarefa ou descrição..." className="pl-8" />
          </div>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas prioridades</SelectItem>
              <SelectItem value="Alta">Alta</SelectItem>
              <SelectItem value="Média">Média</SelectItem>
              <SelectItem value="Baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos clientes</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
            </SelectContent>
          </Select>

          {taskTypes.length > 0 && (
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                {taskTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="w-[170px]">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="smart">Inteligente</SelectItem>
              <SelectItem value="due_asc">Prazo (mais próximo)</SelectItem>
              <SelectItem value="due_desc">Prazo (mais distante)</SelectItem>
              <SelectItem value="priority">Prioridade</SelectItem>
              <SelectItem value="title">Título (A–Z)</SelectItem>
            </SelectContent>
          </Select>

          {activeFiltersCount > 0 && (
            <Button size="sm" variant="ghost" onClick={clearFilters} className="gap-1">
              <X className="h-3.5 w-3.5" /> Limpar ({activeFiltersCount})
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList>
              <TabsTrigger value="kanban" className="gap-1"><KanbanSquare className="h-4 w-4" /> Kanban</TabsTrigger>
              <TabsTrigger value="list" className="gap-1"><ListIcon className="h-4 w-4" /> Lista</TabsTrigger>
              <TabsTrigger value="grouped" className="gap-1"><LayoutGrid className="h-4 w-4" /> Agrupado</TabsTrigger>
            </TabsList>
          </Tabs>

          {view === 'grouped' && (
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupKey)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Agrupar por cliente</SelectItem>
                <SelectItem value="status">Agrupar por status</SelectItem>
                <SelectItem value="type">Agrupar por tipo</SelectItem>
                <SelectItem value="priority">Agrupar por prioridade</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma tarefa {tasks.length === 0 ? 'direcionada a você ainda' : 'com esses filtros'}.
        </CardContent></Card>
      ) : view === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {STATUSES.map(status => {
            const items = filtered.filter(t => t.status === status);
            return (
              <div key={status} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold text-foreground">{status}</h3>
                  <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {items.map(t => <TaskCard key={t.id} task={t} clientName={clientName(t.client_id)} onMove={moveTask} />)}
                </div>
              </div>
            );
          })}
        </div>
      ) : view === 'list' ? (
        <div className="space-y-2">
          {filtered.map(t => <TaskCard key={t.id} task={t} clientName={clientName(t.client_id)} onMove={moveTask} compact />)}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(g => (
            <div key={g.key} className="space-y-2">
              <div className="flex items-center gap-2 border-b border-border pb-1">
                <h3 className="text-sm font-semibold text-foreground">{g.label}</h3>
                <Badge variant="secondary" className="text-xs">{g.items.length}</Badge>
              </div>
              <div className="space-y-2">
                {g.items.map(t => <TaskCard key={t.id} task={t} clientName={clientName(t.client_id)} onMove={moveTask} compact />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tone, active, onClick }: {
  label: string; value: number; tone?: 'danger' | 'primary'; active?: boolean; onClick?: () => void;
}) {
  const border = active ? 'border-primary ring-1 ring-primary/40' : tone === 'danger' && value > 0 ? 'border-destructive/40' : '';
  const valueClass = tone === 'danger' && value > 0 ? 'text-destructive' : tone === 'primary' ? 'text-primary' : '';
  return (
    <button onClick={onClick} className="text-left">
      <Card className={`transition ${border} hover:border-primary/50`}>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {tone === 'danger' && value > 0 && <AlertCircle className="h-3 w-3 text-destructive" />} {label}
          </p>
          <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
        </CardContent>
      </Card>
    </button>
  );
}

function TaskCard({ task, clientName, onMove, compact }: {
  task: Task; clientName: string; onMove: (id: string, status: string) => void; compact?: boolean;
}) {
  const overdue = task.due_date && task.status !== 'Concluído' && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date));
  const today = task.due_date && isToday(parseISO(task.due_date));
  const priorityColor = task.priority === 'Alta' ? 'destructive' : task.priority === 'Média' ? 'default' : 'secondary';
  const daysLabel = task.due_date ? (() => {
    const d = differenceInCalendarDays(parseISO(task.due_date), new Date());
    if (d === 0) return 'hoje';
    if (d === 1) return 'amanhã';
    if (d < 0) return `${Math.abs(d)}d atrás`;
    return `em ${d}d`;
  })() : null;

  return (
    <Card className={overdue ? 'border-destructive/40' : today ? 'border-primary/40' : ''}>
      <CardContent className={compact ? 'p-3 space-y-1.5' : 'p-3 space-y-2'}>
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-sm text-foreground line-clamp-2 flex-1">{task.title}</p>
          <Badge variant={priorityColor as any} className="text-[10px] shrink-0">{task.priority}</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {clientName && <span className="text-xs text-muted-foreground truncate">{clientName}</span>}
          {task.task_type && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{task.task_type}</Badge>}
        </div>
        {task.due_date && (
          <p className={`text-xs flex items-center gap-1 ${overdue ? 'text-destructive font-medium' : today ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
            <Calendar className="h-3 w-3" />
            {format(parseISO(task.due_date), "dd 'de' MMM", { locale: ptBR })}
            {daysLabel && ` · ${daysLabel}`}
          </p>
        )}
        <Select value={task.status} onValueChange={(v) => onMove(task.id, v)}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
