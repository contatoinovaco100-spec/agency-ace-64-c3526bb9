import { useState, useEffect, useRef, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, useInView, AnimatePresence, animate } from 'framer-motion';
import {
  Play, X, Instagram, Film, MessageCircle, ExternalLink as ExternalLinkIcon,
  BarChart3, TrendingUp, ArrowUpRight, Camera, Megaphone, Clapperboard, Wand2, MapPin, Navigation,
  Plus, Star, Target, Check, Send, Sparkles, MousePointer2,
} from 'lucide-react';
import logoInova from '@/assets/logo-inova.png';
import escritorioAsset from '@/assets/escritorio-inova-recepcao.jpg.asset.json';
import { InstagramEmbed } from '@/components/InstagramEmbed';
import { useSeo } from '@/lib/seo';

/*
 * Vitrine pública: página de marca, com paleta própria (céu azul + lime da INOVA) em vez dos
 * tokens do painel. Céu e nuvens no topo, cards 3D que giram (arrastáveis), números animados,
 * serviços com troca automática e um montador de orçamento que já abre o WhatsApp com a mensagem.
 */

interface Project {
  id: string; title: string; description: string; video_url: string;
  thumbnail_url: string; category: string; completed_at: string | null;
}

interface IGPost {
  id: string;
  post_url: string;
  strategic_description: string;
  post_result: string;
}

const LIME = '#bff720';
const SKY = 'linear-gradient(180deg, #0a63de 0%, #2f8bff 38%, #7dbdff 70%, #d9edff 100%)';

const CATEGORIES_LABELS: Record<string, string> = {
  'Institucional': 'Institucional', 'Publicitário': 'Publicitário',
  'Social Media': 'Social Media', 'Documentário': 'Documentário',
  'Evento': 'Evento', 'Motion Graphics': 'Motion', 'Outro': 'Outro',
};

const SERVICES = [
  {
    icon: Clapperboard, title: 'Produção Audiovisual',
    desc: 'Vídeos institucionais, comerciais e documentários com qualidade cinematográfica.',
    items: ['Vídeo institucional', 'Comercial para anúncio', 'Cobertura de evento', 'Documentário de marca'],
  },
  {
    icon: Megaphone, title: 'Social Media Estratégico',
    desc: 'Conteúdo para redes sociais que gera engajamento e converte.',
    items: ['Planejamento mensal', 'Reels e carrosséis', 'Calendário de postagens', 'Relatório de resultados'],
  },
  {
    icon: Target, title: 'Tráfego Pago',
    desc: 'Anúncios no Instagram, Facebook e Google para levar clientes até a sua porta.',
    items: ['Campanhas de vendas', 'Público da sua região', 'Criativos em vídeo', 'Acompanhamento semanal'],
  },
  {
    icon: Camera, title: 'Direção & Roteiro',
    desc: 'Storytelling refinado, da concepção criativa à entrega final.',
    items: ['Roteiro estratégico', 'Direção de cena', 'Estúdio próprio', 'Agenda de captação'],
  },
  {
    icon: Wand2, title: 'Edição & Motion',
    desc: 'Pós-produção, color grading e motion graphics com identidade própria.',
    items: ['Edição dinâmica', 'Color grading', 'Legendas e motion', 'Vinhetas da marca'],
  },
];

const BUILDER = {
  services: ['Vídeo institucional', 'Social media mensal', 'Tráfego pago', 'Edição de vídeos', 'Fotografia', 'Gravar no estúdio'],
  goals: ['Vender mais', 'Ser mais lembrado', 'Lançar um produto', 'Atrair clientes da região'],
  when: ['Este mês', 'Próximos 3 meses', 'Só pesquisando'],
};

function getVideoEmbed(url: string) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1`;
  return null;
}

/** Capa do YouTube: "hq" (480px, ~20 KB) serve nos cards pequenos; "maxres" (1280px, ~70 KB) só em tela grande */
function getVideoThumb(url: string, size: 'hq' | 'maxres' = 'maxres') {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/${size === 'hq' ? 'hqdefault' : 'maxresdefault'}.jpg`;
  return null;
}

/** Link do botão de orçamento com a mensagem já escrita (quando é um link do WhatsApp) */
function withMessage(url: string, text: string) {
  if (!/whatsapp|wa\.me/i.test(url)) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('text', text);
    return u.toString();
  } catch { return url; }
}

// Dispara a conversão do pixel do ChatGPT ao clicar no botão de orçamento
const trackBudgetClick = (location: string) => {
  try {
    (window as any).oaiq?.('measure', 'registration_completed', {
      type: 'customer_action',
      event_source: 'vitrine',
      location,
    });
  } catch { /* noop */ }
};

/* ───────────────────────── peças visuais ───────────────────────── */

/** Nuvens feitas de bolhas brancas desfocadas que flutuam devagar */
function Clouds({ dense = true }: { dense?: boolean }) {
  const puffs = [
    { l: '-8%', b: '-14%', w: '42%', h: '46%', o: 1, dx: 30, t: 22 },
    { l: '22%', b: '-20%', w: '36%', h: '40%', o: 0.95, dx: -24, t: 26 },
    { l: '50%', b: '-16%', w: '40%', h: '44%', o: 1, dx: 26, t: 24 },
    { l: '78%', b: '-12%', w: '34%', h: '42%', o: 0.95, dx: -30, t: 20 },
    { l: '6%', b: '18%', w: '22%', h: '18%', o: 0.55, dx: 40, t: 30 },
    { l: '70%', b: '22%', w: '24%', h: '16%', o: 0.5, dx: -36, t: 28 },
    { l: '38%', b: '30%', w: '16%', h: '10%', o: 0.35, dx: 30, t: 34 },
  ];
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] overflow-hidden" aria-hidden>
      {(dense ? puffs : puffs.slice(0, 4)).map((p, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: p.l, bottom: p.b, width: p.w, height: p.h, opacity: p.o,
            background: 'radial-gradient(closest-side, #fff 45%, rgba(255,255,255,0.6) 70%, rgba(255,255,255,0) 100%)',
            ['--dx' as string]: `${p.dx}px`,
            animation: `cloud-drift ${p.t / 2}s ease-in-out infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

function Sparkline({ color = '#2f8bff' }: { color?: string }) {
  return (
    <svg viewBox="0 0 120 44" className="w-full h-auto" aria-hidden>
      <defs>
        <linearGradient id={`spark-${color.slice(1)}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 38 L14 33 L26 35 L40 26 L52 29 L66 18 L80 21 L94 10 L108 13 L120 4 L120 44 L0 44 Z" fill={`url(#spark-${color.slice(1)})`} />
      <path d="M0 38 L14 33 L26 35 L40 26 L52 29 L66 18 L80 21 L94 10 L108 13 L120 4" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** Número que conta até o valor quando aparece na tela */
function CountUp({ to, prefix = '', suffix = '' }: { to: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: 1.8, ease: [0.22, 1, 0.36, 1], onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref} className="tabular-nums">{prefix}{v}{suffix}</span>;
}

function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <p className={`font-mono text-[11px] uppercase tracking-[0.22em] ${light ? 'text-white/80' : 'text-[#5b6472]'}`}>
      <span className="mr-2" style={{ color: light ? LIME : '#0a63de' }}>•</span>{children}
    </p>
  );
}

/* ───────────────────────── anel 3D do topo ───────────────────────── */

type RingItem = { key: string; w: number; h: number; node: ReactNode; onOpen?: () => void };

/**
 * Cards num cilindro visto por dentro: giram sozinhos, dá para arrastar com o mouse ou o dedo
 * e clicar num trabalho abre o vídeo. A posição é escrita direto no estilo (sem render por quadro).
 */
function HeroRing({ items }: { items: RingItem[] }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ringRef = useRef<HTMLDivElement>(null);
  const rot = useRef(0);
  const vel = useRef(-0.06);
  const dragging = useRef<{ lastX: number } | null>(null);
  const moved = useRef(0);
  const tilt = useRef({ now: 0, target: 0 });
  const [radius, setRadius] = useState(620);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    // No celular o anel inteiro diminui em vez de apertar os cards
    const fit = () => {
      const w = stageRef.current?.clientWidth ?? 1200;
      setRadius(Math.round(Math.max(460, Math.min(680, w * 0.52))));
      setScale(Math.min(1, Math.max(0.55, w / 860)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    const n = items.length;
    if (!n) return;
    const step = 360 / n;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const tick = () => {
      if (!dragging.current) {
        vel.current += (-0.06 - vel.current) * 0.03; // volta devagar para o giro automático
        if (!reduce) rot.current += vel.current;
      }
      tilt.current.now += (tilt.current.target - tilt.current.now) * 0.06;
      if (ringRef.current) {
        ringRef.current.style.transform = `scale(${scale}) translateZ(${radius * 0.62}px) rotateX(${tilt.current.now}deg)`;
      }
      for (let i = 0; i < n; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        const a = (((i * step + rot.current) % 360) + 540) % 360 - 180;
        const abs = Math.abs(a);
        const vis = abs > 74 ? 0 : abs > 54 ? (74 - abs) / 20 : 1;
        el.style.opacity = String(vis);
        el.style.visibility = vis === 0 ? 'hidden' : 'visible';
        el.style.pointerEvents = vis > 0.6 ? 'auto' : 'none';
        el.style.transform = `translate(-50%, -50%) rotateY(${a}deg) translateZ(${-radius}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [items.length, radius, scale]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (stageRef.current) {
        const r = stageRef.current.getBoundingClientRect();
        tilt.current.target = Math.max(-6, Math.min(6, ((e.clientY - (r.top + r.height / 2)) / r.height) * -8));
      }
      if (!dragging.current) return;
      const dx = e.clientX - dragging.current.lastX;
      dragging.current.lastX = e.clientX;
      moved.current += Math.abs(dx);
      rot.current += dx * 0.14;
      vel.current = dx * 0.14;
    };
    const up = () => { dragging.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  return (
    <div
      ref={stageRef}
      className="relative h-[250px] sm:h-[290px] md:h-[320px] w-full select-none cursor-grab active:cursor-grabbing touch-pan-y"
      style={{ perspective: '1000px' }}
      onPointerDown={(e) => { dragging.current = { lastX: e.clientX }; moved.current = 0; }}
    >
      <div ref={ringRef} className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
        {items.map((it, i) => (
          <div
            key={it.key}
            ref={(el) => { cardRefs.current[i] = el; }}
            className="absolute left-1/2 top-1/2"
            style={{ width: it.w, height: it.h, backfaceVisibility: 'hidden', opacity: 0 }}
            onClick={() => { if (moved.current < 6) it.onOpen?.(); }}
          >
            {it.node}
          </div>
        ))}
      </div>
    </div>
  );
}

const ringCard = 'h-full w-full rounded-[18px] overflow-hidden shadow-[0_18px_40px_-12px_rgba(6,40,110,0.45)] ring-1 ring-white/50';

function RingProject({ project, thumb }: { project: Project; thumb: string }) {
  return (
    <div className={`${ringCard} relative bg-black cursor-pointer group`}>
      <img src={thumb} alt={project.title} draggable={false} decoding="async" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
      <span className="absolute top-2.5 right-2.5 h-7 w-7 rounded-full flex items-center justify-center text-black" style={{ background: LIME }}>
        <Play className="h-3.5 w-3.5 ml-0.5" fill="currentColor" />
      </span>
      <p className="absolute bottom-2.5 left-3 right-3 text-[11px] font-semibold text-white leading-tight line-clamp-2">{project.title}</p>
    </div>
  );
}

function ringInfoCards(): RingItem[] {
  return [
    {
      key: 'views', w: 150, h: 120,
      node: (
        <div className={`${ringCard} bg-white p-3 flex flex-col`}>
          <p className="text-[10px] text-[#5b6472] leading-tight">Visualizações<br />geradas</p>
          <p className="text-xl font-bold text-[#0b0d10] mt-1 tracking-tight">+10M</p>
          <div className="mt-auto"><Sparkline /></div>
        </div>
      ),
    },
    {
      key: 'dark', w: 128, h: 140,
      node: (
        <div className={`${ringCard} bg-[#0b0d10] p-3.5 flex flex-col justify-center`}>
          <p className="text-[12px] leading-snug text-white/90">
            Roteiro <span className="inline-block h-2 w-2 rounded-full align-middle" style={{ background: LIME }} /> que une
            <span className="font-semibold text-white"> Estratégia, Captação</span> e <span className="font-semibold text-white">Edição</span>
          </p>
        </div>
      ),
    },
    {
      key: 'studio', w: 128, h: 128,
      node: (
        <div className={`${ringCard} bg-white/25 backdrop-blur-md p-3 flex flex-col items-center justify-center text-center text-white`}>
          <span className="h-8 w-8 rounded-full border border-white/70 flex items-center justify-center mb-2"><Plus className="h-4 w-4" /></span>
          <p className="text-[13px] font-semibold leading-tight">Estúdio próprio</p>
          <p className="text-[10px] text-white/80 mt-1">Agende sua gravação</p>
        </div>
      ),
    },
    {
      key: 'agenda', w: 132, h: 150,
      node: (
        <div className={`${ringCard} bg-white p-3`}>
          <p className="text-[10px] font-semibold text-[#0b0d10]">Captação do mês</p>
          {['Reels da semana', 'Vídeo institucional', 'Fotos do cardápio', 'Depoimentos'].map((t, i) => (
            <div key={t} className="mt-2 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: i < 2 ? LIME : '#2f8bff' }} />
              <span className="text-[9.5px] text-[#5b6472] truncate">{t}</span>
            </div>
          ))}
          <div className="mt-2.5 h-1.5 rounded-full bg-[#eef1f5] overflow-hidden"><div className="h-full w-2/3 rounded-full" style={{ background: LIME }} /></div>
        </div>
      ),
    },
    {
      key: 'brands', w: 120, h: 112,
      node: (
        <div className={`${ringCard} p-3 flex flex-col justify-between`} style={{ background: LIME }}>
          <p className="text-[10px] text-black/70 leading-tight">Marcas atendidas</p>
          <p className="text-2xl font-bold text-black tracking-tight">+40</p>
        </div>
      ),
    },
    {
      key: 'insta', w: 132, h: 120,
      node: (
        <div className={`${ringCard} bg-white p-3 flex flex-col`}>
          <span className="h-7 w-7 rounded-lg flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#feda75,#d62976,#4f5bd5)' }}>
            <Instagram className="h-3.5 w-3.5" />
          </span>
          <p className="text-[11px] font-semibold text-[#0b0d10] mt-2">@inovalab.mov</p>
          <p className="text-[9.5px] text-[#5b6472] mt-0.5">Conteúdo que performa</p>
        </div>
      ),
    },
    {
      key: 'rating', w: 120, h: 104,
      node: (
        <div className={`${ringCard} bg-[#0b0d10] p-3 flex flex-col justify-between`}>
          <p className="text-[10px] text-white/60">Avaliação média</p>
          <div>
            <p className="text-xl font-bold text-white">5,0</p>
            <div className="flex gap-0.5 mt-0.5">{[0, 1, 2, 3, 4].map((s) => <Star key={s} className="h-2.5 w-2.5" fill={LIME} stroke="none" />)}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'projects', w: 140, h: 118,
      node: (
        <div className={`${ringCard} bg-white p-3 flex flex-col`}>
          <p className="text-[10px] text-[#5b6472]">Projetos entregues</p>
          <p className="text-xl font-bold text-[#0b0d10] tracking-tight">+150</p>
          <div className="mt-auto flex items-end gap-1 h-8">
            {[40, 55, 45, 70, 62, 85, 100].map((h, i) => (
              <span key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: i === 6 ? LIME : '#cfe4ff' }} />
            ))}
          </div>
        </div>
      ),
    },
  ];
}

/* ───────────────────────── cards de trabalho e Instagram ───────────────────────── */

/** Card que inclina na direção do mouse */
function ProjectCard({ project, index, onClick }: { project: Project; index: number; onClick: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  // O lazy do navegador baixa capas até ~2 telas abaixo; aqui só baixa quando o card está chegando
  const near = useInView(ref, { once: true, margin: '300px' });
  const thumb = project.thumbnail_url || getVideoThumb(project.video_url, 'hq');
  const bigThumb = project.thumbnail_url ? null : getVideoThumb(project.video_url);
  const [t, setT] = useState({ x: 0, y: 0, gx: 50, gy: 50 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay: (index % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
      style={{ perspective: 900 }}
    >
      <div
        className="group relative cursor-pointer overflow-hidden rounded-[22px] bg-[#0b0d10] transition-transform duration-200 ease-out will-change-transform"
        style={{ transform: `rotateX(${t.x}deg) rotateY(${t.y}deg)` }}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          setT({ x: (0.5 - py) * 10, y: (px - 0.5) * 12, gx: px * 100, gy: py * 100 });
        }}
        onMouseLeave={() => setT({ x: 0, y: 0, gx: 50, gy: 50 })}
        onClick={onClick}
      >
        <div className="aspect-[4/5] relative overflow-hidden">
          {thumb && near ? (
            <img
              src={thumb}
              srcSet={bigThumb ? `${thumb} 480w, ${bigThumb} 1280w` : undefined}
              sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
              alt={project.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105" />
          ) : thumb ? null : (
            <div className="h-full w-full flex items-center justify-center" style={{ background: SKY }}>
              <Film className="h-16 w-16 text-white/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
          {/* brilho que segue o mouse */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{ background: `radial-gradient(circle at ${t.gx}% ${t.gy}%, rgba(255,255,255,0.18), transparent 45%)` }}
          />
          {project.video_url && (
            <span className="absolute top-4 right-4 h-11 w-11 rounded-full flex items-center justify-center text-black scale-90 group-hover:scale-100 transition-transform duration-300" style={{ background: LIME }}>
              <Play className="h-4 w-4 ml-0.5" fill="currentColor" />
            </span>
          )}
          <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
            {project.category && (
              <span className="inline-block px-2.5 py-1 rounded-full font-mono text-[10px] uppercase tracking-[0.15em] bg-white/15 backdrop-blur-md text-white mb-3">
                {CATEGORIES_LABELS[project.category] || project.category}
              </span>
            )}
            <h3 className="text-lg md:text-xl font-semibold text-white leading-tight tracking-tight">{project.title}</h3>
            {project.description && <p className="text-sm text-white/60 mt-1.5 line-clamp-2">{project.description}</p>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function InstagramPostCard({ post, index }: { post: IGPost; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  // O script e o iframe do Instagram são pesados: só carregam quando o card chega perto da tela
  const near = useInView(ref, { once: true, margin: '400px' });
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: (index % 3) * 0.08 }}
      className="rounded-[22px] bg-white border border-black/[0.06] overflow-hidden hover:-translate-y-1 hover:shadow-[0_24px_50px_-24px_rgba(10,99,222,0.35)] transition-all duration-500"
    >
      <div className="bg-[#f4f6f9] p-2 flex items-center justify-center min-h-[400px]">
        {near ? <InstagramEmbed url={post.post_url} /> : <Instagram className="h-8 w-8 text-[#c3cad4]" />}
      </div>

      <div className="p-6 space-y-4">
        {(post.strategic_description || post.post_result) && (
          <div className="flex items-center gap-2 flex-wrap">
            {post.strategic_description && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-[10px] uppercase tracking-widest bg-[#e6f1ff] text-[#0a63de]">
                <BarChart3 className="h-3 w-3" /> Estratégia
              </span>
            )}
            {post.post_result && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-[10px] uppercase tracking-widest text-black" style={{ background: LIME }}>
                <TrendingUp className="h-3 w-3" /> Resultado
              </span>
            )}
          </div>
        )}

        {post.strategic_description && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8a93a1] mb-1.5">Descrição estratégica</p>
            <p className={`text-sm text-[#2b313b] leading-relaxed ${!expanded ? 'line-clamp-3' : ''}`}>{post.strategic_description}</p>
            {post.strategic_description.length > 150 && (
              <button onClick={() => setExpanded(!expanded)} className="text-[12px] text-[#0a63de] hover:underline mt-1 font-semibold">
                {expanded ? 'Ver menos' : 'Ver mais →'}
              </button>
            )}
          </div>
        )}

        {post.post_result && (
          <div className={post.strategic_description ? 'pt-3 border-t border-black/[0.06]' : ''}>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#0a63de] mb-1.5">Resultado</p>
            <p className="text-sm text-[#2b313b] leading-relaxed">{post.post_result}</p>
          </div>
        )}
      </div>

      <div className="px-6 pb-5 flex items-center justify-between gap-3">
        <a
          href={post.post_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[#0b0d10] text-white hover:bg-[#0a63de] transition-colors"
        >
          <ExternalLinkIcon className="h-3.5 w-3.5" /> Ver no Instagram
        </a>
        <p className="text-[10px] text-[#8a93a1] text-right leading-tight max-w-[180px]">Apenas dados públicos.</p>
      </div>
    </motion.div>
  );
}

/* ───────────────────────── serviços interativos ───────────────────────── */

function ServicesShowcase() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-30%' });

  useEffect(() => {
    if (!auto || !inView) return;
    const id = setTimeout(() => setActive((a) => (a + 1) % SERVICES.length), 5000);
    return () => clearTimeout(id);
  }, [active, auto, inView]);

  const s = SERVICES[active];
  const Icon = s.icon;

  return (
    <div ref={ref} className="grid lg:grid-cols-[1fr_1.15fr] gap-5 md:gap-6">
      <div className="flex flex-col gap-2">
        {SERVICES.map((sv, i) => {
          const on = i === active;
          return (
            <button
              key={sv.title}
              onClick={() => { setActive(i); setAuto(false); }}
              onMouseEnter={() => { setActive(i); setAuto(false); }}
              className={`relative text-left rounded-[20px] px-5 md:px-6 py-4 md:py-5 overflow-hidden transition-colors duration-300 ${on ? 'bg-[#0b0d10] text-white' : 'bg-[#f2f4f7] text-[#0b0d10] hover:bg-[#e9edf2]'}`}
            >
              <div className="flex items-center gap-4">
                <span className={`font-mono text-[11px] ${on ? 'text-white/50' : 'text-[#8a93a1]'}`}>0{i + 1}</span>
                <span className="text-lg md:text-xl font-semibold tracking-tight flex-1">{sv.title}</span>
                <ArrowUpRight className={`h-5 w-5 transition-transform duration-300 ${on ? 'rotate-45' : ''}`} style={on ? { color: LIME } : undefined} />
              </div>
              <AnimatePresence initial={false}>
                {on && (
                  <motion.p
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className="text-sm text-white/60 pl-9 overflow-hidden"
                  >
                    <span className="block pt-2">{sv.desc}</span>
                  </motion.p>
                )}
              </AnimatePresence>
              {on && auto && inView && (
                <motion.span
                  key={`bar-${active}`}
                  className="absolute bottom-0 left-0 h-[3px]"
                  style={{ background: LIME }}
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 5, ease: 'linear' }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="relative rounded-[28px] overflow-hidden min-h-[380px] md:min-h-[460px] text-white" style={{ background: SKY }}>
        <Clouds dense={false} />
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 p-7 md:p-10 h-full flex flex-col"
          >
            <span className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center">
              <Icon className="h-6 w-6" />
            </span>
            <h3 className="mt-6 text-3xl md:text-4xl font-semibold tracking-[-0.03em] leading-tight">{s.title}</h3>
            <p className="mt-3 text-white/85 max-w-md leading-relaxed">{s.desc}</p>
            <div className="mt-7 grid grid-cols-2 gap-2.5 max-w-md">
              {s.items.map((it, i) => (
                <motion.div
                  key={it}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 + i * 0.07 }}
                  className="flex items-center gap-2 rounded-xl bg-white/90 text-[#0b0d10] px-3 py-2.5 text-[13px] font-medium shadow-sm"
                >
                  <Check className="h-3.5 w-3.5 shrink-0 text-[#0a63de]" /> {it}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ───────────────────────── montador de orçamento ───────────────────────── */

function BudgetBuilder({ ctaUrl }: { ctaUrl: string }) {
  const [services, setServices] = useState<string[]>(['Social media mensal']);
  const [goal, setGoal] = useState(BUILDER.goals[0]);
  const [when, setWhen] = useState(BUILDER.when[0]);
  const [company, setCompany] = useState('');
  const [copied, setCopied] = useState(false);
  const isWhatsApp = /whatsapp|wa\.me/i.test(ctaUrl);

  const toggle = (s: string) => setServices((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  const list = services.length ? services.join(', ').replace(/, ([^,]*)$/, ' e $1') : 'conhecer os serviços';
  const message =
    `Olá, INOVA! ${company.trim() ? `Sou da ${company.trim()}. ` : ''}` +
    `Tenho interesse em ${list.toLowerCase()}. Meu objetivo é ${goal.toLowerCase()} e quero começar: ${when.toLowerCase()}.`;

  const chip = (on: boolean) =>
    `px-3.5 py-2 rounded-full text-[13px] font-medium border transition-all duration-200 ${on
      ? 'text-black border-transparent scale-[1.02]'
      : 'border-white/15 text-white/75 hover:border-white/40 hover:text-white'}`;

  return (
    <div className="relative rounded-[28px] bg-[#0b0d10] text-white overflow-hidden">
      <div className="absolute -top-48 -right-48 h-[34rem] w-[34rem] opacity-40" style={{ background: 'radial-gradient(closest-side, #2f8bff, rgba(47,139,255,0))' }} />
      <div className="relative grid lg:grid-cols-[1.2fr_1fr] gap-10 p-6 sm:p-8 md:p-12">
        <div>
          <Eyebrow light>Monte seu projeto</Eyebrow>
          <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-[-0.035em] leading-[1.05]">
            Seu orçamento em <span style={{ color: LIME }}>30 segundos.</span>
          </h2>
          <p className="mt-4 text-white/55 max-w-md">
            Escolha o que precisa. {isWhatsApp ? 'A mensagem já vai pronta para o nosso WhatsApp.' : 'A mensagem é copiada para você colar no atendimento.'}
          </p>

          <div className="mt-8 space-y-6">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/45 mb-3">1. O que você precisa</p>
              <div className="flex flex-wrap gap-2">
                {BUILDER.services.map((s) => {
                  const on = services.includes(s);
                  return (
                    <button key={s} onClick={() => toggle(s)} className={chip(on)} style={on ? { background: LIME } : undefined}>
                      {on && <Check className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />}{s}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/45 mb-3">2. Seu objetivo</p>
              <div className="flex flex-wrap gap-2">
                {BUILDER.goals.map((g) => (
                  <button key={g} onClick={() => setGoal(g)} className={chip(goal === g)} style={goal === g ? { background: '#ffffff' } : undefined}>{g}</button>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/45 mb-3">3. Quando</p>
                <div className="flex flex-wrap gap-2">
                  {BUILDER.when.map((w) => (
                    <button key={w} onClick={() => setWhen(w)} className={chip(when === w)} style={when === w ? { background: '#ffffff' } : undefined}>{w}</button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="builder-company" className="block font-mono text-[11px] uppercase tracking-[0.2em] text-white/45 mb-3">4. Sua empresa (opcional)</label>
                <input
                  id="builder-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Nome da empresa"
                  maxLength={60}
                  className="w-full rounded-full bg-white/[0.06] border border-white/15 px-4 py-2.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* prévia da conversa */}
        <div className="flex flex-col">
          <div className="flex-1 rounded-[22px] bg-[#e9f2ff] p-4 md:p-5 flex flex-col">
            <div className="flex items-center gap-3 pb-4 border-b border-black/[0.06]">
              <span className="h-10 w-10 rounded-full bg-[#0b0d10] flex items-center justify-center">
                <img src={logoInova} alt="" className="h-4 brightness-0 invert" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#0b0d10]">INOVA Co.</p>
                <p className="text-[11px] text-[#0a63de]">responde em até 24h</p>
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-end pt-6 gap-2">
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={message}
                  layout
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className="self-end max-w-[92%] rounded-2xl rounded-br-md px-4 py-3 text-[14px] leading-relaxed text-black shadow-sm"
                  style={{ background: LIME }}
                >
                  {message}
                </motion.div>
              </AnimatePresence>
              <p className="self-end text-[10px] text-[#8a93a1] pr-1">{copied ? 'mensagem copiada ✓' : 'prévia da sua mensagem'}</p>
            </div>
          </div>
          <a
            href={withMessage(ctaUrl, message)}
            onClick={() => {
              trackBudgetClick('montador');
              if (!isWhatsApp) navigator.clipboard?.writeText(message).then(() => setCopied(true)).catch(() => {});
            }}
            target="_blank"
            rel="noreferrer"
            className="mt-4 group flex items-center justify-between gap-3 rounded-full pl-6 pr-2 py-2 text-sm font-semibold text-black transition-transform hover:scale-[1.02]"
            style={{ background: LIME }}
          >
            <span className="font-mono uppercase tracking-[0.14em] text-[12px]">{isWhatsApp ? 'Enviar no WhatsApp' : 'Copiar e pedir orçamento'}</span>
            <span className="h-10 w-10 rounded-full bg-[#0b0d10] text-white flex items-center justify-center group-hover:rotate-[-20deg] transition-transform">
              <Send className="h-4 w-4" />
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── página ───────────────────────── */

const NAV = [
  { href: '#trabalhos', label: 'Trabalhos' },
  { href: '#servicos', label: 'Serviços' },
  { href: '#estudio', label: 'Estúdio' },
  { href: '#orcamento', label: 'Orçamento' },
];

export default function PublicPortfolioPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [igPosts, setIgPosts] = useState<IGPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [ctaUrl, setCtaUrl] = useState('https://api.whatsapp.com/send/?phone=5502481474167');
  const [instagramUrl, setInstagramUrl] = useState('https://www.instagram.com/inovalab.mov/');
  const [scrolled, setScrolled] = useState(false);

  useSeo({
    title: 'INOVA Co. — Marketing e Produtora Audiovisual em Volta Redonda (RJ)',
    description:
      'Referência em marketing digital em Volta Redonda: produtora audiovisual com estúdio próprio, social media, tráfego pago e edição. Peça seu orçamento.',
    canonical: 'https://inovamarketing.online/vitrine',
    image: escritorioAsset.url,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': ['ProfessionalService', 'LocalBusiness'],
      name: 'INOVA Co.',
      description:
        'Produtora audiovisual e agência de marketing digital em Volta Redonda (RJ), com estúdio de gravação próprio: vídeos institucionais, social media, tráfego pago e edição.',
      url: 'https://inovamarketing.online/vitrine',
      image: 'https://inovamarketing.online' + escritorioAsset.url,
      areaServed: [
        { '@type': 'City', name: 'Volta Redonda' },
        { '@type': 'State', name: 'Rio de Janeiro' },
        'Brasil',
      ],
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Volta Redonda',
        addressRegion: 'RJ',
        addressCountry: 'BR',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: -22.5205,
        longitude: -44.1042,
      },
      sameAs: ['https://www.instagram.com/inovalab.mov/'],
      makesOffer: SERVICES.map(s => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s.title, description: s.desc },
      })),
    },
  });

  const DEMO_PROJECTS: Project[] = [
    { id: '1', title: 'Reel Institucional', description: 'Vídeo institucional para redes sociais', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail_url: '', category: 'Institucional', completed_at: null },
    { id: '2', title: 'Comercial Produto', description: 'Campanha publicitária para e-commerce', video_url: '', thumbnail_url: '', category: 'Publicitário', completed_at: null },
    { id: '3', title: 'Bastidores', description: 'Making of de produção', video_url: '', thumbnail_url: '', category: 'Social Media', completed_at: null },
  ];

  const loadData = () => {
    Promise.all([
      supabase.from('portfolio_projects').select('*').order('order_index', { ascending: true }),
      supabase.from('instagram_posts' as any).select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
    ]).then(([projectsRes, igRes]) => {
      let fetchedProjects = (projectsRes.data as Project[]) || [];

      // Fallback if order_index doesn't exist yet (indicated by error or empty if we expect items)
      if (projectsRes.error || fetchedProjects.length === 0) {
        supabase.from('portfolio_projects').select('*').order('created_at', { ascending: false }).then(res => {
          setProjects((res.data as Project[]) || (fetchedProjects.length > 0 ? fetchedProjects : DEMO_PROJECTS));
        });
      } else {
        setProjects(fetchedProjects);
      }

      setIgPosts(((igRes.data as any[]) || []) as IGPost[]);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();

    // OpenAI (ChatGPT) pixel — evento da vitrine
    try {
      (window as any).oaiq?.('measure', 'page_view', { type: 'page_view', event_source: 'vitrine' });
    } catch { /* noop */ }

    // Links configuráveis dos botões (aba Portfólio > Configurações da Vitrine)
    (async () => {
      const { data } = await (supabase as any)
        .from('vitrine_settings').select('cta_url, instagram_url').limit(1).maybeSingle();
      if (data?.cta_url) setCtaUrl(data.cta_url);
      if (data?.instagram_url) setInstagramUrl(data.instagram_url);
    })();

    const channel = supabase
      .channel('portfolio-projects-public')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'portfolio_projects' }, () => loadData())
      .subscribe();

    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.7);
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => { supabase.removeChannel(channel); window.removeEventListener('scroll', onScroll); };
  }, []);

  const categories = [...new Set(projects.map(p => p.category).filter(Boolean))];
  const filtered = filter === 'all' ? projects : projects.filter(p => p.category === filter);

  // Cards do anel: trabalhos com capa intercalados com os cards de informação
  const infos = ringInfoCards();
  const withThumb = projects
    .map((p) => ({ p, thumb: p.thumbnail_url || getVideoThumb(p.video_url, 'hq') }))
    .filter((x): x is { p: Project; thumb: string } => !!x.thumb)
    .slice(0, 8);
  const ring: RingItem[] = [];
  for (let i = 0; ring.length < 20; i++) {
    const info = infos[i % infos.length];
    ring.push({ ...info, key: `${info.key}-${i}` });
    const pr = withThumb.length ? withThumb[i % withThumb.length] : null;
    if (pr && ring.length < 20) {
      ring.push({ key: `p-${pr.p.id}-${i}`, w: 140, h: 176, node: <RingProject project={pr.p} thumb={pr.thumb} />, onOpen: () => setSelectedProject(pr.p) });
    }
  }

  const btnPrimary = 'group inline-flex items-center gap-3 rounded-full pl-5 pr-1.5 py-1.5 font-mono text-[12px] uppercase tracking-[0.14em] font-semibold text-black transition-transform hover:scale-[1.03]';

  return (
    <div className="min-h-screen bg-white text-[#0b0d10] selection:bg-[#bff720] selection:text-black overflow-x-hidden">
      {/* Barra fixa que aparece depois do topo */}
      <AnimatePresence>
        {scrolled && (
          <motion.nav
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className="fixed top-3 inset-x-3 z-50 flex justify-center pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-3xl flex items-center justify-between gap-3 rounded-full bg-white/80 backdrop-blur-xl border border-black/[0.06] shadow-[0_12px_40px_-16px_rgba(10,40,90,0.35)] pl-5 pr-1.5 py-1.5">
              <a href="#top"><img src={logoInova} alt="INOVA Co." className="h-5 brightness-0" /></a>
              <div className="hidden md:flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.16em] text-[#5b6472]">
                {NAV.map((n) => <a key={n.href} href={n.href} className="hover:text-[#0a63de] transition-colors">{n.label}</a>)}
              </div>
              <a href={ctaUrl} onClick={() => trackBudgetClick('header')} target="_blank" rel="noreferrer" className="rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] font-semibold text-black" style={{ background: LIME }}>
                Orçamento
              </a>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Hero */}
      <div className="p-2 md:p-3">
        <section id="top" className="relative overflow-hidden rounded-[24px] md:rounded-[32px] min-h-[calc(100svh-16px)] md:min-h-[calc(100svh-24px)] flex flex-col" style={{ background: SKY }}>
          {/* brilho do sol */}
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[900px] pointer-events-none" style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.3), rgba(255,255,255,0))' }} />
          <Clouds />

          <nav className="relative z-20 flex items-center justify-between px-5 md:px-10 pt-5 md:pt-7">
            <a href="#top" className="flex items-center"><img src={logoInova} alt="INOVA Co." className="h-6 md:h-7 brightness-0 invert" /></a>
            <div className="hidden md:flex items-center gap-9 font-mono text-[11px] uppercase tracking-[0.18em] text-white/85">
              {NAV.map((n) => <a key={n.href} href={n.href} className="hover:text-white transition-colors">{n.label}</a>)}
            </div>
            <div className="flex items-center gap-2">
              <a href={instagramUrl} target="_blank" rel="noreferrer" aria-label="Instagram" className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full bg-white/15 border border-white/30 text-white hover:bg-white/25 transition-colors">
                <Instagram className="h-4 w-4" />
              </a>
              <a href={ctaUrl} onClick={() => trackBudgetClick('header')} target="_blank" rel="noreferrer" className="rounded-full px-4 md:px-5 py-2 md:py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] font-semibold text-black hover:scale-[1.03] transition-transform" style={{ background: LIME }}>
                Fale conosco
              </a>
            </div>
          </nav>

          <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-5 pt-10 md:pt-14">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/30 backdrop-blur-md px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-white mb-6"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: LIME }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: LIME }} />
              </span>
              Disponível para novos projetos
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-[2.6rem] leading-[1] sm:text-6xl md:text-7xl lg:text-[5.4rem] font-semibold tracking-[-0.045em] text-white max-w-5xl"
            >
              Histórias que encantam,
              <br />
              <span className="text-white/60">estratégia que vende.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.25 }}
              className="mt-5 md:mt-6 text-[15px] md:text-lg text-white/85 max-w-xl leading-relaxed"
            >
              Produtora audiovisual e agência de marketing em Volta Redonda. Vídeo, social media e tráfego para marcas que querem ser lembradas.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-8 flex flex-col sm:flex-row items-center gap-3"
            >
              <a href="#trabalhos" className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 font-mono text-[12px] uppercase tracking-[0.14em] text-white bg-[#0a3f8f]/45 border border-white/25 backdrop-blur-md hover:bg-[#0a3f8f]/65 transition-colors">
                <Play className="h-3.5 w-3.5" fill="currentColor" /> Ver trabalhos
              </a>
              <a href={ctaUrl} onClick={() => trackBudgetClick('hero')} target="_blank" rel="noreferrer" className={btnPrimary} style={{ background: LIME }}>
                Solicitar orçamento
                <span className="h-9 w-9 rounded-full bg-[#0b0d10] text-white flex items-center justify-center group-hover:rotate-45 transition-transform duration-300">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </a>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 mt-6 md:mt-4"
          >
            <HeroRing items={ring} />
          </motion.div>

          <div className="relative z-10 pb-6 md:pb-8 flex flex-col items-center gap-1.5 text-[#0a3f8f]">
            <p className="text-[12px] font-medium flex items-center gap-1.5">
              <MousePointer2 className="h-3.5 w-3.5" /> Arraste os cards · avaliação 5,0 por +40 marcas
            </p>
            <div className="flex gap-0.5">{[0, 1, 2, 3, 4].map((s) => <Star key={s} className="h-3.5 w-3.5" fill="#e3b600" stroke="none" />)}</div>
          </div>
        </section>
      </div>

      {/* Faixa de especialidades */}
      <div className="relative overflow-hidden py-7 md:py-9 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
        <div className="flex gap-14 whitespace-nowrap animate-[marquee_32s_linear_infinite] will-change-transform w-max">
          {Array.from({ length: 2 }).map((_, k) => (
            <div key={k} className="flex items-center gap-14 text-[15px] md:text-lg font-semibold text-[#9aa3b0]">
              {[
                [Clapperboard, 'Institucional'], [Megaphone, 'Social Media'], [Target, 'Tráfego Pago'], [Camera, 'Fotografia'],
                [Film, 'Documentário'], [Sparkles, 'Motion'], [Wand2, 'Edição'], [Instagram, 'Reels'],
              ].map(([Ic, label]) => {
                const I = Ic as typeof Film;
                return <span key={label as string} className="flex items-center gap-2.5"><I className="h-5 w-5" /> {label as string}</span>;
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Sobre + números */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pt-16 md:pt-24 pb-20 md:pb-28">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-center">
          <Eyebrow>Sobre nós</Eyebrow>
          <h2 className="mt-5 text-[2rem] sm:text-5xl md:text-[3.6rem] font-semibold tracking-[-0.045em] leading-[1.08] max-w-4xl mx-auto">
            Uma produtora completa
            <br className="hidden sm:block" /> dedicada a criar marcas{' '}
            <span className="inline-flex align-middle h-9 w-9 md:h-12 md:w-12 rounded-full items-center justify-center text-white -mt-1" style={{ background: '#2f8bff' }}>
              <Play className="h-4 w-4 md:h-5 md:w-5 ml-0.5" fill="currentColor" />
            </span>{' '}
            mais fortes
            <br />
            <span className="text-[#9aa3b0]">
              e{' '}
              <span className="inline-flex align-middle h-9 w-9 md:h-12 md:w-12 rounded-full items-center justify-center text-black -mt-1" style={{ background: LIME }}>
                <Sparkles className="h-4 w-4 md:h-5 md:w-5" />
              </span>{' '}
              mais lembradas
            </span>
          </h2>
        </motion.div>

        <div className="mt-12 md:mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {/* foto + projetos */}
          <motion.div
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
            className="relative rounded-[24px] overflow-hidden min-h-[360px] lg:row-span-2 group"
            style={{ background: SKY }}
          >
            <img src={escritorioAsset.url} alt="Recepção da INOVA Co. em Volta Redonda" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-80 mix-blend-luminosity group-hover:scale-105 transition-transform duration-[1.4s]" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a63de]/40 to-transparent" />
            <img src={logoInova} alt="" className="absolute top-5 left-5 h-5 brightness-0 invert" />
            <span className="absolute top-4 right-4 h-9 w-9 rounded-xl bg-white flex items-center justify-center"><BarChart3 className="h-4 w-4" /></span>
            <div className="absolute bottom-4 left-4 right-4 rounded-[18px] bg-white p-5">
              <p className="text-5xl md:text-6xl font-semibold tracking-[-0.04em]"><CountUp to={150} prefix="+" /></p>
              <p className="mt-3 text-sm text-[#5b6472] leading-snug">projetos entregues para marcas do Sul Fluminense e de todo o Brasil.</p>
            </div>
          </motion.div>

          {/* visualizações */}
          <motion.div
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.08 }}
            className="rounded-[24px] bg-[#f2f4f7] p-6 flex flex-col min-h-[300px] lg:row-span-2 hover:bg-[#ebeff4] transition-colors"
          >
            <p className="text-sm text-[#5b6472]">Visualizações geradas</p>
            <p className="mt-2 text-5xl md:text-6xl font-semibold tracking-[-0.04em]"><CountUp to={10} prefix="+" suffix="M" /></p>
            <div className="mt-auto pt-8">
              <Sparkline />
              <p className="mt-4 text-sm text-[#5b6472] leading-snug">
                nos conteúdos dos nossos clientes, somando reels, anúncios e vídeos institucionais.
              </p>
            </div>
          </motion.div>

          {/* marcas */}
          <motion.div
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.16 }}
            className="rounded-[24px] p-6 flex flex-col justify-between min-h-[200px] hover:-translate-y-1 transition-transform"
            style={{ background: LIME }}
          >
            <p className="text-sm text-black/70">Marcas atendidas</p>
            <div>
              <p className="text-5xl md:text-6xl font-semibold tracking-[-0.04em] text-black"><CountUp to={40} prefix="+" /></p>
              <p className="mt-2 text-sm text-black/70 leading-snug">do comércio local à indústria, com estratégia sob medida.</p>
            </div>
          </motion.div>

          {/* avaliação */}
          <motion.div
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.24 }}
            className="rounded-[24px] bg-[#0b0d10] text-white p-6 flex items-center justify-between min-h-[120px] hover:-translate-y-1 transition-transform"
          >
            <div>
              <p className="text-sm text-white/60">Avaliação média</p>
              <div className="flex gap-1 mt-2">{[0, 1, 2, 3, 4].map((s) => <Star key={s} className="h-4 w-4" fill={LIME} stroke="none" />)}</div>
            </div>
            <p className="text-5xl font-semibold tracking-[-0.04em]">5,0</p>
          </motion.div>
        </div>
      </section>

      {/* Serviços */}
      <section id="servicos" className="scroll-mt-20 max-w-6xl mx-auto px-4 md:px-8 pb-20 md:pb-28">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-10 md:mb-12">
          <div>
            <Eyebrow>O que fazemos</Eyebrow>
            <h2 className="mt-4 text-4xl md:text-[3.4rem] font-semibold tracking-[-0.045em] leading-[1.05]">
              Tudo que sua marca precisa,<br /><span className="text-[#9aa3b0]">num lugar só.</span>
            </h2>
          </div>
          <p className="text-[#5b6472] max-w-sm leading-relaxed">Passe o mouse ou toque em cada serviço para ver o que está incluso.</p>
        </motion.div>
        <ServicesShowcase />
      </section>

      {/* Trabalhos */}
      <section id="trabalhos" className="scroll-mt-20 bg-[#f4f6f9] rounded-[28px] md:rounded-[40px] mx-2 md:mx-3">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-20 md:py-28">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8">
            <div>
              <Eyebrow>Portfólio</Eyebrow>
              <h2 className="mt-4 text-4xl md:text-[3.4rem] font-semibold tracking-[-0.045em] leading-[1.05]">
                Trabalhos<br /><span className="text-[#9aa3b0]">selecionados.</span>
              </h2>
            </div>
            <p className="text-[#5b6472] max-w-sm leading-relaxed md:text-right">Projetos recentes, produzidos com carinho do briefing à entrega. Clique para assistir.</p>
          </motion.div>

          {categories.length > 1 && (
            <div className="mb-8 -mx-4 px-4 overflow-x-auto scrollbar-none">
              <div className="inline-flex gap-1 p-1 rounded-full bg-white border border-black/[0.06]">
                {[['all', 'Todos', projects.length] as const, ...categories.map((c) => [c, CATEGORIES_LABELS[c] || c, projects.filter((p) => p.category === c).length] as const)].map(([val, label, count]) => (
                  <button
                    key={val}
                    onClick={() => setFilter(val)}
                    className={`relative px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === val ? 'text-white' : 'text-[#5b6472] hover:text-[#0b0d10]'}`}
                  >
                    {filter === val && <motion.span layoutId="filter-pill" className="absolute inset-0 rounded-full bg-[#0b0d10]" transition={{ type: 'spring', damping: 28, stiffness: 320 }} />}
                    <span className="relative">{label}<span className="ml-1.5 opacity-50 tabular-nums">{count}</span></span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="grid gap-4 md:gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="aspect-[4/5] rounded-[22px] bg-[#e7ebf0] animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-28 text-[#8a93a1]">
              <Film className="h-14 w-14 mb-4 opacity-40" />
              <p className="text-xl font-medium">Nenhum projeto disponível ainda</p>
              <p className="text-sm mt-2">Volte em breve para conferir nossos trabalhos</p>
            </div>
          ) : (
            <div className="grid gap-4 md:gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p, i) => <ProjectCard key={p.id} project={p} index={i} onClick={() => setSelectedProject(p)} />)}
            </div>
          )}
        </div>
      </section>

      {/* Estúdio + localização */}
      <section id="estudio" className="scroll-mt-20 max-w-6xl mx-auto px-4 md:px-8 py-20 md:py-28">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <Eyebrow>Nosso espaço</Eyebrow>
            <h2 className="mt-4 text-4xl md:text-[3.2rem] font-semibold tracking-[-0.045em] leading-[1.05]">
              Estúdio próprio em<br /><span className="text-[#0a63de]">Volta Redonda.</span>
            </h2>
            <p className="mt-5 text-[#5b6472] leading-relaxed max-w-xl">
              Da recepção ao estúdio de gravação, a INOVA Co. tem estrutura completa para receber sua marca: ambiente climatizado,
              iluminação profissional e uma equipe que acompanha cada etapa — roteiro, captação, edição e publicação. Estamos no coração
              do Sul Fluminense e conhecemos o mercado local, do comércio à indústria.
            </p>
            <ul className="mt-7 grid sm:grid-cols-2 gap-2.5">
              {[
                'Estúdio equipado e climatizado',
                'Filmmakers, editores e social media juntos',
                'Agenda mensal de captação',
                'Atendimento presencial na região',
              ].map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[#2b313b] rounded-2xl bg-[#f2f4f7] px-4 py-3">
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-[#0a63de]" /> {item}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={ctaUrl} onClick={() => trackBudgetClick('estudio')} target="_blank" rel="noreferrer" className={btnPrimary} style={{ background: LIME }}>
                Agendar uma visita
                <span className="h-9 w-9 rounded-full bg-[#0b0d10] text-white flex items-center justify-center group-hover:rotate-45 transition-transform duration-300">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </a>
              <a href="https://www.google.com/maps/search/?api=1&query=Volta+Redonda%2C+RJ" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full px-5 py-3 font-mono text-[12px] uppercase tracking-[0.14em] border border-black/10 hover:border-[#0a63de] hover:text-[#0a63de] transition-colors">
                <Navigation className="h-3.5 w-3.5" /> Como chegar
              </a>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="grid grid-cols-5 gap-3 md:gap-4">
            <figure className="col-span-5 relative overflow-hidden rounded-[24px] group">
              <img
                src={escritorioAsset.url}
                alt="Recepção do escritório da INOVA Co. com logo na parede e porta do estúdio de gravação"
                loading="lazy" width={1920} height={1440}
                className="w-full aspect-[16/10] object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-[1.05]"
              />
              <figcaption className="absolute bottom-4 left-4 rounded-full bg-white/90 backdrop-blur px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em]">
                Recepção &amp; estúdio
              </figcaption>
            </figure>
            <div className="col-span-3 relative overflow-hidden rounded-[24px] bg-[#e7ebf0]">
              <iframe
                title="Mapa da INOVA Co. em Volta Redonda, Rio de Janeiro"
                src="https://www.openstreetmap.org/export/embed.html?bbox=-44.1342%2C-22.5405%2C-44.0742%2C-22.5005&layer=mapnik&marker=-22.5205%2C-44.1042"
                loading="lazy"
                className="w-full h-full min-h-[170px] border-0 grayscale-[0.6]"
              />
            </div>
            <div className="col-span-2 rounded-[24px] p-5 flex flex-col justify-between text-white" style={{ background: SKY }}>
              <MapPin className="h-5 w-5" />
              <div>
                <p className="text-2xl font-semibold tracking-tight leading-tight">Volta Redonda</p>
                <p className="text-sm text-white/85">Rio de Janeiro</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Montador de orçamento */}
      <section id="orcamento" className="scroll-mt-20 max-w-6xl mx-auto px-4 md:px-8 pb-20 md:pb-28">
        <BudgetBuilder ctaUrl={ctaUrl} />
      </section>

      {/* Instagram */}
      {igPosts.length > 0 && (
        <section id="instagram" className="scroll-mt-20 max-w-6xl mx-auto px-4 md:px-8 pb-20 md:pb-28">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-center mb-12">
            <Eyebrow>Em destaque</Eyebrow>
            <h2 className="mt-4 text-4xl md:text-[3.4rem] font-semibold tracking-[-0.045em] leading-[1.05]">
              Conteúdos que<br /><span className="text-[#9aa3b0]">performam.</span>
            </h2>
            <p className="mt-5 text-[#5b6472] max-w-xl mx-auto leading-relaxed">
              Posts reais publicados nas redes dos nossos clientes, com dados públicos e contexto estratégico.
            </p>
          </motion.div>
          <div className="grid gap-5 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {igPosts.map((post, i) => <InstagramPostCard key={post.id} post={post} index={i} />)}
          </div>
          <p className="mt-10 text-center text-[11px] text-[#8a93a1] max-w-lg mx-auto leading-relaxed">
            Este conteúdo exibe apenas dados públicos do Instagram. Métricas como alcance, impressões e conversões não estão incluídas.
          </p>
        </section>
      )}

      {/* CTA final */}
      <section id="contato" className="px-2 md:px-3 pb-2 md:pb-3">
        <div className="relative overflow-hidden rounded-[24px] md:rounded-[32px] text-center text-white" style={{ background: SKY }}>
          <Clouds />
          <div className="relative z-10 max-w-3xl mx-auto px-5 py-24 md:py-32">
            <Eyebrow light>Vamos conversar</Eyebrow>
            <motion.h2
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}
              className="mt-5 text-4xl sm:text-5xl md:text-7xl font-semibold tracking-[-0.045em] leading-[1]"
            >
              Vamos criar algo<br /><span className="text-white/60">incrível juntos?</span>
            </motion.h2>
            <p className="mt-6 text-white/85 max-w-md mx-auto">Conte sua ideia. Respondemos em até 24h com um plano sob medida para sua marca.</p>
            <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href={ctaUrl} onClick={() => trackBudgetClick('cta_final')} target="_blank" rel="noreferrer" className={btnPrimary} style={{ background: LIME }}>
                <MessageCircle className="h-4 w-4" /> Solicitar orçamento
                <span className="h-9 w-9 rounded-full bg-[#0b0d10] text-white flex items-center justify-center group-hover:rotate-45 transition-transform duration-300">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </a>
              <a href={instagramUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 font-mono text-[12px] uppercase tracking-[0.14em] text-white bg-[#0a3f8f]/45 border border-white/25 backdrop-blur-md hover:bg-[#0a3f8f]/65 transition-colors">
                <Instagram className="h-4 w-4" /> @inovalab.mov
              </a>
            </div>
          </div>
          <footer className="relative z-10 border-t border-[#0a3f8f]/10 px-5 md:px-10 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[#0a3f8f]">
            <img src={logoInova} alt="INOVA Co." className="h-5 brightness-0 opacity-70" />
            <div className="flex items-center gap-5">
              <a href={instagramUrl} target="_blank" rel="noreferrer" aria-label="Instagram" className="opacity-60 hover:opacity-100 transition-opacity"><Instagram className="h-4 w-4" /></a>
              <a href={ctaUrl} onClick={() => trackBudgetClick('footer')} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="opacity-60 hover:opacity-100 transition-opacity"><MessageCircle className="h-4 w-4" /></a>
            </div>
            <p className="text-xs opacity-60">© {new Date().getFullYear()} INOVA Co. Todos os direitos reservados.</p>
          </footer>
        </div>
      </section>

      {/* Vídeo */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05080f]/90 backdrop-blur-md p-5 md:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedProject(null)}
          >
            <motion.div
              className="relative w-full max-w-5xl"
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedProject(null)}
                aria-label="Fechar"
                className="absolute -top-12 right-0 h-10 w-10 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform"
              >
                <X className="h-5 w-5" />
              </button>
              {selectedProject.video_url && getVideoEmbed(selectedProject.video_url) ? (
                <div className="aspect-video rounded-2xl overflow-hidden bg-black ring-1 ring-white/10 shadow-2xl">
                  <iframe
                    src={getVideoEmbed(selectedProject.video_url)!}
                    className="h-full w-full"
                    allowFullScreen
                    allow="autoplay; encrypted-media"
                    title={selectedProject.title}
                  />
                </div>
              ) : (
                <div className="aspect-video rounded-2xl overflow-hidden bg-white/5 flex items-center justify-center">
                  <p className="text-white/40">Sem vídeo disponível</p>
                </div>
              )}
              <div className="mt-6 text-white">
                {selectedProject.category && (
                  <span className="inline-block px-3 py-1 rounded-full font-mono text-[10px] tracking-widest uppercase text-black mb-3" style={{ background: LIME }}>
                    {selectedProject.category}
                  </span>
                )}
                <h3 className="text-2xl md:text-3xl font-semibold tracking-tight">{selectedProject.title}</h3>
                {selectedProject.description && <p className="text-white/60 mt-2 max-w-2xl">{selectedProject.description}</p>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
