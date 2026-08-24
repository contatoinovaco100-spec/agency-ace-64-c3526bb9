import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import logoInova from '@/assets/logo-inova.png';
import { cn } from '@/lib/utils';
import {
  Clapperboard, Calendar, Target, FileText, Link2, MessageSquare,
  Loader2, ChevronDown, ChevronRight, Palette, RefreshCw, Download,
  CheckCircle2, Clock, Play, Instagram, Youtube, ExternalLink, X, ZoomIn,
  Sparkles, LayoutList, Image as ImageIcon, Video,

} from 'lucide-react';
import ArteAttachmentsPreview from '@/components/tasks/ArteAttachmentsPreview';
import UniversalVideoPlayer from '@/components/UniversalVideoPlayer';
import { resolveVideoUrl } from '@/lib/videoUrl';
import { toast } from 'sonner';

function ResolvedVideoSection({ url, fileName, reloadKey }: { url: string; fileName: string; reloadKey: number }) {
  const [localReload, setLocalReload] = useState(0);
  const [resolved, setResolved] = useState(url);
  useEffect(() => {
    let cancelled = false;
    setResolved(url);
    resolveVideoUrl(url).then(r => { if (!cancelled) setResolved(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, [url]);

  return (
    <div className="space-y-3">
      <UniversalVideoPlayer src={resolved} reloadKey={reloadKey + localReload} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">🎬 Vídeo finalizado — assista e aprove antes da publicação</p>
        <div className="flex items-center gap-3 text-xs font-semibold text-primary">
          <button type="button" onClick={() => setLocalReload(k => k + 1)} className="inline-flex items-center gap-1 hover:text-primary/80 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Recarregar
          </button>
          <button type="button" onClick={async () => {
            const tid = toast.loading('Baixando vídeo...');
            try {
              const res = await fetch(resolved);
              if (!res.ok) throw new Error('Falha no download');
              const chunks: Uint8Array[] = [];
              const total = Number(res.headers.get('content-length')) || 0;
              let received = 0;
              const reader = res.body?.getReader();
              if (reader) {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  if (value) { chunks.push(value); received += value.length; if (total) toast.loading(`Baixando... ${Math.round((received/total)*100)}%`, { id: tid }); }
                }
              }
              const blob = new Blob(chunks as BlobPart[], { type: res.headers.get('content-type') || 'video/mp4' });
              const objUrl = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = objUrl; a.download = fileName;
              document.body.appendChild(a); a.click(); a.remove();
              setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
              toast.success('Download concluído!', { id: tid });
            } catch (e: any) { toast.error(`Erro ao baixar: ${e?.message || 'tente novamente'}`, { id: tid }); }
          }} className="inline-flex items-center gap-1 hover:text-primary/80 transition-colors">
            <Download className="w-3.5 h-3.5" /> Baixar vídeo
          </button>
          <a href={resolved} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-primary/80 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /> Abrir ↗
          </a>
        </div>
      </div>
    </div>
  );
}

// Cache de dados da página
const pageCache = new Map<string, { data: TaskData[]; clientName: string; timestamp: number }>();
const PAGE_CACHE_DURATION = 2 * 60 * 1000; // 2 minutos

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
  caption?: string | null;
  recording_notes?: string | null;

}

// ─── Helpers ────────────────────────────────────────────────────────────────

function platformIcon(platform: string) {
  const p = (platform || '').toLowerCase();
  if (p.includes('instagram')) return <Instagram className="h-3 w-3" />;
  if (p.includes('youtube')) return <Youtube className="h-3 w-3" />;
  if (p.includes('tiktok')) return (
    <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V9.41a8.16 8.16 0 0 0 4.77 1.52V7.49a4.85 4.85 0 0 1-1.01-.8z"/>
    </svg>
  );
  return null;
}

function StatusBadge({ status, isArte }: { status: string; isArte?: boolean }) {
  const cfg: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    'Postado':      { label: 'Postado',      cls: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30',  icon: <CheckCircle2 className="h-3 w-3" /> },
    'Programado':   { label: 'Programado',   cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',      icon: <Calendar className="h-3 w-3" /> },
    'Finalizado':   { label: isArte ? 'Arte pronta' : 'Finalizado', cls: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30', icon: <Sparkles className="h-3 w-3" /> },
    'Em revisão':   { label: 'Em revisão',   cls: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30', icon: <Clock className="h-3 w-3" /> },
    'Revisão':      { label: 'Revisão',      cls: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30', icon: <Clock className="h-3 w-3" /> },
    'Em andamento': { label: 'Em andamento', cls: 'bg-primary/15 text-primary border-primary/30',                              icon: <Play className="h-3 w-3" /> },
    'Proxima Captação': { label: 'Próxima Captação', cls: 'bg-[#bff720]/20 text-[#5a7a00] dark:text-[#bff720] border-[#bff720]/40', icon: <Video className="h-3 w-3" /> },
    'default':      { label: status,         cls: 'bg-muted text-muted-foreground border-border',                              icon: <LayoutList className="h-3 w-3" /> },
  };
  const { label, cls, icon } = cfg[status] || cfg['default'];

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', cls)}>
      {icon}{label}
    </span>
  );
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-sm" onClick={onClose}>
      <button onClick={onClose} className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/25 transition-all" aria-label="Fechar">
        <X className="h-5 w-5" />
      </button>
      <img src={src} alt="Arte" className="max-h-screen max-w-screen-xl w-full object-contain p-6 select-none" onClick={e => e.stopPropagation()} />
    </div>
  );
}

// ─── Arte Preview with clickable lightbox ────────────────────────────────────

function ArtePreviewClickable({ taskId, status }: { taskId: string; status: string }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const isRevisao = status === 'Em revisão';
  return (
    <>
      <div className={cn('rounded-xl border p-4', isRevisao ? 'border-orange-500/30 bg-orange-500/5' : 'border-purple-500/30 bg-purple-500/5')}>
        <div className="mb-3 flex items-center gap-2">
          <Palette className={cn('h-4 w-4', isRevisao ? 'text-orange-500' : 'text-purple-500')} />
          <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">
            {isRevisao ? '🎨 Arte em revisão — aguardando aprovação' : '✅ Arte pronta para publicação'}
          </h4>
        </div>
        <div className="relative group cursor-zoom-in">
          <ArteAttachmentsPreview
            taskId={taskId}
            compact={false}
            onPreviewClick={(urls, index) => setLightbox(urls[index])}
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 transition-all group-hover:bg-black/30">
            <div className="flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white opacity-0 transition-all group-hover:opacity-100">
              <ZoomIn className="h-3.5 w-3.5" /> Clique para ampliar
            </div>
          </div>
        </div>
      </div>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────

function TaskCard({ task, index, defaultOpen, onConfirmPost, onConfirmProgram, isConfirming }: {
  task: TaskData;
  index: number;
  defaultOpen?: boolean;
  onConfirmPost: (id: string) => void;
  onConfirmProgram: (id: string) => void;
  isConfirming: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [videoReloadKey, setVideoReloadKey] = useState(0);

  const isArte = task.task_type === 'Arte';
  const videoName = isArte ? (task.title || 'Arte sem título') : (task.video_name || task.title || 'Sem título');
  const isPosted = task.status === 'Postado';
  const isProgramado = task.status === 'Programado';
  const isProximaCaptacao = task.status === 'Proxima Captação';


  const displayDate = task.post_date || task.scheduled_date || task.due_date;
  const formattedDate = displayDate
    ? new Date(displayDate + (task.post_date && !displayDate.includes('T') ? 'T00:00:00' : '')).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;
  const postTime = (task as any).post_time as string | null | undefined;
  const formattedTime = postTime ? postTime.slice(0, 5) : null;

  const platformIc = platformIcon(task.platform);

  const sections = [
    { icon: FileText, label: 'Legenda', content: (task as any).caption, copyable: true },
    { icon: FileText, label: 'Descrição', content: task.description },
    { icon: Target, label: 'Objetivo', content: task.video_objective },
    { icon: FileText, label: 'Roteiro', content: task.full_script, large: true },
    { icon: Link2, label: 'Referências', content: task.video_references, isLinks: true },
    { icon: Clapperboard, label: 'Direção Criativa', content: task.creative_direction },
    { icon: Clapperboard, label: 'Estilo de Edição', content: task.editing_style },
    { icon: MessageSquare, label: 'Notas Estratégicas', content: task.strategic_notes },
    { icon: MessageSquare, label: 'Notas de Gravação', content: (task as any).recording_notes },
    { icon: MessageSquare, label: 'Observações', content: task.observations },
  ].filter(s => {
    const v = (s.content || '').trim();
    if (!v) return false;
    // ignora textos-padrão vazios ("Sem informação.", "Sem informção.", "-", "n/a")
    const norm = v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.\s]/g, '');
    return !['seminformacao', 'seminformcao', 'seminfo', '-', 'na', 'n/a'].includes(norm);
  }) as Array<{ icon: any; label: string; content: string; large?: boolean; isLinks?: boolean; copyable?: boolean }>;



  return (
    <div className={cn(
      'group rounded-2xl border bg-card overflow-hidden shadow-sm transition-all duration-200',
      isPosted ? 'border-green-500/30 opacity-75' :
      isProximaCaptacao ? 'border-[#bff720]/60 bg-[#bff720]/5 shadow-[#bff720]/20 ring-1 ring-[#bff720]/30' :
      'border-border hover:border-primary/30 hover:shadow-md',
      open && !isPosted && !isProximaCaptacao && 'border-primary/40 shadow-md ring-1 ring-primary/10',
      open && isProximaCaptacao && 'border-[#bff720] shadow-lg shadow-[#bff720]/15 ring-2 ring-[#bff720]/40'
    )}>
      {/* Card Header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-start gap-4 p-5 text-left transition-colors hover:bg-secondary/10"
      >
        {/* Index bubble */}
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold',
          isPosted ? 'bg-green-500/15 text-green-600 dark:text-green-400' :
          isProximaCaptacao ? 'bg-[#bff720]/20 text-[#7a9a00] dark:text-[#bff720] animate-pulse' :
          isArte ? 'bg-gradient-to-br from-pink-500/20 to-purple-500/20 text-pink-600 dark:text-pink-400' :
          'bg-gradient-to-br from-primary/20 to-blue-500/20 text-primary'
        )}>
          {isPosted ? <CheckCircle2 className="h-5 w-5" /> :
           isProximaCaptacao ? <Video className="h-5 w-5" /> :
           `${index + 1}`}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn('text-base font-bold leading-snug text-foreground', isPosted && 'line-through text-muted-foreground')}>
              {videoName}
            </h3>
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
          </div>

          {/* Tags row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={task.status} isArte={isArte} />




            {task.platform && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border px-2.5 py-0.5 text-[11px] font-medium text-foreground">
                {platformIc}{task.platform}
              </span>
            )}
            {task.format && (
              <span className="inline-flex items-center rounded-full bg-secondary border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                {task.format}
              </span>
            )}

            {formattedDate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#bff720]/15 border border-[#bff720]/30 px-2.5 py-0.5 text-[11px] font-semibold text-[#5a7a00] dark:text-[#bff720]">
                <Calendar className="h-3 w-3" />
                {formattedDate}{formattedTime ? ` · ${formattedTime}` : ''}
              </span>
            )}

            {task.video_url && !isArte && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                <Play className="h-3 w-3" /> Vídeo disponível
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-border">
          <div className="p-5 space-y-5">
            {isProximaCaptacao && (
              <div className="flex items-center gap-3 rounded-xl bg-[#bff720]/10 border border-[#bff720]/30 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#bff720]/20">
                  <Video className="h-4 w-4 text-[#5a7a00] dark:text-[#bff720]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#5a7a00] dark:text-[#bff720]">Próxima Captação</p>
                  <p className="text-xs text-[#5a7a00]/80 dark:text-[#bff720]/80">Esse vídeo está na fila para gravação. Fique atento às orientações da equipe Inova.</p>
                </div>
              </div>
            )}

            {task.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>
            )}

            {/* Arte preview */}
            {isArte && <ArtePreviewClickable taskId={task.id} status={task.status} />}

            {/* Video player */}
            {!isArte && task.video_url && (() => {
              const url = task.video_url!;
              const isDrive = /drive\.google\.com/i.test(url);
              const isYouTube = /(youtube\.com|youtu\.be)/i.test(url);
              const isDirectFile = /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);
              const isSelfHosted = !isDrive && !isYouTube && (isDirectFile || /supabase\.co\/storage/i.test(url));
              const fileName = (task.video_name || task.title || 'video').replace(/[^\w.-]+/g, '_') + (url.match(/\.(mp4|webm|ogg|mov|m4v)(\?|$)/i)?.[0]?.split('?')[0] || '.mp4');

              if (isSelfHosted) return <ResolvedVideoSection url={url} fileName={fileName} reloadKey={videoReloadKey} />;

              if (isYouTube) {
                const embed = url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/');
                return (
                  <div className="aspect-video rounded-xl overflow-hidden border border-primary/20 bg-black">
                    <iframe src={embed} className="w-full h-full" allowFullScreen title="Vídeo" />
                  </div>
                );
              }

              if (isDrive) {
                const preview = url.replace('/view', '/preview');
                return (
                  <div className="space-y-2">
                    <div className="aspect-video rounded-xl overflow-hidden border border-primary/20 bg-black">
                      <iframe src={preview} className="w-full h-full" allow="autoplay" title="Vídeo Drive" />
                    </div>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                      <ExternalLink className="w-3 h-3" /> Abrir no Google Drive
                    </a>
                  </div>
                );
              }

              return (
                <a href={url} target="_blank" rel="noopener noreferrer" className="group flex w-full items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3.5 text-sm font-semibold text-primary hover:bg-primary/15 hover:border-primary/50 transition-all">
                  <span className="flex items-center gap-2"><Play className="h-4 w-4" />Abrir vídeo finalizado</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              );
            })()}

            {/* Content sections */}
            {sections.length > 0 && (
              <div className="space-y-5 pt-1">
                <div className="h-px bg-border" />
                <div className="grid gap-4">
                  {sections.map((section, i) => (
                    <div key={i} className="rounded-xl bg-secondary/30 p-4 border border-border/50">
                      <div className="mb-2 flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10">
                          <section.icon className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">{section.label}</h4>
                        {section.copyable && (
                          <button
                            onClick={() => { navigator.clipboard.writeText(section.content); toast.success('Legenda copiada!'); }}
                            className="ml-auto text-[11px] font-semibold text-primary hover:underline"
                          >
                            Copiar
                          </button>
                        )}
                      </div>

                      {section.isLinks ? (
                        <div className="space-y-1.5 mt-2">
                          {section.content!.split('\n').filter(Boolean).map((line, j) => (
                            <a key={j} href={line.trim().startsWith('http') ? line.trim() : `https://${line.trim()}`} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-primary underline underline-offset-2 hover:text-primary/80 break-all">
                              <ExternalLink className="h-3 w-3 shrink-0" />{line.trim()}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className={cn('text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed', section.large && 'rounded-lg bg-background/50 p-3 font-mono text-xs border border-border mt-2')}>
                          {section.content}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}


            {isPosted && (
              <div className="flex items-center gap-3 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-green-600 dark:text-green-400">Aprovado pelo cliente</p>
                  <p className="text-xs text-green-600/70 dark:text-green-400/70">Conteúdo pronto para publicação</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

// Removido - barra de progresso do mês

// ─── Main Page ────────────────────────────────────────────────────────────────

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

  const loadContent = useCallback(async (id: string, forceRefresh = false) => {
    // Verificar cache primeiro (se não forçar refresh)
    if (!forceRefresh) {
      const cached = pageCache.get(id);
      if (cached && Date.now() - cached.timestamp < PAGE_CACHE_DURATION) {
        setTasks(cached.data);
        setClientName(cached.clientName);
        setLoading(false);
        return;
      }
    }

    const { data: tasksData, error } = await (supabase as any).rpc('get_public_client_tasks', { _anchor: id });
    if (error) console.error('Error loading tasks:', error);
    const list = (tasksData as TaskData[] | null) || [];
    if (list.length > 0) {
      const clientId = list[0].client_id;
      let name = '';
      if (clientId) {
        const { data: nameData } = await (supabase as any).rpc('get_public_client_name', { _id: clientId });
        if (nameData) name = nameData as string;
      }
      setTasks(list);
      if (name) setClientName(name);
      setLoading(false);
      
      // Atualizar cache
      pageCache.set(id, { data: list, clientName: name, timestamp: Date.now() });
      
      // Salvar também no sessionStorage
      try { 
        sessionStorage.setItem(`client-content:${id}`, JSON.stringify({ tasks: list, clientName: name })); 
      } catch {}
      return;
    }
    setNotFound(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!taskId) return;
    
    // Tentar carregar do sessionStorage primeiro (instantâneo)
    try {
      const cached = sessionStorage.getItem(`client-content:${taskId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.tasks?.length) {
          setTasks(parsed.tasks);
          setClientName(parsed.clientName || '');
          setLoading(false);
        }
      }
    } catch {}
    
    // Carregar dados atualizados
    loadContent(taskId);
  }, [taskId, loadContent]);

  useEffect(() => {
    if (!taskId) return;
    
    let refreshTimeout: NodeJS.Timeout;
    let isRefreshing = false;
    
    const debouncedRefresh = () => {
      if (isRefreshing) return;
      clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        if (document.visibilityState === 'visible') {
          isRefreshing = true;
          loadContent(taskId, true).finally(() => {
            isRefreshing = false;
          });
        }
      }, 1000); // Debounce de 1 segundo
    };
    
    const interval = setInterval(debouncedRefresh, 4 * 60 * 1000);
    const onVisible = debouncedRefresh;
    
    document.addEventListener('visibilitychange', onVisible);
    return () => { 
      clearInterval(interval); 
      clearTimeout(refreshTimeout);
      document.removeEventListener('visibilitychange', onVisible); 
    };
  }, [taskId, loadContent]);

  const updateStatusRpc = async (taskIdToConfirm: string, newStatus: 'Postado' | 'Programado') => {
    setConfirmingId(taskIdToConfirm);
    setTasks(prev => prev.map(t => t.id === taskIdToConfirm ? { ...t, status: newStatus } : t));
    try {
      const { error } = await (supabase as any).rpc('update_public_task_status', { _id: taskIdToConfirm, _status: newStatus });
      if (error) throw error;
      toast.success(newStatus === 'Postado' ? '✅ Postagem confirmada com sucesso!' : '📅 Programação confirmada!');
    } catch (err: any) {
      toast.error(`Erro ao confirmar: ${err?.message || 'tente novamente'}`);
    } finally {
      setConfirmingId(null);
    }
  };

  // ── Loading skeleton ──
  if (loading && tasks.length === 0) return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <img src={logoInova} alt="Inova" className="h-10" />
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground animate-pulse">Carregando...</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8 space-y-4">
        {/* Hero skeleton */}
        <div className="mb-8 space-y-2">
          <div className="h-8 w-64 bg-muted rounded-lg animate-pulse" />
          <div className="h-4 w-96 bg-muted/60 rounded animate-pulse" />
        </div>
        {/* Progress bar skeleton */}
        <div className="h-24 rounded-2xl border border-border bg-card animate-pulse" />
        {/* Cards skeleton */}
        {[0, 1, 2].map(i => (
          <div key={i} className="h-28 rounded-2xl border border-border bg-card animate-pulse flex items-center gap-4 p-5">
            <div className="h-9 w-9 rounded-xl bg-muted shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-48 bg-muted rounded animate-pulse" />
              <div className="flex gap-2">
                <div className="h-5 w-20 bg-muted rounded-full animate-pulse" />
                <div className="h-5 w-24 bg-muted rounded-full animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  );

  // ── Not found ──
  if (notFound || tasks.length === 0) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6">
      <img src={logoInova} alt="Inova" className="h-12 opacity-70" />
      <div className="text-center">
        <p className="text-xl font-bold text-foreground">Conteúdo não encontrado</p>
        <p className="mt-1 text-sm text-muted-foreground">Verifique o link ou entre em contato com a equipe Inova.</p>
      </div>
    </div>
  );

  const pendingTasks = tasks.filter(t => {
    if (taskId && t.id === taskId) return true;
    const isArte = t.task_type === 'Arte';
    if (t.status === 'Concluído') return false;
    if (t.status === 'Postado') return false;
    if (isArte && t.status !== 'Finalizado' && t.status !== 'Em revisão' && t.status !== 'Revisão') return false;
    // Vídeos aguardando aprovação do cliente sempre aparecem, mesmo com data passada.
    const awaitingApproval = !isArte && (t.status === 'Revisão' || t.status === 'Em revisão' || t.status === 'Finalizado');
    // Vídeos em "Próxima Captação" aparecem para o cliente se preparar.
    const isProximaCaptacao = !isArte && t.status === 'Proxima Captação';
    const taskDate = t.post_date || t.scheduled_date || t.due_date;
    if (!taskDate) return true;
    // Compara só a data (YYYY-MM-DD) no fuso local — evita que tarefas com entrega
    // hoje sejam tratadas como vencidas (new Date('YYYY-MM-DD') vira meia-noite UTC).
    const dateStr = String(taskDate).slice(0, 10);
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (dateStr < todayStr && !isInternal && !isArte && !awaitingApproval && !isProximaCaptacao) return false;
    return true;
  });
  const postedTasks = tasks.filter(t => t.status === 'Postado');
  const displayedTasks = showPosted ? tasks.filter(t => t.status !== 'Concluído') : pendingTasks;
  const allTasks = tasks.filter(t => t.status !== 'Concluído');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={logoInova} alt="Inova" className="h-10" />
            {clientName && (
              <div className="hidden sm:block h-6 w-px bg-border" />
            )}
            {clientName && (
              <p className="hidden sm:block text-sm font-semibold text-foreground">{clientName}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {pendingTasks.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5">
                <span className="text-xs font-bold text-primary">{pendingTasks.length}</span>
                <span className="text-xs text-primary/70">
                  {pendingTasks.length === 1 ? 'pendente' : 'pendentes'}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => loadContent(taskId!)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              title="Atualizar"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        {/* Hero title */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Cronograma de Conteúdo
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Confira os conteúdos preparados pela equipe Inova
          </p>
        </div>

        {/* Toggle show posted */}
        {postedTasks.length > 0 && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                <span className="text-xs font-bold text-primary">{postedTasks.length}</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                {showPosted ? 'Todos os conteúdos' : 'Conteúdos pendentes'}
              </p>
            </div>
            <button
              onClick={() => setShowPosted(!showPosted)}
              className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              {showPosted ? `Ocultar publicados` : `+ Ver publicados`}
            </button>
          </div>
        )}

        {/* Task list */}
        <div className="space-y-4">
          {displayedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <p className="text-base font-semibold text-foreground">Tudo em dia!</p>
              <p className="text-sm text-muted-foreground">Nenhum conteúdo pendente no momento.</p>
            </div>
          ) : (
            displayedTasks.map((task, i) => (
              <TaskCard
                key={task.id}
                task={task}
                index={i}
                defaultOpen={task.id === taskId || (displayedTasks.length === 1)}
                onConfirmPost={id => updateStatusRpc(id, 'Postado')}
                onConfirmProgram={id => updateStatusRpc(id, 'Programado')}
                isConfirming={confirmingId === task.id}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-16 border-t border-border pt-8 text-center">
          <img src={logoInova} alt="Inova" className="mx-auto h-8 opacity-40" />
          <p className="mt-2 text-xs text-muted-foreground">
            Conteúdo preparado com 💛 pela equipe <span className="font-semibold">Inova</span>
          </p>
        </div>
      </main>
    </div>
  );
}
