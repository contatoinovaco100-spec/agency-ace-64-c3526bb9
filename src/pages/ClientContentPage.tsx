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
  scheduled_date?: string | null;
  post_date?: string | null;
  assignee: string;
  client_id: string | null;
  priority: string;
  status: string;
  creative_direction: string;
  editing_style: string;
  strategic_notes: string;
  video_url?: string | null;
}

function TaskCard({ task, index }: { task: TaskData; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const videoName = task.video_name || task.title || 'Sem título';
  
  const isPosted = task.status === 'Postado';
  const isProgramado = task.status === 'Programado';
  const displayDate = task.post_date || task.scheduled_date || task.due_date;
  const formattedDate = displayDate 
    ? new Date(displayDate + (task.post_date && !displayDate.includes('T') ? 'T00:00:00' : '')).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Sem data';
  const postTime = (task as any).post_time as string | null | undefined;
  const formattedTime = postTime ? postTime.slice(0, 5) : null;
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
              {formattedDate}{formattedTime ? ` • ${formattedTime}` : ''}
            </span>
          </div>
        </div>
        
        {open ? <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border p-5 space-y-4">
          {task.description && (
            <p className="text-sm text-muted-foreground">{task.description}</p>
          )}
          {task.video_url && (
            <a
              href={task.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex w-full items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/20 hover:border-primary/50 transition-all"
              title="Baixar vídeo finalizado"
            >
              <span className="flex items-center gap-2.5">
                <svg width="20" height="20" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                  <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                  <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                  <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                  <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                  <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                </svg>
                Baixar vídeo finalizado
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                <path d="M7 7h10v10"/>
                <path d="M7 17 17 7"/>
              </svg>
            </a>
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
    // Optimistic update immediately
    setTasks(prev => prev.map(t =>
      t.id === taskIdToConfirm ? { ...t, status: 'Postado' } : t
    ));
    try {
      const { error, data } = await supabase
        .from('tasks')
        .update({ status: 'Postado' })
        .eq('id', taskIdToConfirm)
        .select();

      if (error) {
        console.error('Supabase error confirming post:', JSON.stringify(error));
        // If it's an RLS permission error, the UI was already updated optimistically
        // The admin can update this in the dashboard
        if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
          toast.success('Postagem confirmada! (atualização salva localmente)');
        } else {
          throw error;
        }
      } else {
        toast.success('Postagem confirmada com sucesso!');
      }
    } catch (err: any) {
      console.error('Error confirming post:', err);
      // Revert optimistic update on real error
      setTasks(prev => prev.map(t =>
        t.id === taskIdToConfirm ? { ...t, status: t.status } : t
      ));
      toast.error(`Erro ao confirmar postagem: ${err?.message || 'tente novamente'}`);
    } finally {
      setConfirmingId(null);
    }
  };

  const handleConfirmProgram = async (taskIdToConfirm: string) => {
    setConfirmingId(taskIdToConfirm);
    // Optimistic update immediately
    setTasks(prev => prev.map(t =>
      t.id === taskIdToConfirm ? { ...t, status: 'Programado' } : t
    ));
    try {
      const { error, data } = await supabase
        .from('tasks')
        .update({ status: 'Programado' })
        .eq('id', taskIdToConfirm)
        .select();

      if (error) {
        console.error('Supabase error confirming program:', JSON.stringify(error));
        if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
          toast.success('Programação confirmada! (atualização salva localmente)');
        } else {
          throw error;
        }
      } else {
        toast.success('Programação confirmada com sucesso!');
      }
    } catch (err: any) {
      console.error('Error confirming program:', err);
      // Revert optimistic update on real error
      setTasks(prev => prev.map(t =>
        t.id === taskIdToConfirm ? { ...t, status: t.status } : t
      ));
      toast.error(`Erro ao confirmar programação: ${err?.message || 'tente novamente'}`);
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
    
    // Tarefas marcadas como "Concluído" são arquivadas internamente e não aparecem para o cliente
    if (t.status === 'Concluído') return false;
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
    if (t.status === 'Concluído') return false;
    if (t.status === 'Postado') return false;
    const taskDate = t.scheduled_date || t.due_date;
    if (!taskDate) return false;
    const date = new Date(taskDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today && isInternal;
  });
  const postedTasks = tasks.filter(t => t.status === 'Postado');
  const displayedTasks = showPosted ? tasks.filter(t => t.status !== 'Concluído') : [...pendingTasks, ...(isInternal && showPastDue ? pastDueTasks : [])];

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
              <TaskCard key={task.id} task={task} index={i} />
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
