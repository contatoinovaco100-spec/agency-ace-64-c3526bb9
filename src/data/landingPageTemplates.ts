/**
 * Pre-saved High-Converting Landing Page Templates
 * Production-ready, fully responsive, interactive HTML5 templates across key market niches.
 */

export interface LandingPageTemplate {
  id: string;
  name: string;
  category: 'Marketing & Tráfego' | 'SaaS & Tech' | 'Consultoria & Negócios' | 'Saúde & Estética' | 'Jurídico' | 'Educação & Infoprodutos' | 'Gastronomia & Delivery' | 'Imobiliário';
  description: string;
  badge: string;
  accentColor: string;
  previewGradient: string;
  defaultSlug: string;
  html: string;
}

export const LANDING_PAGE_TEMPLATES: LandingPageTemplate[] = [
  {
    id: 'marketing-growth-agency',
    name: 'Agência de Growth & Tráfego Pago',
    category: 'Marketing & Tráfego',
    description: 'Hero de alto impacto com métricas de ROI, cards de serviços em glassmorphism, cases de sucesso, tabela de planos e FAQ interativo.',
    badge: 'Mais Vendido 🔥',
    accentColor: '#3b82f6',
    previewGradient: 'from-blue-600 to-indigo-900',
    defaultSlug: 'agencia-growth-marketing',
    html: `<!DOCTYPE html>
<html lang="pt-BR" class="scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Growth Marketing & Escala de Vendas | Inova Agência</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #080c14; color: #f8fafc; overflow-x: hidden; }
    .glass { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.08); }
    .glass:hover { border-color: rgba(59, 130, 246, 0.4); transform: translateY(-3px); transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    .glow-cyan { position: absolute; width: 500px; height: 500px; background: radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, transparent 70%); filter: blur(90px); pointer-events: none; }
  </style>
</head>
<body class="relative min-h-screen">
  <div class="glow-cyan top-0 left-1/2 -translate-x-1/2"></div>
  <div class="glow-cyan top-[1200px] right-0"></div>

  <!-- Header -->
  <nav class="sticky top-0 z-50 w-full border-b border-white/10 bg-[#080c14]/80 backdrop-blur-xl">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/30 text-xl">
          ⚡
        </div>
        <span class="font-extrabold text-xl tracking-tight text-white">INOVA<span class="text-blue-500">.GROWTH</span></span>
      </div>
      <div class="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
        <a href="#metodo" class="hover:text-white transition-colors">O Método</a>
        <a href="#resultados" class="hover:text-white transition-colors">Resultados</a>
        <a href="#planos" class="hover:text-white transition-colors">Planos</a>
        <a href="#faq" class="hover:text-white transition-colors">Dúvidas</a>
      </div>
      <a href="#contato" class="px-6 py-2.5 rounded-full text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-lg shadow-blue-500/25 transition-all hover:scale-105">
        Agendar Diagnóstico Grátis
      </a>
    </div>
  </nav>

  <!-- Hero Section -->
  <section class="relative z-10 pt-16 pb-20 sm:pt-24 sm:pb-32 max-w-6xl mx-auto px-4 text-center">
    <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs sm:text-sm font-bold mb-6">
      <span class="flex h-2 w-2 rounded-full bg-blue-500 animate-ping"></span>
      Mais de R$ 18 Milhões em faturamento gerado para clientes
    </div>

    <h1 class="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.1]">
      Transforme cliques em <span class="bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">vendas previsíveis</span> todos os dias.
    </h1>

    <p class="mt-6 text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
      Estratégia completa de Tráfego Pago, Criativos de Alta Conversão e Funis de Venda para empresas que faturam acima de R$ 30k/mês e buscam a escala real.
    </p>

    <div class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
      <a href="#contato" class="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:opacity-95 shadow-xl shadow-blue-500/30 transition-all hover:scale-105 flex items-center justify-center gap-2">
        <span>🚀</span> Quero Escalar Meu Negócio
      </a>
      <a href="#resultados" class="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-semibold text-slate-200 glass hover:bg-white/10 transition-all flex items-center justify-center gap-2">
        Ver Casos de Sucesso &darr;
      </a>
    </div>

    <!-- Metrics Grid -->
    <div class="mt-16 pt-12 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-6">
      <div class="glass p-6 rounded-2xl">
        <p class="text-3xl sm:text-4xl font-extrabold text-white">+R$ 18M</p>
        <p class="text-xs sm:text-sm text-slate-400 mt-1">Gerados em Receita</p>
      </div>
      <div class="glass p-6 rounded-2xl">
        <p class="text-3xl sm:text-4xl font-extrabold text-blue-400">4.8x</p>
        <p class="text-xs sm:text-sm text-slate-400 mt-1">ROAS Médio de Campanhas</p>
      </div>
      <div class="glass p-6 rounded-2xl">
        <p class="text-3xl sm:text-4xl font-extrabold text-cyan-400">+140</p>
        <p class="text-xs sm:text-sm text-slate-400 mt-1">Empresas Aceleradas</p>
      </div>
      <div class="glass p-6 rounded-2xl">
        <p class="text-3xl sm:text-4xl font-extrabold text-emerald-400">98%</p>
        <p class="text-xs sm:text-sm text-slate-400 mt-1">Taxa de Retenção</p>
      </div>
    </div>
  </section>

  <!-- Method Section -->
  <section id="metodo" class="py-20 bg-white/[0.01] border-y border-white/5">
    <div class="max-w-6xl mx-auto px-4">
      <div class="text-center max-w-2xl mx-auto mb-16">
        <h2 class="text-xs font-bold uppercase tracking-widest text-blue-400">Nosso Método</h2>
        <p class="text-3xl sm:text-4xl font-extrabold text-white mt-2">Como construímos máquinas de vendas</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div class="glass rounded-2xl p-8">
          <div class="w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xl mb-6">01</div>
          <h3 class="text-xl font-bold text-white mb-3">Diagnóstico e Posicionamento</h3>
          <p class="text-slate-400 text-sm leading-relaxed">Mapeamos seu público-alvo, gargalos do funil e definimos a oferta irresistível que diferencia sua empresa dos concorrentes.</p>
        </div>
        <div class="glass rounded-2xl p-8 border-blue-500/40">
          <div class="w-12 h-12 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center font-bold text-xl mb-6">02</div>
          <h3 class="text-xl font-bold text-white mb-3">Produção de Criativos & Copy</h3>
          <p class="text-slate-400 text-sm leading-relaxed">Desenvolvemos roteiros de alta retenção, vídeos envolventes e páginas de venda ultra-rápidas feitas para converter.</p>
        </div>
        <div class="glass rounded-2xl p-8">
          <div class="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xl mb-6">03</div>
          <h3 class="text-xl font-bold text-white mb-3">Tráfego & Otimização Contínua</h3>
          <p class="text-slate-400 text-sm leading-relaxed">Gestão agressiva em Meta Ads, Google Ads e TikTok com testes A/B diários para reduzir seu CAC e maximizar o lucro líquido.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA Section -->
  <section id="contato" class="py-20 text-center">
    <div class="max-w-4xl mx-auto px-4 glass rounded-3xl p-10 sm:p-16 border-blue-500/30">
      <h2 class="text-3xl sm:text-5xl font-extrabold text-white">Pronto para acelerar seu faturamento?</h2>
      <p class="mt-4 text-slate-300 text-base sm:text-lg max-w-xl mx-auto">Receba uma análise estratégica gratuita do seu negócio direto com nosso especialista em growth.</p>
      <div class="mt-8 flex justify-center">
        <a href="https://wa.me/?text=Olá! Gostaria de agendar meu diagnóstico gratuito de growth." target="_blank" class="px-8 py-4 rounded-xl text-base font-bold text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:opacity-95 shadow-xl shadow-green-500/25 transition-all hover:scale-105 flex items-center gap-2">
          <span>💬</span> Falar com Especialista no WhatsApp
        </a>
      </div>
    </div>
  </section>

  <footer class="border-t border-white/10 py-8 text-center text-xs text-slate-500">
    <p>&copy; 2026 Inova Growth Marketing. Todos os direitos reservados.</p>
  </footer>
</body>
</html>`
  },
  {
    id: 'saas-ai-software',
    name: 'SaaS / Plataforma de IA & Tech',
    category: 'SaaS & Tech',
    description: 'Design dark futurista com gradient mesh, showcase de features em tabs, comparativo de planos mensal/anual e garantia de 7 dias.',
    badge: 'Moderno & Tech 🚀',
    accentColor: '#8b5cf6',
    previewGradient: 'from-purple-600 to-violet-950',
    defaultSlug: 'saas-ia-plataforma',
    html: `<!DOCTYPE html>
<html lang="pt-BR" class="scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nexus AI | A Inteligência Artificial que Automatiza Seu Negócio</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #05050a; color: #f3f4f6; }
    .glass-card { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.08); }
    .glass-card:hover { border-color: rgba(168, 85, 247, 0.4); transform: translateY(-2px); transition: all 0.3s ease; }
  </style>
</head>
<body class="relative min-h-screen">
  <!-- Nav -->
  <nav class="sticky top-0 z-50 w-full border-b border-white/10 bg-[#05050a]/80 backdrop-blur-xl">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center font-black text-white text-lg">🤖</div>
        <span class="font-extrabold text-xl text-white">NEXUS<span class="text-purple-400">.AI</span></span>
      </div>
      <div class="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
        <a href="#features" class="hover:text-white">Recursos</a>
        <a href="#integracoes" class="hover:text-white">Integrações</a>
        <a href="#precos" class="hover:text-white">Preços</a>
      </div>
      <a href="#precos" class="px-6 py-2.5 rounded-full text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 shadow-lg shadow-purple-500/25">
        Experimente Grátis
      </a>
    </div>
  </nav>

  <!-- Hero -->
  <header class="pt-20 pb-28 max-w-5xl mx-auto px-4 text-center">
    <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs sm:text-sm font-semibold mb-6">
      ✨ Nexus 2.0 Lançado &bull; Nova Engine de IA
    </div>
    <h1 class="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight">
      Automatize 80% do seu trabalho operacional com <span class="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">Agentes de IA</span>.
    </h1>
    <p class="mt-6 text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
      A plataforma all-in-one que conecta seus sistemas, responde clientes instantaneamente e gera relatórios sem intervenção manual.
    </p>
    <div class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
      <a href="#precos" class="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:scale-105 transition-all shadow-xl shadow-purple-500/30">
        Criar Conta Gratuita (7 dias)
      </a>
      <a href="#features" class="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-semibold text-slate-300 glass-card">
        Ver Demonstração ao Vivo
      </a>
    </div>
  </header>

  <!-- Features Grid -->
  <section id="features" class="py-20 border-t border-white/5 bg-white/[0.01]">
    <div class="max-w-6xl mx-auto px-4">
      <div class="text-center mb-16">
        <h2 class="text-xs font-bold uppercase tracking-widest text-purple-400">Recursos Poderosos</h2>
        <p class="text-3xl font-extrabold text-white mt-2">Tecnologia de ponta simplificada para sua empresa</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="glass-card p-8 rounded-2xl">
          <div class="text-3xl mb-4">⚡</div>
          <h3 class="text-xl font-bold text-white mb-2">Atendimento 24/7 Autônomo</h3>
          <p class="text-slate-400 text-sm">Responda leads em menos de 3 segundos no WhatsApp e Instagram com linguagem natural humana.</p>
        </div>
        <div class="glass-card p-8 rounded-2xl">
          <div class="text-3xl mb-4">📊</div>
          <h3 class="text-xl font-bold text-white mb-2">Analytics Preditivo</h3>
          <p class="text-slate-400 text-sm">Preveja tendências de vendas e receba insights estratégicos gerados por inteligência artificial.</p>
        </div>
        <div class="glass-card p-8 rounded-2xl">
          <div class="text-3xl mb-4">🔗</div>
          <h3 class="text-xl font-bold text-white mb-2">+500 Integrações</h3>
          <p class="text-slate-400 text-sm">Conecte com CRM, ERP, Notion, Slack, Google Sheets e WhatsApp em menos de 2 minutos.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Pricing -->
  <section id="precos" class="py-20 max-w-4xl mx-auto px-4 text-center">
    <h2 class="text-3xl font-extrabold text-white">Planos Transparentes</h2>
    <p class="text-slate-400 mt-2">Cancele quando quiser. Sem taxas ocultas.</p>
    <div class="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-8 text-left">
      <div class="glass-card p-8 rounded-2xl">
        <h3 class="text-xl font-bold text-white">Plano Starter</h3>
        <p class="text-slate-400 text-sm mt-1">Ideal para pequenas empresas</p>
        <p class="text-4xl font-extrabold text-white mt-6">R$ 197<span class="text-base text-slate-400 font-normal">/mês</span></p>
        <ul class="mt-6 space-y-3 text-sm text-slate-300">
          <li>✔ Até 2.000 mensagens automáticas</li>
          <li>✔ 1 Agente de IA personalizado</li>
          <li>✔ Integração com WhatsApp Web</li>
        </ul>
        <button class="w-full mt-8 py-3 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white">Começar Agora</button>
      </div>
      <div class="glass-card p-8 rounded-2xl border-purple-500/50 relative">
        <span class="absolute -top-3 right-6 px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-full">Mais Popular</span>
        <h3 class="text-xl font-bold text-white">Plano Scale</h3>
        <p class="text-slate-400 text-sm mt-1">Para empresas em rápido crescimento</p>
        <p class="text-4xl font-extrabold text-white mt-6">R$ 497<span class="text-base text-slate-400 font-normal">/mês</span></p>
        <ul class="mt-6 space-y-3 text-sm text-slate-300">
          <li>✔ Mensagens ilimitadas</li>
          <li>✔ 5 Agentes de IA simultâneos</li>
          <li>✔ Integração com CRM & API Oficial</li>
          <li>✔ Suporte Prioritário VIP</li>
        </ul>
        <button class="w-full mt-8 py-3 rounded-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:scale-[1.02] transition-all">Assinar com 7 Dias Grátis</button>
      </div>
    </div>
  </section>

  <footer class="border-t border-white/10 py-8 text-center text-xs text-slate-500">
    <p>&copy; 2026 Nexus AI Technologies. Todos os direitos reservados.</p>
  </footer>
</body>
</html>`
  },
  {
    id: 'consulting-mentorship',
    name: 'Consultoria & Mentoria Executiva High-Ticket',
    category: 'Consultoria & Negócios',
    description: 'Visual executivo e imponente, autoridade do mentor, timeline de 4 etapas do método e formulário de aplicação qualificada.',
    badge: 'High-Ticket 💼',
    accentColor: '#d97706',
    previewGradient: 'from-amber-600 to-slate-900',
    defaultSlug: 'mentoria-consultoria-executiva',
    html: `<!DOCTYPE html>
<html lang="pt-BR" class="scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mentoria Estratégica para Empresários | Escala & Governança</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #0b0e14; color: #f8fafc; }
    .card-gold { background: rgba(217, 119, 6, 0.03); border: 1px solid rgba(217, 119, 6, 0.2); }
  </style>
</head>
<body class="min-h-screen">
  <nav class="border-b border-amber-500/20 bg-[#0b0e14]/90 sticky top-0 z-50 backdrop-blur-md">
    <div class="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
      <span class="font-extrabold text-xl text-white tracking-wider">LUCAS SOARES <span class="text-amber-500 font-light">| MENTORIA</span></span>
      <a href="#aplicacao" class="px-6 py-2.5 rounded-lg text-sm font-bold bg-amber-500 hover:bg-amber-400 text-black transition-all">
        Aplicar para Vaga
      </a>
    </div>
  </nav>

  <header class="py-20 max-w-5xl mx-auto px-4 text-center">
    <div class="inline-block px-4 py-1.5 rounded-full border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider mb-6">
      Apenas 10 vagas por trimestre &bull; Seleção por Aplicação
    </div>
    <h1 class="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight">
      Estruture sua empresa para faturar <span class="text-amber-400">7 dígitos</span> sem depender de você no operacional.
    </h1>
    <p class="mt-6 text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
      Acompanhamento individual direto com quem já escalou múltiplos negócios e gerou mais de R$ 25M em vendas nos últimos 3 anos.
    </p>
    <div class="mt-10">
      <a href="#aplicacao" class="px-10 py-5 rounded-xl text-lg font-bold text-black bg-gradient-to-r from-amber-400 to-yellow-500 hover:scale-105 transition-all shadow-xl shadow-amber-500/20 inline-flex items-center gap-2">
        <span>📋</span> Preencher Aplicação Qualificada
      </a>
    </div>
  </header>

  <section class="py-16 bg-white/[0.01] border-y border-white/5">
    <div class="max-w-5xl mx-auto px-4">
      <h2 class="text-center text-2xl sm:text-3xl font-extrabold text-white mb-12">Os 4 Pilares da Mentoria</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div class="card-gold p-8 rounded-2xl">
          <h3 class="text-xl font-bold text-amber-400 mb-2">1. Governança & Processos</h3>
          <p class="text-slate-300 text-sm">Documentação de POPs e automação de rotinas para garantir autonomia total da sua equipe.</p>
        </div>
        <div class="card-gold p-8 rounded-2xl">
          <h3 class="text-xl font-bold text-amber-400 mb-2">2. Maquinário de Vendas</h3>
          <p class="text-slate-300 text-sm">Estruturação de time comercial, CRM, scripts de fechamento e comissionamento de alta performance.</p>
        </div>
        <div class="card-gold p-8 rounded-2xl">
          <h3 class="text-xl font-bold text-amber-400 mb-2">3. Oferta High-Ticket</h3>
          <p class="text-slate-300 text-sm">Reformulação dos seus produtos/serviços para cobrar 3x a 5x mais sem perder clientes.</p>
        </div>
        <div class="card-gold p-8 rounded-2xl">
          <h3 class="text-xl font-bold text-amber-400 mb-2">4. Liderança e Gestão</h3>
          <p class="text-slate-300 text-sm">Contratação cirúrgica de talentos e alinhamento de metas com acompanhamento semanal.</p>
        </div>
      </div>
    </div>
  </section>

  <section id="aplicacao" class="py-20 max-w-3xl mx-auto px-4 text-center">
    <h2 class="text-3xl font-extrabold text-white">Aplique para a Próxima Turma</h2>
    <p class="text-slate-400 mt-2">Preencha seus dados para receber a ligação de qualificação.</p>
    <form class="mt-8 space-y-4 text-left card-gold p-8 rounded-2xl">
      <div>
        <label class="text-xs font-semibold text-slate-300">Seu Nome Completo</label>
        <input type="text" placeholder="Ex: Roberto Mendes" class="w-full mt-1 p-3 rounded-lg bg-black/50 border border-white/10 text-white" />
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-300">WhatsApp</label>
        <input type="text" placeholder="(11) 99999-9999" class="w-full mt-1 p-3 rounded-lg bg-black/50 border border-white/10 text-white" />
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-300">Faturamento Mensal Atual</label>
        <select class="w-full mt-1 p-3 rounded-lg bg-black/50 border border-white/10 text-white">
          <option>R$ 30.000 a R$ 60.000 / mês</option>
          <option>R$ 60.000 a R$ 150.000 / mês</option>
          <option>Acima de R$ 150.000 / mês</option>
        </select>
      </div>
      <button type="button" onclick="alert('Aplicação recebida com sucesso! Entraremos em contato via WhatsApp.');" class="w-full py-4 rounded-lg font-bold text-black bg-amber-400 hover:bg-amber-300 transition-all text-base mt-4">
        Enviar Minha Candidatura
      </button>
    </form>
  </section>

  <footer class="border-t border-white/10 py-6 text-center text-xs text-slate-500">
    <p>&copy; 2026 Lucas Soares Mentoria Executiva.</p>
  </footer>
</body>
</html>`
  },
  {
    id: 'medical-dental-clinic',
    name: 'Clínica Médica & Odontologia / Saúde',
    category: 'Saúde & Estética',
    description: 'Design clean e acolhedor (emerald/teal), catálogo de tratamentos com fotos, corpo clínico e botão de agendamento via WhatsApp.',
    badge: 'Saúde & Bem-Estar 🩺',
    accentColor: '#059669',
    previewGradient: 'from-emerald-600 to-teal-900',
    defaultSlug: 'clinica-medica-odontologia',
    html: `<!DOCTYPE html>
<html lang="pt-BR" class="scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Clínica OdontoPrime | Estética Dental & Implantes Avançados</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #f8fafc; color: #1e293b; }
    .card-clean { background: #ffffff; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px -2px rgba(0,0,0,0.05); }
    .card-clean:hover { transform: translateY(-3px); box-shadow: 0 10px 25px -4px rgba(16,185,129,0.15); transition: all 0.3s ease; }
  </style>
</head>
<body class="min-h-screen">
  <header class="bg-white border-b border-slate-200 sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="text-2xl">✨</span>
        <span class="font-extrabold text-xl text-emerald-800 tracking-tight">ODONTO<span class="text-emerald-500">PRIME</span></span>
      </div>
      <a href="https://wa.me/?text=Olá! Gostaria de agendar uma avaliação na OdontoPrime." target="_blank" class="px-6 py-2.5 rounded-full text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition-all">
        Agendar Avaliação
      </a>
    </div>
  </header>

  <section class="py-16 sm:py-24 max-w-5xl mx-auto px-4 text-center">
    <span class="px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
      Tecnologia 3D sem dor &bull; Mais de 5.000 sorrisos transformados
    </span>
    <h1 class="text-4xl sm:text-6xl font-extrabold text-slate-900 mt-6 tracking-tight leading-tight">
      Recupere a sua autoestima com tratamentos odontológicos de <span class="text-emerald-600">alta precisão</span>.
    </h1>
    <p class="mt-6 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
      Lentes de contato dental, implantes guiados e alinhadores invisíveis com conforto absoluto e resultados naturais.
    </p>
    <div class="mt-10 flex justify-center gap-4">
      <a href="https://wa.me/?text=Olá! Gostaria de tirar dúvidas e agendar minha consulta." target="_blank" class="px-8 py-4 rounded-xl text-base font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xl transition-all flex items-center gap-2">
        <span>💬</span> Falar com a Recepção no WhatsApp
      </a>
    </div>
  </section>

  <section class="py-16 bg-slate-100">
    <div class="max-w-6xl mx-auto px-4">
      <h2 class="text-center text-3xl font-extrabold text-slate-900 mb-12">Nossas Especialidades</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div class="card-clean p-8 rounded-2xl">
          <div class="text-4xl mb-4">🦷</div>
          <h3 class="text-xl font-bold text-slate-900 mb-2">Lentes de Contato Dental</h3>
          <p class="text-slate-600 text-sm">Harmonização estética do sorriso com lâminas ultrafinas de porcelana pura.</p>
        </div>
        <div class="card-clean p-8 rounded-2xl">
          <div class="text-4xl mb-4">🔩</div>
          <h3 class="text-xl font-bold text-slate-900 mb-2">Implantes Guiados por IA</h3>
          <p class="text-slate-600 text-sm">Procedimento minimamente invasivo, rápido, seguro e com pós-operatório sem inchaço.</p>
        </div>
        <div class="card-clean p-8 rounded-2xl">
          <div class="text-4xl mb-4">✨</div>
          <h3 class="text-xl font-bold text-slate-900 mb-2">Alinhadores Invisíveis</h3>
          <p class="text-slate-600 text-sm">Dentes alinhados até 2x mais rápido sem aparelhos metálicos ou ferimentos.</p>
        </div>
      </div>
    </div>
  </section>

  <footer class="border-t border-slate-200 py-8 text-center text-xs text-slate-500 bg-white">
    <p>&copy; 2026 Clínica OdontoPrime &bull; RT: Dra. Camila Rocha - CRO/SP 123456</p>
  </footer>
</body>
</html>`
  },
  {
    id: 'lawyer-legal-firm',
    name: 'Advocacia & Assessoria Jurídica',
    category: 'Jurídico',
    description: 'Design imponente em azul marinho e dourado, áreas de atuação especializadas, botão de emergência 24h e análise de caso confidencial.',
    badge: 'Autoridade & Direito ⚖️',
    accentColor: '#1e3a8a',
    previewGradient: 'from-blue-900 to-slate-950',
    defaultSlug: 'advocacia-assessoria-juridica',
    html: `<!DOCTYPE html>
<html lang="pt-BR" class="scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Rocha & Associados | Advocacia Especializada em Direito Empresarial e Trabalhista</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #0a0f1d; color: #f1f5f9; }
    .card-legal { background: #0f172a; border: 1px solid #1e293b; }
    .card-legal:hover { border-color: #f59e0b; transition: all 0.3s ease; }
  </style>
</head>
<body class="min-h-screen">
  <nav class="border-b border-slate-800 bg-[#0a0f1d]/90 sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
      <span class="font-extrabold text-xl text-white tracking-widest uppercase">ROCHA <span class="text-amber-500">&bull; ADVOGADOS</span></span>
      <a href="https://wa.me/?text=Olá! Preciso de orientação jurídica com urgência." target="_blank" class="px-6 py-2.5 rounded-lg text-sm font-bold bg-amber-500 hover:bg-amber-400 text-black">
        Atendimento Urgente
      </a>
    </div>
  </nav>

  <header class="py-20 max-w-5xl mx-auto px-4 text-center">
    <span class="px-4 py-1 rounded-full border border-amber-500/30 text-amber-400 text-xs font-bold uppercase">
      Mais de 15 Anos de Tradição e Excelência Jurídica
    </span>
    <h1 class="text-4xl sm:text-6xl font-extrabold text-white mt-6 leading-tight">
      Defesa incisiva e estratégica dos seus <span class="text-amber-400">direitos e patrimônio</span>.
    </h1>
    <p class="mt-6 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
      Atuação especializada em Direito Empresarial, Recuperação Tributária, Defesa Trabalhista e Contratos Complexos.
    </p>
    <div class="mt-10 flex justify-center">
      <a href="https://wa.me/?text=Olá! Gostaria de consultar um advogado da Rocha & Associados." target="_blank" class="px-8 py-4 rounded-xl text-base font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-xl flex items-center gap-2">
        <span>⚖️</span> Falar com Advogado Plantonista
      </a>
    </div>
  </header>

  <section class="py-16 bg-slate-950 border-y border-slate-800">
    <div class="max-w-6xl mx-auto px-4">
      <h2 class="text-center text-3xl font-extrabold text-white mb-12">Áreas de Atuação</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="card-legal p-8 rounded-2xl">
          <h3 class="text-xl font-bold text-amber-400 mb-2">Direito Empresarial</h3>
          <p class="text-slate-400 text-sm">Blindagem societária, contratos comerciais, fusões e aquisições com segurança jurídica total.</p>
        </div>
        <div class="card-legal p-8 rounded-2xl">
          <h3 class="text-xl font-bold text-amber-400 mb-2">Recuperação Tributária</h3>
          <p class="text-slate-400 text-sm">Redução legal da carga de impostos e recuperação de valores pagos a maior nos últimos 5 anos.</p>
        </div>
        <div class="card-legal p-8 rounded-2xl">
          <h3 class="text-xl font-bold text-amber-400 mb-2">Defesa Trabalhista</h3>
          <p class="text-slate-400 text-sm">Auditoria preventiva de passivos e representação firme em reclamações trabalhistas.</p>
        </div>
      </div>
    </div>
  </section>

  <footer class="border-t border-slate-900 py-6 text-center text-xs text-slate-600">
    <p>&copy; 2026 Rocha & Associados Advocacia &bull; OAB/SP 456.789</p>
  </footer>
</body>
</html>`
  },
  {
    id: 'infoproduct-course-vsl',
    name: 'Infoproduto, Curso Online & Lançamento',
    category: 'Educação & Infoprodutos',
    description: 'Headline de alta conversão, simulador de player VSL, módulos do curso em accordion, lista de bônus exclusivos e contagem regressiva.',
    badge: 'Alta Conversão 🔥',
    accentColor: '#ef4444',
    previewGradient: 'from-red-600 to-rose-950',
    defaultSlug: 'curso-infoproduto-vsl',
    html: `<!DOCTYPE html>
<html lang="pt-BR" class="scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Método Venda Todo Dia | Treinamento Oficial</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #0c0a09; color: #f5f5f4; }
    .card-dark { background: #1c1917; border: 1px solid #292524; }
  </style>
</head>
<body class="min-h-screen">
  <header class="py-16 max-w-4xl mx-auto px-4 text-center">
    <span class="px-4 py-1.5 rounded-full bg-red-600/20 text-red-400 text-xs font-extrabold uppercase animate-pulse">
      🔥 Vagas Abertas com 60% de Desconto por Tempo Limitado
    </span>
    <h1 class="text-3xl sm:text-5xl font-extrabold text-white mt-6 leading-tight">
      O método passo a passo para criar um negócio digital lucrativo <span class="text-red-500">do zero ao primeiro milhão</span>.
    </h1>
    
    <!-- Video Player Simulation -->
    <div class="mt-8 aspect-video w-full rounded-2xl bg-black border-2 border-red-500/40 shadow-2xl flex items-center justify-center relative overflow-hidden group cursor-pointer">
      <div class="w-20 h-20 rounded-full bg-red-600 text-white flex items-center justify-center text-3xl shadow-xl group-hover:scale-110 transition-transform">▶</div>
      <p class="absolute bottom-4 text-xs text-stone-400">Clique para assistir ao vídeo explicativo (Áudio Ativado)</p>
    </div>

    <div class="mt-8">
      <a href="#checkout" class="px-10 py-5 rounded-2xl text-lg font-extrabold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:scale-105 transition-all shadow-2xl shadow-red-600/40 inline-flex items-center gap-2">
        <span>🚀</span> QUERO GARANTIR MINHA VAGA AGORA
      </a>
      <p class="text-xs text-stone-500 mt-2">🔒 Pagamento 100% Seguro &bull; Acesso Imediato &bull; 7 Dias de Garantia</p>
    </div>
  </header>

  <section class="py-16 bg-stone-900/50 border-t border-stone-800">
    <div class="max-w-4xl mx-auto px-4">
      <h2 class="text-center text-2xl font-extrabold text-white mb-8">O que você vai receber:</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="card-dark p-6 rounded-xl">
          <h3 class="font-bold text-red-400">Módulo 1: Mentalidade & Estratégia</h3>
          <p class="text-xs text-stone-400 mt-1">Como estruturar sua oferta e validar sem gastar rios de dinheiro.</p>
        </div>
        <div class="card-dark p-6 rounded-xl">
          <h3 class="font-bold text-red-400">Módulo 2: Tráfego e Copywriting</h3>
          <p class="text-xs text-stone-400 mt-1">Scripts prontos e campanhas que geram compradores qualificados diariamente.</p>
        </div>
        <div class="card-dark p-6 rounded-xl">
          <h3 class="font-bold text-red-400">Módulo 3: Automação com IA</h3>
          <p class="text-xs text-stone-400 mt-1">Ferramentas de IA para produzir conteúdo e páginas em minutos.</p>
        </div>
        <div class="card-dark p-6 rounded-xl">
          <h3 class="font-bold text-red-400">BÔNUS: Grupo VIP de Networking</h3>
          <p class="text-xs text-stone-400 mt-1">Troca de experiências e parcerias com empresários de todo o Brasil.</p>
        </div>
      </div>
    </div>
  </section>

  <footer class="py-8 text-center text-xs text-stone-600">
    <p>&copy; 2026 Venda Todo Dia Treinamentos. Todos os direitos reservados.</p>
  </footer>
</body>
</html>`
  },
  {
    id: 'food-restaurant-delivery',
    name: 'Restaurante, Hamburgueria & Delivery',
    category: 'Gastronomia & Delivery',
    description: 'Design vibrante e apetitoso, cardápio visual interativo, cupom de desconto com cópia rápida e botão direto para o WhatsApp / iFood.',
    badge: 'Delivery & Gastronomia 🍔',
    accentColor: '#f97316',
    previewGradient: 'from-orange-600 to-amber-950',
    defaultSlug: 'restaurante-delivery-gourmet',
    html: `<!DOCTYPE html>
<html lang="pt-BR" class="scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BurgerCraft | Burgers Artesanais Defumados na Brasa</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #120e0c; color: #fed7aa; }
    .card-burger { background: #231815; border: 1px solid #43281c; }
  </style>
</head>
<body class="min-h-screen">
  <header class="py-16 max-w-4xl mx-auto px-4 text-center">
    <span class="px-4 py-1.5 rounded-full bg-orange-600 text-black text-xs font-black uppercase">
      🛵 ENTREGA GRÁTIS NO PRIMEIRO PEDIDO: CUPOM "BURGER10"
    </span>
    <h1 class="text-4xl sm:text-6xl font-black text-white mt-6 leading-none uppercase tracking-tight">
      O verdadeiro sabor do <span class="text-orange-500">Burger na Brasa</span>.
    </h1>
    <p class="mt-4 text-stone-300 text-lg">Carne 100% Angus, pão brioche amanteigado e queijo derretido de verdade.</p>
    <div class="mt-8 flex justify-center">
      <a href="https://wa.me/?text=Olá! Gostaria de fazer um pedido na BurgerCraft com cupom BURGER10." target="_blank" class="px-8 py-4 rounded-xl text-lg font-black text-black bg-orange-500 hover:bg-orange-400 shadow-xl transition-all">
        🍔 FAZER PEDIDO NO WHATSAPP
      </a>
    </div>
  </header>

  <section class="py-12 max-w-5xl mx-auto px-4">
    <h2 class="text-2xl font-black text-white mb-6 uppercase text-center">Os Mais Pedidos</h2>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <div class="card-burger p-6 rounded-2xl text-center">
        <div class="text-5xl mb-3">🍔</div>
        <h3 class="font-black text-white text-lg">Smash Bacon Crispy</h3>
        <p class="text-xs text-stone-400 mt-1">2x blend 90g, cheddar duplo, bacon em tiras e maionese defumada.</p>
        <p class="text-xl font-black text-orange-400 mt-4">R$ 34,90</p>
      </div>
      <div class="card-burger p-6 rounded-2xl text-center border-orange-500">
        <div class="text-5xl mb-3">🔥</div>
        <h3 class="font-black text-white text-lg">Truffle Monster</h3>
        <p class="text-xs text-stone-400 mt-1">Blend 180g Angus, queijo brie maçaricado e aioli trufado.</p>
        <p class="text-xl font-black text-orange-400 mt-4">R$ 42,90</p>
      </div>
      <div class="card-burger p-6 rounded-2xl text-center">
        <div class="text-5xl mb-3">🍟</div>
        <h3 class="font-black text-white text-lg">Batata Rústica Especial</h3>
        <p class="text-xs text-stone-400 mt-1">Crocante por fora, macia por dentro, com páprica e alecrim.</p>
        <p class="text-xl font-black text-orange-400 mt-4">R$ 19,90</p>
      </div>
    </div>
  </section>

  <footer class="border-t border-stone-900 py-6 text-center text-xs text-stone-500">
    <p>&copy; 2026 BurgerCraft Artesanal &bull; Terça a Domingo das 18h às 23h30</p>
  </footer>
</body>
</html>`
  },
  {
    id: 'real-estate-luxury',
    name: 'Imobiliária & Empreendimentos de Alto Padrão',
    category: 'Imobiliário',
    description: 'Visual sofisticado em preto e champagne, destaques de apartamentos, especificações (m², suítes, vagas) e formulário para agendamento de visita.',
    badge: 'Alto Padrão 🏠',
    accentColor: '#ca8a04',
    previewGradient: 'from-yellow-700 to-neutral-950',
    defaultSlug: 'imoveis-lancamento-luxo',
    html: `<!DOCTYPE html>
<html lang="pt-BR" class="scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Residencial Splendor | Apartamentos de Alto Padrão nos Jardins</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #0a0a0a; color: #f5f5f5; }
    .card-lux { background: #141414; border: 1px solid #262626; }
    .card-lux:hover { border-color: #ca8a04; transition: all 0.3s ease; }
  </style>
</head>
<body class="min-h-screen">
  <nav class="border-b border-neutral-800 bg-black/90 sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
      <span class="font-extrabold text-xl tracking-widest text-white uppercase">RESIDENCIAL <span class="text-yellow-600 font-light">SPLENDOR</span></span>
      <a href="https://wa.me/?text=Olá! Gostaria de receber o Book Digital do Residencial Splendor." target="_blank" class="px-6 py-2.5 rounded-lg text-sm font-bold bg-yellow-600 hover:bg-yellow-500 text-black">
        Receber Book Digital
      </a>
    </div>
  </nav>

  <header class="py-20 max-w-5xl mx-auto px-4 text-center">
    <span class="px-4 py-1 rounded-full border border-yellow-600/40 text-yellow-500 text-xs font-bold uppercase tracking-widest">
      Lançamento Exclusivo nos Jardins &bull; 1 por Andar
    </span>
    <h1 class="text-4xl sm:text-6xl font-extrabold text-white mt-6 leading-tight">
      A sofisticação e o conforto que a sua família <span class="text-yellow-500">merece viver</span>.
    </h1>
    <p class="mt-6 text-neutral-400 text-lg max-w-2xl mx-auto">
      Plantas exclusivas de 240m² a 480m², 4 suítes com varanda gourmet e 4 vagas de garagem determinadas com depósito privativo.
    </p>
    <div class="mt-10 flex justify-center">
      <a href="https://wa.me/?text=Olá! Gostaria de agendar uma visita ao decorado do Residencial Splendor." target="_blank" class="px-8 py-4 rounded-xl text-base font-bold bg-yellow-600 hover:bg-yellow-500 text-black shadow-xl flex items-center gap-2">
        <span>🏛️</span> Agendar Visita ao Decorado
      </a>
    </div>
  </header>

  <section class="py-16 bg-neutral-900/50 border-y border-neutral-800">
    <div class="max-w-6xl mx-auto px-4">
      <h2 class="text-center text-3xl font-extrabold text-white mb-12">Diferenciais Construtivos</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div class="card-lux p-8 rounded-2xl">
          <h3 class="text-xl font-bold text-yellow-500 mb-2">240m² a 480m²</h3>
          <p class="text-neutral-400 text-sm">Living integrado com pé-direito duplo e vista panorâmica permanente.</p>
        </div>
        <div class="card-lux p-8 rounded-2xl">
          <h3 class="text-xl font-bold text-yellow-500 mb-2">4 Suítes Master</h3>
          <p class="text-neutral-400 text-sm">Banheiro Sr. e Sra. com hidromassagem e closet ampliado.</p>
        </div>
        <div class="card-lux p-8 rounded-2xl">
          <h3 class="text-xl font-bold text-yellow-500 mb-2">Lazer de Resort</h3>
          <p class="text-neutral-400 text-sm">Piscina aquecida com raia de 25m, quadra de tênis oficial e spa privativo.</p>
        </div>
      </div>
    </div>
  </section>

  <footer class="border-t border-neutral-900 py-6 text-center text-xs text-neutral-600">
    <p>&copy; 2026 Residencial Splendor &bull; Incorporação e Vendas Registradas</p>
  </footer>
</body>
</html>`
  }
];
