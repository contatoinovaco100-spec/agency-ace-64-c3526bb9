import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight, Play, Shield, ChevronLeft, ChevronRight } from 'lucide-react';

const ACCENT = '#FF6A00';

const SERVICES = [
  { icon: '\u{1F3AF}', title: 'Estrat\u00e9gia de Conte\u00fado', desc: 'Posicionamento de marca, linha editorial, pilares de conte\u00fado e calend\u00e1rio estrat\u00e9gico. Tudo antes de gravar um segundo sequer.' },
  { icon: '\u{1F3A5}', title: 'Produ\u00e7\u00e3o Audiovisual', desc: 'Reels, an\u00fancios, v\u00eddeos institucionais, Stories e capta\u00e7\u00f5es com qualidade cinematogr\u00e1fica. Cada frame conta uma hist\u00f3ria.' },
  { icon: '\u270D\uFE0F', title: 'Copywriting', desc: 'Roteiros que prendem, legendas que convertem, CTAs que fazem o dedo clicar. Palavras com prop\u00f3sito comercial.' },
  { icon: '\u{1F4F1}', title: 'Gest\u00e3o de Redes Sociais', desc: 'Planejamento, publica\u00e7\u00e3o e gest\u00e3o completa das suas redes. Presen\u00e7a digital consistente e estrat\u00e9gica.' },
  { icon: '\u{1F3A8}', title: 'Design & Identidade Visual', desc: 'Identidade visual que comunica autoridade. Design de posts, carross\u00e9is, thumbnails e materiais que vendem.' },
  { icon: '\u{1F4C8}', title: 'Tr\u00e1fego Pago', desc: 'Meta Ads, Google Ads e estrat\u00e9gias de m\u00eddia paga que transformam investimento em resultado mensur\u00e1vel.' },
  { icon: '\u{1F680}', title: 'Marketing de Performance', desc: 'Funis de venda, an\u00e1lise de dados e otimiza\u00e7\u00e3o cont\u00ednua. Cada real investido rastreado e otimizado.' },
];

const STEPS = [
  { num: '01', title: 'Diagn\u00f3stico', desc: 'An\u00e1lise profunda da marca, mercado, concorr\u00eancia e presen\u00e7a digital atual.' },
  { num: '02', title: 'Estrat\u00e9gia', desc: 'Posicionamento, linha editorial, pilares de conte\u00fado e plano de a\u00e7\u00e3o personalizado.' },
  { num: '03', title: 'Produ\u00e7\u00e3o', desc: 'Capta\u00e7\u00e3o, edi\u00e7\u00e3o, design e copywriting \u2014 tudo integrado numa esteira criativa.' },
  { num: '04', title: 'Distribui\u00e7\u00e3o', desc: 'Publica\u00e7\u00e3o estrat\u00e9gica, impulsionamento e gest\u00e3o de m\u00eddia paga multicanal.' },
  { num: '05', title: 'Resultado', desc: 'Relat\u00f3rios de performance, insights e otimiza\u00e7\u00e3o cont\u00ednua para escalar.' },
];

const PORTFOLIO = [
  { title: 'Cl\u00ednica Renovar', tag: 'Estrat\u00e9gia completa \u2022 Produ\u00e7\u00e3o \u2022 Tr\u00e1fego', gradient: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)', span: 'col-span-2 row-span-2' },
  { title: 'Burger & Co', tag: 'Reels \u2022 An\u00fancios \u2022 Design', gradient: 'linear-gradient(135deg, #2d1b1e, #3d1f25, #1a0f11)', span: '' },
  { title: 'Studio Bela Vista', tag: 'Institucional \u2022 Branding', gradient: 'linear-gradient(135deg, #1a2e1a, #0d2e0d, #0a1f0a)', span: '' },
  { title: 'Advocacia Forte', tag: 'Posicionamento \u2022 Conte\u00fado', gradient: 'linear-gradient(135deg, #2e2a1a, #3d3522, #1f1a0f)', span: '' },
  { title: 'Fitness Pro', tag: 'Social Media \u2022 Performance', gradient: 'linear-gradient(135deg, #1a1a2e, #2a1a3e, #0f0a1f)', span: '' },
];

const TESTIMONIALS = [
  { text: 'Antes da Inova, eu postava todo dia e n\u00e3o vendia nada. Em 3 meses, meu Instagram passou a ser minha principal fonte de clientes.', name: 'Rafaela Costa', role: 'CEO, Cl\u00ednica Renovar', initials: 'RC' },
  { text: 'A qualidade dos v\u00eddeos da Inova \u00e9 de outro n\u00edvel. Nossos Reels passaram a bater 100k+ views com consist\u00eancia.', name: 'Marcos Silva', role: 'Fundador, Burger & Co', initials: 'MS' },
  { text: 'Eu tentei 3 ag\u00eancias antes. A Inova foi a primeira que sentou comigo para entender o neg\u00f3cio antes de falar em conte\u00fado.', name: 'Andr\u00e9 Lopes', role: 'Diretor, Advocacia Forte', initials: 'AL' },
  { text: 'A Inova entregou em 30 dias o que eu n\u00e3o consegui em 2 anos fazendo sozinha. Estrat\u00e9gia clara e resultados de verdade.', name: 'Juliana Martins', role: 'Propriet\u00e1ria, Studio Bela Vista', initials: 'JM' },
  { text: 'O time da Inova entende de neg\u00f3cio, n\u00e3o s\u00f3 de edi\u00e7\u00e3o de v\u00eddeo. Isso faz toda a diferen\u00e7a.', name: 'Pedro Torres', role: 'CEO, Fitness Pro', initials: 'PT' },
];

function AnimatedCounter({ target, suffix }: { target: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const animate = (now: number) => {
      const p = Math.min((now - start) / 2200, 1);
      setCount(Math.round((1 - Math.pow(1 - p, 4)) * target));
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [inView, target]);
  return <span ref={ref}>{count.toLocaleString('pt-BR')}{suffix}</span>;
}

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay }} className={className}>
      {children}
    </motion.div>
  );
}

export default function InovaLandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [testIdx, setTestIdx] = useState(0);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 150]);
  const navBg = useTransform(scrollY, [0, 60], ['rgba(5,5,5,0)', 'rgba(5,5,5,0.9)']);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    const i = setInterval(() => setTestIdx(idx => (idx + 1) % TESTIMONIALS.length), 5000);
    return () => clearInterval(i);
  }, []);

  const goTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  }, []);

  const scrollDir = useCallback((dir: -1 | 1) => {
    setTestIdx(i => {
      const next = i + dir;
      if (next < 0) return TESTIMONIALS.length - 1;
      if (next >= TESTIMONIALS.length) return 0;
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden font-sans">
      {/* Film grain */}
      <div className="fixed inset-0 z-[10000] pointer-events-none opacity-[0.03] mix-blend-overlay"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E\")" }} />

      {/* NAV */}
      <motion.nav style={{ backgroundColor: navBg }}
        className={`fixed top-0 left-0 right-0 z-[9000] px-6 lg:px-10 transition-all duration-500 ${scrolled ? 'backdrop-blur-xl border-b border-white/5 py-3' : 'py-5'}`}>
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          <a href="#hero" onClick={e => { e.preventDefault(); goTo('hero'); }} className="text-xl font-black tracking-widest font-['Outfit']">
            INOVA<span style={{ color: ACCENT }}>.</span>
          </a>
          <div className="hidden md:flex items-center gap-8">
            {['Sobre', 'Servi\u00e7os', 'Processo', 'Portf\u00f3lio', 'Clientes'].map(s => (
              <a key={s} href="#" onClick={e => { e.preventDefault(); goTo(s === 'Clientes' ? 'depoimentos' : s.toLowerCase()); }}
                className="text-[0.82rem] font-medium uppercase tracking-[0.06em] text-[#A0A0A0] hover:text-white transition-colors">{s}</a>
            ))}
            <button onClick={() => goTo('contato')} className="px-6 py-2.5 rounded-full text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-[#050505] hover:scale-105 transition-transform"
              style={{ backgroundColor: ACCENT }}>Or\u00e7amento</button>
          </div>
          <button className="md:hidden text-white" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[8999] bg-[#050505]/95 backdrop-blur-3xl flex flex-col items-center justify-center gap-10 md:hidden">
            {['Sobre', 'Servi\u00e7os', 'Processo', 'Portf\u00f3lio', 'Clientes'].map(s => (
              <a key={s} href="#" onClick={e => { e.preventDefault(); goTo(s === 'Clientes' ? 'depoimentos' : s.toLowerCase()); }}
                className="text-3xl font-bold text-[#A0A0A0] hover:text-[#FF6A00] transition-colors font-['Outfit']">{s}</a>
            ))}
            <button onClick={() => { goTo('contato'); setMenuOpen(false); }}
              className="px-8 py-4 rounded-full font-semibold text-[#050505]" style={{ backgroundColor: ACCENT }}>Solicitar Or\u00e7amento</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HERO */}
      <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 60% at 20% 50%, rgba(255,106,0,0.1) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 80% 30%, rgba(255,60,0,0.06) 0%, transparent 50%), linear-gradient(180deg, #050505 0%, #0d0d0d 100%)' }} />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '80px 80px', maskImage: 'radial-gradient(ellipse 70% 50% at 50% 50%, black 20%, transparent 70%)' }} />
          <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-[#050505] to-transparent" />
        </div>
        <motion.div style={{ y: heroY }} className="relative z-10 text-center px-6 max-w-[960px]">
          <Reveal delay={0}>
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-[#FF6A00]/20 bg-[#FF6A00]/5 text-[#FF6A00] text-[0.75rem] font-semibold uppercase tracking-[0.1em] mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] animate-pulse" />
              Produtora Audiovisual & Ag\u00eancia de Marketing
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <h1 className="font-['Outfit'] font-black text-[clamp(2.6rem,6.5vw,5.2rem)] leading-[1.05] tracking-[-0.03em] mb-6">
              Transformamos estrat\u00e9gia em <em className="not-italic relative" style={{ color: ACCENT }}>
                conte\u00fado<span className="absolute bottom-1 left-0 right-0 h-1 rounded bg-[#FF6A00]/25" /></em> e conte\u00fado em <em className="not-italic relative" style={{ color: ACCENT }}>
                oportunidade<span className="absolute bottom-1 left-0 right-0 h-1 rounded bg-[#FF6A00]/25" /></em>
            </h1>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="font-light text-[clamp(1rem,2vw,1.2rem)] leading-relaxed text-[#A0A0A0] max-w-[580px] mx-auto mb-10">
              N\u00e3o vendemos v\u00eddeos para Instagram. Criamos conte\u00fado com prop\u00f3sito comercial que posiciona, atrai e vende.
            </p>
          </Reveal>
          <Reveal delay={0.45}>
            <div className="flex gap-4 justify-center flex-wrap">
              <button onClick={() => goTo('contato')}
                className="inline-flex items-center gap-2.5 px-9 py-4 rounded-full font-semibold text-[0.88rem] tracking-wide text-[#050505] hover:shadow-[0_8px_32px_rgba(255,106,0,0.3)] hover:-translate-y-0.5 transition-all"
                style={{ backgroundColor: ACCENT }}>
                Quero minha estrat\u00e9gia de conte\u00fado <ArrowRight className="w-5 h-5" />
              </button>
              <button onClick={() => goTo('portfolio')}
                className="inline-flex items-center gap-2.5 px-9 py-4 rounded-full font-semibold text-[0.88rem] tracking-wide border border-white/10 hover:border-[#FF6A00] hover:text-[#FF6A00] hover:-translate-y-0.5 transition-all">
                Ver showreel
              </button>
            </div>
          </Reveal>
        </motion.div>
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
          <span className="text-[0.68rem] font-medium uppercase tracking-[0.15em] text-[#555]">Scroll</span>
          <div className="w-px h-12 bg-gradient-to-b from-[#FF6A00] to-transparent animate-pulse" />
        </div>
      </section>

      {/* ABOUT */}
      <section id="sobre" className="py-[clamp(80px,12vh,140px)] relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/6 to-transparent" />
        <div className="max-w-[1280px] mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center">
          <Reveal className="relative aspect-[4/5] rounded-[20px] overflow-hidden">
            <div className="w-full h-full bg-gradient-to-br from-[#1a1a1a] via-[#111] to-[#0e0e0e] relative">
              <div className="absolute top-[15%] left-[10%] w-[80%] h-[70%] border border-[#FF6A00]/12 rounded-xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 border-2 border-[#FF6A00] rounded-full opacity-50" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 border-l-[14px] border-l-[#FF6A00] border-t-[9px] border-t-transparent border-b-[9px] border-b-transparent ml-1 opacity-50" />
              <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full opacity-40" style={{ background: 'radial-gradient(circle, rgba(255,106,0,0.25) 0%, transparent 70%)' }} />
            </div>
          </Reveal>
          <Reveal className="space-y-5 lg:delay-150">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#FF6A00]/25 bg-[#FF6A00]/6 text-[#FF6A00] text-[0.72rem] font-semibold uppercase tracking-[0.12em]">Sobre a Inova</div>
            <h2 className="font-['Outfit'] font-extrabold text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.1] tracking-tight">
              Conte\u00fado bonito <span className="text-[#FF6A00]">n\u00e3o vende.</span><br />Conte\u00fado estrat\u00e9gico sim.
            </h2>
            <p className="text-[1.02rem] leading-[1.8] text-[#A0A0A0]">
              A maioria das empresas produz conte\u00fado. Poucas sabem <strong className="text-white font-semibold">por que produzem.</strong> Na Inova, a c\u00e2mera s\u00f3 liga depois que a estrat\u00e9gia est\u00e1 pronta.
            </p>
            <p className="text-[1.02rem] leading-[1.8] text-[#A0A0A0]">
              Unimos <strong className="text-white font-semibold">estrat\u00e9gia de marca + produ\u00e7\u00e3o audiovisual + marketing de performance</strong> em um \u00fanico ecossistema. O resultado? Empresas que come\u00e7am a <strong className="text-white font-semibold">construir autoridade e gerar oportunidades reais de neg\u00f3cio.</strong>
            </p>
            <div className="grid grid-cols-3 gap-6 mt-10 pt-10 border-t border-white/6">
              <div className="text-center">
                <div className="font-['Outfit'] font-black text-[clamp(2rem,3vw,2.8rem)] text-[#FF6A00] leading-none mb-1.5"><AnimatedCounter target={150} suffix="+" /></div>
                <div className="text-[0.78rem] text-[#555] uppercase tracking-[0.06em]">Marcas atendidas</div>
              </div>
              <div className="text-center">
                <div className="font-['Outfit'] font-black text-[clamp(2rem,3vw,2.8rem)] text-[#FF6A00] leading-none mb-1.5"><AnimatedCounter target={2000} suffix="+" /></div>
                <div className="text-[0.78rem] text-[#555] uppercase tracking-[0.06em]">Conte\u00fados produzidos</div>
              </div>
              <div className="text-center">
                <div className="font-['Outfit'] font-black text-[clamp(2rem,3vw,2.8rem)] text-[#FF6A00] leading-none mb-1.5"><AnimatedCounter target={50} suffix="M+" /></div>
                <div className="text-[0.78rem] text-[#555] uppercase tracking-[0.06em]">Visualiza\u00e7\u00f5es geradas</div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SERVICES */}
      <section id="servi\u00e7os" className="py-[clamp(80px,12vh,140px)] bg-[#0a0a0a] relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/6 to-transparent" />
        <div className="max-w-[1280px] mx-auto px-6">
          <Reveal className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#FF6A00]/25 bg-[#FF6A00]/6 text-[#FF6A00] text-[0.72rem] font-semibold uppercase tracking-[0.12em] mb-5">O que fazemos</div>
            <h2 className="font-['Outfit'] font-extrabold text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.1] tracking-tight mb-5">
              Sete pilares. <span className="text-[#FF6A00]">Um prop\u00f3sito.</span>
            </h2>
            <p className="font-light text-[clamp(1rem,1.8vw,1.15rem)] leading-relaxed text-[#A0A0A0] max-w-[600px] mx-auto">
              Cada servi\u00e7o \u00e9 uma engrenagem de uma m\u00e1quina que gira para o mesmo objetivo: transformar a sua empresa em uma marca que vende.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {SERVICES.map((s, i) => (
              <Reveal key={i} delay={i * 0.06}>
                <div className={`group bg-[#0e0e0e] border border-white/6 rounded-[20px] p-9 transition-all duration-500 hover:bg-[#161616] hover:border-[#FF6A00]/25 hover:-translate-y-1.5 hover:shadow-[0_24px_64px_rgba(0,0,0,0.5),0_0_48px_rgba(255,106,0,0.25)] relative overflow-hidden ${i === 0 ? 'border-[#FF6A00]/25 sm:col-span-2 lg:col-span-1' : ''}`}>
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#FF6A00] scale-x-0 origin-left transition-transform duration-500 group-hover:scale-x-100" />
                  <div className="w-12 h-12 rounded-xl bg-[#FF6A00]/6 flex items-center justify-center text-2xl mb-5 group-hover:scale-110 group-hover:-rotate-3 transition-all">{s.icon}</div>
                  <h3 className="font-['Outfit'] font-bold text-[1.12rem] mb-2.5">{s.title}</h3>
                  <p className="text-[0.88rem] leading-relaxed text-[#555]">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section id="processo" className="py-[clamp(80px,12vh,140px)] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.06] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,106,0,0.25) 0%, transparent 70%)' }} />
        <div className="max-w-[1280px] mx-auto px-6 relative">
          <Reveal className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#FF6A00]/25 bg-[#FF6A00]/6 text-[#FF6A00] text-[0.72rem] font-semibold uppercase tracking-[0.12em] mb-5">Como funciona</div>
            <h2 className="font-['Outfit'] font-extrabold text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.1] tracking-tight mb-5">
              Do diagn\u00f3stico ao <span className="text-[#FF6A00]">resultado.</span>
            </h2>
            <p className="font-light text-[clamp(1rem,1.8vw,1.15rem)] leading-relaxed text-[#A0A0A0] max-w-[600px] mx-auto">
              Um processo validado em mais de 150 marcas. Cada etapa \u00e9 um passo calculado rumo ao posicionamento e \u00e0s vendas.
            </p>
          </Reveal>
          <div className="relative">
            <div className="hidden lg:block absolute top-[36px] left-[10%] right-[10%] h-[2px] bg-[#1a1a1a]" />
            <div className="grid lg:grid-cols-5 gap-10 lg:gap-0">
              {STEPS.map((step, i) => (
                <Reveal key={i} delay={i * 0.1}>
                  <div className="text-center relative px-4">
                    <div className="w-[72px] h-[72px] rounded-full bg-[#111] border-2 border-white/6 flex items-center justify-center mx-auto mb-5 font-['Outfit'] font-extrabold text-xl text-[#FF6A00] relative z-2 transition-all duration-500 hover:bg-[#FF6A00] hover:text-[#050505] hover:border-[#FF6A00] hover:scale-110 hover:shadow-[0_0_40px_rgba(255,106,0,0.25)]">
                      {step.num}
                    </div>
                    <h3 className="font-['Outfit'] font-bold text-[1.02rem] mb-2">{step.title}</h3>
                    <p className="text-[0.84rem] text-[#555] leading-relaxed">{step.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PORTFOLIO */}
      <section id="portf\u00f3lio" className="py-[clamp(80px,12vh,140px)] bg-[#0a0a0a] relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/6 to-transparent" />
        <div className="max-w-[1440px] mx-auto px-6">
          <Reveal className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#FF6A00]/25 bg-[#FF6A00]/6 text-[#FF6A00] text-[0.72rem] font-semibold uppercase tracking-[0.12em] mb-5">Portf\u00f3lio</div>
            <h2 className="font-['Outfit'] font-extrabold text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.1] tracking-tight mb-5">
              Cases que <span className="text-[#FF6A00]">falam por si.</span>
            </h2>
            <p className="font-light text-[clamp(1rem,1.8vw,1.15rem)] leading-relaxed text-[#A0A0A0] max-w-[600px] mx-auto">
              Cada projeto \u00e9 uma hist\u00f3ria de transforma\u00e7\u00e3o.
            </p>
          </Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {PORTFOLIO.map((item, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className={`group relative rounded-[20px] overflow-hidden cursor-pointer aspect-[16/10] ${item.span} ${i === 0 ? 'aspect-auto' : ''}`}
                  style={{ background: item.gradient }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 scale-75 group-hover:scale-100">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: ACCENT, boxShadow: '0 0 40px rgba(255,106,0,0.5)' }}>
                      <Play className="w-6 h-6 fill-[#050505] ml-1" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-7 opacity-0 group-hover:opacity-100 transition-opacity duration-500 translate-y-4 group-hover:translate-y-0">
                    <h3 className="font-['Outfit'] font-bold text-xl mb-1">{item.title}</h3>
                    <span className="text-[0.78rem] text-[#FF6A00] uppercase tracking-[0.06em]">{item.tag}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="depoimentos" className="py-[clamp(80px,12vh,140px)] relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/6 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,106,0,0.06) 0%, transparent 70%)' }} />
        <div className="max-w-[1280px] mx-auto px-6 relative">
          <Reveal className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#FF6A00]/25 bg-[#FF6A00]/6 text-[#FF6A00] text-[0.72rem] font-semibold uppercase tracking-[0.12em] mb-5">Prova social</div>
            <h2 className="font-['Outfit'] font-extrabold text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.1] tracking-tight mb-5">
              Quem trabalha com a Inova, <span className="text-[#FF6A00]">indica.</span>
            </h2>
          </Reveal>

          <div className="relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[#050505] to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#050505] to-transparent z-10 pointer-events-none" />
            <AnimatePresence mode="wait">
              <motion.div key={testIdx} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="bg-[#0e0e0e] border border-white/6 rounded-[20px] p-9 max-w-[500px] mx-auto">
                <div className="text-[2.2rem] text-[#FF6A00] opacity-25 leading-none mb-4 font-serif">&ldquo;</div>
                <p className="text-[0.92rem] leading-[1.7] text-[#A0A0A0] italic mb-6">{TESTIMONIALS[testIdx].text}</p>
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center font-['Outfit'] font-bold text-[0.95rem] text-[#050505]"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, #CC5500)` }}>{TESTIMONIALS[testIdx].initials}</div>
                  <div>
                    <div className="font-['Outfit'] font-semibold text-[0.92rem]">{TESTIMONIALS[testIdx].name}</div>
                    <div className="text-[0.78rem] text-[#555]">{TESTIMONIALS[testIdx].role}</div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex justify-center gap-3 mt-10">
            <button onClick={() => scrollDir(-1)} className="w-11 h-11 rounded-full border border-white/6 bg-[#0e0e0e] flex items-center justify-center hover:border-[#FF6A00] hover:text-[#FF6A00] hover:bg-[#FF6A00]/6 transition-all">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => scrollDir(1)} className="w-11 h-11 rounded-full border border-white/6 bg-[#0e0e0e] flex items-center justify-center hover:border-[#FF6A00] hover:text-[#FF6A00] hover:bg-[#FF6A00]/6 transition-all">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contato" className="py-[clamp(80px,12vh,140px)] relative overflow-hidden text-center">
        <div className="absolute inset-0 bg-[#0a0a0a]">
          <div className="absolute top-[20%] left-[30%] w-[300px] h-[300px] rounded-full opacity-[0.08] blur-[80px]" style={{ background: ACCENT }} />
          <div className="absolute bottom-[20%] right-[30%] w-[250px] h-[250px] rounded-full opacity-[0.05] blur-[80px]" style={{ background: ACCENT }} />
        </div>
        <div className="max-w-[1280px] mx-auto px-6 relative z-10">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#FF6A00]/25 bg-[#FF6A00]/6 text-[#FF6A00] text-[0.72rem] font-semibold uppercase tracking-[0.12em] mb-5">Pr\u00f3ximo passo</div>
            <h2 className="font-['Outfit'] font-extrabold text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.1] tracking-tight mb-4">
              Sua marca merece <span className="text-[#FF6A00]">mais.</span>
            </h2>
            <p className="font-light text-[clamp(1rem,1.8vw,1.15rem)] leading-relaxed text-[#A0A0A0] max-w-[500px] mx-auto mb-10">
              Vagas limitadas por m\u00eas para garantir a qualidade que a sua marca precisa. Agende uma sess\u00e3o estrat\u00e9gica gratuita.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <a href="https://wa.me/5500000000000?text=Ol%C3%A1%2C%20quero%20minha%20estrat%C3%A9gia%20de%20conte%C3%BAdo" target="_blank" rel="noopener"
                className="inline-flex items-center gap-2.5 px-9 py-4 rounded-full font-semibold text-[0.88rem] tracking-wide text-[#050505] hover:shadow-[0_8px_32px_rgba(255,106,0,0.3)] hover:-translate-y-0.5 transition-all"
                style={{ backgroundColor: ACCENT }}>
                Quero minha estrat\u00e9gia <ArrowRight className="w-5 h-5" />
              </a>
              <a href="mailto:contato@inovacompany.com.br"
                className="inline-flex items-center gap-2.5 px-9 py-4 rounded-full font-semibold text-[0.88rem] tracking-wide border border-white/10 hover:border-[#FF6A00] hover:text-[#FF6A00] hover:-translate-y-0.5 transition-all">
                Enviar e-mail
              </a>
            </div>
            <div className="inline-flex items-center gap-2 mt-8 text-[0.78rem] text-[#555]">
              <Shield className="w-4 h-4" style={{ color: ACCENT }} />
              Vagas limitadas \u2014 apenas 5 novos projetos por m\u00eas
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="pt-[60px] pb-[30px] bg-[#050505] border-t border-white/6">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
            <div className="col-span-2 lg:col-span-1">
              <div className="font-['Outfit'] font-black text-xl tracking-widest mb-4">INOVA<span style={{ color: ACCENT }}>.</span></div>
              <p className="text-[0.88rem] leading-relaxed text-[#555] max-w-[300px]">
                Produtora audiovisual e ag\u00eancia de marketing que transforma empresas em marcas fortes atrav\u00e9s de conte\u00fado estrat\u00e9gico.
              </p>
            </div>
            <div>
              <h4 className="font-['Outfit'] font-bold text-[0.88rem] uppercase tracking-[0.06em] mb-5">Navega\u00e7\u00e3o</h4>
              <ul className="space-y-2.5">
                {['Sobre', 'Servi\u00e7os', 'Processo', 'Portf\u00f3lio'].map(s => (
                  <li key={s}><a href="#" onClick={e => { e.preventDefault(); goTo(s.toLowerCase()); }} className="text-[0.88rem] text-[#555] hover:text-[#FF6A00] transition-colors">{s}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-['Outfit'] font-bold text-[0.88rem] uppercase tracking-[0.06em] mb-5">Servi\u00e7os</h4>
              <ul className="space-y-2.5">
                {['Estrat\u00e9gia de Conte\u00fado', 'Produ\u00e7\u00e3o Audiovisual', 'Tr\u00e1fego Pago', 'Gest\u00e3o de Redes'].map(s => (
                  <li key={s}><a href="#servi\u00e7os" className="text-[0.88rem] text-[#555] hover:text-[#FF6A00] transition-colors">{s}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-['Outfit'] font-bold text-[0.88rem] uppercase tracking-[0.06em] mb-5">Contato</h4>
              <ul className="space-y-2.5">
                <li><a href="mailto:contato@inovacompany.com.br" className="text-[0.88rem] text-[#555] hover:text-[#FF6A00] transition-colors">contato@inovacompany.com.br</a></li>
                <li><a href="tel:+5500000000000" className="text-[0.88rem] text-[#555] hover:text-[#FF6A00] transition-colors">(00) 00000-0000</a></li>
                <li><span className="text-[0.88rem] text-[#555]">S\u00e3o Paulo, SP</span></li>
              </ul>
            </div>
          </div>
          <div className="pt-[30px] border-t border-white/6 flex justify-between items-center flex-wrap gap-4">
            <p className="text-[0.78rem] text-[#555]">&copy; 2026 Inova Company. Todos os direitos reservados.</p>
            <p className="text-[0.78rem] text-[#555]">Feito com paix\u00e3o pela Inova</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
