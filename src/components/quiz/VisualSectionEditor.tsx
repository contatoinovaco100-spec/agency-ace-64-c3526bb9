import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowUp, ArrowDown, Type, AlignLeft, Image as ImageIcon, List, MousePointerClick } from "lucide-react";
import { QuizMediaUploader } from "./QuizMediaUploader";
import { useQuizEditorStore, type QuizQuestionDraft } from "@/stores/quizEditorStore";

export type VisualElement =
  | { id: string; type: "heading"; text: string; align?: "left" | "center" | "right"; size?: "sm" | "md" | "lg" | "xl" }
  | { id: string; type: "paragraph"; text: string; align?: "left" | "center" | "right" }
  | { id: string; type: "image"; url: string; align?: "left" | "center" | "right" }
  | { id: string; type: "bullets"; items: string[]; align?: "left" | "center" | "right" }
  | { id: string; type: "button"; label: string; url: string; align?: "left" | "center" | "right"; action?: "link" | "next" };

const newId = () => "el_" + Math.random().toString(36).slice(2, 9);

const TYPE_LABELS: Record<VisualElement["type"], { label: string; icon: any }> = {
  heading: { label: "Título", icon: Type },
  paragraph: { label: "Parágrafo", icon: AlignLeft },
  image: { label: "Imagem", icon: ImageIcon },
  bullets: { label: "Lista", icon: List },
  button: { label: "Botão", icon: MousePointerClick },
};

export function VisualSectionEditor({ question }: { question: QuizQuestionDraft }) {
  const { updateQuestion, meta } = useQuizEditorStore();
  const cid = meta?.client_id ?? "shared";
  const elements: VisualElement[] = Array.isArray(question.config?.elements) ? question.config.elements : [];

  const update = (next: VisualElement[]) =>
    updateQuestion(question.id, { config: { ...question.config, elements: next } });

  const add = (type: VisualElement["type"]) => {
    const base: any = { id: newId(), type, align: "center" };
    if (type === "heading") Object.assign(base, { text: "Título", size: "lg" });
    if (type === "paragraph") Object.assign(base, { text: "Texto descritivo" });
    if (type === "image") Object.assign(base, { url: "" });
    if (type === "bullets") Object.assign(base, { items: ["Item 1", "Item 2"] });
    if (type === "button") Object.assign(base, { label: "Continuar", url: "", action: "next" });
    update([...elements, base]);
  };

  const patch = (i: number, p: Partial<VisualElement>) =>
    update(elements.map((e, idx) => (idx === i ? ({ ...e, ...p } as VisualElement) : e)));

  const remove = (i: number) => update(elements.filter((_, idx) => idx !== i));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= elements.length) return;
    const next = [...elements];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };

  return (
    <div className="space-y-2">
      <Label>Elementos da seção</Label>
      <div className="space-y-2">
        {elements.map((el, i) => {
          const Icon = TYPE_LABELS[el.type].icon;
          return (
            <div key={el.id} className="border border-border rounded-md p-2 space-y-2 bg-muted/20">
              <div className="flex items-center gap-1">
                <Icon className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium flex-1">{TYPE_LABELS[el.type].label}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, 1)} disabled={i === elements.length - 1}><ArrowDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>

              {el.type === "heading" && (
                <>
                  <Input value={el.text} onChange={e => patch(i, { text: e.target.value } as any)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={el.size ?? "lg"} onValueChange={v => patch(i, { size: v } as any)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tamanho" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sm">Pequeno</SelectItem>
                        <SelectItem value="md">Médio</SelectItem>
                        <SelectItem value="lg">Grande</SelectItem>
                        <SelectItem value="xl">Extra grande</SelectItem>
                      </SelectContent>
                    </Select>
                    <AlignSelect value={el.align ?? "center"} onChange={v => patch(i, { align: v } as any)} />
                  </div>
                </>
              )}

              {el.type === "paragraph" && (
                <>
                  <Textarea rows={2} value={el.text} onChange={e => patch(i, { text: e.target.value } as any)} />
                  <AlignSelect value={el.align ?? "center"} onChange={v => patch(i, { align: v } as any)} />
                </>
              )}

              {el.type === "image" && (
                <>
                  <QuizMediaUploader value={el.url} onChange={v => patch(i, { url: v } as any)} clientId={cid} label="" />
                  <AlignSelect value={el.align ?? "center"} onChange={v => patch(i, { align: v } as any)} />
                </>
              )}

              {el.type === "bullets" && (
                <>
                  <Textarea rows={3} value={el.items.join("\n")}
                    placeholder="Um item por linha"
                    onChange={e => patch(i, { items: e.target.value.split("\n") } as any)} />
                  <AlignSelect value={el.align ?? "left"} onChange={v => patch(i, { align: v } as any)} />
                </>
              )}

              {el.type === "button" && (
                <>
                  <Input placeholder="Texto do botão" value={el.label} onChange={e => patch(i, { label: e.target.value } as any)} />
                  <Select value={el.action ?? "next"} onValueChange={v => patch(i, { action: v } as any)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="next">Avançar para próximo bloco</SelectItem>
                      <SelectItem value="link">Abrir link externo</SelectItem>
                    </SelectContent>
                  </Select>
                  {el.action === "link" && (
                    <Input placeholder="https://..." value={el.url} onChange={e => patch(i, { url: e.target.value } as any)} />
                  )}
                  <AlignSelect value={el.align ?? "center"} onChange={v => patch(i, { align: v } as any)} />
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-1 pt-1">
        {(Object.keys(TYPE_LABELS) as VisualElement["type"][]).map(t => {
          const Icon = TYPE_LABELS[t].icon;
          return (
            <Button key={t} size="sm" variant="outline" onClick={() => add(t)}>
              <Plus className="h-3 w-3 mr-1" /><Icon className="h-3 w-3 mr-1" />{TYPE_LABELS[t].label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function AlignSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Alinhamento" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="left">Esquerda</SelectItem>
        <SelectItem value="center">Centro</SelectItem>
        <SelectItem value="right">Direita</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function renderVisualElements(
  elements: VisualElement[],
  theme: { primary_color: string; button_text_color: string; border_radius: number; heading_weight: number },
  onButtonNext?: () => void,
) {
  const sizeMap = { sm: "text-base", md: "text-lg", lg: "text-2xl", xl: "text-4xl" };
  return elements.map((el) => {
    const align = el.align ?? "center";
    const alignClass = align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
    if (el.type === "heading") {
      return (
        <h3 key={el.id} className={`${sizeMap[el.size ?? "lg"]} ${alignClass}`} style={{ fontWeight: theme.heading_weight }}>
          {el.text}
        </h3>
      );
    }
    if (el.type === "paragraph") {
      return <p key={el.id} className={`${alignClass} whitespace-pre-line opacity-90`}>{el.text}</p>;
    }
    if (el.type === "image" && el.url) {
      return (
        <div key={el.id} className={alignClass}>
          <img src={el.url} alt="" className="inline-block max-w-full" style={{ borderRadius: theme.border_radius }} />
        </div>
      );
    }
    if (el.type === "bullets") {
      return (
        <ul key={el.id} className={`${alignClass} space-y-1.5 list-none`}>
          {el.items.filter(Boolean).map((it, idx) => (
            <li key={idx} className="flex items-start gap-2 justify-start" style={{ justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start" }}>
              <span style={{ color: theme.primary_color }}>✓</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      );
    }
    if (el.type === "button") {
      const style: React.CSSProperties = {
        backgroundColor: theme.primary_color,
        color: theme.button_text_color,
        borderRadius: theme.border_radius,
        fontWeight: 600,
      };
      const cls = "inline-block px-6 py-3";
      return (
        <div key={el.id} className={alignClass}>
          {el.action === "link" && el.url ? (
            <a href={el.url} target="_blank" rel="noreferrer" className={cls} style={style}>{el.label}</a>
          ) : (
            <button onClick={onButtonNext} className={cls} style={style}>{el.label}</button>
          )}
        </div>
      );
    }
    return null;
  });
}
