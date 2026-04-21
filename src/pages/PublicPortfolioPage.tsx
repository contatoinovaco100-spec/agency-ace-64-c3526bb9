import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Play, X, Instagram, ArrowRight, Film, Sparkles, MessageCircle } from 'lucide-react';
import logoInova from '@/assets/logo-inova.png';

interface Project {
  id: string; title: string; description: string; video_url: string;
  thumbnail_url: string; category: string; completed_at: string | null;
}

const CATEGORIES_LABELS: Record<string, string> = {
  'Institucional': 'Institucional', 'Publicitário': 'Publicitário',
  'Social Media': 'Social Media', 'Documentário': 'Documentário',
  'Evento': 'Evento', 'Motion Graphics': 'Motion', 'Outro': 'Outro',
};

function getVideoEmbed(url: string) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1`;
  return null;
}

function getVideoThumb(url: string) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/maxresdefault.jpg`;
  return null;
}

function ProjectCard({ project, index, onClick }: { project: Project; index: number; onClick: () => void }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const thumb = project.thumbnail_url || getVideoThumb(project.video_url);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 60 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="group relative cursor-pointer overflow-hidden rounded-2xl"
      onClick={onClick}
    >
      <div className="aspect-video relative overflow-hidden bg-[#0a0a0a]">
        {thumb ? (
          <img src={thumb} alt={project.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#015f57]/30 to-black flex items-center justify-center">
            <Film className="h-16 w-16 text-white/15" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-500" />
        
        {project.video_url && (
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#bff720]/20 backdrop-blur-md border border-[#bff720]/30 text-[#bff720] opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:scale-100 scale-75">
              <Play className="h-7 w-7 ml-1" fill="#bff720" />
            </motion.div>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-5 translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
          {project.category && (
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold tracking-widest uppercase bg-[#bff720]/10 backdrop-blur-md text-[#bff720]/80 mb-2">
              {project.category}
            </span>
          )}
          <h3 className="text-xl font-bold text-white leading-tight">{project.title}</h3>
          {project.description && (
            <p className="text-sm text-white/50 mt-1 line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500">{project.description}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function PublicPortfolioPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const heroRef = useRef(null);
  const heroInView = useInView(heroRef, { once: true });

  const DEMO_PROJECTS: Project[] = [
    { id: '1', title: 'Reel Institucional', description: 'Vídeo institucional para redes sociais', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail_url: '', category: 'Institucional', completed_at: null },
    { id: '2', title: 'Comercial Produto', description: 'Campanha publicitária para e-commerce', video_url: '', thumbnail_url: '', category: 'Publicitário', completed_at: null },
    { id: '3', title: 'Bastidores', description: 'Making of de produção', video_url: '', thumbnail_url: '', category: 'Social Media', completed_at: null },
  ];

  useEffect(() => {
    supabase.from('portfolio_projects').select('*').order('created_at', { ascending: false })
      .then(({ data, error }) => { 
        if (error) console.error('Erro ao carregar projetos:', error);
        const fetchedProjects = (data as Project[]) || [];
        setProjects(fetchedProjects.length > 0 ? fetchedProjects : DEMO_PROJECTS); 
        setLoading(false); 
      });
  }, []);

  const categories = [...new Set(projects.map(p => p.category).filter(Boolean))];
  const filtered = filter === 'all' ? projects : projects.filter(p => p.category === filter);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-[#bff720]/30 selection:text-black">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/70 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <img src={logoInova} alt="INOVA Co." className="h-7 brightness-0 invert" />
          <div className="flex items-center gap-3">
            <a
              href="https://www.instagram.com/inovalab.mov/"
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 hover:text-[#bff720] hover:border-[#bff720]/30 transition-all"
            >
              <Instagram className="h-4 w-4" />
            </a>
            <a
              href="https://api.whatsapp.com/send/?phone=5502481474167"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold bg-[#bff720] text-black hover:bg-[#d4ff5c] transition-colors"
            >
              <MessageCircle className="h-4 w-4" /> Fale conosco
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section ref={heroRef} className="relative pt-16 min-h-[80vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#015f57]/10 via-black to-black" />
          <motion.div
            className="absolute top-1/3 left-1/4 h-[600px] w-[600px] rounded-full bg-[#015f57]/8 blur-[150px]"
            animate={{ x: [0, 60, 0], y: [0, -40, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/3 h-[400px] w-[400px] rounded-full bg-[#bff720]/5 blur-[120px]"
            animate={{ x: [0, -50, 0], y: [0, 50, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#bff720]/20 bg-[#bff720]/5 backdrop-blur-md text-xs font-medium text-[#bff720]/70 mb-10">
              <Sparkles className="h-3.5 w-3.5 text-[#bff720]" />
              Produtora Audiovisual
            </div>
          </motion.div>

          <motion.h1
            className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight leading-[0.9]"
            initial={{ opacity: 0, y: 40 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="text-white">
              Histórias que
            </span>
            <br />
            <span className="text-[#bff720]">
              encantam
            </span>
          </motion.h1>

          <motion.p
            className="mt-8 text-lg md:text-xl text-white/35 max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 30 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            Transformamos ideias em produções audiovisuais que conectam marcas a pessoas.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.45 }}
          >
            <a
              href="https://api.whatsapp.com/send/?phone=5502481474167"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-8 py-3.5 rounded-full text-sm font-bold bg-[#bff720] text-black hover:bg-[#d4ff5c] transition-all hover:scale-105 shadow-[0_0_30px_rgba(191,247,32,0.2)]"
            >
              <MessageCircle className="h-4 w-4" /> Solicitar orçamento
            </a>
            <a
              href="https://www.instagram.com/inovalab.mov/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-8 py-3.5 rounded-full text-sm font-semibold border border-white/10 text-white/70 hover:border-[#bff720]/30 hover:text-[#bff720] transition-all"
            >
              <Instagram className="h-4 w-4" /> @inovalab.mov
            </a>
          </motion.div>

          <motion.div
            className="mt-16 flex items-center justify-center gap-8 text-sm text-white/20"
            initial={{ opacity: 0 }}
            animate={heroInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <span>{projects.length} projetos</span>
            <span className="h-1 w-1 rounded-full bg-[#bff720]/30" />
            <span>{categories.length} categorias</span>
          </motion.div>
        </div>

        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="h-10 w-6 rounded-full border border-white/15 flex items-start justify-center p-1.5">
            <motion.div
              className="h-2 w-1.5 rounded-full bg-[#bff720]/50"
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </section>

      {/* Filter */}
      {categories.length > 1 && (
        <section className="sticky top-16 z-40 backdrop-blur-xl bg-black/80 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 py-4 flex gap-2 overflow-x-auto">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${filter === 'all' ? 'bg-[#bff720] text-black' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'}`}
            >
              Todos
            </button>
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${filter === c ? 'bg-[#bff720] text-black' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'}`}
              >
                {CATEGORIES_LABELS[c] || c}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Projects */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        {loading ? (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[1,2,3].map(i => (
              <div key={i} className="aspect-video rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-white/25">
            <Film className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-xl font-medium">Nenhum projeto disponível ainda</p>
            <p className="text-sm mt-2 text-white/15">Volte em breve para conferir nossos trabalhos</p>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p, i) => (
              <ProjectCard key={p.id} project={p} index={i} onClick={() => setSelectedProject(p)} />
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#015f57]/15 to-[#bff720]/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(191,247,32,0.06)_0%,_transparent_70%)]" />
        <div className="relative max-w-4xl mx-auto px-6 py-28 text-center">
          <motion.h2
            className="text-3xl md:text-5xl font-bold leading-tight"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            Vamos criar algo{' '}
            <span className="text-[#bff720]">incrível</span>{' '}
            juntos?
          </motion.h2>
          <motion.p
            className="mt-5 text-white/30 text-lg max-w-lg mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Entre em contato e transforme sua visão em realidade audiovisual
          </motion.p>
          <motion.div
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <a
              href="https://api.whatsapp.com/send/?phone=5502481474167"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-8 py-3.5 rounded-full text-sm font-bold bg-[#bff720] text-black hover:bg-[#d4ff5c] transition-all hover:scale-105 shadow-[0_0_30px_rgba(191,247,32,0.15)]"
            >
              <MessageCircle className="h-4 w-4" /> Solicitar orçamento
            </a>
            <a
              href="https://www.instagram.com/inovalab.mov/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-8 py-3.5 rounded-full text-sm font-semibold border border-white/10 text-white/60 hover:border-[#bff720]/30 hover:text-[#bff720] transition-all"
            >
              <Instagram className="h-4 w-4" /> @inovalab.mov
            </a>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <img src={logoInova} alt="INOVA Co." className="h-5 brightness-0 invert opacity-30" />
          <div className="flex items-center gap-5">
            <a href="https://www.instagram.com/inovalab.mov/" target="_blank" rel="noreferrer" className="text-white/25 hover:text-[#bff720] transition-colors">
              <Instagram className="h-4 w-4" />
            </a>
            <a href="https://api.whatsapp.com/send/?phone=5502481474167" target="_blank" rel="noreferrer" className="text-white/25 hover:text-[#bff720] transition-colors">
              <MessageCircle className="h-4 w-4" />
            </a>
          </div>
          <p className="text-xs text-white/20">© {new Date().getFullYear()} INOVA Co. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Video Modal */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedProject(null)}
          >
            <motion.div
              className="relative w-full max-w-5xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedProject(null)}
                className="absolute -top-12 right-0 p-2 text-white/40 hover:text-[#bff720] transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
              {selectedProject.video_url && getVideoEmbed(selectedProject.video_url) ? (
                <div className="aspect-video rounded-xl overflow-hidden bg-black ring-1 ring-white/5">
                  <iframe
                    src={getVideoEmbed(selectedProject.video_url)!}
                    className="h-full w-full"
                    allowFullScreen
                    allow="autoplay; encrypted-media"
                  />
                </div>
              ) : (
                <div className="aspect-video rounded-xl overflow-hidden bg-white/5 flex items-center justify-center">
                  <p className="text-white/30">Sem vídeo disponível</p>
                </div>
              )}
              <div className="mt-5">
                <h3 className="text-xl font-bold text-white">{selectedProject.title}</h3>
                {selectedProject.description && <p className="text-white/40 mt-1">{selectedProject.description}</p>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
