import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, Link } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2 as Spinner, CheckCircle2, AlertCircle, Sparkles, 
  Target, Zap, TrendingUp, ArrowRight, ArrowLeft 
} from 'lucide-react';
import LogoInova from '@/assets/logo-inova.png';
import { useAuth } from '@/contexts/AuthContext';

/* ═══════ THEME COLORS ═══════ */
const THEMES: Record<string, { primary: string; primaryDark: string }> = {
  teal: { primary: '#0D6E5E', primaryDark: '#095045' },
  burgundy: { primary: '#3A0A1E', primaryDark: '#2A0616' },
  black: { primary: '#000000', primaryDark: '#111111' },
};

export default function DiagnosticLP() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const fetchDiagnostic = async () => {
      try {
        if (slug) {
          const { data, error } = await supabase
            .from('diagnostics' as any)
            .select('*')
            .eq('slug', slug)
            .maybeSingle();
          
          if (data && (data as any).config) {
            setConfig((data as any).config);
            setLoading(false);
            return;
          }
        }
        // Fallback for demo
        const saved = localStorage.getItem('agency_diagnostic_config_v4');
        if (saved) { setConfig(JSON.parse(saved)); }
      } catch (err) {
        console.error('Erro ao buscar diagnóstico:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDiagnostic();

    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      const currentScroll = window.scrollY;
      setScrollProgress((currentScroll / totalScroll) * 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [slug]);

  if (loading) return (
    <div className="flex h-screen w-full items-center justify-center bg-[#0a0a0a]">
      <Spinner className="h-8 w-8 animate-spin text-[#bff720]" />
    </div>
  );

  if (!config) return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-[#F5F3EE] text-center p-6 text-gray-800">
      <h1 className="text-2xl font-bold text-[#3A0A1E] mb-4 uppercase tracking-tighter">Diagnóstico não encontrado</h1>
      <p className="opacity-50 mb-8 max-w-md">O link que você seguiu pode estar quebrado ou o diagnóstico foi removido.</p>
      <Link to="/diagnostico/editar" className="bg-[#0D6E5E] text-white px-8 py-3 rounded-full font-black uppercase tracking-widest text-[10px] hover:bg-[#095045] transition-all shadow-xl shadow-[#0D6E5E]/20">
        Criar meu Diagnóstico
      </Link>
    </div>
  );

  const currentTheme = THEMES[config.cliente?.tema] || THEMES.teal;
  const theme = {
    primary: config.cliente?.primaryColor || currentTheme.primary,
    primaryDark: config.cliente?.primaryColor || currentTheme.primaryDark
  };
  const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };

  return (
    <div className="min-h-screen bg-[#F5F3EE] overflow-x-hidden selection:bg-[#bff720] selection:text-black text-left scroll-smooth"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* PROGRESS BAR */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 bg-[#bff720] z-50 origin-left"
        style={{ scaleX: scrollProgress / 100 }}
      />

      {/* PAGE 1 — HERO COVER */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-10 py-20 relative overflow-hidden" style={{ background: theme.primary }}>
        {/* Animated Grid Background */}
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        
        {/* Floating Particles */}
        {[...Array(6)].map((_, i) => (
          <motion.div key={i} className="absolute w-2 h-2 bg-[#bff720] rounded-full" 
            initial={{ opacity: 0, scale: 0 }} animate={{ opacity: [0, 1, 0], scale: [0, 1, 0], x: [0, 100, 200], y: [0, -50, 0] }}
            transition={{ duration: 4, repeat: Infinity, delay: i * 0.5, ease: "easeInOut" }}
            style={{ left: `${15 + i * 15}%`, top: `${20 + (i % 3) * 25}%` }}
          />
        ))}
        
        <motion.img initial={{ opacity: 0, y: -30, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 1, ease: "easeOut" }}
          src={LogoInova} className="h-12 mb-20 relative z-10 brightness-0 invert opacity-80" alt="Inova" />
        
        <motion.div initial={{ opacity: 0, scale: 0.8, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 1.2, ease: "easeOut" }}
          className="relative w-full max-w-5xl mx-auto">
          
          {/* Glow Effect Behind */}
          <div className="absolute -inset-20 bg-[#bff720]/20 blur-[100px] rounded-full" />
          
          {/* Decorative Elements */}
          <div className="absolute -left-16 -top-16 text-[#bff720] text-8xl font-black select-none animate-pulse" style={{ transform: 'rotate(-15deg)' }}>
            <motion.span animate={{ rotate: [-15, -10, -15], scale: [1, 1.1, 1] }} transition={{ duration: 3, repeat: Infinity }}>✳</motion.span>
          </div>
          
          {/* Main Title Box */}
          <div className="bg-black px-8 py-8 lg:px-16 lg:py-12 inline-block w-full shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
            <h1 className="text-white text-[clamp(2.5rem,12vw,7rem)] font-black tracking-[-2px] lg:tracking-[-4px] leading-[0.9] uppercase relative z-10">
              diagnóstico
            </h1>
          </div>
          
          {/* Accent Elements */}
          <motion.div className="absolute -right-8 -bottom-8 text-white/10 text-6xl select-none" style={{ transform: 'rotate(15deg)' }}>
            <motion.span animate={{ rotate: [15, 20, 15] }} transition={{ duration: 4, repeat: Infinity }}>✳</motion.span>
          </motion.div>
          
          {/* Line Decorations */}
          <div className="absolute -right-20 top-1/2 w-32 h-[2px] bg-gradient-to-r from-[#bff720] to-transparent opacity-50" />
          <div className="absolute -left-20 top-1/3 w-32 h-[2px] bg-gradient-to-l from-white/30 to-transparent opacity-50" />
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.8, duration: 0.8 }}
          className="mt-20 space-y-8 relative z-10">
          <div className="inline-flex items-center gap-6 px-10 py-4 bg-white/10 rounded-full backdrop-blur-xl border border-white/10">
              <div className="w-2 h-2 bg-[#bff720] rounded-full animate-pulse" />
              <p className="text-[11px] font-black text-[#bff720] tracking-[0.9em] uppercase">
                @{config.cliente.nome.replace('@','')}
              </p>
              <div className="w-16 h-[1px] bg-white/20" />
              <p className="text-[10px] font-bold text-white/60 tracking-[0.3em] uppercase">
                Maturidade Estratégica
              </p>
          </div>
          
          <p className="text-xs text-white/40 tracking-[0.6em] font-medium uppercase max-w-lg mx-auto leading-relaxed">
            Análise completa de performance digital<br />
            <span className="text-[#bff720]">&</span> recomendações estratégicas
          </p>
          
          {/* Scroll Indicator */}
          <motion.div 
            animate={{ y: [0, 15, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="pt-16"
          >
            <div className="flex flex-col items-center gap-2">
              <span className="text-[8px] font-black text-white/20 tracking-widest uppercase">Scroll</span>
              <div className="w-px h-16 bg-gradient-to-b from-[#bff720] to-transparent" />
            </div>
          </motion.div>
        </motion.div>

        {/* Background Effects */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3 blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#bff720]/10 rounded-full translate-y-1/3 -translate-x-1/3 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-white/5 rounded-full" style={{ transform: 'translate(-50%, -50%)' }} />
      </section>

      {/* PAGE 2 — OVERVIEW & RADAR */}
      <section className="min-h-[90vh] flex flex-col justify-center px-6 lg:px-24 py-24 bg-[#F5F3EE] relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #d4c9b0 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center relative z-10">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="space-y-12">
                <div className="space-y-6">
                    <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                        className="inline-flex items-center gap-3 px-4 py-2 bg-[#0D6E5E]/10 rounded-full">
                        <div className="w-2 h-2 bg-[#0D6E5E] rounded-full animate-pulse" />
                        <span className="text-[9px] font-black uppercase tracking-[5px] text-[#0D6E5E]">Introdução</span>
                    </motion.div>
                    <h2 className="text-5xl lg:text-7xl font-black text-black leading-[0.95] uppercase tracking-tighter">
                        Panorama<br /><span className="text-[#0D6E5E]">Digital</span>
                    </h2>
                </div>
                <p className="text-lg lg:text-xl text-black/65 leading-relaxed font-medium max-w-md">
                    {config.intro.texto}
                </p>
                <div className="flex items-center gap-6 pt-4">
                    <div className="flex -space-x-3">
                        {[1,2,3].map(i => (
                            <motion.div key={i} initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                                className="w-12 h-12 rounded-full border-4 border-[#F5F3EE] bg-gray-100 flex items-center justify-center" />
                        ))}
                    </div>
                    <div className="flex flex-col justify-center text-left">
                        <p className="text-[9px] font-black uppercase tracking-widest text-black/25 leading-none">Analisado por</p>
                        <p className="text-base font-bold text-black">Especialistas Inova Co.</p>
                    </div>
                </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.85, y: 30 }} whileInView={{ opacity: 1, scale: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="relative">
                <div className="absolute -inset-16 bg-gradient-to-br from-[#0D6E5E]/10 to-transparent blur-3xl rounded-full" />
                <div className="absolute inset-0 bg-gradient-to-br from-white to-gray-50 rounded-[60px] transform rotate-1" />
                <div className="relative bg-white p-10 lg:p-14 rounded-[50px] shadow-2xl border border-[#e8e4dc] space-y-10 transform -rotate-1 transition-transform hover:rotate-0">
                    <div className="grid grid-cols-2 gap-8 lg:gap-12">
                        {[
                            { label: 'Posicionamento', val: config.scores.posicionamento, icon: Target, color: '#0D6E5E' },
                            { label: 'Autoridade', val: config.scores.autoridade, icon: Sparkles, color: '#3A0A1E' },
                            { label: 'Presença Digital', val: config.scores.presenca, icon: Zap, color: '#bff720' },
                            { label: 'Conversão', val: config.scores.conversao, icon: TrendingUp, color: '#6a11cb' },
                        ].map((s, idx) => (
                            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.1 }} className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <motion.div whileHover={{ scale: 1.1, rotate: 5 }} className="p-2.5 rounded-2xl bg-gray-50 text-gray-600">
                                        <s.icon size={18} />
                                    </motion.div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-black/35 leading-tight">{s.label}</span>
                                </div>
                                <div className="flex items-baseline gap-1.5">
                                    <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="text-5xl lg:text-6xl font-black text-black tracking-tighter">{s.val}</motion.span>
                                    <span className="text-lg font-bold text-black/25">%</span>
                                </div>
                                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} whileInView={{ width: `${s.val}%` }} transition={{ duration: 1, delay: idx * 0.15, ease: "easeOut" }}
                                        className="h-full rounded-full" style={{ backgroundColor: s.color }} />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 }}
                        className="pt-8 border-t border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[4px] text-black/30">Maturidade Geral</p>
                            <p className="text-3xl font-black text-black uppercase tracking-tight">
                                {Math.round((config.scores.posicionamento + config.scores.presenca + config.scores.autoridade + config.scores.conversao) / 4)}%
                            </p>
                        </div>
                        <motion.div whileHover={{ scale: 1.05 }} className="bg-[#bff720] text-black text-[9px] font-black uppercase tracking-widest px-5 py-3 rounded-full shadow-xl shadow-[#bff720]/30">
                            Verificado
                        </motion.div>
                    </motion.div>
                </div>
            </motion.div>
        </div>
      </section>

      {/* PAGE 3 — INSIGHTS (POSITIVOS / NEGATIVOS) */}
      <section className="min-h-screen flex items-center px-6 lg:px-24 py-32 relative overflow-hidden" style={{ background: theme.primary }}>
        {/* Animated Background Elements */}
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 relative z-10">
            
            <div className="lg:col-span-12 mb-12 lg:mb-24 text-center relative">
                 <motion.h2 initial={{ opacity: 0, y: -30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    className="text-[clamp(3rem,18vw,12rem)] font-black text-white/5 uppercase tracking-tighter leading-none absolute -top-8 lg:-top-16 left-1/2 -translate-x-1/2 w-full select-none pointer-events-none">INSIGHTS</motion.h2>
                 <h3 className="text-5xl lg:text-9xl font-black text-white uppercase tracking-tighter relative z-10 italic">
                    Insight<span className="text-[#bff720]">.</span>
                 </h3>
            </div>

            {/* Positivos column */}
            <div className="lg:col-span-6 space-y-10">
                <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="flex items-center gap-5">
                    <div className="w-16 h-[2px] bg-[#bff720]" />
                    <h4 className="text-[10px] font-black uppercase tracking-[6px] text-[#bff720]">Pontos de Força</h4>
                </motion.div>
                <div className="grid gap-5">
                    {config.positivos.map((p: string, i: number) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}
                            whileHover={{ x: 10, scale: 1.02 }}
                            className="bg-white/[0.08] border border-white/[0.1] p-8 rounded-[40px] group hover:bg-white/[0.12] hover:border-[#bff720]/30 transition-all duration-500 cursor-pointer">
                            <div className="flex gap-6 items-start">
                                <motion.div whileHover={{ rotate: 360 }} className="w-12 h-12 rounded-2xl bg-[#bff720]/15 flex items-center justify-center text-[#bff720] shrink-0">
                                    <CheckCircle2 size={22} />
                                </motion.div>
                                <p className="text-lg lg:text-xl font-bold text-white/85 leading-snug pt-1.5">{p}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Negativos column */}
            <div className="lg:col-span-6 space-y-10">
                <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="flex items-center gap-5">
                    <div className="w-16 h-[2px] bg-white/20" />
                    <h4 className="text-[10px] font-black uppercase tracking-[6px] text-white/40">Gargalos de Conversão</h4>
                </motion.div>
                <div className="grid gap-5">
                    {config.negativos.map((n: string, i: number) => (
                        <motion.div key={i} initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}
                            whileHover={{ x: -10, scale: 1.02 }}
                            className="bg-black/[0.25] border border-white/[0.08] p-8 rounded-[40px] group hover:bg-black/[0.35] hover:border-white/20 transition-all duration-500 cursor-pointer">
                            <div className="flex gap-6 items-start">
                                <motion.div whileHover={{ scale: 1.1 }} className="w-12 h-12 rounded-2xl bg-white/[0.08] flex items-center justify-center text-white/25 shrink-0">
                                    <AlertCircle size={22} />
                                </motion.div>
                                <p className="text-lg lg:text-xl font-bold text-white/[0.55] leading-snug pt-1.5">{n}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>

        {/* Background artifacts */}
        <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-[#bff720]/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-black/20 rounded-full blur-[120px] pointer-events-none" />
      </section>

      {/* SEÇÃO IA: AUDITORIA DE PERFIL (Condicional) */}
      {config.aiAnalise && (
        <section className="min-h-[80vh] px-6 lg:px-24 py-28 bg-white border-y border-gray-100 overflow-hidden relative">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #000 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            
            <div className="max-w-7xl mx-auto space-y-20">
                
                {/* Print da Análise (Novo) */}
                {config.aiAnalise.analysisImageUrl && (
                  <motion.div initial={{ opacity: 0, scale: 0.95, y: 30 }} whileInView={{ opacity: 1, scale: 1, y: 0 }} viewport={{ once: true }} className="space-y-10">
                      <div className="text-center space-y-5">
                          <motion.div initial={{ opacity: 0, y: -10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                            className="inline-flex items-center gap-3 px-4 py-2 bg-[#0D6E5E]/10 rounded-full">
                              <div className="w-2 h-2 bg-[#0D6E5E] rounded-full animate-pulse" />
                              <span className="text-[9px] font-black uppercase tracking-[5px] text-[#0D6E5E]">Evidência Visual</span>
                          </motion.div>
                          <h2 className="text-4xl lg:text-6xl font-black text-black uppercase tracking-tighter">Print da Análise</h2>
                      </div>
                      <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
                        className="relative max-w-5xl mx-auto rounded-[50px] overflow-hidden shadow-2xl border-8 border-gray-100 group">
                          <img src={config.aiAnalise.analysisImageUrl} alt="Print da Análise" className="w-full h-auto grayscale-[0.15] group-hover:grayscale-0 transition-all duration-700" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 0.5 }} className="absolute bottom-6 right-6 px-4 py-2 bg-black/80 backdrop-blur-md rounded-full">
                            <span className="text-[9px] font-black text-white uppercase tracking-widest">Análise IA</span>
                          </motion.div>
                      </motion.div>
                  </motion.div>
                )}

                <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center space-y-5">
                    <div className="inline-flex items-center gap-3 px-5 py-2 bg-black rounded-full">
                        <Sparkles className="text-[#bff720]" size={14} />
                        <span className="text-[9px] font-black uppercase tracking-[5px] text-white">Auditoria Detalhada</span>
                    </div>
                    <h2 className="text-5xl lg:text-7xl font-black text-black uppercase tracking-tighter leading-[0.95]">Análise de Perfil</h2>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
                    {/* Bio Audit */}
                    <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                        className="bg-gradient-to-br from-gray-50 to-white rounded-[50px] p-10 lg:p-12 border border-gray-100 shadow-xl">
                        <div className="flex items-center gap-5 mb-8">
                            <motion.div whileHover={{ rotate: 180, scale: 1.1 }} className="p-4 bg-black rounded-2xl">
                                <Sparkles className="text-[#bff720]" size={26} />
                            </motion.div>
                            <h3 className="text-2xl lg:text-3xl font-black text-black">Audit da Biografia</h3>
                        </div>
                        <div className="space-y-5">
                            {config.aiAnalise.bioPositivos?.map((p: string, i: number) => (
                                <motion.div key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                                    className="flex gap-4 text-base font-bold text-black/70 items-start">
                                    <CheckCircle2 className="text-[#0D6E5E] shrink-0 mt-0.5" size={20} /> 
                                    <span>{p}</span>
                                </motion.div>
                            ))}
                            {config.aiAnalise.bioNegativos?.map((n: string, i: number) => (
                                <motion.div key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                                    className="flex gap-4 text-base font-medium text-black/40 italic items-start">
                                    <AlertCircle className="text-black/20 shrink-0 mt-0.5" size={20} /> 
                                    <span>{n}</span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Presence Audit */}
                    <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
                        className="bg-gradient-to-br from-black to-gray-900 rounded-[50px] p-10 lg:p-12 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[#bff720]/5 rounded-full blur-[80px]" />
                        <div className="flex items-center gap-5 mb-8 relative z-10">
                            <motion.div whileHover={{ rotate: -180, scale: 1.1 }} className="p-4 bg-[#bff720] rounded-2xl">
                                <Sparkles className="text-black" size={26} />
                            </motion.div>
                            <h3 className="text-2xl lg:text-3xl font-black text-white">Análise Visual</h3>
                        </div>
                        <div className="space-y-5 relative z-10">
                            {config.aiAnalise.presencaPositivos?.map((p: string, i: number) => (
                                <motion.div key={i} initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                                    className="flex gap-4 text-base font-bold text-white/80 items-start">
                                    <CheckCircle2 className="text-[#bff720] shrink-0 mt-0.5" size={20} /> 
                                    <span>{p}</span>
                                </motion.div>
                            ))}
                            {config.aiAnalise.presencaNegativos?.map((n: string, i: number) => (
                                <motion.div key={i} initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                                    className="flex gap-4 text-base font-medium text-white/35 italic items-start">
                                    <AlertCircle className="text-white/15 shrink-0 mt-0.5" size={20} /> 
                                    <span>{n}</span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
      )}

      {/* PAGE 4 — VEREDITO & PLANO DE AÇÃO */}
      <section className="min-h-screen px-6 lg:px-24 py-32 bg-black flex flex-col items-center justify-center text-center overflow-hidden relative">
            {/* Animated Grid Background */}
            <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
            <motion.div animate={{ opacity: [0.05, 0.1, 0.05] }} transition={{ duration: 4, repeat: Infinity }} className="absolute inset-0 bg-gradient-to-b from-[#bff720]/5 to-transparent" />
            
            <div className="max-w-5xl space-y-20 relative z-10">
                <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="space-y-10">
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                        className="inline-flex items-center gap-4 px-6 py-3 bg-[#bff720]/10 border border-[#bff720]/20 rounded-full">
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-2 h-2 bg-[#bff720] rounded-full" />
                        <span className="text-sm font-black text-[#bff720] uppercase tracking-[8px]">O Veredito Final</span>
                    </motion.div>
                    <h2 className="text-6xl lg:text-9xl font-black text-white uppercase tracking-tighter leading-[0.88]">
                        {config.final.destaque}
                    </h2>
                    <p className="text-xl lg:text-3xl font-light text-white/35 max-w-4xl mx-auto italic leading-relaxed">
                        "{config.final.texto}"
                    </p>
                </motion.div>

                <div className="grid gap-5 text-left max-w-4xl mx-auto">
                    {[1,2,3,4,5].map(i => config.final[`acao${i}`] ? (
                        <motion.div key={i} initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                            whileHover={{ x: 15, scale: 1.01 }}
                            className="group flex items-center bg-white/[0.04] border border-white/[0.08] p-7 lg:p-9 rounded-[32px] lg:rounded-[40px] transition-all duration-500 cursor-pointer hover:bg-white/[0.08] hover:border-[#bff720]/30">
                            <span className="text-3xl lg:text-5xl font-black text-white/[0.08] group-hover:text-[#bff720]/15 transition-colors mr-8 lg:mr-12 w-16">{String(i).padStart(2, '0')}</span>
                            <p className="text-lg lg:text-xl font-bold text-white/80 tracking-tight">{config.final[`acao${i}`]}</p>
                            <ArrowRight className="hidden lg:block ml-auto text-white/10 group-hover:text-[#bff720] transition-all translate-x-4 group-hover:translate-x-0" />
                        </motion.div>
                    ) : null)}
                </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute top-20 left-20 w-32 h-32 border border-white/[0.08] rounded-full" />
            <div className="absolute bottom-20 right-20 w-24 h-24 bg-[#bff720]/5 rounded-full blur-2xl" />
      </section>

      {/* PAGE 5-7 — DETALHAMENTO DO CRONOGRAMA */}
      <div className="bg-[#F5F3EE]">
            {config.semanas.map((s: any, i: number) => (
                <section key={i} className="min-h-[90vh] px-6 lg:px-24 py-32 border-t border-[#e8e4dc] relative overflow-hidden">
                    {/* Section Background Pattern */}
                    <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #000 1px, transparent 0)', backgroundSize: '20px 20px' }} />
                    
                    <div className="max-w-7xl mx-auto space-y-20 relative z-10">
                        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
                            <div className="space-y-6">
                                <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                                    className="flex items-center gap-4">
                                    <div className="w-12 h-[2px] bg-[#0D6E5E]" />
                                    <span className="text-[10px] font-black uppercase tracking-[6px] text-[#0D6E5E]">{s.label}</span>
                                </motion.div>
                                <h2 className="text-5xl lg:text-7xl font-black text-black uppercase tracking-tighter leading-[0.95]">{s.titulo}</h2>
                            </div>
                            <motion.div whileHover={{ scale: 1.03 }} className="p-6 bg-white border border-[#e8e4dc] rounded-3xl flex items-center gap-6 shadow-lg">
                                <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center">
                                    <TrendingUp className="text-[#bff720]" size={26} />
                                </div>
                                <div className="text-left">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-black/30">Objetivo da Fase</p>
                                    <p className="text-base font-bold text-black">Aceleração de Resultados</p>
                                </div>
                            </motion.div>
                        </motion.div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {s.cards.map((c: any, ci: number) => (
                                <motion.div key={ci} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: ci * 0.15 }}
                                    whileHover={{ y: -8, scale: 1.01 }}
                                    className="group bg-white rounded-[50px] lg:rounded-[60px] p-10 lg:p-14 shadow-2xl border border-[#e8e4dc] space-y-8 lg:space-y-10 hover:border-[#bff720] hover:shadow-xl transition-all duration-500 flex flex-col justify-between">
                                    <div className="space-y-7 lg:space-y-8 text-left">
                                        <div className="flex justify-between items-start">
                                            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-black rounded-full">
                                                <Sparkles className="text-[#bff720]" size={12} />
                                                <span className="text-[9px] font-black text-white uppercase tracking-widest">{c.tipo}</span>
                                            </div>
                                            <motion.div whileHover={{ rotate: 90, scale: 1.2 }} className="text-black/10 group-hover:text-[#bff720] transition-colors">
                                                <Sparkles size={32} />
                                            </motion.div>
                                        </div>
                                        <h3 className="text-3xl lg:text-4xl font-black text-black leading-tight tracking-tight">{c.titulo}</h3>
                                        
                                        <div className="grid grid-cols-1 gap-6">
                                            <div className="space-y-3">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-[#0D6E5E]">Base Estratégica</p>
                                                <p className="text-lg font-medium text-black/65 leading-relaxed">{c.gancho}</p>
                                            </div>
                                            <motion.div whileHover={{ scale: 1.02 }} className="p-7 bg-[#f8f6f0] rounded-3xl space-y-3">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-black/30">Estrutura do Conteúdo</p>
                                                <p className="text-base font-bold text-black/75 leading-relaxed">{c.estrutura}</p>
                                            </motion.div>
                                        </div>
                                    </div>

                                    <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
                                        className="pt-8 border-t border-gray-100 flex items-center justify-between group-hover:border-[#bff720]/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-2.5 h-2.5 rounded-full bg-[#bff720]" />
                                            <span className="text-xs font-black uppercase tracking-widest text-black/40">Call to action:</span>
                                        </div>
                                        <span className="text-xs font-black text-black uppercase tracking-widest bg-[#bff720]/15 px-5 py-2.5 rounded-lg">{c.cta}</span>
                                    </motion.div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>
            ))}
      </div>

      <footer className="bg-black py-32 border-t border-white/[0.06] flex flex-col items-center justify-center text-center px-8 relative overflow-hidden">
           {/* Background Effects */}
           <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
           <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 6, repeat: Infinity }} 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#bff720]/5 rounded-full blur-[150px]" />
           
           <div className="relative z-10 flex flex-col items-center">
                <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="relative mb-16">
                    <div className="absolute -inset-16 bg-[#bff720]/10 blur-[80px] rounded-full" />
                    <img src={LogoInova} className="h-20 lg:h-28 brightness-0 invert opacity-50 relative z-10" alt="Inova" />
                </motion.div>
                <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="space-y-8 max-w-xl">
                    <h4 className="text-2xl font-black text-white uppercase tracking-[12px]">Estratégia <span className="text-[#bff720]">&</span> ROI</h4>
                    <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-[#bff720] to-transparent mx-auto" />
                    <p className="text-white/[0.25] text-[10px] font-medium leading-relaxed uppercase tracking-[4px]">
                        Este documento é confidencial e exclusivo<br />para @{config.cliente.nome.replace('@','')}.<br />
                        © 2026 INOVA Co. High Performance Marketing.
                    </p>
                </motion.div>
           </div>
      </footer>
    </div>
  );
}
