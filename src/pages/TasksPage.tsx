import { useState, useMemo, useRef } from 'react';
import { useAgency } from '@/contexts/AgencyContext';
import { Task } from '@/types/agency';
import { Plus, Filter, Search, X, Users, ChevronDown, ChevronRight, FolderCheck, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import TaskDetailPanel from '@/components/tasks/TaskDetailPanel';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

// ── Constants ──────────────────────────────────────────────
const KANBAN_COLUMNS = [
  'Ideias / Backlog',
  'Em Copy',
  'Em Direção',
  'Em Gravação',
  'Em Edição',
  'Revisão',
  'Finalizado',
] as const;

const COLUMNS = [
  ...KANBAN_COLUMNS,
  'Concluído',
] as const;

type ColumnId = (typeof COLUMNS)[number];

const COLUMN_COLORS: Record<string, string> = {
  'Ideias / Backlog': 'bg-muted/60 border-muted-foreground/20',
  'Em Copy': 'bg-primary/8 border-primary/30',
  'Em Direção': 'bg-info/8 border-info/30',
  'Em Gravação': 'bg-warning/8 border-warning/30',
  'Em Edição': 'bg-accent border-accent-foreground/20',
  'Revisão': 'bg-destructive/8 border-destructive/30',
  'Finalizado': 'bg-success/8 border-success/30',
  'Concluído': 'bg-muted/40 border-muted-foreground/30',
};

const COLUMN_DOT: Record<string, string> = {
  'Ideias / Backlog': 'bg-muted-foreground',
  'Em Copy': 'bg-primary',
  'Em Direção': 'bg-info',
  'Em Gravação': 'bg-warning',
  'Em Edição': 'bg-accent-foreground',
  'Revisão': 'bg-destructive',
  'Finalizado': 'bg-success',
  'Concluído': 'bg-muted-foreground',
};

const CARD_STAGE_COLOR: Record<string, string> = {
  'Ideias / Backlog': 'border-l-muted-foreground/60',
  'Em Copy': 'border-l-primary',
  'Em Direção': 'border-l-info',
  'Em Gravação': 'border-l-warning',
  'Em Edição': 'border-l-accent-foreground',
  'Revisão': 'border-l-destructive',
  'Finalizado': 'border-l-success',
  'Concluído': 'border-l-muted-foreground',
};

const PRIORITY_COLORS: Record<string, string> = {
  Alta: 'border-l-destructive',
  Média: 'border-l-warning',
  Baixa: 'border-l-muted-foreground/40',
};

const PRIORITY_BADGE: Record<string, string> = {
  Alta: 'bg-destructive/15 text-destructive',
  Média: 'bg-warning/15 text-warning',
  Baixa: 'bg-muted text-muted-foreground',
};

// ── Helpers ────────────────────────────────────────────────
function mapStatusToColumn(status: string): ColumnId {
  const map: Record<string, ColumnId> = {
    'A fazer': 'Ideias / Backlog',
    'Em andamento': 'Em Copy',
    'Em copy': 'Em Copy',
    'Em direção': 'Em Direção',
    'Em gravação': 'Em Gravação',
    'Em edição': 'Em Edição',
    'Revisão': 'Revisão',
    'Concluído': 'Concluído',
    'Finalizado': 'Finalizado',
    'Ideias / Backlog': 'Ideias / Backlog',
    'Em Copy': 'Em Copy',
    'Em Direção': 'Em Direção',
    'Em Gravação': 'Em Gravação',
    'Em Edição': 'Em Edição',
  };
  return map[status] || 'Ideias / Backlog';
}

// ── Card Content (shared between card and overlay) ─────────
function CardContent({ task, clientName }: { task: Task; clientName?: string }) {
  return (
    <>
      <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
        {task.videoName || task.title || 'Sem título'}
      </p>
      {clientName && (
        <p className="mt-0.5 text-[11px] text-primary/70 font-medium">{clientName}</p>
      )}
      {task.description && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{task.description}</p>
      )}
      {task.videoUrl && (
        <a
          href={task.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors"
          title="Baixar vídeo finalizado"
        >
          <svg width="12" height="12" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
            <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
            <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
            <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
            <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
            <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
            <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
          </svg>
          Baixar vídeo
        </a>
      )}
      <div className="mt-2.5 flex items-start justify-between gap-2">
        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', PRIORITY_BADGE[task.priority])}>
          {task.priority}
        </span>
        <div className="flex items-center gap-1.5 min-w-0">
          {task.assignee && (
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary" title={task.assignee}>
              {task.assignee.charAt(0).toUpperCase()}
            </div>
          )}
          {(task.dueDate || task.postDate) && (
            <div className="flex flex-col items-end gap-0.5 min-w-0">
              {task.dueDate && (
                <span className="text-[10px] tabular-nums text-muted-foreground truncate" title="Data de entrega">
                  Entrega: {new Date(task.dueDate.replace(/-/g, '/')).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </span>
              )}
              {task.postDate && (
                <span className="text-[10px] tabular-nums text-primary/80 truncate" title="Data de postagem">
                  Post: {new Date(task.postDate.replace(/-/g, '/')).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  {task.postTime ? ` ${task.postTime.slice(0, 5)}` : ''}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Draggable Card ─────────────────────────────────────────
function DraggableCard({ task, onClick, clientName, column, onAdvance }: { task: Task; onClick: () => void; clientName?: string; column: string; onAdvance?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e: React.MouseEvent) => {
    if (pointerDownPos.current) {
      const dx = Math.abs(e.clientX - pointerDownPos.current.x);
      const dy = Math.abs(e.clientY - pointerDownPos.current.y);
      if (dx < 5 && dy < 5) {
        onClick();
      }
    }
    pointerDownPos.current = null;
  };

  const nextStageLabel = getNextStageLabel(column);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onPointerDown={(e) => {
        handlePointerDown(e);
        listeners?.onPointerDown?.(e as any);
      }}
      onClick={handleClick}
      className={cn(
        'cursor-grab rounded-lg border-l-[3px] bg-card p-3 transition-shadow hover:shadow-md active:cursor-grabbing',
        CARD_STAGE_COLOR[column] || 'border-l-muted',
        isDragging && 'opacity-40',
      )}
    >
      <CardContent task={task} clientName={clientName} />
      {onAdvance && nextStageLabel && (
        <button
          onClick={(e) => { e.stopPropagation(); onAdvance(); }}
          onPointerDown={(e) => e.stopPropagation()}
          title={nextStageLabel}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-primary/10 py-1 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/20"
        >
          <CheckCircle2 className="h-3 w-3" /> {nextStageLabel}
        </button>
      )}
    </div>
  );
}

function getNextStageLabel(column: string): string | null {
  const order = ['Ideias / Backlog', 'Em Copy', 'Em Direção', 'Em Gravação', 'Em Edição', 'Revisão', 'Finalizado', 'Concluído'];
  const idx = order.indexOf(column);
  if (idx < 0 || idx >= order.length - 1) return null;
  return `→ ${order[idx + 1]}`;
}

function getNextStage(column: string): string | null {
  const order = ['Ideias / Backlog', 'Em Copy', 'Em Direção', 'Em Gravação', 'Em Edição', 'Revisão', 'Finalizado', 'Concluído'];
  const idx = order.indexOf(column);
  if (idx < 0 || idx >= order.length - 1) return null;
  return order[idx + 1];
}

// ── Droppable Column ───────────────────────────────────────
function KanbanColumn({
  column,
  tasks,
  onCardClick,
  onAdd,
  getClientName,
  onAdvanceTask,
}: {
  column: ColumnId;
  tasks: Task[];
  onCardClick: (t: Task) => void;
  onAdd: () => void;
  getClientName: (id: string) => string;
  onAdvanceTask: (task: Task, nextStage: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column });

  return (
    <div className="flex min-w-0 flex-1 flex-col h-full">
      <div className={cn('mb-2 flex items-center justify-between rounded-lg border px-3 py-2', COLUMN_COLORS[column])}>
        <div className="flex items-center gap-2">
          <div className={cn('h-2 w-2 rounded-full', COLUMN_DOT[column])} />
          <span className="text-xs font-semibold text-foreground">{column}</span>
        </div>
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-secondary text-[10px] font-bold tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-2 rounded-lg p-1.5 transition-colors min-h-[120px]',
          isOver && 'bg-primary/5 ring-1 ring-primary/20',
        )}
      >
        {tasks.map(task => {
          const next = getNextStage(column);
          return (
            <DraggableCard
              key={task.id}
              task={task}
              onClick={() => onCardClick(task)}
              clientName={getClientName(task.clientId)}
              column={column}
              onAdvance={next ? () => onAdvanceTask(task, next) : undefined}
            />
          );
        })}

        {column === 'Ideias / Backlog' && (
          <button
            onClick={onAdd}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" /> Nova tarefa
          </button>
        )}
      </div>
    </div>
  );
}

// ── Finalizado / Concluído Drop Zone + Client Folders ─────
function ArchiveDraggableItem({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e: React.MouseEvent) => {
    if (pointerDownPos.current) {
      const dx = Math.abs(e.clientX - pointerDownPos.current.x);
      const dy = Math.abs(e.clientY - pointerDownPos.current.y);
      if (dx < 5 && dy < 5) onClick();
    }
    pointerDownPos.current = null;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onPointerDown={(e) => {
        handlePointerDown(e);
        listeners?.onPointerDown?.(e as any);
      }}
      onClick={handleClick}
      className={cn(
        'flex items-center gap-2 rounded px-2 py-1.5 cursor-grab hover:bg-secondary/30 transition-colors active:cursor-grabbing',
        isDragging && 'opacity-40'
      )}
    >
      <div className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_COLORS[task.priority]?.replace('border-l-', 'bg-') || 'bg-muted')} />
      <span className="text-xs text-foreground truncate">{task.videoName || task.title || 'Sem título'}</span>
    </div>
  );
}

function ArchiveDropZone({
  id,
  label,
  helperText,
  tasks,
  onCardClick,
  getClientName,
  accentClass,
  iconColorClass,
}: {
  id: 'Finalizado' | 'Concluído';
  label: string;
  helperText: string;
  tasks: Task[];
  onCardClick: (t: Task) => void;
  getClientName: (id: string) => string;
  accentClass: string;
  iconColorClass: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(id === 'Finalizado');

  const byClient = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach(t => {
      const key = t.clientId || '_no_client';
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tasks]);

  const toggleClient = (cid: string) => {
    setExpandedClients(prev => ({ ...prev, [cid]: !prev[cid] }));
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-lg border border-dashed p-3 transition-colors',
        isOver ? `${accentClass} ` : 'border-border bg-secondary/5'
      )}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 mb-2"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <FolderCheck className={cn('h-4 w-4', iconColorClass)} />
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">({tasks.length})</span>
        <span className="ml-2 text-[10px] text-muted-foreground italic hidden sm:inline">{helperText}</span>
        {isOver && <span className="text-xs font-medium ml-auto text-foreground">Solte aqui</span>}
      </button>

      {open && tasks.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(byClient).map(([clientId, clientTasks]) => {
            const name = clientId === '_no_client' ? 'Sem cliente' : getClientName(clientId);
            const isOpen = expandedClients[clientId];
            return (
              <div key={clientId} className="rounded-md border border-border bg-card overflow-hidden">
                <button
                  onClick={() => toggleClient(clientId)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-secondary/30 transition-colors"
                >
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className="text-xs font-medium text-foreground truncate flex-1">{name}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground bg-secondary rounded-full px-1.5">{clientTasks.length}</span>
                </button>
                {isOpen && (
                  <div className="border-t border-border p-2 space-y-1.5">
                    {clientTasks.map(t => (
                      <ArchiveDraggableItem key={t.id} task={t} onClick={() => onCardClick(t)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


interface TasksPageProps {
  /** When set, the board only shows tasks of this type and new tasks default to it. */
  taskTypeFilter?: 'Arte' | 'Produção de Vídeo';
  /** Header title override */
  pageTitle?: string;
  /** Header subtitle/description override */
  pageHint?: string;
  /** Extra element rendered in the header actions row (e.g. external link button). */
  headerExtra?: React.ReactNode;
}

export default function TasksPage({ taskTypeFilter, pageTitle, pageHint, headerExtra }: TasksPageProps = {}) {
  const { tasks, clients, team, addTask, updateTask, deleteTask, refresh } = useAgency();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Client selector (main feature)
  const [selectedClient, setSelectedClient] = useState<string>('all');

  // Filters
  const [search, setSearch] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Task type scoping: Artes board only shows Arte tasks, default board hides them
      if (taskTypeFilter) {
        if (t.taskType !== taskTypeFilter) return false;
      } else {
        if (t.taskType === 'Arte') return false;
      }
      // Client filter (main)
      if (selectedClient !== 'all' && t.clientId !== selectedClient) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = (t.videoName || t.title || '').toLowerCase();
        if (!name.includes(q) && !t.description?.toLowerCase().includes(q)) return false;
      }
      if (filterAssignee !== 'all' && t.assignee !== filterAssignee) return false;
      return true;
    });
  }, [tasks, taskTypeFilter, selectedClient, search, filterAssignee]);

  const tasksByColumn = useMemo(() => {
    const map: Record<ColumnId, Task[]> = {} as any;
    COLUMNS.forEach(c => (map[c] = []));
    filteredTasks.forEach(t => {
      const col = mapStatusToColumn(t.status);
      map[col].push(t);
    });
    return map;
  }, [filteredTasks]);

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = active.id as string;
    const newColumn = over.id as ColumnId;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const currentColumn = mapStatusToColumn(task.status);
    if (currentColumn === newColumn) return;
    await updateTask({ ...task, status: newColumn as any });
  };

  const openCard = (t: Task) => {
    setSelectedTask(t);
    setCreating(false);
    setDialogOpen(true);
  };

  const openNew = () => {
    setSelectedTask(null);
    setCreating(true);
    setDialogOpen(true);
  };

  const handleSave = async (data: Task) => {
    if (selectedClient !== 'all' && !data.clientId) {
      data.clientId = selectedClient;
    }
    try {
      if (creating) {
        await addTask(data);
      } else {
        await updateTask(data);
      }
      setDialogOpen(false);
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteTask(id);
    setDialogOpen(false);
  };

  const getClientName = (id: string) => clients.find(c => c.id === id)?.companyName || '';
  const assignees = useMemo(() => [...new Set(tasks.map(t => t.assignee).filter(Boolean))], [tasks]);

  const selectedClientName = selectedClient !== 'all' ? getClientName(selectedClient) : null;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{pageTitle ?? 'Tarefas'}</h1>
            <p className="text-sm text-muted-foreground">
              {pageHint
                ? <>{pageHint}{selectedClientName && <span className="text-primary font-medium"> · {selectedClientName}</span>}</>
                : <>
                    {filteredTasks.filter(t => !['Finalizado', 'Concluído'].includes(mapStatusToColumn(t.status))).length} em andamento
                    {selectedClientName && <span className="text-primary font-medium"> · {selectedClientName}</span>}
                  </>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-9 w-full sm:w-[160px] pl-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {headerExtra}
              <Button
                variant="outline"
                size="sm"
                className="gap-1 flex-1 sm:flex-none"
                onClick={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }}
                disabled={refreshing}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
              </Button>
              <Button variant="outline" size="sm" className="gap-1 flex-1 sm:flex-none" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="h-3.5 w-3.5" /> Filtros
              </Button>
              <Button size="sm" className="gap-1 flex-1 sm:flex-none" onClick={openNew}>
                <Plus className="h-4 w-4" /> Nova Tarefa
              </Button>
            </div>
          </div>
        </div>

        {/* Client selector bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
          <button
            onClick={() => setSelectedClient('all')}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              selectedClient === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            )}
          >
            Todos
          </button>
          {clients.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedClient(c.id)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                selectedClient === c.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              {c.companyName}
            </button>
          ))}
        </div>

        {/* Extra filters */}
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="flex items-center gap-3 overflow-hidden">
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os responsáveis</SelectItem>
                {assignees.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            {filterAssignee !== 'all' && (
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground" onClick={() => setFilterAssignee('all')}>
                <X className="h-3 w-3" /> Limpar
              </Button>
            )}
          </motion.div>
        )}
      </div>

      {/* Kanban board */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 lg:grid lg:grid-cols-7 lg:gap-2 min-h-0 flex-1 scroller-hide">
          {KANBAN_COLUMNS.map(col => (
            <div key={col} className="min-w-[280px] lg:min-w-0 flex flex-col h-full">
              <KanbanColumn column={col} tasks={tasksByColumn[col]} onCardClick={openCard} onAdd={openNew} getClientName={getClientName} onAdvanceTask={(task, nextStage) => updateTask({ ...task, status: nextStage as any })} />
            </div>
          ))}
        </div>
        <ArchiveDropZone
          id="Concluído"
          label="Concluídos (arquivo interno)"
          helperText="Ocultos do cliente"
          tasks={tasksByColumn['Concluído']}
          onCardClick={openCard}
          getClientName={getClientName}
          accentClass="border-muted-foreground bg-muted/30"
          iconColorClass="text-muted-foreground"
        />
        <DragOverlay>
          {activeTask && (
            <div className={cn('w-[200px] rounded-lg border-l-[3px] bg-card p-3 shadow-lg', PRIORITY_COLORS[activeTask.priority])}>
              <CardContent task={activeTask} clientName={getClientName(activeTask.clientId)} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Card detail dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw] sm:w-full h-[90vh] max-h-[90vh] overflow-hidden flex flex-col p-0">
          <VisuallyHidden><DialogTitle>Tarefa</DialogTitle></VisuallyHidden>
          <TaskDetailPanel
            task={selectedTask}
            isNew={creating}
            clients={clients}
            team={team}
            defaultClientId={selectedClient !== 'all' ? selectedClient : undefined}
            defaultTaskType={taskTypeFilter}
            onSave={handleSave}
            onDelete={handleDelete}
            onClose={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
