import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Save, Eye, Trash2, Plus, 
  Download, Loader2 as Spinner, ChevronDown, ChevronRight, X, Link as LinkIcon,
  CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, Sparkles, Target, Zap, TrendingUp,
  ShoppingBag, Briefcase, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import LogoInova from '@/assets/logo-inova.png';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/contexts/AuthContext';
import { DIAGNOSTIC_RULES, DiagnosticRule, BusinessType } from '@/data/diagnosticRules';
import { AIVisionConverter } from '@/components/diagnostic/AIVisionConverter';

/* ═══════ THEME COLORS ═══════ */
const THEMES: Record<string, { primary: string; primaryDark: string }> = {
  teal: { primary: '#0D6E5E', primaryDark: '#095045' },
  burgundy: { primary: '#3A0A1E', primaryDark: '#2A0616' },
  black: { primary: '#000000', primaryDark: '#111111' },
};

/* ═══════ HELPER COMPONENTS ═══════ */
const ScoreBar = ({ label, percentage, color }: any) => (
  <div className="space-y-1">
    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/60">
      <span>{label}</span>
      <span>{Math.round(percentage)}%</span>
    </div>
    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
      <div 
        className="h-full transition-all duration-1000" 
        style={{ width: `${percentage}%`, backgroundColor: color }} 
      />
    </div>
  </div>
);

/* ═══════ MAIN EDITOR ═══════ */
export default function DiagnosticEditorPage() {
  const { user } = useAuth();
  const { editSlug } = useParams();
  const [step, setStep] = useState<'setup' | 'choice' | 'wizard' | 'ai_upload' | 'preview'>('setup');
  const [wizardStep, setWizardStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [clientInfo, setClientInfo] = useState<{nome: string; nicho: string; subtitulo: string; tema: string; primaryColor?: string; tipo: BusinessType; instaAgencia?: string; whatsAgencia?: string}>({ 
    nome: '', nicho: '', subtitulo: 'Diagnóstico de Maturidade Estratégica', tema: 'teal', primaryColor: '#0D6E5E', tipo: 'servico', instaAgencia: '@inovaco.br', whatsAgencia: '(62) 99999-9999' 
  });
  const [slug, setSlug] = useState('');
  const [config, setConfig] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isRefining, setIsRefining] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Filtra as regras baseado no tipo de negócio
  const filteredRules = useMemo(() => {
    return DIAGNOSTIC_RULES.filter(rule => !rule.onlyFor || rule.onlyFor === clientInfo.tipo);
  }, [clientInfo.tipo]);

  useEffect(() => {
    const fetchExisting = async () => {
        const stored = localStorage.getItem('agency_diagnostic_config_v5');
        if (stored) {
            try { 
              const data = JSON.parse(stored);
              if (data.cliente) {
                setConfig(data); 
                setClientInfo({
                  ...clientInfo,
                  ...data.cliente,
                  tipo: data.cliente.tipo || 'servico'
                });
                setStep('preview');
              }
            } catch (e) { console.error(e); }
        }
    };
    fetchExisting();
    fetchHistory();
    if (editSlug) {
      loadBySlug(editSlug);
    }
  }, [user, editSlug]);

  const loadBySlug = async (s: string) => {
    try {
      const { data, error } = await supabase
        .from('diagnostics' as any)
        .select('*')
        .eq('slug', s)
        .maybeSingle();

      const d = data as any;
      if (d && d.config) {
        setConfig(d.config);
        setClientInfo(d.config.cliente || clientInfo);
        setSlug(d.slug);
        setStep('preview');
      }
    } catch (e) {
      console.error('Error loading by slug:', e);
    }
  };

  const fetchHistory = async () => {
    if (!user) return;
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('diagnostics' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadFromHistory = (item: any) => {
    setConfig(item.config);
    setClientInfo(item.config.cliente || clientInfo);
    setSlug(item.slug);
    setStep('preview');
    toast.success('Diagnóstico carregado do histórico!');
  };

  const handleAIExtraction = (data: any) => {
    // Popula o estado com os dados da IA
    const newConfig = {
      cliente: {
        ...clientInfo,
        nome: data.cliente?.nome || clientInfo.nome,
        instaAgencia: clientInfo.instaAgencia,
        whatsAgencia: clientInfo.whatsAgencia
      },
      intro: { 
        titulo: 'Diagnóstico Estratégico de IA', 
        texto: data.diagnosticoFinal || `Análise estratégica baseada em inteligência visual para @${clientInfo.nome}.` 
      },
      positivos: data.presencaDigital?.positivos || [],
      negativos: data.presencaDigital?.negativos || [],
      scores: data.scores || {
        posicionamento: 75,
        presenca: 80,
        autoridade: 70,
        conversao: 65
      },
      final: {
        destaque: "Pronto para Escala",
        texto: data.diagnosticoFinal || "Diagnóstico gerado automaticamente via IA.",
        acao1: data.planoAcao?.[0] || 'Otimizar Bio e Link na Bio.',
        acao2: data.planoAcao?.[1] || 'Melhorar clareza da proposta de valor.',
        acao3: data.planoAcao?.[2] || 'Aumentar prova social e autoridade.',
        acao4: 'Refinar estratégia de conteúdo.',
        acao5: 'Implementar funil de vendas direto.'
      },
      // Dados específicos de IA (Bio + Presença detalhada)
      aiAnalise: {
        bioPositivos: data.analiseBio?.positivos || [],
        bioNegativos: data.analiseBio?.negativos || [],
        presencaPositivos: data.presencaDigital?.positivos || [],
        presencaNegativos: data.presencaDigital?.negativos || [],
        analysisImageUrl: data.imageUrl || null
      },
      semanas: [
        { 
          label: 'Semana 1', 
          titulo: 'Autoridade e Alcance', 
          cards: (data.cronograma?.semana1 || []).map((t: string) => ({
            tipo: 'Sugestão de Vídeo', 
            titulo: t, 
            gancho: 'Extraído da Análise', 
            estrutura: 'Foco: Autoridade e Alcance (Reels/Shorts)', 
            cta: 'Postar agora'
          })) 
        },
        { 
          label: 'Semana 2', 
          titulo: 'Engajamento', 
          cards: (data.cronograma?.semana2 || []).map((t: string) => ({
            tipo: 'Sugestão de Vídeo', 
            titulo: t, 
            gancho: 'Sinergia de Marca', 
            estrutura: 'Foco: Conexão e Comunidade (Reels/Stories)', 
            cta: 'Engajar agora'
          })) 
        },
        { 
          label: 'Semana 3', 
          titulo: 'Conversão', 
          cards: (data.cronograma?.semana3 || []).map((t: string) => ({
            tipo: 'Sugestão de Vídeo', 
            titulo: t, 
            gancho: 'Chamada de Ação', 
            estrutura: 'Foco: Vendas e Desejo (Reels/Direto)', 
            cta: 'Vender agora'
          })) 
        },
        { 
          label: 'Semana 4', 
          titulo: 'Retenção e Escala', 
          cards: (data.cronograma?.semana4 || []).map((t: string) => ({
            tipo: 'Sugestão de Vídeo', 
            titulo: t, 
            gancho: 'Prova Social / Viral', 
            estrutura: 'Foco: Escala e Resultados (Ads/Viral)', 
            cta: 'Escalar agora'
          })) 
        }
      ]
    };

    setConfig(newConfig);
    setStep('preview');
    localStorage.setItem('agency_diagnostic_config_v5', JSON.stringify(newConfig));
    const suggestedSlug = clientInfo.nome.toLowerCase().replace(/\s+/g, '-').replace('@','');
    if (!slug) setSlug(suggestedSlug);
  };

  const handleRefineAI = async () => {
    if (!config) return;
    setIsRefining(true);
    const toastId = toast.loading("IA aprofundando o diagnóstico...");

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `Aprofunde este diagnóstico estratégico de marketing, tornando-o mais técnico e detalhado, mas MANTENHA A CONCISÃO. Evite textos longos, foque em insights de alto impacto. Retorne o mesmo formato JSON:\n\n${JSON.stringify(config)}` }]
          }],
          generation_config: {}
        })
      });

      if (!response.ok) throw new Error("Falha ao refinar");

      const resData = await response.json();
      const text = resData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Resposta vazia");
      
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(cleanText);
      
      setConfig(result);
      toast.success("Diagnóstico refinado com IA! ✨", { id: toastId });
    } catch (err) {
      toast.error("Erro ao refinar análise.", { id: toastId });
    } finally {
      setIsRefining(false);
    }
  };

  const generateReport = (currentAnswers: Record<string, string> = answers) => {
    let positivos: string[] = [];
    let negativos: string[] = [];
    let actions: string[] = [];
    let catScores: Record<string, number> = { posicionamento: 0, presenca: 0, autoridade: 0, conversao: 0 };
    
    filteredRules.forEach(rule => {
      const answer = currentAnswers[rule.id];
      const l = rule.logic[answer];
      if (l) {
        catScores[rule.category] += l.score;
        if (l.insight) {
          if (l.isPositive) positivos.push(l.insight);
          else negativos.push(l.insight);
        }
        if (l.action) actions.push(l.action);
      }
    });

    const newConfig = {
      cliente: clientInfo,
      intro: { 
        titulo: 'Diagnóstico de Maturidade Estratégica', 
        texto: `Este diagnóstico detalha a maturidade atual da marca @${clientInfo.nome.replace('@','')} no ecossistema digital, identificando gargalos e oportunidades de escala imediata para o segmento de ${clientInfo.tipo === 'varejo' ? 'Varejo' : 'Serviços'}.` 
      },
      positivos,
      negativos,
      scores: catScores,
      final: {
        destaque: generateDestaque(catScores),
        texto: generateFinalSummary(catScores, currentAnswers),
        acao1: actions[0] || 'Estruturar posicionamento único.',
        acao2: actions[1] || 'Otimizar linha editorial para conversão.',
        acao3: actions[2] || 'Implementar prova social constante.',
        acao4: actions[3] || 'Aumentar frequência estratégica.',
        acao5: actions[4] || 'Refinar CTA e Oferta única.'
      },
      semanas: [
        { label: 'Semana 1', titulo: clientInfo.tipo === 'varejo' ? 'Desejo & Vitrine' : 'Autoridade & Alcance', cards: [{tipo: clientInfo.tipo === 'varejo' ? 'Desejo' : 'Autoridade', titulo: clientInfo.tipo === 'varejo' ? 'Curadoria de Desejo' : 'Prova Social Extraordinária', gancho: 'Destaque o Produto', estrutura: 'Close no Produto + Música Trend', cta: 'Clique no link'}, {tipo: 'Alcance', titulo: 'Topo de Funil Viral', gancho: 'Desejo Instantâneo', estrutura: 'Vídeo Curto + Música Trend', cta: 'Curta e segue para mais'}] },
        { label: 'Semana 2', titulo: 'Engajamento e Conexão', cards: [{tipo:'Engajamento', titulo:'Bastidores e Narrativa', gancho:'Vulnerabilidade Controlada', estrutura:'Relato Pessoal + Aprendizado', cta:'Qual sua opinião?'}, {tipo:'Conversão', titulo:'Exposição da Oferta', gancho:'Problema vs Solução', estrutura:'Apresentação do Produto + Garantia', cta:'Link na Bio'}] },
        { label: 'Semana 3', titulo: 'Conversão e Vendas', cards: [{tipo:'Vendas', titulo:'Chamada Direta', gancho:'Últimas Vagas', estrutura:'Checklist de Benefícios', cta:'Clique agora'}, {tipo:'Alcance', titulo:'Transbordagem', gancho:'Collab ou Mídia Paga', estrutura:'Anúncio de Convite', cta:'Saiba Mais'}] }
      ]
    };

    setConfig(newConfig);
    setStep('preview');
    localStorage.setItem('agency_diagnostic_config_v5', JSON.stringify(newConfig));
    if (!slug) setSlug(clientInfo.nome.toLowerCase().replace(/\s+/g, '-').replace('@',''));
  };

  const generateDestaque = (s: Record<string, number>) => {
    const avg = (s.posicionamento + s.presenca + s.autoridade + s.conversao) / 4;
    if (avg > 85) return "Maturidade Nível Escala";
    if (avg > 60) return "Crescimento Acelerado";
    if (avg > 40) return "Potencial de Ajuste";
    return "Reestruturação Urgente";
  };

  const generateFinalSummary = (s: Record<string, number>, a: any) => {
    if (s.posicionamento < 50) return "Atualmente o perfil apresenta falhas graves de posicionamento, o que impede a comunicação de atrair o público correto e cobrar o valor justo.";
    if (s.conversao < 50) return "O perfil tem um bom conteúdo e autoridade, mas falha no momento crucial da conversão, perdendo muitas vendas acumuladas no direct.";
    return `Marca de ${clientInfo.tipo} com excelente maturidade estratégica, pronta para investir em tráfego pago e escalar o faturamento através de otimização de funil.`;
  };

  const handleSave = async () => {
    if (!user) { toast.error('Você precisa estar logado para salvar.'); return; }
    setIsSaving(true);
    try {
      const currentSlug = slug || clientInfo.nome.toLowerCase().replace(/\s+/g, '-').replace('@','');
      const { error } = await supabase
        .from('diagnostics' as any)
        .upsert({
          user_id: user.id,
          slug: currentSlug.trim().toLowerCase(),
          title: config.cliente?.nome || 'Diagnóstico',
          config: config,
          updated_at: new Date().toISOString()
        }, { onConflict: 'slug' });

      if (error) throw error;
      setSlug(currentSlug);
      fetchHistory(); // Refresh history
      toast.success('Diagnóstico Publicado! 🚀');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally { setIsSaving(false); }
  };

  /* ═══════ EDITABLE TEXT COMPONENT ═══════ */
  const EditableText = ({ value, onChange, className, multiline = false, isLight = false }: any) => {
    if (!isEditing) return <span className={className}>{value}</span>;
    
    if (multiline) {
      return (
        <textarea 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className={`w-full bg-white/5 border border-[#bff720]/30 rounded-lg p-2 text-inherit focus:border-[#bff720] outline-none min-h-[100px] ${isLight ? 'text-black' : 'text-white'}`}
        />
      );
    }
    
    return (
      <input 
        type="text" 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-white/5 border border-[#bff720]/30 rounded-lg px-2 py-1 text-inherit focus:border-[#bff720] outline-none ${isLight ? 'text-black' : 'text-white'}`}
      />
    );
  };

  const renderSetup = () => (
    <div className="w-full min-h-screen flex flex-col items-center justify-center p-6 lg:p-12 animate-in fade-in zoom-in duration-500 overflow-y-auto bg-[#0a0a0a]">
        <div className="max-w-xl w-full py-12 space-y-12 text-center">
            <div className="relative inline-block">
                <div className="absolute -inset-6 bg-[#bff720]/20 blur-2xl rounded-full" />
                <div className="relative p-8 rounded-[40px] bg-white/5 border border-white/10 text-[#bff720]">
                    <Target size={64} />
                </div>
            </div>

            <div className="space-y-4">
                <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter text-white">Configuração Inicial</h1>
                <p className="text-white/40 text-lg">Personalize o diagnóstico com base no modelo de negócio do seu cliente.</p>
            </div>

            <div className="space-y-10 text-left">
                <div className="space-y-5">
                    <Label className="text-[12px] font-black uppercase tracking-[4px] text-white/40 ml-1">Tipo de Negócio</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <button 
                            onClick={() => setClientInfo({...clientInfo, tipo: 'servico'})}
                            className={`flex flex-col items-center justify-center p-8 rounded-[32px] border-2 transition-all gap-4 group ${clientInfo.tipo === 'servico' ? 'border-[#bff720] bg-[#bff720]/10 text-white' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                        >
                            <div className={`p-4 rounded-2xl transition-all ${clientInfo.tipo === 'servico' ? 'bg-[#bff720] text-black' : 'bg-white/5 group-hover:bg-white/10'}`}>
                                <Briefcase size={28} />
                            </div>
                            <span className="font-black text-xs uppercase tracking-widest">Serviços / Especialista</span>
                        </button>
                        <button 
                            onClick={() => setClientInfo({...clientInfo, tipo: 'varejo'})}
                            className={`flex flex-col items-center justify-center p-8 rounded-[32px] border-2 transition-all gap-4 group ${clientInfo.tipo === 'varejo' ? 'border-[#bff720] bg-[#bff720]/10 text-white' : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                        >
                            <div className={`p-4 rounded-2xl transition-all ${clientInfo.tipo === 'varejo' ? 'bg-[#bff720] text-black' : 'bg-white/5 group-hover:bg-white/10'}`}>
                                <ShoppingBag size={28} />
                            </div>
                            <span className="font-black text-xs uppercase tracking-widest">Varejo / Loja Física</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-[3px] text-white/40 ml-1">Nome do Cliente (@)</Label>
                        <Input className="h-16 bg-white/5 border-white/10 text-white rounded-[20px] focus:border-[#bff720]/50 transition-all text-xl" placeholder="@perfil.exemplo" value={clientInfo.nome} onChange={e => setClientInfo({...clientInfo, nome: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-[3px] text-white/40 ml-1">Nicho / Especialidade</Label>
                        <Input className="h-16 bg-white/5 border-white/10 text-white rounded-[20px] focus:border-[#bff720]/50 transition-all text-xl" placeholder="Ex: Estética Avançada" value={clientInfo.nicho} onChange={e => setClientInfo({...clientInfo, nicho: e.target.value})} />
                    </div>
                </div>
            </div>

            <Button 
                disabled={!clientInfo.nome || !clientInfo.nicho}
                onClick={() => setStep('choice')}
                className="w-full h-20 bg-[#bff720] hover:bg-[#aee61d] text-black font-black uppercase tracking-[5px] rounded-[30px] shadow-2xl shadow-[#bff720]/20 text-lg transition-transform active:scale-95"
            >
                Continuar <ArrowRight size={24} className="ml-3" />
            </Button>
        </div>
    </div>
  );

  const renderChoice = () => (
    <div className="w-full min-h-screen flex flex-col items-center justify-center p-6 bg-[#0a0a0a] animate-in slide-in-from-bottom duration-500">
        <div className="max-w-4xl w-full space-y-12 text-center">
            <div className="space-y-4 p-8">
                <div className="inline-block px-4 py-1 bg-[#bff720]/20 rounded-full mb-4">
                  <span className="text-[10px] font-black text-[#bff720] uppercase tracking-[5px]">Passo 2 de 2</span>
                </div>
                <h2 className="text-4xl lg:text-7xl font-black text-white uppercase tracking-tighter italic leading-none">
                  Como quer gerar<br/>o diagnóstico?
                </h2>
                <p className="text-white/40 text-lg max-w-xl mx-auto">Escolha o método mais rápido para sua consultoria hoje.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <button 
                    onClick={() => setStep('ai_upload')}
                    className="flex flex-col items-center p-12 bg-white/5 border border-[#bff720]/30 rounded-[60px] hover:bg-[#bff720]/5 hover:scale-[1.02] transition-all group overflow-hidden relative shadow-2xl"
                >
                    <div className="absolute top-0 right-0 p-4 bg-[#bff720] text-black font-black text-[10px] uppercase tracking-widest rounded-bl-3xl">Recomendado</div>
                    <div className="p-8 bg-[#bff720] text-black rounded-[40px] mb-8 group-hover:rotate-12 transition-transform shadow-[0_0_40px_rgba(191,247,32,0.3)]">
                        <Sparkles size={48} />
                    </div>
                    <h3 className="text-3xl font-black text-white mb-4 uppercase italic">Mágico (IA Vision)</h3>
                    <p className="text-white/40 text-sm leading-relaxed mb-8">Envie um print da análise manual e deixe a IA estruturar tudo em segundos.</p>
                    <div className="mt-auto flex items-center gap-2 text-[#bff720] font-black uppercase tracking-widest text-[10px]">
                      Acessar Vision <ArrowRight size={14} />
                    </div>
                </button>

                <button 
                    onClick={() => setStep('wizard')}
                    className="flex flex-col items-center p-12 bg-white/5 border border-white/5 rounded-[60px] hover:bg-white/10 hover:scale-[1.02] transition-all group relative"
                >
                    <div className="p-8 bg-white/5 text-white/40 rounded-[40px] mb-8 group-hover:-rotate-12 transition-transform">
                        <Zap size={48} />
                    </div>
                    <h3 className="text-3xl font-black text-white mb-4 uppercase italic tracking-tighter opacity-80">Manual (Quiz)</h3>
                    <p className="text-white/40 text-sm leading-relaxed mb-8">Responda o formulário estratégico passo a passo para um diagnóstico guiado.</p>
                    <div className="mt-auto flex items-center gap-2 text-white/40 font-black uppercase tracking-widest text-[10px]">
                      Acessar Wizard <ArrowRight size={14} />
                    </div>
                </button>
            </div>

            <Button variant="ghost" onClick={() => setStep('setup')} className="text-white/20 hover:text-white uppercase font-black tracking-widest text-[10px] mt-8">
                <ArrowLeft size={14} className="mr-2" /> Voltar para configuração
            </Button>
        </div>
    </div>
  );

  const renderAIUpload = () => (
    <div className="w-full min-h-screen bg-[#0a0a0a]">
        <AIVisionConverter 
          onBack={() => setStep('choice')} 
          onDataExtracted={handleAIExtraction} 
        />
    </div>
  );

  const renderWizard = () => {
    const currentRule = filteredRules[wizardStep];
    const progress = ((wizardStep + 1) / filteredRules.length) * 100;

    if (!currentRule) return (
      <div className="w-full min-h-screen bg-[#0a0a0a] flex items-center justify-center">
         <Spinner className="animate-spin text-[#bff720]" size={48} />
      </div>
    );

    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center p-6 lg:p-12 bg-[#0a0a0a] animate-in slide-in-from-right duration-500 overflow-y-auto">
        <div className="max-w-2xl w-full py-12 space-y-12">
          {/* Progress Header */}
          <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div className="space-y-2">
                    <span className="text-[12px] font-black uppercase tracking-[5px] text-[#bff720]">Diagnóstico em Curso</span>
                    <h3 className="text-sm font-black text-white/40 uppercase tracking-[3px]">{currentRule.category}</h3>
                </div>
                <div className="text-right">
                    <span className="text-4xl font-black text-white">{Math.round(progress)}%</span>
                </div>
            </div>
            <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
              <div className="h-full bg-[#bff720] transition-all duration-700 shadow-[0_0_30px_rgba(191,247,32,0.4)]" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Question card */}
          <div className="space-y-10 bg-white/5 p-8 lg:p-16 rounded-[50px] border border-white/10 shadow-3xl backdrop-blur-3xl">
            <h2 className="text-3xl lg:text-4xl font-black text-white leading-[1.1] tracking-tighter">
              {currentRule.question}
            </h2>

            <div className="grid gap-5">
              {currentRule.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    const newAnswers = { ...answers, [currentRule.id]: opt };
                    setAnswers(newAnswers);
                    if (wizardStep < filteredRules.length - 1) {
                        setWizardStep(wizardStep + 1);
                    } else {
                        generateReport(newAnswers);
                    }
                  }}
                  className={`flex items-center justify-between p-8 rounded-[30px] border-2 transition-all duration-300 text-left group ${
                    answers[currentRule.id] === opt 
                      ? 'border-[#bff720] bg-[#bff720]/10 text-white shadow-[0_10px_40px_-10px_rgba(191,247,32,0.2)]' 
                      : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="font-extrabold text-xl tracking-tight">{opt}</span>
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                      answers[currentRule.id] === opt ? 'bg-[#bff720] border-[#bff720] scale-110' : 'border-white/10 group-hover:border-white/30'
                  }`}>
                      {answers[currentRule.id] === opt && <CheckCircle2 size={18} className="text-black" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center px-6">
            <Button 
                variant="ghost" 
                className="text-white/20 hover:text-white hover:bg-white/5 transition-all uppercase font-black tracking-[3px] text-xs h-12 px-8 rounded-2xl" 
                disabled={wizardStep === 0}
                onClick={() => setWizardStep(wizardStep - 1)}
            >
              <ArrowLeft size={18} className="mr-3" /> Voltar
            </Button>
            {answers[currentRule.id] && (
               <Button 
                variant="ghost" 
                className="text-[#bff720] hover:text-[#bff720]/80 hover:bg-[#bff720]/5 uppercase font-black tracking-[3px] text-xs h-12 px-8 rounded-2xl"
                onClick={() => {
                    if (wizardStep < filteredRules.length - 1) setWizardStep(wizardStep + 1);
                    else generateReport();
                }}
               >
                 Próximo <ArrowRight size={18} className="ml-3" />
               </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (step === 'setup') return renderSetup();
  if (step === 'choice') return renderChoice();
  if (step === 'wizard') return renderWizard();
  if (step === 'ai_upload') return renderAIUpload();

  // PREVIEW MODE — Mantido com flex h-screen original pois ele tem sidebar
  const currentTheme = THEMES[clientInfo.tema] || THEMES.teal;
  const theme = {
    primary: clientInfo.primaryColor || currentTheme.primary,
    primaryDark: clientInfo.primaryColor || currentTheme.primaryDark
  };
  
  return (
    <div className="flex h-screen bg-[#111] overflow-hidden w-full no-scrollbar">
      {/* SIDEBAR EDITOR */}
      <aside className="w-[350px] h-full flex flex-col border-r border-[#2a2a2a] bg-[#111] no-print z-20 shrink-0">
        <header className="bg-[#0D6E5E] p-6 flex justify-between items-center shrink-0">
          <div className="flex flex-col">
            <img src={LogoInova} className="h-6" alt="Inova" />
            <span className="text-[7px] text-white/20 font-bold uppercase tracking-[2px] mt-1 text-right">Engine v2.1.1</span>
          </div>
          <span className="text-[9px] text-[#bff720] font-black uppercase tracking-[3px]">Estratégico</span>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
          {config && (
            <div className="space-y-8 animate-in slide-in-from-left duration-700">
               {/* Nova Seção: Inteligência Artificial */}
               <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[4px] text-[#bff720]">Ações</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-black uppercase text-white/40">Modo Edição</span>
                      <button 
                        onClick={() => setIsEditing(!isEditing)}
                        className={`w-10 h-5 rounded-full relative transition-all ${isEditing ? 'bg-[#bff720]' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-black transition-all ${isEditing ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full h-12 bg-primary/10 border-primary/20 text-[#bff720] hover:bg-primary/20 font-black uppercase tracking-widest text-[10px] rounded-xl group"
                    onClick={handleRefineAI}
                    disabled={isRefining}
                  >
                    {isRefining ? <Spinner size={14} className="mr-3 animate-spin" /> : <Sparkles className="w-4 h-4 mr-3 group-hover:scale-110 transition-transform" /> }
                    Refinar Diagnóstico (IA)
                  </Button>
               </div>

               <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[4px] text-[#bff720]">Radar Estratégico</h3>
                  <div className="grid gap-5 bg-white/5 p-6 rounded-[32px] border border-white/5">
                    <ScoreBar label="Posicionamento" percentage={config.scores.posicionamento} color="#bff720" />
                    <ScoreBar label="Presença Digital" percentage={config.scores.presenca} color="#0D6E5E" />
                    <ScoreBar label="Autoridade" percentage={config.scores.autoridade} color="#d4c9b0" />
                    <ScoreBar label="Conversão" percentage={config.scores.conversao} color="#3A0A1E" />
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[4px] text-white/40">Controle</h3>
                    <Button variant="ghost" size="sm" className="h-6 text-[9px] uppercase font-bold text-[#bff720]" onClick={() => setStep('setup')}>Reiniciar</Button>
                  </div>
                  <div className="grid gap-2">
                    <Button className="bg-[#bff720] hover:bg-[#aee61d] text-black text-[10px] font-black h-12 uppercase tracking-widest rounded-xl transition-all active:scale-95" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Spinner size={14} className="mr-3 animate-spin" /> : <Save size={16} className="mr-3" />} Publicar Link
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="bg-transparent border-white/10 text-white text-[9px] font-black h-10 uppercase tracking-widest rounded-xl hover:bg-white/5" onClick={() => window.print()}>
                            <Download size={14} className="mr-2" /> PDF
                        </Button>
                        <Button variant="outline" className="bg-transparent border-white/10 text-white text-[9px] font-black h-10 uppercase tracking-widest rounded-xl hover:bg-white/5" onClick={() => setViewMode(viewMode === 'desktop' ? 'mobile' : 'desktop')}>
                            <Eye size={14} className="mr-2" /> {viewMode === 'desktop' ? 'Mobi' : 'Desk'}
                        </Button>
                    </div>
                  </div>
               </div>

               <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-[4px] text-white/40 ml-1">Configurações</h3>
                  <div className="space-y-4 bg-white/5 p-5 rounded-2xl border border-white/5">
                      <div className="space-y-1.5">
                          <Label className="text-[8px] font-black uppercase tracking-widest text-white/30">URL Personalizada</Label>
                          <Input className="h-9 bg-black/40 border-white/10 text-white text-[10px] font-bold rounded-lg" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} />
                      </div>
                      <div className="space-y-1.5">
                           <Label className="text-[8px] font-black uppercase tracking-widest text-white/30">Tema Visual</Label>
                           <div className="flex gap-2 mb-2">
                             {Object.keys(THEMES).map(t => (
                               <button 
                                 key={t}
                                 onClick={() => setClientInfo({...clientInfo, tema: t})}
                                 className={`w-6 h-6 rounded-full border-2 ${clientInfo.tema === t ? 'border-[#bff720] scale-110' : 'border-transparent'}`}
                                 style={{ background: THEMES[t].primary }}
                               />
                             ))}
                           </div>
                           <div className="flex gap-2 items-center">
                              <Input 
                                type="color" 
                                className="w-8 h-8 p-0 border-none bg-transparent rounded cursor-pointer" 
                                value={clientInfo.primaryColor || THEMES[clientInfo.tema]?.primary || '#0D6E5E'} 
                                onChange={(e) => {
                                  const col = e.target.value;
                                  setClientInfo({...clientInfo, primaryColor: col});
                                }} 
                              />
                              <Input 
                                className="h-8 bg-black/40 border-white/10 text-white text-[9px] font-bold rounded-lg" 
                                value={clientInfo.primaryColor || THEMES[clientInfo.tema]?.primary} 
                                onChange={(e) => {
                                  setClientInfo({...clientInfo, primaryColor: e.target.value});
                                }}
                              />
                           </div>
                       </div>
                      <div className="pt-2 space-y-3 border-t border-white/5">
                        <div className="space-y-1.5">
                            <Label className="text-[8px] font-black uppercase tracking-widest text-white/30">Seu Instagram</Label>
                            <Input className="h-9 bg-black/40 border-white/10 text-white text-[10px] font-bold rounded-lg" value={clientInfo.instaAgencia} onChange={e => setClientInfo({...clientInfo, instaAgencia: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[8px] font-black uppercase tracking-widest text-white/30">Seu WhatsApp</Label>
                            <Input className="h-9 bg-black/40 border-white/10 text-white text-[10px] font-bold rounded-lg" value={clientInfo.whatsAgencia} onChange={e => setClientInfo({...clientInfo, whatsAgencia: e.target.value})} />
                        </div>
                      </div>
                  </div>
               </div>

               {slug && (
                  <div className="p-4 rounded-xl bg-[#bff720]/10 border border-[#bff720]/20 space-y-2">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-[#bff720]">Live Link:</Label>
                    <a href={`/diagnostico/${slug}`} target="_blank" rel="noreferrer" className="text-[10px] text-white hover:underline flex items-center justify-between font-bold break-all bg-black/20 p-2 rounded">
                      /diagnostico/{slug} <LinkIcon size={12} className="shrink-0 ml-2" />
                    </a>
                  </div>
               )}

               {/* Histórico Section */}
               <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[4px] text-white/40">Histórico</h3>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-white/5" onClick={fetchHistory}>
                      <RefreshCw size={12} className={isLoadingHistory ? "animate-spin" : ""} />
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar pr-1">
                    {history.length === 0 ? (
                      <p className="text-[9px] text-white/20 italic text-center py-4">Nenhum diagnóstico salvo.</p>
                    ) : (
                      history.map((item) => (
                        <button 
                          key={item.id}
                          onClick={() => loadFromHistory(item)}
                          className="w-full p-4 rounded-xl bg-white/5 border border-white/5 hover:border-[#bff720]/30 hover:bg-white/10 transition-all text-left space-y-1 group"
                        >
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-black text-white group-hover:text-[#bff720] transition-colors">@{item.slug}</span>
                            <span className="text-[8px] text-white/30">{new Date(item.updated_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-[9px] text-white/40 truncate">{item.title}</p>
                        </button>
                      ))
                    )}
                  </div>
               </div>
            </div>
          )}
        </div>
      </aside>

      {/* PREVIEW MAIN VIEW */}
      <main className="flex-1 h-full overflow-y-auto bg-[#F5F3EE] relative scroll-smooth no-scrollbar">
        <div className={`mx-auto transition-all duration-700 ${viewMode === 'mobile' ? 'max-w-[375px] my-10 border-[12px] border-black rounded-[50px] h-[812px] overflow-y-auto shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] bg-[#F5F3EE] no-scrollbar' : 'w-full'}`}
          style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          
          {/* PAGE 1 — HERO COVER */}
          <section className="min-h-[90vh] flex flex-col items-center justify-center text-center px-10 py-20 relative overflow-hidden" style={{ background: theme.primary }}>
            <img src={LogoInova} className="h-12 mb-24 brightness-0 invert opacity-80" alt="Inova" />
            
            <div className="relative w-full max-w-3xl mx-auto">
              {/* Lime star decoration */}
              <div className="absolute -left-12 -top-12 text-[#bff720] text-7xl font-black select-none opacity-80 animate-pulse" style={{ transform: 'rotate(-15deg)' }}>✳</div>
              
              <div className="bg-black px-12 py-10 inline-block w-full shadow-2xl">
                <h1 className="text-white text-[clamp(2.5rem,8vw,6rem)] font-black tracking-[-3px] leading-none uppercase">
                  DIAGNÓSTICO
                </h1>
              </div>
              
              {/* Cream star decoration */}
              <div className="absolute -right-8 -bottom-8 text-white/20 text-5xl select-none" style={{ transform: 'rotate(15deg)' }}>✳</div>
            </div>

            <div className="mt-16 space-y-4">
              <div className="inline-block px-6 py-2 bg-white/10 rounded-full backdrop-blur-md">
                  <p className="text-xs font-black text-[#bff720] tracking-[0.5em] uppercase">
                    @{clientInfo.nome.replace('@','')}
                  </p>
              </div>
              <p className="text-sm text-white/50 tracking-[0.3em] font-medium uppercase">
                Maturidade Estratégica de {clientInfo.tipo === 'varejo' ? 'Varejo' : 'Marca/Serviço'}
              </p>
            </div>

             {/* Background Effects */}
             <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px]" />
             <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#bff720]/5 rounded-full translate-y-1/3 -translate-x-1/3 blur-[100px]" />
          </section>

          {/* PAGE 2 — OVERVIEW & RADAR */}
          <section className="min-h-[80vh] flex flex-col justify-center px-8 lg:px-24 py-24 bg-[#F5F3EE]">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                <div className="space-y-10">
                    <div className="space-y-4">
                        <span className="text-[10px] font-black uppercase tracking-[5px] text-[#0D6E5E]">Introdução</span>
                        <h2 className="text-5xl lg:text-6xl font-black text-black leading-none uppercase tracking-tighter">
                            <EditableText value="Panorama" onChange={(v:any) => setConfig({...config, intro: {...config.intro, titulo: v}})} isLight />
                            <br />
                            <EditableText value="Digital" onChange={(v:any) => {}} isLight />
                        </h2>
                    </div>
                    <p className="text-xl text-black/70 leading-relaxed font-medium">
                        <EditableText 
                          value={config.intro.texto} 
                          onChange={(v:any) => setConfig({...config, intro: {...config.intro, texto: v}})} 
                          multiline 
                          isLight
                        />
                    </p>
                    <div className="flex gap-4">
                        <div className="flex -space-x-4">
                            {[1,2,3].map(i => <div key={i} className="w-12 h-12 rounded-full border-4 border-[#F5F3EE] bg-gray-200" />)}
                        </div>
                        <div className="flex flex-col justify-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-black/30 leading-none">Analisado por</p>
                            <p className="text-sm font-bold text-black">Especialistas Inova Co.</p>
                        </div>
                    </div>
                </div>

                <div className="relative">
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
                </div>
            </div>
          </section>

          {/* PAGE 3 — INSIGHTS (POSITIVOS / NEGATIVOS) */}
          <section className="min-h-[90vh] flex items-center px-8 lg:px-24 py-24 relative overflow-hidden" style={{ background: theme.primary }}>
            <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-20 relative z-10">
                
                <div className="lg:col-span-12 mb-10 text-center">
                     <h2 className="text-[clamp(2.5rem,8vw,6rem)] font-black text-white/10 uppercase tracking-tighter leading-none absolute -top-10 left-1/2 -translate-x-1/2 w-full select-none">ANALYSIS</h2>
                     <h3 className="text-5xl lg:text-7xl font-black text-white uppercase tracking-tighter relative z-10">Diagnóstico Estratégico</h3>
                </div>

                {/* Positivos column */}
                <div className="lg:col-span-6 space-y-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-[2px] bg-[#bff720]" />
                        <h4 className="text-[10px] font-black uppercase tracking-[5px] text-[#bff720]">Pontos de Força</h4>
                    </div>
                    <div className="grid gap-4">
                        {config.positivos.map((p: string, i: number) => (
                            <div key={i} className="bg-white/5 border border-white/5 p-8 rounded-[32px] group hover:bg-white/10 transition-all duration-500 text-left relative">
                                {isEditing && (
                                  <button 
                                    onClick={() => {
                                      const newPos = [...config.positivos];
                                      newPos.splice(i, 1);
                                      setConfig({...config, positivos: newPos});
                                    }}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                                <div className="flex gap-6">
                                    <div className="w-10 h-10 rounded-2xl bg-[#bff720]/10 flex items-center justify-center text-[#bff720] shrink-0"><CheckCircle2 size={20} /></div>
                                    <div className="flex-1">
                                      <p className="text-lg font-bold text-white/90 leading-tight pt-1 w-full">
                                        <EditableText value={p} onChange={(v:any) => {
                                          const newPos = [...config.positivos];
                                          newPos[i] = v;
                                          setConfig({...config, positivos: newPos});
                                        }} />
                                      </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isEditing && (
                          <Button 
                            variant="ghost" 
                            className="w-full border-2 border-dashed border-[#bff720]/30 text-[#bff720] hover:bg-[#bff720]/10 py-8 rounded-[32px]"
                            onClick={() => setConfig({...config, positivos: [...config.positivos, 'Novo ponto de força...']})}
                          >
                            <Plus size={20} className="mr-2" /> Adicionar Ponto Positivo
                          </Button>
                        )}
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
                            <div key={i} className="bg-black/20 border border-white/5 p-8 rounded-[32px] group hover:bg-black/40 transition-all duration-500 text-left relative">
                                {isEditing && (
                                  <button 
                                    onClick={() => {
                                      const newNeg = [...config.negativos];
                                      newNeg.splice(i, 1);
                                      setConfig({...config, negativos: newNeg});
                                    }}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                                <div className="flex gap-6">
                                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/20 shrink-0"><AlertCircle size={20} /></div>
                                    <div className="flex-1">
                                      <p className="text-lg font-bold text-white/60 leading-tight pt-1">
                                        <EditableText value={n} onChange={(v:any) => {
                                          const newNeg = [...config.negativos];
                                          newNeg[i] = v;
                                          setConfig({...config, negativos: newNeg});
                                        }} />
                                      </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isEditing && (
                          <Button 
                            variant="ghost" 
                            className="w-full border-2 border-dashed border-white/10 text-white/40 hover:bg-white/5 py-8 rounded-[32px]"
                            onClick={() => setConfig({...config, negativos: [...config.negativos, 'Novo gargalo identificado...']})}
                          >
                            <Plus size={20} className="mr-2" /> Adicionar Gargalo
                          </Button>
                        )}
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
                  <div className="text-center space-y-4">
                     <span className="text-[10px] font-black uppercase tracking-[5px] text-primary">Auditoria Visual IA</span>
                     <h2 className="text-4xl lg:text-6xl font-black text-black uppercase tracking-tighter">Análise de Perfil</h2>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 text-left">
                     {/* Bio Audit */}
                     <div className="bg-gray-50 rounded-[40px] p-10 space-y-8 border border-gray-100">
                        <div className="flex items-center gap-4">
                           <div className="p-3 bg-black text-[#bff720] rounded-2xl"><Sparkles size={24} /></div>
                           <h3 className="text-2xl font-black text-black">Audit da Biográfica</h3>
                        </div>
                        <div className="space-y-4">
                           {config.aiAnalise.bioPositivos?.map((p: string, i: number) => (
                              <div key={i} className="flex gap-3 text-sm font-bold text-black/70">
                                 <CheckCircle2 className="text-primary shrink-0" size={18} /> {p}
                              </div>
                           ))}
                           {config.aiAnalise.bioNegativos?.map((n: string, i: number) => (
                              <div key={i} className="flex gap-3 text-sm font-bold text-black/40 italic">
                                 <AlertCircle className="text-black/20 shrink-0" size={18} /> {n}
                              </div>
                           ))}
                        </div>
                     </div>

                     {/* Presence Audit */}
                     <div className="bg-black rounded-[40px] p-10 space-y-8 shadow-2xl">
                        <div className="flex items-center gap-4">
                           <div className="p-3 bg-[#bff720] text-black rounded-2xl"><Eye size={24} /></div>
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
                     </div>
                  </div>
               </div>
            </section>
          )}

          {/* PAGE 4 — VEREDITO & PLANO DE AÇÃO */}
          <section className="min-h-screen px-8 lg:px-24 py-32 bg-black flex flex-col items-center justify-center text-center overflow-hidden relative">
                <div className="max-w-4xl space-y-16 relative z-10">
                    <div className="space-y-6">
                        <div className="inline-block px-8 py-3 bg-[#bff720]/10 border border-[#bff720]/20 rounded-full">
                            <span className="text-sm font-black text-[#bff720] uppercase tracking-[8px]">O Veredito Final</span>
                        </div>
                        <h2 className="text-6xl lg:text-8xl font-black text-white uppercase tracking-tighter leading-[0.85]">
                            <EditableText value={config.final.destaque} onChange={(v:any) => setConfig({...config, final: {...config.final, destaque: v}})} />
                        </h2>
                        <p className="text-2xl lg:text-3xl font-light text-white/40 max-w-3xl mx-auto italic">
                            "<EditableText value={config.final.texto} onChange={(v:any) => setConfig({...config, final: {...config.final, texto: v}})} multiline />"
                        </p>
                    </div>

                    <div className="grid gap-4 text-left">
                        {[1,2,3,4,5].map(i => config.final[`acao${i}`] ? (
                            <div key={i} className="group flex items-center bg-white/5 border border-white/10 p-8 rounded-[32px] transition-all hover:bg-white/10 hover:border-[#bff720]/50 duration-500">
                                <span className="text-4xl font-black text-white/5 group-hover:text-[#bff720]/20 transition-colors mr-10">{String(i).padStart(2, '0')}</span>
                                <p className="text-xl font-bold text-white tracking-tight">{config.final[`acao${i}`]}</p>
                                <ArrowRight className="ml-auto text-white/10 group-hover:text-[#bff720] transition-all translate-x-4 group-hover:translate-x-0" />
                            </div>
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
                            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 text-left">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-[2px] bg-[#0D6E5E]" />
                                        <span className="text-[10px] font-black uppercase tracking-[5px] text-[#0D6E5E]">
                                          <EditableText value={s.label} onChange={(v:any) => {
                                            const newS = [...config.semanas];
                                            newS[i].label = v;
                                            setConfig({...config, semanas: newS});
                                          }} isLight />
                                        </span>
                                    </div>
                                    <h2 className="text-5xl lg:text-6xl font-black text-black uppercase tracking-tighter leading-none">
                                      <EditableText value={s.titulo} onChange={(v:any) => {
                                        const newS = [...config.semanas];
                                        newS[i].titulo = v;
                                        setConfig({...config, semanas: newS});
                                      }} isLight />
                                    </h2>
                                </div>
                                <div className="p-6 bg-white border border-[#e8e4dc] rounded-2xl flex items-center gap-6">
                                    <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center text-[#bff720]"><TrendingUp size={24} /></div>
                                    <div className="text-left">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-black/30">Objetivo da Fase</p>
                                        <p className="text-sm font-black text-black">Aceleração de Resultados</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                {s.cards.map((c: any, ci: number) => (
                                    <div key={ci} className="group bg-white rounded-[50px] p-12 shadow-2xl border border-[#e8e4dc] space-y-10 hover:border-[#bff720] transition-colors duration-500 flex flex-col justify-between text-left relative">
                                        {isEditing && (
                                          <button 
                                            onClick={() => {
                                              const newS = [...config.semanas];
                                              newS[i].cards.splice(ci, 1);
                                              setConfig({...config, semanas: newS});
                                            }}
                                            className="absolute -top-4 -right-4 w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-10"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        )}
                                        <div className="space-y-8">
                                            <div className="flex justify-between items-start">
                                                <div className="inline-block px-5 py-2 bg-black rounded-full">
                                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">
                                                      <EditableText value={c.tipo} onChange={(v:any) => {
                                                        const newS = [...config.semanas];
                                                        newS[i].cards[ci].tipo = v;
                                                        setConfig({...config, semanas: newS});
                                                      }} />
                                                    </span>
                                                </div>
                                                <Sparkles className="text-black/10 group-hover:text-[#bff720] transition-colors" size={32} />
                                            </div>
                                            <h3 className="text-3xl font-black text-black leading-tight tracking-tight">
                                              <EditableText value={c.titulo} onChange={(v:any) => {
                                                const newS = [...config.semanas];
                                                newS[i].cards[ci].titulo = v;
                                                setConfig({...config, semanas: newS});
                                              }} isLight />
                                            </h3>
                                            
                                            <div className="grid grid-cols-1 gap-8">
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-[#0D6E5E]">Base Estratégica</p>
                                                    <p className="text-lg font-medium text-black/70 leading-snug">
                                                      <EditableText value={c.gancho} onChange={(v:any) => {
                                                        const newS = [...config.semanas];
                                                        newS[i].cards[ci].gancho = v;
                                                        setConfig({...config, semanas: newS});
                                                      }} isLight multiline />
                                                    </p>
                                                </div>
                                                <div className="p-6 bg-[#f8f6f0] rounded-3xl space-y-2">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-black/30">Estrutura do Conteúdo</p>
                                                    <p className="text-sm font-bold text-black/80 leading-relaxed">
                                                      <EditableText value={c.estrutura} onChange={(v:any) => {
                                                        const newS = [...config.semanas];
                                                        newS[i].cards[ci].estrutura = v;
                                                        setConfig({...config, semanas: newS});
                                                      }} isLight multiline />
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-8 border-t border-gray-100 flex items-center justify-between group-hover:border-[#bff720]/20 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-[#bff720] animate-pulse" />
                                                <span className="text-xs font-black uppercase tracking-widest text-black/40">Call to action:</span>
                                            </div>
                                            <span className="text-xs font-black text-black uppercase tracking-widest bg-[#bff720]/10 px-4 py-2 rounded-lg">
                                               <EditableText value={c.cta} onChange={(v:any) => {
                                                  const newS = [...config.semanas];
                                                  newS[i].cards[ci].cta = v;
                                                  setConfig({...config, semanas: newS});
                                                }} isLight />
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                {isEditing && (
                                  <button 
                                    onClick={() => {
                                      const newS = [...config.semanas];
                                      newS[i].cards.push({
                                        tipo: 'Novo Vídeo',
                                        titulo: 'Título da Ideia',
                                        gancho: 'Chamada de impacto aqui',
                                        estrutura: 'Passo a passo do vídeo',
                                        cta: 'Postar agora'
                                      });
                                      setConfig({...config, semanas: newS});
                                    }}
                                    className="flex flex-col items-center justify-center p-12 border-4 border-dashed border-[#e8e4dc] rounded-[50px] hover:border-[#bff720] hover:bg-[#bff720]/5 transition-all text-[#e8e4dc] hover:text-[#bff720] group"
                                  >
                                    <Plus size={48} className="mb-4 group-hover:scale-110 transition-transform" />
                                    <span className="text-sm font-black uppercase tracking-widest">Adicionar Ideia de Vídeo</span>
                                  </button>
                                )}
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
                        Este documento é confidencial e exclusivo para @{clientInfo.nome.replace('@','')}.<br />
                        © 2026 INOVA Co. | {clientInfo.instaAgencia} | {clientInfo.whatsAgencia}
                    </p>
               </div>
          </footer>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          section { page-break-after: always; min-height: 100vh; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
