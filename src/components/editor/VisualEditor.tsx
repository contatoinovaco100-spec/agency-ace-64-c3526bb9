import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { getIframeInjectScript } from "./iframe-inject";
import {
  X, Save, Smartphone, Tablet, Monitor, Type, Palette, Box, Plus,
  Trash2, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Heading1,
  Heading2, Heading3, AlignLeft, Columns2, Rows3, Minus, Undo2,
  Redo2, Copy, Layers,
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

function parseCssValue(v: string) {
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

function getPath(el: Element): number[] {
  if (!el || el === document.body || el === document.documentElement) return [];
  const parent = el.parentElement;
  if (!parent) return [];
  const idx = Array.from(parent.children).indexOf(el);
  return [...getPath(parent), idx];
}

function findElByPath(root: Document, path: number[]): Element | null {
  let el: Element | null = root.body;
  for (const idx of path) {
    if (!el || !el.children[idx]) return null;
    el = el.children[idx];
  }
  return el;
}

function buildFullHtml(contentHtml: string): string {
  const script = getIframeInjectScript();
  if (contentHtml.toLowerCase().startsWith("<!doctype")) {
    const insertIdx = contentHtml.indexOf("</head>");
    if (insertIdx !== -1) {
      return contentHtml.slice(0, insertIdx) + `<script data-lp-editor="true">${script}</script>` + contentHtml.slice(insertIdx);
    }
    return contentHtml.replace("</body>", `<script data-lp-editor="true">${script}</script></body>`);
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${contentHtml}<script data-lp-editor="true">${script}</script></body></html>`;
}

function getIframeDoc(iframe: HTMLIFrameElement): Document | null {
  try { return iframe.contentDocument || iframe.contentWindow?.document || null; } catch { return null; }
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
  const [ready, setReady] = useState(false);
  const currentHtml = history[historyIdx] || html;
  const srcDocRef = useRef(buildFullHtml(html));

  const pushHistory = useCallback((newHtml: string) => {
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIdx + 1);
      const next = [...trimmed, newHtml];
      if (next.length > 50) next.shift();
      return next;
    });
    setHistoryIdx(prev => Math.min(prev + 1, 49));
  }, [historyIdx]);

  const reloadCanvas = useCallback((newContentHtml: string) => {
    srcDocRef.current = buildFullHtml(newContentHtml);
    setSelected(null);
    setReady(false);
    const iframe = iframeRef.current;
    if (iframe) {
      const src = srcDocRef.current;
      iframe.srcdoc = "";
      requestAnimationFrame(() => { iframe.srcdoc = src; });
    }
  }, []);

  const undo = useCallback(() => {
    if (historyIdx > 0) {
      const newIdx = historyIdx - 1;
      setHistoryIdx(newIdx);
      reloadCanvas(history[newIdx]);
    }
  }, [historyIdx, history, reloadCanvas]);

  const redo = useCallback(() => {
    if (historyIdx < history.length - 1) {
      const newIdx = historyIdx + 1;
      setHistoryIdx(newIdx);
      reloadCanvas(history[newIdx]);
    }
  }, [historyIdx, history, reloadCanvas]);

  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = getIframeDoc(iframe);
    if (!doc) return;

    doc.addEventListener("click", (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = (e.target as Element);
      if (!target || target === doc.body || target === doc.documentElement) return;
      doc.querySelectorAll(".__lp_selected").forEach(el => el.classList.remove("__lp_selected"));
      target.classList.add("__lp_selected");
      const cs = getComputedStyle(target);
      setSelected({
        path: getPath(target),
        tag: target.tagName.toLowerCase(),
        text: target.textContent?.trim().slice(0, 200) || "",
        styles: {
          color: cs.color,
          backgroundColor: cs.backgroundColor === "rgba(0, 0, 0, 0)" ? "" : cs.backgroundColor,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          fontFamily: cs.fontFamily.split(",")[0]?.trim().replace(/['"]/g, "") || "",
          textAlign: cs.textAlign,
          lineHeight: cs.lineHeight,
          letterSpacing: cs.letterSpacing,
          padding: cs.padding,
          margin: cs.margin,
          borderRadius: cs.borderRadius,
          border: cs.borderStyle === "none" ? "" : cs.border,
          backgroundImage: cs.backgroundImage === "none" ? "" : cs.backgroundImage,
          gap: cs.gap,
          width: cs.width,
          height: cs.height,
        },
        inlineStyles: target.getAttribute("style") || "",
        classes: target.className || "",
      });
      setShowProperties(true);
    }, true);

    doc.addEventListener("dblclick", (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = e.target as HTMLElement;
      if (!el || el === doc.body) return;
      el.contentEditable = "true";
      el.focus();
      el.classList.add("__lp_editing");
      const origHtml = el.innerHTML;
      const finish = () => {
        el.contentEditable = "false";
        el.classList.remove("__lp_editing");
        el.removeEventListener("blur", finish);
        el.removeEventListener("keydown", onKey);
        if (el.innerHTML !== origHtml) {
          const newContent = doc.body.innerHTML;
          const newFullHtml = reconstructFullHtml(currentHtml, newContent);
          pushHistory(newFullHtml);
        }
      };
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); finish(); }
        if (ev.key === "Escape") { el.innerHTML = origHtml; finish(); }
      };
      el.addEventListener("blur", finish);
      el.addEventListener("keydown", onKey);
    }, true);

    doc.querySelectorAll("section, div, header, footer, main, article, nav, h1, h2, h3, h4, h5, h6, p, a, span, button, img").forEach(el => {
      el.setAttribute("data-lp-editable", "true");
    });

    setReady(true);
  }, [currentHtml, pushHistory]);

  function applyStyle(prop: string, value: string) {
    if (!selected) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = getIframeDoc(iframe);
    if (!doc) return;
    const el = findElByPath(doc, selected.path);
    if (!el) return;

    if (value === "" || value === "unset" || value === "initial") {
      (el as HTMLElement).style.removeProperty(prop);
    } else {
      (el as HTMLElement).style.setProperty(prop, value);
    }

    const newContent = doc.body.innerHTML;
    const newFullHtml = reconstructFullHtml(currentHtml, newContent);
    pushHistory(newFullHtml);

    const cs = getComputedStyle(el);
    setSelected(prev => prev ? {
      ...prev,
      styles: {
        ...prev.styles,
        [prop === "background-color" ? "backgroundColor" : prop === "font-size" ? "fontSize" :
         prop === "font-weight" ? "fontWeight" : prop === "font-family" ? "fontFamily" :
         prop === "text-align" ? "textAlign" : prop === "line-height" ? "lineHeight" :
         prop === "letter-spacing" ? "letterSpacing" : prop === "border-radius" ? "borderRadius" :
         prop === "background-image" ? "backgroundImage" : prop]: value || cs.getPropertyValue(prop),
      },
      inlineStyles: el.getAttribute("style") || "",
    } : null);
  }

  function deleteElement() {
    if (!selected) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = getIframeDoc(iframe);
    if (!doc) return;
    const el = findElByPath(doc, selected.path);
    if (el) el.remove();
    const newContent = doc.body.innerHTML;
    const newFullHtml = reconstructFullHtml(currentHtml, newContent);
    pushHistory(newFullHtml);
    setSelected(null);
  }

  function moveElement(direction: "up" | "down") {
    if (!selected) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = getIframeDoc(iframe);
    if (!doc) return;
    const el = findElByPath(doc, selected.path);
    if (!el) return;
    if (direction === "up" && el.previousElementSibling) {
      el.parentElement?.insertBefore(el, el.previousElementSibling);
    } else if (direction === "down" && el.nextElementSibling) {
      el.parentElement?.insertBefore(el.nextElementSibling, el);
    }
    const newContent = doc.body.innerHTML;
    const newFullHtml = reconstructFullHtml(currentHtml, newContent);
    pushHistory(newFullHtml);
    const newPath = getPath(el);
    setSelected({ ...selected, path: newPath });
  }

  function duplicateElement() {
    if (!selected) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = getIframeDoc(iframe);
    if (!doc) return;
    const el = findElByPath(doc, selected.path);
    if (el) {
      const clone = el.cloneNode(true);
      el.parentElement?.insertBefore(clone, el.nextSibling);
    }
    const newContent = doc.body.innerHTML;
    const newFullHtml = reconstructFullHtml(currentHtml, newContent);
    pushHistory(newFullHtml);
  }

  function insertElement(type: string) {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = getIframeDoc(iframe);
    if (!doc) return;

    const templates: Record<string, string> = {
      h1: '<h1 style="font-size:2.5rem;font-weight:700;margin:1rem 0;color:#1a1a2e" data-lp-editable="true">Título Principal</h1>',
      h2: '<h2 style="font-size:2rem;font-weight:600;margin:0.75rem 0;color:#1a1a2e" data-lp-editable="true">Subtítulo</h2>',
      h3: '<h3 style="font-size:1.5rem;font-weight:600;margin:0.5rem 0;color:#1a1a2e" data-lp-editable="true">Título de Seção</h3>',
      p: '<p style="font-size:1rem;line-height:1.6;color:#555;margin:0.5rem 0" data-lp-editable="true">Texto do parágrafo. Edite clicando duas vezes.</p>',
      small: '<small style="font-size:0.875rem;color:#888" data-lp-editable="true">Texto pequeno</small>',
      button: '<a href="#" style="display:inline-block;padding:12px 32px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-weight:600;font-size:1rem;text-align:center" data-lp-editable="true">Chamada para Ação</a>',
      hr: '<hr style="border:none;border-top:1px solid #e5e7eb;margin:2rem 0" />',
      section: '<section style="padding:3rem 1.5rem;max-width:1200px;margin:0 auto" data-lp-editable="true"><p style="color:#999;text-align:center">Nova seção</p></section>',
      columns: '<div style="display:grid;grid-template-columns:1fr 1fr;gap:2rem;padding:2rem 0" data-lp-editable="true"><div style="padding:1.5rem;background:#f8f9fa;border-radius:12px" data-lp-editable="true"><p style="color:#999;text-align:center">Coluna 1</p></div><div style="padding:1.5rem;background:#f8f9fa;border-radius:12px" data-lp-editable="true"><p style="color:#999;text-align:center">Coluna 2</p></div></div>',
    };

    const template = templates[type] || `<div style="padding:1rem;border:1px dashed #ccc" data-lp-editable="true">Novo elemento</div>`;

    if (selected) {
      const selEl = findElByPath(doc, selected.path);
      if (selEl) {
        selEl.insertAdjacentHTML("afterend", template);
      } else {
        doc.body.insertAdjacentHTML("beforeend", template);
      }
    } else {
      doc.body.insertAdjacentHTML("beforeend", template);
    }

    const newContent = doc.body.innerHTML;
    const newFullHtml = reconstructFullHtml(currentHtml, newContent);
    pushHistory(newFullHtml);
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
            <Palette className="h-3.5 w-3.5" /> Props
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
                  { icon: AlignLeft, label: "Texto Pequeno", type: "small", desc: "Caption" },
                  { icon: Box, label: "Botão", type: "button", desc: "Call to action" },
                  { icon: Minus, label: "Divisor", type: "hr", desc: "Linha" },
                  { icon: Rows3, label: "Seção", type: "section", desc: "Container" },
                  { icon: Columns2, label: "Colunas (2)", type: "columns", desc: "Grid 2 col" },
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
            <iframe
              ref={iframeRef}
              srcDoc={srcDocRef.current}
              onLoad={handleIframeLoad}
              className="w-full h-full border-0"
              style={{ minHeight: "calc(100vh - 120px)" }}
              sandbox="allow-scripts allow-same-origin"
              title="Canvas do Editor"
            />
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
                          <CssBoxProp label="Largura" value={styleProps.width || ""}
                            onChange={v => applyStyle("width", v)} />
                          <CssBoxProp label="Altura" value={styleProps.height || ""}
                            onChange={v => applyStyle("height", v)} />
                        </PropGroup>
                        <PropGroup title="Fundo Avançado">
                          <CssBoxProp label="Imagem" value={styleProps.backgroundImage || ""}
                            onChange={v => applyStyle("background-image", v)} placeholder="url(...)" />
                        </PropGroup>
                      </>
                    )}

                    {activePropertyTab === "typography" && (
                      <>
                        <PropGroup title="Fonte">
                          <FontProp value={styleProps.fontFamily || ""} onChange={v => applyStyle("font-family", v)} />
                          <SizeProp label="Tamanho" value={styleProps.fontSize || "16px"} onChange={v => applyStyle("font-size", v)} min={8} max={96} />
                          <WeightProp value={styleProps.fontWeight || "400"} onChange={v => applyStyle("font-weight", v)} />
                        </PropGroup>
                        <PropGroup title="Alinhamento">
                          <AlignProp value={styleProps.textAlign || "left"} onChange={v => applyStyle("text-align", v)} />
                        </PropGroup>
                        <PropGroup title="Espaçamento de Texto">
                          <CssBoxProp label="Linha" value={styleProps.lineHeight || ""} onChange={v => applyStyle("line-height", v)} placeholder="1.5" />
                          <CssBoxProp label="Letra" value={styleProps.letterSpacing || ""} onChange={v => applyStyle("letter-spacing", v)} placeholder="0.05em" />
                        </PropGroup>
                      </>
                    )}

                    {activePropertyTab === "spacing" && (
                      <>
                        <PropGroup title="Margem">
                          <CssBoxProp label="Cima" value={parseCssValue(styleProps.margin || "0px").top}
                            onChange={v => { const p = parseCssValue(styleProps.margin || "0px"); applyStyle("margin", buildCssValue(v, p.right, p.bottom, p.left)); }} placeholder="0px" />
                          <CssBoxProp label="Direita" value={parseCssValue(styleProps.margin || "0px").right}
                            onChange={v => { const p = parseCssValue(styleProps.margin || "0px"); applyStyle("margin", buildCssValue(p.top, v, p.bottom, p.left)); }} placeholder="0px" />
                          <CssBoxProp label="Baixo" value={parseCssValue(styleProps.margin || "0px").bottom}
                            onChange={v => { const p = parseCssValue(styleProps.margin || "0px"); applyStyle("margin", buildCssValue(p.top, p.right, v, p.left)); }} placeholder="0px" />
                          <CssBoxProp label="Esquerda" value={parseCssValue(styleProps.margin || "0px").left}
                            onChange={v => { const p = parseCssValue(styleProps.margin || "0px"); applyStyle("margin", buildCssValue(p.top, p.right, p.bottom, v)); }} placeholder="0px" />
                        </PropGroup>
                        <PropGroup title="Preenchimento">
                          <CssBoxProp label="Cima" value={parseCssValue(styleProps.padding || "0px").top}
                            onChange={v => { const p = parseCssValue(styleProps.padding || "0px"); applyStyle("padding", buildCssValue(v, p.right, p.bottom, p.left)); }} placeholder="0px" />
                          <CssBoxProp label="Direita" value={parseCssValue(styleProps.padding || "0px").right}
                            onChange={v => { const p = parseCssValue(styleProps.padding || "0px"); applyStyle("padding", buildCssValue(p.top, v, p.bottom, p.left)); }} placeholder="0px" />
                          <CssBoxProp label="Baixo" value={parseCssValue(styleProps.padding || "0px").bottom}
                            onChange={v => { const p = parseCssValue(styleProps.padding || "0px"); applyStyle("padding", buildCssValue(p.top, p.right, v, p.left)); }} placeholder="0px" />
                          <CssBoxProp label="Esquerda" value={parseCssValue(styleProps.padding || "0px").left}
                            onChange={v => { const p = parseCssValue(styleProps.padding || "0px"); applyStyle("padding", buildCssValue(p.top, p.right, p.bottom, v)); }} placeholder="0px" />
                        </PropGroup>
                        <PropGroup title="Gap">
                          <CssBoxProp label="Gap" value={styleProps.gap || ""} onChange={v => applyStyle("gap", v)} placeholder="16px" />
                        </PropGroup>
                      </>
                    )}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-gray-600 mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /><path d="M13 13l6 6" /></svg>
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

function reconstructFullHtml(originalFullHtml: string, bodyInnerHtml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(originalFullHtml, "text/html");
  doc.body.innerHTML = bodyInnerHtml;
  return "<!DOCTYPE html>" + doc.documentElement.outerHTML;
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

function CssBoxProp({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-gray-400">{label}</Label>
      <Input value={value} onChange={e => onChange(e.target.value)}
        className="w-24 h-7 text-[11px] font-mono bg-white/5 border-white/10 text-white" placeholder={placeholder || "0px"} />
    </div>
  );
}

function FontProp({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const fonts = ["Inter", "Roboto", "Open Sans", "Montserrat", "Poppins", "Raleway", "Playfair Display", "Lato", "Nunito", "DM Sans", "Outfit", "Plus Jakarta Sans", "Manrope", "Sora", "Space Grotesk", "system-ui", "Arial", "Georgia"];
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
          {a === "left" && <AlignLeft className="h-3.5 w-3.5" />}
          {a === "center" && <AlignCenterIcon />}
          {a === "right" && <AlignRightIcon />}
          {a === "justify" && <AlignJustifyIcon />}
        </button>
      ))}
    </div>
  );
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
