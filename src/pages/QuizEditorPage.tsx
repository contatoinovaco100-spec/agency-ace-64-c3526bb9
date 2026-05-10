import { useEffect, useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, ArrowLeft, Save, Eye, Copy, Pause, Play, Trash2, GripVertical, Plus, X,
  ListChecks, CircleDot, Type, Mail, Image as ImageIcon, Layers, Palette, Settings2,
  Timer, Users, MessageSquare, MessageCircle, DollarSign, Building2, ArrowLeftRight, Table2, Zap,
  Gauge, TrendingUp, Bell, LogOut, Sparkles, Calculator, Thermometer, LayoutTemplate, Send, Wand2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DndContext, closestCenter, useSensor, useSensors, PointerSensor,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useQuizEditorStore, type QuestionType, type QuizQuestionDraft, buildDefaultMeta,
} from "@/stores/quizEditorStore";
import { QuizThemeEditor } from "@/components/quiz/QuizThemeEditor";
import { QuizMediaUploader } from "@/components/quiz/QuizMediaUploader";
import { VisualSectionEditor } from "@/components/quiz/VisualSectionEditor";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BLOCK_LIBRARY: { type: QuestionType; label: string; icon: any; desc: string }[] = [
  { type: "single",   label: "Escolha única",        icon: CircleDot,  desc: "Uma resposta entre opções" },
  { type: "multiple", label: "Múltipla escolha",     icon: ListChecks, desc: "Várias respostas" },
  { type: "text",     label: "Pergunta aberta",      icon: Type,       desc: "Campo de texto livre" },
  { type: "lead",     label: "Captura de lead",      icon: Mail,       desc: "Nome, e-mail, telefone" },
  { type: "visual",   label: "Seção / banner",       icon: ImageIcon,  desc: "Título e imagem" },
];

export default function QuizEditorPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const {
    meta, questions, selectedId, dirty,
    setQuiz, updateMeta, addQuestion, addQuestionsBatch, reorderQuestions, select,
  } = useQuizEditorStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientSlug, setClientSlug] = useState("");

  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) return toast({ title: "Digite um prompt", variant: "destructive" });
    setAiGenerating(true);
    try {
      const systemPrompt = `Você é um especialista em marketing e criação de funis. O usuário enviará um tema ou link, e você deve gerar as perguntas para um quiz de diagnóstico. 
Responda EXATAMENTE com um JSON válido, num formato de array de objetos.
Formato esperado:
[
  { "type": "single", "title": "Qual a sua maior dificuldade hoje?", "options": ["Falta de leads", "Vendas baixas", "Custo alto"] },
  { "type": "lead", "title": "Onde enviamos seu resultado?" }
]
Use "single" para escolha única, "multiple" para múltipla, "text" para texto aberto, "lead" para captura, "visual" para seção informacional. Para "visual", use "description" invés de options.`;
      
      const { data: fnData, error: fnError } = await supabase.functions.invoke('ai-copywriter', {
        body: {
          systemPrompt,
          userMessage: aiPrompt,
          model: 'google/gemini-2.5-flash',
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (fnData?.error) throw new Error(fnData.error);

      let result = fnData?.result;
      if (typeof result === 'string') {
        const cleanContent = result.replace(/```json/g, '').replace(/```/g, '').trim();
        result = JSON.parse(cleanContent);
      }

      if (Array.isArray(result)) {
        addQuestionsBatch(result);
      }
      
      toast({ title: "Quiz gerado com sucesso!" });
      setAiDialogOpen(false);
      setAiPrompt("");
    } catch (e: any) {
      toast({ title: "Erro na IA", description: e.message, variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  };

  useEffect(() => { if (isAdmin && quizId) load(); }, [isAdmin, quizId]);

  const load = async () => {
    if (!quizId) return;
    setLoading(true);
    const { data: q } = await supabase.from("quizzes").select("*, quiz_clients(slug)").eq("id", quizId).maybeSingle();
    if (!q) { toast({ title: "Quiz não encontrado", variant: "destructive" }); setLoading(false); return; }
    setClientSlug((q as any).quiz_clients?.slug ?? "");
    const { data: questionsData } = await supabase
      .from("quiz_questions").select("*").eq("quiz_id", quizId).order("order_index");
    const ids = (questionsData ?? []).map(qq => qq.id);
    const { data: optionsData } = ids.length
      ? await supabase.from("quiz_options").select("*").in("question_id", ids).order("order_index")
      : { data: [] };
    const optsByQ = new Map<string, any[]>();
    (optionsData ?? []).forEach(o => {
      if (!optsByQ.has(o.question_id)) optsByQ.set(o.question_id, []);
      optsByQ.get(o.question_id)!.push(o);
    });
    setQuiz(
      buildDefaultMeta({
        id: q.id, client_id: q.client_id, name: q.name, slug: q.slug,
        description: q.description, status: q.status as any,
        result_title: q.result_title, result_text: q.result_text,
        result_cta_label: q.result_cta_label, result_cta_url: q.result_cta_url,
        result_image_url: (q as any).result_image_url ?? "",
        redirect_url: (q as any).redirect_url ?? "",
        redirect_delay_seconds: (q as any).redirect_delay_seconds ?? 0,
        score_enabled: (q as any).score_enabled ?? false,
        score_ranges: ((q as any).score_ranges as any) ?? [],
        pixel_meta: (q as any).pixel_meta ?? "",
        pixel_ga: (q as any).pixel_ga ?? "",
        webhook_url: (q as any).webhook_url ?? "",
        progress_bar: (q as any).progress_bar ?? true,
        show_question_numbers: (q as any).show_question_numbers ?? true,
        button_label: (q as any).button_label ?? "Continuar",
        button_final_label: (q as any).button_final_label ?? "Ver meu resultado",
        theme: (q as any).theme,
      }),
      (questionsData ?? []).map(qq => ({
        id: qq.id, type: qq.type as QuestionType, title: qq.title,
        description: qq.description, required: qq.required,
        order_index: qq.order_index, config: (qq.config as any) ?? {},
        image_url: (qq as any).image_url ?? "",
        options: (optsByQ.get(qq.id) ?? []).map(o => ({
          id: o.id, text: o.text, order_index: o.order_index,
          points: (o as any).points ?? 0, image_url: (o as any).image_url ?? "",
        })),
      })),
    );
    setLoading(false);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const visible = questions.filter(q => !q._deleted);
    const oldIdx = visible.findIndex(q => q.id === active.id);
    const newIdx = visible.findIndex(q => q.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(visible, oldIdx, newIdx);
    reorderQuestions(reordered.map(q => q.id));
  };

  const save = async () => {
    if (!meta) return;
    setSaving(true);
    try {
      await supabase.from("quizzes").update({
        name: meta.name, description: meta.description,
        result_title: meta.result_title, result_text: meta.result_text,
        result_cta_label: meta.result_cta_label, result_cta_url: meta.result_cta_url,
        result_image_url: meta.result_image_url,
        redirect_url: meta.redirect_url,
        redirect_delay_seconds: meta.redirect_delay_seconds,
        score_enabled: meta.score_enabled,
        score_ranges: meta.score_ranges as any,
        pixel_meta: meta.pixel_meta,
        pixel_ga: meta.pixel_ga,
        webhook_url: meta.webhook_url,
        progress_bar: meta.progress_bar,
        show_question_numbers: meta.show_question_numbers,
        button_label: meta.button_label,
        button_final_label: meta.button_final_label,
        theme: meta.theme as any,
      } as any).eq("id", meta.id);

      // Delete questions marked deleted (cascade options)
      const toDelete = questions.filter(q => q._deleted && !q._new).map(q => q.id);
      if (toDelete.length) await supabase.from("quiz_questions").delete().in("id", toDelete);

      const idMap = new Map<string, string>();
      const live = questions.filter(q => !q._deleted);
      for (const q of live) {
        if (q._new) {
          const { data: created, error } = await supabase.from("quiz_questions").insert({
            quiz_id: meta.id, type: q.type, title: q.title, description: q.description,
            required: q.required, order_index: q.order_index, config: q.config,
            image_url: q.image_url ?? "",
          } as any).select("id").single();
          if (error || !created) throw error;
          idMap.set(q.id, created.id);
          const newOpts = q.options.filter(o => !o._deleted);
          if (newOpts.length) {
            await supabase.from("quiz_options").insert(newOpts.map(o => ({
              question_id: created.id, text: o.text, order_index: o.order_index,
              points: o.points ?? 0, image_url: o.image_url ?? "",
            })) as any);
          }
        } else if (q._dirty) {
          await supabase.from("quiz_questions").update({
            type: q.type, title: q.title, description: q.description,
            required: q.required, order_index: q.order_index, config: q.config,
            image_url: q.image_url ?? "",
          } as any).eq("id", q.id);
          const optsToDelete = q.options.filter(o => o._deleted && !o._new).map(o => o.id);
          if (optsToDelete.length) await supabase.from("quiz_options").delete().in("id", optsToDelete);
          const optsToInsert = q.options.filter(o => o._new && !o._deleted);
          if (optsToInsert.length) {
            await supabase.from("quiz_options").insert(optsToInsert.map(o => ({
              question_id: q.id, text: o.text, order_index: o.order_index,
              points: o.points ?? 0, image_url: o.image_url ?? "",
            })) as any);
          }
          for (const o of q.options.filter(o => !o._new && !o._deleted)) {
            await supabase.from("quiz_options").update({
              text: o.text, order_index: o.order_index,
              points: o.points ?? 0, image_url: o.image_url ?? "",
            } as any).eq("id", o.id);
          }
        }
      }
      toast({ title: "Quiz salvo" });
      await load();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    if (!meta) return;
    const next = meta.status === "active" ? "paused" : "active";
    await supabase.from("quizzes").update({ status: next }).eq("id", meta.id);
    updateMeta({ status: next as any });
    toast({ title: next === "active" ? "Quiz publicado" : "Quiz pausado" });
  };

  const copyPublicLink = () => {
    if (!meta || !clientSlug) return;
    const url = `${window.location.origin}/quiz/${clientSlug}/${meta.slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado", description: url });
  };

  if (roleLoading || loading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!isAdmin) return <Navigate to="/" replace />;
  if (!meta) return null;

  const visible = questions.filter(q => !q._deleted);
  const selected = visible.find(q => q.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/quiz-builder/c/${meta.client_id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <Input
              value={meta.name}
              onChange={e => updateMeta({ name: e.target.value })}
              className="text-lg font-bold border-none p-0 h-auto bg-transparent focus-visible:ring-0"
            />
            <p className="text-xs font-mono text-muted-foreground truncate">/quiz/{clientSlug}/{meta.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={meta.status === "active" ? "default" : "secondary"}>
            {meta.status === "active" ? "Ativo" : meta.status === "paused" ? "Pausado" : "Rascunho"}
          </Badge>
          {dirty && <Badge variant="outline">Não salvo</Badge>}
          <Button size="sm" variant="outline" onClick={copyPublicLink}><Copy className="h-3.5 w-3.5 mr-1" />Link</Button>
          <Button size="sm" variant="outline" onClick={togglePublish}>
            {meta.status === "active" ? <><Pause className="h-3.5 w-3.5 mr-1" />Pausar</> : <><Play className="h-3.5 w-3.5 mr-1" />Publicar</>}
          </Button>
          <Button size="sm" onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Salvar
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr_320px] gap-4">
        {/* Library */}
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Blocos</div>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-amber-500 hover:text-amber-600 hover:bg-amber-500/10" onClick={() => setAiDialogOpen(true)}>
                <Wand2 className="h-3.5 w-3.5 mr-1" /> IA
              </Button>
            </div>
            {BLOCK_LIBRARY.map(b => {
              const Icon = b.icon;
              return (
                <button
                  key={b.type}
                  onClick={() => addQuestion(b.type)}
                  className="w-full text-left p-2 rounded-md border border-border hover:border-primary hover:bg-primary/5 transition flex items-start gap-2"
                >
                  <Icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium">{b.label}</div>
                    <div className="text-[10px] text-muted-foreground line-clamp-2">{b.desc}</div>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Canvas */}
        <Card>
          <CardContent className="p-4 min-h-[400px]">
            <Tabs defaultValue="content">
              <TabsList className="mb-4">
                <TabsTrigger value="content"><Layers className="h-3.5 w-3.5 mr-1" />Conteúdo</TabsTrigger>
                <TabsTrigger value="theme"><Palette className="h-3.5 w-3.5 mr-1" />Tema</TabsTrigger>
                <TabsTrigger value="advanced"><Settings2 className="h-3.5 w-3.5 mr-1" />Avançado</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-3">
                {visible.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <Layers className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    Adicione blocos na lateral esquerda.
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={visible.map(q => q.id)} strategy={verticalListSortingStrategy}>
                      {visible.map((q, i) => (
                        <SortableQuestionCard
                          key={q.id} q={q} index={i}
                          selected={selectedId === q.id}
                          onSelect={() => select(q.id)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}

                <div className="mt-6 pt-4 border-t border-border">
                  <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Tela final (resultado)</div>
                  <div className="space-y-2">
                    <Input
                      value={meta.result_title}
                      placeholder="Título do resultado"
                      onChange={e => updateMeta({ result_title: e.target.value })}
                    />
                    <Textarea
                      rows={2} value={meta.result_text}
                      placeholder="Mensagem para o respondente"
                      onChange={e => updateMeta({ result_text: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={meta.result_cta_label}
                        placeholder="Texto do botão (opcional)"
                        onChange={e => updateMeta({ result_cta_label: e.target.value })}
                      />
                      <Input
                        value={meta.result_cta_url}
                        placeholder="URL do botão"
                        onChange={e => updateMeta({ result_cta_url: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="theme">
                <QuizThemeEditor />
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4">
                <div>
                  <Label className="text-xs">Webhook URL (POST após completar)</Label>
                  <Input value={meta.webhook_url} onChange={e => updateMeta({ webhook_url: e.target.value })} placeholder="https://..." />
                </div>
                <div>
                  <Label className="text-xs">Pixel Meta (ID)</Label>
                  <Input value={meta.pixel_meta} onChange={e => updateMeta({ pixel_meta: e.target.value })} placeholder="1234567890" />
                </div>
                <div>
                  <Label className="text-xs">Google Analytics (Measurement ID)</Label>
                  <Input value={meta.pixel_ga} onChange={e => updateMeta({ pixel_ga: e.target.value })} placeholder="G-XXXXXXXXXX" />
                </div>
                <p className="text-[11px] text-muted-foreground">As integrações (webhook, pixel, GA) são acionadas na página pública após o respondente concluir o quiz.</p>

                <div className="border-t border-border pt-4 mt-4">
                  <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Texto dos botões</div>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Botão de avançar</Label>
                      <Input value={meta.button_label} onChange={e => updateMeta({ button_label: e.target.value })} placeholder="Continuar" />
                    </div>
                    <div>
                      <Label className="text-xs">Botão da última pergunta</Label>
                      <Input value={meta.button_final_label} onChange={e => updateMeta({ button_final_label: e.target.value })} placeholder="Ver meu resultado" />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardContent className="p-4">
            {selected ? <BlockSettings question={selected} /> : (
              <div className="text-sm text-muted-foreground text-center py-12">
                Selecione um bloco para editar.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <Sparkles className="h-5 w-5" />
              Gerador de Quiz com Inteligência Artificial
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Do que se trata o seu Quiz?</Label>
              <Textarea
                rows={4}
                placeholder="Ex: Crie um quiz sobre maturidade financeira para dentistas, com 4 perguntas e um formulário de captação no final..."
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Dica: Você também pode colar o texto inteiro das perguntas do quiz de um concorrente aqui, e nós transformaremos em blocos.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiDialogOpen(false)} disabled={aiGenerating}>Cancelar</Button>
            <Button onClick={handleGenerateAI} disabled={!aiPrompt.trim() || aiGenerating} className="bg-amber-500 hover:bg-amber-600 text-white">
              {aiGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
              Gerar Blocos Automáticos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableQuestionCard({
  q, index, selected, onSelect,
}: { q: QuizQuestionDraft; index: number; selected: boolean; onSelect: () => void }) {
  const { removeQuestion, duplicateQuestion } = useQuizEditorStore();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const Icon = BLOCK_LIBRARY.find(b => b.type === q.type)?.icon ?? Type;
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`border rounded-lg p-3 cursor-pointer transition ${
        selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
      }`}
    >
      <div className="flex items-center gap-2">
        <button {...attributes} {...listeners} className="text-muted-foreground hover:text-foreground touch-none cursor-grab" onClick={e => e.stopPropagation()}>
          <GripVertical className="h-4 w-4" />
        </button>
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-xs text-muted-foreground">#{index + 1}</span>
        <span className="font-medium text-sm flex-1 truncate">{q.title || "(sem título)"}</span>
        {q.required && <Badge variant="outline" className="text-[10px]">obrigatório</Badge>}
        <button
          onClick={e => { e.stopPropagation(); duplicateQuestion(q.id); }}
          className="text-muted-foreground hover:text-foreground"
          title="Duplicar"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); removeQuestion(q.id); }}
          className="text-muted-foreground hover:text-destructive"
          title="Excluir"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {q.options.filter(o => !o._deleted).length > 0 && (
        <div className="mt-2 ml-9 space-y-1">
          {q.options.filter(o => !o._deleted).slice(0, 4).map(o => (
            <div key={o.id} className="text-xs text-muted-foreground">• {o.text || "(opção)"}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function BlockSettings({ question }: { question: QuizQuestionDraft }) {
  const { meta, updateQuestion, addOption, updateOption, removeOption } = useQuizEditorStore();
  const liveOpts = question.options.filter(o => !o._deleted);
  const cid = meta?.client_id ?? "shared";
  const scoreEnabled = !!meta?.score_enabled;

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Configurar bloco</div>
      <div>
        <Label>Título</Label>
        <Input value={question.title} onChange={e => updateQuestion(question.id, { title: e.target.value })} />
      </div>
      <div>
        <Label>Descrição (opcional)</Label>
        <Textarea rows={2} value={question.description} onChange={e => updateQuestion(question.id, { description: e.target.value })} />
      </div>

      {question.type !== "visual" && (
        <QuizMediaUploader
          label="Imagem do bloco (acima do título)"
          value={question.image_url ?? ""}
          onChange={v => updateQuestion(question.id, { image_url: v })}
          clientId={cid}
        />
      )}

      {question.type !== "visual" && (
        <div className="flex items-center justify-between">
          <Label>Resposta obrigatória</Label>
          <Switch checked={question.required} onCheckedChange={v => updateQuestion(question.id, { required: v })} />
        </div>
      )}

      {(question.type === "single" || question.type === "multiple") && (
        <div>
          <Label>Opções</Label>
          <div className="space-y-3 mt-1">
            {liveOpts.map(o => (
              <div key={o.id} className="border border-border rounded-md p-2 space-y-2">
                <div className="flex gap-1">
                  <Input value={o.text} onChange={e => updateOption(question.id, o.id, { text: e.target.value })} placeholder="Texto" />
                  <Button size="icon" variant="ghost" onClick={() => removeOption(question.id, o.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {scoreEnabled && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Pontos</Label>
                    <Input type="number" value={o.points ?? 0} className="h-7 w-20"
                      onChange={e => updateOption(question.id, o.id, { points: Number(e.target.value) || 0 })} />
                  </div>
                )}
                <QuizMediaUploader
                  label="Imagem (card visual — opcional)"
                  value={o.image_url ?? ""}
                  onChange={v => updateOption(question.id, o.id, { image_url: v })}
                  clientId={cid}
                />
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => addOption(question.id)}>
              <Plus className="h-3.5 w-3.5 mr-1" />Adicionar opção
            </Button>
          </div>
        </div>
      )}

      {question.type === "lead" && (
        <div className="space-y-3">
          <Label>Campos exibidos</Label>
          {(["name", "email", "phone"] as const).map(k => {
            const fields = (question.config?.fields ?? {}) as Record<string, boolean>;
            const labels = (question.config?.labels ?? {}) as Record<string, string>;
            const defaultLabels: Record<string, string> = { name: "Seu nome", email: "Seu e-mail", phone: "Seu telefone" };
            return (
              <div key={k} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm capitalize">{k === "name" ? "Nome" : k === "email" ? "E-mail" : "Telefone"}</span>
                  <Switch
                    checked={!!fields[k]}
                    onCheckedChange={v =>
                      updateQuestion(question.id, {
                        config: { ...question.config, fields: { ...fields, [k]: v } },
                      })
                    }
                  />
                </div>
                {fields[k] && (
                  <Input
                    value={labels[k] ?? defaultLabels[k]}
                    placeholder={defaultLabels[k]}
                    className="h-8 text-xs"
                    onChange={e =>
                      updateQuestion(question.id, {
                        config: { ...question.config, labels: { ...labels, [k]: e.target.value } },
                      })
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {question.type === "visual" && (
        <>
          <QuizMediaUploader
            label="Imagem do banner (topo — opcional)"
            value={question.config?.image_url ?? ""}
            onChange={v => updateQuestion(question.id, { config: { ...question.config, image_url: v } })}
            clientId={cid}
          />
          <VisualSectionEditor question={question} />
        </>
      )}


      <div>
        <Label className="text-xs">Alinhamento do título / descrição</Label>
        <Select
          value={question.config?.text_align ?? "center"}
          onValueChange={v => updateQuestion(question.id, { config: { ...question.config, text_align: v } })}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Esquerda</SelectItem>
            <SelectItem value="center">Centro</SelectItem>
            <SelectItem value="right">Direita</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
