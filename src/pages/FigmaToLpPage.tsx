import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { Loader2, Trash2, ExternalLink, Palette, Sparkles, Copy, Upload, Link as LinkIcon, Download } from "lucide-react";

type LP = {
  id: string;
  slug: string;
  title: string;
  source_type: string;
  ai_notes: any;
  published: boolean;
  created_at: string;
  generated_html?: string | null;
};

function slugify(s: string) {
  return (s || "lp")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "lp";
}

export default function FigmaToLpPage() {
  const navigate = useNavigate();
  const [lps, setLps] = useState<LP[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<LP | null>(null);

  // form state
  const [tab, setTab] = useState<"upload" | "api">("upload");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [figmaJsonText, setFigmaJsonText] = useState("");
  const [figmaUrl, setFigmaUrl] = useState(() => localStorage.getItem("figma_url") || "");
  const [figmaToken, setFigmaToken] = useState(() => localStorage.getItem("figma_token") || "");
  const [rememberToken, setRememberToken] = useState(() => !!localStorage.getItem("figma_token"));
  const [generating, setGenerating] = useState(false);

  const [editHtml, setEditHtml] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("figma_landing_pages")
      .select("id,slug,title,source_type,ai_notes,published,created_at")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    setLps((data as LP[]) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setFigmaJsonText(text);
    if (!title) setTitle(file.name.replace(/\.json$/i, ""));
  }

  async function generate() {
    if (!title.trim()) {
      toast({ title: "Título obrigatório", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      let payload: any = { title };
      if (tab === "upload") {
        if (!figmaJsonText.trim()) throw new Error("Envie o JSON do Figma");
        let json;
        try { json = JSON.parse(figmaJsonText); }
        catch { throw new Error("JSON inválido"); }
        payload = { ...payload, mode: "upload", figmaJson: json };
      } else {
        if (!figmaUrl.trim() || !figmaToken.trim()) throw new Error("URL e token são obrigatórios");
        if (rememberToken) {
          localStorage.setItem("figma_token", figmaToken);
          localStorage.setItem("figma_url", figmaUrl);
        } else {
          localStorage.removeItem("figma_token");
          localStorage.removeItem("figma_url");
        }
        payload = { ...payload, mode: "api", figmaUrl, figmaToken };
      }

      const { data, error } = await supabase.functions.invoke("figma-to-lp", { body: payload });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const finalSlug = slug.trim() ? slugify(slug) : `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`;
      const { data: userData } = await supabase.auth.getUser();

      const { error: insErr } = await (supabase as any).from("figma_landing_pages").insert({
        slug: finalSlug,
        title,
        source_type: tab === "api" ? "api" : "upload",
        figma_json: tab === "upload" ? JSON.parse(figmaJsonText) : ((data as any).figma_json ?? null),
        generated_html: (data as any).html,
        ai_notes: (data as any).ai_notes || {},
        created_by: userData.user?.id,
      });
      if (insErr) throw insErr;

      if (insErr) throw insErr;

      const trace = (data as any).ai_notes?.trace;
      const traceMsg = trace ? ` (${trace.total} elementos rastreados)` : "";
      toast({ title: "Landing page criada!", description: `/lp/${finalSlug}${traceMsg}` });
      setDialogOpen(false);
      setTitle(""); setSlug(""); setFigmaJsonText("");
      if (!rememberToken) { setFigmaUrl(""); setFigmaToken(""); }
      load();
    } catch (e: any) {
      toast({ title: "Erro ao gerar", description: e.message || String(e), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function removeLp(id: string) {
    if (!confirm("Excluir esta LP?")) return;
    const { error } = await (supabase as any).from("figma_landing_pages").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "LP removida" });
    load();
  }

  async function togglePublished(lp: LP) {
    const { error } = await (supabase as any).from("figma_landing_pages")
      .update({ published: !lp.published }).eq("id", lp.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    load();
  }

  async function openEdit(lp: LP) {
    const { data, error } = await (supabase as any)
      .from("figma_landing_pages").select("*").eq("id", lp.id).single();
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setSelected(data as LP);
    setEditHtml((data as any).generated_html || "");
  }

  async function saveEdit() {
    if (!selected) return;
    setSavingEdit(true);
    const { error } = await (supabase as any).from("figma_landing_pages")
      .update({ generated_html: editHtml }).eq("id", selected.id);
    setSavingEdit(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "HTML salvo" });
    load();
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/lp/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado", description: url });
  }

  async function downloadJson(lp: LP) {
    const { data, error } = await (supabase as any)
      .from("figma_landing_pages").select("figma_json,title,slug").eq("id", lp.id).single();
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    if (!data?.figma_json) { toast({ title: "Sem JSON", description: "Esta LP não tem JSON do Figma salvo (importada via API sem cache).", variant: "destructive" }); return; }
    const blob = new Blob([JSON.stringify(data.figma_json, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.slug || "figma"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "JSON baixado" });
  }

  async function downloadHtml(lp: LP) {
    const { data, error } = await (supabase as any)
      .from("figma_landing_pages").select("generated_html,slug").eq("id", lp.id).single();
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    if (!data?.generated_html) { toast({ title: "Sem HTML", variant: "destructive" }); return; }
    const blob = new Blob([data.generated_html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.slug || "lp"}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "HTML baixado" });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Palette className="h-6 w-6 text-primary" /> Figma → Landing Page
          </h1>
          <p className="text-sm text-muted-foreground">
            Envie um JSON exportado do Figma ou cole o link do arquivo. A IA gera uma LP responsiva.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Sparkles className="h-4 w-4 mr-2" /> Nova LP</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Criar nova landing page</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Título</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Minha LP" />
                </div>
                <div>
                  <Label>Slug (opcional)</Label>
                  <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto" />
                </div>
              </div>

              <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="upload"><Upload className="h-4 w-4 mr-2" />Upload JSON</TabsTrigger>
                  <TabsTrigger value="api"><LinkIcon className="h-4 w-4 mr-2" />Link + Token</TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="space-y-3">
                  <Label>Arquivo JSON do Figma</Label>
                  <Input type="file" accept=".json,application/json" onChange={handleFileUpload} />
                  <p className="text-xs text-muted-foreground">
                    Exporte via plugin "Figma to JSON" ou API. Cole abaixo se preferir:
                  </p>
                  <Textarea
                    value={figmaJsonText}
                    onChange={(e) => setFigmaJsonText(e.target.value)}
                    placeholder='{"document": {...}}'
                    className="font-mono text-xs h-40"
                  />
                </TabsContent>

                <TabsContent value="api" className="space-y-3">
                  <div>
                    <Label>URL do arquivo Figma</Label>
                    <Input
                      value={figmaUrl}
                      onChange={(e) => setFigmaUrl(e.target.value)}
                      placeholder="https://www.figma.com/file/ABC123/..."
                    />
                  </div>
                  <div>
                    <Label>Personal Access Token</Label>
                    <Input
                      type="password"
                      value={figmaToken}
                      onChange={(e) => setFigmaToken(e.target.value)}
                      placeholder="figd_..."
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Gere em Figma → Settings → Personal access tokens. O token não é armazenado.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              <Button className="w-full" onClick={generate} disabled={generating}>
                {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando com IA...</> : "Gerar Landing Page"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : lps.length === 0 ? (
        <Card className="p-12 text-center">
          <Palette className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhuma LP criada ainda. Clique em "Nova LP" para começar.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lps.map((lp) => (
            <Card key={lp.id} className="p-4 space-y-3">
              <div>
                <h3 className="font-semibold truncate">{lp.title}</h3>
                <p className="text-xs text-muted-foreground">/lp/{lp.slug}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(lp.created_at).toLocaleDateString("pt-BR")} · {lp.source_type}
                  {lp.ai_notes?.applied && <span className="ml-2 text-primary">✨ IA</span>}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => window.open(`/lp/${lp.slug}`, "_blank")}>
                  <ExternalLink className="h-3 w-3 mr-1" /> Abrir
                </Button>
                <Button size="sm" variant="outline" onClick={() => copyLink(lp.slug)}>
                  <Copy className="h-3 w-3 mr-1" /> Link
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(lp)}>Editar</Button>
                <Button size="sm" variant="outline" onClick={() => downloadJson(lp)}>
                  <Download className="h-3 w-3 mr-1" /> JSON
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadHtml(lp)}>
                  <Download className="h-3 w-3 mr-1" /> HTML
                </Button>
                <Button size="sm" variant="outline" onClick={() => togglePublished(lp)}>
                  {lp.published ? "Despublicar" : "Publicar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => removeLp(lp.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
          <SheetHeader><SheetTitle>{selected?.title}</SheetTitle></SheetHeader>
          {selected && (
            <div className="space-y-4 mt-4">
              <div>
                <Label>Preview</Label>
                <iframe
                  src={`/lp/${selected.slug}`}
                  className="w-full h-96 border rounded"
                  title="preview"
                />
              </div>

              {selected.ai_notes?.trace && (
                <div className="p-3 bg-muted rounded space-y-1">
                  <Label>Rastreio de elementos</Label>
                  <p className="text-sm">
                    <strong>{selected.ai_notes.trace.total}</strong> elementos detectados
                    {selected.ai_notes.trace.rendered_by_ai && (
                      <span> · <strong>{selected.ai_notes.trace.rendered_by_ai}</strong> reproduzidos pela IA</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1 text-xs">
                    {Object.entries(selected.ai_notes.trace.roles || {}).map(([role, count]) => (
                      <span key={role} className="px-2 py-0.5 bg-background rounded border">
                        {role}: {count as number}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selected.ai_notes?.suggestions?.length > 0 && (
                <div>
                  <Label>Sugestões da IA</Label>
                  <ul className="list-disc pl-5 text-sm space-y-1 mt-1">
                    {selected.ai_notes.suggestions.map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <Label>HTML da LP (edite se quiser)</Label>
                <Textarea
                  value={editHtml}
                  onChange={(e) => setEditHtml(e.target.value)}
                  className="font-mono text-xs h-96"
                />
                <Button className="mt-2" onClick={saveEdit} disabled={savingEdit}>
                  {savingEdit ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar HTML
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
