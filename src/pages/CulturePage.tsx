import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Check, Clock3, Compass, Target } from 'lucide-react';
import logoInova from '@/assets/logo-inova.png';
import escritorioAsset from '@/assets/escritorio-inova-recepcao.jpg.asset.json';
import { useSeo } from '@/lib/seo';

/**
 * /cultura — onboarding de quem entra no time: a cultura da INOVA (Resultado, Prazo, Estratégia),
 * que somos uma produtora (a gente se grava, e quem quiser aparece junto), liberdade criativa com responsabilidade e a primeira semana.
 * Página pública com visual próprio: fundo claro, bento grid, objetos de vidro em CSS e transições guiadas pela rolagem.
 */

const PILLARS = [
  {
    n: '01', name: 'Resultado', Icon: Target,
    line: 'Conteúdo bonito que não move o ponteiro é decoração.',
    body: 'Cada vídeo, cada arte e cada legenda existem para fazer o cliente crescer: mais alcance, mais lead, mais venda. A pergunta aqui nunca é "ficou bom?". É "funcionou?".',
    practice: ['Saiba o objetivo do post', 'Olhe os números', 'Proponha melhorias'],
  },
  {
    n: '02', name: 'Prazo', Icon: Clock3,
    line: 'Prazo é promessa. E promessa a gente cumpre.',
    body: 'O cliente confia no dia e na hora que combinamos. Por isso o prazo é um compromisso do time inteiro, e a gente se ajuda para chegar lá.',
    practice: ['Data marcada é data cumprida', 'Vai atrasar? Avise antes'],
  },
  {
    n: '03', name: 'Estratégia', Icon: Compass,
    line: 'A gente não posta por postar.',
    body: 'Por trás de cada pauta existe um porquê: o público, o momento, o funil. Criatividade sem estratégia é sorte. A INOVA vive no meio.',
    practice: ['Entenda o cliente', 'Pense em série, não em post solto'],
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

const C = {
  ink: 'hsl(var(--c-ink))',
  muted: 'hsl(var(--c-muted))',
  lime: 'hsl(var(--c-lime))',
  dark: 'hsl(var(--c-dark))',
  card: 'hsl(var(--c-card))',
  light: 'hsl(var(--c-light))',
};

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('is-in'); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useReveal<HTMLDivElement>();
  return <div ref={ref} className={`cx-reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

/** Título que sobe de dentro de uma máscara, linha por linha */
function MaskTitle({ lines, className = '', style }: { lines: React.ReactNode[]; className?: string; style?: React.CSSProperties }) {
  const ref = useReveal<HTMLHeadingElement>();
  return (
    <h2 ref={ref} className={`cx-mask font-display font-semibold tracking-[-0.045em] ${className}`} style={style}>
      {lines.map((l, i) => <span key={i} className="block overflow-hidden pb-[0.08em]"><span className="block" style={{ transitionDelay: `${i * 90}ms` }}>{l}</span></span>)}
    </h2>
  );
}

/** Progresso da rolagem dentro da seção (0 → 1) em --p, sem re-render */
function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current; if (!el) return;
      const b = el.getBoundingClientRect();
      const total = Math.max(1, b.height - window.innerHeight);
      el.style.setProperty('--p', String(Math.min(1, Math.max(0, -b.top / total))));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
  }, []);
  return ref;
}

/* ───────────── Objetos de vidro ───────────── */

function Tile({ dark = false, className = '', style, children }: { dark?: boolean; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <div aria-hidden className={`cx-tile ${dark ? 'cx-tile-dark' : ''} ${/\babsolute\b/.test(className) ? '' : 'relative'} ${className}`} style={style}>{children}</div>;
}

/** Composição do topo: prato de vidro com barras crescendo (resultado) e peças flutuando */
function GlassScene() {
  return (
    <div aria-hidden className="relative mx-auto aspect-square w-full max-w-[560px]">
      <div className="cx-glow absolute inset-[12%] rounded-full" />
      {/* Prato e barras */}
      <div className="absolute inset-x-[10%] bottom-[12%] h-[56%]">
        <div className="cx-dish absolute inset-x-0 bottom-0 h-[24%]" />
        <div className="absolute inset-x-[18%] bottom-[11%] flex h-full items-end justify-between">
          {[42, 64, 88].map((h, i) => (
            <div key={h} className="cx-bar w-[24%]" style={{ height: `${h}%`, animationDelay: `${400 + i * 180}ms` }} />
          ))}
        </div>
      </div>
      {/* Peças flutuantes, com parallax pela rolagem */}
      <div className="cx-par absolute left-[4%] top-[8%] w-[24%]" style={{ ['--f' as string]: -0.18, ['--r' as string]: -14 }}>
        <Tile className="cx-float aspect-square w-full">
          <span className="absolute left-[22%] top-[24%] h-[30%] w-[44%] rounded-[30%]" style={{ background: C.lime }} />
          <span className="absolute bottom-[22%] right-[20%] h-[30%] w-[30%] rounded-full" style={{ background: C.ink }} />
        </Tile>
      </div>
      <div className="cx-par absolute right-[6%] top-[2%] w-[21%]" style={{ ['--f' as string]: -0.32, ['--r' as string]: 12 }}>
        <Tile className="cx-float aspect-square w-full" style={{ animationDelay: '-2s' }}>
          <svg viewBox="0 0 60 60" className="absolute inset-[18%]" fill="none"><path d="M4 46 L20 30 L32 38 L56 12" stroke="hsl(var(--c-ink))" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="56" cy="12" r="5" fill="hsl(var(--c-lime))" /></svg>
        </Tile>
      </div>
      <div className="cx-par absolute left-[0%] top-[44%] w-[20%]" style={{ ['--f' as string]: -0.1, ['--r' as string]: 8 }}>
        <Tile dark className="cx-float aspect-square w-full" style={{ animationDelay: '-4s' }}>
          <span className="absolute left-1/2 top-1/2 h-0 w-0 -translate-x-[35%] -translate-y-1/2" style={{ borderLeft: '22px solid hsl(var(--c-lime))', borderTop: '14px solid transparent', borderBottom: '14px solid transparent' }} />
        </Tile>
      </div>
      <div className="cx-par absolute right-[0%] top-[42%] w-[13%]" style={{ ['--f' as string]: -0.4, ['--r' as string]: 0 }}>
        <div className="cx-bubble cx-float aspect-square w-full" style={{ animationDelay: '-1s' }} />
      </div>
      <div className="cx-par absolute left-[30%] top-[2%] w-[7%]" style={{ ['--f' as string]: -0.5, ['--r' as string]: 0 }}>
        <div className="cx-bubble cx-float aspect-square w-full" style={{ animationDelay: '-3s' }} />
      </div>
    </div>
  );
}

/** Borda rasgada entre seções (como o corte de papel do vídeo de referência) */
function Torn({ color, flip = false }: { color: string; flip?: boolean }) {
  let seed = flip ? 7 : 3;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  let d = 'M0 40 L0 22';
  for (let x = 0; x <= 1440; x += 18) d += ` L${x} ${10 + rnd() * 22}`;
  d += ' L1440 40 Z';
  return (
    <svg aria-hidden viewBox="0 0 1440 40" preserveAspectRatio="none" className={`relative z-10 -mb-px block h-5 w-full sm:h-8 ${flip ? '-mt-px rotate-180' : ''}`}>
      <path d={d} fill={color} />
    </svg>
  );
}

/* ───────────── Seções interativas ───────────── */

function Timecode() {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => setMs(performance.now() - start), 1000 / 24);
    return () => clearInterval(id);
  }, []);
  const s = Math.floor(ms / 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return <span className="tabular-nums">{p(Math.floor(s / 60) % 60)}:{p(s % 60)}:{p(Math.floor((ms % 1000) / (1000 / 24)))}</span>;
}

/** Palavras gigantes correndo atrás do objeto de vidro, guiadas pela rolagem */
function BigWords() {
  const ref = useScrollProgress<HTMLElement>();
  return (
    <section ref={ref} className="relative h-[240vh]" aria-label="Resultado, prazo e estratégia">
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden">
        <p className="cx-row whitespace-nowrap font-display text-[clamp(5rem,19vw,17rem)] font-bold leading-[0.85] tracking-[-0.06em]" style={{ color: C.ink, transform: 'translateX(calc(var(--p, 0) * -55% + 4%))' }}>
          Resultado. Prazo. Estratégia.
        </p>
        <p className="cx-row whitespace-nowrap font-display text-[clamp(5rem,19vw,17rem)] font-bold leading-[0.85] tracking-[-0.06em]" style={{ color: 'hsl(var(--c-ink) / 0.09)', transform: 'translateX(calc(var(--p, 0) * 45% - 60%))' }}>
          Cria. Grava. Posta. Repete.
        </p>
        {/* Objeto no meio, girando */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 w-[clamp(150px,26vw,330px)]"
          style={{ transform: 'translate(-50%, -50%) rotate(calc(var(--p, 0) * 50deg - 22deg)) scale(calc(0.85 + var(--p, 0) * 0.3))' }}>
          <Tile dark className="aspect-square w-full">
            <span className="absolute left-1/2 top-1/2 h-0 w-0 -translate-x-[35%] -translate-y-1/2" style={{ borderLeft: 'clamp(34px,6vw,76px) solid hsl(var(--c-lime))', borderTop: 'clamp(22px,3.8vw,48px) solid transparent', borderBottom: 'clamp(22px,3.8vw,48px) solid transparent' }} />
          </Tile>
          <div className="cx-bubble absolute -right-[14%] -top-[10%] aspect-square w-[26%]" />
        </div>
        <p className="absolute inset-x-0 bottom-8 text-center text-xs font-medium uppercase tracking-[0.2em]" style={{ color: C.muted }}>Três palavras. Todo santo dia.</p>
      </div>
    </section>
  );
}

function Manifesto() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = ref.current; if (!el) return;
      const b = el.getBoundingClientRect();
      setProgress(Math.min(1, Math.max(0, (window.innerHeight * 0.85 - b.top) / (b.height + window.innerHeight * 0.3))));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const words = MANIFESTO.split(' ');
  const lit = Math.round(progress * words.length * 1.15);
  return (
    <div ref={ref} className="font-display text-[clamp(1.9rem,4.8vw,4.2rem)] font-semibold leading-[1.1] tracking-[-0.035em]">
      {words.map((w, i) => {
        const strong = /resultado|produtora|liberdade|confia|sempre/i.test(w);
        return (
          <span key={i} className="transition-colors duration-300"
            style={{ color: i < lit ? (strong ? C.lime : C.light) : 'hsl(var(--c-light) / 0.13)' }}>{w} </span>
        );
      })}
    </div>
  );
}

function Balance() {
  const [v, setV] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const drag = (clientX: number) => {
    const b = ref.current!.getBoundingClientRect();
    setV(Math.min(96, Math.max(4, ((clientX - b.left) / b.width) * 100)));
  };
  return (
    <div ref={ref} className="relative h-[400px] select-none overflow-hidden rounded-[32px] sm:h-[440px]"
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); drag(e.clientX); }}
      onPointerMove={(e) => { if (e.buttons) drag(e.clientX); }}>
      <div className="absolute inset-0 flex items-center justify-end p-6 sm:p-12" style={{ background: C.lime, color: C.ink }}>
        <div className="max-w-[46%] text-right">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-60">Responsabilidade</p>
          <p className="mt-2 font-display text-[clamp(1.5rem,3.6vw,3.2rem)] font-semibold leading-[0.98] tracking-[-0.045em]">Dono do que entrega.</p>
          <p className="mt-3 hidden text-sm font-medium opacity-75 sm:block">Combinou, cumpre. Começou, termina. Apertou? Avisa, que o time segura junto.</p>
        </div>
      </div>
      <div className="absolute inset-0 flex items-center p-6 sm:p-12" style={{ clipPath: `inset(0 ${100 - v}% 0 0)`, background: C.dark, color: C.light }}>
        <div className="max-w-[46%]">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: C.lime }}>Liberdade</p>
          <p className="mt-2 font-display text-[clamp(1.5rem,3.6vw,3.2rem)] font-semibold leading-[0.98] tracking-[-0.045em]">Crie sem pedir licença.</p>
          <p className="mt-3 hidden text-sm opacity-70 sm:block">Ideia maluca? Traga. Formato novo? Teste. Aqui não tem "sempre foi assim".</p>
        </div>
      </div>
      <div className="absolute inset-y-0 w-px" style={{ left: `${v}%`, background: 'hsl(var(--c-light) / 0.9)' }}>
        <button type="button" aria-label="Arraste para comparar" role="slider" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}
          onKeyDown={(e) => { if (e.key === 'ArrowLeft') setV((x) => Math.max(4, x - 5)); if (e.key === 'ArrowRight') setV((x) => Math.min(96, x + 5)); }}
          className="cx-tile absolute top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center !rounded-full text-sm font-bold"
          style={{ color: C.ink }}>⟷</button>
      </div>
    </div>
  );
}

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
    <div ref={ref} className="flex flex-wrap gap-2.5">
      {FLOW.map((s, i) => (
        <div key={s} className="flex items-center gap-2.5">
          <span className="flex items-center gap-2.5 rounded-full py-2 pl-2 pr-5 text-sm font-semibold transition-all duration-500"
            style={i <= active
              ? { background: C.ink, color: C.light, boxShadow: '0 14px 30px -14px hsl(var(--c-ink) / 0.6)' }
              : { background: C.card, color: C.muted, boxShadow: 'inset 0 0 0 1px hsl(var(--c-ink) / 0.08)' }}>
            <span className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-colors duration-500"
              style={i <= active ? { background: C.lime, color: C.ink } : { background: 'hsl(var(--c-ink) / 0.06)' }}>{i + 1}</span>
            {s}
          </span>
          {i < FLOW.length - 1 && <ArrowRight className="h-4 w-4" style={{ color: i < active ? C.ink : 'hsl(var(--c-ink) / 0.2)' }} />}
        </div>
      ))}
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
        <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: 'hsl(var(--c-ink) / 0.07)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(count / total) * 100}%`, background: C.ink }} />
        </div>
        <span className="font-display text-sm font-semibold tabular-nums">{count}/{total}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {WEEK.map((d, di) => (
          <Reveal key={d.day} delay={di * 80}>
            <div className="cx-card h-full rounded-[26px] p-5">
              <span className="inline-block rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: C.lime, color: C.ink }}>{d.day}</span>
              <p className="mt-3 font-display text-xl font-semibold tracking-[-0.03em]">{d.title}</p>
              <ul className="mt-4 space-y-2.5">
                {d.items.map((it) => {
                  const k = `${d.day}:${it}`; const on = !!done[k];
                  return (
                    <li key={it}>
                      <button type="button" onClick={() => toggle(k)} className="flex w-full items-start gap-2.5 text-left text-sm" aria-pressed={on}>
                        <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors"
                          style={on ? { background: C.ink, borderColor: 'transparent', color: C.lime } : { borderColor: 'hsl(var(--c-ink) / 0.25)' }}>
                          {on && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <span style={{ color: on ? 'hsl(var(--c-ink) / 0.4)' : 'hsl(var(--c-ink) / 0.8)', textDecoration: on ? 'line-through' : 'none' }}>{it}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
      {count === total && <p className="mt-6 text-center font-display text-xl font-semibold">Primeira semana fechada. Agora é com você. 🔥</p>}
    </div>
  );
}

const PROCESS = [
  { name: 'Cliente entrou', what: 'Boas-vindas, grupo no WhatsApp e o briefing enviado para o cliente preencher.', why: 'A gente começa com informação, não com achismo. Tudo o que vem depois sai daqui.' },
  { name: 'Diagnóstico', what: 'Entender o negócio, o público, o perfil atual e a concorrência.', why: 'Não dá para tratar sem diagnosticar. Se a gente não sabe onde o cliente está, não sabe para onde levar.' },
  { name: 'Plano de ação', what: 'Metas dos próximos 3 meses, linhas editoriais, formatos e frequência.', why: 'Com o plano, todo mundo do time sabe para onde vai e o cliente sabe o que esperar.' },
  { name: 'Organizar o perfil', what: 'Bio, destaques e posts fixados arrumados antes de qualquer conteúdo novo.', why: 'O perfil é a vitrine. Quem chega pelo conteúdo novo precisa encontrar a casa arrumada, senão vai embora.' },
  { name: 'Captação', what: 'Gravar com roteiro pronto, sabendo o que, por que e para quem.', why: 'Só gravamos depois de saber o objetivo de cada vídeo. Assim nenhum dia de set é desperdiçado.' },
];

/** O processo de todo cliente novo, com o porquê de cada etapa */
function Process() {
  const [i, setI] = useState(0);
  const step = PROCESS[i];
  return (
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <ol className="flex flex-col gap-2">
        {PROCESS.map((s, k) => (
          <li key={s.name}>
            <button type="button" onClick={() => setI(k)} aria-pressed={k === i}
              className="flex w-full items-center gap-4 rounded-[22px] p-3 pr-5 text-left transition-all duration-300"
              style={k === i
                ? { background: C.ink, color: C.light, boxShadow: '0 20px 40px -24px hsl(var(--c-ink) / 0.7)' }
                : { background: C.card, color: C.ink, boxShadow: 'inset 0 0 0 1px hsl(var(--c-ink) / 0.06)' }}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-display text-sm font-semibold"
                style={k === i ? { background: C.lime, color: C.ink } : { background: 'hsl(var(--c-ink) / 0.05)' }}>{String(k + 1).padStart(2, '0')}</span>
              <span className="font-display text-lg font-semibold tracking-[-0.03em]">{s.name}</span>
              {k < i && <Check className="ml-auto h-4 w-4" style={{ color: C.muted }} />}
              {k === i && <ArrowRight className="ml-auto h-4 w-4" style={{ color: C.lime }} />}
            </button>
          </li>
        ))}
      </ol>
      <div key={i} className="cx-darkcard cx-swap relative flex min-h-[360px] flex-col justify-between overflow-hidden rounded-[32px] p-7 sm:p-10">
        <div className="relative z-10">
          <span className="font-display text-sm font-semibold" style={{ color: C.lime }}>Etapa {i + 1} de {PROCESS.length}</span>
          <h3 className="mt-3 font-display text-[clamp(2.2rem,4.4vw,3.6rem)] font-semibold leading-none tracking-[-0.05em]">{step.name}</h3>
          <p className="mt-4 max-w-md text-base" style={{ color: 'hsl(var(--c-light) / 0.75)' }}>{step.what}</p>
        </div>
        <div className="relative z-10 mt-8 rounded-[22px] p-5" style={{ background: 'hsl(var(--c-light) / 0.06)', boxShadow: 'inset 0 0 0 1px hsl(var(--c-light) / 0.08)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: C.lime }}>Por que é assim</p>
          <p className="mt-2 font-display text-lg font-medium leading-snug">{step.why}</p>
        </div>
        <div aria-hidden className="absolute -right-6 -top-6 font-display text-[11rem] font-semibold leading-none tracking-[-0.08em]" style={{ color: 'hsl(var(--c-light) / 0.04)' }}>{String(i + 1).padStart(2, '0')}</div>
        <div className="absolute bottom-0 left-0 h-1" style={{ width: `${((i + 1) / PROCESS.length) * 100}%`, background: C.lime, transition: 'width .5s ease' }} />
      </div>
    </div>
  );
}

const BRIEFING_TOPICS = ['Objetivos para os próximos 3 meses', 'Público: idade, gênero, região', 'Dores do público', 'Desejos do público', 'Diferenciais do cliente', 'Concorrentes', 'Estilo de comunicação', 'Expectativa de faturamento'];

const PROFILE_CHECKS = [
  'A bio diz o que o cliente faz, para quem, e tem uma chamada para ação',
  'Foto de perfil nítida e reconhecível',
  'Link da bio funcionando e levando para o lugar certo',
  'Destaques organizados, com capas no padrão da marca',
  '3 posts fixados estratégicos (quem somos, prova social, oferta)',
  'Frequência de postagem constante',
  'Identidade visual reconhecível no feed',
  'Já sabemos quais formatos performam melhor (Reels, carrossel, story)',
  'Engajamento real: comentários e salvamentos, não só curtidas',
  'Comparamos com pelo menos 3 concorrentes',
];

/** Guia do diagnóstico, com um checklist de treino */
function DiagnosticGuide() {
  const [ok, setOk] = useState<boolean[]>(() => PROFILE_CHECKS.map(() => false));
  const score = ok.filter(Boolean).length * 10;
  return (
    <div className="grid gap-4 lg:grid-cols-6">
      <Reveal className="lg:col-span-2">
        <div className="cx-card h-full rounded-[32px] p-7">
          <span className="inline-block rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: C.lime, color: C.ink }}>Passo 1</span>
          <h3 className="mt-4 font-display text-2xl font-semibold tracking-[-0.035em]">Ler o briefing</h3>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: C.muted }}>O cliente preenche o briefing e as respostas aparecem na plataforma, em Clientes → aba Diagnóstico. Leia tudo antes de abrir o Instagram.</p>
          <ul className="mt-5 space-y-2 text-sm">
            {BRIEFING_TOPICS.map((t) => <li key={t} className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: C.ink }} />{t}</li>)}
          </ul>
        </div>
      </Reveal>
      <Reveal className="lg:col-span-4" delay={100}>
        <div className="cx-card h-full rounded-[32px] p-7 sm:p-9">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-md">
              <span className="inline-block rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: C.lime, color: C.ink }}>Passo 2</span>
              <h3 className="mt-4 font-display text-2xl font-semibold tracking-[-0.035em]">Analisar o perfil</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: C.muted }}>Abra o Instagram do cliente e passe ponto por ponto. Treine aqui: marque o que um perfil forte precisa ter.</p>
            </div>
            <div className="relative h-24 w-24 shrink-0">
              <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(hsl(var(--c-lime)) ${score * 3.6}deg, hsl(var(--c-ink) / 0.07) 0)`, WebkitMask: 'radial-gradient(circle, transparent 58%, #000 59%)', mask: 'radial-gradient(circle, transparent 58%, #000 59%)', transition: 'background .4s' }} />
              <span className="absolute inset-0 flex flex-col items-center justify-center font-display text-2xl font-semibold tabular-nums">{score}<span className="text-[10px] font-medium" style={{ color: C.muted }}>de 100</span></span>
            </div>
          </div>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {PROFILE_CHECKS.map((t, k) => (
              <li key={t}>
                <button type="button" aria-pressed={ok[k]} onClick={() => setOk((o) => o.map((v, j) => (j === k ? !v : v)))}
                  className="flex h-full w-full items-start gap-2.5 rounded-2xl p-3 text-left text-sm transition-colors"
                  style={{ background: ok[k] ? 'hsl(var(--c-lime) / 0.35)' : 'hsl(var(--c-ink) / 0.04)' }}>
                  <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border"
                    style={ok[k] ? { background: C.ink, borderColor: 'transparent', color: C.lime } : { borderColor: 'hsl(var(--c-ink) / 0.25)' }}>
                    {ok[k] && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  {t}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
      <Reveal className="lg:col-span-6" delay={150}>
        <div className="cx-darkcard grid gap-6 rounded-[32px] p-7 sm:p-9 md:grid-cols-[1fr_2fr] md:items-center">
          <div>
            <span className="inline-block rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: C.lime, color: C.ink }}>Passo 3</span>
            <h3 className="mt-4 font-display text-2xl font-semibold tracking-[-0.035em]">Fechar o diagnóstico</h3>
            <p className="mt-2 text-sm" style={{ color: 'hsl(var(--c-light) / 0.65)' }}>Resuma em três blocos. Isso vira o plano de ação.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[['Pontos fortes', 'O que já funciona e vamos manter.'], ['O que melhorar', 'O que está travando o resultado hoje.'], ['Oportunidades', 'O que ninguém do nicho está fazendo e a gente pode fazer.']].map(([t, d]) => (
              <div key={t} className="rounded-[22px] p-5" style={{ background: 'hsl(var(--c-light) / 0.06)', boxShadow: 'inset 0 0 0 1px hsl(var(--c-light) / 0.08)' }}>
                <p className="font-display text-lg font-semibold" style={{ color: C.lime }}>{t}</p>
                <p className="mt-1 text-sm" style={{ color: 'hsl(var(--c-light) / 0.7)' }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </div>
  );
}

const NEXT_KEY = 'inova-cultura:proximos';

/** Próximos passos: publicação no Meta, email do briefing e o diagnóstico */
function NextSteps() {
  const [state, setState] = useState<{ meta?: 'sei' | 'ajuda'; email?: string }>(() => {
    try { return JSON.parse(localStorage.getItem(NEXT_KEY) || '{}'); } catch { return {}; }
  });
  const [copied, setCopied] = useState(false);
  const save = (n: typeof state) => { setState(n); try { localStorage.setItem(NEXT_KEY, JSON.stringify(n)); } catch { /* armazenamento indisponível */ } };
  const email = state.email ?? '';
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const message = `Oi! Sou novo(a) no time da INOVA. Meu email para liberar o acesso ao briefing dos clientes é: ${email.trim()}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* sem permissão */ }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Meta */}
      <Reveal>
        <div className="cx-card flex h-full flex-col rounded-[32px] p-7">
          <span className="font-display text-sm font-semibold" style={{ color: C.muted }}>01</span>
          <h3 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-[-0.035em]">Você sabe publicar pelo Meta Business Suite?</h3>
          <p className="mt-2 text-sm" style={{ color: C.muted }}>É por lá que agendamos posts, Reels e stories dos clientes.</p>
          <div className="mt-6 flex gap-2">
            {([['sei', 'Sei sim'], ['ajuda', 'Preciso de ajuda']] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => save({ ...state, meta: v })} aria-pressed={state.meta === v}
                className="flex-1 rounded-full px-4 py-3 text-sm font-semibold transition-all"
                style={state.meta === v ? { background: C.ink, color: C.light } : { background: 'hsl(var(--c-ink) / 0.05)', color: C.ink }}>{l}</button>
            ))}
          </div>
          {state.meta && (
            <p className="cx-swap mt-5 rounded-2xl p-4 text-sm" style={{ background: state.meta === 'sei' ? 'hsl(var(--c-lime) / 0.35)' : 'hsl(var(--c-ink) / 0.05)' }}>
              {state.meta === 'sei'
                ? 'Boa! Na primeira semana você já agenda um post com o social media do lado, só para alinhar o nosso jeito.'
                : 'Tranquilo, a gente te ensina! Avise o head no primeiro dia e marcamos um passo a passo juntos: conectar a conta, agendar post, Reels e story.'}
            </p>
          )}
        </div>
      </Reveal>

      {/* Email */}
      <Reveal delay={100}>
        <div className="cx-card flex h-full flex-col rounded-[32px] p-7">
          <span className="font-display text-sm font-semibold" style={{ color: C.muted }}>02</span>
          <h3 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-[-0.035em]">Precisamos do seu email</h3>
          <p className="mt-2 text-sm" style={{ color: C.muted }}>É com ele que liberamos o seu acesso ao briefing dos clientes. Sem isso, você não consegue fazer o diagnóstico.</p>
          <input type="email" value={email} onChange={(e) => save({ ...state, email: e.target.value })} placeholder="seu@email.com" aria-label="Seu email"
            className="mt-6 w-full rounded-full border bg-transparent px-5 text-sm outline-none focus:ring-2"
            style={{ height: 48, borderColor: 'hsl(var(--c-ink) / 0.15)', ['--tw-ring-color' as string]: 'hsl(var(--c-lime))' }} />
          <button type="button" disabled={!validEmail} onClick={copy}
            className="mt-2 rounded-full px-4 py-3 text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: C.ink, color: C.light }}>{copied ? 'Copiado! Agora é só colar no WhatsApp' : 'Copiar mensagem para o head'}</button>
          <p className="mt-3 text-xs" style={{ color: C.muted }}>Copie e mande para o head no WhatsApp.</p>
        </div>
      </Reveal>

      {/* Diagnóstico */}
      <Reveal delay={200}>
        <div className="relative flex h-full flex-col overflow-hidden rounded-[32px] p-7" style={{ background: C.lime, color: C.ink }}>
          <span className="font-display text-sm font-semibold opacity-60">03</span>
          <h3 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-[-0.035em]">Aprender o nosso diagnóstico</h3>
          <p className="mt-2 text-sm opacity-75">É a primeira coisa que fazemos com todo cliente novo. Releia o guia e faça o seu primeiro junto com o head.</p>
          <a href="#diagnostico" className="mt-auto inline-flex w-fit items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5" style={{ background: C.ink, color: C.light, marginTop: 24 }}>
            Ver o guia <ArrowUp className="h-4 w-4" />
          </a>
          <Tile className="cx-float absolute -bottom-4 -right-4 aspect-square w-24">
            <Target className="absolute inset-[26%] h-[48%] w-[48%]" style={{ color: C.ink }} />
          </Tile>
        </div>
      </Reveal>
    </div>
  );
}

const Eyebrow = ({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) => (
  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
    style={dark ? { background: 'hsl(var(--c-light) / 0.08)', color: C.lime } : { background: C.card, color: C.ink, boxShadow: 'inset 0 0 0 1px hsl(var(--c-ink) / 0.08)' }}>
    <span className="h-1.5 w-1.5 rounded-full" style={{ background: dark ? C.lime : C.ink }} />{children}
  </span>
);

/* ───────────── Página ───────────── */

export default function CulturePage() {
  useSeo({ title: 'Bem-vindo à INOVA — Resultado. Prazo. Estratégia.', description: 'O onboarding de quem entra no time da INOVA: nossa cultura, nossos pilares e a sua primeira semana.', noindex: true });
  const rootRef = useRef<HTMLDivElement>(null);

  // Rolagem em --sy para o parallax das peças de vidro
  useEffect(() => {
    let raf = 0;
    const on = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; rootRef.current?.style.setProperty('--sy', String(window.scrollY)); }); };
    window.addEventListener('scroll', on, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', on); };
  }, []);

  return (
    <div ref={rootRef} className="cx min-h-screen overflow-x-clip font-sans">
      <style>{CSS}</style>

      {/* ── Navegação ── */}
      <header className="fixed inset-x-0 top-3 z-40 px-3 sm:top-5 sm:px-6">
        <div className="cx-nav mx-auto flex max-w-[1240px] items-center justify-between rounded-full py-2 pl-5 pr-2">
          <img src={logoInova} alt="INOVA" className="cx-logo h-5" />
          <nav className="hidden gap-7 text-[13px] font-medium md:flex" style={{ color: 'hsl(var(--c-ink) / 0.7)' }}>
            <a href="#pilares" className="transition-colors hover:text-[hsl(var(--c-ink))]">Pilares</a>
            <a href="#processo" className="transition-colors hover:text-[hsl(var(--c-ink))]">Processo</a>
            <a href="#diagnostico" className="transition-colors hover:text-[hsl(var(--c-ink))]">Diagnóstico</a>
            <a href="#proximos" className="transition-colors hover:text-[hsl(var(--c-ink))]">Próximos passos</a>
          </nav>
          <a href="#semana" className="rounded-full px-4 py-2.5 text-[13px] font-semibold transition-transform hover:-translate-y-0.5" style={{ background: C.ink, color: C.light }}>
            Começar onboarding
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="cx-hero relative overflow-hidden px-4 pb-16 pt-32 sm:px-8 sm:pt-40">
        <div className="mx-auto grid max-w-[1240px] items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <div className="cx-in" style={{ animationDelay: '100ms' }}><Eyebrow>Onboarding · Bem-vindo ao time</Eyebrow></div>
            <h1 className="mt-6 font-display text-[clamp(2.8rem,6.4vw,5.6rem)] font-semibold leading-[0.98] tracking-[-0.05em]">
              {['Conteúdo que', 'vira resultado.'].map((l, i) => (
                <span key={l} className="block overflow-hidden pb-[0.06em]">
                  <span className="cx-line block" style={{ animationDelay: `${200 + i * 120}ms` }}>
                    {i === 1 ? <>vira <span className="cx-mark">resultado.</span></> : l}
                  </span>
                </span>
              ))}
            </h1>
            <p className="cx-in mt-6 max-w-md text-base leading-relaxed sm:text-lg" style={{ color: C.muted, animationDelay: '500ms' }}>
              A INOVA é uma produtora focada em estratégia de conteúdo. Antes do primeiro card, vem entender como a gente joga.
            </p>
            <div className="cx-in mt-8 flex flex-wrap gap-3" style={{ animationDelay: '650ms' }}>
              <a href="#pilares" className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-transform hover:-translate-y-0.5" style={{ background: C.ink, color: C.light }}>
                Conhecer a cultura <ArrowDown className="h-4 w-4" />
              </a>
              <a href="#semana" className="cx-card inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-transform hover:-translate-y-0.5">
                Minha primeira semana
              </a>
            </div>
          </div>
          <div className="cx-in" style={{ animationDelay: '300ms' }}><GlassScene /></div>
        </div>

        {/* Faixa escura com os números da casa */}
        <Reveal className="mx-auto mt-10 max-w-[1240px]">
          <div className="cx-darkcard grid gap-6 rounded-[32px] p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-4">
            {[['3', 'pilares que guiam tudo'], ['7', 'etapas de cada conteúdo'], ['5', 'dias de onboarding'], ['1', 'time, do roteiro ao post']].map(([n, t]) => (
              <div key={t} className="flex items-center gap-4">
                <span className="font-display text-5xl font-semibold tracking-[-0.06em]" style={{ color: C.lime }}>{n}</span>
                <span className="max-w-[9rem] text-sm leading-snug" style={{ color: 'hsl(var(--c-light) / 0.7)' }}>{t}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Palavras gigantes ── */}
      <BigWords />

      {/* ── Manifesto (corte rasgado) ── */}
      <Torn color={C.dark} />
      <section className="px-4 py-28 sm:px-8 sm:py-36" style={{ background: C.dark }}>
        <div className="mx-auto max-w-[1100px]">
          <Eyebrow dark>Manifesto</Eyebrow>
          <div className="mt-8"><Manifesto /></div>
        </div>
      </section>
      <Torn color={C.dark} flip />

      {/* ── Pilares em bento ── */}
      <section id="pilares" className="mx-auto max-w-[1240px] scroll-mt-24 px-4 py-28 sm:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow>Nossos pilares</Eyebrow>
            <MaskTitle className="mt-5 text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.98]" lines={['Os três que', 'guiam tudo aqui.']} />
          </div>
          <p className="max-w-sm text-sm leading-relaxed" style={{ color: C.muted }}>Toda decisão, de um corte de vídeo a uma legenda, passa por essas três perguntas.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-6">
          {/* Resultado: card escuro grande com barras de vidro */}
          <Reveal className="lg:col-span-4">
            <article className="cx-darkcard relative h-full min-h-[420px] overflow-hidden rounded-[32px] p-7 sm:p-9">
              <div className="relative z-10 max-w-sm">
                <span className="text-xs font-semibold tabular-nums" style={{ color: C.lime }}>{PILLARS[0].n}</span>
                <h3 className="mt-3 font-display text-[clamp(2.4rem,4.5vw,3.8rem)] font-semibold leading-none tracking-[-0.05em]">{PILLARS[0].name}</h3>
                <p className="mt-4 font-display text-lg font-medium">{PILLARS[0].line}</p>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: 'hsl(var(--c-light) / 0.65)' }}>{PILLARS[0].body}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {PILLARS[0].practice.map((x) => <span key={x} className="rounded-full px-3 py-1.5 text-xs" style={{ background: 'hsl(var(--c-light) / 0.08)' }}>{x}</span>)}
                </div>
              </div>
              <div aria-hidden className="absolute -bottom-6 right-0 hidden h-[78%] w-[42%] items-end justify-center gap-[6%] md:flex">
                {[38, 58, 82].map((h) => <div key={h} className="cx-bar cx-bar-dark w-[22%]" style={{ height: `${h}%` }} />)}
              </div>
            </article>
          </Reveal>

          {/* Prazo: card claro com anel */}
          <Reveal className="lg:col-span-2" delay={100}>
            <article className="cx-card relative h-full min-h-[420px] overflow-hidden rounded-[32px] p-7">
              <div aria-hidden className="cx-ring mx-auto mb-6 aspect-square w-[46%]" />
              <span className="text-xs font-semibold tabular-nums" style={{ color: C.muted }}>{PILLARS[1].n}</span>
              <h3 className="mt-2 font-display text-[2.6rem] font-semibold leading-none tracking-[-0.05em]">{PILLARS[1].name}</h3>
              <p className="mt-3 font-display text-base font-medium">{PILLARS[1].line}</p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: C.muted }}>{PILLARS[1].body}</p>
            </article>
          </Reveal>

          {/* Estratégia: card claro com rede de pontos */}
          <Reveal className="lg:col-span-3" delay={50}>
            <article className="cx-card relative h-full overflow-hidden rounded-[32px] p-7 sm:p-9">
              <svg aria-hidden viewBox="0 0 200 120" className="absolute -right-4 -top-2 w-[48%] opacity-90" fill="none">
                {[[20, 90, 70, 40], [70, 40, 130, 70], [130, 70, 180, 20], [70, 40, 110, 10], [130, 70, 160, 110]].map(([a, b, c, d], i) => (
                  <line key={i} x1={a} y1={b} x2={c} y2={d} stroke="hsl(var(--c-ink) / 0.18)" strokeWidth="1.5" />
                ))}
                {[[20, 90, 5], [70, 40, 7], [130, 70, 9], [180, 20, 6], [110, 10, 4], [160, 110, 5]].map(([x, y, r], i) => (
                  <circle key={i} cx={x} cy={y} r={r} fill={i === 2 ? 'hsl(var(--c-lime))' : 'hsl(var(--c-ink))'} className="cx-node" style={{ animationDelay: `${i * 0.3}s` }} />
                ))}
              </svg>
              <span className="text-xs font-semibold tabular-nums" style={{ color: C.muted }}>{PILLARS[2].n}</span>
              <h3 className="mt-2 font-display text-[2.6rem] font-semibold leading-none tracking-[-0.05em]">{PILLARS[2].name}</h3>
              <p className="mt-3 max-w-md font-display text-base font-medium">{PILLARS[2].line}</p>
              <p className="mt-2 max-w-md text-sm leading-relaxed" style={{ color: C.muted }}>{PILLARS[2].body}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {PILLARS[2].practice.map((x) => <span key={x} className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: 'hsl(var(--c-ink) / 0.05)' }}>{x}</span>)}
              </div>
            </article>
          </Reveal>

          {/* A pergunta: card lima */}
          <Reveal className="lg:col-span-3" delay={150}>
            <article className="relative flex h-full min-h-[260px] flex-col justify-between overflow-hidden rounded-[32px] p-7 sm:p-9" style={{ background: C.lime, color: C.ink }}>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">A pergunta que a gente sempre faz</p>
              <p className="font-display text-[clamp(3rem,7vw,5.5rem)] font-semibold leading-[0.9] tracking-[-0.06em]">Funcionou?</p>
              <Tile className="cx-float absolute right-6 top-6 aspect-square w-20 sm:w-24">
                <Check className="absolute inset-[26%] h-[48%] w-[48%]" strokeWidth={3} style={{ color: C.ink }} />
              </Tile>
            </article>
          </Reveal>
        </div>
      </section>

      {/* ── A gente se grava ── */}
      <section id="gravacao" className="mx-auto max-w-[1240px] scroll-mt-24 px-4 pb-28 sm:px-8">
        <div className="grid gap-4 lg:grid-cols-5">
          <Reveal className="lg:col-span-3">
            <div className="cx-card h-full rounded-[32px] p-7 sm:p-10">
              <Eyebrow>A gente vive de conteúdo</Eyebrow>
              <MaskTitle className="mt-6 text-[clamp(2.6rem,5.6vw,5rem)] leading-[0.95]" lines={['A gente se grava.', <span key="m" className="cx-mark">Muito.</span>]} />
              <p className="mt-6 max-w-xl text-base leading-relaxed" style={{ color: C.muted }}>
                Somos uma produtora, então câmera ligada é parte do nosso dia: bastidores, trends, reunião que vira vídeo, ideia que vira cena. Ninguém é obrigado a aparecer, mas não se assuste se, vira e mexe, você estiver no vídeo. A gente adora quando o time topa entrar na brincadeira.
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
                {['Ir numa captação só pra ver como é', 'Dar pitaco no roteiro', 'Fazer uma ponta num vídeo da INOVA', 'Gravar um bastidor do seu dia', 'Sugerir uma trend pro time'].map((t) => (
                  <span key={t} className="rounded-full px-4 py-2 text-sm" style={{ background: 'hsl(var(--c-ink) / 0.05)' }}>{t}</span>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal className="lg:col-span-2" delay={120}>
            <div className="relative h-full min-h-[440px]">
              {/* Círculos recortados, como no vídeo de referência */}
              <div className="absolute right-0 top-0 aspect-square w-[78%] overflow-hidden rounded-full" style={{ background: C.dark }}>
                <img src={escritorioAsset.url} alt="Escritório da INOVA" className="h-full w-full object-cover" loading="lazy" />
                <span className="absolute left-1/2 top-[14%] flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px]" style={{ background: 'hsl(var(--c-ink) / 0.6)', color: C.light }}>
                  <span className="cx-rec h-2 w-2 rounded-full" style={{ background: 'hsl(var(--c-rec))' }} /> REC <Timecode />
                </span>
              </div>
              <div className="cx-float absolute bottom-0 left-0 flex aspect-square w-[52%] items-center justify-center rounded-full p-6 text-center" style={{ background: C.lime, color: C.ink, animationDelay: '-3s' }}>
                <p className="font-display text-lg font-semibold leading-tight tracking-[-0.03em] sm:text-xl">Spoiler: você vai aparecer no story.</p>
              </div>
              <Tile dark className="cx-float absolute bottom-[16%] right-[6%] aspect-square w-[22%]">
                <span className="absolute left-1/2 top-1/2 h-0 w-0 -translate-x-[35%] -translate-y-1/2" style={{ borderLeft: '16px solid hsl(var(--c-lime))', borderTop: '10px solid transparent', borderBottom: '10px solid transparent' }} />
              </Tile>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Liberdade x Responsabilidade ── */}
      <section className="mx-auto max-w-[1240px] px-4 pb-28 sm:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow>Como a gente joga</Eyebrow>
            <MaskTitle className="mt-5 text-[clamp(2.2rem,4.8vw,4rem)] leading-[0.98]" lines={['Liberdade para criar.', 'Carinho com o que entrega.']} />
          </div>
          <p className="text-sm" style={{ color: C.muted }}>Arraste e veja os dois lados da INOVA.</p>
        </div>
        <Reveal><Balance /></Reveal>
        <p className="mt-6 text-center font-display text-lg font-medium sm:text-2xl">Não é um ou outro. Na INOVA, é os dois, o tempo todo.</p>
      </section>

      {/* ── Fluxo ── */}
      <section className="mx-auto max-w-[1240px] px-4 pb-28 sm:px-8">
        <Reveal>
          <div className="cx-card rounded-[32px] p-7 sm:p-10">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <Eyebrow>Da ideia ao feed</Eyebrow>
                <h2 className="mt-5 font-display text-[clamp(2rem,4vw,3.2rem)] font-semibold leading-none tracking-[-0.045em]">Todo conteúdo passa por aqui.</h2>
              </div>
              <p className="max-w-sm text-sm leading-relaxed" style={{ color: C.muted }}>Cada etapa vive como um card na plataforma, com responsável e data. Se o card anda, o cliente cresce.</p>
            </div>
            <Flow />
          </div>
        </Reveal>
      </section>

      {/* ── Processo ── */}
      <section id="processo" className="mx-auto max-w-[1240px] scroll-mt-24 px-4 pb-28 sm:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow>Nosso processo</Eyebrow>
            <MaskTitle className="mt-5 text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.98]" lines={['Cliente entrou.', 'E agora?']} />
          </div>
          <p className="max-w-sm text-sm leading-relaxed" style={{ color: C.muted }}>Todo cliente novo passa por essas cinco etapas, nessa ordem. Clique em cada uma para entender o porquê.</p>
        </div>
        <Reveal><Process /></Reveal>
      </section>

      {/* ── Diagnóstico ── */}
      <section id="diagnostico" className="mx-auto max-w-[1240px] scroll-mt-24 px-4 pb-28 sm:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow>Mão na massa</Eyebrow>
            <MaskTitle className="mt-5 text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.98]" lines={['Como fazer o', <span key="d" className="cx-mark">nosso diagnóstico.</span>]} />
          </div>
          <p className="max-w-sm text-sm leading-relaxed" style={{ color: C.muted }}>O diagnóstico é a base de tudo: dele sai o plano de ação, a organização do perfil e o roteiro da captação.</p>
        </div>
        <DiagnosticGuide />
      </section>

      {/* ── Regras da casa ── */}
      <Torn color={C.dark} />
      <section id="regras" className="scroll-mt-16 px-4 py-28 sm:px-8" style={{ background: C.dark, color: C.light }}>
        <div className="mx-auto max-w-[1240px]">
          <div className="mb-10">
            <Eyebrow dark>Regras da casa</Eyebrow>
            <MaskTitle className="mt-5 text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.98]" lines={['O jeito INOVA', 'de trabalhar junto.']} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {RULES.map((r, i) => (
              <Reveal key={r.k} delay={i * 60}>
                <div className="cx-rule group h-full rounded-[26px] p-6">
                  <span className="cx-rule-n flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <p className="mt-8 font-display text-2xl font-semibold leading-tight tracking-[-0.035em]">{r.k}</p>
                  <p className="cx-rule-v mt-2 text-sm">{r.v}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <Torn color={C.dark} flip />

      {/* ── Primeira semana ── */}
      <section id="semana" className="mx-auto max-w-[1240px] scroll-mt-24 px-4 py-28 sm:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow>Sua primeira semana</Eyebrow>
            <MaskTitle className="mt-5 text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.98]" lines={['Cinco dias para', 'virar INOVA.']} />
          </div>
          <p className="text-sm" style={{ color: C.muted }}>Vai marcando conforme acontece. Fica salvo neste aparelho.</p>
        </div>
        <Week />
      </section>

      {/* ── Próximos passos ── */}
      <section id="proximos" className="mx-auto max-w-[1240px] scroll-mt-24 px-4 pb-28 sm:px-8">
        <div className="mb-10">
          <Eyebrow>Próximos passos</Eyebrow>
          <MaskTitle className="mt-5 text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.98]" lines={['Antes do', 'primeiro card.']} />
        </div>
        <NextSteps />
      </section>

      {/* ── Fechamento ── */}
      <section className="px-4 pb-6 sm:px-8">
        <Reveal className="mx-auto max-w-[1240px]">
          <div className="relative overflow-hidden rounded-[40px] px-7 py-16 sm:px-14 sm:py-24" style={{ background: C.lime, color: C.ink }}>
            <div className="relative z-10 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">Agora é com você</p>
              <h2 className="mt-4 font-display text-[clamp(3rem,9vw,7.5rem)] font-semibold leading-[0.88] tracking-[-0.06em]">Bem-vindo<br />ao time.</h2>
              <p className="mt-6 max-w-md text-base font-medium opacity-75">Que bom ter você aqui. Traz suas ideias, chama o time quando precisar e bora fazer conteúdo que dá resultado.</p>
              <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-transform hover:-translate-y-0.5"
                style={{ background: C.ink, color: C.light }}>
                Voltar ao começo <ArrowUp className="h-4 w-4" />
              </button>
            </div>
            <div aria-hidden className="absolute -right-2 bottom-0 top-0 hidden w-[32%] lg:block">
              <Tile className="cx-float absolute right-[30%] top-[14%] aspect-square w-[34%]" style={{ rotate: '-12deg' }}>
                <span className="absolute left-[22%] top-[24%] h-[30%] w-[44%] rounded-[30%]" style={{ background: C.ink }} />
                <span className="absolute bottom-[22%] right-[20%] h-[30%] w-[30%] rounded-full" style={{ background: 'hsl(var(--c-light))' }} />
              </Tile>
              <Tile dark className="cx-float absolute bottom-[14%] right-[12%] aspect-square w-[30%]" style={{ rotate: '10deg', animationDelay: '-2s' }}>
                <span className="absolute left-1/2 top-1/2 h-0 w-0 -translate-x-[35%] -translate-y-1/2" style={{ borderLeft: '24px solid hsl(var(--c-lime))', borderTop: '15px solid transparent', borderBottom: '15px solid transparent' }} />
              </Tile>
              <div className="cx-bubble cx-float absolute bottom-[38%] right-[52%] aspect-square w-[12%]" style={{ animationDelay: '-3s' }} />
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="mx-auto flex max-w-[1240px] flex-col items-center justify-between gap-3 px-4 py-8 text-xs sm:flex-row sm:px-8" style={{ color: C.muted }}>
        <img src={logoInova} alt="INOVA" className="cx-logo h-5" />
        <p>Resultado · Prazo · Estratégia</p>
        <p>INOVA Produtora · Feito pelo time, para o time.</p>
      </footer>
    </div>
  );
}

const CSS = `
.cx {
  --c-bg: 90 14% 95%;
  --c-card: 0 0% 100%;
  --c-ink: 150 10% 8%;
  --c-muted: 150 5% 38%;
  --c-dark: 150 8% 8%;
  --c-light: 90 20% 97%;
  --c-lime: 75 90% 57%;
  --c-rec: 0 84% 58%;
  --sy: 0;
  background: hsl(var(--c-bg));
  color: hsl(var(--c-ink));
}
.cx ::selection { background: hsl(var(--c-lime)); color: hsl(var(--c-ink)); }
.cx-logo { filter: brightness(0) saturate(100%); opacity: .9; }
.cx-hero { background:
  radial-gradient(60% 50% at 78% 38%, hsl(var(--c-lime) / .28), transparent 70%),
  radial-gradient(40% 40% at 10% 0%, hsl(var(--c-card)), transparent 70%); }
.cx-nav { background: hsl(var(--c-card) / .7); backdrop-filter: blur(18px) saturate(160%); -webkit-backdrop-filter: blur(18px) saturate(160%); box-shadow: inset 0 0 0 1px hsl(var(--c-card) / .9), 0 10px 40px -18px hsl(var(--c-ink) / .25); }
.cx-card { background: hsl(var(--c-card)); color: hsl(var(--c-ink)); box-shadow: inset 0 0 0 1px hsl(var(--c-ink) / .06), 0 24px 50px -32px hsl(var(--c-ink) / .25); }
.cx-darkcard { background: radial-gradient(80% 120% at 100% 100%, hsl(var(--c-lime) / .14), transparent 60%), hsl(var(--c-dark)); color: hsl(var(--c-light)); box-shadow: 0 40px 80px -40px hsl(var(--c-ink) / .6); }
.cx-mark { background: linear-gradient(transparent 58%, hsl(var(--c-lime)) 58%, hsl(var(--c-lime)) 92%, transparent 92%); padding: 0 .06em; }

/* Vidro */
.cx-tile { border-radius: 28%; background: linear-gradient(145deg, hsl(var(--c-card) / .85), hsl(var(--c-card) / .2)); border: 1px solid hsl(var(--c-card) / .9);
  box-shadow: inset 0 2px 1px hsl(var(--c-card)), inset 0 -14px 28px hsl(var(--c-ink) / .07), 0 40px 60px -26px hsl(var(--c-ink) / .4);
  backdrop-filter: blur(14px) saturate(150%); -webkit-backdrop-filter: blur(14px) saturate(150%); }
.cx-tile-dark { background: linear-gradient(145deg, hsl(150 8% 22%), hsl(150 10% 5%)); border-color: hsl(var(--c-light) / .14);
  box-shadow: inset 0 2px 1px hsl(var(--c-light) / .22), inset 0 -14px 28px hsl(var(--c-ink) / .5), 0 40px 60px -24px hsl(var(--c-ink) / .55); }
.cx-bubble { border-radius: 50%; background: radial-gradient(circle at 32% 28%, hsl(var(--c-card)) 0, hsl(var(--c-card) / .6) 18%, hsl(var(--c-lime) / .3) 52%, hsl(var(--c-ink) / .12) 78%);
  box-shadow: inset -6px -8px 18px hsl(var(--c-ink) / .12), 0 20px 30px -16px hsl(var(--c-ink) / .35); }
.cx-dish { border-radius: 50%; background: radial-gradient(ellipse at 50% 40%, hsl(var(--c-card) / .25), hsl(var(--c-card) / .85) 70%); border: 1px solid hsl(var(--c-card));
  box-shadow: inset 0 -10px 20px hsl(var(--c-ink) / .08), 0 40px 50px -24px hsl(var(--c-ink) / .4); }
.cx-bar { position: relative; border-radius: 50% / 22px; transform-origin: bottom;
  background: linear-gradient(90deg, hsl(var(--c-card) / .85), hsl(var(--c-lime) / .55) 35%, hsl(var(--c-lime) / .25) 65%, hsl(var(--c-card) / .7));
  border: 1px solid hsl(var(--c-card) / .9); box-shadow: inset 0 -12px 24px hsl(var(--c-lime) / .3), 0 30px 40px -24px hsl(var(--c-ink) / .4);
  animation: cxGrow 1.4s cubic-bezier(.2,.8,.2,1) both; }
.cx-bar::before { content: ''; position: absolute; left: -1px; right: -1px; top: -1px; height: 44px; border-radius: 50%; background: linear-gradient(180deg, hsl(var(--c-card) / .95), hsl(var(--c-lime) / .35)); border: 1px solid hsl(var(--c-card)); }
.cx-bar-dark { background: linear-gradient(90deg, hsl(var(--c-light) / .22), hsl(var(--c-lime) / .5) 35%, hsl(var(--c-lime) / .18) 65%, hsl(var(--c-light) / .15)); border-color: hsl(var(--c-light) / .25); }
.cx-bar-dark::before { background: linear-gradient(180deg, hsl(var(--c-light) / .5), hsl(var(--c-lime) / .4)); border-color: hsl(var(--c-light) / .3); }
@keyframes cxGrow { from { transform: scaleY(.15); opacity: 0; } to { transform: none; opacity: 1; } }
.cx-glow { background: radial-gradient(circle, hsl(var(--c-lime) / .45), transparent 65%); filter: blur(30px); }
.cx-ring { border-radius: 50%; background: conic-gradient(from -90deg, hsl(var(--c-lime)) 0 72%, hsl(var(--c-ink) / .07) 72% 100%);
  -webkit-mask: radial-gradient(circle, transparent 54%, #000 55%); mask: radial-gradient(circle, transparent 54%, #000 55%); animation: cxSpin 12s linear infinite; }
@keyframes cxSpin { to { transform: rotate(360deg); } }
.cx-node { transform-box: fill-box; transform-origin: center; animation: cxNode 2.4s ease-in-out infinite; }
@keyframes cxNode { 50% { transform: scale(1.35); } }

/* Movimento */
.cx-par { transform: translateY(calc(var(--sy) * var(--f) * 1px)) rotate(calc(var(--r) * 1deg + var(--sy) * var(--f) * -0.04deg)); will-change: transform; }
.cx-float { animation: cxFloat 7s ease-in-out infinite; }
@keyframes cxFloat { 50% { translate: 0 -14px; } }
.cx-row { will-change: transform; }
.cx-in { opacity: 0; animation: cxIn 1s cubic-bezier(.2,.8,.2,1) forwards; }
@keyframes cxIn { from { opacity: 0; transform: translateY(30px) scale(.98); filter: blur(10px); } to { opacity: 1; transform: none; filter: none; } }
.cx-line { transform: translateY(110%); animation: cxLine 1s cubic-bezier(.2,.8,.2,1) forwards; }
@keyframes cxLine { to { transform: none; } }
.cx-mask > span > span { transform: translateY(110%); transition: transform 1s cubic-bezier(.2,.8,.2,1); }
.cx-mask.is-in > span > span { transform: none; }
.cx-reveal { opacity: 0; transform: translateY(50px) scale(.97); transition: opacity .9s ease, transform 1s cubic-bezier(.2,.8,.2,1); }
.cx-reveal.is-in { opacity: 1; transform: none; }
.cx-swap { animation: cxIn .6s cubic-bezier(.2,.8,.2,1) both; }
.cx-rec { animation: cxBlink 1.1s steps(2, start) infinite; }
@keyframes cxBlink { to { visibility: hidden; } }

/* Regras */
.cx-rule { background: hsl(var(--c-light) / .05); box-shadow: inset 0 0 0 1px hsl(var(--c-light) / .08); transition: background .35s ease, transform .35s ease, color .35s ease; }
.cx-rule-n { background: hsl(var(--c-light) / .08); color: hsl(var(--c-lime)); transition: background .35s, color .35s; }
.cx-rule-v { color: hsl(var(--c-light) / .6); transition: color .35s; }
.cx-rule:hover { background: hsl(var(--c-lime)); color: hsl(var(--c-ink)); transform: translateY(-4px); }
.cx-rule:hover .cx-rule-n { background: hsl(var(--c-ink)); color: hsl(var(--c-lime)); }
.cx-rule:hover .cx-rule-v { color: hsl(var(--c-ink) / .7); }

@media (prefers-reduced-motion: reduce) {
  .cx *, .cx *::before { animation: none !important; transition: none !important; }
  .cx-reveal, .cx-in { opacity: 1; transform: none; filter: none; }
  .cx-line, .cx-mask > span > span { transform: none; }
  .cx-par { transform: none; }
}
`;
