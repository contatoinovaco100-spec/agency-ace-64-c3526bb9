import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, X, Loader2, BarChart3, Wand2, AlertTriangle,
  CheckCircle2, AlertCircle, TrendingUp, Target, Zap, MessageCircle, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type Status = 'good' | 'warning' | 'bad';

interface MetricReading {
  name: string;
  value?: string;
  classification: 'Alta' | 'Média' | 'Baixa' | 'Boa' | 'Regular' | 'Ruim' | string;
  status: Status;
  interpretation: string;
}

interface Diagnosis {
  resumo: {
    classificacao: Status; // 🟢 / 🟡 / 🔴
    titulo: string;        // ex: "Boa", "Regular", "Ruim"
    explicacao: string;
  };
  metricas: MetricReading[];
  diagnosticoEstrategico: {
    problemaPrincipal: string;
    gargalo: 'Criativo' | 'Público' | 'Oferta' | 'Estrutura' | string;
    detalhe: string;
  };
  planoDeAcao: string[];
  alertas: { tipo: Status; mensagem: string }[];
}

const WHATSAPP_NUMBER = '5588994463203'; // INOVA Co.

const STATUS_STYLES: Record<Status, { bg: string; text: string; border: string; icon: any; label: string }> = {
  good:    { bg: 'bg-emerald-500/10',  text: 'text-emerald-400',  border: 'border-emerald-500/30',  icon: CheckCircle2,   label: 'Boa' },
  warning: { bg: 'bg-amber-500/10',    text: 'text-amber-400',    border: 'border-amber-500/30',    icon: AlertCircle,    label: 'Atenção' },
  bad:     { bg: 'bg-red-500/10',      text: 'text-red-400',      border: 'border-red-500/30',      icon: AlertTriangle,  label: 'Problema' },
};

export default function AdsAuditPage() {
  const [file, setFile] = useState<File | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > 10 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx 10MB)');
      return;
    }
    setFile(selected);
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(selected);
  };

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    if (!/^image\/(png|jpe?g)$/.test(dropped.type)) {
      toast.error('Use PNG, JPG ou JPEG');
      return;
    }
    setFile(dropped);
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(dropped);
  };

  const reset = () => {
    setFile(null);
    setImage(null);
    setDiagnosis(null);
  };

  const analyze = async () => {
    if (!file || !image) return;
    setIsProcessing(true);
    setDiagnosis(null);
    const toastId = toast.loading('Analisando dados e gerando diagnóstico estratégico…');

    try {
      const base64Data = image.split(',')[1];

      const systemPrompt = `Você é um Consultor Sênior de Tráfego Pago (Meta Ads, Google Ads, TikTok Ads).
Vai receber um PRINT de gerenciador de anúncios. Aplique OCR mental, identifique métricas (CTR, CPC, CPM, ROAS, frequência, conversões, gasto, alcance) e gere um diagnóstico ACIONÁVEL.

REGRAS:
1. Seja DIRETO. Sem jargão técnico desnecessário. Frases curtas.
2. Classifique a campanha como 🟢 boa, 🟡 regular ou 🔴 ruim, com base nos parâmetros do mercado brasileiro.
3. Para cada métrica visível, dê: classificação (Alta/Média/Baixa) + 1 frase explicando o que significa NA PRÁTICA.
4. Identifique o GARGALO REAL: Criativo, Público, Oferta ou Estrutura.
5. Plano de ação: 4 a 6 ações IMEDIATAS, no imperativo (ex: "Crie 3 novos criativos com ganchos diferentes").
6. Liste alertas só quando houver problema real (CTR baixo, CPC alto, frequência > 3, etc.).
7. NUNCA dê resposta genérica. Se a métrica está boa, fale isso.
8. Status válidos para metricas/alertas/resumo: "good" (verde), "warning" (amarelo), "bad" (vermelho).

Retorne APENAS JSON válido neste formato:
{
  "resumo": {
    "classificacao": "good" | "warning" | "bad",
    "titulo": "Boa" | "Regular" | "Ruim",
    "explicacao": "1-2 frases diretas"
  },
  "metricas": [
    { "name": "CTR", "value": "1.2%", "classification": "Baixa", "status": "bad", "interpretation": "..." }
  ],
  "diagnosticoEstrategico": {
    "problemaPrincipal": "...",
    "gargalo": "Criativo" | "Público" | "Oferta" | "Estrutura",
    "detalhe": "..."
  },
  "planoDeAcao": ["...", "...", "..."],
  "alertas": [
    { "tipo": "warning", "mensagem": "Frequência alta (3.4) — possível saturação" }
  ]
}

IMPORTANTE: Retorne SOMENTE o JSON, sem markdown.`;

      const { data: fnData, error: fnError } = await supabase.functions.invoke('ai-copywriter', {
        body: {
          systemPrompt,
          userMessage: 'Analise o print do gerenciador de anúncios e gere o diagnóstico no formato JSON pedido.',
          model: 'google/gemini-2.5-flash',
          imageBase64: base64Data,
          imageMimeType: file.type,
        },
      });

      if (fnError) throw new Error(fnError.message || 'Erro ao chamar IA');
      if (fnData?.error) throw new Error(fnData.error);

      let result: any = fnData?.result;
      if (typeof result === 'string') {
        const cleaned = result.replace(/```json/g, '').replace(/```/g, '').trim();
        result = JSON.parse(cleaned);
      }
      if (!result?.resumo) throw new Error('IA não retornou um diagnóstico válido');

      setDiagnosis(result as Diagnosis);
      toast.success('Diagnóstico pronto!', { id: toastId });
    } catch (err: any) {
      console.error('Ads audit error:', err);
      toast.error(err.message || 'Erro ao analisar. Tente uma imagem mais nítida.', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const openWhatsApp = () => {
    const msg = encodeURIComponent(
      'Olá INOVA! Acabei de fazer um diagnóstico dos meus anúncios na plataforma e quero ajuda para melhorar os resultados.'
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-10">
      <div className="max-w-5xl mx-auto">
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 sm:mb-12 text-center"
        >
          <div className="inline-flex p-3 bg-primary/10 rounded-2xl mb-4">
            <BarChart3 className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tighter italic text-foreground mb-3">
            Diagnóstico de Anúncios
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Envie um print das métricas dos seus anúncios e receba uma análise estratégica completa em segundos.
          </p>
        </motion.div>

        {/* UPLOAD + ANALYZE */}
        {!diagnosis && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card/50 border border-border rounded-3xl p-6 sm:p-8 backdrop-blur-sm"
          >
            {!image ? (
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
                  Envie um print do seu gerenciador de anúncios contendo métricas como CTR, CPC, CPM, ROAS, frequência e conversões.
                </p>
                <p className="mt-3 text-[10px] text-muted-foreground/70">PNG, JPG, JPEG (máx 10MB)</p>
                <input type="file" className="hidden" accept="image/png,image/jpeg" onChange={handleFileChange} />
              </label>
            ) : (
              <div className="relative h-72 sm:h-80 w-full rounded-2xl overflow-hidden border border-border shadow-lg">
                <img src={image} alt="Print das métricas" className="w-full h-full object-contain bg-black/40" />
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={reset}
                  className="absolute top-3 right-3 rounded-full h-9 w-9 shadow-lg"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            <div className="mt-6 flex justify-center">
              <Button
                onClick={analyze}
                disabled={!image || isProcessing}
                className="bg-primary text-primary-foreground font-black px-10 h-14 rounded-2xl hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 uppercase tracking-wider"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                    Analisando dados e gerando diagnóstico estratégico…
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5 mr-3" />
                    Analisar métricas
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {/* RESULT */}
        <AnimatePresence>
          {diagnosis && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* 1. RESUMO EXECUTIVO */}
              <ResumoCard resumo={diagnosis.resumo} />

              {/* 2. LEITURA DAS MÉTRICAS */}
              <SectionCard title="Leitura das métricas" icon={BarChart3}>
                <div className="grid sm:grid-cols-2 gap-3">
                  {diagnosis.metricas?.map((m, i) => (
                    <MetricCard key={i} metric={m} />
                  ))}
                </div>
              </SectionCard>

              {/* 3. DIAGNÓSTICO ESTRATÉGICO */}
              <SectionCard title="Diagnóstico estratégico" icon={Target}>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Gargalo:</span>
                    <span className="px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-black uppercase tracking-wider">
                      {diagnosis.diagnosticoEstrategico.gargalo}
                    </span>
                  </div>
                  <p className="text-foreground font-semibold">{diagnosis.diagnosticoEstrategico.problemaPrincipal}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{diagnosis.diagnosticoEstrategico.detalhe}</p>
                </div>
              </SectionCard>

              {/* 4. PLANO DE AÇÃO */}
              <SectionCard title="Plano de ação" icon={Zap} highlight>
                <ul className="space-y-3">
                  {diagnosis.planoDeAcao?.map((acao, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground font-black text-sm flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-sm sm:text-base text-foreground leading-relaxed pt-0.5">{acao}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>

              {/* 5. ALERTAS */}
              {diagnosis.alertas?.length > 0 && (
                <SectionCard title="Alertas importantes" icon={AlertTriangle}>
                  <div className="space-y-2">
                    {diagnosis.alertas.map((a, i) => {
                      const s = STATUS_STYLES[a.tipo] || STATUS_STYLES.warning;
                      const Icon = s.icon;
                      return (
                        <div key={i} className={cn('flex gap-3 items-start p-3 rounded-xl border', s.bg, s.border)}>
                          <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', s.text)} />
                          <p className="text-sm text-foreground">{a.mensagem}</p>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              )}

              {/* CTA WHATSAPP */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="rounded-3xl p-6 sm:p-8 text-center bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30"
              >
                <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-foreground mb-2">
                  Quer transformar esse diagnóstico em resultado?
                </h3>
                <p className="text-sm text-muted-foreground mb-5 max-w-lg mx-auto">
                  A INOVA Co. cuida dos seus anúncios de ponta a ponta — criativo, estratégia, otimização e escala.
                </p>
                <Button
                  onClick={openWhatsApp}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-black px-8 h-13 rounded-2xl uppercase tracking-wider hover:scale-105 transition-all"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Quero ajuda para melhorar meus anúncios
                </Button>
              </motion.div>

              {/* RESET */}
              <div className="flex justify-center pt-2">
                <Button variant="ghost" onClick={reset} className="text-muted-foreground hover:text-foreground uppercase tracking-widest text-xs font-bold">
                  Analisar outro print
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-[10px] text-muted-foreground/60 text-center mt-10 italic">
          🔒 Sua imagem é processada apenas para a análise e não é armazenada permanentemente.
        </p>
      </div>
    </div>
  );
}

/* -------- subcomponents -------- */

function ResumoCard({ resumo }: { resumo: Diagnosis['resumo'] }) {
  const s = STATUS_STYLES[resumo.classificacao] || STATUS_STYLES.warning;
  const Icon = s.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-3xl p-6 sm:p-8 border-2 backdrop-blur-sm', s.bg, s.border)}
    >
      <div className="flex items-start gap-4">
        <div className={cn('p-3 rounded-2xl shrink-0', s.bg)}>
          <Icon className={cn('w-7 h-7', s.text)} />
        </div>
        <div className="flex-1">
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1">Resumo executivo</p>
          <h2 className={cn('text-2xl sm:text-3xl font-black uppercase tracking-tight mb-2', s.text)}>
            Campanha {resumo.titulo}
          </h2>
          <p className="text-sm sm:text-base text-foreground leading-relaxed">{resumo.explicacao}</p>
        </div>
      </div>
    </motion.div>
  );
}

function SectionCard({
  title, icon: Icon, children, highlight,
}: { title: string; icon: any; children: React.ReactNode; highlight?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-3xl p-5 sm:p-6 border backdrop-blur-sm',
        highlight ? 'bg-primary/5 border-primary/30' : 'bg-card/50 border-border',
      )}
    >
      <div className="flex items-center gap-2 mb-4">
        <Icon className={cn('w-5 h-5', highlight ? 'text-primary' : 'text-muted-foreground')} />
        <h3 className="text-sm font-black uppercase tracking-widest text-foreground">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

function MetricCard({ metric }: { metric: MetricReading }) {
  const s = STATUS_STYLES[metric.status] || STATUS_STYLES.warning;
  return (
    <div className={cn('p-4 rounded-2xl border', s.bg, s.border)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className={cn('w-4 h-4', s.text)} />
          <p className="font-black text-foreground text-sm uppercase tracking-wide">{metric.name}</p>
        </div>
        {metric.value && (
          <span className="text-xs font-mono font-bold text-foreground/80">{metric.value}</span>
        )}
      </div>
      <p className={cn('text-[10px] uppercase font-bold tracking-widest mb-2', s.text)}>{metric.classification}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{metric.interpretation}</p>
    </div>
  );
}
