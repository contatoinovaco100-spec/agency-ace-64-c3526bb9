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

const DS = {
  head: (title: string, accent: string, extraCss = "") => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',system-ui,sans-serif;background:#09090b;color:#fafafa;-webkit-font-smoothing:antialiased;overflow-x:hidden;line-height:1.6}
a{text-decoration:none;color:inherit}
img{max-width:100%;display:block}
.container{max-width:1120px;margin:0 auto;padding:0 24px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px;transition:all 0.2s ease;cursor:pointer;border:none}
.btn-primary{background:${accent};color:#fff}
.btn-primary:hover{opacity:0.9;transform:translateY(-1px)}
.btn-outline{background:transparent;color:#fafafa;border:1px solid rgba(255,255,255,0.12)}
.btn-outline:hover{border-color:rgba(255,255,255,0.25);background:rgba(255,255,255,0.04)}
.section{padding:96px 0}
.section-label{font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${accent};margin-bottom:12px}
.section-title{font-size:clamp(28px,4vw,40px);font-weight:700;letter-spacing:-0.02em;line-height:1.15;color:#fafafa}
.section-desc{font-size:16px;color:#a1a1aa;margin-top:16px;max-width:560px;line-height:1.7}
.card{background:#18181b;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;transition:all 0.25s ease}
.card:hover{border-color:rgba(255,255,255,0.12);transform:translateY(-2px)}
.nav{position:sticky;top:0;z-index:50;background:rgba(9,9,11,0.85);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,0.06)}
.nav-inner{display:flex;align-items:center;justify-content:space-between;height:64px}
.nav-links{display:flex;gap:32px;font-size:14px;font-weight:500;color:#a1a1aa}
.nav-links a:hover{color:#fafafa}
.footer{border-top:1px solid rgba(255,255,255,0.06);padding:40px 0;text-align:center;font-size:13px;color:#52525b}
@media(max-width:768px){.section{padding:64px 0}.nav-links{display:none}}
${extraCss}
</style>
</head>`,
  footer: (year: number, company: string) => `<footer class="footer"><div class="container">&copy; ${year} ${company}. Todos os direitos reservados.</div></footer></body></html>`
};

export const LANDING_PAGE_TEMPLATES: LandingPageTemplate[] = [
  {
    id: 'marketing-growth-agency',
    name: 'Agência de Growth & Tráfego',
    category: 'Marketing & Tráfego',
    description: 'Hero limpo com métricas de ROI, cards de serviço minimalistas, seção de processo em 3 etapas e CTA final.',
    badge: 'Mais Vendido',
    accentColor: '#3b82f6',
    previewGradient: 'from-blue-600 to-slate-900',
    defaultSlug: 'agencia-growth',
    html: `${DS.head('Growth Marketing | Inova', '#3b82f6')}
<nav class="nav"><div class="container nav-inner">
  <a href="#" style="font-weight:700;font-size:18px;letter-spacing:-0.02em">INOVA<span style="color:#3b82f6">.</span></a>
  <div class="nav-links"><a href="#metodo">Método</a><a href="#resultados">Resultados</a><a href="#planos">Planos</a></div>
  <a href="#contato" class="btn btn-primary" style="padding:10px 24px;font-size:13px">Fale Conosco</a>
</div></nav>

<section class="section" style="text-align:center;padding:120px 0 80px">
  <div class="container">
    <div class="section-label">Tráfego Pago & Growth</div>
    <h1 style="font-size:clamp(36px,5.5vw,64px);font-weight:800;letter-spacing:-0.03em;line-height:1.08;max-width:720px;margin:0 auto">Aumente seu faturamento com dados, não achismos.</h1>
    <p style="font-size:18px;color:#a1a1aa;margin:24px auto 0;max-width:520px;line-height:1.7">Estratégia de tráfego pago, criativos de alta conversão e funis automatizados para empresas que querem escalar.</p>
    <div style="display:flex;gap:12px;justify-content:center;margin-top:40px;flex-wrap:wrap">
      <a href="#contato" class="btn btn-primary">Comece Agora</a>
      <a href="#resultados" class="btn btn-outline">Ver Resultados</a>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;margin-top:80px;max-width:640px;margin-left:auto;margin-right:auto">
      <div style="background:#18181b;padding:28px 16px;text-align:center"><div style="font-size:28px;font-weight:700;color:#fafafa">+R$ 18M</div><div style="font-size:12px;color:#71717a;margin-top:4px">Em receita gerada</div></div>
      <div style="background:#18181b;padding:28px 16px;text-align:center"><div style="font-size:28px;font-weight:700;color:#3b82f6">4.8x</div><div style="font-size:12px;color:#71717a;margin-top:4px">ROAS médio</div></div>
      <div style="background:#18181b;padding:28px 16px;text-align:center"><div style="font-size:28px;font-weight:700;color:#fafafa">+140</div><div style="font-size:12px;color:#71717a;margin-top:4px">Empresas atendidas</div></div>
      <div style="background:#18181b;padding:28px 16px;text-align:center"><div style="font-size:28px;font-weight:700;color:#22c55e">98%</div><div style="font-size:12px;color:#71717a;margin-top:4px">Retenção de clientes</div></div>
    </div>
  </div>
</section>

<section id="metodo" class="section" style="background:#0f0f11">
  <div class="container">
    <div class="section-label">Como funciona</div>
    <h2 class="section-title">Três etapas para escalar.</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:56px">
      <div class="card"><div style="font-size:11px;font-weight:600;color:#3b82f6;margin-bottom:16px">01</div><h3 style="font-size:18px;font-weight:600;margin-bottom:8px">Diagnóstico</h3><p style="font-size:14px;color:#a1a1aa;line-height:1.7">Mapeamos seu público, gargalos do funil e definimos a estratégia ideal.</p></div>
      <div class="card"><div style="font-size:11px;font-weight:600;color:#3b82f6;margin-bottom:16px">02</div><h3 style="font-size:18px;font-weight:600;margin-bottom:8px">Execução</h3><p style="font-size:14px;color:#a1a1aa;line-height:1.7">Criativos, copy e campanhas no ar com testes A/B contínuos.</p></div>
      <div class="card"><div style="font-size:11px;font-weight:600;color:#3b82f6;margin-bottom:16px">03</div><h3 style="font-size:18px;font-weight:600;margin-bottom:8px">Otimização</h3><p style="font-size:14px;color:#a1a1aa;line-height:1.7">Análise semanal de métricas, ajustes de bid e escalada automática.</p></div>
    </div>
  </div>
</section>

<section id="contato" class="section" style="text-align:center">
  <div class="container" style="max-width:560px">
    <div class="section-label">Próximo passo</div>
    <h2 class="section-title" style="margin:0 auto">Agende uma sessão gratuita.</h2>
    <p style="font-size:16px;color:#a1a1aa;margin-top:16px">30 minutos de análise estratégica do seu negócio sem compromisso.</p>
    <a href="https://wa.me/" target="_blank" class="btn btn-primary" style="margin-top:32px">WhatsApp</a>
  </div>
</section>
${DS.footer(2026, 'Inova Marketing')}</html>`
  },

  {
    id: 'saas-ai-software',
    name: 'SaaS / Plataforma de IA',
    category: 'SaaS & Tech',
    description: 'Design dark limpo com hero focado em produto, features em grid 3 colunas, pricing minimalista e prova social.',
    badge: 'Moderno',
    accentColor: '#8b5cf6',
    previewGradient: 'from-violet-600 to-slate-900',
    defaultSlug: 'saas-plataforma',
    html: `${DS.head('Nexus AI — Automação Inteligente', '#8b5cf6')}
<nav class="nav"><div class="container nav-inner">
  <a href="#" style="font-weight:700;font-size:18px;letter-spacing:-0.02em">NEXUS<span style="color:#8b5cf6">.AI</span></a>
  <div class="nav-links"><a href="#features">Recursos</a><a href="#precos">Preços</a></div>
  <a href="#precos" class="btn btn-primary" style="padding:10px 24px;font-size:13px">Começar Grátis</a>
</div></nav>

<section class="section" style="text-align:center;padding:120px 0 80px">
  <div class="container">
    <div class="section-label">Plataforma de IA</div>
    <h1 style="font-size:clamp(36px,5.5vw,64px);font-weight:800;letter-spacing:-0.03em;line-height:1.08;max-width:680px;margin:0 auto">Automatize processos com inteligência artificial.</h1>
    <p style="font-size:18px;color:#a1a1aa;margin:24px auto 0;max-width:480px;line-height:1.7">Conecte seus sistemas, responda clientes e gere relatórios — tudo sem intervenção manual.</p>
    <div style="display:flex;gap:12px;justify-content:center;margin-top:40px;flex-wrap:wrap">
      <a href="#precos" class="btn btn-primary">Teste 7 Dias Grátis</a>
      <a href="#features" class="btn btn-outline">Ver Recursos</a>
    </div>
  </div>
</section>

<section id="features" class="section" style="background:#0f0f11">
  <div class="container">
    <div class="section-label">Recursos</div>
    <h2 class="section-title">Feito para escalar.</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:56px">
      <div class="card"><div style="width:40px;height:40px;border-radius:10px;background:rgba(139,92,246,0.12);display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:20px">⚡</div><h3 style="font-size:16px;font-weight:600;margin-bottom:8px">Atendimento 24/7</h3><p style="font-size:14px;color:#a1a1aa;line-height:1.7">Responda leads em segundos no WhatsApp e Instagram com linguagem natural.</p></div>
      <div class="card"><div style="width:40px;height:40px;border-radius:10px;background:rgba(139,92,246,0.12);display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:20px">📊</div><h3 style="font-size:16px;font-weight:600;margin-bottom:8px">Analytics Preditivo</h3><p style="font-size:14px;color:#a1a1aa;line-height:1.7">Preveja tendências de vendas e receba insights gerados por IA.</p></div>
      <div class="card"><div style="width:40px;height:40px;border-radius:10px;background:rgba(139,92,246,0.12);display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:20px">🔗</div><h3 style="font-size:16px;font-weight:600;margin-bottom:8px">+500 Integrações</h3><p style="font-size:14px;color:#a1a1aa;line-height:1.7">Conecte CRM, ERP, Notion, Slack e WhatsApp em minutos.</p></div>
    </div>
  </div>
</section>

<section id="precos" class="section" style="text-align:center">
  <div class="container" style="max-width:640px">
    <div class="section-label">Preços</div>
    <h2 class="section-title">Planos simples.</h2>
    <p style="font-size:15px;color:#71717a;margin-top:12px">Sem taxas ocultas. Cancele quando quiser.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:48px;text-align:left">
      <div class="card">
        <div style="font-size:14px;font-weight:600;color:#a1a1aa">Starter</div>
        <div style="font-size:36px;font-weight:700;margin:12px 0 4px">R$ 197<span style="font-size:14px;font-weight:400;color:#71717a">/mês</span></div>
        <ul style="list-style:none;margin:24px 0;font-size:14px;color:#a1a1aa;display:flex;flex-direction:column;gap:12px">
          <li style="display:flex;align-items:center;gap:8px"><span style="color:#22c55e">✓</span> 2.000 mensagens/mês</li>
          <li style="display:flex;align-items:center;gap:8px"><span style="color:#22c55e">✓</span> 1 Agente de IA</li>
          <li style="display:flex;align-items:center;gap:8px"><span style="color:#22c55e">✓</span> WhatsApp Web</li>
        </ul>
        <button class="btn btn-outline" style="width:100%">Começar</button>
      </div>
      <div class="card" style="border-color:rgba(139,92,246,0.4)">
        <div style="display:flex;align-items:center;justify-content:space-between"><div style="font-size:14px;font-weight:600;color:#a1a1aa">Scale</div><span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;background:rgba(139,92,246,0.15);color:#a78bfa">Popular</span></div>
        <div style="font-size:36px;font-weight:700;margin:12px 0 4px">R$ 497<span style="font-size:14px;font-weight:400;color:#71717a">/mês</span></div>
        <ul style="list-style:none;margin:24px 0;font-size:14px;color:#a1a1aa;display:flex;flex-direction:column;gap:12px">
          <li style="display:flex;align-items:center;gap:8px"><span style="color:#22c55e">✓</span> Mensagens ilimitadas</li>
          <li style="display:flex;align-items:center;gap:8px"><span style="color:#22c55e">✓</span> 5 Agentes de IA</li>
          <li style="display:flex;align-items:center;gap:8px"><span style="color:#22c55e">✓</span> CRM + API Oficial</li>
          <li style="display:flex;align-items:center;gap:8px"><span style="color:#22c55e">✓</span> Suporte prioritário</li>
        </ul>
        <button class="btn btn-primary" style="width:100%">Assinar</button>
      </div>
    </div>
  </div>
</section>
${DS.footer(2026, 'Nexus AI')}</html>`
  },

  {
    id: 'consulting-mentorship',
    name: 'Consultoria & Mentoria',
    category: 'Consultoria & Negócios',
    description: 'Visual executivo limpo, prova social com logos, processo em 4 etapas e formulário de aplicação.',
    badge: 'Premium',
    accentColor: '#d97706',
    previewGradient: 'from-amber-600 to-slate-900',
    defaultSlug: 'consultoria-executiva',
    html: `${DS.head('Mentoria Executiva | Inova', '#d97706')}
<nav class="nav"><div class="container nav-inner">
  <a href="#" style="font-weight:700;font-size:18px;letter-spacing:-0.02em">INOVA<span style="color:#d97706">.</span></a>
  <div class="nav-links"><a href="#sobre">Sobre</a><a href="#metodo">Método</a><a href="#depoimentos">Resultados</a></div>
  <a href="#contato" class="btn btn-primary" style="padding:10px 24px;font-size:13px">Aplicar</a>
</div></nav>

<section class="section" style="text-align:center;padding:120px 0 80px">
  <div class="container">
    <div class="section-label">Mentoria Executiva</div>
    <h1 style="font-size:clamp(36px,5.5vw,64px);font-weight:800;letter-spacing:-0.03em;line-height:1.08;max-width:680px;margin:0 auto">Escale seu negócio com uma mentoria de alto nível.</h1>
    <p style="font-size:18px;color:#a1a1aa;margin:24px auto 0;max-width:480px;line-height:1.7">Acompanhamento direto com especialistas que já escalaram mais de 100 empresas no Brasil.</p>
    <a href="#contato" class="btn btn-primary" style="margin-top:40px">Agendar Sessão Estratégica</a>
  </div>
</section>

<section style="padding:48px 0;border-top:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06)">
  <div class="container" style="text-align:center">
    <p style="font-size:12px;color:#52525b;text-transform:uppercase;letter-spacing:0.1em;font-weight:500">Empresas que confiam em nós</p>
    <div style="display:flex;align-items:center;justify-content:center;gap:48px;margin-top:24px;flex-wrap:wrap;opacity:0.4">
      <span style="font-size:18px;font-weight:700;letter-spacing:-0.02em">Company A</span>
      <span style="font-size:18px;font-weight:700;letter-spacing:-0.02em">Company B</span>
      <span style="font-size:18px;font-weight:700;letter-spacing:-0.02em">Company C</span>
      <span style="font-size:18px;font-weight:700;letter-spacing:-0.02em">Company D</span>
    </div>
  </div>
</section>

<section id="metodo" class="section">
  <div class="container">
    <div class="section-label">O Método</div>
    <h2 class="section-title">Quatro etapas para resultados.</h2>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-top:56px">
      <div class="card" style="text-align:center;padding:32px 20px"><div style="font-size:11px;font-weight:600;color:#d97706;margin-bottom:16px">01</div><h3 style="font-size:15px;font-weight:600;margin-bottom:6px">Diagnóstico</h3><p style="font-size:13px;color:#71717a;line-height:1.6">Análise completa do seu negócio e posicionamento.</p></div>
      <div class="card" style="text-align:center;padding:32px 20px"><div style="font-size:11px;font-weight:600;color:#d97706;margin-bottom:16px">02</div><h3 style="font-size:15px;font-weight:600;margin-bottom:6px">Estratégia</h3><p style="font-size:13px;color:#71717a;line-height:1.6">Plano de ação personalizado com metas claras.</p></div>
      <div class="card" style="text-align:center;padding:32px 20px"><div style="font-size:11px;font-weight:600;color:#d97706;margin-bottom:16px">03</div><h3 style="font-size:15px;font-weight:600;margin-bottom:6px">Execução</h3><p style="font-size:13px;color:#71717a;line-height:1.6">Implementação guiada com suporte semanal.</p></div>
      <div class="card" style="text-align:center;padding:32px 20px"><div style="font-size:11px;font-weight:600;color:#d97706;margin-bottom:16px">04</div><h3 style="font-size:15px;font-weight:600;margin-bottom:6px">Escala</h3><p style="font-size:13px;color:#71717a;line-height:1.6">Otimização contínua e expansão de resultados.</p></div>
    </div>
  </div>
</section>

<section id="contato" class="section" style="text-align:center">
  <div class="container" style="max-width:500px">
    <div class="section-label">Aplicação</div>
    <h2 class="section-title">Vagas limitadas.</h2>
    <p style="font-size:15px;color:#a1a1aa;margin-top:12px">Preencha e entraremos em contato em até 24h.</p>
    <div style="margin-top:32px;display:flex;flex-direction:column;gap:12px">
      <input placeholder="Seu nome" style="width:100%;padding:14px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:#18181b;color:#fafafa;font-size:14px;outline:none;font-family:inherit">
      <input placeholder="E-mail" style="width:100%;padding:14px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:#18181b;color:#fafafa;font-size:14px;outline:none;font-family:inherit">
      <input placeholder="WhatsApp" style="width:100%;padding:14px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:#18181b;color:#fafafa;font-size:14px;outline:none;font-family:inherit">
      <button class="btn btn-primary" style="width:100%;margin-top:4px">Enviar Aplicação</button>
    </div>
  </div>
</section>
${DS.footer(2026, 'Inova Consultoria')}</html>`
  },

  {
    id: 'health-aesthetics',
    name: 'Clínica de Estética & Saúde',
    category: 'Saúde & Estética',
    description: 'Tema claro com tipografia elegante, antes/depois, lista de procedimentos e agendamento online.',
    badge: 'Elegante',
    accentColor: '#059669',
    previewGradient: 'from-emerald-600 to-slate-900',
    defaultSlug: 'clinica-estetica',
    html: `${DS.head('Clínica Estética & Saúde', '#059669')}
<style>body{background:#fafafa;color:#18181b}.card{background:#fff;border:1px solid #e4e4e7}.btn-outline{border-color:#e4e4e7;color:#18181b}.btn-outline:hover{background:#f4f4f5;border-color:#d4d4d8}.nav{background:rgba(250,250,250,0.85);border-bottom-color:#e4e4e7}.nav-links{color:#71717a}.nav-links a:hover{color:#18181b}.section-label{color:#059669}.footer{border-top-color:#e4e4e7;color:#a1a1aa}</style>
<nav class="nav"><div class="container nav-inner">
  <a href="#" style="font-weight:700;font-size:18px;letter-spacing:-0.02em;color:#18181b">Estética<span style="color:#059669">.</span></a>
  <div class="nav-links"><a href="#procedimentos">Procedimentos</a><a href="#resultados">Resultados</a></div>
  <a href="#agendar" class="btn btn-primary" style="padding:10px 24px;font-size:13px">Agendar</a>
</div></nav>

<section class="section" style="text-align:center;padding:120px 0 80px">
  <div class="container">
    <div class="section-label">Clínica de Estética</div>
    <h1 style="font-size:clamp(36px,5.5vw,64px);font-weight:800;letter-spacing:-0.03em;line-height:1.08;max-width:640px;margin:0 auto;color:#18181b">Sua melhor versão começa aqui.</h1>
    <p style="font-size:18px;color:#71717a;margin:24px auto 0;max-width:460px;line-height:1.7">Tratamentos personalizados com tecnologia de ponta e profissionais certificados.</p>
    <a href="#agendar" class="btn btn-primary" style="margin-top:40px">Agendar Avaliação</a>
  </div>
</section>

<section id="procedimentos" class="section" style="background:#f4f4f5">
  <div class="container">
    <div class="section-label">Procedimentos</div>
    <h2 class="section-title" style="color:#18181b">Nossos tratamentos.</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:48px">
      <div class="card" style="padding:28px"><h3 style="font-size:16px;font-weight:600;margin-bottom:6px;color:#18181b">Harmonização Facial</h3><p style="font-size:14px;color:#71717a;line-height:1.7">Resultados naturais com preenchimento e bioestimuladores.</p></div>
      <div class="card" style="padding:28px"><h3 style="font-size:16px;font-weight:600;margin-bottom:6px;color:#18181b">Laser e Peeling</h3><p style="font-size:14px;color:#71717a;line-height:1.7">Renovação celular e tratamento de manchas com tecnologia avançada.</p></div>
      <div class="card" style="padding:28px"><h3 style="font-size:16px;font-weight:600;margin-bottom:6px;color:#18181b">Corporal</h3><p style="font-size:14px;color:#71717a;line-height:1.7">Redução de medidas e modelagem corporal não invasiva.</p></div>
    </div>
  </div>
</section>

<section id="agendar" class="section" style="text-align:center">
  <div class="container" style="max-width:480px">
    <div class="section-label">Agendamento</div>
    <h2 class="section-title" style="color:#18181b">Reserve seu horário.</h2>
    <div style="margin-top:32px;display:flex;flex-direction:column;gap:12px">
      <input placeholder="Nome completo" style="width:100%;padding:14px 16px;border-radius:12px;border:1px solid #e4e4e7;background:#fff;color:#18181b;font-size:14px;outline:none;font-family:inherit">
      <input placeholder="WhatsApp" style="width:100%;padding:14px 16px;border-radius:12px;border:1px solid #e4e4e7;background:#fff;color:#18181b;font-size:14px;outline:none;font-family:inherit">
      <button class="btn btn-primary" style="width:100%;margin-top:4px">Solicitar Agendamento</button>
    </div>
  </div>
</section>
${DS.footer(2026, 'Clínica Estética')}</html>`
  },

  {
    id: 'law-firm',
    name: 'Escritório de Advocacia',
    category: 'Jurídico',
    description: 'Visual institucional sóbrio, áreas de atuação, perfil do advogado e formulário de consulta.',
    badge: 'Institucional',
    accentColor: '#1d4ed8',
    previewGradient: 'from-blue-700 to-slate-900',
    defaultSlug: 'advocacia-escritorio',
    html: `${DS.head('Escritório de Advocacia', '#1d4ed8')}
<nav class="nav"><div class="container nav-inner">
  <a href="#" style="font-weight:700;font-size:18px;letter-spacing:-0.02em">ADVOCACIA<span style="color:#1d4ed8">.</span></a>
  <div class="nav-links"><a href="#areas">Áreas</a><a href="#sobre">Sobre</a><a href="#contato">Contato</a></div>
  <a href="#contato" class="btn btn-primary" style="padding:10px 24px;font-size:13px">Consulta</a>
</div></nav>

<section class="section" style="text-align:center;padding:120px 0 80px">
  <div class="container">
    <div class="section-label">Advocacia</div>
    <h1 style="font-size:clamp(36px,5.5vw,64px);font-weight:800;letter-spacing:-0.03em;line-height:1.08;max-width:640px;margin:0 auto">Defendendo seus direitos com excelência.</h1>
    <p style="font-size:18px;color:#a1a1aa;margin:24px auto 0;max-width:460px;line-height:1.7">Atendimento personalizado e resultados comprovados em mais de 1.000 casos.</p>
    <a href="#contato" class="btn btn-primary" style="margin-top:40px">Agendar Consulta</a>
  </div>
</section>

<section id="areas" class="section" style="background:#0f0f11">
  <div class="container">
    <div class="section-label">Áreas de Atuação</div>
    <h2 class="section-title">Especialidades.</h2>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-top:48px">
      <div class="card" style="display:flex;gap:16px;align-items:flex-start"><div style="width:36px;height:36px;border-radius:8px;background:rgba(29,78,216,0.12);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">⚖️</div><div><h3 style="font-size:15px;font-weight:600;margin-bottom:4px">Direito Civil</h3><p style="font-size:13px;color:#a1a1aa;line-height:1.6">Contratos, indenizações e responsabilidade civil.</p></div></div>
      <div class="card" style="display:flex;gap:16px;align-items:flex-start"><div style="width:36px;height:36px;border-radius:8px;background:rgba(29,78,216,0.12);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">🏢</div><div><h3 style="font-size:15px;font-weight:600;margin-bottom:4px">Direito Empresarial</h3><p style="font-size:13px;color:#a1a1aa;line-height:1.6">Consultoria preventiva e contencioso societário.</p></div></div>
      <div class="card" style="display:flex;gap:16px;align-items:flex-start"><div style="width:36px;height:36px;border-radius:8px;background:rgba(29,78,216,0.12);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">👨‍👩‍👧</div><div><h3 style="font-size:15px;font-weight:600;margin-bottom:4px">Direito de Família</h3><p style="font-size:13px;color:#a1a1aa;line-height:1.6">Divórcio, pensão, guarda e inventário.</p></div></div>
      <div class="card" style="display:flex;gap:16px;align-items:flex-start"><div style="width:36px;height:36px;border-radius:8px;background:rgba(29,78,216,0.12);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">📋</div><div><h3 style="font-size:15px;font-weight:600;margin-bottom:4px">Direito Trabalhista</h3><p style="font-size:13px;color:#a1a1aa;line-height:1.6">Rescisão, horas extras e assédio moral.</p></div></div>
    </div>
  </div>
</section>

<section id="contato" class="section" style="text-align:center">
  <div class="container" style="max-width:480px">
    <div class="section-label">Consulta</div>
    <h2 class="section-title">Fale com um advogado.</h2>
    <div style="margin-top:32px;display:flex;flex-direction:column;gap:12px">
      <input placeholder="Nome" style="width:100%;padding:14px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:#18181b;color:#fafafa;font-size:14px;outline:none;font-family:inherit">
      <input placeholder="E-mail" style="width:100%;padding:14px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:#18181b;color:#fafafa;font-size:14px;outline:none;font-family:inherit">
      <textarea placeholder="Descreva brevemente seu caso" rows="3" style="width:100%;padding:14px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:#18181b;color:#fafafa;font-size:14px;outline:none;font-family:inherit;resize:vertical"></textarea>
      <button class="btn btn-primary" style="width:100%;margin-top:4px">Enviar Mensagem</button>
    </div>
  </div>
</section>
${DS.footer(2026, 'Escritório de Advocacia')}</html>`
  },

  {
    id: 'education-courses',
    name: 'Curso & Infoproduto',
    category: 'Educação & Infoprodutos',
    description: 'Hero com prova social, módulos do curso em accordion, depoimentos e garantia.',
    badge: 'Alta Conversão',
    accentColor: '#ea580c',
    previewGradient: 'from-orange-600 to-slate-900',
    defaultSlug: 'curso-infoproduto',
    html: `${DS.head('Curso Online | Inova', '#ea580c')}
<nav class="nav"><div class="container nav-inner">
  <a href="#" style="font-weight:700;font-size:18px;letter-spacing:-0.02em">INOVA<span style="color:#ea580c">.</span></a>
  <div class="nav-links"><a href="#conteudo">Conteúdo</a><a href="#depoimentos">Depoimentos</a></div>
  <a href="#matricula" class="btn btn-primary" style="padding:10px 24px;font-size:13px">Matricule-se</a>
</div></nav>

<section class="section" style="text-align:center;padding:120px 0 80px">
  <div class="container">
    <div class="section-label">Curso Online</div>
    <h1 style="font-size:clamp(36px,5.5vw,64px);font-weight:800;letter-spacing:-0.03em;line-height:1.08;max-width:680px;margin:0 auto">Domine a ferramenta que vai transformar seu negócio.</h1>
    <p style="font-size:18px;color:#a1a1aa;margin:24px auto 0;max-width:480px;line-height:1.7">Do零 ao avançado em 8 módulos práticos. Acesso vitalício e comunidade exclusiva.</p>
    <div style="display:flex;gap:12px;justify-content:center;margin-top:40px;flex-wrap:wrap">
      <a href="#matricula" class="btn btn-primary">Garantir Minha Vaga</a>
      <a href="#conteudo" class="btn btn-outline">Ver Conteúdo</a>
    </div>
    <div style="display:flex;align-items:center;justify-content:center;gap:24px;margin-top:40px;font-size:14px;color:#a1a1aa">
      <span style="display:flex;align-items:center;gap:6px"><span style="color:#22c55e">✓</span> +2.400 alunos</span>
      <span style="display:flex;align-items:center;gap:6px"><span style="color:#22c55e">✓</span> 4.9 avaliação</span>
      <span style="display:flex;align-items:center;gap:6px"><span style="color:#22c55e">✓</span> 7 dias de garantia</span>
    </div>
  </div>
</section>

<section id="conteudo" class="section" style="background:#0f0f11">
  <div class="container">
    <div class="section-label">Conteúdo</div>
    <h2 class="section-title">O que você vai aprender.</h2>
    <div style="margin-top:48px;display:flex;flex-direction:column;gap:1px;background:rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;max-width:640px">
      ${["Módulo 1 — Fundamentos e Configuração","Módulo 2 — Estratégia e Planejamento","Módulo 3 — Criação de Conteúdo","Módulo 4 — Automação e IA","Módulo 5 — Escala e Crescimento","Módulo 6 — Métricas e Análise","Módulo 7 — Casos Práticos","Módulo 8 — Certificação"].map((m, i) => `
      <div style="background:#18181b;padding:20px 24px;display:flex;align-items:center;gap:16px">
        <div style="width:28px;height:28px;border-radius:8px;background:rgba(234,88,12,0.12);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#ea580c;flex-shrink:0">${String(i+1).padStart(2,'0')}</div>
        <span style="font-size:14px;font-weight:500;color:#e4e4e7">${m}</span>
      </div>`).join('')}
    </div>
  </div>
</section>

<section id="depoimentos" class="section">
  <div class="container">
    <div class="section-label">Depoimentos</div>
    <h2 class="section-title">O que dizem nossos alunos.</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:48px">
      <div class="card"><p style="font-size:14px;color:#a1a1aa;line-height:1.7;margin-bottom:16px">"Em 30 dias já estava aplicando o que aprendi. Resultado: faturei R$ 12k no primeiro mês."</p><div style="font-size:13px;font-weight:600">Ana S.</div><div style="font-size:12px;color:#52525b">Empreendedora</div></div>
      <div class="card"><p style="font-size:14px;color:#a1a1aa;line-height:1.7;margin-bottom:16px">"O melhor investimento que fiz. Conteúdo direto ao ponto e muito prático."</p><div style="font-size:13px;font-weight:600">Carlos M.</div><div style="font-size:12px;color:#52525b">Freelancer</div></div>
      <div class="card"><p style="font-size:14px;color:#a1a1aa;line-height:1.7;margin-bottom:16px">"Comunidade incrível. O suporte faz toda a diferença na hora de aplicar."</p><div style="font-size:13px;font-weight:600">Mariana L.</div><div style="font-size:12px;color:#52525b">Gestora de Tráfego</div></div>
    </div>
  </div>
</section>

<section id="matricula" class="section" style="text-align:center">
  <div class="container" style="max-width:480px">
    <div class="section-label">Matrícula</div>
    <h2 class="section-title">Garanta sua vaga.</h2>
    <div style="margin-top:32px;padding:32px;background:#18181b;border:1px solid rgba(255,255,255,0.06);border-radius:16px">
      <div style="font-size:14px;color:#a1a1aa;text-decoration:line-through">De R$ 997</div>
      <div style="font-size:40px;font-weight:800;margin:4px 0">R$ 497</div>
      <div style="font-size:13px;color:#71717a;margin-bottom:24px">ou 12x de R$ 47,90</div>
      <button class="btn btn-primary" style="width:100%">Matricular Agora</button>
      <p style="font-size:12px;color:#52525b;margin-top:12px">Garantia de 7 dias ou seu dinheiro de volta.</p>
    </div>
  </div>
</section>
${DS.footer(2026, 'Inova Educação')}</html>`
  },

  {
    id: 'restaurant-delivery',
    name: 'Restaurante & Delivery',
    category: 'Gastronomia & Delivery',
    description: 'DesignClean com cardápio digital, seção de ingredientes, depoimentos e pedido pelo WhatsApp.',
    badge: 'Gastronomia',
    accentColor: '#dc2626',
    previewGradient: 'from-red-600 to-slate-900',
    defaultSlug: 'restaurante-delivery',
    html: `${DS.head('Restaurante | Delivery', '#dc2626')}
<nav class="nav"><div class="container nav-inner">
  <a href="#" style="font-weight:700;font-size:18px;letter-spacing:-0.02em">SABOR<span style="color:#dc2626">.</span></a>
  <div class="nav-links"><a href="#cardapio">Cardápio</a><a href="#sobre">Sobre</a></div>
  <a href="#pedido" class="btn btn-primary" style="padding:10px 24px;font-size:13px">Pedir Agora</a>
</div></nav>

<section class="section" style="text-align:center;padding:120px 0 80px">
  <div class="container">
    <div class="section-label">Gastronomia</div>
    <h1 style="font-size:clamp(36px,5.5vw,64px);font-weight:800;letter-spacing:-0.03em;line-height:1.08;max-width:640px;margin:0 auto">Sabor que chega até você.</h1>
    <p style="font-size:18px;color:#a1a1aa;margin:24px auto 0;max-width:460px;line-height:1.7">Ingredientes frescos, receitas autorais e entrega rápida. Peça pelo WhatsApp.</p>
    <a href="#pedido" class="btn btn-primary" style="margin-top:40px">Fazer Pedido</a>
  </div>
</section>

<section id="cardapio" class="section" style="background:#0f0f11">
  <div class="container">
    <div class="section-label">Cardápio</div>
    <h2 class="section-title">Pratos Principais.</h2>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-top:48px;max-width:720px">
      <div class="card" style="display:flex;gap:16px;align-items:center"><div style="width:56px;height:56px;border-radius:12px;background:rgba(220,38,38,0.1);flex-shrink:0"></div><div><h3 style="font-size:15px;font-weight:600">Filé Grelhado</h3><p style="font-size:13px;color:#71717a;margin-top:2px">Com legumes assados e molho</p></div><div style="margin-left:auto;font-size:15px;font-weight:700;color:#dc2626">R$ 68</div></div>
      <div class="card" style="display:flex;gap:16px;align-items:center"><div style="width:56px;height:56px;border-radius:12px;background:rgba(220,38,38,0.1);flex-shrink:0"></div><div><h3 style="font-size:15px;font-weight:600">Risoto de Camarão</h3><p style="font-size:13px;color:#71717a;margin-top:2px">Arroz arbóreo com camarão grelhado</p></div><div style="margin-left:auto;font-size:15px;font-weight:700;color:#dc2626">R$ 72</div></div>
      <div class="card" style="display:flex;gap:16px;align-items:center"><div style="width:56px;height:56px;border-radius:12px;background:rgba(220,38,38,0.1);flex-shrink:0"></div><div><h3 style="font-size:15px;font-weight:600">Frango ao Molho</h3><p style="font-size:13px;color:#71717a;margin-top:2px">Peito de frango com purê</p></div><div style="margin-left:auto;font-size:15px;font-weight:700;color:#dc2626">R$ 52</div></div>
      <div class="card" style="display:flex;gap:16px;align-items:center"><div style="width:56px;height:56px;border-radius:12px;background:rgba(220,38,38,0.1);flex-shrink:0"></div><div><h3 style="font-size:15px;font-weight:600">Salmão Grelhado</h3><p style="font-size:13px;color:#71717a;margin-top:2px">Com arroz de tomate e salada</p></div><div style="margin-left:auto;font-size:15px;font-weight:700;color:#dc2626">R$ 76</div></div>
    </div>
  </div>
</section>

<section id="pedido" class="section" style="text-align:center">
  <div class="container" style="max-width:480px">
    <div class="section-label">Pedido</div>
    <h2 class="section-title">Peça pelo WhatsApp.</h2>
    <p style="font-size:15px;color:#a1a1aa;margin-top:12px">Entrega grátis acima de R$ 80.</p>
    <a href="https://wa.me/" target="_blank" class="btn btn-primary" style="margin-top:32px;background:#25d366">Abrir WhatsApp</a>
  </div>
</section>
${DS.footer(2026, 'Restaurante Sabor')}</html>`
  },

  {
    id: 'real-estate',
    name: 'Imobiliária & Incorporação',
    category: 'Imobiliário',
    description: 'Design limpo com featured properties, plantas interativas e formulário de contato.',
    badge: 'Imobiliário',
    accentColor: '#0891b2',
    previewGradient: 'from-cyan-600 to-slate-900',
    defaultSlug: 'imobiliaria',
    html: `${DS.head('Imobiliária | Incorporação', '#0891b2')}
<nav class="nav"><div class="container nav-inner">
  <a href="#" style="font-weight:700;font-size:18px;letter-spacing:-0.02em">IMÓVEL<span style="color:#0891b2">.</span></a>
  <div class="nav-links"><a href="#lancamentos">Lançamentos</a><a href="#sobre">Sobre</a></div>
  <a href="#contato" class="btn btn-primary" style="padding:10px 24px;font-size:13px">Fale Conosco</a>
</div></nav>

<section class="section" style="text-align:center;padding:120px 0 80px">
  <div class="container">
    <div class="section-label">Imobiliária</div>
    <h1 style="font-size:clamp(36px,5.5vw,64px);font-weight:800;letter-spacing:-0.03em;line-height:1.08;max-width:640px;margin:0 auto">Encontre o imóvel ideal para sua família.</h1>
    <p style="font-size:18px;color:#a1a1aa;margin:24px auto 0;max-width:460px;line-height:1.7">Amplos espaços, localização privilegiada e acabamento de alto padrão.</p>
    <a href="#lancamentos" class="btn btn-primary" style="margin-top:40px">Ver Lançamentos</a>
  </div>
</section>

<section id="lancamentos" class="section" style="background:#0f0f11">
  <div class="container">
    <div class="section-label">Lançamentos</div>
    <h2 class="section-title">Empreendimentos em destaque.</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:48px">
      <div class="card" style="padding:0;overflow:hidden">
        <div style="height:180px;background:linear-gradient(135deg,#0891b2,#0e7490)"></div>
        <div style="padding:24px"><h3 style="font-size:16px;font-weight:600;margin-bottom:4px">Residencial Aurora</h3><p style="font-size:13px;color:#71717a">2 e 3 quartos • A partir de R$ 480k</p></div>
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <div style="height:180px;background:linear-gradient(135deg,#0e7490,#155e75)"></div>
        <div style="padding:24px"><h3 style="font-size:16px;font-weight:600;margin-bottom:4px">Torre Horizon</h3><p style="font-size:13px;color:#71717a">3 e 4 quartos • A partir de R$ 720k</p></div>
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <div style="height:180px;background:linear-gradient(135deg,#155e75,#164e63)"></div>
        <div style="padding:24px"><h3 style="font-size:16px;font-weight:600;margin-bottom:4px">Jardim Vista</h3><p style="font-size:13px;color:#71717a">1 e 2 quartos • A partir de R$ 320k</p></div>
      </div>
    </div>
  </div>
</section>

<section id="contato" class="section" style="text-align:center">
  <div class="container" style="max-width:480px">
    <div class="section-label">Contato</div>
    <h2 class="section-title">Agende uma visita.</h2>
    <div style="margin-top:32px;display:flex;flex-direction:column;gap:12px">
      <input placeholder="Nome" style="width:100%;padding:14px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:#18181b;color:#fafafa;font-size:14px;outline:none;font-family:inherit">
      <input placeholder="WhatsApp" style="width:100%;padding:14px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:#18181b;color:#fafafa;font-size:14px;outline:none;font-family:inherit">
      <button class="btn btn-primary" style="width:100%;margin-top:4px">Agendar Visita</button>
    </div>
  </div>
</section>
${DS.footer(2026, 'Imobiliária')}html>`
  }
];
