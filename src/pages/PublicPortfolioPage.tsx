import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, useInView, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  Play, X, Instagram, Film, Sparkles, MessageCircle, ExternalLink as ExternalLinkIcon,
  BarChart3, TrendingUp, ArrowUpRight, Camera, Megaphone, Clapperboard, Wand2, Users, Award, Zap,
} from 'lucide-react';
import logoInova from '@/assets/logo-inova.png';
import { InstagramEmbed } from '@/components/InstagramEmbed';

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

const CATEGORIES_LABELS: Record<string, string> = {
  'Institucional': 'Institucional', 'Publicitário': 'Publicitário',
  'Social Media': 'Social Media', 'Documentário': 'Documentário',
  'Evento': 'Evento', 'Motion Graphics': 'Motion', 'Outro': 'Outro',
};

const SERVICES = [
  { icon: Clapperboard, title: 'Produção Audiovisual', desc: 'Vídeos institucionais, comerciais e documentários com qualidade cinematográfica.' },
  { icon: Megaphone, title: 'Social Media Estratégico', desc: 'Conteúdo para redes sociais que gera engajamento e converte.' },
  { icon: Camera, title: 'Direção & Roteiro', desc: 'Storytelling refinado, da concepção criativa à entrega final.' },
  { icon: Wand2, title: 'Edição & Motion', desc: 'Pós-produção, color grading e motion graphics com identidade própria.' },
];

const STATS = [
  { value: '+150', label: 'Projetos entregues', icon: Film },
  { value: '+40', label: 'Marcas atendidas', icon: Users },
  { value: '+10M', label: 'Visualizações geradas', icon: Zap },
  { value: '5★', label: 'Avaliação média', icon: Award },
];

function getVideoEmbed(url: string) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1`;
  return null;
}

function getVideoThumb(url: string) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/maxresdefault.jpg`;
  return null;
}

function ProjectCard({ project, index, onClick, featured = false }: { project: Project; index: number; onClick: () => void; featured?: boolean }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const thumb = project.thumbnail_url || getVideoThumb(project.video_url);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 60 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative cursor-pointer overflow-hidden rounded-3xl ${featured ? 'md:col-span-2 md:row-span-2' : ''}`}
      onClick={onClick}
    >
      <div className={`${featured ? 'aspect-[16/10]' : 'aspect-[4/5]'} relative overflow-hidden bg-[#0a0a0a]`}>
        {thumb ? (
          <img
            src={thumb}
            alt={project.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#015f57]/40 via-black to-black flex items-center justify-center">
            <Film className="h-20 w-20 text-white/10" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80 group-hover:opacity-95 transition-opacity duration-500" />

        {/* Play button */}
        {project.video_url && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full bg-[#bff720]/95 text-black opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:scale-100 scale-75 shadow-2xl shadow-[#bff720]/30">
              <Play className="h-7 w-7 md:h-8 md:w-8 ml-1" fill="currentColor" />
            </motion.div>
          </div>
        )}

        {/* External arrow indicator */}
        <div className="absolute top-5 right-5 h-10 w-10 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-500">
          <ArrowUpRight className="h-4 w-4 text-white" />
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-7">
          {project.category && (
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold tracking-[0.15em] uppercase bg-[#bff720]/10 backdrop-blur-md text-[#bff720] border border-[#bff720]/20 mb-3">
              {project.category}
            </span>
          )}
          <h3 className={`${featured ? 'text-2xl md:text-3xl' : 'text-lg md:text-xl'} font-bold text-white leading-tight tracking-tight`}>
            {project.title}
          </h3>
          {project.description && (
            <p className="text-sm text-white/60 mt-2 line-clamp-2 max-w-md">
              {project.description}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function InstagramPostCard({ post, index }: { post: IGPost; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.08 }}
      className="rounded-3xl bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/5 overflow-hidden hover:border-[#bff720]/30 transition-all duration-500 group"
    >
      <div className="bg-white p-2 flex items-center justify-center min-h-[400px]">
        <InstagramEmbed url={post.post_url} />
      </div>

      <div className="p-6 space-y-4">
        {(post.strategic_description || post.post_result) && (
          <div className="flex items-center gap-2 flex-wrap">
            {post.strategic_description && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-purple-500/10 text-purple-300 border border-purple-500/20">
                <BarChart3 className="h-3 w-3" /> Estratégia
              </span>
            )}
            {post.post_result && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#bff720]/10 text-[#bff720] border border-[#bff720]/20">
                <TrendingUp className="h-3 w-3" /> Resultado
              </span>
            )}
          </div>
        )}

        {post.strategic_description && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">
              Descrição estratégica
            </p>
            <p className={`text-sm text-white/80 leading-relaxed ${!expanded ? 'line-clamp-3' : ''}`}>
              {post.strategic_description}
            </p>
            {post.strategic_description.length > 150 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[11px] text-[#bff720] hover:text-[#d4ff5c] mt-1 font-medium transition-colors"
              >
                {expanded ? 'Ver menos' : 'Ver mais →'}
              </button>
            )}
          </div>
        )}

        {post.post_result && (
          <div className={post.strategic_description ? 'pt-3 border-t border-white/5' : ''}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#bff720] mb-1.5">
              Resultado
            </p>
            <p className="text-sm text-white/80 leading-relaxed">{post.post_result}</p>
          </div>
        )}
      </div>

      <div className="px-6 pb-5 flex items-center justify-between gap-3">
        <a
          href={post.post_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-white/5 text-[#bff720] hover:bg-[#bff720]/10 border border-white/5 hover:border-[#bff720]/20 transition-all"
        >
          <ExternalLinkIcon className="h-3.5 w-3.5" /> Ver no Instagram
        </a>
        <p className="text-[9px] text-white/20 text-right leading-tight max-w-[180px]">
          Apenas dados públicos.
        </p>
      </div>
    </motion.div>
  );
}

export default function PublicPortfolioPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [igPosts, setIgPosts] = useState<IGPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  const heroInView = useInView(heroRef, { once: true });
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const DEMO_PROJECTS: Project[] = [
    { id: '1', title: 'Reel Institucional', description: 'Vídeo institucional para redes sociais', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail_url: '', category: 'Institucional', completed_at: null },
    { id: '2', title: 'Comercial Produto', description: 'Campanha publicitária para e-commerce', video_url: '', thumbnail_url: '', category: 'Publicitário', completed_at: null },
    { id: '3', title: 'Bastidores', description: 'Making of de produção', video_url: '', thumbnail_url: '', category: 'Social Media', completed_at: null },
  ];

  useEffect(() => {
    Promise.all([
      supabase.from('portfolio_projects').select('*').order('created_at', { ascending: false }),
      supabase.from('instagram_posts' as any).select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
    ]).then(([projectsRes, igRes]) => {
      const fetchedProjects = (projectsRes.data as Project[]) || [];
      setProjects(fetchedProjects.length > 0 ? fetchedProjects : DEMO_PROJECTS);
      setIgPosts(((igRes.data as any[]) || []) as IGPost[]);
      setLoading(false);
    });
  }, []);

  const categories = [...new Set(projects.map(p => p.category).filter(Boolean))];
  const filtered = filter === 'all' ? projects : projects.filter(p => p.category === filter);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-[#bff720]/30 selection:text-black overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-2xl bg-black/60 border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 md:h-18 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2">
            <img src={logoInova} alt="INOVA Co." className="h-7 brightness-0 invert" />
          </a>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
            <a href="#trabalhos" className="hover:text-[#bff720] transition-colors">Trabalhos</a>
            <a href="#servicos" className="hover:text-[#bff720] transition-colors">Serviços</a>
            <a href="#instagram" className="hover:text-[#bff720] transition-colors">Instagram</a>
            <a href="#contato" className="hover:text-[#bff720] transition-colors">Contato</a>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <a
              href="https://www.instagram.com/inovalab.mov/"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 hover:text-[#bff720] hover:border-[#bff720]/30 transition-all"
            >
              <Instagram className="h-4 w-4" />
            </a>
            <a
              href="https://api.whatsapp.com/send/?phone=5502481474167"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-semibold bg-[#bff720] text-black hover:bg-[#d4ff5c] transition-all hover:scale-[1.03]"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Fale conosco</span>
              <span className="sm:hidden">Contato</span>
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section id="top" ref={heroRef} className="relative pt-16 min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#015f57]/15 via-black to-black" />
          {/* Noise texture */}
          <div
            className="absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
              maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
            }}
          />
          <motion.div
            className="absolute top-1/3 left-1/4 h-[600px] w-[600px] rounded-full bg-[#015f57]/10 blur-[150px]"
            animate={{ x: [0, 60, 0], y: [0, -40, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/3 h-[400px] w-[400px] rounded-full bg-[#bff720]/8 blur-[120px]"
            animate={{ x: [0, -50, 0], y: [0, 50, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 text-center px-5 md:px-6 max-w-5xl mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#bff720]/25 bg-[#bff720]/[0.06] backdrop-blur-md text-xs font-medium text-[#bff720] mb-8 md:mb-10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#bff720] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#bff720]" />
              </span>
              Disponível para novos projetos
            </div>
          </motion.div>

          <motion.h1
            className="text-[2.75rem] sm:text-6xl md:text-7xl lg:text-[6rem] font-bold tracking-[-0.04em] leading-[0.95]"
            initial={{ opacity: 0, y: 40 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="text-white">Histórias que</span>
            <br />
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-[#bff720] via-[#d4ff5c] to-[#bff720] bg-clip-text text-transparent">
                encantam.
              </span>
              <motion.span
                className="absolute -bottom-2 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#bff720]/60 to-transparent"
                initial={{ scaleX: 0 }}
                animate={heroInView ? { scaleX: 1 } : {}}
                transition={{ duration: 1.2, delay: 0.8 }}
              />
            </span>
          </motion.h1>

          <motion.p
            className="mt-7 md:mt-9 text-base md:text-xl text-white/55 max-w-2xl mx-auto leading-relaxed font-light"
            initial={{ opacity: 0, y: 30 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            Somos uma produtora audiovisual que transforma ideias em narrativas que conectam marcas a pessoas — com estética, estratégia e alma.
          </motion.p>

          <motion.div
            className="mt-10 md:mt-12 flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.45 }}
          >
            <a
              href="https://api.whatsapp.com/send/?phone=5502481474167"
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-2 px-7 md:px-9 py-3.5 md:py-4 rounded-full text-sm font-bold bg-[#bff720] text-black hover:bg-[#d4ff5c] transition-all hover:scale-[1.04] shadow-[0_0_40px_rgba(191,247,32,0.25)]"
            >
              <MessageCircle className="h-4 w-4" />
              Solicitar orçamento
              <ArrowUpRight className="h-4 w-4 -ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
            <a
              href="#trabalhos"
              className="flex items-center gap-2 px-7 md:px-9 py-3.5 md:py-4 rounded-full text-sm font-semibold border border-white/10 text-white/80 hover:border-[#bff720]/40 hover:text-[#bff720] hover:bg-[#bff720]/[0.03] transition-all"
            >
              <Play className="h-4 w-4" fill="currentColor" /> Ver trabalhos
            </a>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">Role</span>
          <div className="h-10 w-6 rounded-full border border-white/15 flex items-start justify-center p-1.5">
            <motion.div
              className="h-2 w-1.5 rounded-full bg-[#bff720]/60"
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </section>

      {/* Stats Strip */}
      <section className="relative border-y border-white/[0.04] bg-gradient-to-b from-black via-[#015f57]/[0.04] to-black">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-12 md:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
            {STATS.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                  className="flex flex-col items-center text-center group"
                >
                  <div className="h-11 w-11 rounded-full bg-[#bff720]/10 border border-[#bff720]/20 flex items-center justify-center mb-3 group-hover:bg-[#bff720]/20 transition-colors">
                    <Icon className="h-5 w-5 text-[#bff720]" />
                  </div>
                  <div className="text-3xl md:text-5xl font-bold text-white tracking-tight">
                    {stat.value}
                  </div>
                  <div className="text-xs md:text-sm text-white/40 mt-1.5 uppercase tracking-wider">
                    {stat.label}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="servicos" className="relative max-w-7xl mx-auto px-5 md:px-8 py-24 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="max-w-2xl mb-14 md:mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.02] text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50 mb-5">
            <Sparkles className="h-3 w-3 text-[#bff720]" />
            O que fazemos
          </div>
          <h2 className="text-4xl md:text-6xl font-bold tracking-[-0.03em] leading-[1.05]">
            Audiovisual com<br />
            <span className="text-[#bff720]">propósito</span> e estratégia.
          </h2>
          <p className="mt-6 text-lg text-white/45 max-w-xl leading-relaxed">
            Da concepção à entrega final — produzimos conteúdo que comunica, emociona e gera resultado.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {SERVICES.map((service, i) => {
            const Icon = service.icon;
            return (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="group relative p-6 md:p-7 rounded-3xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.06] hover:border-[#bff720]/20 transition-all duration-500 overflow-hidden"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(191,247,32,0.08),_transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="h-12 w-12 rounded-2xl bg-[#bff720]/10 border border-[#bff720]/20 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:rotate-[-4deg] transition-transform duration-500">
                    <Icon className="h-5 w-5 text-[#bff720]" />
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight mb-2">
                    {service.title}
                  </h3>
                  <p className="text-sm text-white/45 leading-relaxed">
                    {service.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Filter */}
      <div id="trabalhos" className="scroll-mt-20" />
      {categories.length > 1 && (
        <section className="sticky top-16 z-40 backdrop-blur-2xl bg-black/85 border-y border-white/[0.04]">
          <div className="max-w-7xl mx-auto px-5 md:px-8 py-4 flex items-center gap-4">
            <span className="hidden md:inline-block text-[10px] uppercase tracking-[0.2em] text-white/35 font-semibold shrink-0">
              Filtrar
            </span>
            <div className="flex gap-2 overflow-x-auto scrollbar-none flex-1">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${filter === 'all' ? 'bg-[#bff720] text-black' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'}`}
              >
                Todos
                <span className="ml-2 opacity-60">{projects.length}</span>
              </button>
              {categories.map(c => {
                const count = projects.filter(p => p.category === c).length;
                return (
                  <button
                    key={c}
                    onClick={() => setFilter(c)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${filter === c ? 'bg-[#bff720] text-black' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'}`}
                  >
                    {CATEGORIES_LABELS[c] || c}
                    <span className="ml-2 opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Projects */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 md:mb-16"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.02] text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50 mb-5">
              <Film className="h-3 w-3 text-[#bff720]" />
              Portfólio
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-[-0.03em] leading-[1.05]">
              Trabalhos<br />
              <span className="text-[#bff720]">selecionados.</span>
            </h2>
          </div>
          <p className="text-white/45 max-w-sm md:text-right leading-relaxed">
            Uma seleção dos nossos projetos mais recentes — produzidos com carinho do briefing à entrega.
          </p>
        </motion.div>

        {loading ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="aspect-[4/5] rounded-3xl bg-gradient-to-b from-white/[0.04] to-transparent animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-white/25">
            <Film className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-xl font-medium">Nenhum projeto disponível ainda</p>
            <p className="text-sm mt-2 text-white/15">Volte em breve para conferir nossos trabalhos</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 auto-rows-auto">
            {filtered.map((p, i) => (
              <ProjectCard
                key={p.id}
                project={p}
                index={i}
                onClick={() => setSelectedProject(p)}
                featured={false}
              />
            ))}
          </div>
        )}
      </section>

      {/* Instagram Posts Section */}
      {igPosts.length > 0 && (
        <section id="instagram" className="relative max-w-7xl mx-auto px-5 md:px-8 py-24 md:py-32 border-t border-white/[0.04]">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center mb-14 md:mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#bff720]/20 bg-[#bff720]/[0.05] text-[10px] font-semibold uppercase tracking-[0.2em] text-[#bff720] mb-5">
              <Instagram className="h-3 w-3" />
              Em destaque
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-[-0.03em] leading-[1.05]">
              Conteúdos que<br />
              <span className="text-[#bff720]">performam.</span>
            </h2>
            <p className="mt-6 text-white/45 max-w-xl mx-auto leading-relaxed">
              Posts reais publicados nas redes dos nossos clientes — com dados públicos e contexto estratégico.
            </p>
          </motion.div>

          <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3">
            {igPosts.map((post, i) => (
              <InstagramPostCard key={post.id} post={post} index={i} />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-12 text-center"
          >
            <p className="text-[11px] text-white/20 max-w-lg mx-auto leading-relaxed">
              Este conteúdo exibe apenas dados públicos do Instagram. Métricas como alcance, impressões e conversões não estão incluídas.
            </p>
          </motion.div>
        </section>
      )}

      {/* CTA Section */}
      <section id="contato" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#015f57]/20 via-black to-[#bff720]/[0.04]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(191,247,32,0.08)_0%,_transparent_70%)]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
          }}
        />

        <div className="relative max-w-4xl mx-auto px-5 md:px-8 py-28 md:py-40 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#bff720]/25 bg-[#bff720]/[0.06] text-[10px] font-semibold uppercase tracking-[0.2em] text-[#bff720] mb-7">
              <Sparkles className="h-3 w-3" />
              Vamos conversar
            </div>
          </motion.div>

          <motion.h2
            className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-[-0.04em] leading-[0.95]"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            Vamos criar algo<br />
            <span className="text-[#bff720]">incrível</span> juntos?
          </motion.h2>
          <motion.p
            className="mt-7 text-white/45 text-base md:text-lg max-w-lg mx-auto leading-relaxed"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Conte sua ideia. Respondemos em até 24h com um plano sob medida para sua marca.
          </motion.p>
          <motion.div
            className="mt-10 md:mt-12 flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <a
              href="https://api.whatsapp.com/send/?phone=5502481474167"
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-2 px-8 md:px-10 py-4 rounded-full text-sm font-bold bg-[#bff720] text-black hover:bg-[#d4ff5c] transition-all hover:scale-[1.04] shadow-[0_0_40px_rgba(191,247,32,0.25)]"
            >
              <MessageCircle className="h-4 w-4" /> Solicitar orçamento
              <ArrowUpRight className="h-4 w-4 -ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
            <a
              href="https://www.instagram.com/inovalab.mov/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-8 md:px-10 py-4 rounded-full text-sm font-semibold border border-white/10 text-white/70 hover:border-[#bff720]/30 hover:text-[#bff720] transition-all"
            >
              <Instagram className="h-4 w-4" /> @inovalab.mov
            </a>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] py-10 md:py-12">
        <div className="max-w-7xl mx-auto px-5 md:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <img src={logoInova} alt="INOVA Co." className="h-5 brightness-0 invert opacity-30" />
          <div className="flex items-center gap-5">
            <a href="https://www.instagram.com/inovalab.mov/" target="_blank" rel="noreferrer" aria-label="Instagram" className="text-white/25 hover:text-[#bff720] transition-colors">
              <Instagram className="h-4 w-4" />
            </a>
            <a href="https://api.whatsapp.com/send/?phone=5502481474167" target="_blank" rel="noreferrer" aria-label="WhatsApp" className="text-white/25 hover:text-[#bff720] transition-colors">
              <MessageCircle className="h-4 w-4" />
            </a>
          </div>
          <p className="text-xs text-white/20 text-center md:text-right">
            © {new Date().getFullYear()} INOVA Co. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      {/* Video Modal */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-5 md:p-8"
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
                className="absolute -top-12 right-0 h-10 w-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/60 hover:bg-[#bff720]/10 hover:text-[#bff720] hover:border-[#bff720]/30 transition-all"
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
                  <p className="text-white/30">Sem vídeo disponível</p>
                </div>
              )}
              <div className="mt-6">
                {selectedProject.category && (
                  <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold tracking-widest uppercase bg-[#bff720]/10 text-[#bff720] border border-[#bff720]/20 mb-3">
                    {selectedProject.category}
                  </span>
                )}
                <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{selectedProject.title}</h3>
                {selectedProject.description && <p className="text-white/50 mt-2 max-w-2xl">{selectedProject.description}</p>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
