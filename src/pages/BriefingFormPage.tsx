import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import logoInova from '@/assets/logo-inova.png';
import { CheckCircle2, ChevronRight, Loader2, Send, Sparkles, Trophy, Target as TargetIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WEBHOOK_CONFIG } from '@/config/webhooks';

const GIFS = {
  WELCOME: "https://media2.giphy.com/media/XD9o33QG9BoMis7iM4/giphy.gif?cid=fe3852a3ihg8rvipzzky5lybmdyq38fhke2tkrnshwk52c7d&rid=giphy.gif&ct=g",
  HAPPY: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTN2Njg1dHhsNGZrZTN5Nmg3NXJoMXBsOHkwMHkzY2M0aGt1Z2NxdSZlcD12MV9naWZzX3RyZW5kaW5nJmN0PWc/MDJ9IbxxvDUQM/giphy.gif",
};

const COLORS = {
  PRIMARY: '#bff720', // Verde Limão
  SECONDARY: '#015f57', // Verde Escuro
  BG_WINE: '#370616', // Vinho Escuro
  BG_BLACK: '#000000',
  TEXT_LIGHT: '#f8f8f8',
  TEXT_BEIGE: '#fff7e8',
};

/* ── Types ──────────────────────────────────────────── */
interface BriefingData {
  company_name: string;
  responsible_name: string;
  phone: string;
  segment: string;
  instagram: string;
  goals_3_months: string;
  target_age_range: string;
  target_gender: string;
  audience_pain_points: string;
  audience_desires: string;
  purchase_triggers: string;
  purchase_blockers: string;
  current_perception: string;
  desired_perception: string;
  differentials: string;
  competitors: string;
  communication_style: string;
  things_to_avoid: string;
  monthly_revenue: string;
}

const INITIAL: BriefingData = {
  company_name: '',
  responsible_name: '',
  phone: '',
  segment: '',
  instagram: '',
  goals_3_months: '',
  target_age_range: '',
  target_gender: '',
  audience_pain_points: '',
  audience_desires: '',
  purchase_triggers: '',
  purchase_blockers: '',
  current_perception: '',
  desired_perception: '',
  differentials: '',
  competitors: '',
  communication_style: '',
  things_to_avoid: '',
  monthly_revenue: '',
};

/* ── Step definitions ───────────────────────────────── */
interface Step {
  id: string;
  section: string;
  botMessage: string | ((data: BriefingData) => string);
  gif?: string;
  type: 'welcome' | 'text' | 'textarea' | 'choice';
  field?: keyof BriefingData;
  options?: string[];
  placeholder?: string;
}

const STEPS: Step[] = [
  {
    id: 'welcome',
    section: 'Boas-vindas',
    botMessage: 'Olá! 👋 Que bom te ver por aqui. VAMOS JUNTOS construir a base estratégica da sua marca.\n\nEsse briefing é o primeiro passo pra eu entender quem é você, o que sua empresa representa e como podemos posicionar ela com força no digital.\n\nBora construir algo FODA juntos?',
    gif: GIFS.WELCOME,
    type: 'welcome',
  },
  {
    id: 'company_name',
    section: 'Informações Básicas',
    botMessage: 'Qual nome da empresa/marca que vamos estruturar?',
    type: 'text',
    field: 'company_name',
    placeholder: 'Ex: Inova Co.',
  },
  {
    id: 'responsible_name',
    section: 'Informações Básicas',
    botMessage: 'Quem é o responsável pelo projeto?',
    type: 'text',
    field: 'responsible_name',
    placeholder: 'Seu nome completo',
  },
  {
    id: 'phone',
    section: 'Informações Básicas',
    botMessage: 'Qual seu telefone / WhatsApp?',
    type: 'text',
    field: 'phone',
    placeholder: '(00) 00000-0000',
  },
  {
    id: 'segment',
    section: 'Informações Básicas',
    botMessage: 'Qual é o seu segmento?',
    type: 'text',
    field: 'segment',
    placeholder: 'Ex: Moda, Gastronomia, Educação...',
  },
  {
    id: 'instagram',
    section: 'Informações Básicas',
    botMessage: 'Qual o @ do seu Instagram?',
    type: 'text',
    field: 'instagram',
    placeholder: '@suamarca',
  },
  {
    id: 'goals_3_months',
    section: 'Objetivos Estratégicos',
    botMessage: (d) => `Fala ${d.responsible_name.split(' ')[0]}, tudo na paz?\n\nShow ter você aqui. Agora vamos para a parte estratégica! 🎯\n\nO que você gostaria de conquistar nos próximos 3 meses?`,
    gif: GIFS.HAPPY,
    type: 'textarea',
    field: 'goals_3_months',
    placeholder: 'Descreva seus principais objetivos...',
  },
  {
    id: 'target_age_range',
    section: 'Público-Alvo',
    botMessage: 'Vamos entender seu público! 👥\n\nQual a faixa etária principal do seu público?',
    type: 'choice',
    field: 'target_age_range',
    options: ['18–24', '25–34', '35–44', '45+'],
  },
  {
    id: 'target_gender',
    section: 'Público-Alvo',
    botMessage: 'Qual o gênero predominante?',
    type: 'choice',
    field: 'target_gender',
    options: ['Masculino', 'Feminino', 'Ambos'],
  },
  {
    id: 'audience_pain_points',
    section: 'Público-Alvo',
    botMessage: 'Quais são as maiores dores desse cliente hoje?',
    type: 'textarea',
    field: 'audience_pain_points',
    placeholder: 'O que mais incomoda seu público-alvo...',
  },
  {
    id: 'audience_desires',
    section: 'Público-Alvo',
    botMessage: 'Quais são os maiores desejos dele?',
    type: 'textarea',
    field: 'audience_desires',
    placeholder: 'O que seu público mais deseja alcançar...',
  },
  {
    id: 'purchase_triggers',
    section: 'Público-Alvo',
    botMessage: 'O que normalmente faz ele decidir comprar?',
    type: 'textarea',
    field: 'purchase_triggers',
    placeholder: 'Gatilhos de decisão de compra...',
  },
  {
    id: 'purchase_blockers',
    section: 'Público-Alvo',
    botMessage: 'O que costuma impedir a compra?',
    type: 'textarea',
    field: 'purchase_blockers',
    placeholder: 'Objeções e barreiras comuns...',
  },
  {
    id: 'current_perception',
    section: 'Posicionamento de Marca',
    botMessage: 'Agora, sobre sua marca! ✨\n\nHoje, como você acredita que sua marca é percebida?',
    type: 'textarea',
    field: 'current_perception',
    placeholder: 'Como as pessoas enxergam sua marca hoje...',
  },
  {
    id: 'desired_perception',
    section: 'Posicionamento de Marca',
    botMessage: 'Como gostaria de ser reconhecido?',
    type: 'textarea',
    field: 'desired_perception',
    placeholder: 'A imagem ideal da sua marca...',
  },
  {
    id: 'differentials',
    section: 'Posicionamento de Marca',
    botMessage: 'O que torna sua empresa diferente, qual é seu diferencial?',
    type: 'textarea',
    field: 'differentials',
    placeholder: 'Seus diferenciais competitivos...',
  },
  {
    id: 'competitors',
    section: 'Referências e Estilo',
    botMessage: 'Quase lá! 🚀\n\nQuem são seus principais concorrentes ou referências?',
    type: 'textarea',
    field: 'competitors',
    placeholder: 'Marcas que você admira ou compete...',
  },
  {
    id: 'communication_style',
    section: 'Referências e Estilo',
    botMessage: 'Qual estilo de comunicação combina mais com sua marca?',
    type: 'choice',
    field: 'communication_style',
    options: ['Profissional', 'Próximo', 'Educativo', 'Inspirador', 'Descontraído'],
  },
  {
    id: 'things_to_avoid',
    section: 'Referências e Estilo',
    botMessage: 'Existe algo que devemos evitar na comunicação?',
    type: 'textarea',
    field: 'things_to_avoid',
    placeholder: 'Coisas que NÃO representam sua marca...',
  },
  {
    id: 'monthly_revenue',
    section: 'Finalização',
    botMessage: 'Por fim, qual o faturamento médio mensal?',
    type: 'choice',
    field: 'monthly_revenue',
    options: ['R$20.000 +', 'R$40.000 +', 'R$60.000 +', 'R$100.000 +'],
  },
];

const TOTAL_STEPS = STEPS.length;

/* ── Helpers ────────────────────────────────────────── */
function getSectionColor(section: string) {
  const map: Record<string, string> = {
    'Boas-vindas': 'bg-[#bff720] text-black',
    'Informações Básicas': 'bg-violet-600 text-white',
    'Objetivos Estratégicos': 'bg-pink-600 text-white',
    'Público-Alvo': 'bg-blue-600 text-white',
    'Posicionamento de Marca': 'bg-emerald-600 text-white',
    'Referências e Estilo': 'bg-amber-600 text-white',
    'Finalização': 'bg-red-600 text-white',
  };
  return map[section] || 'bg-primary text-black';
}

/* ── Chat Bubble Components ─────────────────────────── */
function BotBubble({ text, gif, animate }: { text: string; gif?: string; animate: boolean }) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20, y: 10 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className={`flex gap-3 items-start mb-6`}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#015f57] flex items-center justify-center shadow-lg border border-white/10 ring-2 ring-[#bff720]/20">
        <Sparkles className="w-5 h-5 text-[#bff720]" />
      </div>
      <div className="space-y-3 max-w-[85%] sm:max-w-lg">
        {gif && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl overflow-hidden border-2 border-[#bff720]/30 shadow-2xl shadow-[#bff720]/10 w-full max-w-sm aspect-video bg-black/40"
          >
            <img src={gif} alt="Bot expression" className="w-full h-full object-cover" />
          </motion.div>
        )}
        <div className="bg-[#015f57]/40 backdrop-blur-md border border-white/10 rounded-2xl rounded-tl-md px-6 py-4 shadow-2xl">
          <p className="text-[15px] text-[#f8f8f8] whitespace-pre-line leading-relaxed font-medium">{text}</p>
        </div>
      </div>
    </motion.div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20, y: 10 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      className="flex justify-end mb-6"
    >
      <div className="bg-[#bff720] rounded-2xl rounded-tr-md px-6 py-3.5 max-w-[80%] shadow-xl shadow-[#bff720]/10 border border-black/10">
        <p className="text-[15px] text-black font-bold leading-relaxed">{text}</p>
      </div>
    </motion.div>
  );
}

/* ── Main Component ─────────────────────────────────── */
interface BriefingFormProps {
  /** Quando vem do link de onboarding, o briefing é salvo na ficha do cliente */
  onboardingToken?: string;
  /** Mostra "Continuar" na tela final para voltar às etapas do onboarding */
  onDone?: () => void;
}

export default function BriefingFormPage({ onboardingToken, onDone }: BriefingFormProps = {}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<BriefingData>(INITIAL);
  const [inputValue, setInputValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<{ type: 'bot' | 'user'; text: string; gif?: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const step = STEPS[currentStep];
  const progress = ((currentStep) / TOTAL_STEPS) * 100;
  const isLastStep = currentStep === TOTAL_STEPS - 1;

  // Resolve bot message (can be string or function)
  const currentBotMessage = typeof step.botMessage === 'function' ? step.botMessage(data) : step.botMessage;

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const scrollHeight = scrollRef.current.scrollHeight;
      scrollRef.current.scrollTo({ top: scrollHeight, behavior: 'smooth' });
    }
  }, [history, currentStep]);

  // Focus input
  useEffect(() => {
    if (step?.type === 'text') inputRef.current?.focus();
    if (step?.type === 'textarea') textareaRef.current?.focus();
  }, [currentStep, step?.type]);

  const advance = (answer: string) => {
    // Save the bot message and user answer to history
    setHistory(prev => [
      ...prev,
      { type: 'bot', text: currentBotMessage, gif: step.gif },
      { type: 'user', text: answer },
    ]);

    // Update data
    const newData = { ...data };
    if (step.field) {
      newData[step.field!] = answer;
      setData(newData);
    }

    setInputValue('');

    // Move to next step or submit
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleSubmit(newData);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    advance(inputValue.trim());
  };

  const handleChoiceClick = (option: string) => {
    advance(option);
  };

  const handleWelcome = () => {
    setHistory(prev => [
      ...prev,
      { type: 'bot', text: currentBotMessage, gif: step.gif },
      { type: 'user', text: 'Bora! 🚀' },
    ]);
    setCurrentStep(1);
  };

  const handleSubmit = async (finalData: BriefingData) => {
    setSubmitting(true);
    setHistory(prev => [
      ...prev,
      { type: 'bot', text: 'Excelente trabalho! 🏆 Suas respostas estão sendo enviadas para análise estratégica...' },
    ]);

    const briefingData = {
      ...finalData,
      status: 'novo',
      created_at: new Date().toISOString(),
    };

    try {
      const webhookUrl = WEBHOOK_CONFIG.GOOGLE_SHEETS_URL || import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL;
      
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
              ...briefingData,
              origem: 'Plataforma Inova (Auto-Sync)'
            }),
          });
        } catch (webhookError) {
          console.error('Webhook error:', webhookError);
        }
      }

      if (onboardingToken) {
        const { data: res, error } = await supabase.functions.invoke('client-onboarding', {
          body: { action: 'briefing', token: onboardingToken, data: finalData },
        });
        if (error || res?.error) throw new Error(res?.error || error?.message || 'Falha ao salvar');
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error('SUBMISSION_ERROR:', err);
      setHistory(prev => [
        ...prev,
        { type: 'bot', text: `Ops! Ocorreu um erro ao salvar: ${err.message || 'Erro desconhecido'}. Você pode tentar mais uma vez?` },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Success State ────────────────────────────────── */
  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#370616]/40 via-black to-black" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#bff720]/5 rounded-full blur-[120px]" />
        
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative text-center space-y-12 max-w-lg p-12"
        >
          <div className="flex justify-center mb-4">
            <img src={logoInova} alt="Inova Co." className="h-16 brightness-200" />
          </div>
          
          <div className="space-y-6">
            <div className="w-16 h-1 bg-[#bff720] mx-auto rounded-full" />
            <h1 className="text-4xl font-black text-white tracking-tight uppercase">Briefing Recebido</h1>
            <div className="space-y-2">
              <p className="text-[#fff7e8]/60 text-lg uppercase tracking-widest font-bold">Cliente Identificado:</p>
              <p className="text-[#bff720] text-3xl font-black uppercase">{data.company_name}</p>
            </div>
            <p className="text-[#fff7e8]/40 text-sm">
              Suas informações foram salvas com sucesso em nossa base estratégica.
            </p>
          </div>
          {onDone && (
            <button onClick={onDone}
              className="mx-auto flex h-12 items-center gap-2 rounded-xl bg-[#bff720] px-6 font-bold text-black transition-transform active:scale-[0.97]">
              Continuar o onboarding →
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  /* ── Form UI ──────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden text-[#f8f8f8]">
      {/* Background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#370616] to-transparent opacity-60" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#015f57]/20 rounded-full blur-[100px]" />
      </div>

      {/* Header / Nav */}
      <header className="relative z-20 border-b border-white/5 bg-black/60 backdrop-blur-2xl">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logoInova} alt="Inova" className="h-8 brightness-0 invert" />
            <div className="h-6 w-px bg-white/10 hidden sm:block" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#bff720] hidden sm:block">
              Briefing Strategy v1.0
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${getSectionColor(step.section)} shadow-lg`}>
              {step.section}
            </div>
            <div className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-white/40">LVL</span>
              <span className="text-[13px] font-black text-[#bff720] tabular-nums">
                {currentStep + 1}/{TOTAL_STEPS}
              </span>
            </div>
          </div>
        </div>
        {/* Gamified progress bar */}
        <div className="h-1.5 bg-white/5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-gradient-to-r from-[#bff720] to-[#015f57] border-r-2 border-[#bff720] shadow-[0_0_15px_rgba(191,247,32,0.4)]"
            transition={{ type: 'spring', bounce: 0, duration: 0.8 }}
          />
        </div>
      </header>

      {/* Chat canvas */}
      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto pt-8 pb-12">
        <div className="mx-auto max-w-3xl px-6">
          <AnimatePresence mode="popLayout">
            {/* History */}
            {history.map((msg, i) => (
              msg.type === 'bot'
                ? <BotBubble key={`bot-${i}`} text={msg.text} gif={msg.gif} animate={true} />
                : <UserBubble key={`user-${i}`} text={msg.text} />
            ))}

            {/* Current Bot Step */}
            {!submitting && (
              <BotBubble key={`current-${currentStep}`} text={currentBotMessage} gif={step.gif} animate={true} />
            )}

            {/* Submitting indicator */}
            {submitting && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3 items-center py-4"
              >
                <div className="w-10 h-10 rounded-xl bg-[#015f57] flex items-center justify-center animate-pulse">
                  <Loader2 className="w-5 h-5 text-[#bff720] animate-spin" />
                </div>
                <p className="text-sm font-bold text-[#bff720] uppercase tracking-widest animate-pulse">Processing Intel...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Interaction panel */}
      <div className="relative z-20 border-t border-white/5 bg-black/80 backdrop-blur-3xl">
        <div className="mx-auto max-w-3xl px-6 py-6 sm:py-8">
          <div className="relative">
            {step.type === 'welcome' && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleWelcome}
                className="w-full py-5 rounded-2xl font-black text-lg text-black bg-[#bff720] hover:bg-[#aee610] transition-all duration-300 shadow-[0_0_30px_rgba(191,247,32,0.2)] flex items-center justify-center gap-3 uppercase tracking-widest"
              >
                Start Mission 🚀
                <ChevronRight className="w-6 h-6" />
              </motion.button>
            )}

            {step.type === 'text' && (
              <form onSubmit={handleTextSubmit} className="flex gap-3 group">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder={step.placeholder}
                  className="flex-1 bg-white/[0.03] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/10 focus:border-[#bff720]/50 rounded-2xl px-6 py-4 text-base text-white placeholder:text-white/20 focus:outline-none ring-[#bff720]/0 focus:ring-4 focus:ring-[#bff720]/10 transition-all"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="bg-[#bff720] hover:bg-[#aee610] disabled:opacity-20 disabled:grayscale text-black rounded-2xl px-6 py-4 transition-all duration-300 shadow-xl shadow-[#bff720]/10 shrink-0"
                >
                  <Send className="w-6 h-6" />
                </button>
              </form>
            )}

            {step.type === 'textarea' && (
              <form onSubmit={handleTextSubmit} className="space-y-3">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder={step.placeholder}
                  rows={4}
                  className="w-full bg-white/[0.03] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/10 focus:border-[#bff720]/50 rounded-2xl px-6 py-4 text-base text-white placeholder:text-white/20 focus:outline-none ring-[#bff720]/0 focus:ring-4 focus:ring-[#bff720]/10 transition-all resize-none"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleTextSubmit(e);
                    }
                  }}
                />
                <div className="flex justify-between items-center px-2">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/30">
                    <span className="px-1.5 py-0.5 rounded border border-white/10">SHIFT</span>
                    <span>+</span>
                    <span className="px-1.5 py-0.5 rounded border border-white/10">ENTER</span>
                    <span className="ml-2">para quebrar linha</span>
                  </div>
                  <button
                    type="submit"
                    disabled={!inputValue.trim()}
                    className="bg-[#bff720] hover:bg-[#aee610] disabled:opacity-20 text-black rounded-2xl px-8 py-3.5 text-sm font-black uppercase tracking-widest transition-all duration-300 shadow-xl shadow-[#bff720]/10 flex items-center gap-3"
                  >
                    Confirm
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {step.type === 'choice' && (
              <div className={`grid gap-3 ${step.options!.length <= 3 ? 'grid-cols-' + step.options!.length : 'grid-cols-2 sm:grid-cols-4'}`}>
                {step.options!.map((option, idx) => (
                  <motion.button
                    key={option}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleChoiceClick(option)}
                    className="bg-white/[0.03] hover:bg-[#bff720] border border-white/10 hover:border-transparent rounded-2xl px-4 py-5 text-sm font-bold text-white/70 hover:text-black transition-all duration-300 shadow-lg relative overflow-hidden group"
                  >
                    <span className="relative z-10">{option}</span>
                    <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-100 transition-opacity">
                      <TargetIcon className="w-3 h-3" />
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
