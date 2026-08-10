import { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAgency } from '@/contexts/AgencyContext';
import { Task } from '@/types/agency';
import { Plus, Filter, Search, X, Users, ChevronDown, ChevronLeft, ChevronRight, FolderCheck, CheckCircle2, RefreshCw, Copy, Film, FolderOpen, FileSpreadsheet, Undo2 } from 'lucide-react';
import { BulkImportDialog } from '@/components/tasks/BulkImportDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { todaySP, normalizeDate, dateGroupMeta, formatFullDate, addDays } from '@/lib/kanbanDateGroups';
import TaskDetailPanel from '@/components/tasks/TaskDetailPanel';
import ArteAttachmentsPreview from '@/components/tasks/ArteAttachmentsPreview';
import { useKanbanStages, colorClasses, KanbanStage } from '@/hooks/useKanbanStages';
import { useJobTitle } from '@/hooks/useJobTitle';
import { useUserRole } from '@/hooks/useUserRole';

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

const PRIORITY_RANK: Record<string, number> = { Alta: 0, Média: 1, Baixa: 2 };
const byPriority = (a: Task, b: Task) =>
  (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3);

// Map raw DB statuses (some legacy) onto the closest UI column name.
function buildStatusToColumn(columnNames: string[]) {
  const set = new Set(columnNames);
  return (status: string): string => {
    if (set.has(status)) return status;
    const legacy: Record<string, string> = {
      'A fazer': 'Ideias / Backlog',
      'Em andamento': 'Em Copy',
      'Em copy': 'Em Copy',
      'Em direção': 'Em Direção',
      'Em gravação': 'Em Gravação',
      'Em edição': 'Em Edição',
    };
    const mapped = legacy[status];
    if (mapped && set.has(mapped)) return mapped;
    return columnNames[0] || status;
  };
}

// ── Card Content (shared between card and overlay) ─────────
function CardContent({ task, clientName, compact, onArtPreview }: {
  task: Task; clientName?: string; compact?: boolean; onArtPreview?: (urls: string[], index: number) => void;
}) {
  const displayName = task.videoName || task.title || 'Sem título';
  const isArte = task.taskType === 'Arte';
  const date = task.dueDate || task.postDate;
  const dateLabel = task.dueDate ? 'Entrega' : 'Post';
  const dateValue = date
    ? new Date(date.replace(/-/g, '/')).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    : null;

  if (!compact) {
    return (
      <>
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn(
            'shrink-0 rounded flex items-center justify-center h-6 w-6',
            isArte ? 'bg-pink-500/15 text-pink-400' : 'bg-primary/15 text-primary'
          )}>
            {isArte ? (
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
            ) : (
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
            )}
          </div>
          <p className="font-medium text-foreground leading-snug truncate flex-1 text-sm">
            {displayName}
          </p>
        </div>
        {clientName && (
          <p className="mt-0.5 text-[10px] text-primary/70 font-medium truncate">{clientName}</p>
        )}
        {task.description && (
          <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">{task.description}</p>
        )}
        {task.videoUrl && (
          <a
            href={task.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="mt-1 inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary hover:bg-primary/20 transition-colors"
            title="Baixar vídeo finalizado"
          >
            <svg width="10" height="10" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
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
        {isArte && <ArteAttachmentsPreview taskId={task.id} compact={false} onPreviewClick={onArtPreview} />}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className={cn('rounded px-1 py-[1px] text-[9px] font-semibold leading-tight', PRIORITY_BADGE[task.priority])}>
              {task.priority}
            </span>
            {task.approvedByClient && (
              <span className="inline-flex items-center gap-0.5 rounded bg-green-500/15 px-1.5 py-[1px] text-[9px] font-bold text-green-600 dark:text-green-400 border border-green-500/30" title={`Aprovado pelo cliente em ${task.approvedAt ? new Date(task.approvedAt).toLocaleDateString('pt-BR') : ''}`}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
                Aprovado
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            {task.assignee && (
              <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[9px] font-bold text-primary" title={task.assignee}>
                {task.assignee.charAt(0).toUpperCase()}
              </div>
            )}
            {dateValue && (
              <span className="text-[9px] tabular-nums text-muted-foreground truncate" title={dateLabel}>
                {dateLabel}: {dateValue}
                {task.postTime ? ` ${task.postTime.slice(0, 5)}` : ''}
              </span>
            )}
          </div>
        </div>
      </>
    );
  }

  // Compact list-row style
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <div className={cn(
          'shrink-0 rounded flex items-center justify-center h-4 w-4',
          isArte ? 'bg-pink-500/15 text-pink-400' : 'bg-primary/15 text-primary'
        )}>
          {isArte ? (
            <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
          ) : (
            <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-[11px] font-medium text-foreground leading-tight truncate">
              {displayName}
            </p>
            {task.videoUrl && (
              <span title="Vídeo enviado para aprovação" aria-label="Vídeo enviado para aprovação">
                <Film className="h-3 w-3 shrink-0 text-primary" />
              </span>
            )}
            {task.rawFootageUrl && (
              <span title="Material bruto disponível no Drive" aria-label="Material bruto disponível">
                <FolderOpen className="h-3 w-3 shrink-0 text-amber-500" />
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
            {clientName && (
              <span className="text-[9px] text-primary/70 truncate max-w-[90px]">{clientName}</span>
            )}
            {dateValue && (
              <span className="text-[9px] tabular-nums text-muted-foreground truncate" title={dateLabel}>
                {dateValue}{task.postTime ? ` ${task.postTime.slice(0, 5)}` : ''}
              </span>
            )}
          </div>
        </div>
        <span className={cn('rounded px-1 py-[1px] text-[8px] font-semibold leading-tight', PRIORITY_BADGE[task.priority])}>
          {task.priority}
        </span>
      </div>
      {isArte && <ArteAttachmentsPreview taskId={task.id} compact onPreviewClick={onArtPreview} />}
    </div>
  );
}

// ── Draggable Card ─────────────────────────────────────────
function DraggableCard({
  task, onClick, clientName, borderClass, onAdvance, nextStageLabel, onDuplicate, onArtPreview, onReopen,
}: {
  task: Task; onClick: () => void; clientName?: string; borderClass: string;
  onAdvance?: () => void; nextStageLabel?: string | null; onDuplicate?: () => void; onArtPreview?: (urls: string[], index: number) => void;
  onReopen?: () => void;
}) {
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
        'group relative cursor-grab rounded-md border-l-[2px] bg-card py-1 px-1.5 transition-shadow hover:shadow-sm active:cursor-grabbing',
        borderClass,
        isDragging && 'opacity-40',
      )}
    >
      {onDuplicate && (
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          onPointerDown={(e) => e.stopPropagation()}
          title="Duplicar tarefa"
          className="absolute top-0.5 right-0.5 z-10 flex h-5 w-5 items-center justify-center rounded bg-secondary/70 text-muted-foreground opacity-0 transition-opacity hover:bg-primary/20 hover:text-primary group-hover:opacity-100"
        >
          <Copy className="h-3 w-3" />
        </button>
      )}
      <CardContent task={task} clientName={clientName} compact onArtPreview={onArtPreview} />
      {onAdvance && nextStageLabel && (
        <button
          onClick={(e) => { e.stopPropagation(); onAdvance(); }}
          onPointerDown={(e) => e.stopPropagation()}
          title={nextStageLabel}
          className="mt-1 flex w-full items-center justify-center gap-1 rounded bg-primary/10 py-0.5 text-[9px] font-semibold text-primary transition-colors hover:bg-primary/20"
        >
          <CheckCircle2 className="h-3 w-3" /> → {nextStageLabel}
        </button>
      )}
      {onReopen && (
        <button
          onClick={(e) => { e.stopPropagation(); onReopen(); }}
          onPointerDown={(e) => e.stopPropagation()}
          title="Voltar para alteração"
          className="mt-1 flex w-full items-center justify-center gap-1 rounded bg-warning/10 py-0.5 text-[9px] font-semibold text-warning transition-colors hover:bg-warning/20"
        >
          <Undo2 className="h-3 w-3" /> Voltar p/ alteração
        </button>
      )}
    </div>
  );
}

// ── Droppable Column ───────────────────────────────────────
function KanbanColumn({
  stage,
  tasks,
  onCardClick,
  onAdd,
  getClientName,
  onAdvanceTask,
  nextStageName,
  showAddButton,
  onDuplicateTask,
  onArtPreview,
  prefix,
  onReopenTask,
}: {
  stage: KanbanStage;
  tasks: Task[];
  onCardClick: (t: Task) => void;
  onAdd: () => void;
  getClientName: (id: string) => string;
  onAdvanceTask: (task: Task, nextStage: string) => void;
  nextStageName: string | null;
  showAddButton: boolean;
  onDuplicateTask?: (task: Task) => void;
  onArtPreview?: (urls: string[], index: number) => void;
  prefix?: string;
  onReopenTask?: (task: Task) => void;
}) {
  const droppableId = prefix ? `${prefix}::${stage.name}` : stage.name;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });
  const cc = colorClasses(stage.color);

  return (
    <div className="flex min-w-0 flex-1 flex-col h-full">
      <div className={cn('mb-1.5 flex items-center justify-between rounded-lg border px-2 py-1.5', cc.bg)}>
        <div className="flex items-center gap-1.5">
          <div className={cn('h-1.5 w-1.5 rounded-full', cc.dot)} />
          <span className="text-xs font-semibold text-foreground">{stage.name}</span>
        </div>
        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-secondary text-[9px] font-bold tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-1 rounded-lg p-1 transition-colors min-h-[120px]',
          isOver && 'bg-primary/5 ring-1 ring-primary/20',
        )}
      >
        {tasks.map(task => (
          <DraggableCard
            key={task.id}
            task={task}
            onClick={() => onCardClick(task)}
            clientName={getClientName(task.clientId)}
            borderClass={cc.border}
            onAdvance={nextStageName ? () => onAdvanceTask(task, nextStageName) : undefined}
            nextStageLabel={nextStageName}
            onDuplicate={onDuplicateTask ? () => onDuplicateTask(task) : undefined}
            onArtPreview={onArtPreview}
            onReopen={onReopenTask ? () => onReopenTask(task) : undefined}
          />

        ))}

        {showAddButton && (
          <button
            onClick={onAdd}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" /> Nova tarefa
          </button>
        )}
      </div>
    </div>
  );
}

// ── Finalizado / Concluído Drop Zone + Client Folders ─────
function ArchiveDraggableItem({ task, onClick, onReopen }: { task: Task; onClick: () => void; onReopen?: () => void }) {
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
        'group flex items-center gap-2 rounded px-2 py-1.5 cursor-grab hover:bg-secondary/30 transition-colors active:cursor-grabbing',
        isDragging && 'opacity-40'
      )}
    >
      <div className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_COLORS[task.priority]?.replace('border-l-', 'bg-') || 'bg-muted')} />
      <span className="flex-1 text-xs text-foreground truncate">{task.videoName || task.title || 'Sem título'}</span>
      {onReopen && (
        <button
          onClick={(e) => { e.stopPropagation(); onReopen(); }}
          onPointerDown={(e) => e.stopPropagation()}
          title="Voltar para alteração"
          className="flex h-5 shrink-0 items-center gap-1 rounded bg-warning/15 px-1.5 text-[9px] font-semibold text-warning opacity-0 transition-opacity hover:bg-warning/25 group-hover:opacity-100"
        >
          <Undo2 className="h-3 w-3" /> Reabrir
        </button>
      )}
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
  defaultOpen,
  onReopenTask,
}: {
  id: string;
  label: string;
  helperText: string;
  tasks: Task[];
  onCardClick: (t: Task) => void;
  getClientName: (id: string) => string;
  accentClass: string;
  iconColorClass: string;
  defaultOpen?: boolean;
  onReopenTask?: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(!!defaultOpen);

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
                      <ArchiveDraggableItem key={t.id} task={t} onClick={() => onCardClick(t)} onReopen={onReopenTask ? () => onReopenTask(t) : undefined} />
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
  taskTypeFilter?: 'Arte' | 'Produção de Vídeo';
  pageTitle?: string;
  pageHint?: string;
  headerExtra?: React.ReactNode;
  /** Agrupa o kanban por data de entrega (seções por dia + Atrasadas/Sem prazo/Histórico). */
  groupedByDueDate?: boolean;
}

interface DateGroup {
  key: string;
  label: string;
  subtitle: string;
  dateStr: string | null;
  tasks: Task[];
  columns: Record<string, Task[]>;
}

export default function TasksPage({ taskTypeFilter, pageTitle, pageHint, headerExtra, groupedByDueDate }: TasksPageProps = {}) {
  const { tasks, clients, team, addTask, updateTask, deleteTask, moveTaskToStage, refresh } = useAgency();
  const board = taskTypeFilter === 'Arte' ? 'artes' : 'tasks';
  const { stages: allDbStages } = useKanbanStages(board);
  const { isEditor } = useJobTitle();
  const { isAdmin: isAdminUser } = useUserRole();
  // Editor (cargo) no kanban de vídeo enxerga somente de "Em edição" até "Finalizado".
  const dbStages = useMemo(() => {
    if (!isEditor || isAdminUser || board !== 'tasks') return allDbStages;
    const idx = allDbStages.findIndex(s => s.name.trim().toLowerCase().startsWith('em edi'));
    if (idx < 0) return allDbStages;
    return allDbStages.slice(idx).filter(s => s.name !== 'Concluído');
  }, [allDbStages, isEditor, isAdminUser, board]);


  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [newDefaultDueDate, setNewDefaultDueDate] = useState('');
  const [newDefaultStatus, setNewDefaultStatus] = useState('');
  const [arteTab, setArteTab] = useState<'progress' | 'done'>('progress');
  const [artPreview, setArtPreview] = useState<{ urls: string[]; index: number } | null>(null);

  // Open a specific task when navigated with ?taskId=xxx (e.g. from history bell)
  useEffect(() => {
    const tid = searchParams.get('taskId');
    if (!tid) return;
    const t = tasks.find(x => x.id === tid);
    if (t) {
      setSelectedTask(t);
      setCreating(false);
      setDialogOpen(true);
      searchParams.delete('taskId');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, tasks, setSearchParams]);

  // Lightbox de arte: fecha com Escape e navega com setas
  useEffect(() => {
    if (!artPreview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArtPreview(null);
      else if (e.key === 'ArrowLeft') setArtPreview(p => p ? { ...p, index: (p.index - 1 + p.urls.length) % p.urls.length } : p);
      else if (e.key === 'ArrowRight') setArtPreview(p => p ? { ...p, index: (p.index + 1) % p.urls.length } : p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [artPreview]);

  const openArtPreview = (urls: string[], index: number) => setArtPreview({ urls, index });


  const [selectedClient, setSelectedClient] = useState<string>('all');

  // If the selected client becomes inactive/removed, reset to "all"
  const activeClientIds = useMemo(() => new Set(clients.filter(c => c.status === 'Ativo').map(c => c.id)), [clients]);
  if (selectedClient !== 'all' && !activeClientIds.has(selectedClient)) {
    // defer to avoid setState during render
    setTimeout(() => setSelectedClient('all'), 0);
  }

  const [search, setSearch] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Stage groups: the "Concluído" stage (if present) is rendered as an archive zone,
  // everything else as a regular kanban column.
  const archiveStageNames = useMemo(() => new Set(['Concluído']), []);
  const kanbanStages = useMemo(
    () => dbStages.filter(s => !archiveStageNames.has(s.name)),
    [dbStages, archiveStageNames],
  );
  const archiveStages = useMemo(
    () => dbStages.filter(s => archiveStageNames.has(s.name)),
    [dbStages, archiveStageNames],
  );
  // "Finalizado" é isolado em uma aba própria destacada (modo agrupado do kanban de artes).
  const finalizadoStageNames = useMemo(
    () => new Set(dbStages.filter(s => s.name.trim().toLowerCase() === 'finalizado').map(s => s.name)),
    [dbStages],
  );
  const progressStages = useMemo(
    () => kanbanStages.filter(s => !finalizadoStageNames.has(s.name)),
    [kanbanStages, finalizadoStageNames],
  );
  const allColumnNames = dbStages.map(s => s.name);

  const mapStatusToColumn = useMemo(
    () => buildStatusToColumn(allColumnNames),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allColumnNames.join('|')],
  );

  const getNextStageName = (currentName: string): string | null => {
    const idx = dbStages.findIndex(s => s.name === currentName);
    if (idx < 0 || idx >= dbStages.length - 1) return null;
    return dbStages[idx + 1].name;
  };

  /** Reabre uma tarefa finalizada/concluída: volta para a etapa anterior (alteração). */
  const handleReopenTask = (task: Task) => {
    const current = mapStatusToColumn(task.status as string);
    const idx = dbStages.findIndex(s => s.name === current);
    const target = idx > 0 ? dbStages[idx - 1].name : (kanbanStages[0]?.name || dbStages[0]?.name);
    if (target) moveTaskToStage(task.id, target);
  };

  const isFinalStage = (name: string) =>
    finalizadoStageNames.has(name) || archiveStageNames.has(name);


  const cancelledClientIds = useMemo(
    () => new Set(clients.filter(c => c.status === 'Cancelado').map(c => c.id)),
    [clients],
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (taskTypeFilter) {
        if (t.taskType !== taskTypeFilter) return false;
      } else {
        if (t.taskType === 'Arte') return false;
      }
      // Hide tasks belonging to cancelled clients from the kanban
      if (t.clientId && cancelledClientIds.has(t.clientId)) return false;
      if (selectedClient !== 'all' && t.clientId !== selectedClient) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = (t.videoName || t.title || '').toLowerCase();
        if (!name.includes(q) && !t.description?.toLowerCase().includes(q)) return false;
      }
      if (filterAssignee !== 'all' && t.assignee !== filterAssignee) return false;
      return true;
    });
  }, [tasks, taskTypeFilter, selectedClient, search, filterAssignee, cancelledClientIds]);

  const tasksByColumn = useMemo(() => {
    const map: Record<string, Task[]> = {};
    allColumnNames.forEach(c => (map[c] = []));
    filteredTasks.forEach(t => {
      const col = mapStatusToColumn(t.status);
      if (!map[col]) map[col] = [];
      map[col].push(t);
    });

    // No kanban de arte, ordena por data (hoje → amanhã → sem data)
    if (taskTypeFilter === 'Arte') {
      const sortByDate = (a: Task, b: Task) => {
        const dateA = a.dueDate || a.postDate;
        const dateB = b.dueDate || b.postDate;
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        const dA = new Date(dateA.replace(/-/g, '/')).setHours(0, 0, 0, 0);
        const dB = new Date(dateB.replace(/-/g, '/')).setHours(0, 0, 0, 0);
        return dA - dB;
      };
      Object.keys(map).forEach(col => {
        map[col] = [...map[col]].sort(sortByDate);
      });
    }

    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTasks, allColumnNames.join('|'), taskTypeFilter]);

  // Agrupamento por data de entrega (somente modo agrupado): Atrasadas → Hoje →
  // Amanhã → Próximos dias → Sem prazo. Tarefas em "Finalizado" ficam na aba
  // isolada "Finalizadas".
  const dateGroups = useMemo<DateGroup[]>(() => {
    if (!groupedByDueDate) return [];
    const today = todaySP();
    const tomorrow = addDays(today, 1);
    const byDate = new Map<string, Task[]>();
    const late: Task[] = [];
    const future: Task[] = [];
    const noDate: Task[] = [];

    filteredTasks.forEach(t => {
      const col = mapStatusToColumn(t.status);
      if (col === 'Concluído') return; // arquivo interno (zona de drop separada)
      if (finalizadoStageNames.has(col)) return; // isoladas na aba Finalizadas
      const d = normalizeDate(t.dueDate);
      if (!d) {
        noDate.push(t);
      } else if (d < today) {
        late.push(t);
      } else if (d === today || d === tomorrow) {
        if (!byDate.has(d)) byDate.set(d, []);
        byDate.get(d)!.push(t);
      } else {
        future.push(t);
      }
    });

    const makeGroup = (
      key: string,
      label: string,
      subtitle: string,
      dateStr: string | null,
      tasks: Task[],
    ): DateGroup => {
      const columns: Record<string, Task[]> = {};
      progressStages.forEach(s => (columns[s.name] = []));
      tasks.forEach(t => {
        const col = mapStatusToColumn(t.status);
        if (columns[col]) columns[col].push(t);
      });
      Object.values(columns).forEach(arr => arr.sort(byPriority));
      return { key, label, subtitle, dateStr, tasks, columns };
    };

    const result: DateGroup[] = [];
    if (late.length > 0) {
      result.push(makeGroup('late', 'Atrasadas', `Vencidas antes de ${formatFullDate(today)}`, null, late));
    }
    [today, tomorrow].forEach(dk => {
      const tasks = byDate.get(dk);
      if (!tasks || tasks.length === 0) return;
      const meta = dateGroupMeta(dk, today);
      result.push(makeGroup(dk, meta.label, meta.subtitle, dk, tasks));
    });
    if (future.length > 0) {
      const futureStart = addDays(today, 2);
      const futureSubtitle = `A partir de ${new Date(`${futureStart}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
      result.push(makeGroup('future', 'Próximos dias', futureSubtitle, futureStart, future));
    }
    if (noDate.length > 0) {
      result.push(makeGroup('nodate', 'Sem prazo', 'Defina a data de entrega no card', null, noDate));
    }
    return result;
  }, [filteredTasks, mapStatusToColumn, progressStages, finalizadoStageNames, groupedByDueDate]);

  // Tarefas na etapa "Finalizado" (para a aba isolada), ordenadas por data de entrega.
  const finalizadasTasks = useMemo(() => {
    if (!groupedByDueDate) return [];
    return filteredTasks
      .filter(t => finalizadoStageNames.has(mapStatusToColumn(t.status)))
      .sort((a, b) => {
        const d1 = a.dueDate || a.postDate || '';
        const d2 = b.dueDate || b.postDate || '';
        if (!d1 && !d2) return 0;
        if (!d1) return 1;
        if (!d2) return -1;
        return d1.localeCompare(d2);
      });
  }, [filteredTasks, mapStatusToColumn, finalizadoStageNames, groupedByDueDate]);

  const finalizadasCount = finalizadasTasks.length;
  const productionCount = filteredTasks.length - finalizadasCount;

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = active.id as string;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const overId = over.id as string;

    // ── Modo agrupado por data ──
    if (groupedByDueDate) {
      const today = todaySP();
      const groupKeyForTask = (t: Task): string => {
        const col = mapStatusToColumn(t.status);
        if (col === 'Concluído') return 'archive';
        if (finalizadoStageNames.has(col)) return 'finalizadas';
        const d = normalizeDate(t.dueDate);
        if (!d) return 'nodate';
        if (d < today) return 'late';
        if (d === today || d === addDays(today, 1)) return d;
        return 'future';
      };
      const dueDateForGroup = (groupKey: string, currentDate: string): string | null => {
        if (groupKey === 'nodate') return '';
        if (groupKey === 'late' || groupKey === 'history' || groupKey === 'finalizadas') return null;
        if (groupKey === 'future') {
          const cd = normalizeDate(currentDate);
          return cd && cd > addDays(today, 1) ? cd : addDays(today, 2);
        }
        return groupKey;
      };

      let newColumn: string;
      let newDueDate: string | null;
      if (overId.startsWith('GROUP::')) {
        const parts = overId.split('::');
        newColumn = parts[2];
        newDueDate = dueDateForGroup(parts[1], task.dueDate || '');
      } else if (allColumnNames.includes(overId)) {
        newColumn = overId;
        newDueDate = null;
      } else {
        const overTask = tasks.find(t => t.id === overId);
        if (overTask) {
          newColumn = mapStatusToColumn(overTask.status);
          newDueDate = dueDateForGroup(groupKeyForTask(overTask), task.dueDate || '');
        } else {
          newColumn = mapStatusToColumn(overId);
          newDueDate = null;
        }
      }

      const currentColumn = mapStatusToColumn(task.status);
      const statusChanged = currentColumn !== newColumn;
      const dateChanged = newDueDate !== null && newDueDate !== (task.dueDate || '');
      if (!statusChanged && !dateChanged) return;
      try {
        if (dateChanged) {
          await updateTask({ ...task, status: newColumn as Task['status'], dueDate: newDueDate || '' });
        } else {
          await moveTaskToStage(taskId, newColumn);
        }
      } catch (err) {
        console.error('Failed to move task:', err);
      }
      return;
    }

    let newColumn: string;

    if (allColumnNames.includes(overId)) {
      newColumn = overId;
    } else {
      const overTask = tasks.find(t => t.id === overId);
      if (overTask) {
        newColumn = mapStatusToColumn(overTask.status);
      } else {
        newColumn = mapStatusToColumn(overId);
      }
    }

    const currentColumn = mapStatusToColumn(task.status);
    if (currentColumn === newColumn) return;

    try {
      await moveTaskToStage(taskId, newColumn);
    } catch (err) {
      console.error('Failed to move task:', err);
    }
  };

  const openCard = (t: Task) => {
    setSelectedTask(t);
    setCreating(false);
    setDialogOpen(true);
  };

  const openNew = () => {
    setNewDefaultDueDate('');
    setNewDefaultStatus(firstStageName || 'A fazer');
    setSelectedTask(null);
    setCreating(true);
    setDialogOpen(true);
  };

  const openNewForGroup = (group: DateGroup) => {
    setNewDefaultDueDate(group.dateStr || '');
    setNewDefaultStatus(firstStageName || 'A fazer');
    setSelectedTask(null);
    setCreating(true);
    setDialogOpen(true);
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !(prev[key] ?? key === 'history') }));
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
  const firstStageName = kanbanStages[0]?.name;

  const handleDuplicateTask = async (task: Task) => {
    const { id: _id, ...rest } = task;
    const duplicated: Task = {
      ...rest,
      id: crypto.randomUUID(),
      title: `${task.title || task.videoName || 'Tarefa'} (cópia)`,
      videoName: task.videoName ? `${task.videoName} (cópia)` : '',
      status: (firstStageName || task.status) as any,
    };
    try {
      await addTask(duplicated);
    } catch (err) {
      console.error('Duplicate failed:', err);
    }
  };

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
                    {filteredTasks.filter(t => !archiveStageNames.has(mapStatusToColumn(t.status)) && mapStatusToColumn(t.status) !== 'Finalizado').length} em andamento
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
              <Button variant="outline" size="sm" className="gap-1 flex-1 sm:flex-none" onClick={() => setBulkOpen(true)} title="Criar vários cards de uma vez colando de planilha">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Em massa
              </Button>
              <Button size="sm" className="gap-1 flex-1 sm:flex-none" onClick={openNew}>
                <Plus className="h-4 w-4" /> Nova Tarefa
              </Button>
            </div>
          </div>
        </div>

        {/* Client selector accordion */}
        <ClientAccordionSelector
          clients={clients.filter(c => c.status === 'Ativo')}
          selectedClient={selectedClient}
          onSelect={setSelectedClient}
        />

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

      {/* Aba isolada de tarefas na etapa "Finalizado" */}
      {groupedByDueDate && (
        <div className="flex w-fit items-center gap-1 rounded-lg border border-border bg-card/70 p-1">
          <button
            type="button"
            onClick={() => setArteTab('progress')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              arteTab === 'progress' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Em produção
            <span className={cn('flex h-4 min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums', arteTab === 'progress' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
              {productionCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setArteTab('done')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              arteTab === 'done' ? 'bg-success text-white' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Finalizadas
            <span className={cn('flex h-4 min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums', arteTab === 'done' ? 'bg-white/20 text-white' : 'bg-success/15 text-success')}>
              {finalizadasCount}
            </span>
          </button>
        </div>
      )}

      {/* Kanban board */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {groupedByDueDate ? (
          arteTab === 'done' ? (
            <div className="space-y-5">
              {finalizadasTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  {taskTypeFilter === 'Arte' ? 'Nenhuma arte finalizada ainda.' : 'Nenhuma tarefa finalizada ainda.'}
                </div>
              ) : (
                <div className="space-y-2 rounded-xl border border-success/40 bg-success/5 p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-sm font-bold uppercase tracking-wide text-foreground">Finalizadas</span>
                    <span className="hidden sm:inline text-xs text-muted-foreground">Prontas para o cliente — arraste de volta para refazer</span>
                    <span className="ml-auto flex h-5 min-w-[22px] items-center justify-center rounded-full bg-success/20 px-1.5 text-[10px] font-bold tabular-nums text-success">
                      {finalizadasTasks.length}
                    </span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 scroller-hide">
                    {kanbanStages.map(stage => {
                      const isDone = finalizadoStageNames.has(stage.name);
                      return (
                        <div key={stage.id} className="min-w-[220px] lg:min-w-0 lg:flex-1 flex flex-col">
                          <KanbanColumn
                            prefix="GROUP::finalizadas"
                            stage={stage}
                            tasks={isDone ? finalizadasTasks : []}
                            onCardClick={openCard}
                            onAdd={() => {}}
                            getClientName={getClientName}
                            onAdvanceTask={(task, nextStage) => moveTaskToStage(task.id, nextStage)}
                            nextStageName={getNextStageName(stage.name)}
                            showAddButton={false}
                            onDuplicateTask={handleDuplicateTask}
                            onArtPreview={openArtPreview}
                            onReopenTask={isFinalStage(stage.name) ? handleReopenTask : undefined}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {dateGroups.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  Nenhuma tarefa encontrada para os filtros atuais.
                </div>
              )}
              {dateGroups.map(group => {
                const isCollapsed = collapsedGroups[group.key] ?? false;
                return (
                  <div key={group.key} className="space-y-2">
                    <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-card/70 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.key)}
                        className="flex min-w-0 items-center gap-2 text-left"
                        title={isCollapsed ? 'Expandir seção' : 'Recolher seção'}
                      >
                        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isCollapsed && '-rotate-90')} />
                        <span className="text-sm font-bold uppercase tracking-wide text-foreground">{group.label}</span>
                        <span className="hidden sm:inline text-xs text-muted-foreground">· {group.subtitle}</span>
                        <span className="ml-1 flex h-5 min-w-[22px] items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-bold tabular-nums text-primary">
                          {group.tasks.length}
                        </span>
                      </button>
                      <div className="ml-auto flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-xs text-primary hover:bg-primary/10"
                          onClick={() => openNewForGroup(group)}
                          title={`Nova tarefa com entrega ${group.dateStr ? `em ${group.subtitle}` : 'sem prazo'}`}
                        >
                          <Plus className="h-3.5 w-3.5" /> Nova
                        </Button>
                      </div>
                    </div>

                    {!isCollapsed && (
                      <div className="flex gap-2 overflow-x-auto pb-2 scroller-hide">
                        {progressStages.map(stage => (
                          <div key={`${group.key}-${stage.id}`} className="min-w-[220px] lg:min-w-0 lg:flex-1 flex flex-col">
                            <KanbanColumn
                              prefix={`GROUP::${group.key}`}
                              stage={stage}
                              tasks={group.columns[stage.name] || []}
                              onCardClick={openCard}
                              onAdd={() => openNewForGroup(group)}
                              getClientName={getClientName}
                              onAdvanceTask={(task, nextStage) => moveTaskToStage(task.id, nextStage)}
                              nextStageName={getNextStageName(stage.name)}
                              showAddButton={stage.name === firstStageName}
                              onDuplicateTask={handleDuplicateTask}
                              onArtPreview={openArtPreview}
                              onReopenTask={isFinalStage(stage.name) ? handleReopenTask : undefined}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {archiveStages.map(stage => (
                <ArchiveDropZone
                  key={stage.id}
                  id={stage.name}
                  label={`${stage.name}s (arquivo interno)`}
                  helperText="Ocultos do cliente"
                  tasks={tasksByColumn[stage.name] || []}
                  onCardClick={openCard}
                  getClientName={getClientName}
                  accentClass="border-muted-foreground bg-muted/30"
                  iconColorClass="text-muted-foreground"
                  defaultOpen={false}
                  onReopenTask={handleReopenTask}
                />
              ))}
            </div>
          )
        ) : (
          <>
            <div
              className="flex gap-2 overflow-x-auto pb-3 lg:grid lg:gap-1.5 min-h-0 flex-1 scroller-hide"
              style={{ gridTemplateColumns: `repeat(${Math.max(kanbanStages.length, 1)}, minmax(0, 1fr))` }}
            >
              {kanbanStages.map(stage => (
                <div key={stage.id} className="min-w-[220px] lg:min-w-0 flex flex-col h-full">
                  <KanbanColumn
                    stage={stage}
                    tasks={tasksByColumn[stage.name] || []}
                    onCardClick={openCard}
                    onAdd={openNew}
                    getClientName={getClientName}
                    onAdvanceTask={(task, nextStage) => moveTaskToStage(task.id, nextStage)}
                    nextStageName={getNextStageName(stage.name)}
                    showAddButton={stage.name === firstStageName}
                    onDuplicateTask={handleDuplicateTask}
                    onArtPreview={openArtPreview}
                    onReopenTask={isFinalStage(stage.name) ? handleReopenTask : undefined}
                  />
                </div>
              ))}
            </div>
            {archiveStages.map(stage => (
              <ArchiveDropZone
                key={stage.id}
                id={stage.name}
                label={`${stage.name}s (arquivo interno)`}
                helperText="Ocultos do cliente"
                tasks={tasksByColumn[stage.name] || []}
                onCardClick={openCard}
                getClientName={getClientName}
                accentClass="border-muted-foreground bg-muted/30"
                iconColorClass="text-muted-foreground"
                defaultOpen={false}
                onReopenTask={handleReopenTask}
              />
            ))}
          </>
        )}
        <DragOverlay>
          {activeTask && (
            <div className={cn('w-[180px] rounded-md border-l-[2px] bg-card py-1 px-1.5 shadow-lg', PRIORITY_COLORS[activeTask.priority])}>
              <CardContent task={activeTask} clientName={getClientName(activeTask.clientId)} compact onArtPreview={openArtPreview} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Card detail dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw] sm:w-full h-[75vh] sm:h-[85vh] max-h-[85vh] overflow-hidden flex flex-col p-0">
          <VisuallyHidden><DialogTitle>Tarefa</DialogTitle></VisuallyHidden>
          <TaskDetailPanel
            task={selectedTask}
            isNew={creating}
            clients={clients}
            team={team}
            defaultClientId={selectedClient !== 'all' ? selectedClient : undefined}
            defaultTaskType={taskTypeFilter}
            defaultDueDate={newDefaultDueDate}
            defaultStatus={newDefaultStatus}
            onSave={handleSave}
            onDelete={handleDelete}
            onClose={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <BulkImportDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        taskType={taskTypeFilter || 'Geral'}
        defaultStage={firstStageName || 'A fazer'}
        defaultClientId={selectedClient !== 'all' ? selectedClient : undefined}
      />

      {/* Lightbox de arte (zoom no preview do card) */}
      {artPreview && (() => {
        const total = artPreview.urls.length;
        const current = artPreview.urls[artPreview.index];
        const go = (i: number) => setArtPreview({ urls: artPreview.urls, index: (i + total) % total });
        return (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 sm:p-8"
            onClick={() => setArtPreview(null)}
          >
            <button
              type="button"
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              onClick={(e) => { e.stopPropagation(); setArtPreview(null); }}
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="pointer-events-none absolute right-4 top-16 z-10 flex h-9 items-center rounded-full bg-black/60 px-3 text-xs font-semibold text-white">
              {artPreview.index + 1} / {total}
            </div>

            {total > 1 && (
              <button
                type="button"
                className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                onClick={(e) => { e.stopPropagation(); go(artPreview.index - 1); }}
                aria-label="Arte anterior"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            <img
              src={current}
              alt="Arte em tamanho grande"
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            {total > 1 && (
              <button
                type="button"
                className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                onClick={(e) => { e.stopPropagation(); go(artPreview.index + 1); }}
                aria-label="Próxima arte"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}

            {total > 1 && (
              <div className="absolute bottom-4 left-1/2 z-10 flex max-w-full -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-full bg-black/60 p-2 scroller-hide" onClick={(e) => e.stopPropagation()}>
                {artPreview.urls.map((u, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); go(i); }}
                    className={cn(
                      "h-11 w-11 shrink-0 overflow-hidden rounded-md border-2 transition-all",
                      i === artPreview.index
                        ? "border-primary ring-2 ring-primary/40"
                        : "border-white/15 opacity-60 hover:opacity-100"
                    )}
                    aria-label={`Arte ${i + 1}`}
                  >
                    <img src={u} alt={`Arte ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// Accordion (sanfona) client selector - shows selected client, expands to list
function ClientAccordionSelector({
  clients,
  selectedClient,
  onSelect,
}: {
  clients: { id: string; companyName: string }[];
  selectedClient: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selectedName =
    selectedClient === 'all'
      ? 'Todos os clientes'
      : clients.find(c => c.id === selectedClient)?.companyName || 'Todos os clientes';

  const filtered = useMemo(
    () => (q ? clients.filter(c => c.companyName.toLowerCase().includes(q.toLowerCase())) : clients),
    [clients, q]
  );

  return (
    <div className="rounded-md border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Cliente:</span>
          <span className="text-sm font-medium truncate">{selectedName}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">({clients.length} ativos)</span>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-border p-2 space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar cliente..."
              className="h-8 pl-7 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto">
            <button
              onClick={() => { onSelect('all'); setOpen(false); }}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                selectedClient === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              Todos
            </button>
            {filtered.map(c => (
              <button
                key={c.id}
                onClick={() => { onSelect(c.id); setOpen(false); }}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  selectedClient === c.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                )}
              >
                {c.companyName}
              </button>
            ))}
            {filtered.length === 0 && (
              <span className="text-xs text-muted-foreground px-2 py-1">Nenhum cliente encontrado.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
