import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight, Bookmark, Camera, Check, Clapperboard, Clock3, Film, Heart, Lightbulb, MessageCircle, Mic, Play, Scissors, Send, Sparkles, Target, TrendingUp, Users } from 'lucide-react';
import logoInova from '@/assets/logo-inova.png';
import escritorioAsset from '@/assets/escritorio-inova-recepcao.jpg.asset.json';
import { useSeo } from '@/lib/seo';

/**
 * /cultura — onboarding de quem entra no time: a cultura da INOVA (Resultado, Prazo, Estratégia),
 * que somos uma produtora (a gente se grava, e quem quiser aparece junto), liberdade criativa com responsabilidade e a primeira semana.
 * Página pública, sempre escura, com a identidade da marca (lima sobre grafite).
 */

const PILLARS = [
  {
    n: '01', name: 'Resultado', Icon: Target,
    line: 'Conteúdo bonito que não move o ponteiro é decoração.',
    body: 'Cada vídeo, cada arte e cada legenda existem para fazer o cliente crescer: mais alcance, mais lead, mais venda. A pergunta aqui nunca é "ficou bom?". É "funcionou?".',
    practice: ['Antes de criar, saiba o objetivo do post', 'Olhe os números do que você entregou', 'Proponha melhorias sem esperar alguém pedir'],
  },
  {
    n: '02', name: 'Prazo', Icon: Clock3,
    line: 'Prazo é promessa. E promessa a gente cumpre.',
    body: 'O cliente confia no dia e na hora que combinamos. Um post atrasado é uma oportunidade que não volta. Por isso o prazo é um compromisso do time inteiro, e a gente se ajuda para chegar lá.',
    practice: ['Data marcada na plataforma é data cumprida', 'Viu que vai atrasar? Avise antes, não depois', 'Entregue no prazo e com qualidade, as duas coisas'],
  },
  {
    n: '03', name: 'Estratégia', Icon: Sparkles,
    line: 'A gente não posta por postar.',
    body: 'Por trás de cada pauta existe um porquê: o público, o momento, a data comemorativa, o funil. Criatividade sem estratégia é sorte. Estratégia sem criatividade é chato. A INOVA vive no meio.',
    practice: ['Entenda o cliente antes de criar', 'Pense em série, não em post solto', 'Use o planejamento e as datas da plataforma'],
  },
];

const RULES = [
  { k: 'Prazo é promessa.', v: 'O que a gente combina com o cliente, a gente faz acontecer.' },
  { k: 'Avisou cedo, resolveu.', v: 'Problema escondido vira crise. Problema avisado vira solução.' },
  { k: 'Se não está na plataforma, não existe.', v: 'Card atualizado, data certa, legenda no lugar. Assim todo mundo se ajuda.' },
  { k: 'Errou? Assume e corrige.', v: 'Errar faz parte. O que importa é falar logo e aprender junto.' },
  { k: 'Ninguém ganha sozinho.', v: 'O post é do time: copy, captação, edição, design e social media.' },
  { k: 'Ideia boa vem de qualquer lugar.', v: 'Estagiário ou head: a melhor ideia vence, não o cargo.' },
];

const FLOW = ['Pauta', 'Roteiro', 'Captação', 'Edição', 'Revisão', 'Aprovação', 'Postagem'];

const WEEK = [
  { day: 'Dia 1', title: 'Chegada', items: ['Receber acesso à plataforma INOVA', 'Abrir o Meu Dia e entender o que aparece lá', 'Conhecer o time e quem cuida de cada cliente'] },
  { day: 'Dia 2', title: 'Clientes', items: ['Ler o escopo dos clientes que você vai atender', 'Ver o Planner e o kanban de cada um', 'Entender o tom de voz de cada marca'] },
  { day: 'Dia 3', title: 'Bastidores', items: ['Acompanhar uma gravação para conhecer o set', 'Dar uma mão se bater vontade: luz, som, ideia', 'Ver como o material vira roteiro e corte'] },
  { day: 'Dia 4', title: 'Fluxo', items: ['Seguir um card da pauta até a postagem', 'Mover cards e marcar datas na plataforma', 'Conhecer o link de aprovação do cliente'] },
  { day: 'Dia 5', title: 'Primeira entrega', items: ['Entregar sua primeira tarefa no prazo', 'Receber feedback do head', 'Combinar suas metas do primeiro mês'] },
];

const MANIFESTO = 'A gente não faz post. A gente faz resultado. Somos uma produtora: câmera ligada, ideia na mesa e prazo no calendário. Aqui você tem liberdade para criar e a gente confia que você cuida do que entrega. As duas coisas juntas. Sempre.';

const STORAGE_KEY = 'inova-cultura:semana';

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('ob-in'); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useReveal<HTMLDivElement>();
  return <div ref={ref} className={`ob-reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

/** Grade de pontos lima que reage ao mouse (a "assinatura" de pontos do logo) */
function DotField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, raf = 0, t = 0;
    const mouse = { x: -9999, y: -9999 };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const gap = w < 640 ? 22 : 28;
      for (let y = gap / 2; y < h; y += gap) {
        for (let x = gap / 2; x < w; x += gap) {
          const dx = x - mouse.x, dy = y - mouse.y;
          const near = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 180);
          const wave = (Math.sin(x * 0.012 + t) + Math.cos(y * 0.015 - t * 0.8)) * 0.5;
          const r = 0.8 + Math.max(0, wave) * 1.1 + near * 3.2;
          const a = 0.08 + Math.max(0, wave) * 0.14 + near * 0.8;
          ctx.fillStyle = `hsla(75, 90%, 57%, ${a})`;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
      }
      t += 0.012;
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    const move = (e: PointerEvent) => { const b = canvas.getBoundingClientRect(); mouse.x = e.clientX - b.left; mouse.y = e.clientY - b.top; if (reduce) draw(); };
    const leave = () => { mouse.x = -9999; mouse.y = -9999; };
    resize(); draw();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', move);
    document.addEventListener('pointerleave', leave);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave); };
  }, []);
  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />;
}

/** Timecode de câmera rodando */
function Timecode() {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => setMs(performance.now() - start), 1000 / 24);
    return () => clearInterval(id);
  }, []);
  const s = Math.floor(ms / 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return <span className="tabular-nums">{p(Math.floor(s / 3600))}:{p(Math.floor(s / 60) % 60)}:{p(s % 60)}:{p(Math.floor((ms % 1000) / (1000 / 24)))}</span>;
}

/** Manifesto que acende palavra por palavra com o scroll */
function Manifesto() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = ref.current; if (!el) return;
      const b = el.getBoundingClientRect();
      const p = (window.innerHeight * 0.85 - b.top) / (b.height + window.innerHeight * 0.3);
      setProgress(Math.min(1, Math.max(0, p)));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const words = MANIFESTO.split(' ');
  const lit = Math.round(progress * words.length * 1.15);
  return (
    <div ref={ref} className="font-display text-[clamp(1.9rem,5.2vw,4.6rem)] font-semibold leading-[1.08] tracking-[-0.03em]">
      {words.map((w, i) => {
        const strong = /resultado|produtora|liberdade|responsabilidade|sempre/i.test(w);
        return (
          <span key={i} className="transition-colors duration-300"
            style={{ color: i < lit ? (strong ? 'hsl(var(--ob-lime))' : 'hsl(var(--ob-fg))') : 'hsl(var(--ob-fg) / 0.14)' }}>{w} </span>
        );
      })}
    </div>
  );
}

/** Liberdade x Responsabilidade: arrastar para ver os dois lados (e descobrir que são um só) */
function Balance() {
  const [v, setV] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const drag = (clientX: number) => {
    const b = ref.current!.getBoundingClientRect();
    setV(Math.min(96, Math.max(4, ((clientX - b.left) / b.width) * 100)));
  };
  return (
    <div>
      <div ref={ref} className="ob-card relative h-[420px] select-none overflow-hidden rounded-3xl sm:h-[460px]"
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); drag(e.clientX); }}
        onPointerMove={(e) => { if (e.buttons) drag(e.clientX); }}>
        {/* Lado responsabilidade (fundo) */}
        <div className="absolute inset-0 flex items-center justify-end p-6 sm:p-12" style={{ background: 'hsl(var(--ob-lime))', color: 'hsl(var(--ob-ink))' }}>
          <div className="max-w-[46%] text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">Responsabilidade</p>
            <p className="mt-2 font-display text-[clamp(1.6rem,4vw,3.4rem)] font-bold leading-[0.95] tracking-[-0.04em]">100% dono do que entrega.</p>
            <p className="mt-3 hidden text-sm font-medium opacity-80 sm:block">Combinou, cumpre. Começou, termina. Apertou? Avisa, que o time segura junto.</p>
          </div>
        </div>
        {/* Lado liberdade (por cima, recortado) */}
        <div className="absolute inset-0 flex items-center p-6 sm:p-12" style={{ clipPath: `inset(0 ${100 - v}% 0 0)`, background: 'hsl(var(--ob-bg-2))' }}>
          <div className="max-w-[46%]">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'hsl(var(--ob-lime))' }}>Liberdade</p>
            <p className="mt-2 font-display text-[clamp(1.6rem,4vw,3.4rem)] font-bold leading-[0.95] tracking-[-0.04em]">Crie sem pedir licença.</p>
            <p className="mt-3 hidden text-sm opacity-70 sm:block">Ideia maluca? Traga. Formato novo? Teste. Aqui não tem "sempre foi assim".</p>
          </div>
        </div>
        {/* Alavanca */}
        <div className="absolute inset-y-0 w-px" style={{ left: `${v}%`, background: 'hsl(var(--ob-fg) / 0.9)' }}>
          <button type="button" aria-label="Arraste para comparar" role="slider" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}
            onKeyDown={(e) => { if (e.key === 'ArrowLeft') setV((x) => Math.max(4, x - 5)); if (e.key === 'ArrowRight') setV((x) => Math.min(96, x + 5)); }}
            className="absolute top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full text-xs font-bold shadow-2xl"
            style={{ background: 'hsl(var(--ob-fg))', color: 'hsl(var(--ob-ink))' }}>⟷</button>
        </div>
      </div>
      <p className="mt-5 text-center font-display text-lg font-semibold sm:text-2xl">
        Não é um <span style={{ color: 'hsl(var(--ob-lime))' }}>ou</span> outro. Na INOVA, é <span style={{ color: 'hsl(var(--ob-lime))' }}>os dois</span>, o tempo todo.
      </p>
    </div>
  );
}

/** Linha do fluxo que enche com o scroll */
function Flow() {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const b = ref.current?.getBoundingClientRect(); if (!b) return;
      setP(Math.min(1, Math.max(0, (window.innerHeight * 0.8 - b.top) / (window.innerHeight * 0.6))));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const active = Math.floor(p * (FLOW.length - 0.01));
  return (
    <div ref={ref} className="relative">
      <div className="absolute left-0 right-0 top-[22px] hidden h-px md:block" style={{ background: 'hsl(var(--ob-fg) / 0.12)' }} />
      <div className="absolute left-0 top-[22px] hidden h-px transition-[width] duration-200 md:block" style={{ width: `${p * 100}%`, background: 'hsl(var(--ob-lime))' }} />
      <ol className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-7">
        {FLOW.map((s, i) => (
          <li key={s} className="relative">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border text-sm font-bold transition-all duration-300"
              style={i <= active
                ? { background: 'hsl(var(--ob-lime))', color: 'hsl(var(--ob-ink))', borderColor: 'transparent', boxShadow: '0 0 0 6px hsl(var(--ob-lime) / 0.15)' }
                : { borderColor: 'hsl(var(--ob-fg) / 0.2)', background: 'hsl(var(--ob-bg))', color: 'hsl(var(--ob-fg) / 0.5)' }}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <p className="mt-3 font-display text-lg font-semibold">{s}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Week() {
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  });
  const toggle = (k: string) => setDone((d) => {
    const n = { ...d, [k]: !d[k] };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(n)); } catch { /* armazenamento indisponível */ }
    return n;
  });
  const total = WEEK.reduce((s, d) => s + d.items.length, 0);
  const count = Object.values(done).filter(Boolean).length;
  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'hsl(var(--ob-fg) / 0.1)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(count / total) * 100}%`, background: 'hsl(var(--ob-lime))' }} />
        </div>
        <span className="font-display text-sm font-semibold tabular-nums">{count}/{total}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {WEEK.map((d, di) => (
          <Reveal key={d.day} delay={di * 80}>
            <div className="ob-card h-full rounded-2xl p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'hsl(var(--ob-lime))' }}>{d.day}</p>
              <p className="mt-1 font-display text-xl font-semibold">{d.title}</p>
              <ul className="mt-4 space-y-2.5">
                {d.items.map((it) => {
                  const k = `${d.day}:${it}`; const on = !!done[k];
                  return (
                    <li key={it}>
                      <button type="button" onClick={() => toggle(k)} className="flex w-full items-start gap-2.5 text-left text-sm" aria-pressed={on}>
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors"
                          style={on ? { background: 'hsl(var(--ob-lime))', borderColor: 'transparent', color: 'hsl(var(--ob-ink))' } : { borderColor: 'hsl(var(--ob-fg) / 0.3)' }}>
                          {on && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <span style={{ color: on ? 'hsl(var(--ob-fg) / 0.45)' : 'hsl(var(--ob-fg) / 0.85)', textDecoration: on ? 'line-through' : 'none' }}>{it}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
      {count === total && (
        <p className="mt-6 text-center font-display text-xl font-semibold" style={{ color: 'hsl(var(--ob-lime))' }}>Primeira semana fechada. Agora é com você. 🔥</p>
      )}
    </div>
  );
}

/** Selo circular girando com o texto dos pilares */
function SpinBadge({ size = 140, ink = false, className = '' }: { size?: number; ink?: boolean; className?: string }) {
  const c = ink ? 'hsl(var(--ob-ink))' : 'hsl(var(--ob-lime))';
  return (
    <div aria-hidden className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" className="ob-spin absolute inset-0 h-full w-full">
        <defs><path id={`ob-circle-${ink ? 'i' : 'l'}`} d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" /></defs>
        <text fill={c} style={{ fontFamily: 'Sora, sans-serif', fontSize: 17, fontWeight: 700, letterSpacing: 4.2 }}>
          <textPath href={`#ob-circle-${ink ? 'i' : 'l'}`}>RESULTADO • PRAZO • ESTRATÉGIA • INOVA • </textPath>
        </text>
      </svg>
      <div className="absolute inset-[30%] grid grid-cols-3 place-items-center gap-[6%]">
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className="ob-pulse h-full w-full rounded-full" style={{ background: c, animationDelay: `${(i % 3 + Math.floor(i / 3)) * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

const FRAMES = [
  { label: 'Bastidor', Icon: Camera, art: 'blob' },
  { label: 'Trend', Icon: TrendingUp, art: 'stripes' },
  { label: 'Roteiro', Icon: Lightbulb, art: 'rings' },
  { label: 'Reels', Icon: Play, art: 'dots' },
  { label: 'Captação', Icon: Mic, art: 'grid' },
  { label: 'Corte', Icon: Scissors, art: 'wave' },
  { label: 'Story', Icon: Film, art: 'blob' },
  { label: 'Postado', Icon: Send, art: 'stripes' },
] as const;

const ART: Record<string, React.CSSProperties> = {
  blob: { background: 'radial-gradient(circle at 30% 35%, hsl(var(--ob-lime)) 0, hsl(var(--ob-lime) / 0.35) 22%, transparent 55%), radial-gradient(circle at 80% 80%, hsl(var(--ob-lime) / 0.25), transparent 45%), hsl(var(--ob-bg-2))' },
  stripes: { background: 'repeating-linear-gradient(-45deg, hsl(var(--ob-lime) / 0.9) 0 10px, transparent 10px 26px), hsl(var(--ob-bg-2))' },
  rings: { background: 'repeating-radial-gradient(circle at 70% 60%, hsl(var(--ob-lime) / 0.8) 0 2px, transparent 2px 16px), hsl(var(--ob-bg-2))' },
  dots: { background: 'radial-gradient(circle, hsl(var(--ob-lime)) 3px, transparent 3.5px) 0 0 / 18px 18px, hsl(var(--ob-bg-2))' },
  grid: { background: 'linear-gradient(hsl(var(--ob-lime) / 0.5) 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, hsl(var(--ob-lime) / 0.5) 1px, transparent 1px) 0 0 / 22px 22px, radial-gradient(circle at 50% 50%, hsl(var(--ob-lime) / 0.35), transparent 60%), hsl(var(--ob-bg-2))' },
  wave: { background: 'linear-gradient(135deg, hsl(var(--ob-lime)) 0%, hsl(var(--ob-lime) / 0.2) 45%, hsl(var(--ob-bg-2)) 70%)' },
};

/** Rolo de filme correndo com os "frames" do nosso dia */
function FilmStrip() {
  const frames = [...FRAMES, ...FRAMES];
  return (
    <div className="relative -rotate-2 overflow-hidden py-2" style={{ background: 'hsl(var(--ob-ink))' }}>
      <div className="ob-sprockets h-4" />
      <div className="ob-film flex w-max gap-3 px-3 py-3">
        {[0, 1].map((k) => frames.map((f, i) => (
          <div key={`${k}-${i}`} className="relative h-[130px] w-[190px] shrink-0 overflow-hidden rounded-md sm:h-[160px] sm:w-[240px]" style={ART[f.art]}>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 40%, hsl(var(--ob-ink) / 0.85))' }} />
            <f.Icon className="absolute right-3 top-3 h-5 w-5" style={{ color: 'hsl(var(--ob-fg))' }} />
            <span className="absolute left-3 top-3 font-mono text-[10px]" style={{ color: 'hsl(var(--ob-fg) / 0.7)' }}>{String(i % FRAMES.length + 1).padStart(2, '0')}A</span>
            <p className="absolute bottom-3 left-3 font-display text-xl font-bold tracking-[-0.03em]" style={{ color: 'hsl(var(--ob-fg))' }}>{f.label}</p>
          </div>
        )))}
      </div>
      <div className="ob-sprockets h-4" />
    </div>
  );
}

function Phone({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`relative aspect-[9/19] w-[200px] shrink-0 rounded-[34px] border-[6px] p-0 shadow-2xl sm:w-[230px] ${className}`}
      style={{ borderColor: 'hsl(var(--ob-fg) / 0.14)', background: 'hsl(var(--ob-bg-2))', boxShadow: '0 40px 80px -30px hsl(var(--ob-lime) / 0.35)', ...style }}>
      <span className="absolute left-1/2 top-2 z-10 h-4 w-16 -translate-x-1/2 rounded-full" style={{ background: 'hsl(var(--ob-ink))' }} />
      <div className="relative h-full w-full overflow-hidden rounded-[28px]">{children}</div>
    </div>
  );
}

/** "Do set pro feed": três celulares com Reels, feed e story animados */
function PhoneFeed() {
  return (
    <div className="relative flex items-center justify-center gap-4 py-10 sm:gap-8">
      {/* Feed */}
      <Phone className="ob-float hidden md:block" style={{ transform: 'rotate(-8deg) translateY(30px)', animationDelay: '-2s' }}>
        <div className="p-3 pt-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-8 w-8 rounded-full" style={{ background: 'conic-gradient(hsl(var(--ob-lime)), hsl(var(--ob-lime) / 0.2), hsl(var(--ob-lime)))' }} />
            <span className="h-2 w-16 rounded-full" style={{ background: 'hsl(var(--ob-fg) / 0.25)' }} />
          </div>
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className="ob-tile aspect-square rounded-sm" style={{ ...ART[['blob', 'stripes', 'dots', 'rings', 'grid', 'wave'][i % 6]], animationDelay: `${i * 0.35}s` }} />
            ))}
          </div>
        </div>
      </Phone>
      {/* Reels */}
      <Phone className="ob-float z-10" style={{ ...ART.blob }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 50%, hsl(var(--ob-ink) / 0.9))' }} />
        <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full" style={{ background: 'hsl(var(--ob-fg) / 0.2)', backdropFilter: 'blur(8px)' }}>
          <Play className="h-6 w-6" style={{ color: 'hsl(var(--ob-fg))', fill: 'hsl(var(--ob-fg))' }} />
        </div>
        <div className="absolute bottom-24 right-3 flex flex-col items-center gap-4" style={{ color: 'hsl(var(--ob-fg))' }}>
          <Heart className="ob-heart h-6 w-6" style={{ fill: 'hsl(var(--ob-lime))', color: 'hsl(var(--ob-lime))' }} />
          <MessageCircle className="h-6 w-6" />
          <Send className="h-6 w-6" />
          <Bookmark className="h-6 w-6" />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <Heart key={i} aria-hidden className="ob-hearts absolute bottom-28 right-4 h-4 w-4" style={{ color: 'hsl(var(--ob-lime))', fill: 'hsl(var(--ob-lime))', animationDelay: `${i * 0.7}s` }} />
        ))}
        <div className="absolute inset-x-3 bottom-5" style={{ color: 'hsl(var(--ob-fg))' }}>
          <p className="text-xs font-bold">@inova.co</p>
          <p className="mt-1 text-[11px] opacity-80">bastidor de hoje 🎬 quem apareceu? 👀</p>
          <div className="mt-3 h-1 overflow-hidden rounded-full" style={{ background: 'hsl(var(--ob-fg) / 0.25)' }}>
            <div className="ob-progress h-full" style={{ background: 'hsl(var(--ob-lime))' }} />
          </div>
        </div>
      </Phone>
      {/* Story */}
      <Phone className="ob-float hidden sm:block" style={{ transform: 'rotate(8deg) translateY(30px)', animationDelay: '-4s', ...ART.stripes }}>
        <div className="absolute inset-x-3 top-7 flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-0.5 flex-1 overflow-hidden rounded-full" style={{ background: 'hsl(var(--ob-fg) / 0.3)' }}>
              <span className="ob-story block h-full" style={{ background: 'hsl(var(--ob-fg))', animationDelay: `${i * 3}s` }} />
            </span>
          ))}
        </div>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, hsl(var(--ob-ink) / 0.2), hsl(var(--ob-ink) / 0.85))' }} />
        <div className="absolute inset-x-4 bottom-16 flex h-16 items-end justify-center gap-1">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className="ob-wave w-1.5 rounded-full" style={{ background: 'hsl(var(--ob-lime))', animationDelay: `${(i % 6) * 0.12}s` }} />
          ))}
        </div>
        <p className="absolute inset-x-3 bottom-6 text-center font-display text-sm font-bold" style={{ color: 'hsl(var(--ob-fg))' }}>Gravando o dia ✨</p>
      </Phone>
      {/* Notificações flutuando */}
      {[
        { t: '♥ curtiu seu Reels', c: 'left-[4%] top-[12%]', d: '0s' },
        { t: '✓ Postado às 18:00', c: 'right-[4%] top-[20%]', d: '-1.5s' },
        { t: '+ novo seguidor', c: 'left-[10%] bottom-[10%]', d: '-3s' },
        { t: '💬 "amei esse vídeo!"', c: 'right-[8%] bottom-[14%]', d: '-2.2s' },
      ].map((n) => (
        <span key={n.t} className={`ob-glass ob-float absolute z-20 hidden whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold lg:block ${n.c}`} style={{ animationDelay: n.d }}>{n.t}</span>
      ))}
    </div>
  );
}

/** Faixa de texto vazado */
function OutlineMarquee({ text, reverse = false }: { text: string; reverse?: boolean }) {
  return (
    <div aria-hidden className="overflow-hidden py-6">
      <div className={`ob-marquee flex w-max whitespace-nowrap font-display text-[clamp(3.5rem,10vw,9rem)] font-bold leading-none tracking-[-0.05em] ${reverse ? 'ob-reverse' : ''}`}>
        {[0, 1].map((k) => (
          <span key={k} className="pr-8">
            {text.split('•').filter((w) => w.trim()).map((w, i) => (
              <span key={i} className={i % 2 ? 'ob-solid' : 'ob-outline'}>{w.trim()}<span className="mx-6" style={{ color: 'hsl(var(--ob-lime))', WebkitTextStroke: 0 }}>✦</span></span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function CulturePage() {
  useSeo({ title: 'Bem-vindo à INOVA — Resultado. Prazo. Estratégia.', description: 'O onboarding de quem entra no time da INOVA: nossa cultura, nossos pilares e a sua primeira semana.', noindex: true });
  const marquee = 'RESULTADO • PRAZO • ESTRATÉGIA • INOVA PRODUTORA • ';

  return (
    <div className="ob min-h-screen overflow-x-hidden font-sans">
      <style>{CSS}</style>
      <div aria-hidden className="ob-grain pointer-events-none fixed inset-0 z-50" />

      {/* ── Topo ── */}
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-5 sm:px-8">
        <nav className="hidden gap-7 text-xs font-medium md:flex" style={{ color: 'hsl(var(--ob-fg) / 0.75)' }}>
          <a href="#pilares" className="hover:text-[hsl(var(--ob-lime))]">Pilares</a>
          <a href="#produtora" className="hover:text-[hsl(var(--ob-lime))]">Produtora</a>
          <a href="#regras" className="hover:text-[hsl(var(--ob-lime))]">Regras da casa</a>
          <a href="#semana" className="hover:text-[hsl(var(--ob-lime))]">Primeira semana</a>
        </nav>
        <img src={logoInova} alt="INOVA" className="h-6 md:absolute md:left-1/2 md:-translate-x-1/2" />
        <a href="#semana" className="ob-link flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">Onboarding <ArrowUpRight className="h-3.5 w-3.5" /></a>
      </header>

      {/* ── Hero ── */}
      <section className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden px-4 pb-16 pt-24 sm:px-8">
        <DotField />
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 0%, hsl(var(--ob-bg)) 75%)' }} />
        {/* Moldura de câmera */}
        <div aria-hidden className="pointer-events-none absolute inset-4 sm:inset-8">
          {['left-0 top-0 border-l-2 border-t-2', 'right-0 top-0 border-r-2 border-t-2', 'bottom-0 left-0 border-b-2 border-l-2', 'bottom-0 right-0 border-b-2 border-r-2'].map((c) => (
            <span key={c} className={`absolute h-8 w-8 ${c}`} style={{ borderColor: 'hsl(var(--ob-fg) / 0.5)' }} />
          ))}
          <div className="absolute left-4 top-14 flex items-center gap-2 font-mono text-[11px] sm:left-6 sm:top-16" style={{ color: 'hsl(var(--ob-fg) / 0.8)' }}>
            <span className="ob-rec h-2.5 w-2.5 rounded-full" style={{ background: 'hsl(var(--ob-rec))' }} /> REC <Timecode />
          </div>
          <div className="absolute bottom-4 right-4 hidden font-mono text-[11px] sm:block" style={{ color: 'hsl(var(--ob-fg) / 0.6)' }}>4K · 24FPS · ISO 800</div>
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-col gap-1">
          {[['Resultado.', 'Conteúdo que move o ponteiro do cliente'], ['Prazo.', 'O que a gente promete, a gente entrega'], ['Estratégia.', 'Nada é postado por acaso']].map(([w, s], i) => (
            <div key={w} className={`ob-hero-word flex items-end gap-4 ${i === 1 ? 'sm:justify-center' : i === 2 ? 'sm:flex-row-reverse sm:justify-start' : ''}`} style={{ animationDelay: `${150 + i * 180}ms` }}>
              <h1 className="font-display text-[clamp(3rem,11vw,9.5rem)] font-bold leading-[0.88] tracking-[-0.06em]"
                style={{ color: i === 1 ? 'hsl(var(--ob-lime))' : 'hsl(var(--ob-fg))' }}>{w}</h1>
              <p className={`mb-2 hidden max-w-[11rem] text-xs sm:block sm:text-sm ${i === 2 ? 'text-right' : ''}`} style={{ color: 'hsl(var(--ob-fg) / 0.6)' }}>{s}</p>
            </div>
          ))}
        </div>

        <div className="relative z-10 mx-auto mt-14 flex w-full max-w-[1400px] flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div className="ob-glass max-w-sm rounded-2xl p-5 ob-hero-word" style={{ animationDelay: '800ms' }}>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'hsl(var(--ob-lime))' }}>Bem-vindo ao time</p>
            <p className="mt-2 text-sm" style={{ color: 'hsl(var(--ob-fg) / 0.85)' }}>
              Você acabou de entrar numa <strong>produtora</strong> que transforma conteúdo em resultado. Antes do primeiro card, vem entender como a gente joga.
            </p>
          </div>
          <a href="#manifesto" className="ob-link ob-hero-word flex items-center gap-2 font-display text-lg font-bold uppercase tracking-tight sm:text-xl" style={{ animationDelay: '950ms' }}>
            Começar meu onboarding <ArrowDown className="h-5 w-5 ob-bounce" />
          </a>
        </div>
      </section>

      {/* ── Faixa ── */}
      <div className="relative overflow-hidden border-y py-4" style={{ borderColor: 'hsl(var(--ob-fg) / 0.08)' }}>
        <div className="ob-marquee flex w-max whitespace-nowrap font-display text-2xl font-bold tracking-[-0.03em] sm:text-4xl">
          {[0, 1].map((k) => <span key={k} className="pr-6" style={{ color: 'hsl(var(--ob-fg) / 0.16)' }}>{marquee.repeat(4)}</span>)}
        </div>
      </div>

      {/* ── Manifesto ── */}
      <section id="manifesto" className="mx-auto max-w-[1200px] px-4 py-28 sm:px-8 sm:py-40">
        <p className="mb-8 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'hsl(var(--ob-lime))' }}>Manifesto</p>
        <Manifesto />
      </section>

      {/* ── Rolo de filme ── */}
      <section className="pb-28" aria-label="O nosso dia em frames">
        <FilmStrip />
      </section>

      {/* ── Pilares ── */}
      <section id="pilares" className="mx-auto max-w-[1400px] px-4 pb-28 sm:px-8">
        <div className="mb-8 flex items-end gap-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'hsl(var(--ob-fg) / 0.5)' }}>Nossos pilares</p>
            <h2 className="font-display text-3xl font-bold uppercase tracking-[-0.03em] sm:text-4xl">Os 3 que não negociamos</h2>
          </div>
          <div className="mb-3 hidden h-px flex-1 md:block" style={{ background: 'hsl(var(--ob-fg) / 0.15)' }} />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {PILLARS.map((p, i) => (
            <Reveal key={p.name} delay={i * 120}>
              <article className="ob-card ob-pillar group relative h-full overflow-hidden rounded-3xl p-6 sm:p-8">
                <div aria-hidden className="ob-dots absolute right-6 top-6 h-16 w-16 opacity-60 transition-opacity group-hover:opacity-100" />
                <p className="font-display text-sm font-bold tabular-nums" style={{ color: 'hsl(var(--ob-lime))' }}>{p.n}</p>
                <p.Icon className="mt-8 h-8 w-8" style={{ color: 'hsl(var(--ob-lime))' }} />
                <h3 className="mt-4 font-display text-[clamp(2.4rem,4vw,3.6rem)] font-bold leading-none tracking-[-0.05em]">{p.name}</h3>
                <p className="mt-4 font-display text-lg font-semibold leading-snug">{p.line}</p>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: 'hsl(var(--ob-fg) / 0.65)' }}>{p.body}</p>
                <div className="mt-6 border-t pt-5" style={{ borderColor: 'hsl(var(--ob-fg) / 0.1)' }}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'hsl(var(--ob-fg) / 0.5)' }}>Na prática</p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {p.practice.map((x) => <li key={x} className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'hsl(var(--ob-lime))' }} />{x}</li>)}
                  </ul>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Produtora ── */}
      <section id="produtora" className="relative overflow-hidden px-4 py-28 sm:px-8" style={{ background: 'hsl(var(--ob-bg-2))' }}>
        <div className="mx-auto grid max-w-[1400px] items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'hsl(var(--ob-lime))' }}>A gente vive de conteúdo</p>
            <h2 className="mt-4 font-display text-[clamp(2.6rem,6vw,5.5rem)] font-bold leading-[0.92] tracking-[-0.05em]">
              A gente se<br />grava. <span style={{ color: 'hsl(var(--ob-lime))' }}>Muito.</span>
            </h2>
            <p className="mt-6 max-w-lg text-base leading-relaxed" style={{ color: 'hsl(var(--ob-fg) / 0.75)' }}>
              Somos uma produtora, então câmera ligada é parte do nosso dia: bastidores, trends, reunião que vira vídeo, ideia que vira cena. Ninguém é obrigado a aparecer, mas não se assuste se, vira e mexe, você estiver no vídeo. A gente adora quando o time topa entrar na brincadeira.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
              {['Ir numa captação só pra ver como é', 'Dar pitaco no roteiro', 'Fazer uma ponta num vídeo da INOVA', 'Gravar um bastidor do seu dia', 'Sugerir uma trend pro time', 'Ajudar o cliente a ficar à vontade'].map((t) => (
                <div key={t} className="flex items-start gap-2 rounded-xl p-3" style={{ background: 'hsl(var(--ob-fg) / 0.04)' }}>
                  <Clapperboard className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'hsl(var(--ob-lime))' }} />{t}
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={150} className="relative">
            <SpinBadge size={130} className="absolute -left-8 -top-10 z-10 hidden lg:block" />
            {/* Visor de câmera */}
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl sm:aspect-[16/12]">
              <img src={escritorioAsset.url} alt="Escritório da INOVA" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, hsl(var(--ob-bg) / 0.35), hsl(var(--ob-bg) / 0.15) 40%, hsl(var(--ob-bg) / 0.75))' }} />
              <div aria-hidden className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, i) => <span key={i} className="border-[0.5px]" style={{ borderColor: 'hsl(0 0% 100% / 0.12)' }} />)}
              </div>
              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full px-3 py-1 font-mono text-[11px]" style={{ background: 'hsl(0 0% 0% / 0.55)', color: 'hsl(0 0% 100%)' }}>
                <span className="ob-rec h-2 w-2 rounded-full" style={{ background: 'hsl(var(--ob-rec))' }} /> REC <Timecode />
              </div>
              <div className="absolute right-4 top-4 rounded-full px-3 py-1 font-mono text-[11px]" style={{ background: 'hsl(0 0% 0% / 0.55)', color: 'hsl(0 0% 100%)' }}>▮▮▮▯ 76%</div>
              <span aria-hidden className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2" style={{ borderColor: 'hsl(var(--ob-lime))' }} />
              <div className="absolute inset-x-5 bottom-5" style={{ color: 'hsl(0 0% 100%)' }}>
                <p className="font-display text-2xl font-bold tracking-[-0.03em] sm:text-3xl">Spoiler: você vai aparecer no story.</p>
                <p className="mt-1 text-xs opacity-75">E a gente promete escolher o seu melhor ângulo.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Liberdade x Responsabilidade ── */}
      <section className="mx-auto max-w-[1400px] px-4 py-28 sm:px-8">
        <Reveal className="mb-10 max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'hsl(var(--ob-lime))' }}>Como a gente joga</p>
          <h2 className="mt-3 font-display text-[clamp(2.2rem,5vw,4.2rem)] font-bold leading-[0.95] tracking-[-0.05em]">Liberdade para criar. Carinho com o que entrega.</h2>
          <p className="mt-4 text-base" style={{ color: 'hsl(var(--ob-fg) / 0.65)' }}>Arraste e veja os dois lados da INOVA.</p>
        </Reveal>
        <Reveal><Balance /></Reveal>
      </section>

      {/* ── Fluxo ── */}
      <section className="mx-auto max-w-[1400px] px-4 pb-28 sm:px-8">
        <Reveal className="mb-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'hsl(var(--ob-fg) / 0.5)' }}>Da ideia ao feed</p>
          <h2 className="font-display text-3xl font-bold uppercase tracking-[-0.03em] sm:text-4xl">Todo conteúdo passa por aqui</h2>
          <p className="mt-3 max-w-2xl text-sm" style={{ color: 'hsl(var(--ob-fg) / 0.65)' }}>Cada etapa vive como um card na plataforma INOVA, com responsável e data. Se o card anda, o cliente cresce. Se o card para, alguém precisa saber.</p>
        </Reveal>
        <Flow />
      </section>

      {/* ── Do set pro feed ── */}
      <section className="relative overflow-hidden px-4 pb-28 sm:px-8">
        <div aria-hidden className="ob-dots-bg pointer-events-none absolute inset-0 opacity-40" />
        <Reveal className="relative mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'hsl(var(--ob-lime))' }}>Do set pro feed</p>
          <h2 className="mt-3 font-display text-[clamp(2.2rem,5vw,4.2rem)] font-bold leading-[0.95] tracking-[-0.05em]">O que a gente grava de manhã, o mundo vê à noite.</h2>
        </Reveal>
        <div className="relative mx-auto max-w-[1100px]"><PhoneFeed /></div>
      </section>

      {/* ── Regras da casa ── */}
      <section id="regras" className="px-4 py-28 sm:px-8" style={{ background: 'hsl(var(--ob-bg-2))' }}>
        <div className="mx-auto max-w-[1400px]">
          <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'hsl(var(--ob-lime))' }}>Regras da casa</p>
              <h2 className="mt-2 font-display text-[clamp(2.2rem,5vw,4rem)] font-bold leading-none tracking-[-0.05em]">O jeito INOVA<br />de trabalhar junto.</h2>
            </div>
            <Users className="h-10 w-10" style={{ color: 'hsl(var(--ob-lime))' }} />
          </Reveal>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {RULES.map((r, i) => (
              <Reveal key={r.k} delay={i * 70}>
                <div className="ob-rule ob-card group relative h-full overflow-hidden rounded-2xl p-6">
                  <span className="font-display text-xs font-bold tabular-nums" style={{ color: 'hsl(var(--ob-fg) / 0.35)' }}>{String(i + 1).padStart(2, '0')}</span>
                  <p className="mt-6 font-display text-2xl font-bold leading-tight tracking-[-0.03em] transition-colors group-hover:text-[hsl(var(--ob-ink))]">{r.k}</p>
                  <p className="mt-2 text-sm transition-colors group-hover:text-[hsl(var(--ob-ink)/0.8)]" style={{ color: undefined }}>{r.v}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <OutlineMarquee text="CRIA • GRAVA • POSTA • COMEMORA • REPETE •" />

      {/* ── Primeira semana ── */}
      <section id="semana" className="mx-auto max-w-[1400px] px-4 py-28 sm:px-8">
        <Reveal className="mb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'hsl(var(--ob-lime))' }}>Sua primeira semana</p>
          <h2 className="mt-2 font-display text-[clamp(2.2rem,5vw,4rem)] font-bold leading-none tracking-[-0.05em]">Cinco dias para virar INOVA.</h2>
          <p className="mt-3 text-sm" style={{ color: 'hsl(var(--ob-fg) / 0.65)' }}>Vai marcando conforme acontece. Fica salvo neste aparelho.</p>
        </Reveal>
        <Week />
      </section>

      {/* ── Fechamento ── */}
      <section className="relative overflow-hidden px-4 py-24 sm:px-8 sm:py-32" style={{ background: 'hsl(var(--ob-lime))', color: 'hsl(var(--ob-ink))' }}>
        <div aria-hidden className="ob-dots-ink pointer-events-none absolute inset-0" />
        <div className="relative mx-auto flex max-w-[1400px] flex-col items-start gap-10 lg:flex-row lg:items-end lg:justify-between">
          <Reveal>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">Agora é com você</p>
            <h2 className="mt-3 font-display text-[clamp(3.2rem,11vw,10rem)] font-bold leading-[0.86] tracking-[-0.07em]">Bem-vindo<br />ao time.</h2>
            <p className="mt-6 max-w-md text-base font-medium opacity-80">Que bom ter você aqui. Traz suas ideias, chama o time quando precisar e bora fazer conteúdo que dá resultado.</p>
            <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 font-display text-sm font-bold uppercase tracking-wide transition-transform hover:-translate-y-0.5"
              style={{ background: 'hsl(var(--ob-ink))', color: 'hsl(var(--ob-lime))' }}>
              Voltar ao começo <ArrowUp className="h-4 w-4" />
            </a>
          </Reveal>
          <SpinBadge size={220} ink className="hidden sm:block" />
        </div>
      </section>

      {/* ── Rodapé ── */}
      <footer className="relative overflow-hidden border-t px-4 pb-10 pt-20 sm:px-8" style={{ borderColor: 'hsl(var(--ob-fg) / 0.08)' }}>
        <p aria-hidden className="pointer-events-none select-none text-center font-display text-[22vw] font-bold leading-none tracking-[-0.08em]" style={{ color: 'hsl(var(--ob-fg) / 0.04)' }}>INOVA</p>
        <div className="mx-auto -mt-[8vw] flex max-w-[1400px] flex-col items-center gap-3 text-center">
          <img src={logoInova} alt="INOVA" className="h-7" />
          <p className="font-display text-xl font-semibold">Resultado. <span style={{ color: 'hsl(var(--ob-lime))' }}>Prazo.</span> Estratégia.</p>
          <p className="text-xs" style={{ color: 'hsl(var(--ob-fg) / 0.45)' }}>INOVA Produtora · Feito pelo time, para o time.</p>
        </div>
      </footer>
    </div>
  );
}

const CSS = `
.ob {
  --ob-bg: 150 8% 5%;
  --ob-bg-2: 150 7% 8%;
  --ob-fg: 120 8% 95%;
  --ob-ink: 140 10% 7%;
  --ob-lime: 75 90% 57%;
  --ob-rec: 0 84% 58%;
  background: hsl(var(--ob-bg));
  color: hsl(var(--ob-fg));
  scroll-behavior: smooth;
}
.ob ::selection { background: hsl(var(--ob-lime)); color: hsl(var(--ob-ink)); }
.ob-card { background: hsl(var(--ob-fg) / 0.035); border: 1px solid hsl(var(--ob-fg) / 0.08); }
.ob-glass { background: hsl(var(--ob-bg) / 0.55); border: 1px solid hsl(var(--ob-fg) / 0.1); backdrop-filter: blur(14px); }
.ob-link { color: hsl(var(--ob-lime)); position: relative; }
.ob-link::after { content: ''; position: absolute; left: 0; right: 0; bottom: -4px; height: 2px; background: currentColor; transform-origin: left; transition: transform .35s ease; }
.ob-link:hover::after { transform: scaleX(.3); }
.ob-btn { background: hsl(var(--ob-lime)); color: hsl(var(--ob-ink)); transition: transform .2s ease, box-shadow .2s ease; }
.ob-btn:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 12px 30px -10px hsl(var(--ob-lime) / .6); }
.ob-dots { background-image: radial-gradient(circle, hsl(var(--ob-lime)) 2px, transparent 2.5px); background-size: 12px 12px; -webkit-mask-image: radial-gradient(circle, #000 40%, transparent 72%); mask-image: radial-gradient(circle, #000 40%, transparent 72%); }
.ob-pillar { transition: transform .5s cubic-bezier(.2,.8,.2,1), border-color .3s; }
.ob-pillar:hover { transform: translateY(-6px); border-color: hsl(var(--ob-lime) / .5); }
.ob-rule { transition: background .35s ease, transform .35s ease; }
.ob-rule p:last-child { color: hsl(var(--ob-fg) / .6); }
.ob-rule:hover { background: hsl(var(--ob-lime)); transform: translateY(-4px); }
.ob-rule:hover p, .ob-rule:hover span { color: hsl(var(--ob-ink)) !important; }
.ob-reveal { opacity: 0; transform: translateY(40px); transition: opacity .9s ease, transform .9s cubic-bezier(.2,.8,.2,1); }
.ob-reveal.ob-in { opacity: 1; transform: none; }
.ob-hero-word { opacity: 0; animation: obUp 1s cubic-bezier(.2,.8,.2,1) forwards; }
@keyframes obUp { from { opacity: 0; transform: translateY(60px); filter: blur(8px); } to { opacity: 1; transform: none; filter: none; } }
.ob-rec { animation: obBlink 1.1s steps(2, start) infinite; }
@keyframes obBlink { to { visibility: hidden; } }
.ob-bounce { animation: obBounce 1.6s ease-in-out infinite; }
@keyframes obBounce { 50% { transform: translateY(5px); } }
.ob-marquee { animation: obMarquee 40s linear infinite; }
@keyframes obMarquee { to { transform: translateX(-50%); } }
.ob-grain { opacity: .06; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"); animation: obGrain .5s steps(4) infinite; }
@keyframes obGrain { 25% { transform: translate(-3%, 2%); } 50% { transform: translate(2%, -3%); } 75% { transform: translate(-2%, -2%); } }
.ob-spin { animation: obSpin 18s linear infinite; }
@keyframes obSpin { to { transform: rotate(360deg); } }
.ob-pulse { animation: obPulse 1.8s ease-in-out infinite; }
@keyframes obPulse { 50% { transform: scale(.55); opacity: .5; } }
.ob-film { animation: obMarquee 50s linear infinite; }
.ob-reverse { animation-direction: reverse; }
.ob-sprockets { background: repeating-linear-gradient(90deg, transparent 0 10px, hsl(var(--ob-fg) / .85) 10px 22px, transparent 22px 34px); -webkit-mask: linear-gradient(transparent 25%, #000 25% 75%, transparent 75%); mask: linear-gradient(transparent 25%, #000 25% 75%, transparent 75%); }
.ob-float { animation: obFloat 6s ease-in-out infinite; }
@keyframes obFloat { 50% { translate: 0 -14px; } }
.ob-tile { animation: obTile 4.2s ease-in-out infinite; }
@keyframes obTile { 0%, 70%, 100% { opacity: 1; } 80% { opacity: .25; } }
.ob-heart { animation: obBeat 1.4s ease-in-out infinite; }
@keyframes obBeat { 15% { transform: scale(1.3); } 30% { transform: scale(1); } }
.ob-hearts { opacity: 0; animation: obHearts 2.8s ease-out infinite; }
@keyframes obHearts { 0% { opacity: 0; transform: translate(0, 0) scale(.6); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(-30px, -160px) scale(1.2) rotate(-20deg); } }
.ob-progress { animation: obProgress 6s linear infinite; }
@keyframes obProgress { from { width: 0; } to { width: 100%; } }
.ob-story { width: 0; animation: obProgress 9s linear infinite; }
.ob-wave { height: 20%; animation: obWave 1s ease-in-out infinite alternate; }
@keyframes obWave { to { height: 100%; } }
.ob-outline { color: transparent; -webkit-text-stroke: 1.5px hsl(var(--ob-fg) / .35); }
.ob-solid { color: hsl(var(--ob-fg)); }
.ob-dots-bg { background-image: radial-gradient(circle, hsl(var(--ob-lime) / .35) 1.2px, transparent 1.6px); background-size: 26px 26px; -webkit-mask-image: radial-gradient(ellipse at 50% 60%, #000 20%, transparent 70%); mask-image: radial-gradient(ellipse at 50% 60%, #000 20%, transparent 70%); }
.ob-dots-ink { background-image: radial-gradient(circle, hsl(var(--ob-ink) / .18) 1.5px, transparent 2px); background-size: 22px 22px; -webkit-mask-image: linear-gradient(90deg, transparent, #000 70%); mask-image: linear-gradient(90deg, transparent, #000 70%); }
@media (prefers-reduced-motion: reduce) {
  .ob *, .ob-grain { animation: none !important; transition: none !important; }
  .ob-reveal, .ob-hero-word { opacity: 1; transform: none; }
}
`;
