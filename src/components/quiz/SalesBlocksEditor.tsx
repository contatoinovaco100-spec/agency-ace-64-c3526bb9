import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Star } from "lucide-react";
import { QuizMediaUploader } from "./QuizMediaUploader";
import { useQuizEditorStore, type QuizQuestionDraft } from "@/stores/quizEditorStore";

export function SalesElementSettings({ element, patch, clientId }: { element: any; patch: (p: any) => void; clientId: string }) {
  const c = element;
  const cid = clientId;

  return (
    <div className="space-y-4">
      {getSettings(element, patch, clientId)}
      <div className="pt-2 border-t border-border mt-2">
        <Label className="text-[10px] uppercase tracking-wider opacity-50 mb-2 block">Estilo do Bloco</Label>
        <Select value={c.theme_variant ?? "auto"} onValueChange={v => patch({ theme_variant: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Automático (Tema do Quiz)</SelectItem>
            <SelectItem value="light">Versão Clara</SelectItem>
            <SelectItem value="dark">Versão Escura</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function getSettings(element: any, patch: (p: any) => void, cid: string) {
  const c = element;
  switch (element.type) {
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

    case "highlight_text":
      return (
        <div className="space-y-3">
          <div><Label className="text-xs">Texto Completo</Label>
            <Textarea rows={2} value={c.full_text ?? ""} onChange={e => patch({ full_text: e.target.value })} /></div>
          <div><Label className="text-xs">Palavra ou Frase para destacar (deve ser idêntica a uma parte do texto acima)</Label>
            <Input value={c.highlight_part ?? ""} onChange={e => patch({ highlight_part: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Tamanho da Fonte (px)</Label>
              <Input type="number" value={c.font_size ?? 24} onChange={e => patch({ font_size: +e.target.value })} /></div>
            <div><Label className="text-xs">Alinhamento</Label>
              <Select value={c.align ?? "center"} onValueChange={v => patch({ align: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Esquerda</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="right">Direita</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label className="text-xs">Cor do Destaque</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={c.highlight_color ?? "#bff720"} onChange={e => patch({ highlight_color: e.target.value })} className="w-8 h-8 rounded border" />
                <Input value={c.highlight_color ?? "#bff720"} onChange={e => patch({ highlight_color: e.target.value })} className="text-xs font-mono" />
              </div>
            </div>
            <div className="flex flex-col items-center">
              <Label className="text-xs mb-2">Negrito</Label>
              <Switch checked={!!c.is_bold} onCheckedChange={v => patch({ is_bold: v })} />
            </div>
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
              <Input value={item.highlight ?? ""} placeholder="Destaque (Ex: R$ 100k recuperados)" onChange={e => updateItem(i, { highlight: e.target.value })} />
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

    case "gauge_chart": {
      const zones = (c.zones ?? []) as any[];
      const updateZone = (i: number, p: Record<string, any>) => {
        const n = [...zones]; n[i] = { ...n[i], ...p }; patch({ zones: n });
      };
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Score</Label>
              <Input type="number" value={c.score ?? 67} onChange={e => patch({ score: +e.target.value })} /></div>
            <div><Label className="text-xs">Score máximo</Label>
              <Input type="number" value={c.max_score ?? 100} onChange={e => patch({ max_score: +e.target.value })} /></div>
          </div>
          <div><Label className="text-xs">Label</Label>
            <Input value={c.label ?? ""} onChange={e => patch({ label: e.target.value })} /></div>
          <Label>Zonas (faixas de cor)</Label>
          {zones.map((z, i) => (
            <div key={i} className="border border-border rounded-md p-2 space-y-1">
              <div className="flex gap-1">
                <Input value={z.name} placeholder="Nome" onChange={e => updateZone(i, { name: e.target.value })} />
                <Input type="number" value={z.max} placeholder="Até %" className="w-20" onChange={e => updateZone(i, { max: +e.target.value })} />
                <Input type="color" value={z.color} className="w-10 p-0 h-9" onChange={e => updateZone(i, { color: e.target.value })} />
                <Button size="icon" variant="ghost" onClick={() => patch({ zones: zones.filter((_, j) => j !== i) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => patch({ zones: [...zones, { name: "Zona", color: "#22c55e", max: 100 }] })}>
            <Plus className="h-3.5 w-3.5 mr-1" />Adicionar zona
          </Button>
        </div>
      );
    }

    case "progress_motivational": {
      const ranges = (c.ranges ?? []) as any[];
      const updateRange = (i: number, p: Record<string, any>) => {
        const n = [...ranges]; n[i] = { ...n[i], ...p }; patch({ ranges: n });
      };
      return (
        <div className="space-y-3">
          <Label>Faixas de progresso</Label>
          {ranges.map((r, i) => (
            <div key={i} className="border border-border rounded-md p-2 space-y-1">
              <div className="grid grid-cols-[1fr_50px_50px_auto] gap-1 items-center">
                <Input value={r.text} placeholder="Mensagem" onChange={e => updateRange(i, { text: e.target.value })} className="text-xs" />
                <Input type="number" value={r.min} className="text-xs" onChange={e => updateRange(i, { min: +e.target.value })} />
                <Input type="number" value={r.max} className="text-xs" onChange={e => updateRange(i, { max: +e.target.value })} />
                <Button size="icon" variant="ghost" onClick={() => patch({ ranges: ranges.filter((_, j) => j !== i) })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => patch({ ranges: [...ranges, { min: 0, max: 100, text: "Mensagem aqui" }] })}>
            <Plus className="h-3.5 w-3.5 mr-1" />Adicionar faixa
          </Button>
        </div>
      );
    }

    case "toast_social": {
      const items = (c.items ?? []) as any[];
      const updateItem = (i: number, p: Record<string, any>) => {
        const n = [...items]; n[i] = { ...n[i], ...p }; patch({ items: n });
      };
      return (
        <div className="space-y-3">
          <div><Label className="text-xs">Texto de ação</Label>
            <Input value={c.action_text ?? ""} placeholder="acabou de se inscrever" onChange={e => patch({ action_text: e.target.value })} /></div>
          <div><Label className="text-xs">Intervalo (segundos)</Label>
            <Input type="number" value={c.interval_seconds ?? 8} onChange={e => patch({ interval_seconds: +e.target.value })} /></div>
          <Label>Pessoas</Label>
          {items.map((item, i) => (
            <div key={i} className="flex gap-1">
              <Input value={item.name} placeholder="Nome" onChange={e => updateItem(i, { name: e.target.value })} />
              <Input value={item.city} placeholder="Cidade" onChange={e => updateItem(i, { city: e.target.value })} />
              <Button size="icon" variant="ghost" onClick={() => patch({ items: items.filter((_, j) => j !== i) })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => patch({ items: [...items, { name: "", city: "" }] })}>
            <Plus className="h-3.5 w-3.5 mr-1" />Adicionar pessoa
          </Button>
        </div>
      );
    }

    case "exit_intent":
      return (
        <div className="space-y-3">
          <div><Label className="text-xs">Título</Label>
            <Input value={c.title ?? ""} onChange={e => patch({ title: e.target.value })} /></div>
          <div><Label className="text-xs">Texto</Label>
            <Textarea rows={2} value={c.text ?? ""} onChange={e => patch({ text: e.target.value })} /></div>
          <div><Label className="text-xs">Texto do botão</Label>
            <Input value={c.button_text ?? ""} onChange={e => patch({ button_text: e.target.value })} /></div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Ativar no mobile</Label>
            <Switch checked={!!c.show_on_mobile} onCheckedChange={v => patch({ show_on_mobile: v })} />
          </div>
          {c.show_on_mobile && (
            <div><Label className="text-xs">Segundos de inatividade (mobile)</Label>
              <Input type="number" value={c.mobile_idle_seconds ?? 30} onChange={e => patch({ mobile_idle_seconds: +e.target.value })} /></div>
          )}
        </div>
      );

    case "progressive_reveal": {
      const steps = (c.reveal_steps ?? []) as any[];
      const updateStep = (i: number, p: Record<string, any>) => {
        const n = [...steps]; n[i] = { ...n[i], ...p }; patch({ reveal_steps: n });
      };
      return (
        <div className="space-y-3">
          <div><Label className="text-xs">Texto de loading</Label>
            <Input value={c.loading_text ?? ""} onChange={e => patch({ loading_text: e.target.value })} /></div>
          <div><Label className="text-xs">Duração do loading (segundos)</Label>
            <Input type="number" value={c.loading_seconds ?? 3} onChange={e => patch({ loading_seconds: +e.target.value })} /></div>
          <Label>Etapas de revelação</Label>
          {steps.map((s, i) => (
            <div key={i} className="border border-border rounded-md p-2 space-y-1">
              <div className="flex gap-1">
                <select value={s.type} onChange={e => updateStep(i, { type: e.target.value })}
                  className="h-9 rounded-md border border-border bg-background px-2 text-xs">
                  <option value="score">Score</option>
                  <option value="classification">Classificação</option>
                  <option value="recommendation">Recomendação</option>
                </select>
                <Input value={s.label || s.text || ""} placeholder={s.type === "recommendation" ? "Texto" : "Label"}
                  onChange={e => updateStep(i, s.type === "recommendation" ? { text: e.target.value } : { label: e.target.value })} className="text-xs" />
                <Button size="icon" variant="ghost" onClick={() => patch({ reveal_steps: steps.filter((_, j) => j !== i) })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => patch({ reveal_steps: [...steps, { type: "score", label: "Score" }] })}>
            <Plus className="h-3.5 w-3.5 mr-1" />Adicionar etapa
          </Button>
        </div>
      );
    }

    case "roi_calculator":
      return (
        <div className="space-y-3">
          <div><Label className="text-xs">Prefixo</Label>
            <Input value={c.prefix ?? ""} placeholder="R$ " onChange={e => patch({ prefix: e.target.value })} /></div>
          <div><Label className="text-xs">Valor estimado</Label>
            <Input value={c.value ?? ""} placeholder="15.000" onChange={e => patch({ value: e.target.value })} /></div>
          <div><Label className="text-xs">Sufixo</Label>
            <Input value={c.suffix ?? ""} placeholder=" / mês" onChange={e => patch({ suffix: e.target.value })} /></div>
          <div><Label className="text-xs">Label</Label>
            <Input value={c.label ?? ""} onChange={e => patch({ label: e.target.value })} /></div>
          <div><Label className="text-xs">Disclaimer (texto menor em baixo)</Label>
            <Input value={c.disclaimer ?? ""} onChange={e => patch({ disclaimer: e.target.value })} /></div>
        </div>
      );

    case "maturity_thermometer": {
      const levels = (c.levels ?? []) as any[];
      const updateLevel = (i: number, p: Record<string, any>) => {
        const n = [...levels]; n[i] = { ...n[i], ...p }; patch({ levels: n });
      };
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Score atual</Label>
              <Input type="number" value={c.score ?? 50} onChange={e => patch({ score: +e.target.value })} /></div>
            <div><Label className="text-xs">Score máximo</Label>
              <Input type="number" value={c.max_score ?? 100} onChange={e => patch({ max_score: +e.target.value })} /></div>
          </div>
          <Label>Níveis de Maturidade</Label>
          {levels.map((l, i) => (
            <div key={i} className="border border-border rounded-md p-2 space-y-2">
              <div className="flex gap-1">
                <Input value={l.name} placeholder="Nome do nível" onChange={e => updateLevel(i, { name: e.target.value })} className="font-bold text-xs" />
                <Input type="number" value={l.max} placeholder="Até %" className="w-20 text-xs" onChange={e => updateLevel(i, { max: +e.target.value })} />
                <Input type="color" value={l.color} className="w-10 p-0 h-9" onChange={e => updateLevel(i, { color: e.target.value })} />
                <Button size="icon" variant="ghost" onClick={() => patch({ levels: levels.filter((_, j) => j !== i) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Textarea rows={2} value={l.desc} placeholder="Descrição do nível" className="text-xs" onChange={e => updateLevel(i, { desc: e.target.value })} />
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => patch({ levels: [...levels, { name: "Novo Nível", desc: "", color: "#3b82f6", max: 100 }] })}>
            <Plus className="h-3.5 w-3.5 mr-1" />Adicionar nível
          </Button>
        </div>
      );
    }

    case "pricing_plans": {
      const plans = (c.plans ?? []) as any[];
      const updatePlan = (i: number, p: Record<string, any>) => {
        const n = [...plans]; n[i] = { ...n[i], ...p }; patch({ plans: n });
      };
      return (
        <div className="space-y-4">
          <Label>Planos</Label>
          {plans.map((p, i) => (
            <div key={i} className="border border-border rounded-md p-3 space-y-3 relative">
              <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => patch({ plans: plans.filter((_, j) => j !== i) })}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <div className="flex items-center gap-2 pt-2">
                <Switch checked={p.is_popular} onCheckedChange={v => updatePlan(i, { is_popular: v })} />
                <Label className="text-xs text-primary">Plano Destacado / Mais Popular</Label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Nome</Label>
                  <Input value={p.name} onChange={e => updatePlan(i, { name: e.target.value })} className="text-xs font-bold" /></div>
                <div><Label className="text-xs">Preço</Label>
                  <Input value={p.price} onChange={e => updatePlan(i, { price: e.target.value })} className="text-xs" /></div>
              </div>
              <div><Label className="text-xs">Benefícios (um por linha)</Label>
                <Textarea rows={3} value={(p.features ?? []).join("\n")} className="text-xs" onChange={e => updatePlan(i, { features: e.target.value.split("\n").filter(Boolean) })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Texto Botão</Label>
                  <Input value={p.button_text} onChange={e => updatePlan(i, { button_text: e.target.value })} className="text-xs" /></div>
                <div><Label className="text-xs">URL Botão</Label>
                  <Input value={p.button_url} onChange={e => updatePlan(i, { button_url: e.target.value })} className="text-xs" /></div>
              </div>
            </div>
          ))}
          <Button size="sm" variant="outline" className="w-full" onClick={() => patch({ plans: [...plans, { name: "Novo Plano", price: "0", features: ["Benefício 1"], is_popular: false, button_text: "Assinar", button_url: "" }] })}>
            <Plus className="h-3.5 w-3.5 mr-1" />Adicionar plano
          </Button>
        </div>
      );
    }

    case "post_result_form": {
      const fields = c.fields ?? {};
      const updateField = (k: string, v: boolean) => patch({ fields: { ...fields, [k]: v } });
      return (
        <div className="space-y-3">
          <div><Label className="text-xs">Título (Call to Action)</Label>
            <Input value={c.title ?? ""} onChange={e => patch({ title: e.target.value })} /></div>
          <div><Label className="text-xs">Texto do botão de envio</Label>
            <Input value={c.button_text ?? ""} onChange={e => patch({ button_text: e.target.value })} /></div>
          <Label className="mt-4 block">Campos do Formulário</Label>
          <div className="space-y-2 border border-border rounded-md p-3">
            <div className="flex items-center justify-between"><Label className="text-xs cursor-pointer" htmlFor="f_name">Nome</Label><Switch id="f_name" checked={!!fields.name} onCheckedChange={v => updateField("name", v)} /></div>
            <div className="flex items-center justify-between"><Label className="text-xs cursor-pointer" htmlFor="f_email">E-mail</Label><Switch id="f_email" checked={!!fields.email} onCheckedChange={v => updateField("email", v)} /></div>
            <div className="flex items-center justify-between"><Label className="text-xs cursor-pointer" htmlFor="f_phone">Telefone (WhatsApp)</Label><Switch id="f_phone" checked={!!fields.phone} onCheckedChange={v => updateField("phone", v)} /></div>
            <div className="flex items-center justify-between"><Label className="text-xs cursor-pointer" htmlFor="f_company">Empresa</Label><Switch id="f_company" checked={!!fields.company} onCheckedChange={v => updateField("company", v)} /></div>
          </div>
        </div>
      );
    }

    case "alert":
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Variante do Alerta</Label>
            <div className="flex gap-2 mt-1">
              <Button size="sm" variant={c.variant === "info" ? "default" : "outline"} onClick={() => patch({ variant: "info" })} className="flex-1 text-xs">Info</Button>
              <Button size="sm" variant={c.variant === "warning" ? "default" : "outline"} onClick={() => patch({ variant: "warning" })} className="flex-1 text-xs">Aviso</Button>
              <Button size="sm" variant={c.variant === "success" ? "default" : "outline"} onClick={() => patch({ variant: "success" })} className="flex-1 text-xs">Sucesso</Button>
              <Button size="sm" variant={c.variant === "error" ? "default" : "outline"} onClick={() => patch({ variant: "error" })} className="flex-1 text-xs">Erro</Button>
            </div>
          </div>
          <div><Label className="text-xs">Texto do Alerta</Label>
            <Textarea rows={3} value={c.text ?? ""} onChange={e => patch({ text: e.target.value })} className="text-xs" /></div>
        </div>
      );

    case "arguments": {
      const items = (c.items ?? []) as any[];
      return (
        <div className="space-y-4">
          <div><Label className="text-xs">Título Principal</Label>
            <Input value={c.title ?? ""} onChange={e => patch({ title: e.target.value })} /></div>
          <Label className="mt-4 block">Argumentos</Label>
          {items.map((it, i) => (
            <div key={i} className="border border-border rounded-md p-3 space-y-2 relative">
              <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => patch({ items: items.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></Button>
              <div><Label className="text-xs">Título Curto</Label>
                <Input value={it.title ?? ""} onChange={e => { const n = [...items]; n[i].title = e.target.value; patch({ items: n }); }} className="text-xs" /></div>
              <div><Label className="text-xs">Descrição (opcional)</Label>
                <Textarea rows={2} value={it.desc ?? ""} onChange={e => { const n = [...items]; n[i].desc = e.target.value; patch({ items: n }); }} className="text-xs" /></div>
            </div>
          ))}
          <Button size="sm" variant="outline" className="w-full" onClick={() => patch({ items: [...items, { title: "Novo Argumento", desc: "" }] })}>
            <Plus className="h-3.5 w-3.5 mr-1" />Adicionar Argumento
          </Button>
        </div>
      );
    }

    case "audio":
    case "video":
      return (
        <div className="space-y-3">
          {c.type === "audio" && (
            <div><Label className="text-xs">Título (opcional)</Label>
              <Input value={c.title ?? ""} onChange={e => patch({ title: e.target.value })} /></div>
          )}
          <div>
            <Label className="text-xs">URL do {c.type === "audio" ? "Áudio (MP3/WAV)" : "Vídeo (YouTube/Vimeo/MP4)"}</Label>
            <Input value={c.url ?? ""} onChange={e => patch({ url: e.target.value })} placeholder="https://..." />
          </div>
          <div className="text-xs text-muted-foreground">
            Dica: {c.type === "audio" ? "Cole um link direto para um arquivo de áudio." : "Para YouTube, use o link de 'Embed'."}
          </div>
        </div>
      );

    case "spacer":
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs cursor-pointer" htmlFor="f_line">Mostrar linha divisória</Label>
            <Switch id="f_line" checked={!!c.show_line} onCheckedChange={v => patch({ show_line: v })} />
          </div>
          <div><Label className="text-xs">Altura do espaço (pixels)</Label>
            <Input type="number" min={8} max={200} value={c.height ?? 32} onChange={e => patch({ height: Number(e.target.value) })} /></div>
        </div>
      );

    case "html":
      return (
        <div className="space-y-3">
          <div><Label className="text-xs">Código HTML / Embed</Label>
            <Textarea rows={4} value={c.code ?? ""} onChange={e => patch({ code: e.target.value })} className="text-xs font-mono" placeholder='<iframe src="..." />' /></div>
          <div className="text-[10px] text-muted-foreground leading-relaxed">
            Use este campo para adicionar vídeos via iframe (Vimeo com opções customizadas, Wistia, PandaVideo) ou qualquer outro script/embed fornecido por terceiros.
          </div>
        </div>
      );

    case "circular_progress":
      return (
        <div className="space-y-3">
          <div><Label className="text-xs">Porcentagem (0-100)</Label>
            <Input type="number" min={0} max={100} value={c.percentage ?? 85} onChange={e => patch({ percentage: Number(e.target.value) })} /></div>
          <div><Label className="text-xs">Título Principal</Label>
            <Input value={c.title ?? ""} onChange={e => patch({ title: e.target.value })} /></div>
          <div><Label className="text-xs">Subtítulo (Opcional)</Label>
            <Input value={c.subtitle ?? ""} onChange={e => patch({ subtitle: e.target.value })} /></div>
        </div>
      );

    case "fake_loading":
      return (
        <div className="space-y-3">
          <div><Label className="text-xs">Texto do Loading</Label>
            <Input value={c.text ?? ""} onChange={e => patch({ text: e.target.value })} /></div>
          <div><Label className="text-xs">Duração (segundos)</Label>
            <Input type="number" min={1} max={30} value={c.duration_seconds ?? 3} onChange={e => patch({ duration_seconds: Number(e.target.value) })} /></div>
        </div>
      );

    case "impact_summary":
      return (
        <div className="space-y-4">
          <div><Label className="text-xs">Padding Lateral (%)</Label>
            <Input type="number" value={c.padding_percentage ?? 0} onChange={e => patch({ padding_percentage: Number(e.target.value) })} /></div>
          <div className="space-y-3">
            <Label className="text-xs font-bold">Itens (Cards)</Label>
            {(c.items || [{}, {}, {}]).map((it: any, i: number) => (
              <div key={i} className="p-3 border rounded-lg space-y-2 bg-muted/30">
                <Input placeholder="Label (Ex: Excesso...)" value={it.label || ""} onChange={e => {
                  const items = [...(c.items || [{}, {}, {}])];
                  items[i] = { ...items[i], label: e.target.value };
                  patch({ items });
                }} />
                <Input placeholder="Valor (Ex: R$ 8.850)" value={it.value || ""} onChange={e => {
                  const items = [...(c.items || [{}, {}, {}])];
                  items[i] = { ...items[i], value: e.target.value };
                  patch({ items });
                }} />
                <div className="flex items-center gap-2">
                  <Label className="text-[10px]">Cor:</Label>
                  <input type="color" value={it.color || "#ffffff"} onChange={e => {
                    const items = [...(c.items || [{}, {}, {}])];
                    items[i] = { ...items[i], color: e.target.value };
                    patch({ items });
                  }} className="h-6 w-12 rounded border p-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    case "infinite_marquee":
      return (
        <div className="space-y-4">
          <div><Label className="text-xs">Itens (um por linha)</Label>
            <Textarea 
              className="text-xs" 
              value={(c.items || []).join("\n")} 
              onChange={e => patch({ items: e.target.value.split("\n").filter(Boolean) })} 
            /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Velocidade (seg)</Label>
              <Input type="number" value={c.speed ?? 25} onChange={e => patch({ speed: Number(e.target.value) })} /></div>
            <div><Label className="text-xs">Linhas (1 ou 2)</Label>
              <Select value={String(c.rows ?? 1)} onValueChange={v => patch({ rows: Number(v) })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Linha</SelectItem>
                  <SelectItem value="2">2 Linhas (Direções Opostas)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px]">Cor Fundo Box</Label>
              <div className="flex gap-2">
                <input type="color" value={c.box_bg_color || "#ffffff"} onChange={e => patch({ box_bg_color: e.target.value })} className="h-8 w-full rounded border p-0" />
                {c.box_bg_color && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => patch({ box_bg_color: undefined })}><Trash2 className="h-3 w-3" /></Button>}
              </div>
            </div>
            <div>
              <Label className="text-[10px]">Cor Texto Box</Label>
              <div className="flex gap-2">
                <input type="color" value={c.box_text_color || "#000000"} onChange={e => patch({ box_text_color: e.target.value })} className="h-8 w-full rounded border p-0" />
                {c.box_text_color && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => patch({ box_text_color: undefined })}><Trash2 className="h-3 w-3" /></Button>}
              </div>
            </div>
          </div>
        </div>
      );
    case "scroll_to_offer":
      return (
        <div className="space-y-3">
          <div><Label className="text-xs">Texto do Botão</Label>
            <Input value={c.label || ""} onChange={e => patch({ label: e.target.value })} /></div>
          <div><Label className="text-xs">Texto Auxiliar (Benefícios)</Label>
            <Input value={c.subtext || ""} onChange={e => patch({ subtext: e.target.value })} /></div>
        </div>
      );
    case "icon_info":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-1"><Label className="text-xs">Emoji</Label>
              <Input value={c.emoji || ""} onChange={e => patch({ emoji: e.target.value })} /></div>
            <div className="col-span-3"><Label className="text-xs">Título</Label>
              <Input value={c.title || ""} onChange={e => patch({ title: e.target.value })} /></div>
          </div>
          <div><Label className="text-xs">Descrição</Label>
            <Textarea className="text-xs" value={c.description || ""} onChange={e => patch({ description: e.target.value })} /></div>
          <AlignSelect value={c.align ?? "center"} onChange={v => patch({ align: v })} />
        </div>
      );
    default:
      return null;
  }
}

function AlignSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px]">Alinhamento</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="left">Esquerda</SelectItem>
          <SelectItem value="center">Centro</SelectItem>
          <SelectItem value="right">Direita</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
