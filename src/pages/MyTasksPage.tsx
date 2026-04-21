import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ListChecks, Loader2, AlertCircle, Calendar, Clock, Search, KanbanSquare, List as ListIcon } from 'lucide-react';
import { format, isPast, isToday, parseISO } from 'date-fns';
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

interface Client { id: string; company_name: string; }

const STATUSES = ['A fazer', 'Em andamento', 'Em revisão', 'Concluído'];

const ROLE_FIELDS: (keyof Task)[] = ['assignee', 'copywriter', 'editor', 'director', 'videomaker', 'script_writer'];

export default function MyTasksPage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterClient, setFilterClient] = useState<string>('all');
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

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (filterClient !== 'all' && t.client_id !== filterClient) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tasks, filterPriority, filterClient, search]);

  const stats = useMemo(() => {
    const pendentes = tasks.filter(t => t.status !== 'Concluído').length;
    const atrasadas = tasks.filter(t => t.due_date && t.status !== 'Concluído' && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date))).length;
    const hoje = tasks.filter(t => t.due_date && isToday(parseISO(t.due_date))).length;
    return { pendentes, atrasadas, hoje };
  }, [tasks]);

  const clientName = (id: string | null) => clients.find(c => c.id === id)?.company_name ?? '';

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ListChecks className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Minhas Tarefas</h1>
          <p className="text-sm text-muted-foreground">Olá {fullName.split(' ')[0] || ''} — tudo direcionado a você</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-2xl font-bold">{stats.pendentes}</p></CardContent></Card>
        <Card className={stats.atrasadas > 0 ? 'border-destructive/40' : ''}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {stats.atrasadas > 0 && <AlertCircle className="h-3 w-3 text-destructive" />} Atrasadas
            </p>
            <p className={`text-2xl font-bold ${stats.atrasadas > 0 ? 'text-destructive' : ''}`}>{stats.atrasadas}</p>
          </CardContent>
        </Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Para hoje</p><p className="text-2xl font-bold text-primary">{stats.hoje}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-8" />
        </div>
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
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          <Button size="sm" variant={view === 'kanban' ? 'default' : 'ghost'} onClick={() => setView('kanban')}>
            <KanbanSquare className="h-4 w-4" />
          </Button>
          <Button size="sm" variant={view === 'list' ? 'default' : 'ghost'} onClick={() => setView('list')}>
            <ListIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma tarefa direcionada a você {tasks.length === 0 ? 'ainda' : 'com esses filtros'}.
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
      ) : (
        <div className="space-y-2">
          {filtered.map(t => <TaskCard key={t.id} task={t} clientName={clientName(t.client_id)} onMove={moveTask} compact />)}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, clientName, onMove, compact }: {
  task: Task; clientName: string; onMove: (id: string, status: string) => void; compact?: boolean;
}) {
  const overdue = task.due_date && task.status !== 'Concluído' && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date));
  const priorityColor = task.priority === 'Alta' ? 'destructive' : task.priority === 'Média' ? 'default' : 'secondary';

  return (
    <Card className={overdue ? 'border-destructive/40' : ''}>
      <CardContent className={compact ? 'p-3' : 'p-3 space-y-2'}>
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-sm text-foreground line-clamp-2 flex-1">{task.title}</p>
          <Badge variant={priorityColor as any} className="text-[10px] shrink-0">{task.priority}</Badge>
        </div>
        {clientName && <p className="text-xs text-muted-foreground">{clientName}</p>}
        {task.due_date && (
          <p className={`text-xs flex items-center gap-1 ${overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
            <Calendar className="h-3 w-3" />
            {format(parseISO(task.due_date), "dd 'de' MMM", { locale: ptBR })}
            {overdue && ' (atrasada)'}
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
