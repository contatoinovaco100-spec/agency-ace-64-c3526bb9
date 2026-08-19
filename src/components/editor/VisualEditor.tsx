import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { getIframeInjectScript } from "./iframe-inject";
import {
  X,
  Save,
  Smartphone,
  Tablet,
  Monitor,
  Type,
  Palette,
  Box,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  Columns2,
  Rows3,
  Minus,
  Undo2,
  Redo2,
  Copy,
  Layers,
} from "lucide-react";

type SelectedElement = {
  path: number[];
  tag: string;
  text: string;
  styles: Record<string, string>;
  inlineStyles: string;
  classes: string;
};

type VisualEditorProps = {
  html: string;
  onSave: (html: string) => void;
  onClose: () => void;
};

function rgbToHex(rgb: string): string {
  if (!rgb || rgb === "transparent" || rgb.includes("rgba(0, 0, 0, 0)")) return "#000000";
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return "#000000";
  return `#${[m[1], m[2], m[3]].map(x => parseInt(x).toString(16).padStart(2, "0")).join("")}`;
}

function cssToRgb(c: string): string {
  if (!c || c === "transparent" || c === "rgba(0, 0, 0, 0)") return "rgba(0,0,0,0)";
  if (c.startsWith("#")) {
    const hex = c.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r},${g},${b},1)`;
  }
  return c;
}

function parseCssValue(v: string): { top: string; right: string; bottom: string; left: string } {
  const parts = v.split(" ").map(s => s.trim());
  if (parts.length === 1) return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
  if (parts.length === 2) return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
  if (parts.length === 3) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
  return { top: parts[0] || "0", right: parts[1] || "0", bottom: parts[2] || "0", left: parts[3] || "0" };
}

function buildCssValue(t: string, r: string, b: string, l: string): string {
  if (t === r && r === b && b === l) return t;
  if (t === b && r === l) return `${t} ${r}`;
  return `${t} ${r} ${b} ${l}`;
}

export function VisualEditor({ html, onSave, onClose }: VisualEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [history, setHistory] = useState<string[]>([html]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [showElements, setShowElements] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [activePropertyTab, setActivePropertyTab] = useState<"style" | "typography" | "spacing">("style");
  const currentHtml = history[historyIdx] || html;

  const pushHistory = useCallback((newHtml: string) => {
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIdx + 1);
      const next = [...trimmed, newHtml];
      if (next.length > 50) next.shift();
      return next;
    });
    setHistoryIdx(prev => Math.min(prev + 1, 49));
  }, [historyIdx]);

  const undo = useCallback(() => {
    if (historyIdx > 0) {
      const newIdx = historyIdx - 1;
      setHistoryIdx(newIdx);
      sendToCanvas({ type: "canvas:update-html", html: history[newIdx] });
    }
  }, [historyIdx, history]);

  const redo = useCallback(() => {
    if (historyIdx < history.length - 1) {
      const newIdx = historyIdx + 1;
      setHistoryIdx(newIdx);
      sendToCanvas({ type: "canvas:update-html", html: history[newIdx] });
    }
  }, [historyIdx, history]);

  const sendToCanvas = useCallback((msg: any) => {
    iframeRef.current?.contentWindow?.postMessage(msg, "*");
  }, []);

  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;
    const doc = iframe.contentDocument;
    const script = doc.createElement("script");
    script.textContent = getIframeInjectScript();
    doc.body.appendChild(script);
    sendToCanvas({ type: "canvas:set-html", html: currentHtml });
  }, [currentHtml, sendToCanvas]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const msg = e.data;
      if (!msg?.type) return;

      if (msg.type === "element:select") {
        setSelected({
          path: msg.path,
          tag: msg.tag,
          text: msg.text,
          styles: msg.styles || {},
          inlineStyles: msg.inlineStyles || "",
          classes: msg.classes || "",
        });
        setShowProperties(true);
      }

      if (msg.type === "element:text-update") {
        const newHtml = updateHtmlAtPath(currentHtml, msg.path, msg.text);
        pushHistory(newHtml);
        sendToCanvas({ type: "canvas:set-html", html: newHtml });
      }

      if (msg.type === "element:reorder") {
        const newHtml = reorderHtml(currentHtml, msg.srcPath, msg.tgtPath, msg.position);
        pushHistory(newHtml);
        sendToCanvas({ type: "canvas:set-html", html: newHtml });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [currentHtml, pushHistory, sendToCanvas]);

  function applyStyle(prop: string, value: string) {
    if (!selected) return;
    const newHtml = updateHtmlStyle(currentHtml, selected.path, prop, value);
    pushHistory(newHtml);
    sendToCanvas({ type: "canvas:set-html", html: newHtml });
  }

  function applyMultipleStyles(styles: Record<string, string>) {
    if (!selected) return;
    let newHtml = currentHtml;
    for (const [prop, value] of Object.entries(styles)) {
      newHtml = updateHtmlStyle(newHtml, selected.path, prop, value);
    }
    pushHistory(newHtml);
    sendToCanvas({ type: "canvas:set-html", html: newHtml });
  }

  function deleteElement() {
    if (!selected) return;
    const newHtml = removeHtmlAtPath(currentHtml, selected.path);
    pushHistory(newHtml);
    sendToCanvas({ type: "canvas:set-html", html: newHtml });
    setSelected(null);
  }

  function moveElement(direction: "up" | "down") {
    if (!selected) return;
    const parentPath = selected.path.slice(0, -1);
    const idx = selected.path[selected.path.length - 1];
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0) return;
    const newHtml = reorderHtml(currentHtml, selected.path, [...parentPath, newIdx], direction === "up" ? "before" : "after");
    pushHistory(newHtml);
    sendToCanvas({ type: "canvas:set-html", html: newHtml });
    setSelected({ ...selected, path: [...parentPath, newIdx] });
  }

  function duplicateElement() {
    if (!selected) return;
    const newHtml = duplicateHtmlAtPath(currentHtml, selected.path);
    pushHistory(newHtml);
    sendToCanvas({ type: "canvas:set-html", html: newHtml });
  }

  function insertElement(type: string) {
    const newHtml = insertHtmlElement(currentHtml, selected?.path || [], type);
    pushHistory(newHtml);
    sendToCanvas({ type: "canvas:set-html", html: newHtml });
  }

  const viewportWidths = { desktop: "100%", tablet: "768px", mobile: "375px" };
  const styleProps = selected?.styles || {};

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1a1a2e]">
      {/* Top Toolbar */}
      <div className="h-14 border-b border-white/10 px-4 flex items-center justify-between bg-[#16162a] shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Editor Visual
          </h2>
          {selected && (
            <Badge variant="secondary" className="text-xs bg-white/10 text-white border-white/10">
              {selected.tag}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-white" onClick={undo} disabled={historyIdx <= 0} title="Desfazer">
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-white" onClick={redo} disabled={historyIdx >= history.length - 1} title="Refazer">
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6 bg-white/10" />

          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
            {(["desktop", "tablet", "mobile"] as const).map(v => (
              <button key={v} onClick={() => setViewport(v)}
                className={`p-1.5 rounded-md transition-all ${viewport === v ? "bg-primary text-white" : "text-gray-400 hover:text-white"}`}
                title={v === "desktop" ? "Desktop" : v === "tablet" ? "Tablet (768px)" : "Mobile (375px)"}>
                {v === "desktop" ? <Monitor className="h-4 w-4" /> : v === "tablet" ? <Tablet className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
              </button>
            ))}
          </div>

          <Separator orientation="vertical" className="h-6 bg-white/10" />

          <Button size="sm" variant="ghost" className="h-8 text-xs text-gray-400 hover:text-white gap-1.5" onClick={() => setShowElements(!showElements)}>
            <Plus className="h-3.5 w-3.5" /> Elementos
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs text-gray-400 hover:text-white gap-1.5" onClick={() => setShowProperties(!showProperties)}>
            <Palette className="h-3.5 w-3.5" /> Propriedades
          </Button>

          <Separator orientation="vertical" className="h-6 bg-white/10" />

          <Button size="sm" className="h-8 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => onSave(currentHtml)}>
            <Save className="h-3.5 w-3.5" /> Salvar
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-white" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Elements Panel */}
        {showElements && (
          <div className="w-56 border-r border-white/10 bg-[#16162a] flex flex-col shrink-0">
            <div className="p-3 border-b border-white/10">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Adicionar Elemento</h3>
            </div>
            <ScrollArea className="flex-1 p-2">
              <div className="space-y-1">
                {[
                  { icon: Heading1, label: "Título H1", type: "h1", desc: "Título principal" },
                  { icon: Heading2, label: "Título H2", type: "h2", desc: "Subtítulo" },
                  { icon: Heading3, label: "Título H3", type: "h3", desc: "Seção" },
                  { icon: Type, label: "Parágrafo", type: "p", desc: "Texto corrido" },
                  { icon: AlignLeft, label: "Texto Pequeno", type: "small", desc: "Caption / detalhe" },
                  { icon: Box, label: "Botão", type: "button", desc: "Call to action" },
                  { icon: Minus, label: "Divisor", type: "hr", desc: "Linha horizontal" },
                  { icon: Rows3, label: "Seção", type: "section", desc: "Container de bloco" },
                  { icon: Columns2, label: "Colunas (2)", type: "columns", desc: "Grid de 2 colunas" },
                ].map(item => (
                  <button key={item.type} onClick={() => insertElement(item.type)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left hover:bg-white/5 transition-colors group">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 group-hover:bg-primary/20 text-gray-400 group-hover:text-primary shrink-0 transition-colors">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white">{item.label}</p>
                      <p className="text-[10px] text-gray-500">{item.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Center: Canvas */}
        <div className="flex-1 bg-[#0f0f1e] flex items-start justify-center overflow-auto p-4">
          <div className={`bg-white shadow-2xl rounded-lg overflow-hidden transition-all duration-300 ${
            viewport === "desktop" ? "w-full" : viewport === "tablet" ? "w-[768px]" : "w-[375px]"
          }`} style={{ minHeight: "calc(100vh - 120px)" }}>
            <iframe ref={iframeRef} onLoad={handleIframeLoad}
              className="w-full h-full border-0" style={{ minHeight: "calc(100vh - 120px)" }}
              sandbox="allow-scripts allow-same-origin" title="Canvas do Editor" />
          </div>
        </div>

        {/* Right: Properties Panel */}
        {showProperties && (
          <div className="w-72 border-l border-white/10 bg-[#16162a] flex flex-col shrink-0">
            {selected ? (
              <>
                <div className="p-3 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-primary/30 font-mono">
                      {selected.tag}
                    </Badge>
                    <span className="text-[11px] text-gray-500 truncate max-w-[140px]">{selected.text || "(vazio)"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-400 hover:text-white" onClick={duplicateElement} title="Duplicar">
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-400 hover:text-white" onClick={() => moveElement("up")} title="Mover acima">
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-400 hover:text-white" onClick={() => moveElement("down")} title="Mover abaixo">
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-400 hover:text-red-400" onClick={deleteElement} title="Excluir">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="flex border-b border-white/10">
                  {(["style", "typography", "spacing"] as const).map(tab => (
                    <button key={tab} onClick={() => setActivePropertyTab(tab)}
                      className={`flex-1 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                        activePropertyTab === tab ? "text-primary border-b-2 border-primary" : "text-gray-500 hover:text-gray-300"
                      }`}>
                      {tab === "style" ? "Estilo" : tab === "typography" ? "Tipografia" : "Espaçamento"}
                    </button>
                  ))}
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-4">
                    {activePropertyTab === "style" && (
                      <>
                        <PropGroup title="Cores">
                          <ColorProp label="Cor do Texto" value={rgbToHex(styleProps.color || "#000000")}
                            onChange={v => applyStyle("color", cssToRgb(v))} />
                          <ColorProp label="Fundo" value={rgbToHex(styleProps.backgroundColor || "#ffffff")}
                            onChange={v => applyStyle("background-color", cssToRgb(v))} />
                        </PropGroup>
                        <PropGroup title="Borda">
                          <RadiusProp value={styleProps.borderRadius || "0px"}
                            onChange={v => applyStyle("border-radius", v)} />
                        </PropGroup>
                        <PropGroup title="Dimensões">
                          <CssBoxProp label="Largura" prop="width" value={styleProps.width || ""}
                            onChange={v => applyStyle("width", v)} />
                          <CssBoxProp label="Altura" prop="height" value={styleProps.height || ""}
                            onChange={v => applyStyle("height", v)} />
                        </PropGroup>
                        <PropGroup title="Fundo Avançado">
                          <CssBoxProp label="Imagem" prop="background-image" value={styleProps.backgroundImage || ""}
                            onChange={v => applyStyle("background-image", v)} placeholder="url(...) ou gradient(...)" />
                        </PropGroup>
                      </>
                    )}

                    {activePropertyTab === "typography" && (
                      <>
                        <PropGroup title="Fonte">
                          <FontProp value={styleProps.fontFamily || ""}
                            onChange={v => applyStyle("font-family", v)} />
                          <SizeProp label="Tamanho" value={styleProps.fontSize || "16px"}
                            onChange={v => applyStyle("font-size", v)} min={8} max={96} />
                          <WeightProp value={styleProps.fontWeight || "400"}
                            onChange={v => applyStyle("font-weight", v)} />
                        </PropGroup>
                        <PropGroup title="Alinhamento">
                          <AlignProp value={styleProps.textAlign || "left"}
                            onChange={v => applyStyle("text-align", v)} />
                        </PropGroup>
                        <PropGroup title="Espaçamento de Texto">
                          <CssBoxProp label="Linha" prop="line-height" value={styleProps.lineHeight || ""}
                            onChange={v => applyStyle("line-height", v)} placeholder="1.5" />
                          <CssBoxProp label="Letra" prop="letter-spacing" value={styleProps.letterSpacing || ""}
                            onChange={v => applyStyle("letter-spacing", v)} placeholder="0.05em" />
                        </PropGroup>
                      </>
                    )}

                    {activePropertyTab === "spacing" && (
                      <>
                        <PropGroup title="Margem">
                          <CssBoxProp label="Cima" prop="margin-top" value={parseCssValue(styleProps.margin || "0px").top}
                            onChange={v => { const p = parseCssValue(styleProps.margin || "0px"); applyStyle("margin", buildCssValue(v, p.right, p.bottom, p.left)); }} placeholder="0px" />
                          <CssBoxProp label="Direita" prop="margin-right" value={parseCssValue(styleProps.margin || "0px").right}
                            onChange={v => { const p = parseCssValue(styleProps.margin || "0px"); applyStyle("margin", buildCssValue(p.top, v, p.bottom, p.left)); }} placeholder="0px" />
                          <CssBoxProp label="Baixo" prop="margin-bottom" value={parseCssValue(styleProps.margin || "0px").bottom}
                            onChange={v => { const p = parseCssValue(styleProps.margin || "0px"); applyStyle("margin", buildCssValue(p.top, p.right, v, p.left)); }} placeholder="0px" />
                          <CssBoxProp label="Esquerda" prop="margin-left" value={parseCssValue(styleProps.margin || "0px").left}
                            onChange={v => { const p = parseCssValue(styleProps.margin || "0px"); applyStyle("margin", buildCssValue(p.top, p.right, p.bottom, v)); }} placeholder="0px" />
                        </PropGroup>
                        <PropGroup title="Preenchimento">
                          <CssBoxProp label="Cima" prop="padding-top" value={parseCssValue(styleProps.padding || "0px").top}
                            onChange={v => { const p = parseCssValue(styleProps.padding || "0px"); applyStyle("padding", buildCssValue(v, p.right, p.bottom, p.left)); }} placeholder="0px" />
                          <CssBoxProp label="Direita" prop="padding-right" value={parseCssValue(styleProps.padding || "0px").right}
                            onChange={v => { const p = parseCssValue(styleProps.padding || "0px"); applyStyle("padding", buildCssValue(p.top, v, p.bottom, p.left)); }} placeholder="0px" />
                          <CssBoxProp label="Baixo" prop="padding-bottom" value={parseCssValue(styleProps.padding || "0px").bottom}
                            onChange={v => { const p = parseCssValue(styleProps.padding || "0px"); applyStyle("padding", buildCssValue(p.top, p.right, v, p.left)); }} placeholder="0px" />
                          <CssBoxProp label="Esquerda" prop="padding-left" value={parseCssValue(styleProps.padding || "0px").left}
                            onChange={v => { const p = parseCssValue(styleProps.padding || "0px"); applyStyle("padding", buildCssValue(p.top, p.right, p.bottom, v)); }} placeholder="0px" />
                        </PropGroup>
                        <PropGroup title="Gap">
                          <CssBoxProp label="Gap" prop="gap" value={styleProps.gap || ""}
                            onChange={v => applyStyle("gap", v)} placeholder="16px" />
                        </PropGroup>
                      </>
                    )}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-gray-600 mb-4">
                  <CursorIcon />
                </div>
                <p className="text-sm font-semibold text-white">Nenhum elemento selecionado</p>
                <p className="text-xs text-gray-500 mt-1">Clique em qualquer elemento no canvas para editá-lo</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CursorIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /><path d="M13 13l6 6" />
    </svg>
  );
}

function PropGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between mb-2 group">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-white transition-colors">{title}</span>
        {open ? <ChevronDown className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />}
      </button>
      {open && <div className="space-y-2.5">{children}</div>}
    </div>
  );
}

function ColorProp({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-gray-400">{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="w-7 h-7 rounded-md border border-white/10 cursor-pointer bg-transparent" />
        <Input value={value} onChange={e => onChange(e.target.value)}
          className="w-20 h-7 text-[11px] font-mono bg-white/5 border-white/10 text-white" />
      </div>
    </div>
  );
}

function RadiusProp({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-gray-400">Borda Arredondada</Label>
      <Input value={value} onChange={e => onChange(e.target.value)}
        className="w-24 h-7 text-[11px] font-mono bg-white/5 border-white/10 text-white" placeholder="8px" />
    </div>
  );
}

function CssBoxProp({ label, value, onChange, placeholder }: { label: string; prop?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-gray-400">{label}</Label>
      <Input value={value} onChange={e => onChange(e.target.value)}
        className="w-24 h-7 text-[11px] font-mono bg-white/5 border-white/10 text-white" placeholder={placeholder || "0px"} />
    </div>
  );
}

function FontProp({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const fonts = ["Inter", "Roboto", "Open Sans", "Montserrat", "Poppins", "Raleway", "Playfair Display", "Lato", "Nunito", "Source Sans Pro", "Work Sans", "DM Sans", "Outfit", "Plus Jakarta Sans", "Manrope", "Sora", "Space Grotesk", "system-ui", "Arial", "Georgia", "serif"];
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-gray-400">Família</Label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full h-7 text-[11px] bg-white/5 border border-white/10 text-white rounded-md px-2">
        <option value="">Padrão</option>
        {fonts.map(f => <option key={f} value={`${f}, sans-serif`}>{f}</option>)}
      </select>
    </div>
  );
}

function SizeProp({ label, value, onChange, min = 8, max = 96 }: { label: string; value: string; onChange: (v: string) => void; min?: number; max?: number }) {
  const num = parseInt(value) || 16;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-gray-400">{label}</Label>
        <span className="text-[11px] text-primary font-mono">{value}</span>
      </div>
      <div className="flex items-center gap-2">
        <input type="range" min={min} max={max} value={num}
          onChange={e => onChange(`${e.target.value}px`)}
          className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary" />
        <Input value={value} onChange={e => onChange(e.target.value)}
          className="w-16 h-7 text-[11px] font-mono bg-white/5 border-white/10 text-white text-center" />
      </div>
    </div>
  );
}

function WeightProp({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const weights = [
    { label: "Fino", value: "300" }, { label: "Normal", value: "400" },
    { label: "Médio", value: "500" }, { label: "Negrito", value: "600" },
    { label: "Bold", value: "700" }, { label: "Extra Bold", value: "800" },
  ];
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-gray-400">Peso</Label>
      <div className="grid grid-cols-3 gap-1">
        {weights.map(w => (
          <button key={w.value} onClick={() => onChange(w.value)}
            className={`px-2 py-1.5 rounded text-[10px] font-semibold transition-all ${
              value === w.value ? "bg-primary text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}>
            {w.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AlignProp({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {(["left", "center", "right", "justify"] as const).map(a => (
        <button key={a} onClick={() => onChange(a)}
          className={`flex items-center justify-center py-1.5 rounded text-[10px] transition-all ${
            value === a ? "bg-primary text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
          }`} title={a}>
          {a === "left" && <AlignLeftIcon />}
          {a === "center" && <AlignCenterIcon />}
          {a === "right" && <AlignRightIcon />}
          {a === "justify" && <AlignJustifyIcon />}
        </button>
      ))}
    </div>
  );
}

function AlignLeftIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" /></svg>;
}
function AlignCenterIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="10" x2="6" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="18" y1="18" x2="6" y2="18" /></svg>;
}
function AlignRightIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="10" x2="7" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="21" y1="18" x2="7" y2="18" /></svg>;
}
function AlignJustifyIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="21" y1="18" x2="3" y2="18" /></svg>;
}

function updateHtmlAtPath(html: string, path: number[], innerHtml: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  let el: Element | null = div;
  for (const idx of path) {
    if (!el?.children[idx]) return html;
    el = el.children[idx];
  }
  if (el) el.innerHTML = innerHtml;
  return div.innerHTML;
}

function removeHtmlAtPath(html: string, path: number[]): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  let el: Element | null = div;
  for (let i = 0; i < path.length - 1; i++) {
    if (!el?.children[path[i]]) return html;
    el = el.children[path[i]];
  }
  if (el && el.children[path[path.length - 1]]) {
    el.children[path[path.length - 1]].remove();
  }
  return div.innerHTML;
}

function duplicateHtmlAtPath(html: string, path: number[]): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  let el: Element | null = div;
  for (const idx of path) {
    if (!el?.children[idx]) return html;
    el = el.children[idx];
  }
  if (el?.parentElement) {
    const clone = el.cloneNode(true);
    el.parentElement.insertBefore(clone, el.nextSibling);
  }
  return div.innerHTML;
}

function updateHtmlStyle(html: string, path: number[], prop: string, value: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  let el: Element | null = div;
  for (const idx of path) {
    if (!el?.children[idx]) return html;
    el = el.children[idx];
  }
  if (!el) return html;
  const currentStyle = el.getAttribute("style") || "";
  const regex = new RegExp(`(?:^|;\\s*)${prop.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\s*:\\s*[^;]*`, "i");
  let newStyle: string;
  if (value === "" || value === "unset" || value === "initial") {
    newStyle = currentStyle.replace(regex, "").trim();
    if (newStyle) newStyle = newStyle.replace(/^;\s*/, "");
  } else {
    if (regex.test(currentStyle)) {
      newStyle = currentStyle.replace(regex, `${prop}: ${value}`).trim();
    } else {
      newStyle = currentStyle ? `${currentStyle}; ${prop}: ${value}` : `${prop}: ${value}`;
    }
  }
  if (newStyle) el.setAttribute("style", newStyle);
  else el.removeAttribute("style");
  return div.innerHTML;
}

function reorderHtml(html: string, srcPath: number[], tgtPath: number[], position: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  function findEl(path: number[]): Element | null {
    let el: Element | null = div;
    for (const idx of path) {
      if (!el?.children[idx]) return null;
      el = el.children[idx];
    }
    return el;
  }
  const srcEl = findEl(srcPath);
  const tgtEl = findEl(tgtPath);
  if (!srcEl || !tgtEl || srcEl === tgtEl) return html;
  srcEl.remove();
  if (position === "before") tgtEl.parentElement?.insertBefore(srcEl, tgtEl);
  else tgtEl.parentElement?.insertBefore(srcEl, tgtEl.nextSibling);
  return div.innerHTML;
}

function insertHtmlElement(html: string, targetPath: number[], type: string): string {
  const templates: Record<string, string> = {
    h1: '<h1 style="font-size: 2.5rem; font-weight: 700; margin: 1rem 0; color: #1a1a2e;">Título Principal</h1>',
    h2: '<h2 style="font-size: 2rem; font-weight: 600; margin: 0.75rem 0; color: #1a1a2e;">Subtítulo</h2>',
    h3: '<h3 style="font-size: 1.5rem; font-weight: 600; margin: 0.5rem 0; color: #1a1a2e;">Título de Seção</h3>',
    p: '<p style="font-size: 1rem; line-height: 1.6; color: #555; margin: 0.5rem 0;">Texto do parágrafo. Edite este conteúdo clicando duas vezes.</p>',
    small: '<small style="font-size: 0.875rem; color: #888;">Texto pequeno ou detalhe</small>',
    button: '<a href="#" style="display: inline-block; padding: 12px 32px; background: #6366f1; color: white; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 1rem; text-align: center;">Chamada para Ação</a>',
    hr: '<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 2rem 0;" />',
    section: '<section style="padding: 3rem 1.5rem; max-width: 1200px; margin: 0 auto;"><p style="color: #999; text-align: center;">Nova seção — arraste elementos aqui</p></section>',
    columns: '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; padding: 2rem 0;"><div style="padding: 1.5rem; background: #f8f9fa; border-radius: 12px;"><p style="color: #999; text-align: center;">Coluna 1</p></div><div style="padding: 1.5rem; background: #f8f9fa; border-radius: 12px;"><p style="color: #999; text-align: center;">Coluna 2</p></div></div>',
  };
  const template = templates[type] || `<div style="padding: 1rem; border: 1px dashed #ccc;">Novo elemento</div>`;
  const div = document.createElement("div");
  div.innerHTML = html;
  if (targetPath.length === 0) {
    div.insertAdjacentHTML("beforeend", template);
  } else {
    let el: Element | null = div;
    for (const idx of targetPath) {
      if (!el?.children[idx]) { div.insertAdjacentHTML("beforeend", template); return div.innerHTML; }
      el = el.children[idx];
    }
    if (el) el.insertAdjacentHTML("afterend", template);
    else div.insertAdjacentHTML("beforeend", template);
  }
  return div.innerHTML;
}
