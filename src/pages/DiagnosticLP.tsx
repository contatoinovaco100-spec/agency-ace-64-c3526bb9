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
  blue: { primary: '#1e40af', primaryDark: '#1e3a8a' },
  purple: { primary: '#6b21a8', primaryDark: '#581c87' },
  orange: { primary: '#c2410c', primaryDark: '#9a3412' },
  pink: { primary: '#be185d', primaryDark: '#9d174d' },
  green: { primary: '#166534', primaryDark: '#14532d' },
  gold: { primary: '#b45309', primaryDark: '#78350f' },
  navy: { primary: '#1e3a5f', primaryDark: '#0f172a' },
  red: { primary: '#991b1b', primaryDark: '#7f1d1d' },
  emerald: { primary: '#047857', primaryDark: '#065f46' },
};

const DEMO_CONFIG = {
  cliente: { nome: '@sua_empresa', tema: 'teal', primaryColor: '#0D6E5E' },
  intro: { texto: 'Análise completa da maturidade digital da sua empresa com recomendações estratégicas personalizadas para melhorar sua presença online e aumentar conversões.' },
  scores: { posicionamento: 72, autoridade: 65, presenca: 78, conversao: 55 },
  positivos: [
    'Presença consolidada nas principais redes sociais',
    'Marca possui identidade visual consistente',
    'Content marketing bem estruturado',
    'Engajamento médio acima do mercado'
  ],
  negativos: [
    'Bio não otimizada para conversão',
    'Falta call-to-action claro no perfil',
    'Links não direcionam para página específica',
    'Ausência de estratégia de automação'
  ],
  final: {
    destaque: 'Em Ascensão',
    texto: 'A empresa possui fundamentos sólidos, mas precisa otimizar a conversão do tráfego em resultados.',
    acao1: 'Otimizar bio com link para landing page',
    acao2: 'Criar sequência de automação no Direct',
    acao3: 'Implementar estratégia de remarketing',
    acao4: 'Desenvolver conteúdo para nutrir leads',
    acao5: 'Setup de Pixel para rastreamento'
  },
  semanas: [
    { label: 'Semana 1', titulo: 'Fundamentos', cards: [
      { tipo: 'Post', titulo: 'Reels Viral', gancho: 'Frase de impacto', estrutura: 'Hook + Valor + CTA', cta: 'Salvar' },
      { tipo: 'Story', titulo: 'Highlights', gancho: 'Categorização', estrutura: 'Capa + Ícones', cta: 'Ver mais' }
    ]},
    { label: 'Semana 2', titulo: 'Automação', cards: [
      { tipo: 'Automação', titulo: 'Sequência Welcome', gancho: 'Boas-vindas', estrutura: 'Mensagem inicial +follow-up', cta: 'Começar' },
      { tipo: 'Bot', titulo: 'Respostas', gancho: 'Perguntas frequentes', estrutura: 'Menu + opções', cta: 'Ativar' }
    ]},
    { label: 'Semana 3', titulo: 'Tráfego', cards: [
      { tipo: 'Ads', titulo: 'Campanha', gancho: 'Captura de leads', estrutura: 'Copy + creativo', cta: 'Launch' },
      { tipo: 'Orgânico', titulo: 'Viralização', gancho: 'Conteúdo shareable', estrutura: 'Trend + valor', cta: 'Postar' }
    ]},
    { label: 'Semana 4', titulo: 'Conversão', cards: [
      { tipo: 'Landing', titulo: 'Página', gancho: 'Oferta principal', estrutura: 'Hero + Prova + CTA', cta: 'Converter' },
      { tipo: 'Follow-up', titulo: 'Fechamento', gancho: 'Objection handling', estrutura: 'Pergunta + solução', cta: 'Fechar' }
    ]}
  ]
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
            .from('diagnostics')
            .select('*')
            .eq('slug', slug)
            .maybeSingle();
          
          if (error) {
            console.error('Erro da API:', error);
          }
          
          if (data?.config) {
            setConfig(data.config);
            setLoading(false);
            return;
          }
        }
        const saved = localStorage.getItem('agency_diagnostic_config_v4');
        if (saved) { 
          const parsed = JSON.parse(saved);
          setConfig(parsed);
          setLoading(false);
          return;
        }
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

  const displayConfig = config || DEMO_CONFIG;

  const currentTheme = THEMES[displayConfig?.cliente?.tema] || THEMES.teal;
  const theme = {
    primary: displayConfig?.cliente?.primaryColor || currentTheme.primary,
    primaryDark: displayConfig?.cliente?.primaryColor || currentTheme.primaryDark
  };
  const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };

  const clienteNome = displayConfig?.cliente?.nome || '@empresa';
  const fotoPerfil = displayConfig?.cliente?.foto || displayConfig?.aiAnalise?.analysisImageUrl || '';
  const introTexto = displayConfig?.intro?.texto || 'Análise completa da sua presença digital e recomendações estratégicas para melhorar seu posicionamento online.';

  return (
    <div className="min-h-screen bg-[#F5F3EE] overflow-x-hidden selection:bg-[#bff720] selection:text-black text-left scroll-smooth"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* PROGRESS BAR */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 bg-[#bff720] z-50 origin-left"
        style={{ scaleX: scrollProgress / 100 }}
      />

      {/* PAGE 1 — HERO COVER */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-4 sm:px-10 py-16 sm:py-20 relative overflow-hidden" style={{ background: theme.primary }}>
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
          src={LogoInova} className="h-8 sm:h-12 mb-12 sm:mb-20 relative z-10 brightness-0 invert opacity-80" alt="Inova" />
        
        <motion.div initial={{ opacity: 0, scale: 0.8, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 1.2, ease: "easeOut" }}
          className="relative w-full max-w-5xl mx-auto">
          
          {/* Glow Effect Behind */}
          <div className="absolute -inset-20 bg-[#bff720]/20 blur-[100px] rounded-full" />
          
          {/* Decorative Elements */}
          <div className="hidden sm:block absolute -left-16 -top-16 text-[#bff720] text-8xl font-black select-none animate-pulse" style={{ transform: 'rotate(-15deg)' }}>
            <motion.span animate={{ rotate: [-15, -10, -15], scale: [1, 1.1, 1] }} transition={{ duration: 3, repeat: Infinity }}>✳</motion.span>
          </div>
          
          {/* Main Title Box */}
          <div className="bg-black px-5 py-6 sm:px-8 sm:py-8 lg:px-16 lg:py-12 inline-block w-full shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
            <h1 className="text-white text-[clamp(2.25rem,12vw,7rem)] font-black tracking-[-1px] sm:tracking-[-2px] lg:tracking-[-4px] leading-[0.9] uppercase relative z-10">
              diagnóstico
            </h1>
          </div>
          
          {/* Accent Elements */}
          <motion.div className="hidden sm:block absolute -right-8 -bottom-8 text-white/10 text-6xl select-none" style={{ transform: 'rotate(15deg)' }}>
            <motion.span animate={{ rotate: [15, 20, 15] }} transition={{ duration: 4, repeat: Infinity }}>✳</motion.span>
          </motion.div>
          
          {/* Line Decorations */}
          <div className="hidden sm:block absolute -right-20 top-1/2 w-32 h-[2px] bg-gradient-to-r from-[#bff720] to-transparent opacity-50" />
          <div className="hidden sm:block absolute -left-20 top-1/3 w-32 h-[2px] bg-gradient-to-l from-white/30 to-transparent opacity-50" />
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.8, duration: 0.8 }}
          className="mt-12 sm:mt-20 space-y-6 sm:space-y-8 relative z-10 w-full">
          <div className="inline-flex flex-wrap items-center justify-center gap-3 sm:gap-6 px-5 sm:px-10 py-3 sm:py-4 bg-white/10 rounded-full backdrop-blur-xl border border-white/10 max-w-full">
              {fotoPerfil && (
                <div className="w-8 h-8 rounded-full border-2 border-[#bff720] overflow-hidden shrink-0 bg-white/10">
                  <img 
                    src={fotoPerfil} 
                    alt="Profile" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
                  />
                </div>
              )}
              <div className="w-2 h-2 bg-[#bff720] rounded-full animate-pulse shrink-0" />
              <p className="text-[10px] sm:text-[11px] font-black text-[#bff720] tracking-[0.4em] sm:tracking-[0.9em] uppercase break-all">
                @{clienteNome.replace('@','')}
              </p>
              <div className="hidden sm:block w-16 h-[1px] bg-white/20" />
              <p className="hidden sm:block text-[10px] font-bold text-white/60 tracking-[0.3em] uppercase">
                Maturidade Estratégica
              </p>
          </div>
          
          <p className="text-[10px] sm:text-xs text-white/40 tracking-[0.3em] sm:tracking-[0.6em] font-medium uppercase max-w-lg mx-auto leading-relaxed px-4">
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
        <div className="absolute top-0 right-0 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[250px] sm:w-[500px] h-[250px] sm:h-[500px] bg-[#bff720]/10 rounded-full translate-y-1/3 -translate-x-1/3 blur-[100px] pointer-events-none" />
        <div className="hidden sm:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-white/5 rounded-full pointer-events-none" style={{ transform: 'translate(-50%, -50%)' }} />
      </section>

      {/* PAGE 2 — OVERVIEW & RADAR */}
      <section className="min-h-[90vh] flex flex-col justify-center px-4 sm:px-6 lg:px-24 py-16 sm:py-24 bg-[#F5F3EE] relative overflow-hidden">
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
                    <h2 className="text-4xl sm:text-5xl lg:text-7xl font-black text-black leading-[0.95] uppercase tracking-tighter">
                        Panorama<br /><span className="text-[#0D6E5E]">Digital</span>
                    </h2>
                </div>
                <p className="text-base sm:text-lg lg:text-xl text-black/65 leading-relaxed font-medium max-w-md">
                    {introTexto}
                </p>
                <div className="flex items-center gap-6 pt-4">
                    <div className="flex -space-x-3">
                        {fotoPerfil && (
                            <motion.div initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }}
                                className="w-12 h-12 rounded-full border-4 border-[#F5F3EE] bg-gray-100 overflow-hidden">
                                <img 
                                    src={fotoPerfil} 
                                    className="w-full h-full object-cover" 
                                    referrerPolicy="no-referrer"
                                    crossOrigin="anonymous"
                                    onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
                                />
                            </motion.div>
                        )}
                        {[1,2].map(i => (
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
                <div className="relative bg-white p-6 sm:p-10 lg:p-14 rounded-[32px] sm:rounded-[50px] shadow-2xl border border-[#e8e4dc] space-y-8 sm:space-y-10 transform -rotate-1 transition-transform hover:rotate-0">
                    <div className="grid grid-cols-2 gap-5 sm:gap-8 lg:gap-12">
                        {[
                            { label: 'Posicionamento', val: displayConfig.scores.posicionamento, icon: Target, color: '#0D6E5E' },
                            { label: 'Autoridade', val: displayConfig.scores.autoridade, icon: Sparkles, color: '#3A0A1E' },
                            { label: 'Presença Digital', val: displayConfig.scores.presenca, icon: Zap, color: '#bff720' },
                            { label: 'Conversão', val: displayConfig.scores.conversao, icon: TrendingUp, color: '#6a11cb' },
                        ].map((s, idx) => (
                            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.1 }} className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <motion.div whileHover={{ scale: 1.1, rotate: 5 }} className="p-2.5 rounded-2xl bg-gray-50 text-gray-600">
                                        <s.icon size={18} />
                                    </motion.div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-black/35 leading-tight">{s.label}</span>
                                </div>
                                <div className="flex items-baseline gap-1.5">
                                    <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="text-4xl sm:text-5xl lg:text-6xl font-black text-black tracking-tighter">{s.val}</motion.span>
                                    <span className="text-base sm:text-lg font-bold text-black/25">%</span>
                                </div>
                                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} whileInView={{ width: `${s.val}%` }} transition={{ duration: 1, delay: idx * 0.15, ease: "easeOut" }}
                                        className="h-full rounded-full" style={{ backgroundColor: s.color }} />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 }}
                        className="pt-6 sm:pt-8 border-t border-gray-100 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[4px] text-black/30">Maturidade Geral</p>
                            <p className="text-2xl sm:text-3xl font-black text-black uppercase tracking-tight">
                                {Math.round((displayConfig.scores.posicionamento + displayConfig.scores.presenca + displayConfig.scores.autoridade + displayConfig.scores.conversao) / 4)}%
                            </p>
                        </div>
                        <motion.div whileHover={{ scale: 1.05 }} className="bg-[#bff720] text-black text-[9px] font-black uppercase tracking-widest px-4 sm:px-5 py-2.5 sm:py-3 rounded-full shadow-xl shadow-[#bff720]/30 shrink-0">
                            Verificado
                        </motion.div>
                    </motion.div>
                </div>
            </motion.div>
        </div>
      </section>

      {/* PAGE 3 — INSIGHTS (POSITIVOS / NEGATIVOS) */}
      <section className="min-h-screen flex items-center px-4 sm:px-6 lg:px-24 py-20 sm:py-32 relative overflow-hidden" style={{ background: theme.primary }}>
        {/* Animated Background Elements */}
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 relative z-10">
            
            <div className="lg:col-span-12 mb-8 lg:mb-24 text-center relative">
                 <motion.h2 initial={{ opacity: 0, y: -30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    className="text-[clamp(3rem,18vw,12rem)] font-black text-white/5 uppercase tracking-tighter leading-none absolute -top-4 sm:-top-8 lg:-top-16 left-1/2 -translate-x-1/2 w-full select-none pointer-events-none">INSIGHTS</motion.h2>
                 <h3 className="text-4xl sm:text-5xl lg:text-9xl font-black text-white uppercase tracking-tighter relative z-10 italic">
                    Insight<span className="text-[#bff720]">.</span>
                 </h3>
            </div>

            {/* Positivos column */}
            <div className="lg:col-span-6 space-y-6 sm:space-y-10">
                <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="flex items-center gap-4 sm:gap-5">
                    <div className="w-10 sm:w-16 h-[2px] bg-[#bff720]" />
                    <h4 className="text-[10px] font-black uppercase tracking-[4px] sm:tracking-[6px] text-[#bff720]">Pontos de Força</h4>
                </motion.div>
                <div className="grid gap-4 sm:gap-5">
                    {displayConfig.positivos.map((p: string, i: number) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}
                            whileHover={{ x: 10, scale: 1.02 }}
                            className="bg-white/[0.08] border border-white/[0.1] p-5 sm:p-8 rounded-[28px] sm:rounded-[40px] group hover:bg-white/[0.12] hover:border-[#bff720]/30 transition-all duration-500 cursor-pointer">
                            <div className="flex gap-4 sm:gap-6 items-start">
                                <motion.div whileHover={{ rotate: 360 }} className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#bff720]/15 flex items-center justify-center text-[#bff720] shrink-0">
                                    <CheckCircle2 size={20} />
                                </motion.div>
                                <p className="text-base sm:text-lg lg:text-xl font-bold text-white/85 leading-snug pt-1 sm:pt-1.5">{p}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Negativos column */}
            <div className="lg:col-span-6 space-y-6 sm:space-y-10">
                <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="flex items-center gap-4 sm:gap-5">
                    <div className="w-10 sm:w-16 h-[2px] bg-white/20" />
                    <h4 className="text-[10px] font-black uppercase tracking-[4px] sm:tracking-[6px] text-white/40">Gargalos de Conversão</h4>
                </motion.div>
                <div className="grid gap-4 sm:gap-5">
                    {displayConfig.negativos.map((n: string, i: number) => (
                        <motion.div key={i} initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}
                            whileHover={{ x: -10, scale: 1.02 }}
                            className="bg-black/[0.25] border border-white/[0.08] p-5 sm:p-8 rounded-[28px] sm:rounded-[40px] group hover:bg-black/[0.35] hover:border-white/20 transition-all duration-500 cursor-pointer">
                            <div className="flex gap-4 sm:gap-6 items-start">
                                <motion.div whileHover={{ scale: 1.1 }} className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/[0.08] flex items-center justify-center text-white/25 shrink-0">
                                    <AlertCircle size={20} />
                                </motion.div>
                                <p className="text-base sm:text-lg lg:text-xl font-bold text-white/[0.55] leading-snug pt-1 sm:pt-1.5">{n}</p>
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
      {displayConfig.aiAnalise && (
        <section className="min-h-[80vh] px-4 sm:px-6 lg:px-24 py-16 sm:py-28 bg-white border-y border-gray-100 overflow-hidden relative">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #000 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            
            <div className="max-w-7xl mx-auto space-y-12 sm:space-y-20">
                
                {/* Print da Análise (Novo) */}
                {displayConfig.aiAnalise.analysisImageUrl && (
                  <motion.div initial={{ opacity: 0, scale: 0.95, y: 30 }} whileInView={{ opacity: 1, scale: 1, y: 0 }} viewport={{ once: true }} className="space-y-10">
                      <div className="text-center space-y-5">
                          <motion.div initial={{ opacity: 0, y: -10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                            className="inline-flex items-center gap-3 px-4 py-2 bg-[#0D6E5E]/10 rounded-full">
                              <div className="w-2 h-2 bg-[#0D6E5E] rounded-full animate-pulse" />
                              <span className="text-[9px] font-black uppercase tracking-[5px] text-[#0D6E5E]">Evidência Visual</span>
                          </motion.div>
                          <h2 className="text-3xl sm:text-4xl lg:text-6xl font-black text-black uppercase tracking-tighter">Print da Análise</h2>
                      </div>
                      <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
                        className="relative max-w-5xl mx-auto rounded-[28px] sm:rounded-[50px] overflow-hidden shadow-2xl border-4 sm:border-8 border-gray-100 group">
                          <img src={displayConfig.aiAnalise.analysisImageUrl} alt="Print da Análise" className="w-full h-auto grayscale-[0.15] group-hover:grayscale-0 transition-all duration-700" />
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
                    <h2 className="text-4xl sm:text-5xl lg:text-7xl font-black text-black uppercase tracking-tighter leading-[0.95]">Análise de Perfil</h2>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 text-left">
                    {/* Bio Audit */}
                    <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                        className="bg-gradient-to-br from-gray-50 to-white rounded-[32px] sm:rounded-[50px] p-6 sm:p-10 lg:p-12 border border-gray-100 shadow-xl">
                        <div className="flex items-center gap-4 sm:gap-5 mb-6 sm:mb-8">
                            <motion.div whileHover={{ rotate: 180, scale: 1.1 }} className="p-3 sm:p-4 bg-black rounded-2xl shrink-0">
                                <Sparkles className="text-[#bff720]" size={22} />
                            </motion.div>
                            <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-black">Audit da Biografia</h3>
                        </div>
                        <div className="space-y-4 sm:space-y-5">
                            {displayConfig.aiAnalise.bioPositivos?.map((p: string, i: number) => (
                                <motion.div key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                                    className="flex gap-3 sm:gap-4 text-sm sm:text-base font-bold text-black/70 items-start">
                                    <CheckCircle2 className="text-[#0D6E5E] shrink-0 mt-0.5" size={18} /> 
                                    <span>{p}</span>
                                </motion.div>
                            ))}
                            {displayConfig.aiAnalise.bioNegativos?.map((n: string, i: number) => (
                                <motion.div key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                                    className="flex gap-3 sm:gap-4 text-sm sm:text-base font-medium text-black/40 italic items-start">
                                    <AlertCircle className="text-black/20 shrink-0 mt-0.5" size={18} /> 
                                    <span>{n}</span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Presence Audit */}
                    <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
                        className="bg-gradient-to-br from-black to-gray-900 rounded-[32px] sm:rounded-[50px] p-6 sm:p-10 lg:p-12 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[#bff720]/5 rounded-full blur-[80px] pointer-events-none" />
                        <div className="flex items-center gap-4 sm:gap-5 mb-6 sm:mb-8 relative z-10">
                            <motion.div whileHover={{ rotate: -180, scale: 1.1 }} className="p-3 sm:p-4 bg-[#bff720] rounded-2xl shrink-0">
                                <Sparkles className="text-black" size={22} />
                            </motion.div>
                            <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-white">Análise Visual</h3>
                        </div>
                        <div className="space-y-4 sm:space-y-5 relative z-10">
                            {displayConfig.aiAnalise.presencaPositivos?.map((p: string, i: number) => (
                                <motion.div key={i} initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                                    className="flex gap-3 sm:gap-4 text-sm sm:text-base font-bold text-white/80 items-start">
                                    <CheckCircle2 className="text-[#bff720] shrink-0 mt-0.5" size={18} /> 
                                    <span>{p}</span>
                                </motion.div>
                            ))}
                            {displayConfig.aiAnalise.presencaNegativos?.map((n: string, i: number) => (
                                <motion.div key={i} initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                                    className="flex gap-3 sm:gap-4 text-sm sm:text-base font-medium text-white/35 italic items-start">
                                    <AlertCircle className="text-white/15 shrink-0 mt-0.5" size={18} /> 
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
      <section className="min-h-screen px-4 sm:px-6 lg:px-24 py-20 sm:py-32 bg-black flex flex-col items-center justify-center text-center overflow-hidden relative">
            {/* Animated Grid Background */}
            <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
            <motion.div animate={{ opacity: [0.05, 0.1, 0.05] }} transition={{ duration: 4, repeat: Infinity }} className="absolute inset-0 bg-gradient-to-b from-[#bff720]/5 to-transparent" />
            
            <div className="max-w-5xl w-full space-y-12 sm:space-y-20 relative z-10">
                <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="space-y-6 sm:space-y-10">
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                        className="inline-flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-2.5 sm:py-3 bg-[#bff720]/10 border border-[#bff720]/20 rounded-full">
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-2 h-2 bg-[#bff720] rounded-full" />
                        <span className="text-[10px] sm:text-sm font-black text-[#bff720] uppercase tracking-[4px] sm:tracking-[8px]">O Veredito Final</span>
                    </motion.div>
                    <h2 className="text-4xl sm:text-6xl lg:text-9xl font-black text-white uppercase tracking-tighter leading-[0.88] break-words">
                        {displayConfig.final.destaque}
                    </h2>
                    <p className="text-base sm:text-xl lg:text-3xl font-light text-white/35 max-w-4xl mx-auto italic leading-relaxed px-2">
                        "{displayConfig.final.texto}"
                    </p>
                </motion.div>

                <div className="grid gap-4 sm:gap-5 text-left max-w-4xl mx-auto">
                    {[1,2,3,4,5].map(i => displayConfig.final[`acao${i}`] ? (
                        <motion.div key={i} initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                            whileHover={{ x: 15, scale: 1.01 }}
                            className="group flex items-center bg-white/[0.04] border border-white/[0.08] p-5 sm:p-7 lg:p-9 rounded-[24px] sm:rounded-[32px] lg:rounded-[40px] transition-all duration-500 cursor-pointer hover:bg-white/[0.08] hover:border-[#bff720]/30">
                            <span className="text-2xl sm:text-3xl lg:text-5xl font-black text-white/[0.08] group-hover:text-[#bff720]/15 transition-colors mr-4 sm:mr-8 lg:mr-12 w-10 sm:w-16 shrink-0">{String(i).padStart(2, '0')}</span>
                            <p className="text-sm sm:text-lg lg:text-xl font-bold text-white/80 tracking-tight">{displayConfig.final[`acao${i}`]}</p>
                            <ArrowRight className="hidden lg:block ml-auto text-white/10 group-hover:text-[#bff720] transition-all translate-x-4 group-hover:translate-x-0 shrink-0" />
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
            {displayConfig.semanas.map((s: any, i: number) => (
                <section key={i} className="min-h-[90vh] px-4 sm:px-6 lg:px-24 py-20 sm:py-32 border-t border-[#e8e4dc] relative overflow-hidden">
                    {/* Section Background Pattern */}
                    <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #000 1px, transparent 0)', backgroundSize: '20px 20px' }} />
                    
                    <div className="max-w-7xl mx-auto space-y-12 sm:space-y-20 relative z-10">
                        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 sm:gap-10">
                            <div className="space-y-4 sm:space-y-6">
                                <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                                    className="flex items-center gap-3 sm:gap-4">
                                    <div className="w-8 sm:w-12 h-[2px] bg-[#0D6E5E]" />
                                    <span className="text-[10px] font-black uppercase tracking-[4px] sm:tracking-[6px] text-[#0D6E5E]">{s.label}</span>
                                </motion.div>
                                <h2 className="text-4xl sm:text-5xl lg:text-7xl font-black text-black uppercase tracking-tighter leading-[0.95]">{s.titulo}</h2>
                            </div>
                            <motion.div whileHover={{ scale: 1.03 }} className="p-4 sm:p-6 bg-white border border-[#e8e4dc] rounded-2xl sm:rounded-3xl flex items-center gap-4 sm:gap-6 shadow-lg self-start">
                                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-black flex items-center justify-center shrink-0">
                                    <TrendingUp className="text-[#bff720]" size={22} />
                                </div>
                                <div className="text-left">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-black/30">Objetivo da Fase</p>
                                    <p className="text-sm sm:text-base font-bold text-black">Aceleração de Resultados</p>
                                </div>
                            </motion.div>
                        </motion.div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                            {s.cards.map((c: any, ci: number) => (
                                <motion.div key={ci} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: ci * 0.15 }}
                                    whileHover={{ y: -8, scale: 1.01 }}
                                    className="group bg-white rounded-[32px] sm:rounded-[50px] lg:rounded-[60px] p-6 sm:p-10 lg:p-14 shadow-2xl border border-[#e8e4dc] space-y-6 sm:space-y-8 lg:space-y-10 hover:border-[#bff720] hover:shadow-xl transition-all duration-500 flex flex-col justify-between">
                                    <div className="space-y-5 sm:space-y-7 lg:space-y-8 text-left">
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-black rounded-full">
                                                <Sparkles className="text-[#bff720]" size={12} />
                                                <span className="text-[9px] font-black text-white uppercase tracking-widest">{c.tipo}</span>
                                            </div>
                                            <motion.div whileHover={{ rotate: 90, scale: 1.2 }} className="text-black/10 group-hover:text-[#bff720] transition-colors shrink-0">
                                                <Sparkles size={28} />
                                            </motion.div>
                                        </div>
                                        <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-black leading-tight tracking-tight break-words">{c.titulo}</h3>
                                        
                                        <div className="grid grid-cols-1 gap-5 sm:gap-6">
                                            <div className="space-y-2 sm:space-y-3">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-[#0D6E5E]">Base Estratégica</p>
                                                <p className="text-base sm:text-lg font-medium text-black/65 leading-relaxed">{c.gancho}</p>
                                            </div>
                                            <motion.div whileHover={{ scale: 1.02 }} className="p-5 sm:p-7 bg-[#f8f6f0] rounded-2xl sm:rounded-3xl space-y-2 sm:space-y-3">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-black/30">Estrutura do Conteúdo</p>
                                                <p className="text-sm sm:text-base font-bold text-black/75 leading-relaxed">{c.estrutura}</p>
                                            </motion.div>
                                        </div>
                                    </div>

                                    <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
                                        className="pt-6 sm:pt-8 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group-hover:border-[#bff720]/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-2.5 h-2.5 rounded-full bg-[#bff720]" />
                                            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-black/40">Call to action:</span>
                                        </div>
                                        <span className="text-[10px] sm:text-xs font-black text-black uppercase tracking-widest bg-[#bff720]/15 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg self-start sm:self-auto">{c.cta}</span>
                                    </motion.div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>
            ))}
      </div>

      <footer className="bg-black py-20 sm:py-32 border-t border-white/[0.06] flex flex-col items-center justify-center text-center px-4 sm:px-8 relative overflow-hidden">
           {/* Background Effects */}
           <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
           <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 6, repeat: Infinity }} 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#bff720]/5 rounded-full blur-[150px]" />
           
           <div className="relative z-10 flex flex-col items-center">
                <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="relative mb-10 sm:mb-16">
                    <div className="absolute -inset-16 bg-[#bff720]/10 blur-[80px] rounded-full pointer-events-none" />
                    <img src={LogoInova} className="h-14 sm:h-20 lg:h-28 brightness-0 invert opacity-50 relative z-10" alt="Inova" />
                </motion.div>
                <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="space-y-6 sm:space-y-8 max-w-xl">
                    <h4 className="text-lg sm:text-2xl font-black text-white uppercase tracking-[6px] sm:tracking-[12px]">Estratégia <span className="text-[#bff720]">&</span> ROI</h4>
                    <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-[#bff720] to-transparent mx-auto" />
                    <p className="text-white/[0.25] text-[10px] font-medium leading-relaxed uppercase tracking-[3px] sm:tracking-[4px] break-words">
                        Este documento é confidencial e exclusivo<br />para @{clienteNome.replace('@','')}.<br />
                        © 2026 INOVA Co. High Performance Marketing.
                    </p>
                </motion.div>
           </div>
      </footer>
    </div>
  );
}
