import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ArrowLeft, ExternalLink, ImageUp, Loader2, Monitor, MousePointerClick, Save, Search, Smartphone } from "lucide-react";
import {
  buildLpPreview, imageFileToDataUrl, lpImages, lpLinkFields, lpTextFields, lpTextNodes,
  parseLp, serializeLp, setLpLink,
} from "@/lib/lp-html";

type Props = {
  id: string;
  publicPath: string;
  onClose: (changed: boolean) => void;
};

const LINK_LABELS: Record<string, string> = {
  CHECKOUT_URL: "Botões de compra (WhatsApp ou checkout)",
  INSTAGRAM_URL: "Instagram",
};

export function LpEditor({ id, publicPath, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [savedTitle, setSavedTitle] = useState("");
  const [html, setHtml] = useState("");
  const [savedHtml, setSavedHtml] = useState("");
  const [version, setVersion] = useState(0); // muda quando a estrutura do HTML muda (código, imagem)
  const [texts, setTexts] = useState<string[]>([]);
  const [tab, setTab] = useState("textos");
  const [query, setQuery] = useState("");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [mobilePane, setMobilePane] = useState<"editar" | "previa">("editar");
  const [preview, setPreview] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const [savedOnce, setSavedOnce] = useState(false);

  const docRef = useRef<Document | null>(null);
  const nodesRef = useRef<Text[]>([]);
  const padsRef = useRef<[string, string][]>([]); // espaços das pontas de cada texto, que separam o texto das tags vizinhas
  const scrollRef = useRef(0);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const serializeTimer = useRef<number>();

  const dirty = html !== savedHtml || title !== savedTitle;

  const loadDoc = useCallback((source: string) => {
    const doc = parseLp(source);
    docRef.current = doc;
    nodesRef.current = lpTextNodes(doc);
    padsRef.current = nodesRef.current.map(n => {
      const v = n.nodeValue ?? "";
      return [v.match(/^\s*/)![0], v.match(/\s*$/)![0]];
    });
    setTexts(nodesRef.current.map(n => (n.nodeValue ?? "").trim()));
    setVersion(v => v + 1);
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("figma_landing_pages").select("title, generated_html").eq("id", id).single();
      if (error || !data) {
        toast({ title: "Não foi possível abrir a LP", description: error?.message, variant: "destructive" });
        onClose(false);
        return;
      }
      const source = data.generated_html ?? "";
      setTitle(data.title); setSavedTitle(data.title);
      setHtml(source); setSavedHtml(source);
      loadDoc(source);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loadDoc]);

  // Edições de texto e link mexem no documento; o HTML é regerado logo depois
  const scheduleSerialize = useCallback(() => {
    window.clearTimeout(serializeTimer.current);
    serializeTimer.current = window.setTimeout(() => {
      if (docRef.current) setHtml(serializeLp(docRef.current));
    }, 250);
  }, []);

  useEffect(() => {
    if (!html) return;
    const t = window.setTimeout(() => setPreview(buildLpPreview(html, scrollRef.current)), 350);
    return () => window.clearTimeout(t);
  }, [html]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow || !e.data?.lpEditor) return;
      if (e.data.lpEditor === "scroll") scrollRef.current = e.data.y;
      if (e.data.lpEditor === "pick") {
        setTab("textos"); setQuery(""); setMobilePane("editar"); setPicked(e.data.i);
        requestAnimationFrame(() => {
          const el = document.getElementById(`lp-f-${e.data.i}`) as HTMLTextAreaElement | null;
          el?.scrollIntoView({ block: "center", behavior: "smooth" });
          el?.focus({ preventScroll: true });
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fields = useMemo(() => (docRef.current ? lpTextFields(nodesRef.current, docRef.current) : []), [version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const links = useMemo(() => (docRef.current ? lpLinkFields(docRef.current) : []), [version]);
  const images = useMemo(() => lpImages(html), [html]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? fields.filter(f => (texts[f.index] ?? "").toLowerCase().includes(q)) : fields;
    const groups: { section: string; items: typeof fields }[] = [];
    for (const f of list) {
      const last = groups[groups.length - 1];
      if (last && last.section === f.section) last.items.push(f);
      else groups.push({ section: f.section, items: [f] });
    }
    return groups;
  }, [fields, texts, query]);

  function editText(index: number, value: string) {
    const node = nodesRef.current[index];
    if (!node) return;
    const [lead, trail] = padsRef.current[index] ?? ["", ""];
    node.nodeValue = lead + value + trail;
    setTexts(prev => { const next = [...prev]; next[index] = value; return next; });
    scheduleSerialize();
  }

  const [linkValues, setLinkValues] = useState<Record<string, string>>({});
  useEffect(() => setLinkValues(Object.fromEntries(links.map(l => [l.name, l.value]))), [links]);

  function editLink(name: string, value: string) {
    if (!docRef.current) return;
    setLinkValues(prev => ({ ...prev, [name]: value }));
    setLpLink(docRef.current, name, value);
    scheduleSerialize();
  }

  async function replaceImage(oldSrc: string, file: File) {
    try {
      const next = await imageFileToDataUrl(file);
      const source = docRef.current ? serializeLp(docRef.current) : html;
      const updated = source.split(oldSrc).join(next);
      setHtml(updated);
      loadDoc(updated);
      toast({ title: "Imagem trocada", description: "Salve para publicar a mudança." });
    } catch {
      toast({ title: "Não foi possível ler a imagem", variant: "destructive" });
    }
  }

  function editCode(value: string) {
    window.clearTimeout(serializeTimer.current);
    setHtml(value);
  }

  async function save() {
    window.clearTimeout(serializeTimer.current);
    const finalHtml = tab === "codigo" || !docRef.current ? html : serializeLp(docRef.current);
    setSaving(true);
    const { error } = await supabase
      .from("figma_landing_pages").update({ generated_html: finalHtml, title: title.trim() || savedTitle }).eq("id", id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    setHtml(finalHtml); setSavedHtml(finalHtml); setSavedTitle(title.trim() || savedTitle);
    setSavedOnce(true);
    toast({ title: "LP salva", description: "As mudanças já estão no ar." });
  }

  function close() {
    if (dirty && !window.confirm("Existem alterações não salvas. Sair mesmo assim?")) return;
    onClose(savedOnce);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={close} aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="h-9 max-w-xs border-transparent bg-transparent px-2 font-display text-[15px] font-semibold hover:border-border focus-visible:border-border"
          aria-label="Nome da LP"
        />
        <span className={cn("hidden whitespace-nowrap text-xs sm:inline", dirty ? "text-warning" : "text-muted-foreground")}>
          {dirty ? "Alterações não salvas" : "Tudo salvo"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center rounded-md border border-border p-0.5 lg:flex">
            {(["desktop", "mobile"] as const).map(v => (
              <button
                key={v}
                onClick={() => setViewport(v)}
                className={cn("flex h-8 w-8 items-center justify-center rounded transition-colors",
                  viewport === v ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground")}
                aria-label={v === "desktop" ? "Prévia no computador" : "Prévia no celular"}
              >
                {v === "desktop" ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="hidden h-9 gap-1.5 sm:flex" onClick={() => window.open(publicPath, "_blank")}>
            <ExternalLink className="h-4 w-4" /> Ver no ar
          </Button>
          <Button size="sm" className="h-9 gap-1.5 active:scale-[0.97]" onClick={save} disabled={saving || loading || !dirty}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="flex shrink-0 gap-1 border-b border-border p-2 lg:hidden">
            {(["editar", "previa"] as const).map(p => (
              <button
                key={p}
                onClick={() => setMobilePane(p)}
                className={cn("h-9 flex-1 rounded-md text-sm font-medium transition-colors",
                  mobilePane === p ? "bg-foreground/10 text-foreground" : "text-muted-foreground")}
              >
                {p === "editar" ? "Editar" : "Prévia"}
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-1">
            <aside className={cn("min-h-0 w-full flex-col border-r border-border lg:flex lg:w-[400px] lg:shrink-0",
              mobilePane === "editar" ? "flex" : "hidden")}>
              <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
                <TabsList className="mx-3 mt-3 grid shrink-0 grid-cols-4">
                  <TabsTrigger value="textos">Textos</TabsTrigger>
                  <TabsTrigger value="links">Links</TabsTrigger>
                  <TabsTrigger value="imagens">Imagens</TabsTrigger>
                  <TabsTrigger value="codigo" onClick={() => docRef.current && setHtml(serializeLp(docRef.current))}>Código</TabsTrigger>
                </TabsList>

                <TabsContent value="textos" className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
                  <div className="shrink-0 space-y-2 p-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar texto" className="h-10 pl-9" />
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MousePointerClick className="h-3.5 w-3.5" /> Clique num texto da prévia para achar o campo.
                    </p>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
                    {visible.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nenhum texto encontrado.</p>}
                    {visible.map((g, gi) => (
                      <section key={gi} className="mb-4">
                        <p className="sticky top-0 z-10 bg-background py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          {g.section}
                        </p>
                        <div className="space-y-2">
                          {g.items.map(f => {
                            const value = texts[f.index] ?? "";
                            return (
                              <label key={f.index} className="block">
                                <span className="mb-1 block text-xs text-muted-foreground">{f.kind}</span>
                                <Textarea
                                  id={`lp-f-${f.index}`}
                                  value={value}
                                  rows={Math.min(6, Math.max(1, Math.ceil(value.length / 44)))}
                                  onChange={e => editText(f.index, e.target.value)}
                                  onFocus={() => setPicked(f.index)}
                                  className={cn("min-h-0 resize-none py-2 text-sm leading-relaxed transition-shadow",
                                    picked === f.index && "ring-2 ring-ring")}
                                />
                              </label>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="links" className="mt-0 min-h-0 flex-1 overflow-y-auto p-3 data-[state=inactive]:hidden">
                  {links.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">Esta LP não tem links configuráveis. Edite pela aba Código.</p>
                  ) : (
                    <div className="space-y-4">
                      {links.map(l => (
                        <label key={l.name} className="block">
                          <span className="mb-1 block text-sm font-medium">{LINK_LABELS[l.name] ?? l.name}</span>
                          <Input value={linkValues[l.name] ?? ""} onChange={e => editLink(l.name, e.target.value)} className="h-10 font-mono text-xs" />
                          {l.name === "CHECKOUT_URL" && (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              Para WhatsApp use https://wa.me/55DDDNUMERO?text= (a mensagem é completada pela página).
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="imagens" className="mt-0 min-h-0 flex-1 overflow-y-auto p-3 data-[state=inactive]:hidden">
                  {images.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma imagem encontrada.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {images.map((src, i) => (
                        <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
                          <div className="flex aspect-square items-center justify-center bg-foreground/5 p-2">
                            <img src={src} alt="" className="max-h-full max-w-full object-contain" />
                          </div>
                          <label className="flex h-10 cursor-pointer items-center justify-center gap-1.5 border-t border-border text-sm font-medium transition-colors hover:bg-foreground/5">
                            <ImageUp className="h-4 w-4" /> Trocar
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={e => { const f = e.target.files?.[0]; if (f) replaceImage(src, f); e.target.value = ""; }}
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="codigo" className="mt-0 flex min-h-0 flex-1 flex-col p-3 data-[state=inactive]:hidden">
                  <Textarea
                    value={html}
                    onChange={e => editCode(e.target.value)}
                    onBlur={() => loadDoc(html)}
                    spellCheck={false}
                    className="min-h-0 flex-1 resize-none font-mono text-[11px] leading-relaxed"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">{html.length.toLocaleString("pt-BR")} caracteres</p>
                </TabsContent>
              </Tabs>
            </aside>

            <main className={cn("min-h-0 flex-1 bg-foreground/5 lg:flex lg:items-stretch lg:justify-center",
              mobilePane === "previa" ? "flex" : "hidden")}>
              <iframe
                ref={frameRef}
                title="Prévia da LP"
                srcDoc={preview}
                sandbox="allow-scripts"
                className={cn("h-full border-0 bg-background",
                  viewport === "mobile" ? "w-full lg:my-4 lg:h-[calc(100%-2rem)] lg:w-[390px] lg:rounded-2xl lg:border lg:border-border" : "w-full")}
              />
            </main>
          </div>
        </>
      )}
    </div>
  );
}
