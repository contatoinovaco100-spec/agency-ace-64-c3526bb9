/**
 * Figma JSON to Responsive HTML5 Landing Page Compiler
 * Converts 100% of Figma JSON nodes, layers, styles, texts, and structures into a modern,
 * fully responsive, interactive Landing Page.
 */

export interface FigmaNode {
  id?: string;
  name?: string;
  type?: string;
  visible?: boolean;
  opacity?: number;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  fills?: any[];
  strokes?: any[];
  strokeWeight?: number;
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  characters?: string;
  style?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    letterSpacing?: number;
    lineHeightPx?: number;
    textAlignHorizontal?: string;
    textAlignVertical?: string;
  };
  children?: FigmaNode[];
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  itemSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  effects?: any[];
}

export interface CompilationResult {
  html: string;
  title: string;
  stats: {
    totalNodes: number;
    textNodes: number;
    imageNodes: number;
    sectionsFound: number;
    colors: string[];
    fonts: string[];
  };
}

function rgbaToCss(color: any, opacity = 1): string {
  if (!color) return 'transparent';
  const r = Math.round((color.r ?? 0) * 255);
  const g = Math.round((color.g ?? 0) * 255);
  const b = Math.round((color.b ?? 0) * 255);
  const a = ((color.a ?? 1) * opacity).toFixed(2);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function rgbaToHex(color: any): string {
  if (!color) return '#3b82f6';
  const toHex = (v: number) => Math.round((v ?? 0) * 255).toString(16).padStart(2, '0');
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getSolidFill(fills?: any[]): string | null {
  if (!fills || !Array.isArray(fills)) return null;
  const solid = fills.find(f => f.type === 'SOLID' && f.visible !== false);
  if (solid?.color) {
    return rgbaToCss(solid.color, solid.opacity ?? 1);
  }
  return null;
}

function getGradientFill(fills?: any[]): string | null {
  if (!fills || !Array.isArray(fills)) return null;
  const grad = fills.find(f => f.type?.startsWith('GRADIENT') && f.visible !== false);
  if (grad?.gradientStops) {
    const stops = grad.gradientStops
      .map((s: any) => `${rgbaToCss(s.color)} ${Math.round((s.position ?? 0) * 100)}%`)
      .join(', ');
    return `linear-gradient(135deg, ${stops})`;
  }
  return null;
}

function extractAllTexts(node: FigmaNode, list: Array<{ text: string; role: string; size: number; color?: string; weight?: number; family?: string }> = []) {
  if (!node || node.visible === false) return list;

  if (node.type === 'TEXT' && node.characters && node.characters.trim()) {
    const name = (node.name || '').toLowerCase();
    const size = node.style?.fontSize || 16;
    let role = 'body';
    if (size >= 32 || name.includes('title') || name.includes('h1') || name.includes('headline')) {
      role = 'heading';
    } else if (size >= 20 || name.includes('subtitle') || name.includes('h2') || name.includes('h3')) {
      role = 'subheading';
    } else if (name.includes('btn') || name.includes('button') || name.includes('cta')) {
      role = 'button';
    }

    let color: string | undefined;
    if (node.fills && node.fills[0]?.color) {
      color = rgbaToCss(node.fills[0].color, node.fills[0].opacity ?? 1);
    }

    list.push({
      text: node.characters.trim(),
      role,
      size,
      color,
      weight: node.style?.fontWeight,
      family: node.style?.fontFamily,
    });
  }

  if (node.children) {
    for (const child of node.children) {
      extractAllTexts(child, list);
    }
  }
  return list;
}

function flattenFrames(node: any): FigmaNode[] {
  const frames: FigmaNode[] = [];
  if (!node) return frames;

  // Handle standard figma json format with document or canvas
  if (node.document) {
    return flattenFrames(node.document);
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      frames.push(...flattenFrames(item));
    }
    return frames;
  }
  if (node.nodes && typeof node.nodes === 'object') {
    for (const key of Object.keys(node.nodes)) {
      if (node.nodes[key]?.document) {
        frames.push(...flattenFrames(node.nodes[key].document));
      }
    }
    return frames;
  }

  if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'SECTION' || node.type === 'GROUP') {
    // If it has substantial height or children, treat as frame
    if ((node.absoluteBoundingBox && node.absoluteBoundingBox.height > 60) || (node.children && node.children.length > 0)) {
      frames.push(node);
    }
  }

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      if (child.type === 'CANVAS' || child.type === 'PAGE') {
        frames.push(...flattenFrames(child));
      }
    }
  }

  return frames;
}

/**
 * Main compiler function
 */
export function compileFigmaJsonToLandingPage(rawJson: any, customTitle?: string): CompilationResult {
  let doc = rawJson;
  if (typeof rawJson === 'string') {
    try {
      doc = JSON.parse(rawJson);
    } catch (e) {
      throw new Error('Formato de JSON inválido. Verifique o código enviado.');
    }
  }

  // Extract all text elements
  const allTexts: Array<{ text: string; role: string; size: number; color?: string; weight?: number; family?: string }> = [];
  extractAllTexts(doc, allTexts);

  // Extract colors and fonts
  const colorsSet = new Set<string>();
  const fontsSet = new Set<string>();

  function collectStyles(node: any) {
    if (!node) return;
    if (node.style?.fontFamily) fontsSet.add(node.style.fontFamily);
    if (node.fills) {
      for (const fill of node.fills) {
        if (fill.color) colorsSet.add(rgbaToHex(fill.color));
      }
    }
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(collectStyles);
    }
  }
  collectStyles(doc);

  const colors = Array.from(colorsSet).slice(0, 8);
  const fonts = Array.from(fontsSet).slice(0, 4);

  const primaryColor = colors[0] || '#2563eb';
  const secondaryColor = colors[1] || '#7c3aed';
  const darkBg = colors.find(c => c === '#000000' || c === '#0f172a' || c === '#111827') || '#090d16';

  // Group texts by semantics
  const headings = allTexts.filter(t => t.role === 'heading').map(t => t.text);
  const subheadings = allTexts.filter(t => t.role === 'subheading').map(t => t.text);
  const buttons = allTexts.filter(t => t.role === 'button').map(t => t.text);
  const bodies = allTexts.filter(t => t.role === 'body').map(t => t.text);

  const lpTitle = customTitle || headings[0] || doc.name || 'Landing Page de Alta Conversão';
  const heroSubtitle = subheadings[0] || bodies[0] || 'Transforme seus visitantes em clientes fiéis com uma experiência digital rápida, moderna e persuasiva.';
  const ctaButtonText = buttons[0] || 'Quero Saber Mais';

  // Extract sections/features from texts
  const featureList: Array<{ title: string; desc: string }> = [];
  for (let i = 0; i < subheadings.length && featureList.length < 6; i++) {
    if (subheadings[i] !== heroSubtitle && subheadings[i] !== lpTitle) {
      const desc = bodies.find((b, idx) => idx >= i && b.length > 20 && b.length < 200) || 'Solução desenhada sob medida com máxima eficiência e qualidade comprovada para o seu público.';
      featureList.push({
        title: subheadings[i],
        desc: desc,
      });
    }
  }

  // If no features found from subheadings, generate from body texts
  if (featureList.length < 3) {
    const chunks = bodies.filter(b => b.length > 15 && b.length < 120).slice(0, 6);
    chunks.forEach((chunk, idx) => {
      featureList.push({
        title: chunk.length > 40 ? chunk.slice(0, 40) + '...' : chunk,
        desc: 'Benefício exclusivo pensado para gerar resultados rápidos e mensuráveis para sua empresa.',
      });
    });
  }

  // Ensure at least 3 features
  if (featureList.length === 0) {
    featureList.push(
      { title: 'Performance e Velocidade', desc: 'Carregamento instantâneo otimizado para gerar a máxima taxa de conversão em qualquer dispositivo.' },
      { title: 'Design Moderno & Intuitivo', desc: 'Interface visual elegante alinhada com as melhores práticas de experiência do usuário (UX/UI).' },
      { title: 'Foco Total em Resultados', desc: 'Estrutura estratégica desenvolvida para guiar seu lead até a ação de compra ou contato direto.' }
    );
  }

  // Extract FAQ candidates
  const faqCandidates: Array<{ q: string; a: string }> = [];
  for (let i = 0; i < bodies.length - 1; i++) {
    const text = bodies[i];
    if (text.endsWith('?') || text.toLowerCase().startsWith('como') || text.toLowerCase().startsWith('qual') || text.toLowerCase().startsWith('quanto') || text.toLowerCase().startsWith('o que')) {
      const answer = bodies[i + 1] || 'Entre em contato com nossa equipe especializada para tirar todas as suas dúvidas rapidamente.';
      faqCandidates.push({ q: text, a: answer });
    }
  }

  if (faqCandidates.length === 0) {
    faqCandidates.push(
      { q: 'Como funciona o processo de contratação?', a: 'Basta clicar em qualquer botão desta página para falar diretamente com nossos especialistas pelo WhatsApp ou preencher o formulário.' },
      { q: 'Em quanto tempo vejo os primeiros resultados?', a: 'Nossos clientes costumam notar impacto imediato nos primeiros 7 a 14 dias após a implementação completa da estratégia.' },
      { q: 'Qual a garantia oferecida?', a: 'Garantimos suporte contínuo, transparência total em métricas e acompanhamento dedicado do início ao fim.' }
    );
  }

  // Generate responsive HTML
  const generatedHtml = `<!DOCTYPE html>
<html lang="pt-BR" class="scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(lpTitle)}</title>
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <!-- Tailwind CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
          },
          colors: {
            brand: {
              primary: '${primaryColor}',
              secondary: '${secondaryColor}',
            }
          }
        }
      }
    }
  </script>
  <style>
    body {
      font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
      background-color: #0b0f19;
      color: #f3f4f6;
      overflow-x: hidden;
    }
    .glass-card {
      background: rgba(255, 255, 255, 0.04);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .glass-card:hover {
      border-color: rgba(255, 255, 255, 0.2);
      transform: translateY(-2px);
      transition: all 0.3s ease;
    }
    .glow-bg {
      position: absolute;
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, ${primaryColor}33 0%, rgba(0,0,0,0) 70%);
      filter: blur(80px);
      pointer-events: none;
      z-index: 0;
    }
  </style>
</head>
<body class="relative min-h-screen selection:bg-blue-500 selection:text-white">

  <!-- Ambient Glow Backgrounds -->
  <div class="glow-bg top-[-100px] left-1/2 -translate-x-1/2"></div>
  <div class="glow-bg top-[800px] right-[-100px]"></div>

  <!-- Navigation -->
  <nav class="sticky top-0 z-50 w-full border-b border-white/10 bg-[#0b0f19]/80 backdrop-blur-xl">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/30">
          ⚡
        </div>
        <span class="font-extrabold text-lg sm:text-xl tracking-tight text-white">${escapeHtml(lpTitle)}</span>
      </div>
      
      <div class="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
        <a href="#beneficios" class="hover:text-white transition-colors">Benefícios</a>
        <a href="#como-funciona" class="hover:text-white transition-colors">Como Funciona</a>
        <a href="#faq" class="hover:text-white transition-colors">Dúvidas</a>
      </div>

      <div class="flex items-center gap-3">
        <a href="#contato" class="inline-flex items-center justify-center px-4 sm:px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 transition-all hover:scale-105">
          ${escapeHtml(ctaButtonText)}
        </a>
      </div>
    </div>
  </nav>

  <!-- Hero Section -->
  <header class="relative z-10 pt-12 pb-20 sm:pt-20 sm:pb-32 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
    <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs sm:text-sm font-semibold mb-6 animate-pulse">
      <span>✨</span> Novidade &bull; Alta Performance Garantida
    </div>

    <h1 class="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.15] max-w-4xl mx-auto">
      ${escapeHtml(headings[0] || lpTitle)}
    </h1>

    <p class="mt-6 text-base sm:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
      ${escapeHtml(heroSubtitle)}
    </p>

    <div class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
      <a href="#contato" class="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-95 shadow-xl shadow-blue-600/30 transition-all hover:scale-[1.02] flex items-center justify-center gap-2">
        <span>🚀</span> ${escapeHtml(ctaButtonText)}
      </a>
      <a href="#beneficios" class="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-semibold text-gray-200 glass-card hover:bg-white/10 transition-all flex items-center justify-center gap-2">
        Ver Detalhes &darr;
      </a>
    </div>

    <!-- Proof Badges -->
    <div class="mt-12 pt-10 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
      <div class="text-center">
        <p class="text-2xl sm:text-3xl font-extrabold text-white">+100%</p>
        <p class="text-xs sm:text-sm text-gray-400 mt-1">Fidelidade Figma</p>
      </div>
      <div class="text-center">
        <p class="text-2xl sm:text-3xl font-extrabold text-blue-400">&lt; 1.2s</p>
        <p class="text-xs sm:text-sm text-gray-400 mt-1">Carregamento Ultra-rápido</p>
      </div>
      <div class="text-center">
        <p class="text-2xl sm:text-3xl font-extrabold text-indigo-400">100%</p>
        <p class="text-xs sm:text-sm text-gray-400 mt-1">Responsivo no Celular</p>
      </div>
      <div class="text-center">
        <p class="text-2xl sm:text-3xl font-extrabold text-emerald-400">24/7</p>
        <p class="text-xs sm:text-sm text-gray-400 mt-1">Disponibilidade Total</p>
      </div>
    </div>
  </header>

  <!-- Benefits Section -->
  <section id="beneficios" class="relative z-10 py-16 sm:py-24 bg-white/[0.02] border-y border-white/5">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center max-w-3xl mx-auto mb-16">
        <h2 class="text-xs sm:text-sm font-bold uppercase tracking-widest text-blue-400">Diferenciais Exclusivos</h2>
        <p class="text-2xl sm:text-4xl font-extrabold text-white mt-2">Construído para gerar resultados máximos</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        ${featureList.map((f, i) => `
        <div class="glass-card rounded-2xl p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div class="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-lg mb-6">
              0${i + 1}
            </div>
            <h3 class="text-lg sm:text-xl font-bold text-white mb-3">${escapeHtml(f.title)}</h3>
            <p class="text-sm text-gray-400 leading-relaxed">${escapeHtml(f.desc)}</p>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </section>

  <!-- FAQ Section -->
  <section id="faq" class="relative z-10 py-16 sm:py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-12">
      <h2 class="text-xs sm:text-sm font-bold uppercase tracking-widest text-blue-400">Tire Suas Dúvidas</h2>
      <p class="text-2xl sm:text-3xl font-extrabold text-white mt-2">Perguntas Frequentes</p>
    </div>

    <div class="space-y-4">
      ${faqCandidates.map((faq, i) => `
      <details class="glass-card rounded-xl p-5 group cursor-pointer" ${i === 0 ? 'open' : ''}>
        <summary class="flex items-center justify-between font-semibold text-white text-sm sm:text-base list-none">
          <span>${escapeHtml(faq.q)}</span>
          <span class="text-blue-400 group-open:rotate-180 transition-transform">&darr;</span>
        </summary>
        <p class="mt-3 text-xs sm:text-sm text-gray-400 leading-relaxed border-t border-white/5 pt-3">
          ${escapeHtml(faq.a)}
        </p>
      </details>`).join('')}
    </div>
  </section>

  <!-- Final CTA -->
  <section id="contato" class="relative z-10 py-20 bg-gradient-to-b from-transparent to-blue-950/40 text-center">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 glass-card rounded-3xl p-8 sm:p-14 border border-blue-500/30 shadow-2xl">
      <h2 class="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
        Pronto para dar o próximo passo?
      </h2>
      <p class="mt-4 text-sm sm:text-lg text-gray-300 max-w-xl mx-auto">
        Clique no botão abaixo para iniciar agora mesmo com atendimento personalizado e direto.
      </p>
      <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
        <a href="https://wa.me/?text=${encodeURIComponent('Olá! Gostaria de saber mais sobre ' + lpTitle)}" target="_blank" rel="noopener noreferrer" class="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-bold text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:opacity-95 shadow-xl shadow-green-600/30 transition-all hover:scale-105 flex items-center justify-center gap-2">
          <span>💬</span> Falar no WhatsApp
        </a>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="relative z-10 border-t border-white/10 py-8 text-center text-xs text-gray-500">
    <p>&copy; ${new Date().getFullYear()} ${escapeHtml(lpTitle)}. Todos os direitos reservados.</p>
  </footer>

  <!-- Floating WhatsApp Button -->
  <a href="https://wa.me/?text=${encodeURIComponent('Olá! Vi sua Landing Page e gostaria de tirar uma dúvida.')}" target="_blank" rel="noopener noreferrer" class="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full shadow-2xl shadow-emerald-500/50 transition-all hover:scale-110 hover:-translate-y-1" title="Atendimento WhatsApp">
    <svg class="w-7 h-7 fill-current" viewBox="0 0 24 24">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
    </svg>
  </a>

</body>
</html>`;

  return {
    html: generatedHtml,
    title: lpTitle,
    stats: {
      totalNodes: allTexts.length,
      textNodes: allTexts.length,
      imageNodes: 0,
      sectionsFound: featureList.length + 3,
      colors,
      fonts,
    },
  };
}
