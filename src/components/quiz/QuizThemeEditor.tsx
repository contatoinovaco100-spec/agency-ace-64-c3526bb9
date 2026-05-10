import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuizEditorStore } from "@/stores/quizEditorStore";
import { QuizMediaUploader } from "./QuizMediaUploader";
import { GOOGLE_FONTS, FONT_WEIGHTS } from "@/lib/quizTheme";

export function QuizThemeEditor() {
  const { meta, updateTheme, updateMeta } = useQuizEditorStore();
  if (!meta) return null;
  const t = meta.theme;
  const cid = meta.client_id;

  return (
    <div className="space-y-5">
      <Section title="Identidade visual">
        <QuizMediaUploader label="Logo" value={t.logo_url} onChange={v => updateTheme({ logo_url: v })} clientId={cid} />
        <QuizMediaUploader label="Capa (tela inicial)" value={t.cover_image_url} onChange={v => updateTheme({ cover_image_url: v })} clientId={cid} />
        <QuizMediaUploader label="Imagem de fundo" value={t.background_image_url} onChange={v => updateTheme({ background_image_url: v })} clientId={cid} />
        <Toggle label="Mostrar logo no topo" checked={t.show_logo} onChange={v => updateTheme({ show_logo: v })} />
      </Section>

      <Section title="Cores">
        <ColorRow label="Primária" value={t.primary_color} onChange={v => updateTheme({ primary_color: v })} />
        <ColorRow label="Fundo" value={t.background_color} onChange={v => updateTheme({ background_color: v })} />
        <ColorRow label="Card" value={t.card_background} onChange={v => updateTheme({ card_background: v })} />
        <ColorRow label="Texto" value={t.text_color} onChange={v => updateTheme({ text_color: v })} />
        <ColorRow label="Texto do botão" value={t.button_text_color} onChange={v => updateTheme({ button_text_color: v })} />
      </Section>

      <Section title="Tipografia">
        <div>
          <Label className="text-xs">Família da fonte</Label>
          <Select value={t.font_family} onValueChange={v => updateTheme({ font_family: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {GOOGLE_FONTS.map(f => <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <WeightSelect label="Peso título" value={t.heading_weight} onChange={v => updateTheme({ heading_weight: v })} />
          <WeightSelect label="Peso corpo" value={t.body_weight} onChange={v => updateTheme({ body_weight: v })} />
        </div>
      </Section>

      <Section title="Estilo dos botões">
        <div>
          <Label className="text-xs">Formato</Label>
          <Select value={t.button_style} onValueChange={(v: any) => updateTheme({ button_style: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rounded">Arredondado</SelectItem>
              <SelectItem value="pill">Pílula</SelectItem>
              <SelectItem value="square">Quadrado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Border radius — {t.border_radius}px</Label>
          <Slider value={[t.border_radius]} min={0} max={24} step={1} onValueChange={([v]) => updateTheme({ border_radius: v })} />
        </div>
        <div>
          <Label className="text-xs">Animação</Label>
          <Select value={t.animation} onValueChange={(v: any) => updateTheme({ animation: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fade">Fade</SelectItem>
              <SelectItem value="slide">Slide</SelectItem>
              <SelectItem value="none">Nenhuma</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Section>

      <Section title="Comportamento">
        <Toggle label="Mostrar barra de progresso" checked={meta.progress_bar} onChange={v => updateMeta({ progress_bar: v })} />
        <Toggle label="Numerar perguntas" checked={meta.show_question_numbers} onChange={v => updateMeta({ show_question_numbers: v })} />
      </Section>

      <Section title="Tela de resultado">
        <QuizMediaUploader label="Imagem do resultado" value={meta.result_image_url} onChange={v => updateMeta({ result_image_url: v })} clientId={cid} />
        <div>
          <Label className="text-xs">Redirecionar para (URL — opcional)</Label>
          <Input value={meta.redirect_url} onChange={e => updateMeta({ redirect_url: e.target.value })} placeholder="https://..." />
        </div>
        <div>
          <Label className="text-xs">Atraso do redirecionamento (segundos)</Label>
          <Input type="number" min={0} value={meta.redirect_delay_seconds}
            onChange={e => updateMeta({ redirect_delay_seconds: Number(e.target.value) || 0 })} />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">{title}</div>
      <div className="space-y-3 pl-1">{children}</div>
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-xs flex-1">{label}</div>
      <input type="color" value={value} onChange={e => onChange(e.target.value)} className="h-8 w-10 rounded border border-border bg-transparent cursor-pointer" />
      <Input value={value} onChange={e => onChange(e.target.value)} className="w-24 text-xs font-mono" />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function WeightSelect({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={String(value)} onValueChange={v => onChange(Number(v))}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {FONT_WEIGHTS.map(w => <SelectItem key={w} value={String(w)}>{w}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
