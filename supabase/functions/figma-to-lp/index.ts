import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  fills?: any[];
  characters?: string;
  style?: any;
  children?: FigmaNode[];
  cornerRadius?: number;
  backgroundColor?: any;
}

function rgbaToCss(color: any, opacity = 1): string {
  if (!color) return "transparent";
  const r = Math.round((color.r ?? 0) * 255);
  const g = Math.round((color.g ?? 0) * 255);
  const b = Math.round((color.b ?? 0) * 255);
  const a = (color.a ?? 1) * opacity;
  return `rgba(${r},${g},${b},${a})`;
}

function fillsToCss(fills?: any[]): string {
  if (!fills || fills.length === 0) return "";
  const solid = fills.find((f) => f.type === "SOLID" && f.visible !== false);
  if (solid) return rgbaToCss(solid.color, solid.opacity ?? 1);
  return "";
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
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderNode(node: FigmaNode, originX: number, originY: number, depth = 0): string {
  if (!node || node.visible === false) return "";
  const bb = node.absoluteBoundingBox;
  if (!bb) return "";
  const left = bb.x - originX;
  const top = bb.y - originY;
  const w = bb.width;
  const h = bb.height;

  const bg = fillsToCss(node.fills);
  const radius = node.cornerRadius ? `border-radius:${node.cornerRadius}px;` : "";

  const baseStyle = `position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;${radius}`;

  if (node.type === "TEXT") {
    const st = node.style || {};
    const color = node.fills?.[0]?.color ? rgbaToCss(node.fills[0].color, node.fills[0].opacity ?? 1) : "#111";
    const fontSize = st.fontSize ? `${st.fontSize}px` : "16px";
    const fontWeight = st.fontWeight ?? 400;
    const family = st.fontFamily ? `${st.fontFamily}, Inter, sans-serif` : "Inter, sans-serif";
    const align = (st.textAlignHorizontal || "LEFT").toLowerCase();
    const lineHeight = st.lineHeightPx ? `${st.lineHeightPx}px` : "1.4";
    return `<div style="${baseStyle}color:${color};font-size:${fontSize};font-weight:${fontWeight};font-family:${family};text-align:${align};line-height:${lineHeight};display:flex;align-items:center;justify-content:${align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start"};white-space:pre-wrap;">${escapeHtml(node.characters || "")}</div>`;
  }

  const inner = (node.children || [])
    .map((c) => renderNode(c, originX, originY, depth + 1))
    .join("");

  return `<div data-name="${escapeHtml(node.name)}" data-type="${node.type}" style="${baseStyle}background:${bg || "transparent"};overflow:hidden;">${inner}</div>`;
}

function renderFrameToHtml(frame: FigmaNode): string {
  const bb = frame.absoluteBoundingBox!;
  const bg = fillsToCss(frame.fills) || rgbaToCss(frame.backgroundColor);
  const inner = (frame.children || [])
    .map((c) => renderNode(c, bb.x, bb.y))
    .join("");
  return `<section style="position:relative;width:100%;max-width:${bb.width}px;margin:0 auto;aspect-ratio:${bb.width}/${bb.height};background:${bg || "#fff"};overflow:hidden;">${inner}</section>`;
}

function summarizeFrame(frame: FigmaNode): string {
  const texts: string[] = [];
  const walk = (n: FigmaNode) => {
    if (n.type === "TEXT" && n.characters) texts.push(n.characters);
    (n.children || []).forEach(walk);
  };
  walk(frame);
  return texts.slice(0, 40).join(" | ");
}

async function extractFigmaKey(url: string): Promise<string | null> {
  const m = url.match(/figma\.com\/(?:file|design|proto)\/([a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { mode, figmaJson: providedJson, figmaUrl, figmaToken, title } = body;

    let figmaDoc: any = null;

    if (mode === "api") {
      if (!figmaUrl || !figmaToken) throw new Error("URL do Figma e token são obrigatórios.");
      const key = await extractFigmaKey(figmaUrl);
      if (!key) throw new Error("URL do Figma inválida.");
      const resp = await fetch(`https://api.figma.com/v1/files/${key}`, {
        headers: { "X-Figma-Token": figmaToken },
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Figma API [${resp.status}]: ${t.slice(0, 200)}`);
      }
      const data = await resp.json();
      figmaDoc = data.document;
    } else {
      figmaDoc = providedJson?.document || providedJson;
      if (!figmaDoc) throw new Error("JSON do Figma inválido — envie o arquivo completo exportado.");
    }

    // Get frames (up to first 5 to keep response manageable)
    const frames = collectPageFrames(figmaDoc);
    const targetFrames = frames.length > 0 ? frames.slice(0, 5) : [findFirstFrame(figmaDoc)].filter(Boolean) as FigmaNode[];

    if (targetFrames.length === 0) throw new Error("Nenhum frame encontrado no arquivo Figma.");

    const faithfulHtml = targetFrames.map(renderFrameToHtml).join("\n");
    const summary = targetFrames.map((f, i) => `Frame ${i + 1} (${f.name}): ${summarizeFrame(f)}`).join("\n\n");

    // AI enhancement layer
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let aiHtml = faithfulHtml;
    let aiNotes: any = { suggestions: [], applied: false };

    if (LOVABLE_API_KEY) {
      const prompt = `Você é um web designer sênior. Recebi HTML gerado por um renderer fiel de um arquivo Figma (posições absolutas). Sua tarefa:

1. Reinterpretar em HTML semântico + Tailwind CSS, RESPONSIVO (mobile-first, breakpoints sm/md/lg).
2. Preservar hierarquia visual, cores, textos e proporções.
3. Usar <header>, <section>, <footer> apropriados.
4. Identificar CTA principal e destacar.
5. Manter a identidade do design original.

Título da LP: "${title || 'Landing Page'}"

Resumo dos textos do design:
${summary}

HTML fiel (posições absolutas — use como referência de conteúdo/cor/hierarquia):
${faithfulHtml.slice(0, 15000)}

Responda em JSON:
{
  "html": "<!DOCTYPE html>...com Tailwind via CDN e estilo completo, LP responsiva pronta para servir",
  "suggestions": ["sugestão de copy 1", "sugestão de melhoria 2", ...]
}`;

      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-pro",
            messages: [
              { role: "system", content: "Você é um web designer que retorna HTML+Tailwind completo em JSON válido." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          const cleaned = String(content).replace(/```json/g, '').replace(/```/g, '').trim();
          try {
            const parsed = JSON.parse(cleaned);
            if (parsed.html) {
              aiHtml = parsed.html;
              aiNotes = { suggestions: parsed.suggestions || [], applied: true };
            }
          } catch {
            aiNotes = { suggestions: [], applied: false, raw: content.slice(0, 500) };
          }
        } else if (aiResp.status === 429) {
          aiNotes = { suggestions: [], applied: false, error: "Rate limit — usando renderer fiel." };
        } else if (aiResp.status === 402) {
          aiNotes = { suggestions: [], applied: false, error: "Créditos IA esgotados — usando renderer fiel." };
        } else {
          aiNotes = { suggestions: [], applied: false, error: `AI ${aiResp.status}` };
        }
      } catch (e) {
        aiNotes = { suggestions: [], applied: false, error: String(e) };
      }
    }

    // Wrap faithful HTML if AI didn't produce a full doc
    let finalHtml = aiHtml;
    if (!/<!DOCTYPE|<html/i.test(finalHtml)) {
      finalHtml = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title || "Landing Page")}</title><script src="https://cdn.tailwindcss.com"></script><style>body{margin:0;font-family:Inter,sans-serif;background:#fff;color:#111}</style></head><body>${finalHtml}</body></html>`;
    }

    return new Response(
      JSON.stringify({ html: finalHtml, faithful_html: faithfulHtml, ai_notes: aiNotes, frames_count: targetFrames.length, figma_json: mode === "api" ? { document: figmaDoc } : null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("figma-to-lp error:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
