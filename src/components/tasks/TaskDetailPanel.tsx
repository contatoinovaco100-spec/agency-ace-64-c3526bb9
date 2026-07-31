import { useState, useEffect } from 'react';
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
import { Paperclip, Send, Trash2, Link, Upload, MessageSquare, CheckSquare, FileText, X, Share2, Download, History, ArrowRight, FolderOpen } from 'lucide-react';
import VideoUploader from './VideoUploader';

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
  onSave: (task: Task) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

const priorities = ['Alta', 'Média', 'Baixa'] as const;

export default function TaskDetailPanel({ task, isNew, clients, team, defaultClientId, defaultTaskType, onSave, onDelete, onClose }: Props) {
  const { getChecklist, upsertChecklistItem, deleteChecklistItem, getComments, addComment, getAttachments, addAttachment, deleteAttachment, getStageHistory } = useAgency();

  const [form, setForm] = useState<Partial<Task>>({});
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [stageHistory, setStageHistory] = useState<TaskStageHistory[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [newCheckLabel, setNewCheckLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setForm({ ...task });
      loadData(task.id);
    } else {
      setForm({
        taskType: defaultTaskType || 'Produção de Vídeo',
        status: 'Ideias / Backlog' as any,
        priority: 'Média',
        clientId: defaultClientId || '',
        videoName: '', title: '', description: '', assignee: '',
        videoIdea: '', fullScript: '', videoReferences: '', observations: '',
        creativeDirection: '', editingStyle: '', strategicNotes: '',
        recordingNotes: '', editorComments: '',
        copywriter: '', director: '', videomaker: '', editor: '',
        platform: '', format: '', videoObjective: '', currentStageOwner: '',
      });
      setChecklist([]);
      setComments([]);
      setAttachments([]);
    }
  }, [task, defaultClientId, defaultTaskType]);

  const loadData = async (id: string) => {
    const [ch, co, at, hi] = await Promise.all([getChecklist(id), getComments(id), getAttachments(id), getStageHistory(id)]);
    setChecklist(ch);
    setComments(co);
    setAttachments(at);
    setStageHistory(hi);
  };

  const handleSave = async () => {
    const name = form.videoName || form.title;
    if (!name) { toast.error('Informe o nome da tarefa'); return; }
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
        status: task?.status || ('Ideias / Backlog' as any),
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
      };
      await onSave(data);
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

  // Comments
  const handleAddComment = async () => {
    if (!newComment.trim() || !commentAuthor || !task) return;
    const comment: TaskComment = { id: crypto.randomUUID(), taskId: task.id, author: commentAuthor, content: newComment, createdAt: new Date().toISOString() };
    await addComment(comment);
    setComments(prev => [...prev, comment]);
    setNewComment('');
  };

  // Attachments
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !task) return;
    const path = `${task.id}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from('task-attachments').upload(path, file);
    if (error) { toast.error('Erro no upload'); return; }
    const { data: urlData } = supabase.storage.from('task-attachments').getPublicUrl(path);
    const att: TaskAttachment = { id: crypto.randomUUID(), taskId: task.id, fileName: file.name, fileUrl: urlData.publicUrl, fileType: file.type, createdAt: new Date().toISOString() };
    await addAttachment(att);
    setAttachments(prev => [...prev, att]);
    toast.success('Arquivo enviado');
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
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6 sm:py-4 shrink-0">
        <h2 className="text-base sm:text-lg font-semibold text-foreground">{isNew ? 'Nova Tarefa' : 'Detalhes da Tarefa'}</h2>
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
        <div className="grid gap-5 p-4 sm:p-6">
          {/* ── Core fields ── */}
          <div className="grid gap-4">
            <div>
              <Label className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Nome da tarefa / vídeo</Label>
              <Input value={form.videoName || form.title || ''} onChange={e => setForm({ ...form, videoName: e.target.value, title: e.target.value })} placeholder="Ex: Reels de lançamento" className="mt-1" />
            </div>
            <div>
              <Label className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Descrição</Label>
              <Textarea rows={2} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descreva a tarefa..." className="mt-1" />
            </div>
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
              <p className="mt-1 text-[10px] text-muted-foreground">
                Tarefas marcadas como "Arte estática" aparecem na aba <span className="font-semibold text-foreground">Artes Estáticas</span> em vez do Kanban de Tarefas.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
              <div>
                <Label className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Cliente</Label>
                <Select value={form.clientId || ''} onValueChange={v => setForm({ ...form, clientId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Responsável</Label>
                <Select value={form.assignee || ''} onValueChange={v => setForm({ ...form, assignee: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{team.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
              <div>
                <Label className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Prioridade</Label>
                <Select value={form.priority || 'Média'} onValueChange={v => setForm({ ...form, priority: v as any })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{priorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Data de entrega</Label>
                <Input type="date" value={form.dueDate || ''} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
              <div>
                <Label className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Data de postagem (cliente)</Label>
                <Input type="date" value={form.postDate || ''} onChange={e => setForm({ ...form, postDate: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Hora de postagem</Label>
                <Input type="time" value={form.postTime || ''} onChange={e => setForm({ ...form, postTime: e.target.value })} className="mt-1" />
              </div>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-3">
              <div>
                <Label className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Plataforma</Label>
                <Select value={form.platform || ''} onValueChange={v => setForm({ ...form, platform: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'Outro'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Formato</Label>
                <Select value={form.format || ''} onValueChange={v => setForm({ ...form, format: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {['Reels', 'Story', 'Shorts', 'Feed', 'Longo', 'Outro'].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Objetivo</Label>
                <Select value={form.videoObjective || ''} onValueChange={v => setForm({ ...form, videoObjective: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {['Vendas', 'Engajamento', 'Autoridade', 'Educação', 'Entretenimento'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-2">
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
              <Label className="text-xs text-muted-foreground">Ideia do vídeo</Label>
              <Textarea rows={2} value={form.videoIdea || ''} onChange={e => setForm({ ...form, videoIdea: e.target.value })} placeholder="Descreva a ideia..." className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Roteiro</Label>
              <Textarea rows={3} value={form.fullScript || ''} onChange={e => setForm({ ...form, fullScript: e.target.value })} placeholder="Cole o roteiro aqui..." className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Referências (links)</Label>
              <Textarea rows={2} value={form.videoReferences || ''} onChange={e => setForm({ ...form, videoReferences: e.target.value })} placeholder="Links de referência..." className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea rows={2} value={form.observations || ''} onChange={e => setForm({ ...form, observations: e.target.value })} placeholder="Notas adicionais..." className="mt-1" />
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



          {/* ── Tabs: Checklist / Comments / Attachments / References ── */}
          {!isNew && (
            <>
              <Separator />
              <Tabs defaultValue={form.taskType === 'Arte' ? 'references' : 'checklist'} className="w-full">
                <TabsList className="w-full">
                  {form.taskType === 'Arte' && (
                    <TabsTrigger value="references" className="flex-1 gap-1"><Link className="h-3.5 w-3.5" /> Referências</TabsTrigger>
                  )}
                  {form.taskType === 'Arte' && (
                    <TabsTrigger value="caption" className="flex-1 gap-1"><FileText className="h-3.5 w-3.5" /> Legenda</TabsTrigger>
                  )}
                  <TabsTrigger value="checklist" className="flex-1 gap-1"><CheckSquare className="h-3.5 w-3.5" /> Checklist</TabsTrigger>
                  <TabsTrigger value="comments" className="flex-1 gap-1"><MessageSquare className="h-3.5 w-3.5" /> Comentários ({comments.length})</TabsTrigger>
                  <TabsTrigger value="attachments" className="flex-1 gap-1"><FileText className="h-3.5 w-3.5" /> Anexos ({attachments.length})</TabsTrigger>
                  <TabsTrigger value="history" className="flex-1 gap-1"><History className="h-3.5 w-3.5" /> Histórico ({stageHistory.length})</TabsTrigger>
                </TabsList>

                {/* Referências (Arte) */}
                {form.taskType === 'Arte' && (
                  <TabsContent value="references" className="space-y-3 mt-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Referências (links, inspirações, briefings)</Label>
                      <Textarea rows={4} value={form.videoReferences || ''} onChange={e => setForm({ ...form, videoReferences: e.target.value })} placeholder="Cole links de referência ou inspiração para a arte..." className="mt-1" />
                    </div>
                    {form.videoReferences && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Links</p>
                        {form.videoReferences.split('\n').filter(Boolean).map((line, i) => (
                          <a
                            key={i}
                            href={line.trim().startsWith('http') ? line.trim() : `https://${line.trim()}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-sm text-primary underline underline-offset-2 hover:text-primary/80 break-all"
                          >
                            {line.trim()}
                          </a>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                )}

                {/* Legenda (Arte) */}
                {form.taskType === 'Arte' && (
                  <TabsContent value="caption" className="space-y-3 mt-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Legenda do post</Label>
                      <Textarea
                        rows={8}
                        value={form.caption || ''}
                        onChange={e => setForm({ ...form, caption: e.target.value })}
                        placeholder="Escreva aqui a legenda do post (texto, hashtags, CTA)..."
                        className="mt-1"
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
                </TabsContent>

                {/* Comments */}
                <TabsContent value="comments" className="space-y-3 mt-3">
                  <div className="max-h-[200px] space-y-2 overflow-y-auto">
                    {comments.map(c => (
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
                    {comments.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comentário.</p>}
                  </div>
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
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <input type="file" className="hidden" onChange={handleFileUpload} />
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
                </TabsContent>

                {/* History */}
                <TabsContent value="history" className="space-y-2 mt-3">
                  {stageHistory.length === 0 ? (
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
            </>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 border-t border-border px-6 py-4 shrink-0">
        <Button onClick={handleSave} className="flex-1" disabled={saving}>
          {saving ? 'Salvando...' : isNew ? 'Criar Tarefa' : 'Salvar'}
        </Button>
        {!isNew && task && (
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => onDelete(task.id)}>
            <Trash2 className="mr-1 h-4 w-4" /> Excluir
          </Button>
        )}
      </div>
    </div>
  );
}
