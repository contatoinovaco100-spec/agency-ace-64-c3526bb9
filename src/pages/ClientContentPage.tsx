import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import logoInova from '@/assets/logo-inova.png';
import { cn } from '@/lib/utils';
import { Clapperboard, Calendar, Target, FileText, Link2, MessageSquare, Loader2, ChevronDown, ChevronRight, CheckCircle, Eye, EyeOff, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface TaskData {
  id: string;
  title: string;
  video_name: string;
  description: string;
  video_idea: string;
  full_script: string;
  video_references: string;
  observations: string;
  video_objective: string;
  platform: string;
  format: string;
  due_date: string | null;
  scheduled_date: string | null;
  assignee: string;
  client_id: string | null;
  priority: string;
  status: string;
  creative_direction: string;
  editing_style: string;
  strategic_notes: string;
}

function TaskCard({ task, index, onConfirm, onConfirmProgram, confirming }: { task: TaskData; index: number; onConfirm: (taskId: string) => void; onConfirmProgram: (taskId: string) => void; confirming?: boolean }) {
  const [open, setOpen] = useState(index === 0);
  const videoName = task.video_name || task.title || 'Sem título';
  
  const isPosted = task.status === 'Postado';
  const isProgramado = task.status === 'Programado';
  const displayDate = task.scheduled_date || task.due_date;
  const formattedDate = displayDate 
    ? new Date(displayDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Sem data';
  const isPast = displayDate && new Date(displayDate) < new Date();

  const sections = [
    { icon: Target, label: 'Objetivo', content: task.video_objective },
    { icon: FileText, label: 'Ideia do Vídeo', content: task.video_idea },
    { icon: FileText, label: 'Roteiro', content: task.full_script, large: true },
    { icon: Link2, label: 'Referências', content: task.video_references, isLinks: true },
    { icon: Clapperboard, label: 'Direção Criativa', content: task.creative_direction },
    { icon: Clapperboard, label: 'Estilo de Edição', content: task.editing_style },
    { icon: MessageSquare, label: 'Notas Estratégicas', content: task.strategic_notes },
    { icon: MessageSquare, label: 'Observações', content: task.observations },
  ].filter(s => s.content);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-secondary/20"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Clapperboard className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
            <h3 className="text-base font-semibold text-foreground truncate">{videoName}</h3>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {task.platform && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">{task.platform}</span>
            )}
            {task.format && (
              <span className="rounded-full bg-info/10 px-2.5 py-0.5 text-[11px] font-medium text-info">{task.format}</span>
            )}
            <span className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
              isPosted ? "bg-green-500/20 text-green-500" : "bg-yellow-500/20 text-yellow-500"
            )}>
              {isPosted ? 'Postado' : task.status || 'Pendente'}
            </span>
            <span className={cn(
              "flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full",
              isPast && !isPosted ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "text-muted-foreground bg-secondary/50"
            )}>
              <Calendar className="h-3 w-3" />
              {formattedDate}
            </span>
          </div>
        </div>
        {!isPosted && !isProgramado && (
          <button
            onClick={(e) => { e.stopPropagation(); onConfirmProgram(task.id); }}
            disabled={confirming}
            className={cn(
              "flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold text-white transition-colors shrink-0",
              confirming 
                ? "bg-blue-700/70 cursor-wait" 
                : "bg-blue-600 hover:bg-blue-700"
            )}
          >
            {confirming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Calendar className="h-4 w-4" />
            )}
            {confirming ? "Confirmando..." : "Confirmar Programação"}
          </button>
        )}
        {isProgramado && !isPosted && (
          <button
            onClick={(e) => { e.stopPropagation(); onConfirm(task.id); }}
            disabled={confirming}
            className={cn(
              "flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold text-white transition-colors shrink-0",
              confirming 
                ? "bg-green-700/70 cursor-wait" 
                : "bg-green-600 hover:bg-green-700"
            )}
          >
            {confirming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            {confirming ? "Confirmando..." : "Confirmar Postagem"}
          </button>
        )}
        {open ? <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border p-5 space-y-4">
          {task.description && (
            <p className="text-sm text-muted-foreground">{task.description}</p>
          )}
          {sections.map((section, i) => (
            <div key={i}>
              <div className="mb-1.5 flex items-center gap-2">
                <section.icon className="h-3.5 w-3.5 text-primary" />
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">{section.label}</h4>
              </div>
              {section.isLinks ? (
                <div className="space-y-1">
                  {section.content!.split('\n').filter(Boolean).map((line, j) => (
                    <a key={j} href={line.trim().startsWith('http') ? line.trim() : `https://${line.trim()}`} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary underline underline-offset-2 hover:text-primary/80 break-all">
                      {line.trim()}
                    </a>
                  ))}
                </div>
              ) : (
                <p className={cn(
                  'text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed',
                  section.large && 'rounded-lg bg-secondary/30 p-3 font-mono text-xs'
                )}>
                  {section.content}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClientContentPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [showPosted, setShowPosted] = useState(false);
  const [showPastDue, setShowPastDue] = useState(false);
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const isInternal = !!user && isAdmin;

  useEffect(() => {
    if (!taskId) return;
    loadContent(taskId);
  }, [taskId]);

  const handleConfirmPost = async (taskIdToConfirm: string) => {
    setConfirmingId(taskIdToConfirm);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'Postado' })
        .eq('id', taskIdToConfirm);
      
      if (error) throw error;
      
      setTasks(prev => prev.map(t => 
        t.id === taskIdToConfirm ? { ...t, status: 'Postado' } : t
      ));
      toast.success('Postagem confirmada com sucesso!');
    } catch (err) {
      console.error('Error confirming post:', err);
      toast.error('Erro ao confirmar postagem');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleConfirmProgram = async (taskIdToConfirm: string) => {
    setConfirmingId(taskIdToConfirm);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'Programado' })
        .eq('id', taskIdToConfirm);
      
      if (error) throw error;
      
      setTasks(prev => prev.map(t => 
        t.id === taskIdToConfirm ? { ...t, status: 'Programado' } : t
      ));
      toast.success('Programação confirmada com sucesso!');
    } catch (err) {
      console.error('Error confirming program:', err);
      toast.error('Erro ao confirmar programação');
    } finally {
      setConfirmingId(null);
    }
  };

  const loadContent = async (id: string) => {
    setLoading(true);

    const { data: singleTask } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();

    if (singleTask) {
      const clientId = singleTask.client_id;
      if (clientId) {
        const { data: clientData } = await supabase.from('clients').select('company_name').eq('id', clientId).single();
        if (clientData) setClientName(clientData.company_name);

        const { data: allTasks } = await supabase.from('tasks').select('*').eq('client_id', clientId).order('due_date', { ascending: true });
        setTasks((allTasks || [singleTask]) as TaskData[]);
      } else {
        setTasks([singleTask as TaskData]);
      }
      setLoading(false);
      return;
    }

    const { data: clientData } = await supabase.from('clients').select('company_name').eq('id', id).maybeSingle();
    if (clientData) {
      setClientName(clientData.company_name);
      const { data: allTasks } = await supabase.from('tasks').select('*').eq('client_id', id).order('due_date', { ascending: true });
      if (allTasks && allTasks.length > 0) {
        setTasks(allTasks as TaskData[]);
        setLoading(false);
        return;
      }
    }

    setNotFound(true);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || tasks.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <img src={logoInova} alt="Inova" className="h-12" />
        <p className="text-lg text-muted-foreground">Conteúdo não encontrado.</p>
      </div>
    );
  }

  const pendingTasks = tasks.filter(t => {
    if (taskId && t.id === taskId) return true;
    
    if (t.status === 'Postado') return false;
    const taskDate = t.scheduled_date || t.due_date;
    if (!taskDate) return true;
    const date = new Date(taskDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today && !isInternal) return false;
    return true;
  });
  const pastDueTasks = tasks.filter(t => {
    if (t.status === 'Postado') return false;
    const taskDate = t.scheduled_date || t.due_date;
    if (!taskDate) return false;
    const date = new Date(taskDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today && isInternal;
  });
  const postedTasks = tasks.filter(t => t.status === 'Postado');
  const displayedTasks = showPosted ? tasks : [...pendingTasks, ...(isInternal && showPastDue ? pastDueTasks : [])];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <img src={logoInova} alt="Inova" className="h-10" />
          <div className="text-right">
            {clientName && <p className="text-sm font-medium text-foreground">{clientName}</p>}
            <p className="text-xs text-muted-foreground">{pendingTasks.length} {pendingTasks.length === 1 ? 'pendente' : 'pendentes'}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Cronograma de Conteúdo (Atualizado)</h1>
            <p className="text-sm text-muted-foreground">Confirme as postagens conforme forem sendo publicadas</p>
          </div>
          {postedTasks.length > 0 && (
            <button
              onClick={() => setShowPosted(!showPosted)}
              className="text-sm text-primary hover:underline"
            >
              {showPosted ? 'Ocultar publicados' : `Ver ${postedTasks.length} publicados`}
            </button>
          )}
          {isInternal && pastDueTasks.length > 0 && (
            <button
              onClick={() => setShowPastDue(!showPastDue)}
              className="text-sm text-red-500 hover:underline flex items-center gap-1"
            >
              <Lock className="h-3 w-3" />
              {showPastDue ? 'Ocultar atrasadas' : `Ver ${pastDueTasks.length} atrasadas`}
            </button>
          )}
        </div>

        <div className="space-y-4">
          {displayedTasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma tarefa pendente!</p>
          ) : (
            displayedTasks.map((task, i) => (
              <TaskCard key={task.id} task={task} index={i} onConfirm={handleConfirmPost} onConfirmProgram={handleConfirmProgram} confirming={confirmingId === task.id} />
            ))
          )}
        </div>

        <div className="mt-12 border-t border-border pt-6 text-center">
          <img src={logoInova} alt="Inova" className="mx-auto h-8 opacity-50" />
          <p className="mt-2 text-xs text-muted-foreground">Conteúdo preparado pela equipe Inova</p>
        </div>
      </main>
    </div>
  );
}
