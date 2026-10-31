import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/PageHeader';
import {
  Save, Eye, Plus, Download, Loader2 as Spinner, Link as LinkIcon,
  CheckCircle2, ArrowRight, ArrowLeft, Sparkles, Zap,
  ShoppingBag, Briefcase, RefreshCw, Smartphone, Monitor
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/contexts/AuthContext';
import { DIAGNOSTIC_RULES, DiagnosticRule, BusinessType } from '@/data/diagnosticRules';
import { AIVisionConverter } from '@/components/diagnostic/AIVisionConverter';
import { DiagnosticReport } from '@/components/diagnostic/DiagnosticReport';

const ScoreBar = ({ label, percentage }: { label: string; percentage: number }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums text-foreground">{Math.round(percentage)}%</span>
    </div>
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
    </div>
  </div>
);

/* ═══════ LOCALSTORAGE KEYS ═══════ */
const LS_KEYS = {
  STEP: 'diag_editor_step',
  WIZARD_STEP: 'diag_editor_wizard_step',
  ANSWERS: 'diag_editor_answers',
  CLIENT_INFO: 'diag_editor_client_info',
  SLUG: 'diag_editor_slug',
  CONFIG: 'agency_diagnostic_config_v5',
  IS_EDITING: 'diag_editor_is_editing',
};

const safeGetLS = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    if (!v) return fallback;
    return JSON.parse(v) as T;
  } catch (_e) {
    // Corrupted data — remove it so it doesn't break again
    try { localStorage.removeItem(key); } catch (_) {}
    console.warn(`[DiagnosticEditor] Cleared corrupted localStorage key: ${key}`);
    return fallback;
  }
};

/* ═══════ MAIN EDITOR ═══════ */
export default function DiagnosticEditorPage() {
  const { user } = useAuth();
  const { editSlug } = useParams();

  const defaultClientInfo = { 
    nome: '', nicho: '', subtitulo: 'Diagnóstico de Maturidade Estratégica', tema: 'teal', primaryColor: '#0D6E5E', tipo: 'servico' as BusinessType, instaAgencia: '@inovaco.br', whatsAgencia: '(62) 99999-9999', foto: '' 
  };

  const [step, setStep] = useState<'setup' | 'choice' | 'wizard' | 'ai_upload' | 'preview'>(() => safeGetLS(LS_KEYS.STEP, 'setup'));
  const [wizardStep, setWizardStep] = useState(() => safeGetLS(LS_KEYS.WIZARD_STEP, 0));
  const [answers, setAnswers] = useState<Record<string, string>>(() => safeGetLS(LS_KEYS.ANSWERS, {}));
  const [clientInfo, setClientInfo] = useState<{nome: string; nicho: string; subtitulo: string; tema: string; primaryColor?: string; tipo: BusinessType; instaAgencia?: string; whatsAgencia?: string; foto?: string}>(() => safeGetLS(LS_KEYS.CLIENT_INFO, defaultClientInfo));
  const [slug, setSlug] = useState(() => safeGetLS(LS_KEYS.SLUG, ''));
  const [config, setConfig] = useState<any>(() => safeGetLS(LS_KEYS.CONFIG, null));
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isRefining, setIsRefining] = useState(false);
  const [isEditing, setIsEditing] = useState(() => safeGetLS(LS_KEYS.IS_EDITING, false));
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // ═══════ AUTO-SAVE TO LOCALSTORAGE ═══════
  useEffect(() => { try { localStorage.setItem(LS_KEYS.STEP, JSON.stringify(step)); } catch {} }, [step]);
  useEffect(() => { try { localStorage.setItem(LS_KEYS.WIZARD_STEP, JSON.stringify(wizardStep)); } catch {} }, [wizardStep]);
  useEffect(() => { try { localStorage.setItem(LS_KEYS.ANSWERS, JSON.stringify(answers)); } catch {} }, [answers]);
  useEffect(() => { try { localStorage.setItem(LS_KEYS.CLIENT_INFO, JSON.stringify(clientInfo)); } catch {} }, [clientInfo]);
  useEffect(() => { try { localStorage.setItem(LS_KEYS.SLUG, JSON.stringify(slug)); } catch {} }, [slug]);
  useEffect(() => { if (config) { try { localStorage.setItem(LS_KEYS.CONFIG, JSON.stringify(config)); } catch {} } }, [config]);
  useEffect(() => { try { localStorage.setItem(LS_KEYS.IS_EDITING, JSON.stringify(isEditing)); } catch {} }, [isEditing]);

  // Filtra as regras baseado no tipo de negócio
  const filteredRules = useMemo(() => {
    return DIAGNOSTIC_RULES.filter(rule => !rule.onlyFor || rule.onlyFor === clientInfo.tipo);
  }, [clientInfo.tipo]);

  useEffect(() => {
    // If we have an editSlug param, load that specific diagnostic
    if (editSlug) {
      loadBySlug(editSlug);
    }
    // Otherwise the state is already restored from localStorage via lazy initializers
    fetchHistory();
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
        whatsAgencia: clientInfo.whatsAgencia,
        foto: data.imageUrl || clientInfo.foto || ''
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
        destaque: data.analysisTone === 'critical' ? "Prioridades de melhoria" : "Pronto para Escala",
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
      const { data, error } = await supabase.functions.invoke('ai-copywriter', {
        body: {
          systemPrompt: "Você é um Consultor de Marketing Estratégico Sênior. Aprofunde diagnósticos retornando SEMPRE JSON válido no mesmo formato recebido, sem texto fora do JSON.",
          userMessage: `Aprofunde este diagnóstico estratégico de marketing, tornando-o mais técnico e detalhado, mas MANTENHA A CONCISÃO. Evite textos longos, foque em insights de alto impacto. Retorne o mesmo formato JSON:\n\n${JSON.stringify(config)}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const result = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
      setConfig(result);
      toast.success("Diagnóstico refinado com IA! ✨", { id: toastId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao refinar análise.";
      toast.error(msg, { id: toastId });
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
      const mergedConfig = {
        ...config,
        cliente: {
          ...(config?.cliente || {}),
          nome: config?.cliente?.nome || clientInfo.nome,
          tema: clientInfo.tema,
          primaryColor: clientInfo.primaryColor,
          instaAgencia: clientInfo.instaAgencia,
          whatsAgencia: clientInfo.whatsAgencia,
          foto: config?.cliente?.foto || clientInfo.foto || '',
        },
      };
      const { error } = await supabase
        .from('diagnostics' as any)
        .upsert({
          user_id: user.id,
          slug: currentSlug.trim().toLowerCase(),
          title: mergedConfig.cliente?.nome || 'Diagnóstico',
          config: mergedConfig,
          updated_at: new Date().toISOString()
        }, { onConflict: 'slug' });

      if (error) throw error;
      setConfig(mergedConfig);
      setSlug(currentSlug);
      fetchHistory(); // Refresh history
      toast.success('Diagnóstico Publicado! 🚀');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally { setIsSaving(false); }
  };

  const historyList = (limit?: number) => (
    <div className="space-y-2">
      {isLoadingHistory && history.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : history.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Nenhum diagnóstico salvo ainda.</p>
      ) : (
        history.slice(0, limit).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => loadFromHistory(item)}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{item.title || item.slug}</p>
              <p className="truncate text-xs text-muted-foreground">/diagnostico/{item.slug}</p>
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{new Date(item.updated_at).toLocaleDateString('pt-BR')}</span>
          </button>
        ))
      )}
    </div>
  );

  const eyebrowCls = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground';

  const renderSetup = () => (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Diagnóstico"
        title="Novo diagnóstico"
        description="Personalize o diagnóstico com base no modelo de negócio do cliente."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="space-y-2">
            <p className={eyebrowCls}>Tipo de negócio</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                { tipo: 'servico', label: 'Serviços / especialista', icon: Briefcase },
                { tipo: 'varejo', label: 'Varejo / loja física', icon: ShoppingBag },
              ] as const).map(opt => {
                const active = clientInfo.tipo === opt.tipo;
                return (
                  <button
                    key={opt.tipo}
                    type="button"
                    onClick={() => setClientInfo({ ...clientInfo, tipo: opt.tipo })}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${active ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-md ${active ? 'bg-primary/15 text-primary' : 'bg-muted'}`}>
                      <opt.icon size={18} />
                    </span>
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="diag-nome">Nome do cliente (@)</Label>
              <Input id="diag-nome" placeholder="@perfil.exemplo" value={clientInfo.nome} onChange={e => setClientInfo({ ...clientInfo, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="diag-nicho">Nicho / especialidade</Label>
              <Input id="diag-nicho" placeholder="Ex.: Estética avançada" value={clientInfo.nicho} onChange={e => setClientInfo({ ...clientInfo, nicho: e.target.value })} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="diag-foto">URL da foto de perfil (opcional)</Label>
              <Input id="diag-foto" placeholder="https://…" value={clientInfo.foto} onChange={e => setClientInfo({ ...clientInfo, foto: e.target.value })} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button disabled={!clientInfo.nome || !clientInfo.nicho} onClick={() => setStep('choice')} className="active:scale-[0.97]">
              Continuar <ArrowRight size={16} className="ml-1.5" />
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className={eyebrowCls}>Diagnósticos salvos</p>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchHistory} aria-label="Atualizar lista">
              <RefreshCw size={14} className={isLoadingHistory ? 'animate-spin' : ''} />
            </Button>
          </div>
          {historyList(6)}
        </div>
      </div>
    </div>
  );

  const renderChoice = () => (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Passo 2 de 2"
        title="Como quer gerar o diagnóstico?"
        description="Escolha o método mais rápido para a consultoria de hoje."
        actions={
          <Button variant="outline" onClick={() => setStep('setup')}>
            <ArrowLeft size={16} className="mr-1.5" /> Voltar
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setStep('ai_upload')}
          className="group flex flex-col items-start gap-3 rounded-xl border border-primary/40 bg-card p-4 text-left transition-colors hover:bg-accent sm:p-5"
        >
          <div className="flex w-full items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Sparkles size={20} /></span>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">Recomendado</span>
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">Com IA (print da análise)</h3>
            <p className="mt-1 text-sm text-muted-foreground">Envie um print da análise manual e a IA estrutura o diagnóstico em segundos.</p>
          </div>
          <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">Usar IA <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" /></span>
        </button>

        <button
          type="button"
          onClick={() => setStep('wizard')}
          className="group flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent sm:p-5"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Zap size={20} /></span>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">Manual (questionário)</h3>
            <p className="mt-1 text-sm text-muted-foreground">Responda o formulário estratégico passo a passo para um diagnóstico guiado.</p>
          </div>
          <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-foreground/80">Responder perguntas <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" /></span>
        </button>
      </div>
    </div>
  );

  const renderAIUpload = () => (
    <AIVisionConverter
      onBack={() => setStep('choice')}
      onDataExtracted={handleAIExtraction}
    />
  );

  const renderWizard = () => {
    const currentRule = filteredRules[wizardStep];
    const progress = ((wizardStep + 1) / filteredRules.length) * 100;

    if (!currentRule) return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="animate-spin text-primary" size={32} />
      </div>
    );

    const goNext = (nextAnswers: Record<string, string> = answers) => {
      if (wizardStep < filteredRules.length - 1) setWizardStep(wizardStep + 1);
      else generateReport(nextAnswers);
    };

    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          eyebrow={`Pergunta ${wizardStep + 1} de ${filteredRules.length} · ${currentRule.category}`}
          title="Diagnóstico em curso"
          actions={<span className="font-display text-2xl font-semibold tabular-nums text-foreground">{Math.round(progress)}%</span>}
        />
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="font-display text-xl font-semibold leading-snug text-foreground sm:text-2xl [text-wrap:pretty]">
            {currentRule.question}
          </h2>
          <div className="grid gap-2">
            {currentRule.options.map((opt) => {
              const active = answers[currentRule.id] === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    const newAnswers = { ...answers, [currentRule.id]: opt };
                    setAnswers(newAnswers);
                    goNext(newAnswers);
                  }}
                  className={`flex items-center justify-between gap-3 rounded-lg border p-3.5 text-left transition-colors ${active ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-foreground/80 hover:bg-accent hover:text-foreground'}`}
                >
                  <span className="text-sm font-medium sm:text-base">{opt}</span>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-foreground/20'}`}>
                    {active && <CheckCircle2 size={14} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button variant="ghost" disabled={wizardStep === 0} onClick={() => setWizardStep(wizardStep - 1)}>
            <ArrowLeft size={16} className="mr-1.5" /> Voltar
          </Button>
          {answers[currentRule.id] && (
            <Button variant="outline" onClick={() => goNext()}>
              Próximo <ArrowRight size={16} className="ml-1.5" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  // Safety: if we're supposed to show preview but config is missing, go back to setup
  if (step === 'preview' && !config) {
    setStep('setup');
    return renderSetup();
  }

  if (step === 'setup') return renderSetup();
  if (step === 'choice') return renderChoice();
  if (step === 'wizard') return renderWizard();
  if (step === 'ai_upload') return renderAIUpload();

  // PREVIEW: painel lateral de controle + relatório com o mesmo visual do link público
  const reportConfig = {
    ...config,
    cliente: { ...(config.cliente || {}), instaAgencia: clientInfo.instaAgencia, whatsAgencia: clientInfo.whatsAgencia },
  };
  const scores = config.scores || {};

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Diagnóstico"
        title={`@${String(config.cliente?.nome || clientInfo.nome || 'cliente').replace('@', '')}`}
        description="Revise, ajuste os textos no modo edição e publique o link para o cliente."
        actions={
          <>
            <Button variant="outline" onClick={() => setStep('setup')}>
              <Plus size={16} className="mr-1.5" /> Novo
            </Button>
            {slug && (
              <Button variant="outline" asChild>
                <a href={`/diagnostico/${slug}`} target="_blank" rel="noreferrer"><Eye size={16} className="mr-1.5" /> Abrir link</a>
              </Button>
            )}
            <Button onClick={handleSave} disabled={isSaving} className="active:scale-[0.97]">
              {isSaving ? <Spinner size={16} className="mr-1.5 animate-spin" /> : <Save size={16} className="mr-1.5" />} Publicar link
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-4 lg:h-[calc(100dvh-12rem)] lg:min-h-[560px] lg:flex-row">
        {/* PAINEL DE CONTROLE */}
        <aside className="no-print space-y-4 lg:w-[320px] lg:shrink-0 lg:overflow-y-auto lg:pr-1">
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="diag-edit-mode" className="text-sm font-medium">Modo edição</Label>
              <Switch id="diag-edit-mode" checked={isEditing} onCheckedChange={setIsEditing} />
            </div>
            <p className="text-xs text-muted-foreground">Com o modo ligado, clique nos textos do relatório para alterar, adicionar ou remover itens.</p>
            <Button variant="outline" className="w-full" onClick={handleRefineAI} disabled={isRefining}>
              {isRefining ? <Spinner size={16} className="mr-1.5 animate-spin" /> : <Sparkles size={16} className="mr-1.5" />}
              Refinar com IA
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => window.print()}>
                <Download size={16} className="mr-1.5" /> PDF
              </Button>
              <Button variant="outline" onClick={() => setViewMode(viewMode === 'desktop' ? 'mobile' : 'desktop')}>
                {viewMode === 'desktop' ? <Smartphone size={16} className="mr-1.5" /> : <Monitor size={16} className="mr-1.5" />}
                {viewMode === 'desktop' ? 'Celular' : 'Desktop'}
              </Button>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <p className={eyebrowCls}>Radar estratégico</p>
            <ScoreBar label="Posicionamento" percentage={scores.posicionamento || 0} />
            <ScoreBar label="Autoridade" percentage={scores.autoridade || 0} />
            <ScoreBar label="Presença digital" percentage={scores.presenca || 0} />
            <ScoreBar label="Conversão" percentage={scores.conversao || 0} />
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <p className={eyebrowCls}>Link e contato</p>
            <div className="space-y-1.5">
              <Label htmlFor="diag-slug">Endereço do link</Label>
              <div className="flex items-center rounded-md border border-input bg-background pl-3 text-sm text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
                <span className="shrink-0">/diagnostico/</span>
                <input id="diag-slug" className="h-10 min-w-0 flex-1 bg-transparent pr-3 text-foreground outline-none" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="diag-insta">Instagram da agência</Label>
              <Input id="diag-insta" value={clientInfo.instaAgencia} onChange={e => setClientInfo({ ...clientInfo, instaAgencia: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="diag-whats">WhatsApp da agência</Label>
              <Input id="diag-whats" value={clientInfo.whatsAgencia} onChange={e => setClientInfo({ ...clientInfo, whatsAgencia: e.target.value })} />
              <p className="text-xs text-muted-foreground">O botão final do relatório abre esse WhatsApp (ou o Instagram, se o número não for válido).</p>
            </div>
            {slug && (
              <a href={`/diagnostico/${slug}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-xs font-medium text-foreground/80 hover:text-foreground">
                <span className="truncate">inovamarketing.online/diagnostico/{slug}</span>
                <LinkIcon size={13} className="shrink-0" />
              </a>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className={eyebrowCls}>Histórico</p>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchHistory} aria-label="Atualizar histórico">
                <RefreshCw size={14} className={isLoadingHistory ? 'animate-spin' : ''} />
              </Button>
            </div>
            {historyList()}
          </div>
        </aside>

        {/* PRÉVIA DO RELATÓRIO */}
        <main className="diag-preview min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-muted lg:overflow-y-auto">
          <div className={viewMode === 'mobile'
            ? 'mx-auto my-6 h-[760px] w-[375px] max-w-full overflow-y-auto overflow-x-hidden rounded-[36px] border-[10px] border-foreground/90 no-scrollbar'
            : 'w-full'}>
            <DiagnosticReport
              config={reportConfig}
              profileImage={config.cliente?.foto || clientInfo.foto}
              editing={isEditing}
              onChange={setConfig}
            />
          </div>
        </main>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          .diag-preview { overflow: visible !important; height: auto !important; border: 0 !important; }
          section { page-break-after: always; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
