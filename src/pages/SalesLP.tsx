import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, Target, Sparkles, Plus, Video, Camera, BarChart3, 
  Zap, Shield, Users, Monitor, Mic, Lightbulb, Play, Share2,
  CheckCircle2, Star, Globe, Smartphone, Layers, Heart, Crown,
  Trophy, Flame, Activity, Clock, MapPin, Check, ArrowUpRight,
  Quote, ChevronRight, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import LogoInova from '@/assets/logo-inova.png';
import { useSeo } from '@/lib/seo';
import { PAGE_THUMBS } from '@/lib/pageThumbs';

const ASSETS = {
  restaurant: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=1200",
  personal: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=1200",
  clinica: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=1200",
  lawyer: "https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&q=80&w=1200",
  realestate: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=1200",
  studio: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&q=80&w=1200",
  team: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=800",
  editing: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&q=80&w=800",
  analytics: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800",
  social: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&q=80&w=800",
  hero: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&q=80&w=1200",
  testimonial: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400",
};

const DEFAULTS = {
  hero: { title: "Transforme sua presença digital com a Inova", tagline: "Produzimos conteúdos cinematográficos que posicionam sua marca como referência e atraem clientes de alto valor.", badge: "INOVA PRODUÇÕES • 2026", cta: "Agendar Consultoria Gratuita" },
  strategy: { problem: "Sua marca é invisível no digital. Clientes escolhem pelo Instagram e se você não aparece profissionalmente, perde para quem comunica melhor.", solution: "A Inova reconstrói sua autoridade com narrativa cinematográfica, estratégia de funil e distribuição inteligente.", results: "Autoridade Digital, Mais Clientes, Faturamento Escalável", steps: "Diagnóstico, Planejamento, Captação, Edição, Entrega" },
  styles: { heroTitleSize: "56", accentColor: "#2563eb" }
};

export default function SalesLP() {
  useSeo({
    title: 'Proposta Comercial — INOVA Co.',
    description: 'Sua proposta personalizada de marketing e produção audiovisual com a INOVA Co.',
    image: PAGE_THUMBS.comercial,
    noindex: false,
  });
  const { slug } = useParams();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
        async function loadConfig() {
          if (slug) {
            setLoading(true);
            const { data, error } = await (supabase as any)
              .from('sales_proposals')
              .select('config')
              .eq('slug', slug)
              .maybeSingle();
            
            if (data) {
              setConfig(data.config);
            } else {
              // Fallback to localStorage for editor preview IF no slug
              const saved = localStorage.getItem('agency_lp_config');
              if (saved) { try { setConfig(JSON.parse(saved)); } catch { setConfig({}); } }
              else { setConfig({}); }
            }
            setLoading(false);
          } else {
            const saved = localStorage.getItem('agency_lp_config');
            if (saved) { try { setConfig(JSON.parse(saved)); } catch { setConfig({}); } }
            else { setConfig({}); }
            setLoading(false);
          }
        }
    loadConfig();
  }, [slug]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#050508]">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );
  if (!config) return null;

  const accent = config.styles?.accentColor || DEFAULTS.styles.accentColor;
  const heroSize = config.styles?.heroTitleSize || DEFAULTS.styles.heroTitleSize;
  const layoutId = config.styles?.layoutTheme || 'light';
  const isDark = layoutId === 'dark';
  const themeImage = config.styles?.heroImage || ASSETS[config.theme as keyof typeof ASSETS] || ASSETS.hero;
  const extraBlocks = config.extraBlocks || [];

  const bgClass = isDark ? 'bg-[#050508] text-white' : layoutId === 'warm' ? 'bg-[#FDF8F4] text-stone-900' : layoutId === 'blue' ? 'bg-slate-50 text-slate-900' : 'bg-white text-gray-900';
  const navBg = isDark ? 'bg-black/60 backdrop-blur-2xl border-white/5' : 'bg-white/80 backdrop-blur-2xl border-gray-100';
  const cardBg = isDark ? 'bg-white/[0.04] border-white/[0.06]' : layoutId === 'warm' ? 'bg-white border-stone-200' : 'bg-gray-50 border-gray-100';
  const textMuted = isDark ? 'text-white/40' : 'text-gray-500';
  const textFaint = isDark ? 'text-white/20' : 'text-gray-300';

  const h = { ...DEFAULTS.hero, ...config.hero };
  const s = { ...DEFAULTS.strategy, ...config.strategy };
  const results = s.results.split(',').map((r: string) => r.trim());
  const steps = s.steps.split(',').map((r: string) => r.trim());
  const services = config.services?.length ? config.services : [
    { title: "Captação Profissional", desc: "Filmagem 4K cinematográfica no seu espaço." },
    { title: "Edição de Elite", desc: "Pós-produção de altíssima qualidade." },
    { title: "Estratégia de Funil", desc: "Distribuição otimizada para conversão." },
    { title: "Copy Estratégica", desc: "Textos que vendem e posicionam." },
    { title: "Tráfego Pago", desc: "Campanhas que atraem clientes reais." },
    { title: "Consultoria", desc: "Direcionamento estratégico de marca." },
  ];
  const plans = config.plans?.length ? config.plans : [
    { name: "Plano Start", price: "2300", features: ["6 vídeos/mês", "2 captações", "Copy estratégica"], popular: false },
    { name: "Plano Pro", price: "4500", features: ["12 vídeos/mês", "4 captações", "Funil VIP", "Tráfego incluso"], popular: true },
  ];
  const whatsapp = config.whatsapp || "5562999999999";

  const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };

  return (
    <div className={`min-h-screen ${bgClass} overflow-x-hidden`} style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ═══════════ NAVBAR ═══════════ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 ${navBg} border-b transition-all duration-300`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <img src={LogoInova} alt="Inova" className={`h-6 sm:h-7 w-auto ${isDark ? 'brightness-200' : ''}`} />
          <div className={`hidden md:flex items-center gap-10 text-[13px] font-semibold ${textMuted}`}>
            <a href="#services" className="hover:opacity-80 transition-colors">Serviços</a>
            <a href="#process" className="hover:opacity-80 transition-colors">Processo</a>
            <a href="#pricing" className="hover:opacity-80 transition-colors">Investimento</a>
          </div>
          <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
            <Button className="rounded-full h-10 px-6 text-[13px] font-bold shadow-lg transition-all hover:shadow-xl active:scale-95" style={{ backgroundColor: accent, color: isDark && accent !== '#000000' ? '#000' : '#fff' }}>
              Falar Conosco
            </Button>
          </a>
        </div>
      </nav>

      {/* ═══════════ HERO ═══════════ */}
      <section className="pt-24 sm:pt-32 pb-16 sm:pb-24 px-4 sm:px-6 relative overflow-hidden">
        {/* Gradient bg - Adjusted for mobile */}
        <div className="absolute top-0 right-0 w-[400px] sm:w-[800px] h-[400px] sm:h-[800px] rounded-full blur-[100px] sm:blur-[200px] opacity-[0.08]" style={{ backgroundColor: accent }} />
        <div className="absolute bottom-0 left-0 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] rounded-full blur-[100px] sm:blur-[200px] opacity-[0.05] bg-amber-400" />
        
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 sm:gap-16 items-center">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.7 }} className="text-center lg:text-left">
              <Badge className="bg-gray-50 text-gray-500 border-gray-200 mb-6 sm:mb-8 px-4 py-1.5 text-[10px] sm:text-[11px] font-semibold rounded-full mx-auto lg:mx-0">{h.badge}</Badge>
              <h1 className="font-black tracking-tighter leading-[1.05] mb-6 sm:mb-8 text-gray-900" style={{ fontSize: `clamp(38px, 8vw, ${heroSize}px)` }}>
                {h.title.split(' ').map((word: string, i: number) => (
                  <span key={i} className="inline-block">
                    {i > 0 && '\u00A0'}
                    {(i === 2 || i === 3) ? <span className="italic" style={{ fontFamily: "'Georgia', serif", color: accent }}>{word}</span> : word}
                  </span>
                ))}
              </h1>
              <p className={`text-base sm:text-lg ${textMuted} leading-relaxed mb-8 sm:mb-12 max-w-lg mx-auto lg:mx-0`}>{h.tagline}</p>
              <div className="flex flex-col sm:flex-row flex-wrap justify-center lg:justify-start gap-4">
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto rounded-full h-14 px-8 text-[15px] font-bold shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl active:scale-95 group" style={{ backgroundColor: accent, color: '#fff' }}>
                    {h.cta} <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </a>
                <Button variant="outline" className={`w-full sm:w-auto rounded-full h-14 px-8 text-[15px] font-bold transition-all ${isDark ? 'border-white/10 text-white/60 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  <Play className="mr-2 w-4 h-4" /> Ver Portfólio
                </Button>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.3 }} className="relative mt-10 lg:mt-0">
              <div className="relative mx-auto max-w-[500px] lg:max-w-none">
                <div className={`rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-2xl ${isDark ? 'shadow-black/40 border-white/5' : 'shadow-black/10 border-gray-100'} border`}>
                  <img src={themeImage} alt="Produção" className="w-full h-[300px] sm:h-[460px] object-cover" />
                </div>
                {/* Floating Stats Card */}
                <div className={`absolute -bottom-4 -left-4 sm:-bottom-6 sm:-left-6 ${isDark ? 'bg-gray-900 border-white/10' : 'bg-white border-gray-100'} rounded-xl sm:rounded-2xl shadow-xl border p-3 sm:p-5 flex items-center gap-3 sm:gap-4 scale-90 sm:scale-100`}>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accent}15`, color: accent }}><BarChart3 size={20} className="sm:w-6 sm:h-6" /></div>
                  <div>
                    <p className="text-xl sm:text-2xl font-black" style={{ color: accent }}>+340%</p>
                    <p className={`text-[10px] sm:text-[11px] ${textMuted} font-semibold`}>Engajamento médio</p>
                  </div>
                </div>
                {/* Floating Badge */}
                <div className={`absolute -top-4 -right-4 ${isDark ? 'bg-gray-900 border-white/10' : 'bg-white border-gray-100'} rounded-xl sm:rounded-2xl shadow-xl border p-3 sm:p-4 flex items-center gap-3 scale-90 sm:scale-100`}>
                  <div className="flex -space-x-2">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'} border-2 ${isDark ? 'border-gray-900' : 'border-white'}`} />
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full ${isDark ? 'bg-gray-600' : 'bg-gray-300'} border-2 ${isDark ? 'border-gray-900' : 'border-white'}`} />
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full ${isDark ? 'bg-gray-500' : 'bg-gray-400'} border-2 ${isDark ? 'border-gray-900' : 'border-white'}`} />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold">+50 marcas</p>
                    <p className={`text-[9px] sm:text-[10px] ${textMuted}`}>confiam na Inova</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════ TRUST BAR ═══════════ */}
      <section className={`py-8 sm:py-10 border-y ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p className={`text-center text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-6 ${textFaint}`}>Confiado por mais de 50 empresas</p>
          <div className={`flex flex-wrap items-center justify-center gap-6 sm:gap-16 text-[10px] sm:text-sm font-bold uppercase tracking-widest opacity-40 ${textFaint}`}>
            <span>Restaurante XYZ</span><span className="hidden sm:inline">•</span><span>Clínica Premium</span><span className="hidden sm:inline">•</span><span>Studio Pro</span><span className="hidden sm:inline">•</span><span>Fitness Hub</span><span className="hidden sm:inline">•</span><span>Advocacia Elite</span>
          </div>
        </div>
      </section>

      {/* ═══════════ BENTO GRID: PROBLEMA + SOLUÇÃO ═══════════ */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" variants={fadeUp} className="text-center mb-12 sm:20 px-4">
            <p className="text-[11px] sm:text-[12px] font-semibold uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-4" style={{ color: accent }}>Por que nos escolher</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-[1.1]">
              Potencialize sua <span className="italic" style={{ fontFamily: "'Georgia', serif", color: accent }}>jornada digital</span> com a Inova
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card: Problema */}
            <motion.div initial="hidden" whileInView="visible" variants={fadeUp} className={`${cardBg} rounded-[1.5rem] p-10 border flex flex-col justify-between min-h-[320px]`}>
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-widest ${textFaint} mb-6`}>O Desafio</p>
                <p className="text-xl font-bold text-gray-800 leading-relaxed">{s.problem}</p>
              </div>
              <div className={`flex items-center gap-3 mt-8 pt-6 border-t ${isDark ? 'border-white/5' : 'border-gray-200'}`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-50 text-red-400"><Target size={20} /></div>
                <p className={`text-[12px] font-bold ${textMuted}`}>Invisibilidade digital = perda de clientes</p>
              </div>
            </motion.div>

            {/* Card: Stats Bento */}
            <motion.div initial="hidden" whileInView="visible" variants={fadeUp} transition={{ delay: 0.1 }} className="flex flex-col gap-5">
              <div className="bg-gray-900 rounded-[1.5rem] p-8 text-white flex-1 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-[80px] opacity-20" style={{ backgroundColor: accent }} />
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/30">Resultado Médio</p>
                <div className="mt-auto">
                  <p className="text-4xl font-black" style={{ color: accent }}>R$ 124.000</p>
                  <p className="text-[12px] text-white/40 font-semibold mt-1">em retorno para nossos clientes</p>
                </div>
              </div>
              <div className={`${cardBg} rounded-[1.5rem] p-8 border flex-1 flex flex-col justify-between`}>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-300">Satisfação</p>
                <div className="mt-auto flex items-end gap-2">
                  <p className="text-4xl font-black text-gray-900">98%</p>
                  <div className="flex gap-0.5 mb-2">
                    {[...Array(5)].map((_, i) => <Star key={i} size={14} className="fill-amber-400 text-amber-400" />)}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Card: Solução */}
            <motion.div initial="hidden" whileInView="visible" variants={fadeUp} transition={{ delay: 0.2 }} className="rounded-[1.5rem] p-10 border border-gray-100 flex flex-col justify-between min-h-[320px] relative overflow-hidden" style={{ backgroundColor: accent }}>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-6">A Solução</p>
                <p className="text-xl font-bold text-white leading-relaxed">{s.solution}</p>
              </div>
              <div className="flex items-center gap-3 mt-8 pt-6 border-t border-white/10">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 text-white"><Sparkles size={20} /></div>
                <p className="text-[12px] font-bold text-white/60">Narrativa + Estratégia + Performance</p>
              </div>
            </motion.div>
          </div>

          {/* Large Photo Block */}
          <motion.div initial="hidden" whileInView="visible" variants={fadeUp} className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2 rounded-[1.5rem] overflow-hidden relative min-h-[300px] group border border-gray-100">
              <img src={ASSETS.editing} alt="Edição" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
              <div className="absolute bottom-10 left-10 text-white">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-3">Bastidores</p>
                <p className="text-3xl font-black tracking-tight">Produção cinematográfica de ponta a ponta</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-[1.5rem] p-8 border border-gray-100 flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-6">
                <img src={ASSETS.testimonial} alt="Cliente" className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md" />
                <div>
                  <p className="text-sm font-bold">Alexandre Costa</p>
                  <p className="text-[11px] text-gray-400">CEO, Restaurante Premium</p>
                </div>
              </div>
              <p className="text-gray-600 text-[14px] leading-relaxed italic">"A Inova transformou completamente nossa presença digital. Em 3 meses, triplicamos nossas reservas vindas do Instagram."</p>
              <div className="flex gap-0.5 mt-6">
                {[...Array(5)].map((_, i) => <Star key={i} size={16} className="fill-amber-400 text-amber-400" />)}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════ SERVIÇOS: LISTA + IMAGEM ═══════════ */}
      <section id="services" className="py-24 px-6 bg-gray-50/50">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" variants={fadeUp} className="text-center mb-20">
            <p className="text-[12px] font-semibold uppercase tracking-[0.3em] mb-4" style={{ color: accent }}>Arsenal Completo</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.1]">
              Tudo que você precisa em <span className="italic" style={{ fontFamily: "'Georgia', serif", color: accent }}>um só lugar</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-2">
              {services.map((svc: any, i: number) => {
                const icons = [Video, Camera, Zap, Lightbulb, Globe, Shield];
                const Icon = icons[i % icons.length];
                return (
                  <motion.div initial="hidden" whileInView="visible" variants={fadeUp} transition={{ delay: i * 0.06 }} key={i}
                    className="flex items-start gap-5 p-6 rounded-2xl hover:bg-white hover:shadow-lg hover:shadow-gray-100 transition-all group cursor-default border border-transparent hover:border-gray-100">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors" style={{ backgroundColor: `${accent}10`, color: accent }}>
                      <Icon size={22} />
                    </div>
                    <div>
                      <h4 className="text-[15px] font-bold text-gray-900 mb-1">{svc.title}</h4>
                      <p className="text-[13px] text-gray-400 leading-relaxed">{svc.desc}</p>
                    </div>
                    <ArrowUpRight size={18} className="text-gray-200 group-hover:text-gray-400 transition-colors ml-auto mt-1 shrink-0" />
                  </motion.div>
                );
              })}
            </div>

            <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} className="relative">
              <div className="rounded-[2rem] overflow-hidden shadow-2xl shadow-black/10 border border-gray-100">
                <img src={ASSETS.team} alt="Equipe Inova" className="w-full h-[500px] object-cover" />
              </div>
              <div className="absolute -bottom-5 -right-5 bg-white rounded-2xl shadow-xl border border-gray-100 p-5">
                <p className="text-3xl font-black" style={{ color: accent }}>+50</p>
                <p className="text-[11px] text-gray-400 font-semibold">projetos entregues</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════ PROCESSO ═══════════ */}
      <section id="process" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" variants={fadeUp} className="text-center mb-12 sm:20">
            <p className="text-[12px] font-semibold uppercase tracking-[0.3em] mb-4" style={{ color: accent }}>Como Funciona</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight">
              Processo <span className="italic" style={{ fontFamily: "'Georgia', serif", color: accent }}>simples e eficiente</span>
            </h2>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {steps.map((step: string, i: number) => (
              <motion.div initial="hidden" whileInView="visible" variants={fadeUp} transition={{ delay: i * 0.1 }} key={i}
                className="bg-gray-50 rounded-2xl p-8 border border-gray-100 text-center group hover:shadow-lg hover:shadow-gray-100 hover:bg-white transition-all relative">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-6 text-white font-black text-lg" style={{ backgroundColor: accent }}>{i + 1}</div>
                <p className="text-[15px] font-bold text-gray-800">{step}</p>
                {i < steps.length - 1 && <ChevronRight className="absolute top-1/2 -right-3 text-gray-200 hidden md:block" size={20} />}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ INVESTIMENTO ═══════════ */}
      <section id="pricing" className="py-24 px-6 bg-gray-50/50">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" variants={fadeUp} className="text-center mb-20">
            <p className="text-[12px] font-semibold uppercase tracking-[0.3em] mb-4" style={{ color: accent }}>Investimento</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">
              Investimento <span className="italic" style={{ fontFamily: "'Georgia', serif", color: accent }}>transparente</span>
            </h2>
            <p className="text-gray-400 mt-4 text-lg max-w-xl mx-auto">Escolha o plano ideal para o momento do seu negócio.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {plans.slice(0, 2).map((p: any, i: number) => (
              <motion.div initial="hidden" whileInView="visible" variants={fadeUp} transition={{ delay: i * 0.15 }} key={i}
                className={`rounded-[2rem] p-10 flex flex-col justify-between min-h-[520px] border-2 transition-all ${p.popular ? 'bg-gray-900 text-white shadow-2xl shadow-gray-900/20 scale-[1.02]' : 'bg-white border-gray-100 hover:shadow-xl hover:shadow-gray-100'}`}
                style={{ borderColor: p.popular ? 'transparent' : undefined }}>
                <div>
                  <div className="flex justify-between items-start mb-8">
                    <h4 className={`text-[13px] font-bold uppercase tracking-widest ${p.popular ? 'text-white/40' : 'text-gray-300'}`}>{p.name}</h4>
                    {p.popular && <Badge className="text-[10px] font-bold px-4 py-1 rounded-full" style={{ backgroundColor: accent, color: '#fff' }}>Mais Popular</Badge>}
                  </div>
                  <div className="mb-10">
                    <span className={`text-[14px] font-bold ${p.popular ? 'text-white/30' : 'text-gray-300'}`}>R$</span>
                    <span className="text-6xl font-black tracking-tighter">{p.price}</span>
                    <span className={`text-[14px] font-semibold ${p.popular ? 'text-white/30' : 'text-gray-300'}`}>/mês</span>
                  </div>
                  <div className="space-y-4">
                    {(p.features || []).map((f: string, j: number) => (
                      <div key={j} className={`flex items-center gap-3 text-[14px] font-medium ${p.popular ? 'text-white/60' : 'text-gray-500'}`}>
                        <Check className="w-5 h-5 shrink-0" style={{ color: accent }} /> {f}
                      </div>
                    ))}
                  </div>
                </div>
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="mt-10">
                  <Button className={`w-full h-14 rounded-full font-bold text-[15px] transition-all active:scale-95 ${p.popular ? 'shadow-lg' : 'border-2 border-gray-200 bg-white text-gray-900 hover:bg-gray-50'}`}
                    style={p.popular ? { backgroundColor: accent, color: '#fff' } : {}}>
                    Iniciar Projeto
                  </Button>
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ EXTRA BLOCKS ═══════════ */}
      {extraBlocks.map((block: any, i: number) => (
        <motion.section key={i} initial="hidden" whileInView="visible" variants={fadeUp} className="px-6 py-16">
          <div className="max-w-7xl mx-auto">
            {block.type === 'text' ? (
              <div>
                <h2 className="text-3xl font-black tracking-tight mb-6">{block.title}</h2>
                <p className={`text-lg ${textMuted} leading-relaxed max-w-3xl`}>{block.body}</p>
              </div>
            ) : (
              <div>
                <img src={block.url} alt={block.caption || ''} className="w-full h-[400px] object-cover rounded-[2rem]" />
                {block.caption && <p className={`text-center text-sm ${textMuted} mt-4 font-medium italic`}>{block.caption}</p>}
              </div>
            )}
          </div>
        </motion.section>
      ))}

      {/* ═══════════ CTA FINAL ═══════════ */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ background: `linear-gradient(135deg, ${accent}, #f59e0b)` }} />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div initial="hidden" whileInView="visible" variants={fadeUp}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-12 shadow-xl" style={{ backgroundColor: `${accent}15`, color: accent }}>
              <Sparkles size={36} />
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.1] mb-8">
              Pronto para <span className="italic" style={{ fontFamily: "'Georgia', serif", color: accent }}>escalar?</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto mb-12">Entre em contato e descubra como podemos transformar a presença digital da sua marca.</p>
            <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
              <Button className="rounded-full h-16 px-12 text-[16px] font-bold shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:scale-105 active:scale-95" style={{ backgroundColor: accent, color: '#fff' }}>
                {h.cta} <ArrowRight className="ml-3 w-5 h-5" />
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className={`py-16 px-6 border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <img src={LogoInova} alt="Inova" className={`h-6 w-auto ${isDark ? 'brightness-200' : ''}`} />
            <span className={`text-[12px] ${textFaint} font-semibold`}>© 2026 Inova Produções</span>
          </div>
          <div className={`flex items-center gap-8 text-[13px] font-semibold ${textMuted}`}>
            <a href="#services" className="hover:opacity-80 transition-colors">Serviços</a>
            <a href="#pricing" className="hover:opacity-80 transition-colors">Investimento</a>
            <a href={`https://wa.me/${whatsapp}`} className="hover:opacity-80 transition-colors">Contato</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
