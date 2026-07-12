import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  fills?: any[];
  strokes?: any[];
  strokeWeight?: number;
  characters?: string;
  style?: any;
  children?: FigmaNode[];
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  backgroundColor?: any;
  effects?: any[];
  opacity?: number;
  layoutMode?: string;
  itemSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
}

interface FigmaReference {
  key: string;
  nodeId?: string;
}

function rgbaToCss(color: any, opacity = 1): string {
  if (!color) return "transparent";
  const r = Math.round((color.r ?? 0) * 255);
  const g = Math.round((color.g ?? 0) * 255);
  const b = Math.round((color.b ?? 0) * 255);
  const a = (color.a ?? 1) * opacity;
  return `rgba(${r},${g},${b},${a})`;
}

function rgbaToHex(color: any): string {
  if (!color) return "#000000";
  const toHex = (v: number) => Math.round((v ?? 0) * 255).toString(16).padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function fillsToCss(fills?: any[]): string {
  if (!fills || fills.length === 0) return "";
  const solid = fills.find((f) => f.type === "SOLID" && f.visible !== false);
  if (solid) return rgbaToCss(solid.color, solid.opacity ?? 1);
  const gradient = fills.find((f) => f.type?.startsWith("GRADIENT") && f.visible !== false);
  if (gradient?.gradientStops) {
    const stops = gradient.gradientStops
      .map((s: any) => `${rgbaToCss(s.color)} ${Math.round(s.position * 100)}%`)
      .join(", ");
    return `linear-gradient(180deg, ${stops})`;
  }
  return "";
}

function getImageRef(fills?: any[]): string | null {
  if (!fills) return null;
  const img = fills.find((f) => f.type === "IMAGE" && f.imageRef);
  return img?.imageRef || null;
}

function hasVisibleImageFill(fills?: any[]): boolean {
  return !!fills?.some((f) => f.type === "IMAGE" && f.imageRef && f.visible !== false);
}

function shadowCss(effects?: any[]): string {
  if (!effects) return "";
  const drops = effects
    .filter((e) => e.type === "DROP_SHADOW" && e.visible !== false)
    .map((e) => `${e.offset?.x || 0}px ${e.offset?.y || 0}px ${e.radius || 0}px ${rgbaToCss(e.color)}`);
  return drops.length ? drops.join(", ") : "";
}

function findFirstFrame(node: FigmaNode): FigmaNode | null {
  if (!node) return null;
  if (node.type === "FRAME" && node.absoluteBoundingBox) return node;
  if (node.children) {
    for (const c of node.children) {
      const f = findFirstFrame(c);
      if (f) return f;
    }
  }
  return null;
}

function findNodeById(node: FigmaNode, id: string): FigmaNode | null {
  if (!node) return null;
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

function hasTextDescendant(node: FigmaNode): boolean {
  if (node.type === "TEXT" && (node.characters || "").trim()) return true;
  return (node.children || []).some(hasTextDescendant);
}

function collectRenderableNodeIds(node: FigmaNode, out: Set<string>) {
  if (!node || node.visible === false || !node.absoluteBoundingBox) return;

  const name = (node.name || "").toLowerCase();
  const visualVectorTypes = new Set(["VECTOR", "BOOLEAN_OPERATION", "STAR", "LINE", "ELLIPSE", "POLYGON"]);
  const isImageFill = hasVisibleImageFill(node.fills);
  const isVector = visualVectorTypes.has(node.type);
  const isVisualInstance = ["GROUP", "COMPONENT", "INSTANCE"].includes(node.type)
    && !hasTextDescendant(node)
    && (name.includes("logo") || name.includes("icon") || name.includes("icone") || name.includes("image") || name.includes("img"));

  if (isImageFill || isVector || isVisualInstance) out.add(node.id);
  (node.children || []).forEach((child) => collectRenderableNodeIds(child, out));
}

function collectPageFrames(doc: any): FigmaNode[] {
  const frames: FigmaNode[] = [];
  const pages = doc?.children || [];
  for (const page of pages) {
    for (const child of page.children || []) {
      if (child.type === "FRAME" && child.absoluteBoundingBox) {
        frames.push(child);
      }
    }
  }
  return frames;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------- Element inventory ----------
interface ElementTrace {
  id: string;
  name: string;
  type: string;
  role: string; // heading | body | button | image | icon | container | divider | logo
  x: number; y: number; w: number; h: number;
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  color?: string;
  bg?: string;
  radius?: number;
  imageRef?: string;
  shadow?: string;
  opacity?: number;
  children_count?: number;
  depth: number;
}

function classifyRole(n: FigmaNode): string {
  const name = (n.name || "").toLowerCase();
  if (n.type === "TEXT") {
    const fs = n.style?.fontSize || 16;
    if (name.includes("button") || name.includes("btn") || name.includes("cta")) return "button-text";
    if (fs >= 32) return "heading";
    if (fs >= 20) return "subheading";
    return "body";
  }
  if (getImageRef(n.fills)) {
    if (name.includes("logo")) return "logo";
    if (n.absoluteBoundingBox && n.absoluteBoundingBox.width <= 64 && n.absoluteBoundingBox.height <= 64) return "icon";
    return "image";
  }
  if (n.type === "VECTOR" || n.type === "BOOLEAN_OPERATION" || n.type === "STAR" || n.type === "LINE") {
    return "icon";
  }
  if (name.includes("button") || name.includes("btn") || name.includes("cta")) return "button";
  if (name.includes("divider") || (n.absoluteBoundingBox && (n.absoluteBoundingBox.height <= 2 || n.absoluteBoundingBox.width <= 2))) return "divider";
  if (n.type === "FRAME" || n.type === "GROUP" || n.type === "COMPONENT" || n.type === "INSTANCE") return "container";
  return "shape";
}

function traceNodes(node: FigmaNode, originX: number, originY: number, depth: number, out: ElementTrace[]) {
  if (!node || node.visible === false) return;
  const bb = node.absoluteBoundingBox;
  if (!bb) return;
  const trace: ElementTrace = {
    id: node.id,
    name: node.name,
    type: node.type,
    role: classifyRole(node),
    x: Math.round(bb.x - originX),
    y: Math.round(bb.y - originY),
    w: Math.round(bb.width),
    h: Math.round(bb.height),
    depth,
    opacity: node.opacity,
    children_count: node.children?.length || 0,
  };
  if (node.type === "TEXT") {
    trace.text = node.characters || "";
    trace.fontSize = node.style?.fontSize;
    trace.fontWeight = node.style?.fontWeight;
    trace.fontFamily = node.style?.fontFamily;
    if (node.fills?.[0]?.color) trace.color = rgbaToHex(node.fills[0].color);
  }
  const bg = fillsToCss(node.fills);
  if (bg) trace.bg = bg;
  const imgRef = getImageRef(node.fills);
  if (imgRef) trace.imageRef = imgRef;
  if (node.cornerRadius) trace.radius = node.cornerRadius;
  const sh = shadowCss(node.effects);
  if (sh) trace.shadow = sh;

  out.push(trace);
  (node.children || []).forEach((c) => traceNodes(c, originX, originY, depth + 1, out));
}

// ---------- Faithful renderer ----------
function renderNode(node: FigmaNode, originX: number, originY: number, imageUrls: Record<string, string>, nodeImageUrls: Record<string, string>): string {
  if (!node || node.visible === false) return "";
  const bb = node.absoluteBoundingBox;
  if (!bb) return "";
  const left = bb.x - originX, top = bb.y - originY, w = bb.width, h = bb.height;
  const bg = fillsToCss(node.fills);
  const radius = node.cornerRadius ? `border-radius:${node.cornerRadius}px;` : "";
  const shadow = shadowCss(node.effects);
  const shadowStyle = shadow ? `box-shadow:${shadow};` : "";
  const opacity = node.opacity != null && node.opacity < 1 ? `opacity:${node.opacity};` : "";
  const baseStyle = `position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;${radius}${shadowStyle}${opacity}`;

  if (nodeImageUrls[node.id]) {
    return `<img src="${nodeImageUrls[node.id]}" alt="${escapeHtml(node.name)}" style="${baseStyle}object-fit:fill;display:block;" />`;
  }

  if (node.type === "TEXT") {
    const st = node.style || {};
    const color = node.fills?.[0]?.color ? rgbaToCss(node.fills[0].color, node.fills[0].opacity ?? 1) : "#111";
    const fontSize = st.fontSize ? `${st.fontSize}px` : "16px";
    const fontWeight = st.fontWeight ?? 400;
    const family = st.fontFamily ? `${st.fontFamily}, Inter, sans-serif` : "Inter, sans-serif";
    const align = (st.textAlignHorizontal || "LEFT").toLowerCase();
    const lineHeight = st.lineHeightPx ? `${st.lineHeightPx}px` : "1.4";
    return `<div style="${baseStyle}color:${color};font-size:${fontSize};font-weight:${fontWeight};font-family:${family};text-align:${align};line-height:${lineHeight};white-space:pre-wrap;">${escapeHtml(node.characters || "")}</div>`;
  }

  const imgRef = getImageRef(node.fills);
  if (imgRef && imageUrls[imgRef]) {
    return `<img src="${imageUrls[imgRef]}" alt="${escapeHtml(node.name)}" style="${baseStyle}object-fit:cover;" />`;
  }

  const stroke = node.strokes?.[0]?.color ? `border:${node.strokeWeight || 1}px solid ${rgbaToCss(node.strokes[0].color, node.strokes[0].opacity ?? 1)};` : "";
  const inner = (node.children || []).map((c) => renderNode(c, originX, originY, imageUrls, nodeImageUrls)).join("");
  return `<div data-name="${escapeHtml(node.name)}" data-type="${node.type}" style="${baseStyle}background:${bg || "transparent"};overflow:hidden;">${inner}</div>`;
}

function renderFrameToHtml(frame: FigmaNode, imageUrls: Record<string, string>, nodeImageUrls: Record<string, string>): string {
  const bb = frame.absoluteBoundingBox!;
  const bg = fillsToCss(frame.fills) || rgbaToCss(frame.backgroundColor);
  const inner = (frame.children || []).map((c) => renderNode(c, bb.x, bb.y, imageUrls, nodeImageUrls)).join("");
  return `<section class="figma-frame" aria-label="${escapeHtml(frame.name)}" style="width:100%;max-width:${bb.width}px;margin:0 auto;background:${bg || "#fff"};overflow:hidden;">
  <svg viewBox="0 0 ${bb.width} ${bb.height}" width="100%" style="display:block;background:${bg || "#fff"}" xmlns="http://www.w3.org/2000/svg">
    <foreignObject x="0" y="0" width="${bb.width}" height="${bb.height}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${bb.width}px;height:${bb.height}px;background:${bg || "#fff"};overflow:hidden;">${inner}</div>
    </foreignObject>
  </svg>
</section>`;
}

async function extractFigmaReference(url: string): Promise<FigmaReference | null> {
  const m = url.match(/figma\.com\/(?:file|design|proto|board|slides)\/([a-zA-Z0-9]+)/);
  if (m) {
    let nodeId: string | undefined;
    try {
      const u = new URL(url);
      nodeId = u.searchParams.get("node-id")?.replace(/-/g, ":") || undefined;
    } catch (_) {
      const nodeMatch = url.match(/[?&]node-id=([^&]+)/);
      nodeId = nodeMatch?.[1]?.replace(/-/g, ":");
    }
    return { key: m[1], nodeId };
  }
  const bare = url.trim().match(/^([a-zA-Z0-9]{15,})$/);
  return bare ? { key: bare[1] } : null;
}

async function fetchImageUrls(key: string, token: string): Promise<Record<string, string>> {
  try {
    const resp = await fetch(`https://api.figma.com/v1/files/${key}/images`, {
      headers: { "X-Figma-Token": token },
    });
    if (!resp.ok) return {};
    const data = await resp.json();
    return data.meta?.images || {};
  } catch { return {}; }
}

async function fetchRenderedNodeUrls(key: string, token: string, nodeIds: string[]): Promise<Record<string, string>> {
  const urls: Record<string, string> = {};
  const unique = [...new Set(nodeIds)].slice(0, 120);
  for (let i = 0; i < unique.length; i += 40) {
    const batch = unique.slice(i, i + 40);
    const params = new URLSearchParams({ ids: batch.join(","), format: "png", scale: "2" });
    try {
      const resp = await fetch(`https://api.figma.com/v1/images/${key}?${params.toString()}`, {
        headers: { "X-Figma-Token": token },
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      Object.assign(urls, data.images || {});
    } catch (_) {
      // Keep generating with the styled fallback when a render batch fails.
    }
  }
  return urls;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function downloadAsDataUrl(url: string, budget: { remaining: number }): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const contentLength = Number(resp.headers.get("content-length") || "0");
    if (contentLength && contentLength > budget.remaining) return null;
    const buffer = await resp.arrayBuffer();
    if (buffer.byteLength > budget.remaining) return null;
    budget.remaining -= buffer.byteLength;
    const mime = resp.headers.get("content-type")?.split(";")[0] || "image/png";
    return `data:${mime};base64,${arrayBufferToBase64(buffer)}`;
  } catch (_) {
    return null;
  }
}

async function persistImageMap(urls: Record<string, string>, budget: { remaining: number }) {
  const persisted: Record<string, string> = {};
  let downloaded = 0;
  let fallback = 0;
  for (const [id, url] of Object.entries(urls)) {
    if (!url) continue;
    const dataUrl = await downloadAsDataUrl(url, budget);
    if (dataUrl) {
      persisted[id] = dataUrl;
      downloaded += 1;
    } else {
      persisted[id] = url;
      fallback += 1;
    }
  }
  return { persisted, downloaded, fallback };
}

function wrapExactHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title || "Landing Page")}</title><style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#fff;color:#111;font-family:Inter,Arial,sans-serif}body{overflow-x:hidden}.figma-frame img{max-width:none}.figma-frame div{box-sizing:border-box}
</style></head><body>${bodyHtml}</body></html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    if (!body || typeof body !== "object") throw new Error("Requisição inválida.");
    const { mode, figmaJson: providedJson, figmaUrl, figmaToken, title } = body;
    if (mode !== "api" && mode !== "upload") throw new Error("Modo inválido.");
    if (title != null && typeof title !== "string") throw new Error("Título inválido.");

    let figmaDoc: any = null;
    let imageUrls: Record<string, string> = {};
    let nodeImageUrls: Record<string, string> = {};
    let selectedNodeId: string | undefined;

    if (mode === "api") {
      if (!figmaUrl || !figmaToken) throw new Error("URL do Figma e token são obrigatórios.");
      const ref = await extractFigmaReference(figmaUrl);
      if (!ref?.key) throw new Error("URL do Figma inválida.");
      selectedNodeId = ref.nodeId;
      const resp = await fetch(`https://api.figma.com/v1/files/${ref.key}`, {
        headers: { "X-Figma-Token": figmaToken },
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Figma API [${resp.status}]: ${t.slice(0, 200)}`);
      }
      const data = await resp.json();
      figmaDoc = data.document;
      imageUrls = await fetchImageUrls(ref.key, figmaToken);
    } else {
      figmaDoc = providedJson?.document || providedJson;
      if (!figmaDoc) throw new Error("JSON do Figma inválido — envie o arquivo completo exportado.");
    }

    const selectedNode = selectedNodeId ? findNodeById(figmaDoc, selectedNodeId) : null;
    const frames = collectPageFrames(figmaDoc);
    const targetFrames = selectedNode?.absoluteBoundingBox
      ? [selectedNode]
      : (frames.length > 0 ? frames.slice(0, 5) : [findFirstFrame(figmaDoc)].filter(Boolean) as FigmaNode[]);
    if (targetFrames.length === 0) throw new Error("Nenhum frame encontrado no arquivo Figma.");

    if (mode === "api") {
      const ref = await extractFigmaReference(figmaUrl);
      const renderIds = new Set<string>();
      targetFrames.forEach((frame) => (frame.children || []).forEach((child) => collectRenderableNodeIds(child, renderIds)));
      const renderedUrls = ref?.key ? await fetchRenderedNodeUrls(ref.key, figmaToken, [...renderIds]) : {};
      const budget = { remaining: 12 * 1024 * 1024 };
      const persistedNodeImages = await persistImageMap(renderedUrls, budget);
      const persistedFillImages = await persistImageMap(imageUrls, budget);
      nodeImageUrls = persistedNodeImages.persisted;
      imageUrls = persistedFillImages.persisted;
      (globalThis as any).__imageStats = {
        traced: renderIds.size + Object.keys(imageUrls).length,
        downloaded: persistedNodeImages.downloaded + persistedFillImages.downloaded,
        fallback: persistedNodeImages.fallback + persistedFillImages.fallback,
        embedded_bytes_budget_left: budget.remaining,
      };
    }

    // ---------- Trace every element ----------
    const inventory: { frame: string; elements: ElementTrace[] }[] = [];
    for (const f of targetFrames) {
      const bb = f.absoluteBoundingBox!;
      const list: ElementTrace[] = [];
      (f.children || []).forEach((c) => traceNodes(c, bb.x, bb.y, 0, list));
      inventory.push({ frame: f.name, elements: list });
    }

    const totalElements = inventory.reduce((a, b) => a + b.elements.length, 0);
    const roleCounts: Record<string, number> = {};
    inventory.forEach((f) => f.elements.forEach((e) => { roleCounts[e.role] = (roleCounts[e.role] || 0) + 1; }));

    const faithfulHtml = targetFrames.map((f) => renderFrameToHtml(f, imageUrls, nodeImageUrls)).join("\n");
    const exactHtml = wrapExactHtml(title || "Landing Page", faithfulHtml);

    // Compact inventory for AI (only useful fields)
    const compactInventory = inventory.map((f) => ({
      frame: f.frame,
      elements: f.elements.map((e) => ({
        role: e.role,
        name: e.name,
        text: e.text?.slice(0, 200),
        x: e.x, y: e.y, w: e.w, h: e.h,
        fontSize: e.fontSize,
        fontWeight: e.fontWeight,
        color: e.color,
        bg: e.bg?.startsWith("rgba") ? e.bg : undefined,
        radius: e.radius,
        hasImage: !!e.imageRef,
        imageUrl: e.imageRef ? imageUrls[e.imageRef] : undefined,
      })),
    }));

    // ---------- AI enhancement ----------
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let aiNotes: any = {
      suggestions: [],
      applied: false,
      trace: { total: totalElements, roles: roleCounts },
      images: (globalThis as any).__imageStats || { traced: 0, downloaded: 0, fallback: 0 },
      exact_renderer: true,
    };

    if (LOVABLE_API_KEY) {
      const prompt = `Você é um web designer sênior. Recebi o INVENTÁRIO COMPLETO de elementos rastreados de um arquivo Figma. Cada elemento tem posição, papel (heading/body/button/image/icon/logo/container/divider), cores, fontes e conteúdo.

Sua tarefa: construir uma LP responsiva (HTML + Tailwind via CDN) que reproduza CADA elemento do inventário, respeitando:
- Hierarquia visual (headings antes de body, CTAs em destaque)
- Cores exatas (use os hex fornecidos)
- Textos exatos (não invente copy nova, use o que está no inventário)
- Imagens quando fornecidas (use imageUrl)
- Ícones e dividers como decoração
- Layout mobile-first com breakpoints sm/md/lg
- Semântica correta: <header>, <section>, <footer>, <button>, <img>

Título: "${title || 'Landing Page'}"

INVENTÁRIO RASTREADO (${totalElements} elementos, papéis: ${JSON.stringify(roleCounts)}):
${JSON.stringify(compactInventory).slice(0, 40000)}

Responda em JSON puro:
{
  "html": "<!DOCTYPE html>... LP completa e responsiva com Tailwind CDN",
  "suggestions": ["sugestão 1", "sugestão 2"],
  "elements_rendered": <número de elementos que você incluiu>
}`;

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 45000);
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
          signal: controller.signal,
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "Você é um web designer que retorna HTML+Tailwind completo em JSON válido. Reproduza CADA elemento do inventário rastreado." },
              { role: "user", content: prompt },
            ],
          }),
        });
        clearTimeout(timer);

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          const cleaned = String(content).replace(/```json/g, '').replace(/```/g, '').trim();
          try {
            const parsed = JSON.parse(cleaned);
            if (parsed.html) {
              aiNotes = {
                suggestions: parsed.suggestions || [],
                applied: false,
                trace: { total: totalElements, roles: roleCounts, rendered_by_ai: parsed.elements_rendered },
                images: (globalThis as any).__imageStats || { traced: 0, downloaded: 0, fallback: 0 },
                exact_renderer: true,
                ai_reference_generated: true,
              };
            }
          } catch {
            aiNotes.raw = content.slice(0, 500);
          }
        } else if (aiResp.status === 429) aiNotes.error = "Rate limit — usando renderer fiel.";
        else if (aiResp.status === 402) aiNotes.error = "Créditos IA esgotados — usando renderer fiel.";
        else aiNotes.error = `AI ${aiResp.status}`;
      } catch (e) {
        aiNotes.error = String(e);
      }
    }

    let finalHtml = exactHtml;
    if (!/<!DOCTYPE|<html/i.test(finalHtml)) {
      finalHtml = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title || "Landing Page")}</title><script src="https://cdn.tailwindcss.com"></script><style>body{margin:0;font-family:Inter,sans-serif;background:#fff;color:#111}</style></head><body>${finalHtml}</body></html>`;
    }

    return new Response(
      JSON.stringify({
        html: finalHtml,
        faithful_html: faithfulHtml,
        ai_notes: aiNotes,
        frames_count: targetFrames.length,
        elements_trace: inventory,
        figma_json: mode === "api" ? { document: figmaDoc } : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("figma-to-lp error:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
