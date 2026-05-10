import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ArrowUp, ArrowDown, Type, AlignLeft, Image as ImageIcon, List, MousePointerClick, Timer, Users, MessageSquare, MessageCircle, DollarSign, Building2, ArrowLeftRight, Table2, Gauge, TrendingUp, Bell, LogOut, Sparkles, Calculator, Thermometer, LayoutTemplate, Send, AlertTriangle, CheckSquare, PlayCircle, Video, ArrowDownUp, Code, Loader2 } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { QuizMediaUploader } from "./QuizMediaUploader";
import { useQuizEditorStore, type QuizQuestionDraft } from "@/stores/quizEditorStore";
import { SalesElementSettings } from "./SalesBlocksEditor";
import {
  ScarcityBlock, SocialProofBlock, TestimonialsBlock, CtaWhatsAppBlock,
  CtaPriceBlock, AuthorityBlock, BeforeAfterBlock, ComparisonTableBlock,
  GaugeChartBlock, ProgressMotivationalBlock, ToastSocialOverlay,
  ExitIntentPopup, ProgressiveRevealBlock, RoiCalculatorBlock,
  MaturityThermometerBlock, PricingPlansBlock, PostResultFormBlock,
  AlertBlock, ArgumentsBlock, AudioBlock, VideoBlock, SpacerBlock, HtmlBlock,
  FakeLoadingBlock
} from "./SalesBlocks";

export type VisualElement =
  | { id: string; type: "heading"; text: string; align?: "left" | "center" | "right"; size?: "sm" | "md" | "lg" | "xl" }
  | { id: string; type: "paragraph"; text: string; align?: "left" | "center" | "right" }
  | { id: string; type: "image"; url: string; align?: "left" | "center" | "right" }
  | { id: string; type: "bullets"; items: string[]; align?: "left" | "center" | "right" }
  | { id: string; type: "button"; label: string; url: string; align?: "left" | "center" | "right"; action?: "link" | "next" }
  | { id: string; type: string; [key: string]: any };

const newId = () => "el_" + Math.random().toString(36).slice(2, 9);

export const TYPE_LABELS: Record<string, { label: string; icon: any; default?: any }> = {
  heading: { label: "Título", icon: Type },
  paragraph: { label: "Parágrafo", icon: AlignLeft },
  image: { label: "Imagem", icon: ImageIcon },
  bullets: { label: "Lista", icon: List },
  button: { label: "Botão", icon: MousePointerClick },
  scarcity: { label: "Escassez", icon: Timer, default: { text: "Restam apenas {n} vagas", slots_total: 10, slots_filled: 7, show_timer: true, timer_minutes: 15 } },
  social_proof: { label: "Prova Social", icon: Users, default: { text: "Mais de {n} pessoas completaram", count: 127, show_animation: true } },
  testimonials: { label: "Depoimentos", icon: MessageSquare, default: { items: [{ name: "Cliente", role: "Empresa", text: "Muito bom!", stars: 5, photo_url: "" }], autoplay_seconds: 5 } },
  cta_whatsapp: { label: "CTA WhatsApp", icon: MessageCircle, default: { phone: "5511999999999", message: "Olá!", button_text: "Falar no WhatsApp", above_text: "Dúvidas?" } },
  cta_price: { label: "Preço", icon: DollarSign, default: { original_price: "R$ 997", current_price: "R$ 497", discount_badge: "-50%", button_text: "Comprar", button_url: "", urgency_text: "Oferta limitada", guarantee_text: "7 dias de garantia" } },
  authority: { label: "Autoridade", icon: Building2, default: { title: "Quem confia", logos: [] } },
  before_after: { label: "Antes / Depois", icon: ArrowLeftRight, default: { before_title: "Antes", before_items: ["Problema"], after_title: "Depois", after_items: ["Solução"] } },
  comparison_table: { label: "Comparação", icon: Table2, default: { col1_title: "Concorrência", col2_title: "Nós", col2_badge: "Recomendado", rows: [{ feature: "Suporte", col1: false, col2: true }] } },
  gauge_chart: { label: "Score (Gauge)", icon: Gauge, default: { score: 67, max_score: 100, label: "Sua pontuação", zones: [{ name: "Ruim", color: "#ef4444", max: 33 }, { name: "Médio", color: "#eab308", max: 66 }, { name: "Bom", color: "#22c55e", max: 100 }] } },
  progress_motivational: { label: "Motivacional", icon: TrendingUp, default: { ranges: [{ min: 0, max: 50, text: "Começando..." }, { min: 51, max: 100, text: "Quase lá!" }] } },
  toast_social: { label: "Toast Social", icon: Bell, default: { items: [{ name: "Maria", city: "SP" }], interval_seconds: 8, action_text: "acabou de se inscrever" } },
  exit_intent: { label: "Exit Intent", icon: LogOut, default: { title: "Espera!", text: "Ainda não terminou...", button_text: "Continuar", show_on_mobile: true, mobile_idle_seconds: 30 } },
  progressive_reveal: { label: "Revelação", icon: Sparkles, default: { loading_text: "Calculando...", loading_seconds: 3, reveal_steps: [{ type: "score", label: "Score" }] } },
  roi_calculator: { label: "ROI", icon: Calculator, default: { prefix: "R$ ", value: "15.000", suffix: " / mês", label: "Seu potencial de resultado", disclaimer: "" } },
  maturity_thermometer: { label: "Termômetro", icon: Thermometer, default: { score: 50, max_score: 100, levels: [{ name: "Iniciante", desc: "", color: "#ef4444", max: 50 }, { name: "Avançado", desc: "", color: "#22c55e", max: 100 }] } },
  pricing_plans: { label: "Planos", icon: LayoutTemplate, default: { plans: [{ name: "Básico", price: "99", features: ["1"], is_popular: false, button_text: "Comprar", button_url: "" }] } },
  post_result_form: { label: "Form Extra", icon: Send, default: { title: "Receba seu diagnóstico:", button_text: "Enviar", fields: { name: true, email: true } } },
  alert: { label: "Alerta", icon: AlertTriangle, default: { variant: "warning", text: "Atenção: Oferta por tempo limitado." } },
  arguments: { label: "Argumentos", icon: CheckSquare, default: { title: "Por que escolher nossa solução?", items: [{ title: "Diferencial 1", desc: "Descrição do diferencial" }] } },
  audio: { label: "Áudio", icon: PlayCircle, default: { title: "Ouça a mensagem especial", url: "" } },
  video: { label: "Vídeo", icon: Video, default: { url: "https://www.youtube.com/embed/dQw4w9WgXcQ" } },
  html: { label: "HTML / Embed", icon: Code, default: { code: "<iframe src=\"...\" />" } },
  spacer: { label: "Espaço", icon: ArrowDownUp, default: { height: 32, show_line: false } },
  fake_loading: { label: "Loading (Auto-Avança)", icon: Loader2, default: { text: "Analisando suas respostas...", duration_seconds: 3 } },
};

export function VisualSectionEditor({ question }: { question: QuizQuestionDraft }) {
  const { updateQuestion, meta } = useQuizEditorStore();
  const cid = meta?.client_id ?? "shared";
  const elements: VisualElement[] = Array.isArray(question.config?.elements) ? question.config.elements : [];

  const update = (next: VisualElement[]) =>
    updateQuestion(question.id, { config: { ...question.config, elements: next } });

  const add = (type: string) => {
    const base: any = { id: newId(), type };
    if (type === "heading") Object.assign(base, { text: "Título", size: "lg", align: "center" });
    else if (type === "paragraph") Object.assign(base, { text: "Texto descritivo", align: "center" });
    else if (type === "image") Object.assign(base, { url: "", align: "center" });
    else if (type === "bullets") Object.assign(base, { items: ["Item 1", "Item 2"], align: "center" });
    else if (type === "button") Object.assign(base, { label: "Continuar", url: "", action: "next", align: "center" });
    else if (TYPE_LABELS[type]?.default) Object.assign(base, TYPE_LABELS[type].default);
    
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

              {!["heading", "paragraph", "image", "bullets", "button"].includes(el.type) && (
                <SalesElementSettings element={el} patch={(p) => patch(i, p)} clientId={cid} />
              )}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-1 pt-1">
        {Object.keys(TYPE_LABELS).map(t => {
          const Icon = TYPE_LABELS[t].icon;
          
          const previewBase: any = { id: "preview", type: t };
          if (t === "heading") Object.assign(previewBase, { text: "Exemplo de Título", size: "lg", align: "center" });
          else if (t === "paragraph") Object.assign(previewBase, { text: "Um parágrafo de exemplo para você visualizar.", align: "center" });
          else if (t === "image") Object.assign(previewBase, { url: "https://placehold.co/400x200/222/FFF?text=Exemplo+de+Imagem", align: "center" });
          else if (t === "bullets") Object.assign(previewBase, { items: ["Vantagem 1", "Benefício 2"], align: "center" });
          else if (t === "button") Object.assign(previewBase, { label: "Botão de Exemplo", action: "next", align: "center" });
          else Object.assign(previewBase, TYPE_LABELS[t].default || {});

          // Default mock theme for previewing components
          const mockTheme = {
            primary_color: "#eab308", // amber-500
            button_text_color: "#000000",
            border_radius: 8,
            heading_weight: 800,
          };

          return (
            <HoverCard key={t} openDelay={200} closeDelay={100}>
              <HoverCardTrigger asChild>
                <Button size="sm" variant="outline" className="justify-start text-xs h-8 px-2" onClick={() => add(t)}>
                  <Icon className="h-3.5 w-3.5 mr-2 shrink-0" />
                  <span className="truncate">{TYPE_LABELS[t].label}</span>
                </Button>
              </HoverCardTrigger>
              <HoverCardContent side="top" sideOffset={10} className="w-[320px] p-0 overflow-hidden bg-black/95 border border-white/10 z-[100] shadow-2xl backdrop-blur-md">
                <div className="bg-white/5 p-2 border-b border-white/10 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1">
                    <Icon className="h-3 w-3" /> {TYPE_LABELS[t].label}
                  </span>
                  <span className="text-[9px] text-muted-foreground">Preview</span>
                </div>
                <div className="p-4 flex flex-col gap-4 pointer-events-none text-white overflow-hidden max-h-[300px]">
                   {renderVisualElements([previewBase], mockTheme)}
                </div>
              </HoverCardContent>
            </HoverCard>
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
  theme: { primary_color: string; button_text_color: string; border_radius: number; heading_weight: number, card_background?: string, text_color?: string },
  onButtonNext?: () => void,
  progress?: number
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
    
    // Sales blocks rendering mapping
    if (el.type === "scarcity") return <ScarcityBlock key={el.id} config={el} theme={theme as any} />;
    if (el.type === "social_proof") return <SocialProofBlock key={el.id} config={el} theme={theme as any} />;
    if (el.type === "testimonials") return <TestimonialsBlock key={el.id} config={el} theme={theme as any} />;
    if (el.type === "cta_whatsapp") return <CtaWhatsAppBlock key={el.id} config={el} theme={theme as any} />;
    if (el.type === "cta_price") return <CtaPriceBlock key={el.id} config={el} theme={theme as any} />;
    if (el.type === "authority") return <AuthorityBlock key={el.id} config={el} theme={theme as any} />;
    if (el.type === "before_after") return <BeforeAfterBlock key={el.id} config={el} theme={theme as any} />;
    if (el.type === "comparison_table") return <ComparisonTableBlock key={el.id} config={el} theme={theme as any} />;
    if (el.type === "gauge_chart") return <GaugeChartBlock key={el.id} config={el} theme={theme as any} />;
    if (el.type === "progress_motivational") return <ProgressMotivationalBlock key={el.id} config={el} theme={theme as any} progress={progress ?? 0} />;
    if (el.type === "progressive_reveal") return <ProgressiveRevealBlock key={el.id} config={el} theme={theme as any} />;
    if (el.type === "roi_calculator") return <RoiCalculatorBlock key={el.id} config={el} theme={theme as any} />;
    if (el.type === "maturity_thermometer") return <MaturityThermometerBlock key={el.id} config={el} theme={theme as any} />;
    if (el.type === "pricing_plans") return <PricingPlansBlock key={el.id} config={el} theme={theme as any} />;
    if (el.type === "post_result_form") return <PostResultFormBlock key={el.id} config={el} theme={theme as any} />;
    if (el.type === "alert") return <AlertBlock key={el.id} config={el} theme={theme as any} />;
    if (el.type === "arguments") return <ArgumentsBlock key={el.id} config={el} theme={theme as any} />;
    if (el.type === "audio") return <AudioBlock key={el.id} config={el} theme={theme as any} />;
    if (el.type === "video") return <VideoBlock key={el.id} config={el} theme={theme as any} />;
    if (el.type === "html") return <HtmlBlock key={el.id} config={el} theme={theme as any} />;
    if (el.type === "spacer") return <SpacerBlock key={el.id} config={el} theme={theme as any} />;
    if (el.type === "fake_loading") return <FakeLoadingBlock key={el.id} config={el} theme={theme as any} onNext={onButtonNext} />;

    return null;
  });
}
