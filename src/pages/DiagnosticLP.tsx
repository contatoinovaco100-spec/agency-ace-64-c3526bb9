import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, Link } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2 as Spinner, CheckCircle2, AlertCircle, Sparkles, 
  Target, Zap, TrendingUp, ArrowRight, ArrowLeft, Pencil 
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

  const theme = THEMES[config.cliente?.tema] || THEMES.teal;
  const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };

  return (
    <div className="min-h-screen bg-[#F5F3EE] overflow-x-hidden selection:bg-[#bff720] selection:text-black text-left scroll-smooth"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* PROGRESS BAR */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 bg-[#bff720] z-50 origin-left"
        style={{ scaleX: scrollProgress / 100 }}
      />

      {/* ADMIN EDIT BUTTON */}
      {user && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed bottom-8 right-8 z-50"
        >
          <Link 
            to={`/diagnostico/editar/${slug}`}
            className="flex items-center gap-3 bg-black text-[#bff720] px-6 py-4 rounded-full font-black uppercase tracking-widest text-[10px] shadow-2xl hover:scale-105 transition-all group"
          >
            <Pencil size={16} className="group-hover:rotate-12 transition-transform" />
            Editar Diagnóstico
          </Link>
        </motion.div>
      )}

      {/* PAGE 1 — HERO COVER */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-10 py-20 relative overflow-hidden" style={{ background: theme.primary }}>
        <motion.img initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} 
          src={LogoInova} className="h-12 mb-24 brightness-0 invert opacity-80" alt="Inova" />
        
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}
          className="relative w-full max-w-4xl mx-auto">
          <div className="absolute -left-12 -top-12 text-[#bff720] text-7xl font-black select-none opacity-80 animate-pulse" style={{ transform: 'rotate(-15deg)' }}>✳</div>
          
          <div className="bg-black px-12 py-10 inline-block w-full shadow-2xl">
            <h1 className="text-white text-[clamp(3.5rem,12vw,8rem)] font-black tracking-[-3px] leading-none uppercase">
              DIAGNÓSTICO
            </h1>
          </div>
          
          <div className="absolute -right-8 -bottom-8 text-white/20 text-5xl select-none" style={{ transform: 'rotate(15deg)' }}>✳</div>
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.5 }}
          className="mt-16 space-y-6">
          <div className="inline-block px-8 py-3 bg-white/10 rounded-full backdrop-blur-xl border border-white/10">
              <p className="text-[10px] font-black text-[#bff720] tracking-[0.8em] uppercase">
                @{config.cliente.nome.replace('@','')}
              </p>
          </div>
          <p className="text-xs text-white/40 tracking-[0.5em] font-black uppercase max-w-xs mx-auto leading-relaxed">
            Maturidade Estratégica de Marca <br /> e Alta Performance Digital
          </p>
          
          <motion.div 
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="pt-12 opacity-20"
          >
            <div className="w-px h-20 bg-gradient-to-b from-white to-transparent mx-auto" />
          </motion.div>
        </motion.div>

        {/* Background Effects */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#bff720]/5 rounded-full translate-y-1/3 -translate-x-1/3 blur-[100px]" />
      </section>

      {/* PAGE 2 — OVERVIEW & RADAR */}
      <section className="min-h-[80vh] flex flex-col justify-center px-8 lg:px-24 py-24 bg-[#F5F3EE]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="space-y-10">
                <div className="space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-[5px] text-[#0D6E5E]">Introdução</span>
                    <h2 className="text-5xl lg:text-6xl font-black text-black leading-none uppercase tracking-tighter">
                        Panorama<br />Digital
                    </h2>
                </div>
                <p className="text-xl text-black/70 leading-relaxed font-medium">
                    {config.intro.texto}
                </p>
                <div className="flex gap-4">
                    <div className="flex -space-x-4">
                        {[1,2,3].map(i => <div key={i} className="w-12 h-12 rounded-full border-4 border-[#F5F3EE] bg-gray-200" />)}
                    </div>
                    <div className="flex flex-col justify-center text-left">
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/30 leading-none">Analisado por</p>
                        <p className="text-sm font-bold text-black">Especialistas Inova Co.</p>
                    </div>
                </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="relative">
                <div className="absolute -inset-10 bg-black/5 blur-3xl rounded-full" />
                <div className="relative bg-white p-12 rounded-[50px] shadow-2xl border border-[#e8e4dc] space-y-10">
                    <div className="grid grid-cols-2 gap-10">
                        {[
                            { label: 'Posicionamento', val: config.scores.posicionamento, icon: Target, color: '#bff720' },
                            { label: 'Autoridade', val: config.scores.autoridade, icon: Sparkles, color: '#d4c9b0' },
                            { label: 'Presença Digital', val: config.scores.presenca, icon: Zap, color: '#0D6E5E' },
                            { label: 'Conversão', val: config.scores.conversao, icon: TrendingUp, color: '#3A0A1E' },
                        ].map(s => (
                            <div key={s.label} className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-gray-50 text-gray-400"><s.icon size={16} /></div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-black/30 leading-tight">{s.label}</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-black">{s.val}</span>
                                    <span className="text-sm font-bold text-black/20">%</span>
                                </div>
                                <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden">
                                    <div className="h-full transition-all duration-1000" style={{ width: `${s.val}%`, backgroundColor: s.color }} />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="pt-10 border-t border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[4px] text-black/30">Maturidade Geral</p>
                            <p className="text-2xl font-black text-black uppercase">
                                {Math.round((config.scores.posicionamento + config.scores.presenca + config.scores.autoridade + config.scores.conversao) / 4)}%
                            </p>
                        </div>
                        <div className="bg-[#bff720] text-black text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-lg shadow-[#bff720]/20">
                            Verificado
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
      </section>

      {/* PAGE 3 — INSIGHTS (POSITIVOS / NEGATIVOS) */}
      <section className="min-h-screen flex items-center px-8 lg:px-24 py-32 relative overflow-hidden" style={{ background: theme.primary }}>
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-24 relative z-10">
            
            <div className="lg:col-span-12 mb-20 text-center">
                 <h2 className="text-[clamp(4rem,15vw,12rem)] font-black text-white/5 uppercase tracking-tighter leading-none absolute -top-20 left-1/2 -translate-x-1/2 w-full select-none">ANALYSIS</h2>
                 <h3 className="text-6xl lg:text-9xl font-black text-white uppercase tracking-tighter relative z-10 italic">Insight<span className="text-[#bff720]">.</span></h3>
            </div>

            {/* Positivos column */}
            <div className="lg:col-span-6 space-y-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-[2px] bg-[#bff720]" />
                    <h4 className="text-[10px] font-black uppercase tracking-[5px] text-[#bff720]">Pontos de Força</h4>
                </div>
                <div className="grid gap-4">
                    {config.positivos.map((p: string, i: number) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                            className="bg-white/5 border border-white/5 p-8 rounded-[32px] group hover:bg-white/10 transition-all duration-500">
                            <div className="flex gap-6">
                                <div className="w-10 h-10 rounded-2xl bg-[#bff720]/10 flex items-center justify-center text-[#bff720] shrink-0"><CheckCircle2 size={20} /></div>
                                <p className="text-lg font-bold text-white/90 leading-tight pt-1">{p}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Negativos column */}
            <div className="lg:col-span-6 space-y-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-[2px] bg-white/20" />
                    <h4 className="text-[10px] font-black uppercase tracking-[5px] text-white/40">Gargalos de Conversão</h4>
                </div>
                <div className="grid gap-4">
                    {config.negativos.map((n: string, i: number) => (
                        <motion.div key={i} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                            className="bg-black/20 border border-white/5 p-8 rounded-[32px] group hover:bg-black/40 transition-all duration-500">
                            <div className="flex gap-6">
                                <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/20 shrink-0"><AlertCircle size={20} /></div>
                                <p className="text-lg font-bold text-white/60 leading-tight pt-1">{n}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>

        {/* Background artifacts */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-black/10 rounded-full blur-[120px]" />
      </section>

      {/* SEÇÃO IA: AUDITORIA DE PERFIL (Condicional) */}
      {config.aiAnalise && (
        <section className="min-h-[70vh] px-8 lg:px-24 py-24 bg-white border-y border-gray-100 overflow-hidden relative">
            <div className="max-w-6xl mx-auto space-y-16">
                
                {/* Print da Análise (Novo) */}
                {config.aiAnalise.analysisImageUrl && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="space-y-8">
                      <div className="text-center space-y-4">
                          <span className="text-[10px] font-black uppercase tracking-[5px] text-[#0D6E5E]">Evidência Visual</span>
                          <h2 className="text-3xl lg:text-5xl font-black text-black uppercase tracking-tighter">Print da Análise</h2>
                      </div>
                      <div className="relative max-w-4xl mx-auto rounded-[40px] overflow-hidden shadow-2xl border-8 border-gray-100 group">
                          <img src={config.aiAnalise.analysisImageUrl} alt="Print da Análise" className="w-full h-auto grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                      </div>
                  </motion.div>
                )}

                <div className="text-center space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-[5px] text-[#0D6E5E]">Auditoria Detalhada</span>
                    <h2 className="text-4xl lg:text-6xl font-black text-black uppercase tracking-tighter">Análise de Perfil</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 text-left">
                    {/* Bio Audit */}
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                        className="bg-gray-50 rounded-[40px] p-10 space-y-8 border border-gray-100">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-black text-[#bff720] rounded-2xl"><Sparkles size={24} /></div>
                            <h3 className="text-2xl font-black text-black">Audit da Biografia</h3>
                        </div>
                        <div className="space-y-4">
                            {config.aiAnalise.bioPositivos?.map((p: string, i: number) => (
                                <div key={i} className="flex gap-3 text-sm font-bold text-black/70">
                                    <CheckCircle2 className="text-[#0D6E5E] shrink-0" size={18} /> {p}
                                </div>
                            ))}
                            {config.aiAnalise.bioNegativos?.map((n: string, i: number) => (
                                <div key={i} className="flex gap-3 text-sm font-bold text-black/40 italic">
                                    <AlertCircle className="text-black/20 shrink-0" size={18} /> {n}
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Presence Audit */}
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
                        className="bg-black rounded-[40px] p-10 space-y-8 shadow-2xl">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-[#bff720] text-black rounded-2xl"><Sparkles size={24} /></div>
                            <h3 className="text-2xl font-black text-white">Análise Visual</h3>
                        </div>
                        <div className="space-y-4">
                            {config.aiAnalise.presencaPositivos?.map((p: string, i: number) => (
                                <div key={i} className="flex gap-3 text-sm font-bold text-white/80">
                                    <CheckCircle2 className="text-[#bff720] shrink-0" size={18} /> {p}
                                </div>
                            ))}
                            {config.aiAnalise.presencaNegativos?.map((n: string, i: number) => (
                                <div key={i} className="flex gap-3 text-sm font-bold text-white/30 italic">
                                    <AlertCircle className="text-white/10 shrink-0" size={18} /> {n}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
      )}

      {/* PAGE 4 — VEREDITO & PLANO DE AÇÃO */}
      <section className="min-h-screen px-8 lg:px-24 py-32 bg-black flex flex-col items-center justify-center text-center overflow-hidden relative">
            <div className="max-w-4xl space-y-16 relative z-10">
                <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="space-y-6">
                    <div className="inline-block px-8 py-3 bg-[#bff720]/10 border border-[#bff720]/20 rounded-full">
                        <span className="text-sm font-black text-[#bff720] uppercase tracking-[8px]">O Veredito Final</span>
                    </div>
                    <h2 className="text-6xl lg:text-8xl font-black text-white uppercase tracking-tighter leading-[0.85]">
                        {config.final.destaque}
                    </h2>
                    <p className="text-2xl lg:text-3xl font-light text-white/40 max-w-3xl mx-auto italic">
                        "{config.final.texto}"
                    </p>
                </motion.div>

                <div className="grid gap-4 text-left">
                    {[1,2,3,4,5].map(i => config.final[`acao${i}`] ? (
                        <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                            className="group flex items-center bg-white/5 border border-white/10 p-8 rounded-[32px] transition-all hover:bg-white/10 hover:border-[#bff720]/50 duration-500">
                            <span className="text-4xl font-black text-white/10 group-hover:text-[#bff720]/20 transition-colors mr-10">{String(i).padStart(2, '0')}</span>
                            <p className="text-xl font-bold text-white tracking-tight">{config.final[`acao${i}`]}</p>
                            <ArrowRight className="ml-auto text-white/10 group-hover:text-[#bff720] transition-all translate-x-4 group-hover:translate-x-0" />
                        </motion.div>
                    ) : null)}
                </div>
            </div>

            {/* Decorative Grid */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </section>

      {/* PAGE 5-7 — DETALHAMENTO DO CRONOGRAMA */}
      <div className="bg-[#F5F3EE]">
            {config.semanas.map((s: any, i: number) => (
                <section key={i} className="min-h-[80vh] px-8 lg:px-24 py-32 border-t border-[#e8e4dc]">
                    <div className="max-w-6xl mx-auto space-y-20">
                        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-[2px] bg-[#0D6E5E]" />
                                    <span className="text-[10px] font-black uppercase tracking-[5px] text-[#0D6E5E]">{s.label}</span>
                                </div>
                                <h2 className="text-5xl lg:text-6xl font-black text-black uppercase tracking-tighter leading-none">{s.titulo}</h2>
                            </div>
                            <div className="p-6 bg-white border border-[#e8e4dc] rounded-2xl flex items-center gap-6">
                                <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center text-[#bff720]"><TrendingUp size={24} /></div>
                                <div className="text-left">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-black/30">Objetivo da Fase</p>
                                    <p className="text-sm font-black text-black">Aceleração de Resultados</p>
                                </div>
                            </div>
                        </motion.div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            {s.cards.map((c: any, ci: number) => (
                                <motion.div key={ci} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: ci * 0.2 }}
                                    className="group bg-white rounded-[50px] p-12 shadow-2xl border border-[#e8e4dc] space-y-10 hover:border-[#bff720] transition-colors duration-500 flex flex-col justify-between">
                                    <div className="space-y-8 text-left">
                                        <div className="flex justify-between items-start">
                                            <div className="inline-block px-5 py-2 bg-black rounded-full">
                                                <span className="text-[10px] font-black text-white uppercase tracking-widest">{c.tipo}</span>
                                            </div>
                                            <Sparkles className="text-black/10 group-hover:text-[#bff720] transition-colors" size={32} />
                                        </div>
                                        <h3 className="text-3xl font-black text-black leading-tight tracking-tight">{c.titulo}</h3>
                                        
                                        <div className="grid grid-cols-1 gap-8">
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-[#0D6E5E]">Base Estratégica</p>
                                                <p className="text-lg font-medium text-black/70 leading-snug">{c.gancho}</p>
                                            </div>
                                            <div className="p-6 bg-[#f8f6f0] rounded-3xl space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-black/30">Estrutura do Conteúdo</p>
                                                <p className="text-sm font-bold text-black/80 leading-relaxed">{c.estrutura}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-8 border-t border-gray-100 flex items-center justify-between group-hover:border-[#bff720]/20 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-[#bff720] animate-pulse" />
                                            <span className="text-xs font-black uppercase tracking-widest text-black/40">Call to action:</span>
                                        </div>
                                        <span className="text-xs font-black text-black uppercase tracking-widest bg-[#bff720]/10 px-4 py-2 rounded-lg">{c.cta}</span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>
            ))}
      </div>

      <footer className="bg-black py-40 border-t border-white/5 flex flex-col items-center justify-center text-center px-10">
           <div className="relative mb-20">
                <div className="absolute -inset-10 bg-[#bff720]/10 blur-3xl rounded-full" />
                <img src={LogoInova} className="h-24 lg:h-32 brightness-0 invert opacity-40 relative z-10" alt="Inova" />
           </div>
           <div className="space-y-4 max-w-lg">
                <h4 className="text-xl font-bold text-white uppercase tracking-[10px]">Estratégia & ROI</h4>
                <p className="text-white/20 text-[10px] font-medium leading-relaxed uppercase tracking-[3px]">
                    Este documento é confidencial e exclusivo para @{config.cliente.nome.replace('@','')}.<br />
                    © 2026 INOVA Co. High Performance Marketing.
                </p>
           </div>
      </footer>
    </div>
  );
}
