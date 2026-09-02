import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import {
  Upload, X, Loader2, BarChart3, Wand2, AlertTriangle,
  CheckCircle2, AlertCircle, TrendingUp, TrendingDown, Target, Zap, MessageCircle,
  Sparkles, Download, Share2, ArrowRight, Eye, MousePointerClick,
  DollarSign, Users, Activity, Trophy, Rocket, Lightbulb,
  History, Trash2, ExternalLink, Copy, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import LogoInova from '@/assets/logo-inova.png';
import { useSeo } from '@/lib/seo';
import { PAGE_THUMBS } from '@/lib/pageThumbs';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, Cell,
} from 'recharts';

type Status = 'good' | 'warning' | 'bad';

interface MetricReading {
  name: string;
  value?: string;
  benchmark?: string;
  classification: string;
  status: Status;
  interpretation: string;
  icon?: string;
  /** 0-100: o quão próximo a métrica está da meta/benchmark */
  performance?: number;
  /** Valor do período anterior (ex: mês passado) para comparativo Antes x Hoje */
  valueBefore?: string;
}

const CLASSIFICATION_SCORE: Record<string, number> = {
  excelente: 100,
  ótima: 95,
  boa: 75,
  média: 50,
  media: 50,
  baixa: 30,
  crítica: 10,
  critica: 10,
};

function metricPerformance(m: MetricReading): number {
  if (typeof m.performance === 'number' && !isNaN(m.performance)) {
    return Math.max(0, Math.min(100, m.performance));
  }
  const key = (m.classification || '').toLowerCase().trim();
  return CLASSIFICATION_SCORE[key] ?? 50;
}

const PERF_COLORS = { good: '#10b981', warning: '#f59e0b', bad: '#ef4444' } as const;
function perfColor(p: number): string {
  return p >= 70 ? PERF_COLORS.good : p >= 40 ? PERF_COLORS.warning : PERF_COLORS.bad;
}

/** Converte "79.604", "3,55%", "+52", "R$ 1.847,50" em número. */
function parseNum(raw?: string): number | null {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[^0-9.,-]/g, '');
  if (!cleaned || !/[0-9]/.test(cleaned)) return null;
  let normalized = cleaned;
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    const last = parts[parts.length - 1];
    normalized = last.length === 3 ? parts.join('') : cleaned;
  }
  const n = Number(normalized);
  return isNaN(n) ? null : n;
}

function numSuffix(raw?: string): string {
  if (!raw) return '';
  if (raw.includes('%')) return '%';
  return '';
}

const numberFmt = (n: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);



interface Diagnosis {
  campanha?: {
    nome?: string;
    plataforma?: string;
    periodo?: string;
    objetivo?: string;
  };
  resumo: {
    classificacao: Status;
    titulo: string;
    explicacao: string;
    scoreGeral: number; // 0-100
  };
  kpisDestaque?: {
    label: string;
    value: string;
    delta?: string;
    status: Status;
  }[];
  metricas: MetricReading[];
  scores?: {
    criativo: number;
    publico: number;
    oferta: number;
    estrutura: number;
  };
  diagnosticoEstrategico: {
    problemaPrincipal: string;
    gargalo: string;
    detalhe: string;
    pontosFortes?: string[];
    pontosFracos?: string[];
  };
  planoDeAcao: { titulo: string; descricao: string; prioridade?: 'alta' | 'media' | 'baixa' }[];
  projecao?: {
    cenarioAtual: string;
    cenarioOtimizado: string;
    potencial: string;
  };
  alertas: { tipo: Status; mensagem: string }[];
}

const DEFAULT_WHATSAPP_NUMBER = '5588994463203';
const WHATSAPP_STORAGE_KEY = 'social_audit_whatsapp_number';

function sanitizeWhatsApp(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return '55' + digits.slice(1);
  if (digits.length <= 11) return '55' + digits;
  return digits;
}

const STATUS_STYLES: Record<Status, { bg: string; text: string; border: string; icon: any; label: string; ring: string }> = {
  good:    { bg: 'bg-emerald-500/10',  text: 'text-emerald-400',  border: 'border-emerald-500/30',  icon: CheckCircle2,   label: 'Boa',      ring: 'ring-emerald-500/40' },
  warning: { bg: 'bg-amber-500/10',    text: 'text-amber-400',    border: 'border-amber-500/30',    icon: AlertCircle,    label: 'Atenção',  ring: 'ring-amber-500/40' },
  bad:     { bg: 'bg-red-500/10',      text: 'text-red-400',      border: 'border-red-500/30',      icon: AlertTriangle,  label: 'Problema', ring: 'ring-red-500/40' },
};

const METRIC_ICONS: Record<string, any> = {
  ctr: MousePointerClick, cpc: DollarSign, cpm: DollarSign, roas: TrendingUp,
  frequencia: Activity, conversoes: Trophy, alcance: Eye, impressoes: Eye,
  gasto: DollarSign, leads: Users,
};

function getMetricIcon(name: string) {
  const key = name.toLowerCase().replace(/[^a-z]/g, '');
  for (const k of Object.keys(METRIC_ICONS)) {
    if (key.includes(k)) return METRIC_ICONS[k];
  }
  return TrendingUp;
}

export default function SocialAuditPage() {
  useSeo({
    title: 'Diagnóstico de Redes Sociais — INOVA Co.',
    description: 'Análise do seu perfil: conteúdo, engajamento e oportunidades de crescimento. INOVA Co., Volta Redonda (RJ).',
    image: PAGE_THUMBS.diagnostico,
    noindex: false,
  });
  const { user } = useAuth();
  const { slug: routeSlug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const isPublicView = !!routeSlug;

  const [shots, setShots] = useState<{ file: File; dataUrl: string }[]>([]);
  const [clientName, setClientName] = useState('');
  const [tone, setTone] = useState<'positiva' | 'negativa'>('positiva');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingSlug, setIsLoadingSlug] = useState(false);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [savedClient, setSavedClient] = useState<string>('');
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_WHATSAPP_NUMBER;
    return localStorage.getItem(WHATSAPP_STORAGE_KEY) || DEFAULT_WHATSAPP_NUMBER;
  });
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  const reportRef = useRef<HTMLDivElement>(null);

  // Load by slug
  useEffect(() => {
    if (!routeSlug) {
      navigate('/instagram-analytics');
      return;
    }
    setIsLoadingSlug(true);
    supabase.from('social_audits').select('*').eq('slug', routeSlug).maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error('Relatório não encontrado.');
          setIsLoadingSlug(false);
          return;
        }
        setDiagnosis(data.diagnosis as unknown as Diagnosis);
        setSavedSlug(data.slug);
        setSavedClient(data.client_name || '');
        setIsLoadingSlug(false);
      });
  }, [routeSlug, navigate]);



  // Load history when authenticated
  const fetchHistory = async () => {
    if (!user || isPublicView) return;
    setIsLoadingHistory(true);
    const { data } = await supabase
      .from('ads_audits')
      .select('id, slug, client_name, campaign_name, platform, score, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    setHistory(data || []);
    setIsLoadingHistory(false);
  };
  useEffect(() => { fetchHistory(); }, [user, isPublicView]);

  const MAX_SHOTS = 6;

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    if (!incoming.length) return;

    const valid = incoming.filter((f) => {
      if (!/^image\/(png|jpe?g)$/.test(f.type)) {
        toast.error(`"${f.name}": use PNG, JPG ou JPEG`);
        return false;
      }
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`"${f.name}": imagem muito grande (máx 10MB)`);
        return false;
      }
      return true;
    });
    if (!valid.length) return;

    setShots((prev) => {
      const free = MAX_SHOTS - prev.length;
      if (free <= 0) {
        toast.error(`Máximo de ${MAX_SHOTS} prints`);
        return prev;
      }
      const slice = valid.slice(0, free);
      if (valid.length > free) toast.warning(`Apenas ${free} print(s) adicionados (máx ${MAX_SHOTS}).`);
      slice.forEach((f) => {
        const reader = new FileReader();
        reader.onload = () => {
          setShots((cur) =>
            cur.map((s) => (s.file === f ? { ...s, dataUrl: reader.result as string } : s))
          );
        };
        reader.readAsDataURL(f);
      });
      return [...prev, ...slice.map((f) => ({ file: f, dataUrl: '' }))];
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const removeShot = (idx: number) => setShots((prev) => prev.filter((_, i) => i !== idx));

  const reset = () => {
    setShots([]);
    setDiagnosis(null);
    setClientName('');
    setSavedSlug(null);
    setSavedClient('');
    if (isPublicView) navigate('/diagnostico-social');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const generateSlug = (name: string) => {
    const base = (name || 'cliente')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'cliente';
    const rand = Math.random().toString(36).substring(2, 8);
    return `${base}-${rand}`;
  };

  const analyze = async () => {
    const ready = shots.filter((s) => s.dataUrl);
    if (!ready.length) return;
    if (!clientName.trim()) {
      toast.error('Informe o nome do cliente antes de gerar o relatório.');
      return;
    }
    setIsProcessing(true);
    setDiagnosis(null);
    const toastId = toast.loading('Analisando dados e gerando relatório estratégico…');

    try {
      const imagesPayload = ready.map((s) => ({
        base64: s.dataUrl.split(',')[1],
        mimeType: s.file.type,
      }));

      const toneInstruction = tone === 'positiva'
        ? `TOM DA MENSAGEM: POSITIVO E ENCORAJADOR. Mesmo apontando problemas, destaque oportunidades, conquistas e o potencial de crescimento. Use linguagem otimista ("ótima base", "com pequenos ajustes", "potencial enorme"). Suavize críticas. Foque no que pode melhorar e na evolução. Evite alarmar o cliente.`
        : `TOM DA MENSAGEM: CRÍTICO E DIRETO (NEGATIVO/ALERTA). Seja franco, urgente e mostre os riscos reais de manter a campanha como está. Use linguagem de alerta ("perda de dinheiro", "campanha sangrando verba", "urgente", "crítico"). Destaque o quanto está sendo desperdiçado e a necessidade de agir AGORA. Não suavize problemas.`;

      const systemPrompt = `Você é um Consultor Sênior de Tráfego Pago (Meta Ads, Google Ads, TikTok Ads) com 10+ anos de experiência.
Vai receber UM OU MAIS PRINTS de gerenciador de anúncios (telas complementares da mesma conta/campanha). Faça OCR mental de TODOS, consolide as métricas visíveis (CTR, CPC, CPM, ROAS, frequência, conversões, gasto, alcance, impressões, leads, CPA) e gere UM ÚNICO RELATÓRIO VISUAL COMPLETO de nível agência premium.

${toneInstruction}

REGRAS DE OURO:


1. Capture os VALORES REAIS visíveis no print (ex: "CTR: 1.24%", "Gasto: R$ 1.847,50"). Use os valores exatos.
2. Identifique a plataforma (Meta/Facebook, Google, TikTok) e o objetivo da campanha se visível.
3. Para CADA métrica visível, dê: valor real, valor do período anterior (valueBefore — OBRIGATÓRIO sempre que possível), benchmark do mercado BR, classificação (Excelente/Boa/Média/Baixa/Crítica), performance de 0-100 (o quão próximo está da meta) e 1 frase prática do que significa, escrita para um cliente leigo.
   REGRAS PARA valueBefore (preencher para TODAS as métricas):
   a) Se o print mostrar comparação percentual (ex: "vs período anterior: +25%" ou "↑ 25%"), CALCULE o valor anterior: valueBefore = value / (1 + pct/100). Ex: alcance hoje = 10.000 com "+25%" → valueBefore = "8.000".
   b) Se houver prints de períodos diferentes (ex: agosto e setembro), use o valor mais antigo em valueBefore e o mais recente em value.
   c) Se o print mostrar um gráfico com datas, use o valor aproximado do início do período como valueBefore e o valor atual como value.
   d) Somente se for realmente impossível saber o valor anterior, omita valueBefore.
4. Seja DIRETO. Sem jargão. O cliente é leigo.
5. Score geral de 0-100 baseado em performance global.
6. Scores por dimensão (criativo, publico, oferta, estrutura) de 0-100.
7. Plano de ação: 5-7 ações com TÍTULO + DESCRIÇÃO + prioridade.
8. KPIs destaque: 3-4 indicadores principais para colocar em cards grandes no topo.
9. Projeção: descreva cenário atual vs cenário otimizado e potencial de ganho %.
10. Status válidos: "good" (verde), "warning" (amarelo), "bad" (vermelho).

Retorne APENAS JSON neste formato:
{
  "campanha": {
    "nome": "Nome da campanha se visível ou 'Campanha analisada'",
    "plataforma": "Meta Ads | Google Ads | TikTok Ads",
    "periodo": "ex: Últimos 7 dias",
    "objetivo": "ex: Conversões, Tráfego, Alcance"
  },
  "resumo": {
    "classificacao": "good" | "warning" | "bad",
    "titulo": "Boa" | "Regular" | "Ruim" | "Crítica" | "Excelente",
    "explicacao": "2-3 frases diretas sobre o estado geral da campanha",
    "scoreGeral": 65
  },
  "kpisDestaque": [
    { "label": "ROAS", "value": "2.4x", "delta": "+15% vs meta", "status": "good" },
    { "label": "CPA", "value": "R$ 47,80", "delta": "Acima do ideal", "status": "warning" }
  ],
  "metricas": [
    { "name": "CTR", "value": "1.24%", "valueBefore": "0.98%", "benchmark": "Ideal: > 1.5%", "classification": "Baixa", "status": "warning", "performance": 55, "interpretation": "Poucas pessoas estão clicando — o criativo precisa chamar mais atenção." }
  ],
  "scores": {
    "criativo": 60,
    "publico": 75,
    "oferta": 50,
    "estrutura": 80
  },
  "diagnosticoEstrategico": {
    "problemaPrincipal": "Frase resumindo o maior problema",
    "gargalo": "Criativo" | "Público" | "Oferta" | "Estrutura",
    "detalhe": "Parágrafo explicando em detalhes o gargalo",
    "pontosFortes": ["ponto 1", "ponto 2"],
    "pontosFracos": ["ponto 1", "ponto 2", "ponto 3"]
  },
  "planoDeAcao": [
    { "titulo": "Criar 3 novos criativos", "descricao": "Teste ganchos diferentes nos primeiros 3 segundos", "prioridade": "alta" }
  ],
  "projecao": {
    "cenarioAtual": "Mantendo essa estrutura, você gasta R$ X para gerar Y leads/mês",
    "cenarioOtimizado": "Com os ajustes sugeridos, é possível reduzir CPA em 30% e dobrar conversões",
    "potencial": "+150% de ROI em 30 dias"
  },
  "alertas": [
    { "tipo": "warning", "mensagem": "Frequência alta (3.4) — possível saturação do público" }
  ]
}

IMPORTANTE: Retorne SOMENTE o JSON, sem markdown, sem explicações.`;

      const { data: fnData, error: fnError } = await supabase.functions.invoke('ai-copywriter', {
        body: {
          systemPrompt,
          userMessage: `${toneInstruction}\n\nForam enviados ${imagesPayload.length} print(s) do gerenciador de anúncios. Analise TODOS eles em conjunto (podem ser telas complementares da mesma conta/campanha), consolide as métricas e gere UM único relatório completo no formato JSON pedido. LEMBRE-SE: TODO o texto (resumo.titulo, resumo.explicacao, interpretacao de cada métrica, diagnosticoEstrategico, planoDeAcao, projecao, alertas) DEVE refletir o tom ${tone === 'positiva' ? 'POSITIVO e encorajador' : 'NEGATIVO, crítico e de alerta urgente'} escolhido. Não misture os dois tons.`,
          model: 'google/gemini-2.5-flash',
          images: imagesPayload,
        },
      });

      if (fnError) throw new Error(fnError.message || 'Erro ao chamar IA');
      if (fnData?.error) throw new Error(fnData.error);

      let result: any = fnData?.result;
      if (typeof result === 'string') {
        const cleaned = result.replace(/```json/g, '').replace(/```/g, '').trim();
        result = JSON.parse(cleaned);
      }
      if (!result?.resumo) throw new Error('IA não retornou um relatório válido');

      // Save to DB with unique slug
      const newSlug = generateSlug(clientName);
      const { error: insertError } = await supabase.from('social_audits').insert({
        user_id: user?.id ?? null,
        slug: newSlug,
        client_name: clientName.trim(),
        campaign_name: result?.campanha?.nome || '',
        platform: result?.campanha?.plataforma || '',
        score: result?.resumo?.scoreGeral ?? 0,
        diagnosis: result,
      } as any);

      if (insertError) {
        console.warn('Erro ao salvar relatório:', insertError);
        toast.warning('Relatório gerado, mas não pôde ser salvo no histórico.');
      } else {
        setSavedSlug(newSlug);
        setSavedClient(clientName.trim());
        fetchHistory();
      }

      setDiagnosis(result as Diagnosis);
      toast.success('Relatório pronto!', { id: toastId });
      setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    } catch (err: any) {
      console.error('Ads audit error:', err);
      toast.error(err.message || 'Erro ao analisar. Tente uma imagem mais nítida.', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteAudit = async (id: string) => {
    if (!confirm('Excluir este relatório do histórico?')) return;
    const { error } = await supabase.from('social_audits').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir.'); return; }
    toast.success('Relatório excluído.');
    fetchHistory();
  };

  const copyShareLink = async (slug: string) => {
    const url = `${window.location.origin}/diagnostico-anuncios/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado!');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  const openWhatsApp = () => {
    const msg = encodeURIComponent(
      'Olá INOVA! Acabei de fazer o diagnóstico dos meus anúncios e quero ajuda para melhorar os resultados.'
    );
    const target = sanitizeWhatsApp(whatsappNumber) || DEFAULT_WHATSAPP_NUMBER;
    window.open(`https://wa.me/${target}?text=${msg}`, '_blank');
  };

  const handlePrint = () => window.print();

  const handleShare = async () => {
    const publicUrl = savedSlug
      ? `${window.location.origin}/diagnostico-anuncios/${savedSlug}`
      : window.location.href;
    const shareData = {
      title: `Diagnóstico de Redes Sociais — ${savedClient || 'INOVA Co.'}`,
      text: 'Veja o relatório completo da campanha analisado pela INOVA.',
      url: publicUrl,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(publicUrl);
        toast.success('Link público copiado!');
      }
    } catch {}
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Progress bar */}
      {diagnosis && (
        <motion.div
          className="fixed top-0 left-0 right-0 h-1 bg-primary z-50 origin-left print:hidden"
          style={{ scaleX }}
        />
      )}

      {/* PUBLIC SLUG LOADING */}
      {isPublicView && isLoadingSlug && (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground uppercase tracking-widest font-bold">Carregando relatório…</p>
        </div>
      )}

      {/* PUBLIC SLUG NOT FOUND */}
      {isPublicView && !isLoadingSlug && !diagnosis && (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground" />
          <h2 className="text-2xl font-black uppercase tracking-tight text-foreground">Relatório não encontrado</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            O link pode estar incorreto ou o relatório foi removido.
          </p>
          <Button onClick={() => navigate('/diagnostico-social')} className="mt-2">
            Criar novo diagnóstico
          </Button>
        </div>
      )}

      {/* UPLOAD VIEW (only when not public view) */}
      {!isPublicView && !diagnosis && (
        <div className="min-h-screen p-4 sm:p-6 lg:p-10">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 sm:mb-12 text-center"
            >
              <div className="inline-flex p-3 bg-primary/10 rounded-2xl mb-4">
                <BarChart3 className="w-7 h-7 text-primary" />
              </div>
              <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tighter italic text-foreground mb-3">
                Diagnóstico de Redes Sociais
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
                Envie um print do gerenciador de anúncios e gere um <strong className="text-foreground">relatório visual completo</strong> com link próprio para enviar ao cliente.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card/50 border border-border rounded-3xl p-6 sm:p-8 backdrop-blur-sm space-y-5"
            >
              {/* Client name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Nome do cliente <span className="text-primary">*</span>
                </label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex: Restaurante Sabor & Arte"
                  className="h-12 text-base"
                />
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  Usado para gerar o link único do relatório.
                </p>
              </div>

              {/* Tone selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Tom da mensagem <span className="text-primary">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTone('positiva')}
                    className={cn(
                      'p-3 rounded-xl border-2 text-left transition-all',
                      tone === 'positiva'
                        ? 'border-emerald-500/60 bg-emerald-500/10'
                        : 'border-border bg-background/40 hover:border-border/80'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-black uppercase tracking-wider text-foreground">Positiva</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Encorajadora, foco em oportunidades e potencial de crescimento.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTone('negativa')}
                    className={cn(
                      'p-3 rounded-xl border-2 text-left transition-all',
                      tone === 'negativa'
                        ? 'border-red-500/60 bg-red-500/10'
                        : 'border-border bg-background/40 hover:border-border/80'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span className="text-sm font-black uppercase tracking-wider text-foreground">Negativa / Alerta</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Crítica e urgente, destaca riscos e desperdício de verba.
                    </p>
                  </button>
                </div>
              </div>

              {/* WhatsApp CTA number */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  WhatsApp do botão final
                </label>
                <Input
                  value={whatsappNumber}
                  onChange={(e) => {
                    const v = e.target.value;
                    setWhatsappNumber(v);
                    try { localStorage.setItem(WHATSAPP_STORAGE_KEY, v); } catch {}
                  }}
                  placeholder="Ex: 5588994463203 (com DDI 55)"
                  className="h-12 text-base"
                  inputMode="tel"
                />
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  Número usado no botão "Falar no WhatsApp" ao final do relatório. Salvo automaticamente neste navegador.
                </p>
              </div>




              {shots.length === 0 ? (
                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  className="flex flex-col items-center justify-center w-full h-72 sm:h-80 border-2 border-dashed border-border rounded-2xl bg-background/40 hover:bg-background/60 hover:border-primary/50 transition-all cursor-pointer group"
                >
                  <div className="p-4 bg-primary/10 rounded-full mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <p className="mb-2 text-sm font-bold uppercase tracking-widest text-foreground">
                    Arraste ou clique para enviar
                  </p>
                  <p className="text-xs text-muted-foreground text-center px-4 max-w-md">
                    Prints do Meta Ads, Google Ads ou TikTok Ads com métricas visíveis (CTR, CPC, ROAS, frequência, conversões…). Você pode enviar vários de uma vez.
                  </p>
                  <p className="mt-3 text-[10px] text-muted-foreground/70">PNG, JPG, JPEG (máx 10MB cada · até {MAX_SHOTS} prints)</p>
                  <input type="file" multiple className="hidden" accept="image/png,image/jpeg" onChange={handleFileChange} />
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {shots.map((shot, idx) => (
                      <div key={idx} className="relative h-40 rounded-2xl overflow-hidden border border-border shadow-lg bg-black/40">
                        {shot.dataUrl ? (
                          <img src={shot.dataUrl} alt={`Print ${idx + 1}`} className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                          </div>
                        )}
                        <span className="absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-background/80 text-foreground">
                          {idx + 1}
                        </span>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => removeShot(idx)}
                          className="absolute top-2 right-2 rounded-full h-7 w-7 shadow-lg"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}

                    {shots.length < MAX_SHOTS && (
                      <label
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={onDrop}
                        className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-2xl bg-background/40 hover:bg-background/60 hover:border-primary/50 transition-all cursor-pointer"
                      >
                        <Upload className="w-6 h-6 text-primary mb-2" />
                        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Adicionar print</span>
                        <input type="file" multiple className="hidden" accept="image/png,image/jpeg" onChange={handleFileChange} />
                      </label>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground/70 text-center">
                    {shots.length} de {MAX_SHOTS} prints · a IA analisa todos em conjunto num único relatório.
                  </p>
                </div>
              )}

              <div className="flex justify-center pt-2">
                <Button
                  onClick={analyze}
                  disabled={shots.length === 0 || !clientName.trim() || isProcessing}
                  className="bg-primary text-primary-foreground font-black px-10 h-14 rounded-2xl hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 uppercase tracking-wider"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                      Gerando relatório estratégico…
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5 mr-3" />
                      Gerar relatório
                    </>
                  )}
                </Button>
              </div>
            </motion.div>

            {/* HISTORY */}
            {user && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-8"
              >
                <div className="flex items-center gap-2 mb-4">
                  <History className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-black uppercase tracking-tight text-foreground">
                    Histórico de relatórios
                  </h2>
                  <span className="text-xs text-muted-foreground">({history.length})</span>
                </div>

                {isLoadingHistory ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-10 bg-card/40 border border-dashed border-border rounded-2xl">
                    <p className="text-sm text-muted-foreground">
                      Nenhum relatório gerado ainda. Crie o primeiro acima!
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {history.map((item) => {
                      const status: Status = item.score >= 70 ? 'good' : item.score >= 40 ? 'warning' : 'bad';
                      const s = STATUS_STYLES[status];
                      return (
                        <div
                          key={item.id}
                          className="group bg-card border border-border rounded-2xl p-4 hover:border-primary/40 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-black text-foreground truncate">{item.client_name || 'Sem nome'}</h3>
                              <p className="text-xs text-muted-foreground truncate">
                                {item.platform || 'Plataforma —'} · {item.campaign_name || 'Campanha'}
                              </p>
                            </div>
                            <div className={cn('shrink-0 px-2.5 py-1 rounded-full text-xs font-black tabular-nums', s.bg, s.text)}>
                              {item.score}/100
                            </div>
                          </div>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-3">
                            {new Date(item.created_at).toLocaleString('pt-BR')}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/diagnostico-anuncios/${item.slug}`)}
                              className="h-8 text-xs"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1.5" /> Abrir
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyShareLink(item.slug)}
                              className="h-8 text-xs"
                            >
                              <Copy className="w-3.5 h-3.5 mr-1.5" /> Link
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteAudit(item.id)}
                              className="h-8 text-xs text-destructive hover:text-destructive ml-auto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            <p className="text-[10px] text-muted-foreground/60 text-center mt-10 italic">
              🔒 Sua imagem é processada apenas para a análise. Os relatórios ficam salvos para compartilhamento via link.
            </p>
          </div>
        </div>
      )}

      {/* REPORT VIEW (LANDING PAGE STYLE) */}
      <AnimatePresence>
        {diagnosis && (
          <motion.div
            ref={reportRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-background"
          >
            {/* Floating action toolbar */}
            <div className="fixed top-4 right-4 z-40 flex flex-wrap gap-2 print:hidden max-w-[calc(100vw-2rem)] justify-end">
              {!isPublicView && (
                <Button onClick={reset} variant="outline" size="sm" className="rounded-full shadow-lg backdrop-blur-md bg-background/80">
                  <Plus className="w-4 h-4 mr-2" /> Novo
                </Button>
              )}
              <Button onClick={handlePrint} variant="outline" size="sm" className="rounded-full shadow-lg backdrop-blur-md bg-background/80">
                <Download className="w-4 h-4 mr-2" /> PDF
              </Button>
              <Button onClick={handleShare} variant="outline" size="sm" className="rounded-full shadow-lg backdrop-blur-md bg-background/80">
                <Share2 className="w-4 h-4 mr-2" /> Compartilhar
              </Button>
              {!isPublicView && savedSlug && (
                <Button
                  onClick={() => window.open(`/diagnostico-anuncios/${savedSlug}`, '_blank')}
                  variant="outline" size="sm"
                  className="rounded-full shadow-lg backdrop-blur-md bg-background/80"
                >
                  <ExternalLink className="w-4 h-4 mr-2" /> Link cliente
                </Button>
              )}
            </div>

            {/* HERO */}
            <HeroSection diagnosis={diagnosis} />

            {/* CONTENT */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-12 sm:py-20 space-y-12 sm:space-y-20">
              {/* KPIs DESTAQUE */}
              {diagnosis.kpisDestaque && diagnosis.kpisDestaque.length > 0 && (
                <KpisSection kpis={diagnosis.kpisDestaque} />
              )}

              {/* SCORES POR DIMENSÃO */}
              {diagnosis.scores && <ScoresSection scores={diagnosis.scores} />}

              {/* COMPARATIVO ANTES x HOJE */}
              <BeforeAfterSection metricas={diagnosis.metricas} kpis={diagnosis.kpisDestaque} periodo={diagnosis.campanha?.periodo} />

              {/* GRÁFICO COMPARATIVO DAS MÉTRICAS */}
              <MetricsChartSection metricas={diagnosis.metricas} />

              {/* MÉTRICAS DETALHADAS */}
              <MetricsSection metricas={diagnosis.metricas} />

              {/* GLOSSÁRIO DIDÁTICO */}
              <GlossarySection metricas={diagnosis.metricas} />

              {/* DIAGNÓSTICO ESTRATÉGICO */}
              <StrategicSection diag={diagnosis.diagnosticoEstrategico} />

              {/* PROJEÇÃO */}
              {diagnosis.projecao && <ProjectionSection projecao={diagnosis.projecao} />}

              {/* PLANO DE AÇÃO */}
              <ActionPlanSection acoes={diagnosis.planoDeAcao} />

              {/* ALERTAS */}
              {diagnosis.alertas && diagnosis.alertas.length > 0 && (
                <AlertsSection alertas={diagnosis.alertas} />
              )}

              {/* CTA FINAL */}
              <CtaSection onWhatsApp={openWhatsApp} />

              {/* FOOTER */}
              <footer className="pt-10 pb-4 text-center border-t border-border">
                <img src={LogoInova} alt="INOVA Co." className="h-8 mx-auto mb-3 opacity-60" />
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
                  Relatório gerado por INOVA Co. · {new Date().toLocaleDateString('pt-BR')}
                </p>
              </footer>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────────────── SECTIONS ───────────────── */

function HeroSection({ diagnosis }: { diagnosis: Diagnosis }) {
  const s = STATUS_STYLES[diagnosis.resumo.classificacao] || STATUS_STYLES.warning;
  const score = diagnosis.resumo.scoreGeral ?? 50;
  const campanha = diagnosis.campanha;

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-black via-zinc-900 to-black text-white py-16 sm:py-24 px-4 sm:px-6 lg:px-10">
      {/* Grid bg */}
      <div className="absolute inset-0 opacity-[0.07]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />
      {/* Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] opacity-50" />

      <div className="relative max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <img src={LogoInova} alt="INOVA" className="h-7 sm:h-9 brightness-0 invert opacity-80" />
          <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">
            Relatório Estratégico
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="text-[10px] sm:text-xs uppercase tracking-[0.4em] text-primary font-black mb-4"
        >
          Diagnóstico de Redes Sociais
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-black uppercase tracking-tighter italic leading-[0.95] mb-6"
        >
          Sua campanha está<br />
          <span className={cn('inline-block', s.text)}>{diagnosis.resumo.titulo.toLowerCase()}</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="text-base sm:text-lg text-white/70 max-w-2xl mb-10 leading-relaxed"
        >
          {diagnosis.resumo.explicacao}
        </motion.p>

        {/* Campaign meta */}
        {campanha && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="flex flex-wrap gap-2 mb-10"
          >
            {campanha.plataforma && (
              <span className="px-3 py-1.5 rounded-full bg-white/10 text-xs font-bold text-white/80 border border-white/10">
                {campanha.plataforma}
              </span>
            )}
            {campanha.objetivo && (
              <span className="px-3 py-1.5 rounded-full bg-white/10 text-xs font-bold text-white/80 border border-white/10">
                Objetivo: {campanha.objetivo}
              </span>
            )}
            {campanha.periodo && (
              <span className="px-3 py-1.5 rounded-full bg-white/10 text-xs font-bold text-white/80 border border-white/10">
                {campanha.periodo}
              </span>
            )}
          </motion.div>
        )}

        {/* SCORE GAUGE */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
          className="inline-flex items-center gap-6 sm:gap-10 p-6 sm:p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl"
        >
          <ScoreGauge score={score} status={diagnosis.resumo.classificacao} />
          <div>
            <p className="text-[10px] uppercase font-bold tracking-widest text-white/50 mb-1">Score Geral</p>
            <p className="text-4xl sm:text-5xl font-black tabular-nums">{score}<span className="text-xl text-white/40">/100</span></p>
            <p className={cn('text-xs font-bold uppercase tracking-wider mt-1', s.text)}>
              {diagnosis.resumo.titulo}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ScoreGauge({ score, status }: { score: number; status: Status }) {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;
  const colors = { good: '#10b981', warning: '#f59e0b', bad: '#ef4444' };
  return (
    <div className="relative w-24 h-24 sm:w-32 sm:h-32 shrink-0">
      <svg className="w-full h-full -rotate-90">
        <circle cx="50%" cy="50%" r="45%" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
        <motion.circle
          cx="50%" cy="50%" r="45%" fill="none"
          stroke={colors[status]} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl sm:text-3xl font-black tabular-nums">{score}</span>
      </div>
    </div>
  );
}

function KpisSection({ kpis }: { kpis: NonNullable<Diagnosis['kpisDestaque']> }) {
  return (
    <Section title="KPIs em destaque" subtitle="Os indicadores que mais impactam o resultado da campanha">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((kpi, i) => {
          const s = STATUS_STYLES[kpi.status] || STATUS_STYLES.warning;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className={cn('p-4 sm:p-6 rounded-2xl border-2 backdrop-blur-sm', s.bg, s.border)}
            >
              <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-2">{kpi.label}</p>
              <p className={cn('text-2xl sm:text-4xl font-black tabular-nums tracking-tight', s.text)}>{kpi.value}</p>
              {kpi.delta && (
                <p className="text-xs text-muted-foreground mt-2 leading-tight">{kpi.delta}</p>
              )}
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}

function ScoresSection({ scores }: { scores: NonNullable<Diagnosis['scores']> }) {
  const items = [
    { label: 'Criativo', value: scores.criativo, icon: Sparkles },
    { label: 'Público', value: scores.publico, icon: Users },
    { label: 'Oferta', value: scores.oferta, icon: Target },
    { label: 'Estrutura', value: scores.estrutura, icon: BarChart3 },
  ];
  return (
    <Section title="Scores por dimensão" subtitle="Performance da campanha em cada pilar estratégico">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((item, i) => {
          const status: Status = item.value >= 70 ? 'good' : item.value >= 40 ? 'warning' : 'bad';
          const s = STATUS_STYLES[status];
          const Icon = item.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="p-5 rounded-2xl bg-card border border-border"
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon className={cn('w-4 h-4', s.text)} />
                <p className="text-xs uppercase font-bold tracking-widest text-foreground">{item.label}</p>
              </div>
              <div className="flex items-end justify-between mb-2">
                <span className="text-3xl font-black tabular-nums text-foreground">{item.value}</span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }} whileInView={{ width: `${item.value}%` }} viewport={{ once: true }}
                  transition={{ duration: 1, delay: i * 0.1 }}
                  className={cn('h-full rounded-full', status === 'good' ? 'bg-emerald-500' : status === 'warning' ? 'bg-amber-500' : 'bg-red-500')}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}

function BeforeAfterSection({
  metricas,
  kpis,
  periodo,
}: {
  metricas: MetricReading[];
  kpis?: NonNullable<Diagnosis['kpisDestaque']>;
  periodo?: string;
}) {
  const rows = (metricas || [])
    .map((m) => {
      const now = parseNum(m.value);
      let before: number | null = parseNum(m.valueBefore);
      let estimated = false;

      // Fallback 1: % de variação embutida no próprio texto da métrica
      // (ex: "10.000 (+25%)" ou interpretation com "cresceu 25% vs período anterior")
      if (before == null && now != null) {
        const blob = `${m.value || ''} ${m.benchmark || ''} ${m.interpretation || ''}`;
        const pctMatch = blob.match(/([+-]?\d+(?:[.,]\d+)?)\s*%/);
        if (pctMatch && /vs|ante|per[ií]odo|cres|aumen|redu|queda|subiu|caiu|↑|↓/i.test(blob)) {
          const pct = parseFloat(pctMatch[1].replace(',', '.'));
          if (Number.isFinite(pct) && pct !== -100) {
            before = now / (1 + pct / 100);
            estimated = true;
          }
        }
      }

      // Fallback 2: deriva o "antes" a partir do delta % do KPI com mesmo nome
      if (before == null && kpis?.length) {
        const kpi = kpis.find((k) =>
          m.name.toLowerCase().replace(/[^a-zà-ú]/g, '').includes(
            k.label.toLowerCase().replace(/[^a-zà-ú]/g, '').slice(0, 10)
          )
        );
        const pct = parseNum(kpi?.delta || '');
        if (kpi && pct != null && (kpi.delta || '').includes('%') && now != null && pct !== -100) {
          before = now / (1 + pct / 100);
          estimated = true;
        }
      }
      if (now == null || before == null) return null;
      const delta = before !== 0 ? ((now - before) / Math.abs(before)) * 100 : 0;
      return {
        name: m.name.length > 20 ? m.name.slice(0, 18) + '…' : m.name,
        fullName: m.name,
        suffix: numSuffix(m.value),
        before,
        now,
        delta,
        estimated,
      };
    })
    .filter(Boolean) as { name: string; fullName: string; suffix: string; before: number; now: number; delta: number; estimated: boolean }[];

  if (!rows.length) return null;

  return (
    <Section
      title="Antes x Hoje"
      subtitle={periodo ? `Evolução do perfil no período (${periodo})` : 'Evolução de cada indicador em relação ao período anterior'}
    >
      {/* Cards didáticos */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        {rows.map((r, i) => {
          const up = r.delta >= 0;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                'rounded-2xl border p-4',
                up ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'
              )}
            >
              <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-3">{r.fullName}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground/70">Antes</p>
                  <p className="text-lg font-bold tabular-nums text-muted-foreground">
                    {numberFmt(r.before)}{r.suffix}{r.estimated && '*'}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground/70">Hoje</p>
                  <p className="text-2xl font-black tabular-nums text-foreground">{numberFmt(r.now)}{r.suffix}</p>
                </div>
                <span
                  className={cn(
                    'ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black tabular-nums',
                    up ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                  )}
                >
                  {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {up ? '+' : ''}{r.delta.toFixed(1).replace('.', ',')}%
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Gráfico comparativo */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="h-[260px] sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
              <XAxis type="number" hide />
              <YAxis
                type="category" dataKey="name" width={130}
                tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                tickLine={false} axisLine={false}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  const up = d.delta >= 0;
                  return (
                    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                      <p className="font-bold text-foreground">{d.fullName}</p>
                      <p className="text-muted-foreground">Antes: <span className="font-semibold text-foreground">{numberFmt(d.before)}{d.suffix}</span></p>
                      <p className="text-muted-foreground">Hoje: <span className="font-semibold text-foreground">{numberFmt(d.now)}{d.suffix}</span></p>
                      <p className="mt-1 font-bold" style={{ color: up ? PERF_COLORS.good : PERF_COLORS.bad }}>
                        {up ? '+' : ''}{d.delta.toFixed(1).replace('.', ',')}% de evolução
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="before" name="Antes" fill="hsl(var(--muted-foreground) / 0.45)" radius={[0, 6, 6, 0]} barSize={10} />
              <Bar dataKey="now" name="Hoje" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} barSize={10} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50" /> Antes (período anterior)</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> Hoje (período atual)</span>
          {rows.some((r) => r.estimated) && (
            <span className="italic">* valor do período anterior estimado a partir da variação informada</span>
          )}
        </div>
      </div>
    </Section>
  );
}

function MetricsChartSection({ metricas }: { metricas: MetricReading[] }) {
  const data = (metricas || [])
    .map((m) => ({
      name: m.name.length > 18 ? m.name.slice(0, 16) + '…' : m.name,
      fullName: m.name,
      value: m.value || '—',
      benchmark: m.benchmark || '',
      perf: metricPerformance(m),
    }))
    .sort((a, b) => a.perf - b.perf);

  if (!data.length) return null;

  return (
    <Section
      title="Comparação visual das métricas"
      subtitle="O quanto cada indicador está da meta do mercado (100% = no alvo ou acima)"
    >
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="h-[280px] sm:h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis
                type="category" dataKey="name" width={110}
                tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                tickLine={false} axisLine={false}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                      <p className="font-bold text-foreground">{d.fullName}</p>
                      <p className="text-muted-foreground">Real: <span className="font-semibold text-foreground">{d.value}</span></p>
                      {d.benchmark && <p className="text-muted-foreground">Meta: <span className="font-semibold text-foreground">{d.benchmark}</span></p>}
                      <p className="mt-1 font-bold" style={{ color: perfColor(d.perf) }}>{d.perf}% da meta</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="perf" radius={[0, 8, 8, 0]} barSize={20}>
                {data.map((d, i) => (
                  <Cell key={i} fill={perfColor(d.perf)} />
                ))}
                <LabelList
                  dataKey="perf" position="right"
                  formatter={(v: any) => `${v}%`}
                  style={{ fontSize: 11, fontWeight: 800, fill: 'hsl(var(--foreground))' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Legenda didática */}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PERF_COLORS.good }} /> No alvo (70%+)</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PERF_COLORS.warning }} /> Pode melhorar (40–69%)</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PERF_COLORS.bad }} /> Precisa de atenção (abaixo de 40%)</span>
        </div>
      </div>
    </Section>
  );
}

function GlossarySection({ metricas }: { metricas: MetricReading[] }) {
  // Explica o termo de cada métrica em linguagem simples
  const items = (metricas || []).map((m) => ({
    name: m.name,
    meaning: GLOSSARY[Object.keys(GLOSSARY).find((k) => m.name.toLowerCase().includes(k)) || ''] || m.interpretation,
  })).filter((g) => g.meaning);

  if (!items.length) return null;

  return (
    <Section
      title="Entenda cada métrica"
      subtitle="Traduzimos os termos técnicos para você acompanhar sem dúvidas"
    >
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map((g, i) => (
          <div key={i} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="shrink-0 p-2 h-fit rounded-lg bg-primary/10">
              <Lightbulb className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">{g.name}</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">{g.meaning}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

const GLOSSARY: Record<string, string> = {
  seguidores: 'Total de pessoas que acompanham o perfil. É a base de fãs da marca — quanto maior e mais engajada, mais autoridade.',
  alcance: 'Quantas pessoas diferentes viram o conteúdo. Mostra o potencial de visibilidade da marca.',
  impressões: 'Quantas vezes o conteúdo foi exibido no total (uma mesma pessoa pode ver mais de uma vez).',
  visitas: 'Quantas pessoas entraram no perfil. É o caminho para ganhar seguidores e clientes — por isso bio e destaques importam.',
  engajamento: 'Percentual de pessoas que interagiram (curtiram, comentaram, salvaram, compartilharam) em relação ao que viram. Acima de 3% é considerado bom.',
  ctr: 'Percentual de pessoas que viram o anúncio e clicaram. Quanto maior, mais atrativa está a peça.',
  cpc: 'Quanto custa cada clique no anúncio. Quanto menor, mais eficiente.',
  cpm: 'Custo para exibir o anúncio 1.000 vezes. Indica o preço de alcançar o público.',
  roas: 'Retorno sobre o investimento: para cada R$ 1 investido, quanto voltou em vendas. Acima de 2x já é positivo.',
  cpa: 'Custo para conquistar cada conversão (venda, lead ou cadastro).',
  frequência: 'Quantas vezes, em média, a mesma pessoa viu o anúncio. Acima de 3 pode indicar cansaço do público.',
  conversões: 'Quantas ações desejadas aconteceram (compras, cadastros, mensagens). É o resultado final que importa.',
  leads: 'Quantas pessoas deixaram contato demonstrando interesse. É a porta de entrada de novos clientes.',
  publicações: 'Quantidade de posts no período. Constância mantém o perfil ativo e o público engajado.',
  viral: 'Publicação com desempenho muito acima da média. Mostra o tipo de conteúdo que a audiência mais gosta.',
  gasto: 'Total investido em anúncios no período.',
};

function MetricsSection({ metricas }: { metricas: MetricReading[] }) {
  return (
    <Section title="Leitura completa das métricas" subtitle="Cada número da sua campanha interpretado por um consultor sênior">
      <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
        {metricas?.map((m, i) => {
          const s = STATUS_STYLES[m.status] || STATUS_STYLES.warning;
          const Icon = getMetricIcon(m.name);
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className={cn('p-5 rounded-2xl border', s.bg, s.border)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn('p-2 rounded-lg', s.bg, 'border', s.border)}>
                    <Icon className={cn('w-4 h-4', s.text)} />
                  </div>
                  <div>
                    <p className="font-black text-foreground text-sm uppercase tracking-wide">{m.name}</p>
                    {m.benchmark && <p className="text-[10px] text-muted-foreground">{m.benchmark}</p>}
                  </div>
                </div>
                <span className={cn('text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded-full', s.bg, s.text)}>
                  {m.classification}
                </span>
              </div>
              {m.value && (
                <p className="text-2xl sm:text-3xl font-black tabular-nums text-foreground mb-2">{m.value}</p>
              )}
              {/* Barra de progresso até a meta */}
              <div className="mb-2">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">
                  <span>Quanto falta para a meta</span>
                  <span>{metricPerformance(m)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }} whileInView={{ width: `${metricPerformance(m)}%` }} viewport={{ once: true }}
                    transition={{ duration: 0.9, delay: i * 0.05 }}
                    className="h-full rounded-full"
                    style={{ background: perfColor(metricPerformance(m)) }}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{m.interpretation}</p>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}

function StrategicSection({ diag }: { diag: Diagnosis['diagnosticoEstrategico'] }) {
  return (
    <Section title="Diagnóstico estratégico" subtitle="Onde está o gargalo real da campanha">
      <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20 p-6 sm:p-8 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-primary" />
          <span className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Gargalo identificado</span>
          <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider">
            {diag.gargalo}
          </span>
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-foreground mb-3 leading-tight">{diag.problemaPrincipal}</h3>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{diag.detalhe}</p>
      </div>

      {(diag.pontosFortes?.length || diag.pontosFracos?.length) ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {diag.pontosFortes && diag.pontosFortes.length > 0 && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-black uppercase tracking-widest text-emerald-400">Pontos fortes</h4>
              </div>
              <ul className="space-y-2">
                {diag.pontosFortes.map((p, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground">
                    <span className="text-emerald-400">✓</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {diag.pontosFracos && diag.pontosFracos.length > 0 && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-5 h-5 text-red-400" />
                <h4 className="text-sm font-black uppercase tracking-widest text-red-400">Pontos fracos</h4>
              </div>
              <ul className="space-y-2">
                {diag.pontosFracos.map((p, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground">
                    <span className="text-red-400">✗</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </Section>
  );
}

function ProjectionSection({ projecao }: { projecao: NonNullable<Diagnosis['projecao']> }) {
  return (
    <Section title="Projeção de resultados" subtitle="O potencial real da sua campanha após os ajustes">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-card border border-border p-6">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Cenário atual</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{projecao.cenarioAtual}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border-2 border-primary/30 p-6 lg:scale-105">
          <div className="flex items-center gap-2 mb-3">
            <Rocket className="w-4 h-4 text-primary" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-primary">Cenário otimizado</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed font-medium">{projecao.cenarioOtimizado}</p>
        </div>
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">Potencial</span>
          </div>
          <p className="text-2xl font-black text-emerald-400 leading-tight">{projecao.potencial}</p>
        </div>
      </div>
    </Section>
  );
}

function ActionPlanSection({ acoes }: { acoes: Diagnosis['planoDeAcao'] }) {
  const PRIORITY_COLORS: Record<string, string> = {
    alta: 'bg-red-500 text-white',
    media: 'bg-amber-500 text-black',
    baixa: 'bg-zinc-500 text-white',
  };
  return (
    <Section title="Plano de ação" subtitle="Passo a passo para destravar a performance" highlight>
      <div className="space-y-3">
        {acoes?.map((acao: any, i: number) => {
          const a = typeof acao === 'string' ? { titulo: acao, descricao: '', prioridade: 'media' } : acao;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="flex gap-4 p-4 sm:p-5 rounded-2xl bg-card border border-border hover:border-primary/40 transition-colors"
            >
              <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary text-primary-foreground font-black text-base sm:text-lg flex items-center justify-center">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h4 className="text-base sm:text-lg font-black text-foreground leading-tight">{a.titulo}</h4>
                  {a.prioridade && (
                    <span className={cn('shrink-0 text-[9px] px-2 py-1 rounded-full uppercase font-black tracking-wider', PRIORITY_COLORS[a.prioridade] || PRIORITY_COLORS.media)}>
                      {a.prioridade}
                    </span>
                  )}
                </div>
                {a.descricao && <p className="text-sm text-muted-foreground leading-relaxed">{a.descricao}</p>}
              </div>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}

function AlertsSection({ alertas }: { alertas: Diagnosis['alertas'] }) {
  return (
    <Section title="Alertas importantes" subtitle="Pontos de atenção que precisam de ação imediata">
      <div className="space-y-2">
        {alertas.map((a, i) => {
          const s = STATUS_STYLES[a.tipo] || STATUS_STYLES.warning;
          const Icon = s.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className={cn('flex gap-3 items-start p-4 rounded-xl border', s.bg, s.border)}
            >
              <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', s.text)} />
              <p className="text-sm text-foreground">{a.mensagem}</p>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}

function CtaSection({ onWhatsApp }: { onWhatsApp: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
      className="rounded-3xl p-8 sm:p-12 text-center bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground relative overflow-hidden print:hidden"
    >
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />
      <div className="relative">
        <Lightbulb className="w-10 h-10 mx-auto mb-4" />
        <h3 className="text-2xl sm:text-4xl font-black uppercase tracking-tight mb-3 leading-tight">
          Quer transformar esse<br />diagnóstico em resultado?
        </h3>
        <p className="text-sm sm:text-base opacity-90 mb-6 max-w-xl mx-auto">
          A INOVA Co. cuida dos seus anúncios de ponta a ponta — criativo, estratégia, otimização e escala.
        </p>
        <Button
          onClick={onWhatsApp}
          size="lg"
          className="bg-black hover:bg-zinc-900 text-white font-black px-8 h-14 rounded-2xl uppercase tracking-wider hover:scale-105 transition-all shadow-2xl"
        >
          <MessageCircle className="w-5 h-5 mr-2" />
          Quero ajuda para melhorar meus anúncios
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </motion.div>
  );
}

function Section({
  title, subtitle, children, highlight,
}: { title: string; subtitle?: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }}
    >
      <div className="mb-6 sm:mb-8">
        <h2 className={cn(
          'text-2xl sm:text-4xl font-black uppercase tracking-tighter italic mb-2',
          highlight ? 'text-primary' : 'text-foreground'
        )}>
          {title}
        </h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </motion.section>
  );
}
