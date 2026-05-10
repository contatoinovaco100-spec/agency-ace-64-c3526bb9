import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Star } from "lucide-react";
import { QuizMediaUploader } from "./QuizMediaUploader";
import { useQuizEditorStore, type QuizQuestionDraft } from "@/stores/quizEditorStore";

export function SalesBlockSettings({ question }: { question: QuizQuestionDraft }) {
  const { updateQuestion, meta } = useQuizEditorStore();
  const cid = meta?.client_id ?? "shared";
  const c = question.config ?? {};
  const patch = (p: Record<string, any>) => updateQuestion(question.id, { config: { ...c, ...p } });

  switch (question.type) {
    case "scarcity":
      return (
        <div className="space-y-3">
          <div><Label className="text-xs">Texto (use {"{n}"} para vagas restantes)</Label>
            <Input value={c.text ?? ""} onChange={e => patch({ text: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Total de vagas</Label>
              <Input type="number" value={c.slots_total ?? 10} onChange={e => patch({ slots_total: +e.target.value })} /></div>
            <div><Label className="text-xs">Vagas preenchidas</Label>
              <Input type="number" value={c.slots_filled ?? 7} onChange={e => patch({ slots_filled: +e.target.value })} /></div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Mostrar contador regressivo</Label>
            <Switch checked={!!c.show_timer} onCheckedChange={v => patch({ show_timer: v })} />
          </div>
          {c.show_timer && (
            <div><Label className="text-xs">Minutos do timer</Label>
              <Input type="number" value={c.timer_minutes ?? 15} onChange={e => patch({ timer_minutes: +e.target.value })} /></div>
          )}
        </div>
      );

    case "social_proof":
      return (
        <div className="space-y-3">
          <div><Label className="text-xs">Texto (use {"{n}"} para o número)</Label>
            <Input value={c.text ?? ""} onChange={e => patch({ text: e.target.value })} /></div>
          <div><Label className="text-xs">Número base</Label>
            <Input type="number" value={c.count ?? 127} onChange={e => patch({ count: +e.target.value })} /></div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Animação de +1</Label>
            <Switch checked={!!c.show_animation} onCheckedChange={v => patch({ show_animation: v })} />
          </div>
        </div>
      );

    case "testimonials": {
      const items = (c.items ?? []) as any[];
      const updateItem = (i: number, p: Record<string, any>) => {
        const next = [...items];
        next[i] = { ...next[i], ...p };
        patch({ items: next });
      };
      return (
        <div className="space-y-3">
          <div><Label className="text-xs">Autoplay (segundos, 0 = desligado)</Label>
            <Input type="number" value={c.autoplay_seconds ?? 0} onChange={e => patch({ autoplay_seconds: +e.target.value })} /></div>
          <Label>Depoimentos</Label>
          {items.map((item, i) => (
            <div key={i} className="border border-border rounded-md p-2 space-y-2">
              <div className="flex gap-1">
                <Input value={item.name} placeholder="Nome" onChange={e => updateItem(i, { name: e.target.value })} />
                <Button size="icon" variant="ghost" onClick={() => patch({ items: items.filter((_, j) => j !== i) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Input value={item.role} placeholder="Cargo / Empresa" onChange={e => updateItem(i, { role: e.target.value })} />
              <Textarea rows={2} value={item.text} placeholder="Depoimento" onChange={e => updateItem(i, { text: e.target.value })} />
              <div className="flex items-center gap-2">
                <Label className="text-xs">Estrelas</Label>
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => updateItem(i, { stars: s })}>
                      <Star className="h-4 w-4" style={{ color: s <= (item.stars ?? 5) ? "#facc15" : "#555", fill: s <= (item.stars ?? 5) ? "#facc15" : "none" }} />
                    </button>
                  ))}
                </div>
              </div>
              <QuizMediaUploader label="Foto" value={item.photo_url ?? ""} onChange={v => updateItem(i, { photo_url: v })} clientId={cid} />
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => patch({ items: [...items, { name: "Cliente", role: "", text: "", stars: 5, photo_url: "" }] })}>
            <Plus className="h-3.5 w-3.5 mr-1" />Adicionar depoimento
          </Button>
        </div>
      );
    }

    case "cta_whatsapp":
      return (
        <div className="space-y-3">
          <div><Label className="text-xs">Número WhatsApp (com DDD e código país)</Label>
            <Input value={c.phone ?? ""} placeholder="5511999999999" onChange={e => patch({ phone: e.target.value })} /></div>
          <div><Label className="text-xs">Mensagem pré-preenchida</Label>
            <Textarea rows={2} value={c.message ?? ""} onChange={e => patch({ message: e.target.value })} /></div>
          <div><Label className="text-xs">Texto do botão</Label>
            <Input value={c.button_text ?? ""} onChange={e => patch({ button_text: e.target.value })} /></div>
          <div><Label className="text-xs">Texto acima do botão</Label>
            <Input value={c.above_text ?? ""} onChange={e => patch({ above_text: e.target.value })} /></div>
        </div>
      );

    case "cta_price":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Preço original (De)</Label>
              <Input value={c.original_price ?? ""} onChange={e => patch({ original_price: e.target.value })} /></div>
            <div><Label className="text-xs">Preço atual (Por)</Label>
              <Input value={c.current_price ?? ""} onChange={e => patch({ current_price: e.target.value })} /></div>
          </div>
          <div><Label className="text-xs">Badge de desconto</Label>
            <Input value={c.discount_badge ?? ""} placeholder="-40%" onChange={e => patch({ discount_badge: e.target.value })} /></div>
          <div><Label className="text-xs">Texto do botão</Label>
            <Input value={c.button_text ?? ""} onChange={e => patch({ button_text: e.target.value })} /></div>
          <div><Label className="text-xs">URL do botão</Label>
            <Input value={c.button_url ?? ""} placeholder="https://..." onChange={e => patch({ button_url: e.target.value })} /></div>
          <div><Label className="text-xs">Texto de urgência</Label>
            <Input value={c.urgency_text ?? ""} onChange={e => patch({ urgency_text: e.target.value })} /></div>
          <div><Label className="text-xs">Texto de garantia</Label>
            <Input value={c.guarantee_text ?? ""} onChange={e => patch({ guarantee_text: e.target.value })} /></div>
        </div>
      );

    case "authority": {
      const logos = (c.logos ?? []) as string[];
      return (
        <div className="space-y-3">
          <div><Label className="text-xs">Título</Label>
            <Input value={c.title ?? ""} onChange={e => patch({ title: e.target.value })} /></div>
          <Label>Logos</Label>
          {logos.map((url, i) => (
            <div key={i} className="flex gap-1 items-center">
              <QuizMediaUploader label="" value={url} onChange={v => { const n = [...logos]; n[i] = v; patch({ logos: n }); }} clientId={cid} />
              <Button size="icon" variant="ghost" onClick={() => patch({ logos: logos.filter((_, j) => j !== i) })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => patch({ logos: [...logos, ""] })}>
            <Plus className="h-3.5 w-3.5 mr-1" />Adicionar logo
          </Button>
        </div>
      );
    }

    case "before_after": {
      const bItems = (c.before_items ?? []) as string[];
      const aItems = (c.after_items ?? []) as string[];
      return (
        <div className="space-y-3">
          <div><Label className="text-xs">Título "Antes"</Label>
            <Input value={c.before_title ?? ""} onChange={e => patch({ before_title: e.target.value })} /></div>
          <div><Label className="text-xs">Itens "Antes" (um por linha)</Label>
            <Textarea rows={3} value={bItems.join("\n")} onChange={e => patch({ before_items: e.target.value.split("\n") })} /></div>
          <div><Label className="text-xs">Título "Depois"</Label>
            <Input value={c.after_title ?? ""} onChange={e => patch({ after_title: e.target.value })} /></div>
          <div><Label className="text-xs">Itens "Depois" (um por linha)</Label>
            <Textarea rows={3} value={aItems.join("\n")} onChange={e => patch({ after_items: e.target.value.split("\n") })} /></div>
        </div>
      );
    }

    case "comparison_table": {
      const rows = (c.rows ?? []) as { feature: string; col1: boolean; col2: boolean }[];
      const updateRow = (i: number, p: Record<string, any>) => {
        const n = [...rows]; n[i] = { ...n[i], ...p }; patch({ rows: n });
      };
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Coluna 1 (concorrência)</Label>
              <Input value={c.col1_title ?? ""} onChange={e => patch({ col1_title: e.target.value })} /></div>
            <div><Label className="text-xs">Coluna 2 (sua solução)</Label>
              <Input value={c.col2_title ?? ""} onChange={e => patch({ col2_title: e.target.value })} /></div>
          </div>
          <div><Label className="text-xs">Badge da coluna 2</Label>
            <Input value={c.col2_badge ?? ""} placeholder="Recomendado" onChange={e => patch({ col2_badge: e.target.value })} /></div>
          <Label>Linhas</Label>
          {rows.map((row, i) => (
            <div key={i} className="border border-border rounded-md p-2 space-y-1">
              <div className="flex gap-1">
                <Input value={row.feature} placeholder="Característica" onChange={e => updateRow(i, { feature: e.target.value })} />
                <Button size="icon" variant="ghost" onClick={() => patch({ rows: rows.filter((_, j) => j !== i) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-1 text-xs"><Switch checked={row.col1} onCheckedChange={v => updateRow(i, { col1: v })} />Col 1</label>
                <label className="flex items-center gap-1 text-xs"><Switch checked={row.col2} onCheckedChange={v => updateRow(i, { col2: v })} />Col 2</label>
              </div>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => patch({ rows: [...rows, { feature: "", col1: false, col2: true }] })}>
            <Plus className="h-3.5 w-3.5 mr-1" />Adicionar linha
          </Button>
        </div>
      );
    }

    default:
      return null;
  }
}
