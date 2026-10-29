import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Download, ExternalLink,
  FileText, Film, Image as ImageIcon, Link2, Loader2, Users,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useKanbanStages } from '@/hooks/useKanbanStages';
import { isReferenceAttachment } from '@/lib/attachmentPurpose';
import { cn } from '@/lib/utils';

/** Limite de caracteres da legenda no Instagram */
const CAPTION_LIMIT = 2200;

type FullTask = {
  id: string; title: string; task_type: string; status: string; client_id: string | null;
  post_date: string | null; post_time: string | null; due_date: string | null;
  video_url: string | null; cuts_url: string | null; raw_footage_url: string | null;
  platform: string; format: string; priority: string; caption: string | null;
  description: string; full_script: string; video_idea: string; observations: string;
  copywriter: string; videomaker: string; editor: string; assignee: string;
};
type Attachment = { id: string; file_url: string; file_type: string; file_name: string };

export type PostPatch = { id: string } & Partial<Pick<FullTask, 'post_date' | 'post_time' | 'status' | 'caption'>>;

interface Props {
  taskId: string | null;
  /** Ordem dos posts visíveis no calendário, para navegar com ← → */
  order: string[];
  clientName: (clientId: string | null) => string;
  onNavigate: (id: string) => void;
  onClose: () => void;
  onChanged: (patch: PostPatch) => void;
}

const isImage = (a: Attachment) => /^image\//.test(a.file_type) || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(a.file_url);
const isVideo = (a: Attachment) => /^video\//.test(a.file_type) || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(a.file_url);

export function PostDetailSheet({ taskId, order, clientName, onNavigate, onClose, onChanged }: Props) {
  const [task, setTask] = useState<FullTask | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [draft, setDraft] = useState({ post_date: '', post_time: '', status: '', caption: '' });

  const isArte = task?.task_type === 'Arte';
  const { stages } = useKanbanStages(isArte ? 'artes' : 'tasks');

  useEffect(() => {
    if (!taskId) return;
    let active = true;
    setLoading(true); setMediaIndex(0);
    (async () => {
      const [{ data: t }, { data: att }] = await Promise.all([
        supabase.from('tasks').select('*').eq('id', taskId).single(),
        supabase.from('task_attachments').select('id,file_url,file_type,file_name').eq('task_id', taskId).order('created_at'),
      ]);
      if (!active) return;
      const full = t as FullTask | null;
      setTask(full);
      setAttachments(((att ?? []) as Attachment[]).filter((a) => !isReferenceAttachment(a.file_url)));
      setDraft({
        post_date: full?.post_date ?? '',
        post_time: full?.post_time?.slice(0, 5) ?? '',
        status: full?.status ?? '',
        caption: full?.caption ?? '',
      });
      setLoading(false);
    })();
    return () => { active = false; };
  }, [taskId]);

  // Mídia principal: vídeo final primeiro, depois anexos de imagem/vídeo
  const media = useMemo(() => {
    const list: { url: string; kind: 'video' | 'image'; name: string }[] = [];
    if (task?.video_url) list.push({ url: task.video_url, kind: 'video', name: 'Vídeo final' });
    attachments.forEach((a) => {
      if (isVideo(a) && a.file_url !== task?.video_url) list.push({ url: a.file_url, kind: 'video', name: a.file_name });
      else if (isImage(a)) list.push({ url: a.file_url, kind: 'image', name: a.file_name });
    });
    return list;
  }, [task, attachments]);
  const current = media[Math.min(mediaIndex, media.length - 1)];

  const position = taskId ? order.indexOf(taskId) : -1;
  const prevId = position > 0 ? order[position - 1] : null;
  const nextId = position >= 0 && position < order.length - 1 ? order[position + 1] : null;

  const dirty = !!task && (
    draft.post_date !== (task.post_date ?? '') ||
    draft.post_time !== (task.post_time?.slice(0, 5) ?? '') ||
    draft.status !== task.status ||
    draft.caption !== (task.caption ?? '')
  );

  // ← → navegam entre posts quando o foco não está num campo
  useEffect(() => {
    if (!taskId) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, [role="combobox"], [contenteditable="true"]')) return;
      if (e.key === 'ArrowLeft' && prevId) onNavigate(prevId);
      if (e.key === 'ArrowRight' && nextId) onNavigate(nextId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [taskId, prevId, nextId, onNavigate]);

  const save = async () => {
    if (!task) return;
    setSaving(true);
    const patch = {
      post_date: draft.post_date || null,
      post_time: draft.post_time || null,
      status: draft.status,
      caption: draft.caption,
    };
    const { error } = await supabase.from('tasks').update(patch).eq('id', task.id);
    setSaving(false);
    if (error) { toast.error('Não foi possível salvar. Tente de novo.'); return; }
    setTask({ ...task, ...patch });
    onChanged({ id: task.id, ...patch });
    toast.success('Post atualizado');
  };

  const copy = async (text: string, message: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(message); }
    catch { toast.error('Não foi possível copiar'); }
  };

  const kanbanUrl = task ? `${isArte ? '/artes' : '/tarefas'}?taskId=${task.id}` : '#';
  const team = task ? [
    ['Copy', task.copywriter], ['Videomaker', task.videomaker], ['Edição', task.editor], ['Responsável', task.assignee],
  ].filter(([, v]) => v && v.trim()) : [];
  const brief = task ? [
    ['Roteiro', task.full_script], ['Ideia', task.video_idea || task.description], ['Observações', task.observations],
  ].filter(([, v]) => v && v.trim()) : [];

  return (
    <Sheet open={!!taskId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {/* Cabeçalho */}
        <div className="flex items-start gap-3 border-b p-4 pr-12">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {task ? clientName(task.client_id) : 'Carregando'}{task?.format ? ` · ${task.format}` : ''}
            </p>
            <SheetTitle className="mt-0.5 line-clamp-2 font-display text-lg font-semibold leading-tight">
              {task?.title ?? ' '}
            </SheetTitle>
            <SheetDescription className="sr-only">Detalhes, mídia e legenda do post</SheetDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!prevId} onClick={() => prevId && onNavigate(prevId)} aria-label="Post anterior" title="Post anterior (←)">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">{position >= 0 ? `${position + 1}/${order.length}` : ''}</span>
            <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!nextId} onClick={() => nextId && onNavigate(nextId)} aria-label="Próximo post" title="Próximo post (→)">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loading || !task ? (
          <div className="flex flex-1 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            {/* Mídia */}
            <section>
              <div className={cn('relative flex w-full items-center justify-center overflow-hidden rounded-lg', current ? 'aspect-[4/5] max-h-[55vh] bg-black' : 'h-28 bg-muted')}>
                {current?.kind === 'video' ? (
                  <video key={current.url} src={current.url} controls playsInline preload="metadata" crossOrigin="anonymous" className="h-full w-full object-contain" />
                ) : current?.kind === 'image' ? (
                  <img key={current.url} src={current.url} alt={current.name} crossOrigin="anonymous" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    {isArte ? <ImageIcon className="h-8 w-8" /> : <Film className="h-8 w-8" />}
                    <p className="text-sm">Ainda sem mídia anexada</p>
                  </div>
                )}
              </div>
              {media.length > 1 && (
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {media.map((m, i) => (
                    <button key={m.url} onClick={() => setMediaIndex(i)} aria-label={`Ver mídia ${i + 1}`}
                      className={cn('relative h-14 w-14 shrink-0 overflow-hidden rounded-md ring-offset-2 ring-offset-background transition', i === mediaIndex ? 'ring-2 ring-primary' : 'opacity-70 hover:opacity-100')}>
                      {m.kind === 'image'
                        ? <img src={m.url} alt="" crossOrigin="anonymous" loading="lazy" className="h-full w-full object-cover" />
                        : <span className="flex h-full w-full items-center justify-center bg-muted"><Film className="h-4 w-4" /></span>}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {current && (
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <a href={current.url} target="_blank" rel="noopener noreferrer" download><Download className="h-3.5 w-3.5" /> Baixar mídia</a>
                  </Button>
                )}
                {task.cuts_url && (
                  <Button asChild size="sm" variant="ghost" className="gap-1.5">
                    <a href={task.cuts_url} target="_blank" rel="noopener noreferrer"><Link2 className="h-3.5 w-3.5" /> Cortes</a>
                  </Button>
                )}
                {task.raw_footage_url && (
                  <Button asChild size="sm" variant="ghost" className="gap-1.5">
                    <a href={task.raw_footage_url} target="_blank" rel="noopener noreferrer"><Link2 className="h-3.5 w-3.5" /> Material bruto</a>
                  </Button>
                )}
              </div>
            </section>

            {/* Publicação */}
            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" /> Publicação
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={draft.post_date} onChange={(e) => setDraft({ ...draft, post_date: e.target.value })} aria-label="Data de postagem" />
                <Input type="time" value={draft.post_time} onChange={(e) => setDraft({ ...draft, post_time: e.target.value })} aria-label="Horário de postagem" />
              </div>
              <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
                <SelectTrigger aria-label="Status"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  {!stages.some((s) => s.name === draft.status) && draft.status && <SelectItem value={draft.status}>{draft.status}</SelectItem>}
                  {stages.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {!draft.post_time && draft.post_date && (
                <p className="flex items-center gap-1.5 text-xs text-warning"><AlertTriangle className="h-3.5 w-3.5" /> Defina o horário para o post aparecer no lugar certo do calendário.</p>
              )}
            </section>

            {/* Legenda */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" /> Legenda
                </h3>
                <span className={cn('text-xs tabular-nums', draft.caption.length > CAPTION_LIMIT ? 'text-destructive' : 'text-muted-foreground')}>
                  {draft.caption.length}/{CAPTION_LIMIT}
                </span>
              </div>
              <Textarea value={draft.caption} onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
                placeholder="Escreva a legenda do post, com hashtags e chamada para ação" className="min-h-[140px] text-sm leading-relaxed" />
              <Button size="sm" variant="outline" className="gap-1.5" disabled={!draft.caption.trim()} onClick={() => copy(draft.caption, 'Legenda copiada')}>
                <Copy className="h-3.5 w-3.5" /> Copiar legenda
              </Button>
            </section>

            {/* Briefing */}
            {brief.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Briefing</h3>
                {brief.map(([label, value]) => (
                  <details key={label} className="group rounded-lg border bg-card">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-medium">
                      {label}
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                    </summary>
                    <div className="flex items-start gap-2 border-t px-3 py-2.5">
                      <p className="flex-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{value}</p>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copy(value, `${label}: copiado`)} aria-label={`Copiar ${label}`}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </details>
                ))}
              </section>
            )}

            {/* Equipe */}
            {team.length > 0 && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Equipe
                </h3>
                <div className="flex flex-wrap gap-2">
                  {team.map(([role, name]) => (
                    <span key={role} className="rounded-full bg-muted px-2.5 py-1 text-xs"><span className="text-muted-foreground">{role}:</span> {name}</span>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Rodapé fixo com ações */}
        <div className="flex items-center gap-2 border-t bg-card p-3 pb-safe">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <a href={kanbanUrl}><ExternalLink className="h-3.5 w-3.5" /> Kanban</a>
          </Button>
          {task && (
            // Mesmo link de compartilhamento do Kanban: página onde o cliente vê e aprova o conteúdo
            <Button variant="ghost" size="sm" className="gap-1.5" title="Copiar link para o cliente ver e aprovar"
              onClick={() => copy(`${window.location.origin}/conteudo/${task.client_id || task.id}`, 'Link copiado — envie para o cliente')}>
              <Link2 className="h-3.5 w-3.5" /> Link do cliente
            </Button>
          )}
          <Button className="ml-auto gap-1.5" disabled={!dirty || saving} onClick={save}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
