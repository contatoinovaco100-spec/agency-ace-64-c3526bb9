import { useState, useEffect, useRef, useCallback } from 'react';
import { useAgency } from '@/contexts/AgencyContext';
import { Task, TaskChecklistItem, TaskComment, TaskAttachment, Client, TeamMember, TaskStageHistory } from '@/types/agency';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Paperclip, Send, Trash2, Link, Upload, MessageSquare, CheckSquare, FileText, X, Share2, Download, History, ArrowRight, FolderOpen, AlertTriangle } from 'lucide-react';
import VideoUploader from './VideoUploader';
import { getDraft, saveDraft, deleteDraft, newDraftId } from '@/lib/taskDrafts';

import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';

interface Props {
  task: Task | null;
  isNew: boolean;
  clients: Client[];
  team: TeamMember[];
  defaultClientId?: string;
  defaultTaskType?: 'Arte' | 'Produção de Vídeo';
  defaultDueDate?: string;
  defaultStatus?: string;
  openDraftId?: string | null;
  onSave: (task: Task) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

const priorities = ['Alta', 'Média', 'Baixa'] as const;

/** Prefixo usado para diferenciar solicitações de alteração das notas comuns. */
const ALTERATION_PREFIX = '[ALTERAÇÃO] ';
const ALTERATION_STAGE = 'Alteração';

export default function TaskDetailPanel({ task, isNew, clients, team, defaultClientId, defaultTaskType, defaultDueDate, defaultStatus, openDraftId, onSave, onDelete, onClose }: Props) {
  const { getChecklist, upsertChecklistItem, deleteChecklistItem, getComments, addComment, getAttachments, addAttachment, deleteAttachment, getStageHistory, moveTaskToStage } = useAgency();

  const [form, setForm] = useState<Partial<Task>>({});
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [stageHistory, setStageHistory] = useState<TaskStageHistory[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [newAlteration, setNewAlteration] = useState('');
  const [alterationAuthor, setAlterationAuthor] = useState('');
  const [alterationTarget, setAlterationTarget] = useState('');

  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [newCheckLabel, setNewCheckLabel] = useState('');
  const [refLinkInput, setRefLinkInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);

  const alterations = comments.filter(c => c.content.startsWith(ALTERATION_PREFIX));
  const plainComments = comments.filter(c => !c.content.startsWith(ALTERATION_PREFIX));


  const isInvalidField = (value?: unknown) => validationAttempted && !String(value ?? '').trim();
  const fieldClass = (value?: unknown) => isInvalidField(value) ? 'border-destructive ring-1 ring-destructive/40 focus-visible:ring-destructive' : '';
  const labelClass = (value?: unknown) => isInvalidField(value) ? 'text-destructive' : 'text-muted-foreground';

  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftId, setDraftId] = useState<string>(() => newDraftId());

  const scriptRef = useRef<HTMLTextAreaElement>(null);
  const adjustScriptHeight = useCallback(() => {
    const el = scriptRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.max(el.scrollHeight, form.taskType === 'Arte' ? 420 : 260);
    el.style.height = `${next}px`;
  }, [form.taskType]);

  useEffect(() => {
    adjustScriptHeight();
  }, [form.fullScript, form.taskType, adjustScriptHeight]);

  useEffect(() => {
    setValidationAttempted(false);
    if (task) {
      setForm({ ...task });
      loadData(task.id);
    } else {
      const base: Partial<Task> = {
        taskType: defaultTaskType || 'Produção de Vídeo',
        status: (defaultStatus || 'Ideias / Backlog') as any,
        dueDate: defaultDueDate || '',
        priority: 'Média',
        clientId: defaultClientId || '',
        videoName: '', title: '', description: '', assignee: '',
        videoIdea: '', fullScript: '', videoReferences: '', observations: '',
        creativeDirection: '', editingStyle: '', strategicNotes: '',
        recordingNotes: '', editorComments: '',
        copywriter: '', director: '', videomaker: '', editor: '',
        platform: '', format: '', videoObjective: '', currentStageOwner: '',
      };
      let restored = false;
      try {
        const draft = openDraftId ? getDraft(openDraftId) : null;
        if (draft) {
          setForm({ ...base, ...(draft.form as Partial<Task>) });
          setDraftSavedAt(draft.savedAt || null);
          setDraftId(draft.id);
          restored = true;
        }
      } catch { /* rascunho inválido */ }
      setDraftRestored(restored);
      if (!restored) { setForm(base); setDraftSavedAt(null); setDraftId(newDraftId()); }
      setChecklist([]);
      setComments([]);
      setAttachments([]);
    }
  }, [task, defaultClientId, defaultTaskType, defaultDueDate, defaultStatus, openDraftId]);

  // Salva rascunho automaticamente enquanto cria um card novo
  useEffect(() => {
    if (!isNew || !form || Object.keys(form).length === 0) return;
    const t = setTimeout(() => {
      const savedAt = saveDraft(draftId, form as Record<string, unknown>);
      if (savedAt) setDraftSavedAt(savedAt);
    }, 600);
    return () => clearTimeout(t);
  }, [form, isNew, draftId]);

  const clearDraft = () => {
    deleteDraft(draftId);
    setDraftSavedAt(null);
    setDraftRestored(false);
    setDraftId(newDraftId());
  };


  const discardDraft = () => {
    clearDraft();
    setForm({
      taskType: defaultTaskType || 'Produção de Vídeo',
      status: (defaultStatus || 'Ideias / Backlog') as any,
      dueDate: defaultDueDate || '',
      priority: 'Média',
      clientId: defaultClientId || '',
      videoName: '', title: '', description: '', assignee: '',
      videoIdea: '', fullScript: '', videoReferences: '', observations: '',
      creativeDirection: '', editingStyle: '', strategicNotes: '',
      recordingNotes: '', editorComments: '',
      copywriter: '', director: '', videomaker: '', editor: '',
      platform: '', format: '', videoObjective: '', currentStageOwner: '',
      caption: '', postDate: '', postTime: '',
    });
    toast.success('Rascunho descartado');
  };


  const loadData = async (id: string) => {
    const [ch, co, at, hi] = await Promise.all([getChecklist(id), getComments(id), getAttachments(id), getStageHistory(id)]);
    setChecklist(ch);
    setComments(co);
    setAttachments(at);
    setStageHistory(hi);
  };

  const handleSave = async () => {
    setValidationAttempted(true);
    const isArte = form.taskType === 'Arte';
    const required: { label: string; value?: string }[] = [
      { label: 'Nome da tarefa', value: form.videoName || form.title },
      { label: 'Cliente', value: form.clientId },
      { label: 'Responsável', value: form.assignee },
      { label: 'Prioridade', value: form.priority },
      { label: 'Data de entrega', value: form.dueDate },
      { label: 'Data de postagem', value: form.postDate },
      { label: 'Hora de postagem', value: form.postTime },
      { label: 'Legenda', value: form.caption },
      { label: 'Roteiro', value: form.fullScript },
      ...(isArte ? [] : [
        { label: 'Plataforma', value: form.platform },
        { label: 'Formato', value: form.format },
        { label: 'Objetivo', value: form.videoObjective },
        { label: 'Referências', value: form.videoReferences },
      ]),
    ];
    const missing = required.filter(f => !(f.value || '').toString().trim());
    if (missing.length > 0) return;
    setSaving(true);

    try {
      const data: Task = {
        id: task?.id || crypto.randomUUID(),
        clientId: form.clientId || '',
        title: form.videoName || form.title || '',
        description: form.description || '',
        assignee: form.assignee || '',
        priority: (form.priority || 'Média') as any,
        dueDate: form.dueDate || '',
        status: (form.status || 'Ideias / Backlog') as any,
        taskType: (form.taskType || 'Produção de Vídeo') as any,
        videoName: form.videoName || '',
        platform: form.platform || '',
        format: form.format || '',
        videoObjective: form.videoObjective || '',
        scriptWriter: form.scriptWriter || '',
        editor: form.editor || '',
        videoIdea: form.videoIdea || '',
        fullScript: form.fullScript || '',
        videoReferences: form.videoReferences || '',
        observations: form.observations || '',
        creativeDirection: form.creativeDirection || '',
        editingStyle: form.editingStyle || '',
        strategicNotes: form.strategicNotes || '',
        recordingNotes: form.recordingNotes || '',
        editorComments: form.editorComments || '',
        currentStageOwner: form.currentStageOwner || '',
        copywriter: form.copywriter || '',
        director: form.director || '',
        videomaker: form.videomaker || '',
        videoUrl: form.videoUrl || '',
        rawFootageUrl: form.rawFootageUrl || '',
        postDate: form.postDate || '',
        postTime: form.postTime || '',
        caption: form.caption || '',

      };
      await onSave(data);
      if (isNew) clearDraft();

    } catch (err) {
      console.error('Erro ao salvar tarefa:', err);
      toast.error('Erro ao salvar tarefa');
    } finally {
      setSaving(false);
    }
  };

  // Checklist
  const toggleCheck = async (item: TaskChecklistItem) => {
    const updated = { ...item, checked: !item.checked };
    await upsertChecklistItem(updated);
    setChecklist(prev => prev.map(i => i.id === item.id ? updated : i));
  };

  const addCheckItem = async () => {
    if (!newCheckLabel.trim() || !task) return;
    const item: TaskChecklistItem = { id: crypto.randomUUID(), taskId: task.id, label: newCheckLabel, checked: false, sortOrder: checklist.length };
    await upsertChecklistItem(item);
    setChecklist(prev => [...prev, item]);
    setNewCheckLabel('');
  };

  const removeCheckItem = async (id: string) => {
    await deleteChecklistItem(id);
    setChecklist(prev => prev.filter(i => i.id !== id));
  };

  const refLinks = (form.videoReferences || '').split('\n').map(s => s.trim()).filter(Boolean);
  const addRefLink = () => {
    const link = refLinkInput.trim();
    if (!link) return;
    setForm({ ...form, videoReferences: [...refLinks, link].join('\n') });
    setRefLinkInput('');
  };
  const removeRefLink = (idx: number) => {
    const next = [...refLinks];
    next.splice(idx, 1);
    setForm({ ...form, videoReferences: next.join('\n') });
  };
  const normalizeLink = (link: string) => link.startsWith('http') ? link : `https://${link}`;

  // Comments
  const handleAddComment = async () => {
    if (!newComment.trim() || !commentAuthor || !task) return;
    const comment: TaskComment = { id: crypto.randomUUID(), taskId: task.id, author: commentAuthor, content: newComment, createdAt: new Date().toISOString() };
    await addComment(comment);
    setComments(prev => [...prev, comment]);
    setNewComment('');
  };

  // Alterações — solicitação de ajuste que move o card para a etapa "Alteração"
  const handleAddAlteration = async () => {
    if (!newAlteration.trim() || !alterationAuthor || !task) return;
    const target = alterationTarget.trim();
    const body = target ? `@${target} — ${newAlteration.trim()}` : newAlteration.trim();
    const comment: TaskComment = {
      id: crypto.randomUUID(),
      taskId: task.id,
      author: alterationAuthor,
      content: `${ALTERATION_PREFIX}${body}`,
      createdAt: new Date().toISOString(),
    };
    await addComment(comment);
    setComments(prev => [...prev, comment]);
    setNewAlteration('');
    try {
      await moveTaskToStage(task.id, ALTERATION_STAGE);
      setForm(f => ({ ...f, status: ALTERATION_STAGE as any, ...(target ? { assignee: target } : {}) }));
      if (target) {
        await supabase.from('tasks').update({ assignee: target } as any).eq('id', task.id);
      }
      toast.warning(`Alteração registrada${target ? ` para ${target}` : ''} — card movido para "Alteração"`);
    } catch {
      toast.error('Alteração salva, mas não consegui mover o card.');
    }
  };

  const handleDeleteAlteration = async (id: string) => {
    try {
      const { error } = await supabase.from('task_comments').delete().eq('id', id);
      if (error) throw error;
      setComments(prev => prev.filter(c => c.id !== id));
      toast.success('Pedido de alteração excluído');
    } catch (e: any) {
      toast.error(`Erro ao excluir: ${e?.message || 'tente novamente'}`);
    }
  };




  // Attachments
  // Nomes de arquivo com acentos, espaços, emojis ou caracteres especiais quebravam
  // o upload (InvalidKey no Storage). Aqui o nome é normalizado para a chave, mas o
  // nome original continua sendo salvo para exibição.
  const safeKey = (name: string) => {
    const dot = name.lastIndexOf('.');
    const base = (dot > 0 ? name.slice(0, dot) : name)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'arquivo';
    const ext = (dot > 0 ? name.slice(dot + 1) : '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
    return ext ? `${base}.${ext}` : base;
  };

  const uploadOne = async (file: File, taskId: string) => {
    if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name}: máximo 50 MB`);
    const path = `${taskId}/${crypto.randomUUID()}-${safeKey(file.name)}`;
    const { error } = await supabase.storage.from('task-attachments').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    });
    if (error) throw new Error(`${file.name}: ${error.message}`);
    const { data: urlData } = supabase.storage.from('task-attachments').getPublicUrl(path);
    const att: TaskAttachment = { id: crypto.randomUUID(), taskId, fileName: file.name, fileUrl: urlData.publicUrl, fileType: file.type, createdAt: new Date().toISOString() };
    await addAttachment(att);
    return att;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const input = e.target;
    if (!files.length || !task) return;
    const ok: TaskAttachment[] = [];
    const fails: string[] = [];
    for (const file of files) {
      try {
        ok.push(await uploadOne(file, task.id));
      } catch (err: any) {
        fails.push(err?.message || `${file.name}: falha no upload`);
      }
    }
    if (ok.length) {
      setAttachments(prev => [...prev, ...ok]);
      toast.success(ok.length === 1 ? 'Arquivo enviado' : `${ok.length} arquivos enviados`);
    }
    if (fails.length) toast.error(fails.join(' • '));
    input.value = '';
  };


  const handleAddLink = async () => {
    if (!linkUrl.trim() || !task) return;
    const att: TaskAttachment = { id: crypto.randomUUID(), taskId: task.id, fileName: linkUrl, fileUrl: linkUrl, fileType: 'link', createdAt: new Date().toISOString() };
    await addAttachment(att);
    setAttachments(prev => [...prev, att]);
    setLinkUrl('');
    setShowLinkInput(false);
  };

  const renderMentions = (text: string) => {
    // Strip every HTML tag/attribute first to prevent stored XSS, then re-apply mention styling.
    const escaped = DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    return escaped.replace(/@(\w+)/g, '<span class="text-primary font-semibold">@$1</span>');
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2 sm:px-6 sm:py-4 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm sm:text-lg font-semibold text-foreground">{isNew ? 'Nova Tarefa' : 'Detalhes da Tarefa'}</h2>
          {isNew && draftSavedAt && (
            <span className="hidden sm:inline text-[10px] rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">
              {draftRestored ? 'Rascunho recuperado' : 'Rascunho salvo'} · {new Date(draftSavedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!isNew && task && (
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Compartilhar" onClick={() => {
              const shareId = task.clientId || task.id;
              const url = `${window.location.origin}/conteudo/${shareId}`;
              navigator.clipboard.writeText(url);
              toast.success('Link copiado!');
            }}>
              <Share2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="grid gap-3 sm:gap-5 p-3 sm:p-6">
          {/* ── Core fields ── */}
          <div className="grid gap-3 sm:gap-4">
            <div>
              <Label className={cn("text-[10px] sm:text-xs uppercase tracking-wider", labelClass(form.videoName || form.title))}>Nome da tarefa / vídeo</Label>
              <Input value={form.videoName || form.title || ''} onChange={e => setForm({ ...form, videoName: e.target.value, title: e.target.value })} placeholder="Ex: Reels de lançamento" className={cn('mt-1', fieldClass(form.videoName || form.title))} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3">
              <div>
                <Label className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Tipo de entrega</Label>
                <Select
                  value={form.taskType === 'Arte' ? 'Arte' : 'Produção de Vídeo'}
                  onValueChange={v => setForm({ ...form, taskType: v as any })}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Produção de Vídeo">📹 Reels / Vídeo</SelectItem>
                    <SelectItem value="Arte">🎨 Arte estática</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.taskType === 'Arte' && (
                <div>
                  <Label className="text-[10px] sm:text-xs font-semibold text-pink-600 dark:text-pink-400 uppercase tracking-wider">
                    Formato da Arte *
                  </Label>
                  <Select value={form.format || ''} onValueChange={v => setForm({ ...form, format: v })}>
                    <SelectTrigger className="mt-1 border-pink-500/40 focus:ring-pink-500">
                      <SelectValue placeholder="Selecione o formato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Stories">📱 Stories</SelectItem>
                      <SelectItem value="Feed">🖼️ Feed</SelectItem>
                      <SelectItem value="Carrossel">🎠 Carrossel</SelectItem>
                      {form.format && !['Stories', 'Feed', 'Carrossel'].includes(form.format) && (
                        <SelectItem value={form.format}>{form.format}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Tarefas marcadas como "Arte estática" aparecem na aba <span className="font-semibold text-foreground">Artes Estáticas</span> em vez do Kanban de Tarefas.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3">
              <div>
                <Label className={cn("text-[10px] sm:text-xs uppercase tracking-wider", labelClass(form.clientId))}>Cliente</Label>
                <Select value={form.clientId || ''} onValueChange={v => setForm({ ...form, clientId: v })}>
                  <SelectTrigger className={cn('mt-1', fieldClass(form.clientId))}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className={cn("text-[10px] sm:text-xs uppercase tracking-wider", labelClass(form.assignee))}>Responsável</Label>
                <Select value={form.assignee || ''} onValueChange={v => setForm({ ...form, assignee: v })}>
                  <SelectTrigger className={cn('mt-1', fieldClass(form.assignee))}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{team.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3">
              <div>
                <Label className={cn("text-[10px] sm:text-xs uppercase tracking-wider", labelClass(form.priority))}>Prioridade</Label>
                <Select value={form.priority || 'Média'} onValueChange={v => setForm({ ...form, priority: v as any })}>
                  <SelectTrigger className={cn('mt-1', fieldClass(form.priority))}><SelectValue /></SelectTrigger>
                  <SelectContent>{priorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className={cn("text-[10px] sm:text-xs uppercase tracking-wider", labelClass(form.dueDate))}>Data de entrega</Label>
                <Input type="date" value={form.dueDate || ''} onChange={e => setForm({ ...form, dueDate: e.target.value })} className={cn('mt-1', fieldClass(form.dueDate))} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3">
              <div>
                <Label className={cn("text-[10px] sm:text-xs uppercase tracking-wider", labelClass(form.postDate))}>Data de postagem</Label>
                <Input type="date" value={form.postDate || ''} onChange={e => setForm({ ...form, postDate: e.target.value })} className={cn('mt-1', fieldClass(form.postDate))} />
              </div>
              <div>
                <Label className={cn("text-[10px] sm:text-xs uppercase tracking-wider", labelClass(form.postTime))}>Hora de postagem</Label>
                <Input type="time" value={form.postTime || ''} onChange={e => setForm({ ...form, postTime: e.target.value })} className={cn('mt-1', fieldClass(form.postTime))} />
              </div>
            </div>
          </div>

          {/* ── Copy da Arte (H1 / H2 / CTA) ── */}
          {form.taskType === 'Arte' && (
            <div>
              <Label className={cn("text-xs", labelClass(form.description))}>Copy da Arte (H1 / H2 / CTA)</Label>
              <Textarea
                value={form.description || ''}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder={'H1 (Headline):\n[escreva aqui a headline principal da arte]\n\nH2 (Texto corpo da arte):\n[escreva aqui o texto de apoio / corpo]\n\nCTA (Chamada para ação):\n[escreva aqui a chamada para ação]'}
                className={cn('mt-1 min-h-[220px] resize-y text-sm leading-relaxed whitespace-pre-wrap', fieldClass(form.description))}
              />
            </div>
          )}

          {/* ── Common content fields: Roteiro + Legenda ── */}
          <div className="space-y-4">
            <div>
              <Label className={cn("text-xs", labelClass(form.fullScript))}>Roteiro</Label>
              <Textarea
                ref={scriptRef}
                value={form.fullScript || ''}
                onChange={e => {
                  setForm({ ...form, fullScript: e.target.value });
                  requestAnimationFrame(adjustScriptHeight);
                }}
                placeholder="Cole o roteiro completo aqui..."
                className={cn(
                  'mt-1 min-h-[260px] max-h-[70vh] resize-y overflow-hidden text-sm leading-relaxed',
                  form.taskType === 'Arte' && 'min-h-[420px]',
                  fieldClass(form.fullScript)
                )}
              />
            </div>
            <div>
              <Label className={cn("text-xs", labelClass(form.caption))}>Legenda</Label>
              <Textarea
                rows={3}
                value={form.caption || ''}
                onChange={e => setForm({ ...form, caption: e.target.value })}
                placeholder="Legenda do post..."
                className={cn('mt-1', fieldClass(form.caption))}
              />
            </div>
          </div>

          {form.taskType !== 'Arte' && (<>
          <Separator />

          {/* ── Video-specific fields ── */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/20 text-xs">📹</span> 
              Produção de Vídeo
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-3">
              <div>
                <Label className={cn("text-[10px] sm:text-xs uppercase tracking-wider", labelClass(form.platform))}>Plataforma</Label>
                <Select value={form.platform || ''} onValueChange={v => setForm({ ...form, platform: v })}>
                  <SelectTrigger className={cn('mt-1', fieldClass(form.platform))}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'Outro'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={cn("text-[10px] sm:text-xs uppercase tracking-wider", labelClass(form.format))}>Formato</Label>
                <Select value={form.format || ''} onValueChange={v => setForm({ ...form, format: v })}>
                  <SelectTrigger className={cn('mt-1', fieldClass(form.format))}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {['Reels', 'Story', 'Shorts', 'Feed', 'Longo', 'Outro'].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={cn("text-[10px] sm:text-xs uppercase tracking-wider", labelClass(form.videoObjective))}>Objetivo</Label>
                <Select value={form.videoObjective || ''} onValueChange={v => setForm({ ...form, videoObjective: v })}>
                  <SelectTrigger className={cn('mt-1', fieldClass(form.videoObjective))}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {['Vendas', 'Engajamento', 'Autoridade', 'Educação', 'Entretenimento'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">✍️ Copywriter</Label>
                <Select value={form.copywriter || ''} onValueChange={v => setForm({ ...form, copywriter: v })}>
                  <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{team.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">🎬 Diretor</Label>
                <Select value={form.director || ''} onValueChange={v => setForm({ ...form, director: v })}>
                  <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{team.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">📹 Videomaker</Label>
                <Select value={form.videomaker || ''} onValueChange={v => setForm({ ...form, videomaker: v })}>
                  <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{team.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">🎞️ Editor</Label>
                <Select value={form.editor || ''} onValueChange={v => setForm({ ...form, editor: v })}>
                  <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{team.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className={cn("text-xs", labelClass(form.videoReferences))}>Referências (links)</Label>
              <Textarea rows={2} value={form.videoReferences || ''} onChange={e => setForm({ ...form, videoReferences: e.target.value })} placeholder="Links de referência..." className={cn('mt-1', fieldClass(form.videoReferences))} />
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <Label className="text-[10px] sm:text-xs text-amber-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <FolderOpen className="h-3 w-3" /> Material bruto (pasta do Drive)
              </Label>
              <p className="text-[10px] text-muted-foreground">
                📹 Filmmaker: cole aqui o link da pasta do Drive com o material bruto gravado para o editor localizar com facilidade.
              </p>
              <div className="flex gap-2">
                <Input
                  value={form.rawFootageUrl || ''}
                  onChange={e => setForm({ ...form, rawFootageUrl: e.target.value })}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    if (!task) { toast.error('Salve a tarefa primeiro'); return; }
                    const url = (form.rawFootageUrl || '').trim();
                    try {
                      const { error } = await supabase.from('tasks').update({ raw_footage_url: url || null } as any).eq('id', task.id);
                      if (error) throw error;
                      toast.success('Link do material bruto salvo!');
                    } catch (err: any) {
                      console.error(err);
                      toast.error('Erro ao salvar link');
                    }
                  }}
                  className="shrink-0"
                >
                  Salvar
                </Button>
              </div>
              {form.rawFootageUrl && (
                <a
                  href={form.rawFootageUrl.startsWith('http') ? form.rawFootageUrl : `https://${form.rawFootageUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 underline underline-offset-2 break-all"
                >
                  <FolderOpen className="h-3 w-3" /> Abrir pasta do material bruto
                </a>
              )}
            </div>

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
              <Label className="text-[10px] sm:text-xs text-primary uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <Upload className="h-3 w-3" /> Vídeo finalizado (auto-hospedado)
              </Label>

              {task ? (
                <VideoUploader
                  taskId={task.id}
                  currentUrl={form.videoUrl}
                  onUploaded={(url) => setForm(prev => ({ ...prev, videoUrl: url }))}
                  onDeleted={() => setForm(prev => ({ ...prev, videoUrl: '' }))}
                />
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Salve a tarefa primeiro para habilitar o upload de vídeo.
                </p>
              )}

              <div className="border-t border-primary/20 pt-3">
                <Label className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1.5">
                  <Link className="h-3 w-3" /> ou colar link externo (Drive / YouTube / Vimeo)
                </Label>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={form.videoUrl || ''}
                    onChange={e => setForm({ ...form, videoUrl: e.target.value })}
                    placeholder="https://..."
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      if (!task) { toast.error('Salve a tarefa primeiro'); return; }
                      const url = (form.videoUrl || '').trim();
                      try {
                        const { error } = await supabase.from('tasks').update({ video_url: url || null }).eq('id', task.id);
                        if (error) throw error;
                        toast.success('Link salvo!');
                      } catch (err: any) {
                        console.error(err);
                        toast.error('Erro ao salvar link');
                      }
                    }}
                    className="shrink-0"
                  >
                    Salvar link
                  </Button>
                </div>
              </div>
            </div>


          </div>
          </>)}

          {/* ── Tabs: Referências / Legenda / Check / Notas / Arq / Hist ── */}

          <Separator />
          <Tabs defaultValue={form.taskType === 'Arte' ? 'references' : 'checklist'} className="w-full">
            <TabsList className="w-full h-auto flex-wrap gap-0.5">
                  {form.taskType === 'Arte' && (
                    <TabsTrigger value="references" className="flex-1 gap-1 text-[10px] sm:text-xs py-1.5"><Link className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Link ref</TabsTrigger>
                  )}
                  {form.taskType === 'Arte' && (
                    <TabsTrigger value="caption" className={cn('flex-1 gap-1 text-[10px] sm:text-xs py-1.5', isInvalidField(form.caption) && 'text-destructive border-destructive')}><FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Legenda</TabsTrigger>
                  )}
                  <TabsTrigger value="checklist" className="flex-1 gap-1 text-[10px] sm:text-xs py-1.5"><CheckSquare className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Check</TabsTrigger>
                  <TabsTrigger value="alterations" className="flex-1 gap-1 text-[10px] sm:text-xs py-1.5 data-[state=active]:text-warning"><AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Alteração ({alterations.length})</TabsTrigger>
                  <TabsTrigger value="comments" className="flex-1 gap-1 text-[10px] sm:text-xs py-1.5"><MessageSquare className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Notas ({plainComments.length})</TabsTrigger>

                  <TabsTrigger value="attachments" className="flex-1 gap-1 text-[10px] sm:text-xs py-1.5"><FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Arq ({attachments.length})</TabsTrigger>
                  <TabsTrigger value="history" className="flex-1 gap-1 text-[10px] sm:text-xs py-1.5"><History className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Hist ({stageHistory.length})</TabsTrigger>
                </TabsList>

                {/* Link de referência (Arte) */}
                {form.taskType === 'Arte' && (
                  <TabsContent value="references" className="space-y-3 mt-3">
                    <div>
                      <Label className="text-xs">Link de referência</Label>
                      <div className="mt-1 flex gap-2">
                        <Input
                          placeholder="Cole aqui o link de referência..."
                          value={refLinkInput}
                          onChange={e => setRefLinkInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRefLink(); } }}
                        />
                        <Button type="button" variant="outline" onClick={addRefLink} disabled={!refLinkInput.trim()}>Adicionar</Button>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">O link fica salvo no card e fica fácil de acessar depois.</p>
                    </div>
                    {refLinks.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Links salvos</p>
                        {refLinks.map((link, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-md bg-secondary/30 px-2 py-1">
                            <a
                              href={normalizeLink(link)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 text-sm text-primary underline underline-offset-2 hover:text-primary/80 break-all"
                            >
                              {link}
                            </a>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 shrink-0 text-destructive/70 hover:text-destructive"
                              onClick={() => removeRefLink(i)}
                              title="Remover link"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum link de referência adicionado.</p>
                    )}
                  </TabsContent>
                )}

                {/* Legenda (Arte) */}
                {form.taskType === 'Arte' && (
                  <TabsContent value="caption" className="space-y-3 mt-3">
                    <div>
                      <Label className={cn("text-xs", labelClass(form.caption))}>Legenda do post</Label>
                      <Textarea
                        rows={8}
                        value={form.caption || ''}
                        onChange={e => setForm({ ...form, caption: e.target.value })}
                        placeholder="Escreva aqui a legenda do post (texto, hashtags, CTA)..."
                        className={cn('mt-1', fieldClass(form.caption))}
                      />
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">{(form.caption || '').length} caracteres</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(form.caption || '');
                            toast.success('Legenda copiada!');
                          }}
                          disabled={!form.caption}
                        >
                          Copiar legenda
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                )}



                {/* Checklist */}
                <TabsContent value="checklist" className="space-y-2 mt-3">
                  {isNew ? (
                    <p className="text-sm text-muted-foreground">Salve o card para adicionar itens de check.</p>
                  ) : (
                    <>
                      {checklist.map(item => (
                        <div key={item.id} className="flex items-center gap-3 rounded-md bg-secondary/30 px-3 py-2">
                          <Checkbox checked={item.checked} onCheckedChange={() => toggleCheck(item)} />
                          <span className={cn('flex-1 text-sm', item.checked && 'line-through text-muted-foreground')}>{item.label}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive/60 hover:text-destructive" onClick={() => removeCheckItem(item.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {checklist.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item no checklist.</p>}
                      <div className="flex gap-2">
                        <Input placeholder="Novo item..." value={newCheckLabel} onChange={e => setNewCheckLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCheckItem()} className="h-8 text-sm" />
                        <Button size="sm" variant="outline" onClick={addCheckItem} disabled={!newCheckLabel.trim()}>Adicionar</Button>
                      </div>
                    </>
                  )}
                </TabsContent>

                {/* Alterações */}
                <TabsContent value="alterations" className="space-y-3 mt-3">
                  <div className="max-h-[220px] space-y-2 overflow-y-auto">
                    {alterations.map(c => (
                      <div key={c.id} className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-warning">{c.author}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(c.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button
                              onClick={() => handleDeleteAlteration(c.id)}
                              title="Excluir pedido de alteração"
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-foreground" dangerouslySetInnerHTML={{ __html: renderMentions(c.content.replace(ALTERATION_PREFIX, '')) }} />
                      </div>
                    ))}
                    {alterations.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma alteração solicitada.</p>}
                  </div>
                  {isNew ? (
                    <p className="text-sm text-muted-foreground">Salve o card para solicitar alterações.</p>
                  ) : (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={alterationAuthor} onChange={e => setAlterationAuthor(e.target.value)}>
                          <option value="">Selecione seu nome</option>
                          {team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                        </select>
                        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={alterationTarget} onChange={e => setAlterationTarget(e.target.value)}>
                          <option value="">Enviar para (responsável pela alteração)</option>
                          {team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                        </select>

                        <Textarea
                          placeholder="Descreva a alteração necessária para o editor..."
                          value={newAlteration}
                          onChange={e => setNewAlteration(e.target.value)}
                          rows={3}
                        />
                        <Button
                          className="w-full gap-2"
                          variant="outline"
                          onClick={handleAddAlteration}
                          disabled={!newAlteration.trim() || !alterationAuthor}
                        >
                          <AlertTriangle className="h-4 w-4 text-warning" /> Solicitar alteração
                        </Button>
                        <p className="text-[11px] text-muted-foreground">
                          Ao solicitar, o card é movido automaticamente para a etapa <strong>Alteração</strong> e o responsável recebe um alerta sonoro diferente.
                        </p>
                      </div>
                    </>
                  )}
                </TabsContent>

                {/* Comments */}
                <TabsContent value="comments" className="space-y-3 mt-3">
                  <div className="max-h-[200px] space-y-2 overflow-y-auto">
                    {plainComments.map(c => (
                      <div key={c.id} className="rounded-md bg-secondary/30 px-3 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-primary">{c.author}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(c.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground" dangerouslySetInnerHTML={{ __html: renderMentions(c.content) }} />
                      </div>
                    ))}
                    {plainComments.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comentário.</p>}
                  </div>

                  {isNew ? (
                    <p className="text-sm text-muted-foreground">Salve o card para adicionar notas.</p>
                  ) : (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={commentAuthor} onChange={e => setCommentAuthor(e.target.value)}>
                          <option value="">Selecione seu nome</option>
                          {team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                        </select>
                        <div className="flex gap-2">
                          <Input placeholder="Escreva um comentário... Use @nome" value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddComment()} />
                          <Button size="icon" onClick={handleAddComment} disabled={!newComment.trim() || !commentAuthor}><Send className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </>
                  )}
                </TabsContent>

                {/* Attachments */}
                <TabsContent value="attachments" className="space-y-3 mt-3">
                  <div className="space-y-2">
                    {attachments.map(a => {
                      const m = (a.fileUrl || '').match(/\/task-attachments\/(.+?)(\?|$)/);
                      const storagePath = m ? decodeURIComponent(m[1]) : null;
                      const isLink = a.fileType === 'link' || !storagePath;
                      const handleDownload = async (e: React.MouseEvent) => {
                        e.preventDefault();
                        if (!storagePath) { window.open(a.fileUrl, '_blank'); return; }
                        try {
                          const { data, error } = await supabase.storage.from('task-attachments').download(storagePath);
                          if (error || !data) throw error || new Error('Falha');
                          const blobUrl = URL.createObjectURL(data);
                          const link = document.createElement('a');
                          link.href = blobUrl;
                          link.download = a.fileName;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(blobUrl);
                        } catch (err: any) {
                          toast.error(err?.message || 'Erro ao baixar');
                        }
                      };
                      return (
                        <div key={a.id} className="flex items-center justify-between rounded-md bg-secondary/30 px-3 py-2">
                          {isLink ? (
                            <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline truncate flex-1">
                              <Link className="h-4 w-4 shrink-0" />
                              <span className="truncate">{a.fileName}</span>
                            </a>
                          ) : (
                            <button type="button" onClick={handleDownload} className="flex items-center gap-2 text-sm text-primary hover:underline truncate flex-1 text-left">
                              <Download className="h-4 w-4 shrink-0" />
                              <span className="truncate">{a.fileName}</span>
                            </button>
                          )}
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => { deleteAttachment(a.id); setAttachments(prev => prev.filter(x => x.id !== a.id)); }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })}
                    {attachments.length === 0 && <p className="text-sm text-muted-foreground">Nenhum anexo.</p>}
                  </div>
                  {isNew ? (
                    <p className="text-sm text-muted-foreground">Salve o card para anexar arquivos ou links.</p>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <label className="flex-1">
                          <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                          <Button variant="outline" className="w-full gap-2" asChild><span><Upload className="h-4 w-4" /> Upload</span></Button>
                        </label>
                        <Button variant="outline" className="gap-2" onClick={() => setShowLinkInput(!showLinkInput)}><Link className="h-4 w-4" /> Link</Button>
                      </div>
                      {showLinkInput && (
                        <div className="flex gap-2">
                          <Input placeholder="Cole o link aqui..." value={linkUrl} onChange={e => setLinkUrl(e.target.value)} />
                          <Button onClick={handleAddLink}>Adicionar</Button>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* History */}
                <TabsContent value="history" className="space-y-2 mt-3">
                  {isNew ? (
                    <p className="text-sm text-muted-foreground">O histórico de movimentações aparece após salvar o card.</p>
                  ) : stageHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada ainda.</p>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {[...stageHistory].reverse().map(h => (
                        <div key={h.id} className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-muted-foreground truncate">{h.fromStage || '—'}</span>
                            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="font-medium text-foreground truncate">{h.toStage}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                            <span>por <span className="font-medium text-foreground">{h.changedBy || 'Desconhecido'}</span></span>
                            <span className="tabular-nums">{new Date(h.createdAt).toLocaleString('pt-BR')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 border-t border-border px-3 py-2 sm:px-6 sm:py-4 shrink-0">
        <Button onClick={handleSave} className="flex-1 h-9 sm:h-10 text-sm" disabled={saving}>
          {saving ? 'Salvando...' : isNew ? 'Criar' : 'Salvar'}
        </Button>
        {isNew && draftSavedAt && (
          <Button variant="outline" size="sm" className="h-9 text-muted-foreground" onClick={discardDraft}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Descartar rascunho
          </Button>
        )}
        {!isNew && task && (
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive h-9" onClick={() => onDelete(task.id)}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
          </Button>
        )}

      </div>
    </div>
  );
}
