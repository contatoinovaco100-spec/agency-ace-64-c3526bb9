// Leitura e edição do HTML das landing pages sem executar os scripts da página.
// O HTML é lido com DOMParser (scripts não rodam), então o que é salvo é sempre a fonte original, e não o DOM já animado.

export type LpTextField = { index: number; text: string; kind: string; section: string };
export type LpLinkField = { name: string; value: string };

// LPs que nasceram como arquivo em /public e têm endereço próprio. Ao importar, passam a vir do banco e ficam editáveis.
export const STATIC_LPS = [
  { slug: "lp-mentoria", title: "Mentoria Escala Produtora", file: "/static-lps/mentoria/index.html", path: "/lp-mentoria" },
];

export function lpPublicPath(slug: string) {
  return STATIC_LPS.find(s => s.slug === slug)?.path ?? `/lp/${slug}`;
}

const IGNORE = "script,style,noscript,template,svg,head";

const KIND_BY_TAG: Record<string, string> = {
  H1: "Título", H2: "Título", H3: "Subtítulo", H4: "Subtítulo", H5: "Subtítulo",
  P: "Parágrafo", LI: "Item de lista", A: "Botão ou link", BUTTON: "Botão",
  SUMMARY: "Pergunta", FIGCAPTION: "Legenda", SMALL: "Rótulo", LABEL: "Rótulo",
};

export function parseLp(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

export function serializeLp(doc: Document): string {
  return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
}

/** Todos os textos visíveis do corpo, na ordem em que aparecem. */
export function lpTextNodes(doc: Document): Text[] {
  const out: Text[] = [];
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue?.trim() || n.parentElement?.closest(IGNORE)) continue;
    out.push(n as Text);
  }
  return out;
}

function sectionLabel(el: Element | null, doc: Document): string {
  const box = el?.closest("section, header, footer, nav, main > div");
  if (!box) return "Página";
  const heading = box.querySelector("h1, h2")?.cloneNode(true) as Element | undefined;
  heading?.querySelectorAll("br").forEach(br => br.replaceWith(" "));
  const text = heading?.textContent?.replace(/\s+/g, " ").trim();
  if (text) return text.length > 48 ? text.slice(0, 46) + "…" : text;
  if (box.id) return box.id;
  return box === doc.body ? "Página" : box.tagName === "FOOTER" ? "Rodapé" : box.tagName === "NAV" ? "Menu" : "Seção";
}

export function lpTextFields(nodes: Text[], doc: Document): LpTextField[] {
  return nodes.map((n, index) => {
    const parent = n.parentElement;
    const tagged = parent?.closest("h1,h2,h3,h4,h5,p,li,a,button,summary,figcaption,small,label");
    return {
      index,
      text: n.nodeValue ?? "",
      kind: (tagged && KIND_BY_TAG[tagged.tagName]) || "Texto",
      section: sectionLabel(parent ?? null, doc),
    };
  });
}

// Constantes de link nos scripts da página, ex.: const CHECKOUT_URL = 'https://wa.me/...'
const LINK_CONST = /const\s+([A-Z][A-Z0-9_]*(?:URL|LINK|WHATSAPP|PHONE)[A-Z0-9_]*)\s*=\s*(['"])(.*?)\2/g;

export function lpLinkFields(doc: Document): LpLinkField[] {
  const out: LpLinkField[] = [];
  doc.querySelectorAll("script:not([src])").forEach(s => {
    for (const m of (s.textContent ?? "").matchAll(LINK_CONST)) out.push({ name: m[1], value: m[3] });
  });
  return out;
}

export function setLpLink(doc: Document, name: string, value: string) {
  const safe = value.replace(/['"\\]/g, "");
  doc.querySelectorAll("script:not([src])").forEach(s => {
    const src = s.textContent ?? "";
    const next = src.replace(LINK_CONST, (all, n, q) => (n === name ? `const ${n} = ${q}${safe}${q}` : all));
    if (next !== src) s.textContent = next;
  });
}

/** Copia os links configuráveis (WhatsApp, Instagram…) de uma versão da LP para outra. */
export function carryLpLinks(fromHtml: string, toHtml: string): string {
  const to = parseLp(toHtml);
  lpLinkFields(parseLp(fromHtml)).forEach(l => setLpLink(to, l.name, l.value));
  return serializeLp(to);
}

/** Imagens usadas na página: <img src> e url(...) do CSS. */
export function lpImages(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/g)) found.add(m[1]);
  for (const m of html.matchAll(/url\((["']?)((?:data:image|https?:|assets\/|\/)[^"')]+)\1\)/g)) found.add(m[2]);
  return [...found];
}

/** Cópia para a prévia: marca cada texto para o clique na prévia achar o campo e devolve a rolagem. */
export function buildLpPreview(html: string, scrollY: number): string {
  const doc = parseLp(html);
  lpTextNodes(doc).forEach((n, i) => {
    const p = n.parentElement;
    if (p && !p.hasAttribute("data-lp-t")) p.setAttribute("data-lp-t", String(i));
  });
  const script = doc.createElement("script");
  script.textContent = `(function(){
document.documentElement.style.scrollBehavior='auto';
addEventListener('load',function(){scrollTo(0,${Math.round(scrollY)})});
var t;addEventListener('scroll',function(){clearTimeout(t);t=setTimeout(function(){parent.postMessage({lpEditor:'scroll',y:scrollY},'*')},120)},{passive:true});
document.addEventListener('click',function(e){
  if(e.target.closest('a'))e.preventDefault();
  var el=e.target.closest('[data-lp-t]');
  if(el)parent.postMessage({lpEditor:'pick',i:+el.getAttribute('data-lp-t')},'*');
},true);
var s=document.createElement('style');
s.textContent='[data-lp-t]{cursor:text}[data-lp-t]:hover{outline:1.5px dashed rgba(193,249,32,.75);outline-offset:3px;border-radius:2px}';
document.head.appendChild(s);
})();`;
  doc.body.appendChild(script);
  return serializeLp(doc);
}

export function slugifyLp(s: string) {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Lê uma imagem enviada e devolve em data URL, reduzida para no máximo 1600px. */
export async function imageFileToDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return file.type === "image/png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Busca uma LP estática de /public e embute as imagens, para ela poder ser salva no banco e editada. */
export async function fetchStaticLp(file: string): Promise<string> {
  const base = new URL(file, window.location.origin);
  let html = await (await fetch(base)).text();
  const refs = new Set<string>();
  for (const m of html.matchAll(/(?:src=["']|url\()((?:\/[\w-]+)*\/?assets\/[^"')]+)/g)) refs.add(m[1]);
  for (const ref of refs) {
    const blob = await (await fetch(new URL(ref, base))).blob();
    const dataUrl = await new Promise<string>(ok => {
      const r = new FileReader(); r.onload = () => ok(r.result as string); r.readAsDataURL(blob);
    });
    html = html.split(ref).join(dataUrl);
  }
  return html;
}
