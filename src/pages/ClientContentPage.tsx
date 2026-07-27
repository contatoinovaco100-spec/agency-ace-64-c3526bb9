import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import logoInova from '@/assets/logo-inova.png';
import { cn } from '@/lib/utils';
import { Clapperboard, Calendar, Target, FileText, Link2, MessageSquare, Loader2, ChevronDown, ChevronRight, CheckCircle, Eye, EyeOff, Palette, RefreshCw, Download } from 'lucide-react';
import ArteAttachmentsPreview from '@/components/tasks/ArteAttachmentsPreview';
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
  task_type?: string | null;
}

function TaskCard({ task, index }: { task: TaskData; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const [videoReloadKey, setVideoReloadKey] = useState(0);
  const isArte = task.task_type === 'Arte';
  const videoName = isArte ? (task.title || 'Arte sem título') : (task.video_name || task.title || 'Sem título');
  
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
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", isArte ? "bg-pink-500/10" : "bg-primary/10")}>
          {isArte ? <Palette className="h-5 w-5 text-pink-500" /> : <Clapperboard className="h-5 w-5 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground shrink-0">#{index + 1}</span>
            <h3 className="text-base font-semibold text-foreground truncate">{videoName}</h3>
            {task.video_url && (
              <svg width="14" height="14" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg" className="shrink-0" aria-label="Vídeo no Drive"><title>Vídeo no Drive</title>
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
            )}
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
            <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#bff720]/20 text-[#5a7a00] dark:text-[#bff720] font-semibold">
              <Calendar className="h-3 w-3" />
              Postar: {formattedDate}{formattedTime ? ` às ${formattedTime}` : ''}
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
          {isArte && (
            <div className="rounded-lg border border-pink-500/30 bg-pink-500/5 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Palette className="h-3.5 w-3.5 text-pink-500" />
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">Arte pronta</h4>
              </div>
              <ArteAttachmentsPreview taskId={task.id} compact={false} />
            </div>
          )}
          {!isArte && task.video_url && (() => {
            const url = task.video_url;
            const isDrive = /drive\.google\.com/i.test(url);
            const isYouTube = /(youtube\.com|youtu\.be)/i.test(url);
            const isVimeo = /vimeo\.com/i.test(url);
            const isDirectFile = /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);
            const isSelfHosted = !isDrive && !isYouTube && !isVimeo && (isDirectFile || /supabase\.co\/storage/i.test(url));

            if (isSelfHosted) {
              const fileName = (task.video_name || task.title || 'video').replace(/[^\w.-]+/g, '_') + (url.match(/\.(mp4|webm|ogg|mov|m4v)(\?|$)/i)?.[0]?.split('?')[0] || '.mp4');
              return (
                <div className="space-y-2">
                  <div className="rounded-lg overflow-hidden border border-primary/30 bg-black">
                    <video
                      key={videoReloadKey}
                      src={url}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full max-h-[70vh] bg-black"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>Vídeo finalizado — assista e aprove antes da publicação.</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => setVideoReloadKey(k => k + 1)}
                        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Recarregar
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const tid = toast.loading('Baixando vídeo...');
                          try {
                            const res = await fetch(url);
                            if (!res.ok) throw new Error('Falha no download');
                            const reader = res.body?.getReader();
                            const total = Number(res.headers.get('content-length')) || 0;
                            const chunks: Uint8Array[] = [];
                            let received = 0;
                            if (reader) {
                              while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                if (value) {
                                  chunks.push(value);
                                  received += value.length;
                                  if (total) toast.loading(`Baixando... ${Math.round((received/total)*100)}%`, { id: tid });
                                }
                              }
                            }
                            const blob = new Blob(chunks, { type: res.headers.get('content-type') || 'video/mp4' });
                            const objUrl = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = objUrl;
                            a.download = fileName;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
                            toast.success('Download concluído!', { id: tid });
                          } catch (e: any) {
                            toast.error(`Erro ao baixar: ${e?.message || 'tente novamente'}`, { id: tid });
                          }
                        }}
                        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                      >
                        <Download className="w-3.5 h-3.5" /> Baixar vídeo
                      </button>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary hover:underline"
                      >
                        Abrir em nova aba ↗
                      </a>
                    </div>
                  </div>
                </div>
              );
            }

            if (isYouTube) {
              const embed = url
                .replace('watch?v=', 'embed/')
                .replace('youtu.be/', 'youtube.com/embed/');
              return (
                <div className="aspect-video rounded-lg overflow-hidden border border-primary/30 bg-black">
                  <iframe src={embed} className="w-full h-full" allowFullScreen title="Vídeo" />
                </div>
              );
            }

            if (isDrive) {
              const preview = url.replace('/view', '/preview');
              return (
                <div className="space-y-2">
                  <div className="aspect-video rounded-lg overflow-hidden border border-primary/30 bg-black">
                    <iframe src={preview} className="w-full h-full" allow="autoplay" title="Vídeo Drive" />
                  </div>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary hover:underline">
                    Abrir no Google Drive ↗
                  </a>
                </div>
              );
            }

            return (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex w-full items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/20 hover:border-primary/50 transition-all"
              >
                <span>Abrir vídeo finalizado</span>
                <span>↗</span>
              </a>
            );
          })()}

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
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const isInternal = !!user && isAdmin;

  useEffect(() => {
    if (!taskId) return;
    loadContent(taskId);
  }, [taskId]);

  const updateStatusRpc = async (taskIdToConfirm: string, newStatus: 'Postado' | 'Programado') => {
    setConfirmingId(taskIdToConfirm);
    setTasks(prev => prev.map(t =>
      t.id === taskIdToConfirm ? { ...t, status: newStatus } : t
    ));
    try {
      const { error } = await (supabase as any).rpc('update_public_task_status', { _id: taskIdToConfirm, _status: newStatus });
      if (error) throw error;
      toast.success(newStatus === 'Postado' ? 'Postagem confirmada com sucesso!' : 'Programação confirmada com sucesso!');
    } catch (err: any) {
      console.error('Error updating task status:', err);
      toast.error(`Erro ao confirmar: ${err?.message || 'tente novamente'}`);
    } finally {
      setConfirmingId(null);
    }
  };

  const handleConfirmPost = (taskIdToConfirm: string) => updateStatusRpc(taskIdToConfirm, 'Postado');
  const handleConfirmProgram = (taskIdToConfirm: string) => updateStatusRpc(taskIdToConfirm, 'Programado');

  const loadContent = async (id: string) => {
    setLoading(true);

    const { data: tasksData, error } = await (supabase as any).rpc('get_public_client_tasks', { _anchor: id });
    if (error) console.error('Error loading tasks:', error);

    const list = (tasksData as TaskData[] | null) || [];
    if (list.length > 0) {
      const clientId = list[0].client_id;
      if (clientId) {
        const { data: nameData } = await (supabase as any).rpc('get_public_client_name', { _id: clientId });
        if (nameData) setClientName(nameData as string);
      }
      setTasks(list);
      setLoading(false);
      return;
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
    const isArte = t.task_type === 'Arte';

    // Concluído nunca aparece para o cliente. Para artes, só aparece se estiver "Finalizado".
    if (t.status === 'Concluído') return false;
    if (t.status === 'Postado') return false;
    if (isArte && t.status !== 'Finalizado') return false;
    const taskDate = t.post_date || t.scheduled_date || t.due_date;
    if (!taskDate) return true;
    const date = new Date(taskDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today && !isInternal && !isArte) return false;
    return true;
  });
  const postedTasks = tasks.filter(t => t.status === 'Postado');
  const displayedTasks = showPosted ? tasks.filter(t => t.status !== 'Concluído') : pendingTasks;

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
