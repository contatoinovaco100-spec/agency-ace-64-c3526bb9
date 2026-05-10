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
import { toast } from "@/hooks/use-toast";
import {
  Loader2, ArrowLeft, Save, Eye, Copy, Pause, Play, Trash2, GripVertical, Plus, X,
  ListChecks, CircleDot, Type, Mail, Image as ImageIcon, Layers,
} from "lucide-react";
import {
  DndContext, closestCenter, useSensor, useSensors, PointerSensor,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useQuizEditorStore, type QuestionType, type QuizQuestionDraft,
} from "@/stores/quizEditorStore";

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
    setQuiz, updateMeta, addQuestion, reorderQuestions, select,
  } = useQuizEditorStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientSlug, setClientSlug] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
      {
        id: q.id, client_id: q.client_id, name: q.name, slug: q.slug,
        description: q.description, status: q.status as any,
        result_title: q.result_title, result_text: q.result_text,
        result_cta_label: q.result_cta_label, result_cta_url: q.result_cta_url,
      },
      (questionsData ?? []).map(qq => ({
        id: qq.id, type: qq.type as QuestionType, title: qq.title,
        description: qq.description, required: qq.required,
        order_index: qq.order_index, config: (qq.config as any) ?? {},
        options: (optsByQ.get(qq.id) ?? []).map(o => ({
          id: o.id, text: o.text, order_index: o.order_index,
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
      }).eq("id", meta.id);

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
          }).select("id").single();
          if (error || !created) throw error;
          idMap.set(q.id, created.id);
          // insert options
          const newOpts = q.options.filter(o => !o._deleted);
          if (newOpts.length) {
            await supabase.from("quiz_options").insert(newOpts.map(o => ({
              question_id: created.id, text: o.text, order_index: o.order_index,
            })));
          }
        } else if (q._dirty) {
          await supabase.from("quiz_questions").update({
            type: q.type, title: q.title, description: q.description,
            required: q.required, order_index: q.order_index, config: q.config,
          }).eq("id", q.id);
          // options
          const optsToDelete = q.options.filter(o => o._deleted && !o._new).map(o => o.id);
          if (optsToDelete.length) await supabase.from("quiz_options").delete().in("id", optsToDelete);
          const optsToInsert = q.options.filter(o => o._new && !o._deleted);
          if (optsToInsert.length) {
            await supabase.from("quiz_options").insert(optsToInsert.map(o => ({
              question_id: q.id, text: o.text, order_index: o.order_index,
            })));
          }
          // update existing options text/order
          for (const o of q.options.filter(o => !o._new && !o._deleted)) {
            await supabase.from("quiz_options").update({
              text: o.text, order_index: o.order_index,
            }).eq("id", o.id);
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
            <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Blocos</div>
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
          <CardContent className="p-4 space-y-3 min-h-[400px]">
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
    </div>
  );
}

function SortableQuestionCard({
  q, index, selected, onSelect,
}: { q: QuizQuestionDraft; index: number; selected: boolean; onSelect: () => void }) {
  const { removeQuestion } = useQuizEditorStore();
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
          onClick={e => { e.stopPropagation(); removeQuestion(q.id); }}
          className="text-muted-foreground hover:text-destructive"
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
  const { updateQuestion, addOption, updateOption, removeOption } = useQuizEditorStore();
  const liveOpts = question.options.filter(o => !o._deleted);

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
        <div className="flex items-center justify-between">
          <Label>Resposta obrigatória</Label>
          <Switch checked={question.required} onCheckedChange={v => updateQuestion(question.id, { required: v })} />
        </div>
      )}

      {(question.type === "single" || question.type === "multiple") && (
        <div>
          <Label>Opções</Label>
          <div className="space-y-2 mt-1">
            {liveOpts.map(o => (
              <div key={o.id} className="flex gap-1">
                <Input value={o.text} onChange={e => updateOption(question.id, o.id, { text: e.target.value })} />
                <Button size="icon" variant="ghost" onClick={() => removeOption(question.id, o.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => addOption(question.id)}>
              <Plus className="h-3.5 w-3.5 mr-1" />Adicionar opção
            </Button>
          </div>
        </div>
      )}

      {question.type === "lead" && (
        <div className="space-y-2">
          <Label>Campos exibidos</Label>
          {(["name", "email", "phone"] as const).map(k => {
            const fields = (question.config?.fields ?? {}) as Record<string, boolean>;
            return (
              <div key={k} className="flex items-center justify-between">
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
            );
          })}
        </div>
      )}

      {question.type === "visual" && (
        <div>
          <Label>URL da imagem (opcional)</Label>
          <Input
            value={question.config?.image_url ?? ""}
            onChange={e => updateQuestion(question.id, { config: { ...question.config, image_url: e.target.value } })}
          />
        </div>
      )}
    </div>
  );
}
