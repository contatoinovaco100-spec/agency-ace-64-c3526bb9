import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import logoInova from '@/assets/logo-inova.png';
import { cn } from '@/lib/utils';
import {
  Check, ChevronDown, Copy, Download, ExternalLink, Instagram, Loader2, Play, RefreshCw, X, Youtube,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import ArteAttachmentsPreview from '@/components/tasks/ArteAttachmentsPreview';
import UniversalVideoPlayer from '@/components/UniversalVideoPlayer';
import { resolveVideoUrl } from '@/lib/videoUrl';
import { toast } from 'sonner';
import { useSeo } from '@/lib/seo';
import { PAGE_THUMBS } from '@/lib/pageThumbs';
import { CLIENT_REVIEW_AUTHOR, fetchClientReviews } from '@/lib/clientApprovals';

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
  post_time?: string | null;
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

type Review = { approved: boolean; at: string | null; changeRequested?: boolean };

/** Aprova ou pede ajuste. Sem a função do banco ainda aplicada, registra só o comentário na tarefa. */
async function sendReview(taskId: string, approve: boolean, comment: string) {
  const { error } = await (supabase as any).rpc('client_review_task', { _id: taskId, _approve: approve, _comment: comment });
  if (!error) return;
  if (error.code !== 'PGRST202') throw new Error(error.message);
  const content = approve
    ? '✅ Aprovado pelo cliente' + (comment ? `\n${comment}` : '')
    : `✏️ Ajuste pedido pelo cliente:\n${comment}`;
  const { error: fallbackError } = await supabase.from('task_comments')
    .insert({ task_id: taskId, author: CLIENT_REVIEW_AUTHOR, content });
  if (fallbackError) throw new Error(fallbackError.message);
}

// ─── Fases que o cliente enxerga ─────────────────────────────────────────────
// As colunas do kanban mudam com o tempo; aqui elas viram poucas fases que fazem sentido para o cliente.

type Phase = 'oculto' | 'preparo' | 'gravacao' | 'edicao' | 'revisao' | 'agendado' | 'publicado';

const norm = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

function phaseOf(status: string): Phase {
  const s = norm(status);
  // Etapas internas que o cliente não precisa ver
  if (/^ideia|backlog|copy finalizada/.test(s)) return 'oculto';
  if (/postado|publicado|concluido/.test(s)) return 'publicado';
  if (/programado|agendado|aprovado/.test(s)) return 'agendado';
  if (/revisao|aprovacao|finalizado|pronta/.test(s)) return 'revisao';
  // "Próxima captação": ainda vai ser gravado
  if (/captacao|gravacao|gravar/.test(s)) return 'gravacao';
  // "Pré-produção" na INOVA é o material já gravado, indo para a edição
  if (/pre ?-? ?producao|edicao|decupagem|gravado|design/.test(s)) return 'edicao';
  return 'preparo';
}

/** Cor e explicação de cada fase (tokens do tema: rec = gravação, warning = edição, brand = sua vez) */
const PHASE_STYLE: Record<Exclude<Phase, 'oculto'>, { title: string; hint: string; dot: string; text: string; bar: string; edge: string }> = {
  revisao:   { title: 'Para você aprovar', hint: 'Pronto para você assistir e aprovar.', dot: 'bg-brand', text: 'text-primary', bar: 'bg-brand', edge: 'border-l-brand' },
  gravacao:  { title: 'Próxima captação', hint: 'Ainda vai ser gravado. Veja o roteiro para chegar preparado.', dot: 'bg-rec', text: 'text-rec', bar: 'bg-rec', edge: 'border-l-rec' },
  edicao:    { title: 'Já gravado, em edição', hint: 'Já gravamos. Agora está na edição.', dot: 'bg-warning', text: 'text-warning', bar: 'bg-warning', edge: 'border-l-warning' },
  preparo:   { title: 'Em preparação', hint: 'Roteiro e texto sendo preparados pela equipe.', dot: 'bg-muted-foreground', text: 'text-muted-foreground', bar: 'bg-muted-foreground', edge: 'border-l-muted-foreground/40' },
  agendado:  { title: 'Agendados', hint: 'Aprovado e com data para ir ao ar.', dot: 'bg-success', text: 'text-success', bar: 'bg-success', edge: 'border-l-success' },
  publicado: { title: 'Entregues recentemente', hint: '', dot: 'bg-success', text: 'text-success', bar: 'bg-success', edge: 'border-l-success' },
};

const isArteTask = (t: TaskData) => t.task_type === 'Arte';

/** Etapas da linha de produção mostradas no rastreador de cada conteúdo */
function pipelineFor(t: TaskData): { phase: Phase; label: string }[] {
  return isArteTask(t)
    ? [
        { phase: 'preparo', label: 'Texto' },
        { phase: 'edicao', label: 'Criação' },
        { phase: 'revisao', label: 'Sua aprovação' },
        { phase: 'publicado', label: 'Publicação' },
      ]
    : [
        { phase: 'preparo', label: 'Roteiro' },
        { phase: 'gravacao', label: 'Gravação' },
        { phase: 'edicao', label: 'Edição' },
        { phase: 'revisao', label: 'Sua aprovação' },
        { phase: 'publicado', label: 'Publicação' },
      ];
}

function pipelineIndex(t: TaskData) {
  const phase = phaseOf(t.status);
  const steps = pipelineFor(t);
  if (phase === 'agendado') return steps.length - 1;
  const i = steps.findIndex((s) => s.phase === phase);
  return i < 0 ? 0 : i;
}

const titleOf = (t: TaskData) =>
  (isArteTask(t) ? t.title : t.video_name || t.title)?.replace(/^(vídeo|video|arte)\s*\d*\s*\|\s*/i, '') || 'Sem título';

/** Data em que o conteúdo vai ao ar (só datas no formato do banco, sem fuso) */
function postDateOf(t: TaskData): Date | null {
  const raw = t.post_date || t.scheduled_date;
  if (!raw) return null;
  const d = new Date(String(raw).slice(0, 10) + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

function platformIcon(platform: string) {
  const p = (platform || '').toLowerCase();
  if (p.includes('instagram')) return <Instagram className="h-3.5 w-3.5" />;
  if (p.includes('youtube')) return <Youtube className="h-3.5 w-3.5" />;
  return null;
}

/** Textos-padrão vazios ("Sem informação.", "-", "n/a") contam como vazio */
function hasText(v?: string | null) {
  const t = (v || '').trim();
  if (!t) return false;
  const n = norm(t).replace(/[.\s]/g, '');
  return !['seminformacao', 'seminformcao', 'seminfo', '-', 'na', 'n/a'].includes(n);
}

// ─── Peças de interface ──────────────────────────────────────────────────────

/** Texto com os endereços (http…) clicáveis */
function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/\S+)/g).map((part, i) =>
        /^https?:\/\//.test(part)
          ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline-offset-2 hover:underline">{part}</a>
          : part)}
    </>
  );
}

/** Claquete da data: dia em destaque, mês e dia da semana embaixo */
function DateSlate({ date, muted }: { date: Date | null; muted?: boolean }) {
  return (
    <div className={cn('flex w-12 shrink-0 flex-col items-center rounded-lg py-1.5 text-center', muted ? 'bg-foreground/[0.03]' : 'bg-foreground/[0.06]')}>
      {date ? (
        <>
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
          </span>
          <span className={cn('font-display text-lg font-semibold leading-tight tabular-nums', muted ? 'text-muted-foreground' : 'text-foreground')}>
            {date.getDate()}
          </span>
          <span className="text-[10px] text-muted-foreground">{date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
        </>
      ) : (
        <span className="py-3 text-sm text-muted-foreground/50" title="Data a definir">—</span>
      )}
    </div>
  );
}

/** Rastreador da linha de produção: etapas feitas, a atual acesa e as que faltam */
function PipelineTrack({ task }: { task: TaskData }) {
  const steps = pipelineFor(task);
  const current = pipelineIndex(task);
  const phase = phaseOf(task.status);
  const scheduled = phase === 'agendado';
  const color = phase === 'oculto' ? 'bg-tally' : PHASE_STYLE[phase].bar;
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1" aria-hidden>
        {steps.map((s, i) => (
          <span key={s.phase} className={cn('h-1 flex-1 rounded-full',
            i < current ? 'bg-foreground/30' : i === current ? color : 'bg-foreground/10')} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground/90">{scheduled ? 'Agendado' : steps[current].label}</span>
        {' '}· etapa {current + 1} de {steps.length}
      </p>
    </div>
  );
}

function MetaLine({ task, showDate }: { task: TaskData; showDate?: boolean }) {
  const date = postDateOf(task);
  const time = task.post_time ? task.post_time.slice(0, 5) : null;
  const parts = [
    isArteTask(task) ? 'Arte' : task.format || 'Vídeo',
    task.platform,
    showDate && date ? date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '') + (time ? ` · ${time}` : '') : null,
  ].filter(Boolean);
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      {platformIcon(task.platform)}
      {parts.join(' · ')}
    </p>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); toast.success(`${label} copiada`); setTimeout(() => setCopied(false), 1600); }
        catch { toast.error('Não foi possível copiar'); }
      }}
      className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 active:scale-[0.97]"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copiada' : 'Copiar'}
    </button>
  );
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95" onClick={onClose} role="dialog" aria-modal>
      <button onClick={onClose} className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20" aria-label="Fechar">
        <X className="h-5 w-5" />
      </button>
      <img src={src} alt="Arte ampliada" className="max-h-screen w-full max-w-screen-xl select-none object-contain p-6" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

function ResolvedVideo({ url, fileName }: { url: string; fileName: string }) {
  const [reload, setReload] = useState(0);
  const [resolved, setResolved] = useState(url);
  useEffect(() => {
    let cancelled = false;
    setResolved(url);
    resolveVideoUrl(url).then((r) => { if (!cancelled) setResolved(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, [url]);

  const download = async () => {
    const tid = toast.loading('Baixando vídeo…');
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
          if (value) { chunks.push(value); received += value.length; if (total) toast.loading(`Baixando… ${Math.round((received / total) * 100)}%`, { id: tid }); }
        }
      }
      const blob = new Blob(chunks as BlobPart[], { type: res.headers.get('content-type') || 'video/mp4' });
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = objUrl; a.download = fileName;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
      toast.success('Download concluído', { id: tid });
    } catch (e) {
      toast.error(`Erro ao baixar: ${e instanceof Error ? e.message : 'tente novamente'}`, { id: tid });
    }
  };

  return (
    <div className="space-y-2">
      {/* Moldura sempre escura: os controles do player seguem o tema escuro */}
      <div className="dark overflow-hidden rounded-lg bg-black">
        <UniversalVideoPlayer src={resolved} reloadKey={reload} />
      </div>
      <div className="flex flex-wrap gap-1">
        <MediaAction onClick={download} icon={Download}>Baixar</MediaAction>
        <MediaAction onClick={() => setReload((k) => k + 1)} icon={RefreshCw}>Recarregar</MediaAction>
        <MediaAction href={resolved} icon={ExternalLink}>Abrir em nova aba</MediaAction>
      </div>
    </div>
  );
}

function MediaAction({ icon: Icon, children, onClick, href }: { icon: typeof Play; children: React.ReactNode; onClick?: () => void; href?: string }) {
  const cls = 'inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground active:scale-[0.97]';
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}><Icon className="h-3.5 w-3.5" />{children}</a>
    : <button type="button" onClick={onClick} className={cls}><Icon className="h-3.5 w-3.5" />{children}</button>;
}

/** Vídeo ou arte do conteúdo — o que o cliente veio ver */
function TaskMedia({ task }: { task: TaskData }) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (isArteTask(task)) {
    return (
      <>
        <ArteAttachmentsPreview taskId={task.id} compact={false} onPreviewClick={(urls, i) => setLightbox(urls[i])} />
        {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
      </>
    );
  }

  const url = task.video_url;
  if (!url) return null;
  const isDrive = /drive\.google\.com/i.test(url);
  const isYouTube = /(youtube\.com|youtu\.be)/i.test(url);
  const isDirectFile = /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);
  const fileName = (task.video_name || task.title || 'video').replace(/[^\w.-]+/g, '_')
    + (url.match(/\.(mp4|webm|ogg|mov|m4v)(\?|$)/i)?.[0]?.split('?')[0] || '.mp4');

  if (!isDrive && !isYouTube && (isDirectFile || /supabase\.co\/storage/i.test(url))) return <ResolvedVideo url={url} fileName={fileName} />;

  if (isYouTube || isDrive) {
    const src = isYouTube
      ? url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')
      : url.replace('/view', '/preview');
    return (
      <div className="space-y-2">
        <div className="aspect-video overflow-hidden rounded-lg bg-black">
          <iframe src={src} className="h-full w-full" allow="autoplay" allowFullScreen title={titleOf(task)} />
        </div>
        <MediaAction href={url} icon={ExternalLink}>{isDrive ? 'Abrir no Google Drive' : 'Abrir no YouTube'}</MediaAction>
      </div>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 rounded-lg bg-primary/10 px-4 py-3.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/15">
      <span className="flex items-center gap-2"><Play className="h-4 w-4" /> Assistir o vídeo</span>
      <ExternalLink className="h-4 w-4" />
    </a>
  );
}

/** Legenda + detalhes de produção (roteiro, referências…) recolhidos */
/** Tem roteiro ou algum detalhe para a equipe ler */
const hasDetails = (t: TaskData) =>
  [t.full_script, t.recording_notes, t.video_objective, t.video_references, t.creative_direction, t.editing_style, t.observations]
    .some((v) => hasText(v));

function TaskDetails({ task, openScript }: { task: TaskData; openScript?: boolean }) {
  const details = [
    { label: 'Objetivo', content: task.video_objective },
    { label: 'Roteiro', content: task.full_script, script: true },
    { label: 'Referências', content: task.video_references, links: true },
    { label: 'Notas de gravação', content: task.recording_notes },
    { label: 'Direção criativa', content: task.creative_direction },
    { label: 'Estilo de edição', content: task.editing_style },
    { label: 'Observações', content: task.observations },
  ].filter((d) => hasText(d.content));

  return (
    <div className="space-y-3">
      {hasText(task.description) && <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80 [text-wrap:pretty]"><Linkified text={task.description} /></p>}

      {hasText(task.caption) && (
        <div className="rounded-lg bg-foreground/[0.04] p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Legenda</span>
            <CopyButton text={task.caption!} label="Legenda" />
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{task.caption}</p>
        </div>
      )}

      {details.length > 0 && (
        <details className="group rounded-lg bg-foreground/[0.04]" open={openScript}>
          <summary className="flex h-11 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            Detalhes da produção
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 px-3 pb-3">
            {details.map((d) => (
              <div key={d.label}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{d.label}</p>
                {d.links ? (
                  <div className="space-y-1">
                    {d.content!.split('\n').filter((l) => l.trim()).map((line, j) => (
                      <a key={j} href={line.trim().startsWith('http') ? line.trim() : `https://${line.trim()}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-start gap-1.5 break-all text-sm text-primary underline-offset-2 hover:underline">
                        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />{line.trim()}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className={cn('whitespace-pre-wrap text-sm leading-relaxed text-foreground/80', d.script && 'rounded-md bg-background/60 p-3')}>{d.content}</p>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Cartões por fase ────────────────────────────────────────────────────────

/** Conteúdo pronto para o cliente ver: a mídia vem primeiro e domina o cartão; no rodapé, aprovar ou pedir ajuste */
function ReviewCard({ task, highlight, review, onReviewed }: {
  task: TaskData; highlight?: boolean; review?: Review; onReviewed: (r: Review) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<'approve' | 'change' | null>(null);
  const approved = !!review?.approved;

  const submit = async (approve: boolean) => {
    setBusy(approve ? 'approve' : 'change');
    try {
      await sendReview(task.id, approve, approve ? '' : comment.trim());
      onReviewed(approve ? { approved: true, at: new Date().toISOString() } : { approved: false, at: null, changeRequested: true });
      setAsking(false); setComment('');
      toast.success(approve ? 'Conteúdo aprovado. Obrigado!' : 'Pedido de ajuste enviado para a equipe');
    } catch (e) {
      toast.error(`Não foi possível enviar: ${e instanceof Error ? e.message : 'tente de novo'}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <article id={`c-${task.id}`} className={cn('scroll-mt-20 overflow-hidden rounded-xl border bg-card', highlight && 'ring-2 ring-primary/50')}>
      <div className="flex items-start justify-between gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
        <div className="min-w-0 space-y-1">
          <h3 className="font-display text-base font-semibold leading-snug [text-wrap:balance]">{titleOf(task)}</h3>
          <MetaLine task={task} showDate />
        </div>
        {approved ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-semibold text-success">
            <Check className="h-3 w-3" /> Aprovado
          </span>
        ) : review?.changeRequested ? (
          <span className="shrink-0 rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-warning">Em ajuste</span>
        ) : (
          <span className="shrink-0 rounded-full bg-brand px-2.5 py-1 text-[11px] font-semibold text-brand-foreground">Para aprovar</span>
        )}
      </div>
      <div className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
        <TaskMedia task={task} />
        <TaskDetails task={task} />
      </div>

      <div className="border-t bg-foreground/[0.02] p-4 sm:px-5">
        {asking ? (
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">O que você quer mudar?</span>
              <Textarea autoFocus value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000}
                placeholder="Ex.: trocar a música, tirar o trecho dos 0:12, ajustar a legenda…" className="min-h-[96px]" />
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => { setAsking(false); setComment(''); }} disabled={!!busy}>Cancelar</Button>
              <Button onClick={() => submit(false)} disabled={comment.trim().length < 3 || !!busy}>
                {busy === 'change' && <Loader2 className="h-4 w-4 animate-spin" />} Enviar pedido de ajuste
              </Button>
            </div>
          </div>
        ) : approved ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm text-success">
              <Check className="h-4 w-4" />
              Você aprovou{review?.at ? ` em ${new Date(review.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
            </p>
            <Button size="sm" variant="ghost" onClick={() => setAsking(true)}>Pedir ajuste</Button>
          </div>
        ) : review?.changeRequested ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Pedido enviado. A equipe vai ajustar e te avisar.</p>
            <Button size="sm" variant="ghost" onClick={() => setAsking(true)}>Pedir outro ajuste</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button variant="outline" onClick={() => setAsking(true)} disabled={!!busy}>Pedir ajuste</Button>
            <Button onClick={() => submit(true)} disabled={!!busy} className="gap-1.5">
              {busy === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Aprovar
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

/** Linha compacta: claquete da data, título e onde está na produção. Abre para ver detalhes quando existem. */
function PipelineRow({ task, highlight, expandable, slate = true }: { task: TaskData; highlight?: boolean; expandable?: boolean; slate?: boolean }) {
  const [open, setOpen] = useState(!!highlight);
  const date = postDateOf(task);
  const past = !!date && date < startOfToday();
  const head = (
    <>
      {slate && <DateSlate date={past ? null : date} muted={past} />}
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="truncate text-sm font-semibold">{titleOf(task)}</p>
          <MetaLine task={task} />
        </div>
        <PipelineTrack task={task} />
      </div>
    </>
  );
  return (
    <li id={`c-${task.id}`} className={cn('scroll-mt-20', highlight && 'bg-primary/[0.06]')}>
      {expandable ? (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-foreground/[0.03] sm:p-4">
          {head}
          <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
      ) : (
        <div className="flex items-start gap-3 p-3 sm:p-4">{head}</div>
      )}
      {expandable && open && (
        <div className={cn('space-y-4 px-3 pb-4 sm:pr-4', slate && 'sm:pl-[76px]')}>
          {phaseOf(task.status) === 'gravacao' && (
            <p className="rounded-lg bg-rec/10 px-3 py-2 text-sm text-foreground/90">
              Este vídeo ainda vai ser gravado. Dê uma olhada no roteiro para chegar preparado.
            </p>
          )}
          {phaseOf(task.status) === 'agendado' && <TaskMedia task={task} />}
          <TaskDetails task={task} openScript={phaseOf(task.status) !== 'agendado'} />
        </div>
      )}
    </li>
  );
}

/** Entregue: abre o roteiro e os detalhes quando houver */
function DeliveredRow({ task }: { task: TaskData }) {
  const [open, setOpen] = useState(false);
  const expandable = hasDetails(task) || !!task.video_url || isArteTask(task);
  const head = (
    <>
      <DateSlate date={postDateOf(task)} muted />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground/80">{titleOf(task)}</p>
        <MetaLine task={task} />
      </div>
      <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><Check className="h-3.5 w-3.5" /> Entregue</span>
    </>
  );
  return (
    <li>
      {expandable ? (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-foreground/[0.03] sm:px-4">
          {head}
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
      ) : (
        <div className="flex items-center gap-3 p-3 sm:px-4">{head}</div>
      )}
      {expandable && open && (
        <div className="space-y-4 px-3 pb-4 sm:pl-[76px] sm:pr-4">
          <TaskMedia task={task} />
          <TaskDetails task={task} openScript />
        </div>
      )}
    </li>
  );
}

function Section({ phase, count, children }: { phase: Exclude<Phase, 'oculto'>; count: number; children: React.ReactNode }) {
  const st = PHASE_STYLE[phase];
  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', st.dot)} />
          <h2 className={cn('text-[11px] font-semibold uppercase tracking-[0.08em]', st.text)}>{st.title}</h2>
          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{count}</span>
        </div>
        {st.hint && <p className="pl-[18px] text-xs text-muted-foreground">{st.hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Lista de uma fase: cartão com a borda esquerda na cor da fase */
function PhaseList({ phase, tasks, taskId, slate, expandable }: {
  phase: Exclude<Phase, 'oculto'>; tasks: TaskData[]; taskId?: string; slate: boolean; expandable: (t: TaskData) => boolean;
}) {
  if (!tasks.length) return null;
  return (
    <Section phase={phase} count={tasks.length}>
      <ul className={cn('divide-y divide-border overflow-hidden rounded-xl border border-l-[3px] bg-card', PHASE_STYLE[phase].edge)}>
        {tasks.map((t) => (
          <PipelineRow key={t.id} task={t} highlight={t.id === taskId} slate={slate} expandable={expandable(t)} />
        ))}
      </ul>
    </Section>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function ClientContentPage() {
  useSeo({
    title: 'Aprovação de Conteúdo — INOVA Co.',
    description: 'Veja e aprove os vídeos e artes da sua marca produzidos pela INOVA Co.',
    image: PAGE_THUMBS.conteudo,
    noindex: true,
  });
  const { taskId } = useParams<{ taskId: string }>();
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [reviews, setReviews] = useState<Record<string, Review>>({});

  const loadContent = useCallback(async (id: string, forceRefresh = false) => {
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
      // Aprovações já feitas, pelo histórico de comentários das tarefas
      fetchClientReviews(list.map((t) => t.id)).then((r) => setReviews((prev) => ({ ...prev, ...r })));
      setLoading(false);
      pageCache.set(id, { data: list, clientName: name, timestamp: Date.now() });
      try { sessionStorage.setItem(`client-content:${id}`, JSON.stringify({ tasks: list, clientName: name })); } catch { /* sem storage */ }
      return;
    }
    setNotFound(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!taskId) return;
    // sessionStorage primeiro: a página abre na hora quando o cliente volta ao link
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
    } catch { /* sem storage */ }
    loadContent(taskId);
  }, [taskId, loadContent]);

  // Atualiza sozinho a cada 4 min e quando o cliente volta para a aba
  useEffect(() => {
    if (!taskId) return;
    let timeout: ReturnType<typeof setTimeout>;
    let busy = false;
    const refresh = () => {
      if (busy) return;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (document.visibilityState !== 'visible') return;
        busy = true;
        loadContent(taskId, true).finally(() => { busy = false; });
      }, 1000);
    };
    const interval = setInterval(refresh, 4 * 60 * 1000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(interval); clearTimeout(timeout); document.removeEventListener('visibilitychange', refresh); };
  }, [taskId, loadContent]);

  // Leva até o conteúdo do link (quando o link é de uma tarefa específica)
  useEffect(() => {
    if (!taskId || loading) return;
    const el = document.getElementById(`c-${taskId}`);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }, [taskId, loading]);

  const manualRefresh = async () => {
    if (!taskId) return;
    setRefreshing(true);
    await loadContent(taskId, true);
    setRefreshing(false);
  };

  if (loading && tasks.length === 0) return (
    <Shell clientName="">
      <div className="space-y-3">
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted/60" />
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-card" />
      <div className="h-40 animate-pulse rounded-xl bg-card" />
    </Shell>
  );

  if (notFound || tasks.length === 0) return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <img src={logoInova} alt="INOVA Co." className="h-10 opacity-80 brightness-0 dark:brightness-100" />
      <div>
        <p className="font-display text-xl font-semibold">Conteúdo não encontrado</p>
        <p className="mt-1 text-sm text-muted-foreground">Confira o link ou fale com a equipe da INOVA.</p>
      </div>
    </div>
  );

  // Link deste cliente específico mostra só o que está em texto final, revisão ou pronto
  const restricted = taskId === '48e60f29-5c9c-4449-858d-52e2ce6edc8f';
  const visible = tasks.filter((t) => {
    const s = norm(t.status);
    if (restricted) return ['copy finalizada', 'revisao', 'em revisao', 'finalizado'].includes(s);
    return phaseOf(t.status) !== 'oculto';
  });

  const byDate = (a: TaskData, b: TaskData) => (postDateOf(a)?.getTime() ?? Infinity) - (postDateOf(b)?.getTime() ?? Infinity);
  const toReview = visible.filter((t) => phaseOf(t.status) === 'revisao').sort(byDate);
  const toRecord = visible.filter((t) => phaseOf(t.status) === 'gravacao').sort(byDate);
  const editing = visible.filter((t) => phaseOf(t.status) === 'edicao').sort(byDate);
  const preparing = visible.filter((t) => phaseOf(t.status) === 'preparo').sort(byDate);
  const inProduction = [...toRecord, ...editing, ...preparing];
  const scheduled = visible.filter((t) => phaseOf(t.status) === 'agendado').sort(byDate);
  const published = visible.filter((t) => phaseOf(t.status) === 'publicado')
    .sort((a, b) => byDate(b, a)).slice(0, 12);

  // Só mostra a claquete de data quando algum item da lista tem data pela frente
  const hasUpcoming = (list: TaskData[]) => list.some((t) => { const d = postDateOf(t); return !!d && d >= startOfToday(); });

  const awaiting = toReview.filter((t) => !reviews[t.id]?.approved && !reviews[t.id]?.changeRequested);

  const summary = [
    awaiting.length && `${awaiting.length} para você aprovar`,
    toRecord.length && `${toRecord.length} para gravar`,
    editing.length && `${editing.length} em edição`,
    preparing.length && `${preparing.length} em preparação`,
    scheduled.length && `${scheduled.length} ${scheduled.length === 1 ? 'agendado' : 'agendados'}`,
  ].filter(Boolean) as string[];

  return (
    <Shell clientName={clientName} onRefresh={manualRefresh} refreshing={refreshing}>
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Conteúdo da sua marca</p>
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight [text-wrap:balance] sm:text-[32px]">
          {clientName || 'Seu conteúdo'}
        </h1>
        <p className="text-sm text-muted-foreground [text-wrap:pretty]">
          {summary.length
            ? <>Hoje: {summary.map((s, i) => (
                <span key={s}>{i > 0 && ' · '}<span className={cn(i === 0 && awaiting.length ? 'font-semibold text-foreground' : '')}>{s}</span></span>
              ))}.</>
            : 'Nada pendente agora. Assim que tiver conteúdo novo, ele aparece aqui.'}
        </p>
      </header>

      {toReview.length > 0 && (
        <Section phase="revisao" count={toReview.length}>
          <div className="space-y-4">
            {toReview.map((t) => (
              <ReviewCard key={t.id} task={t} highlight={t.id === taskId && toReview.length > 1}
                review={reviews[t.id]} onReviewed={(r) => setReviews((prev) => ({ ...prev, [t.id]: r }))} />
            ))}
          </div>
        </Section>
      )}

      <PhaseList phase="gravacao" tasks={toRecord} taskId={taskId} slate={hasUpcoming(toRecord)} expandable={hasDetails} />
      <PhaseList phase="edicao" tasks={editing} taskId={taskId} slate={hasUpcoming(editing)} expandable={hasDetails} />
      <PhaseList phase="preparo" tasks={preparing} taskId={taskId} slate={hasUpcoming(preparing)} expandable={hasDetails} />
      <PhaseList phase="agendado" tasks={scheduled} taskId={taskId} slate={hasUpcoming(scheduled)} expandable={() => true} />

      {published.length > 0 && (
        <details className="group">
          <summary className="flex h-11 cursor-pointer list-none items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground [&::-webkit-details-marker]:hidden">
            <span className="h-2.5 w-2.5 rounded-full bg-success" /> Entregues recentemente <span className="tabular-nums text-muted-foreground/70">{published.length}</span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-1 divide-y divide-border overflow-hidden rounded-xl border bg-card">
            {published.map((t) => <DeliveredRow key={t.id} task={t} />)}
          </ul>
        </details>
      )}

      {!toReview.length && !inProduction.length && !scheduled.length && !published.length && (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">Tudo em dia</p>
          <p className="mt-1 text-sm text-muted-foreground">Nenhum conteúdo por aqui no momento.</p>
        </div>
      )}
    </Shell>
  );
}

function Shell({ clientName, onRefresh, refreshing, children }: {
  clientName: string; onRefresh?: () => void; refreshing?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="sticky top-0 z-10 border-b bg-background/95">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logoInova} alt="INOVA Co." className="h-8 shrink-0 brightness-0 dark:brightness-100" />
            {clientName && <span className="h-5 w-px shrink-0 bg-border" />}
            {clientName && <span className="truncate text-sm font-medium text-muted-foreground">{clientName}</span>}
          </div>
          {onRefresh && (
            <button type="button" onClick={onRefresh} disabled={refreshing} aria-label="Atualizar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground active:scale-[0.97]">
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>
      <main className="mx-auto max-w-2xl space-y-8 px-4 pb-16 pt-6 sm:pt-10">
        {children}
        <p className="pt-6 text-center text-xs text-muted-foreground">Produzido pela equipe INOVA Co.</p>
      </main>
    </div>
  );
}
