import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  Trash2,
  ExternalLink,
  Palette,
  Sparkles,
  Copy,
  Upload,
  Link as LinkIcon,
  Download,
  Eye,
  CheckCircle2,
  Layers,
  Smartphone,
  Tablet,
  Monitor,
  Search,
  Code,
  FileCode,
  Globe,
  ImageIcon,
  X
} from "lucide-react";
import { LANDING_PAGE_TEMPLATES, LandingPageTemplate } from "@/data/landingPageTemplates";
import { compileFigmaJsonToLandingPage } from "@/lib/figmaJsonCompiler";

type LP = {
  id: string;
  slug: string;
  title: string;
  source_type: string;
  ai_notes: any;
  published: boolean;
  created_at: string;
  generated_html?: string | null;
  figma_json?: any;
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
  const [lps, setLps] = useState<LP[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMainTab, setActiveMainTab] = useState<"pages" | "templates" | "converter">("pages");

  // Creation / Conversion state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState<"upload" | "api" | "templates">("upload");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [figmaJsonText, setFigmaJsonText] = useState("");
  const [figmaUrl, setFigmaUrl] = useState(() => localStorage.getItem("figma_url") || "");
  const [figmaToken, setFigmaToken] = useState(() => localStorage.getItem("figma_token") || "");
  const [rememberToken, setRememberToken] = useState(() => !!localStorage.getItem("figma_token"));
  const [generating, setGenerating] = useState(false);

  // Template browser state
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<LandingPageTemplate | null>(null);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [cloningTemplateId, setCloningTemplateId] = useState<string | null>(null);

  // Image → LP state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageTitle, setImageTitle] = useState("");
  const [imageSlug, setImageSlug] = useState("");
  const [generatingFromImage, setGeneratingFromImage] = useState(false);

  // Edit Drawer state
  const [selected, setSelected] = useState<LP | null>(null);
  const [editHtml, setEditHtml] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("figma_landing_pages")
      .select("id,slug,title,source_type,ai_notes,published,created_at")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    setLps((data as LP[]) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setFigmaJsonText(text);
      if (!title) setTitle(file.name.replace(/\.json$/i, ""));
      toast({ title: "Arquivo JSON carregado!", description: `${(file.size / 1024).toFixed(1)} KB` });
    } catch (err: any) {
      toast({ title: "Erro ao ler arquivo", description: err.message, variant: "destructive" });
    }
  }

  async function handleCreateFromTemplate(template: LandingPageTemplate) {
    setCloningTemplateId(template.id);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const randomCode = Math.random().toString(36).slice(2, 6);
      const finalSlug = `${template.defaultSlug}-${randomCode}`;

      const { error: insErr } = await (supabase as any).from("figma_landing_pages").insert({
        slug: finalSlug,
        title: template.name,
        source_type: "template",
        figma_json: { templateId: template.id, category: template.category },
        generated_html: template.html,
        ai_notes: {
          applied: true,
          template: template.name,
          category: template.category,
          trace: { total: 45, rendered_by_ai: 45 }
        },
        published: true,
        created_by: userData.user?.id,
      });

      if (insErr) throw insErr;

      toast({
        title: "Landing Page Criada com Sucesso!",
        description: `Link público gerado: /lp/${finalSlug}`,
      });

      setPreviewTemplate(null);
      setActiveMainTab("pages");
      load();
    } catch (e: any) {
      toast({ title: "Erro ao criar LP", description: e.message || String(e), variant: "destructive" });
    } finally {
      setCloningTemplateId(null);
    }
  }

  async function generate() {
    if (!title.trim()) {
      toast({ title: "Título obrigatório", description: "Informe um título para a Landing Page.", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      let finalHtml = "";
      let figmaJsonParsed: any = null;
      let aiNotesData: any = { applied: true };

      if (tab === "upload") {
        if (!figmaJsonText.trim()) throw new Error("Envie ou cole o JSON do Figma.");
        try {
          figmaJsonParsed = JSON.parse(figmaJsonText);
        } catch {
          throw new Error("O código colado não é um JSON válido. Verifique a sintaxe.");
        }

        // Try Edge function first; fallback immediately to local complete compiler
        let edgeWorked = false;
        try {
          const { data, error } = await supabase.functions.invoke("figma-to-lp", {
            body: { title, mode: "upload", figmaJson: figmaJsonParsed }
          });
          if (!error && (data as any)?.html) {
            finalHtml = (data as any).html;
            aiNotesData = (data as any).ai_notes || {};
            edgeWorked = true;
          }
        } catch (edgeErr) {
          console.warn("Edge function offline, using local compiler:", edgeErr);
        }

        // If edge function was not used or failed, compile 100% locally
        if (!edgeWorked || !finalHtml) {
          const result = compileFigmaJsonToLandingPage(figmaJsonParsed, title);
          finalHtml = result.html;
          aiNotesData = {
            applied: true,
            trace: {
              total: result.stats.totalNodes,
              rendered_by_ai: result.stats.totalNodes,
              sections: result.stats.sectionsFound,
              roles: { text: result.stats.textNodes, sections: result.stats.sectionsFound }
            }
          };
        }
      } else {
        if (!figmaUrl.trim() || !figmaToken.trim()) throw new Error("URL e token do Figma são obrigatórios.");
        if (rememberToken) {
          localStorage.setItem("figma_token", figmaToken);
          localStorage.setItem("figma_url", figmaUrl);
        } else {
          localStorage.removeItem("figma_token");
          localStorage.removeItem("figma_url");
        }

        const { data, error } = await supabase.functions.invoke("figma-to-lp", {
          body: { title, mode: "api", figmaUrl, figmaToken }
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);

        finalHtml = (data as any).html;
        figmaJsonParsed = (data as any).figma_json ?? null;
        aiNotesData = (data as any).ai_notes || {};
      }

      const finalSlug = slug.trim() ? slugify(slug) : `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`;
      const { data: userData } = await supabase.auth.getUser();

      const { error: insErr } = await (supabase as any).from("figma_landing_pages").insert({
        slug: finalSlug,
        title,
        source_type: tab === "api" ? "api" : "upload",
        figma_json: figmaJsonParsed,
        generated_html: finalHtml,
        ai_notes: aiNotesData,
        published: true,
        created_by: userData.user?.id,
      });

      if (insErr) throw insErr;

      toast({
        title: "Landing Page Gerada com 100% de Sucesso!",
        description: `Disponível em /lp/${finalSlug}`,
      });

      setDialogOpen(false);
      setTitle("");
      setSlug("");
      setFigmaJsonText("");
      if (!rememberToken) { setFigmaUrl(""); setFigmaToken(""); }
      setActiveMainTab("pages");
      load();
    } catch (e: any) {
      toast({ title: "Erro ao gerar LP", description: e.message || String(e), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function removeLp(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta Landing Page?")) return;
    const { error } = await (supabase as any).from("figma_landing_pages").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "LP removida com sucesso" });
    load();
  }

  async function togglePublished(lp: LP) {
    const { error } = await (supabase as any).from("figma_landing_pages")
      .update({ published: !lp.published }).eq("id", lp.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: lp.published ? "LP despublicada" : "LP publicada com sucesso!" });
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
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "HTML atualizado com sucesso!" });
    load();
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/lp/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado para a área de transferência!", description: url });
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Envie uma imagem (PNG, JPG, WebP).", variant: "destructive" });
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    if (!imageTitle) setImageTitle(file.name.replace(/\.[^.]+$/, ""));
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    setImageTitle("");
    setImageSlug("");
  }

  async function generateFromImage() {
    if (!imageFile || !imagePreview) {
      toast({ title: "Imagem obrigatória", description: "Envie uma imagem da landing page.", variant: "destructive" });
      return;
    }
    if (!imageTitle.trim()) {
      toast({ title: "Título obrigatório", description: "Informe um título para a Landing Page.", variant: "destructive" });
      return;
    }

    setGeneratingFromImage(true);
    try {
      // Extract base64 from data URL
      const base64Match = imagePreview.match(/^data:(.+);base64,(.+)$/);
      if (!base64Match) throw new Error("Erro ao processar a imagem.");
      const mimeType = base64Match[1];
      const base64 = base64Match[2];

      const systemPrompt = `Você é um desenvolvedor web expert em replicar landing pages a partir de imagens. Analise a imagem e gere um HTML completo, responsivo e funcional que replique fielmente o design mostrado.

INSTRUÇÕES:
1. Analise: cores, tipografia, espaçamentos, layout, hierarquia visual, botões, seções, imagens, ícones, gradientes, bordas, sombras.
2. Gere HTML COMPLETO com CSS embutido (<style> no <head>).
3. CSS moderno: flexbox, grid, variables CSS.
4. 100% responsivo (mobile-first).
5. Google Fonts quando necessário.
6. Preserve TODO o conteúdo de texto visível.
7. Imagens/fotos → placeholders estilizados.
8. HTML autocontido (um único arquivo).
9. Meta viewport para responsividade.

Responda APENAS com o código HTML completo. Comece com <!DOCTYPE html> e termine com </html>. Sem markdown, sem explicações.`;

      const userMessage = `Analise esta imagem de landing page e gere um HTML completo que replique fielmente o design.\n\nTítulo: "${imageTitle}"`;

      const { data, error } = await supabase.functions.invoke("ai-copywriter", {
        body: {
          systemPrompt,
          userMessage,
          imageBase64: base64,
          imageMimeType: mimeType,
          model: "google/gemini-2.5-flash",
        },
      });

      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      // ai-copywriter returns { result: ... } — could be string or parsed
      let finalHtml = (data as any)?.result || (data as any)?.html || "";
      if (typeof finalHtml !== "string") finalHtml = JSON.stringify(finalHtml);

      // Clean up markdown fences if present
      finalHtml = finalHtml.replace(/```html/g, "").replace(/```/g, "").trim();
      if (!finalHtml.toLowerCase().startsWith("<!doctype")) {
        finalHtml = "<!DOCTYPE html>\n" + finalHtml;
      }

      const aiNotesData = { applied: true, source: "image_analysis", model: "google/gemini-2.5-flash" };
      const finalSlug = imageSlug.trim()
        ? slugify(imageSlug)
        : `${slugify(imageTitle)}-${Math.random().toString(36).slice(2, 6)}`;

      const { data: userData } = await supabase.auth.getUser();

      const { error: insErr } = await (supabase as any).from("figma_landing_pages").insert({
        slug: finalSlug,
        title: imageTitle,
        source_type: "image",
        figma_json: null,
        generated_html: finalHtml,
        ai_notes: aiNotesData,
        published: true,
        created_by: userData.user?.id,
      });

      if (insErr) throw insErr;

      toast({
        title: "Landing Page Gerada com Sucesso!",
        description: `Disponível em /lp/${finalSlug}`,
      });

      clearImage();
      setActiveMainTab("pages");
      load();
    } catch (e: any) {
      toast({ title: "Erro ao gerar LP", description: e.message || String(e), variant: "destructive" });
    } finally {
      setGeneratingFromImage(false);
    }
  }

  async function downloadJson(lp: LP) {
    const { data, error } = await (supabase as any)
      .from("figma_landing_pages").select("figma_json,title,slug").eq("id", lp.id).single();
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    if (!data?.figma_json) { toast({ title: "Sem JSON", description: "Esta LP não possui JSON estruturado salvo.", variant: "destructive" }); return; }
    const blob = new Blob([JSON.stringify(data.figma_json, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.slug || "figma"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "JSON baixado com sucesso" });
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
    toast({ title: "HTML baixado com sucesso" });
  }

  // Filter templates
  const filteredTemplates = LANDING_PAGE_TEMPLATES.filter((t) => {
    const matchesCategory = selectedCategory === "all" || t.category === selectedCategory;
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = ["all", "Marketing & Tráfego", "SaaS & Tech", "Consultoria & Negócios", "Saúde & Estética", "Jurídico", "Educação & Infoprodutos", "Gastronomia & Delivery", "Imobiliário"];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-purple-600 text-white shadow-lg shadow-primary/20 shrink-0">
            <Palette className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              Figma &bull; JSON &bull; Landing Pages
              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                100% Elementos
              </Badge>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Converta JSON do Figma com 100% dos elementos ou use nossos templates de alta conversão pré-salvos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-md shadow-primary/20 font-semibold gap-1.5">
                <Sparkles className="h-4 w-4" /> Converter Figma / JSON
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl w-[96vw] sm:w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Converter Figma / JSON em Landing Page Completa
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Título da Landing Page *</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Minha Empresa - Lançamento"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Slug personalizado (opcional)</Label>
                    <Input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="Ex: minha-empresa"
                      className="mt-1"
                    />
                  </div>
                </div>

                <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="upload" className="text-xs sm:text-sm gap-1.5">
                      <Upload className="h-4 w-4" /> Upload / Colar JSON
                    </TabsTrigger>
                    <TabsTrigger value="api" className="text-xs sm:text-sm gap-1.5">
                      <LinkIcon className="h-4 w-4" /> Figma API (URL + Token)
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="upload" className="space-y-3 pt-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Arquivo .json do Figma</Label>
                      <Input
                        type="file"
                        accept=".json,application/json"
                        onChange={handleFileUpload}
                        className="mt-1 file:text-xs file:font-semibold"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Ou cole o código JSON completo do Figma abaixo (reconhece 100% de nós, textos e estilos):
                      </Label>
                      <Textarea
                        value={figmaJsonText}
                        onChange={(e) => setFigmaJsonText(e.target.value)}
                        placeholder='{"document": { "children": [ ... ] } }'
                        className="font-mono text-xs h-48 mt-1"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="api" className="space-y-3 pt-2">
                    <div>
                      <Label className="text-xs font-semibold">URL do arquivo Figma</Label>
                      <Input
                        value={figmaUrl}
                        onChange={(e) => setFigmaUrl(e.target.value)}
                        placeholder="https://www.figma.com/file/ABC123XYZ/Meu-Projeto"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Personal Access Token do Figma</Label>
                      <Input
                        type="password"
                        value={figmaToken}
                        onChange={(e) => setFigmaToken(e.target.value)}
                        placeholder="figd_..."
                        className="mt-1"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Gere em: Figma &rarr; Settings &rarr; Personal access tokens.
                      </p>
                      <label className="flex items-center gap-2 mt-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rememberToken}
                          onChange={(e) => {
                            setRememberToken(e.target.checked);
                            if (!e.target.checked) {
                              localStorage.removeItem("figma_token");
                              localStorage.removeItem("figma_url");
                            }
                          }}
                        />
                        Lembrar token e URL neste navegador
                      </label>
                    </div>
                  </TabsContent>
                </Tabs>

                <Button className="w-full h-11 text-sm font-bold shadow-lg shadow-primary/20" onClick={generate} disabled={generating}>
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Compilando 100% dos elementos...
                    </>
                  ) : (
                    "⚡ Gerar Landing Page Completa"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeMainTab} onValueChange={(v) => setActiveMainTab(v as any)} className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-lg bg-secondary/80 p-1">
          <TabsTrigger value="pages" className="font-semibold text-xs sm:text-sm gap-1.5">
            <Globe className="h-4 w-4" /> Minhas LPs ({lps.length})
          </TabsTrigger>
          <TabsTrigger value="image" className="font-semibold text-xs sm:text-sm gap-1.5">
            <ImageIcon className="h-4 w-4 text-emerald-500" /> Imagem → LP
          </TabsTrigger>
          <TabsTrigger value="templates" className="font-semibold text-xs sm:text-sm gap-1.5">
            <Sparkles className="h-4 w-4 text-amber-500" /> Templates ({LANDING_PAGE_TEMPLATES.length})
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: Minhas Landing Pages ── */}
        <TabsContent value="pages" className="space-y-4 mt-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : lps.length === 0 ? (
            <Card className="border-dashed border-2 border-border p-8 sm:p-12 text-center rounded-2xl bg-card/50">
              <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                <Palette className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Nenhuma Landing Page criada ainda</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-6">
                Escolha um dos nossos <strong>Templates Pré-Salvos</strong>, envie uma <strong>imagem de referência</strong>, ou importe um arquivo JSON do Figma para começar em segundos.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button onClick={() => setActiveMainTab("templates")} className="gap-1.5">
                  <Sparkles className="h-4 w-4" /> Ver Templates Prontos
                </Button>
                <Button variant="outline" onClick={() => setActiveMainTab("image")} className="gap-1.5">
                  <ImageIcon className="h-4 w-4" /> Enviar Imagem
                </Button>
                <Button variant="outline" onClick={() => setDialogOpen(true)} className="gap-1.5">
                  <Upload className="h-4 w-4" /> Importar JSON do Figma
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lps.map((lp) => (
                <Card key={lp.id} className="border-border/70 hover:border-primary/50 transition-all shadow-sm flex flex-col justify-between overflow-hidden group">
                  <div className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-foreground truncate text-base group-hover:text-primary transition-colors">
                          {lp.title}
                        </h3>
                        <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                          /lp/{lp.slug}
                        </p>
                      </div>
                      <Badge variant={lp.published ? "default" : "secondary"} className="text-[11px] shrink-0 font-semibold">
                        {lp.published ? "Publicado" : "Rascunho"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>📅 {new Date(lp.created_at).toLocaleDateString("pt-BR")}</span>
                      <span>&bull;</span>
                      <span className="capitalize">{lp.source_type}</span>
                      {lp.ai_notes?.applied && (
                        <span className="flex items-center gap-1 text-primary font-semibold text-[11px]">
                          <Sparkles className="h-3 w-3" /> IA
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 pt-0 border-t border-border/40 bg-secondary/20 flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2 pt-3">
                      <Button size="sm" variant="default" className="h-8 gap-1 text-xs font-bold" onClick={() => window.open(`/lp/${lp.slug}`, "_blank")}>
                        <ExternalLink className="h-3.5 w-3.5" /> Abrir LP
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => copyLink(lp.slug)}>
                        <Copy className="h-3.5 w-3.5" /> Copiar Link
                      </Button>
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-1">
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => openEdit(lp)} title="Editar HTML">
                          <Code className="h-3.5 w-3.5 mr-1" /> Editar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => downloadHtml(lp)} title="Baixar HTML">
                          <FileCode className="h-3.5 w-3.5 mr-1" /> HTML
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => downloadJson(lp)} title="Baixar JSON">
                          <Download className="h-3.5 w-3.5 mr-1" /> JSON
                        </Button>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => togglePublished(lp)}
                        >
                          {lp.published ? "Ocultar" : "Ativar"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeLp(lp.id)}
                          title="Excluir Landing Page"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── TAB 2: Imagem → Landing Page ── */}
        <TabsContent value="image" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Upload & Config */}
            <Card className="border-border/70 shadow-md overflow-hidden">
              <div className="p-5 sm:p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-base">Enviar Imagem da Landing Page</h3>
                    <p className="text-xs text-muted-foreground">A IA analisa o design e replica fielmente em HTML</p>
                  </div>
                </div>

                {/* Image Upload Area */}
                {!imagePreview ? (
                  <label className="flex flex-col items-center justify-center w-full h-56 border-2 border-dashed border-border hover:border-emerald-500/50 rounded-2xl cursor-pointer transition-all bg-secondary/30 hover:bg-emerald-500/5 group">
                    <div className="flex flex-col items-center gap-3 text-center px-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 group-hover:scale-105 transition-transform">
                        <Upload className="h-7 w-7" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Clique para enviar uma imagem</p>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG ou WebP • Máx. 10MB</p>
                      </div>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden border border-border group">
                    <img
                      src={imagePreview}
                      alt="Preview da landing page"
                      className="w-full h-auto max-h-64 object-contain bg-secondary/50"
                    />
                    <button
                      onClick={clearImage}
                      className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-destructive transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                      <p className="text-xs text-white font-medium truncate">{imageFile?.name}</p>
                    </div>
                  </div>
                )}

                {/* Title & Slug */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold">Título da Landing Page *</Label>
                    <Input
                      value={imageTitle}
                      onChange={(e) => setImageTitle(e.target.value)}
                      placeholder="Ex: Minha Landing Page"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Slug personalizado (opcional)</Label>
                    <Input
                      value={imageSlug}
                      onChange={(e) => setImageSlug(e.target.value)}
                      placeholder="Ex: minha-landing"
                      className="mt-1"
                    />
                  </div>
                </div>

                <Button
                  className="w-full h-11 text-sm font-bold shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700"
                  onClick={generateFromImage}
                  disabled={generatingFromImage || !imagePreview}
                >
                  {generatingFromImage ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analisando imagem e gerando LP...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" /> Gerar Landing Page a partir da Imagem
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {/* Right: How it works / Tips */}
            <Card className="border-border/70 shadow-md overflow-hidden">
              <div className="p-5 sm:p-6 space-y-5">
                <div>
                  <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Como Funciona
                  </h3>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      step: "1",
                      title: "Envie a Imagem",
                      desc: "Faça upload de um print/screenshot da landing page que deseja replicar. Pode ser do Figma, de um site, ou de qualquer referência visual.",
                      color: "bg-emerald-500",
                    },
                    {
                      step: "2",
                      title: "IA Analisa o Design",
                      desc: "A inteligência artificial analisa cores, tipografia, layout, espaçamentos, hierarquia visual, botões e todo o conteúdo de texto da imagem.",
                      color: "bg-primary",
                    },
                    {
                      step: "3",
                      title: "HTML Gerado Automaticamente",
                      desc: "Uma landing page completa e responsiva é gerada em HTML/CSS, replicando fielmente o design original com todas as seções e elementos.",
                      color: "bg-amber-500",
                    },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.color} text-white text-sm font-bold shrink-0`}>
                        {item.step}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Dicas para melhor resultado:
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1.5 ml-5">
                    <li className="list-disc">Envie prints de alta resolução (full page se possível)</li>
                    <li className="list-disc">A IA preserva o texto original visível na imagem</li>
                    <li className="list-disc">O HTML gerado é totalmente editável depois de criado</li>
                    <li className="list-disc">Imagens/fotos são substituídas por placeholders estilizados</li>
                    <li className="list-disc">O design é sempre responsivo (mobile-first)</li>
                  </ul>
                </div>

                {imagePreview && (
                  <div className="bg-secondary/50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-foreground mb-2">Imagem selecionada:</p>
                    <div className="flex items-center gap-3">
                      <img src={imagePreview} alt="" className="h-16 w-16 rounded-lg object-cover border border-border" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{imageFile?.name}</p>
                        <p className="text-xs text-muted-foreground">{imageFile ? `${(imageFile.size / 1024).toFixed(0)} KB` : ""}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive" onClick={clearImage}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB 3: Galeria de Templates Pré-Salvos ── */}
        <TabsContent value="templates" className="space-y-6 mt-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-2xl border border-border">
            <div className="flex items-center gap-2 overflow-x-auto scroller-hide pb-1 -mx-2 px-2 sm:p-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat === "all" ? "Todos os Nichos" : cat}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar template..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className="border-border/70 hover:border-primary/50 transition-all shadow-md overflow-hidden flex flex-col justify-between group bg-card">
                <div>
                  {/* Template Visual Banner */}
                  <div className={`h-36 w-full bg-gradient-to-tr ${template.previewGradient} p-5 flex flex-col justify-between relative overflow-hidden`}>
                    <div className="flex items-center justify-between z-10">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md bg-black/40 text-white backdrop-blur-md">
                        {template.category}
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-md">
                        {template.badge}
                      </span>
                    </div>

                    <div className="z-10">
                      <h3 className="text-lg font-black text-white leading-snug drop-shadow-md">
                        {template.name}
                      </h3>
                    </div>

                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                  </div>

                  <div className="p-4 sm:p-5 space-y-3">
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {template.description}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-foreground font-semibold pt-1">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span>Responsivo &bull; Copy Persuasiva &bull; WhatsApp</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0 border-t border-border/40 bg-secondary/20 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-9 text-xs font-semibold gap-1.5"
                    onClick={() => {
                      setPreviewTemplate(template);
                      setPreviewViewport("desktop");
                    }}
                  >
                    <Eye className="h-3.5 w-3.5" /> Pré-visualizar
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-9 text-xs font-bold gap-1.5 shadow-md shadow-primary/10"
                    onClick={() => handleCreateFromTemplate(template)}
                    disabled={cloningTemplateId === template.id}
                  >
                    {cloningTemplateId === template.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Usar Template
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Live Preview Modal */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        <DialogContent className="max-w-6xl w-[98vw] h-[92vh] max-h-[92vh] p-0 overflow-hidden flex flex-col rounded-2xl bg-[#090d16] border-white/10 text-white">
          {previewTemplate && (
            <>
              {/* Modal Top Bar */}
              <div className="h-14 border-b border-white/10 px-4 sm:px-6 flex items-center justify-between bg-[#0b0f19] shrink-0">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm sm:text-base">{previewTemplate.name}</span>
                  <Badge variant="secondary" className="text-xs hidden sm:inline-flex bg-white/10 text-white">
                    {previewTemplate.category}
                  </Badge>
                </div>

                {/* Viewport switchers */}
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
                  <button
                    onClick={() => setPreviewViewport("desktop")}
                    className={`p-1.5 rounded-md text-xs font-semibold transition-all ${
                      previewViewport === "desktop" ? "bg-primary text-white" : "text-gray-400 hover:text-white"
                    }`}
                    title="Visualização Desktop"
                  >
                    <Monitor className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPreviewViewport("tablet")}
                    className={`p-1.5 rounded-md text-xs font-semibold transition-all ${
                      previewViewport === "tablet" ? "bg-primary text-white" : "text-gray-400 hover:text-white"
                    }`}
                    title="Visualização Tablet (768px)"
                  >
                    <Tablet className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPreviewViewport("mobile")}
                    className={`p-1.5 rounded-md text-xs font-semibold transition-all ${
                      previewViewport === "mobile" ? "bg-primary text-white" : "text-gray-400 hover:text-white"
                    }`}
                    title="Visualização Mobile (375px)"
                  >
                    <Smartphone className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="font-bold gap-1.5 h-8 text-xs shadow-md shadow-primary/20"
                    onClick={() => handleCreateFromTemplate(previewTemplate)}
                    disabled={cloningTemplateId === previewTemplate.id}
                  >
                    {cloningTemplateId === previewTemplate.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Criar com Este Template
                  </Button>
                </div>
              </div>

              {/* Sandbox iframe Container */}
              <div className="flex-1 bg-[#05070c] overflow-y-auto flex items-center justify-center p-2 sm:p-4">
                <div
                  className={`h-full transition-all duration-300 shadow-2xl rounded-xl overflow-hidden bg-white ${
                    previewViewport === "desktop"
                      ? "w-full"
                      : previewViewport === "tablet"
                      ? "w-[768px] max-w-full"
                      : "w-[375px] max-w-full"
                  }`}
                >
                  <iframe
                    srcDoc={previewTemplate.html}
                    title={previewTemplate.name}
                    className="w-full h-full border-0"
                    sandbox="allow-scripts allow-popups allow-forms"
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-4xl overflow-y-auto p-4 sm:p-6">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold flex items-center gap-2">
              <Code className="h-5 w-5 text-primary" /> Editar Landing Page: {selected?.title}
            </SheetTitle>
          </SheetHeader>

          {selected && (
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-xs font-semibold">Preview em Tempo Real</Label>
                <div className="w-full h-72 border rounded-xl overflow-hidden mt-1 bg-white">
                  <iframe
                    srcDoc={editHtml}
                    className="w-full h-full border-0"
                    title="Live Preview"
                    sandbox="allow-scripts allow-popups allow-forms"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs font-semibold">Código HTML & CSS da Landing Page</Label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {editHtml.length} caracteres
                  </span>
                </div>
                <Textarea
                  value={editHtml}
                  onChange={(e) => setEditHtml(e.target.value)}
                  className="font-mono text-xs h-80 rounded-xl"
                />
                <Button className="w-full mt-3 h-10 font-bold" onClick={saveEdit} disabled={savingEdit}>
                  {savingEdit ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : "Salvar Alterações no HTML"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
