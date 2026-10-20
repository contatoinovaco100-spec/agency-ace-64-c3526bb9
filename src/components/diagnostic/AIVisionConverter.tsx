import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Sparkles, Image as ImageIcon, Loader2, AlertCircle, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AIVisionConverterProps {
  onDataExtracted: (data: any) => void;
  onBack: () => void;
}

/** 10 pontos que um perfil precisa ter para ser bom. Cada ponto perdido = -10% na nota geral. */
const PROFILE_POINTS: { id: number; cat: 'posicionamento' | 'presenca' | 'autoridade' | 'conversao'; titulo: string; criterio: string }[] = [
  { id: 1, cat: 'posicionamento', titulo: 'Nicho claro', criterio: 'Fica claro em segundos o que a marca faz e para quem.' },
  { id: 2, cat: 'posicionamento', titulo: 'Bio com proposta de valor', criterio: 'A bio diz qual resultado/benefício o cliente recebe.' },
  { id: 3, cat: 'posicionamento', titulo: 'Nome e @ fáceis de achar', criterio: 'Nome do perfil com palavra-chave do nicho/cidade.' },
  { id: 4, cat: 'presenca', titulo: 'Foto de perfil profissional', criterio: 'Logo ou foto nítida e reconhecível.' },
  { id: 5, cat: 'presenca', titulo: 'Identidade visual consistente', criterio: 'Feed com cores, fontes e estilo padronizados.' },
  { id: 6, cat: 'autoridade', titulo: 'Frequência de postagem', criterio: 'Posts recentes e constantes (3x por semana ou mais).' },
  { id: 7, cat: 'autoridade', titulo: 'Prova social', criterio: 'Depoimentos, resultados ou clientes visíveis (feed ou destaques).' },
  { id: 8, cat: 'autoridade', titulo: 'Destaques organizados', criterio: 'Destaques com capas e temas úteis (serviços, depoimentos, sobre).' },
  { id: 9, cat: 'conversao', titulo: 'Link / contato na bio', criterio: 'Link de WhatsApp, site ou agendamento funcionando.' },
  { id: 10, cat: 'conversao', titulo: 'Chamada para ação', criterio: 'Bio e posts pedem uma ação clara (chamar no direct, agendar, comprar).' },
];

export const AIVisionConverter: React.FC<AIVisionConverterProps> = ({ onDataExtracted, onBack }) => {
  const [image, setImage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notes, setNotes] = useState("");
  const [videoCount, setVideoCount] = useState(12);
  const [analysisTone, setAnalysisTone] = useState<'balanced' | 'critical'>('balanced');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error("Imagem muito grande (máximo 10MB)");
        return;
      }
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = () => setImage(reader.result as string);
      reader.readAsDataURL(selectedFile);
    }
  };

  const removeImage = () => {
    setImage(null);
    setFile(null);
  };

  const processImage = async () => {
    if (!image || !file) return;

    setIsProcessing(true);
    const toastId = toast.loading("IA analisando seu print...");

    try {      // 1. Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `diagnostics/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('task-attachments') // Using existing bucket for compatibility
        .upload(filePath, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        // Fallback: Continue without image URL if bucket is missing
      }

      const { data: { publicUrl } } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(filePath);

      // 2. Process with AI via secure edge function (key stays server-side)
      const base64Data = image.split(',')[1];

      const systemPrompt = `Você é um Consultor de Marketing Estratégico Sênior. Sua tarefa é analisar um PRINT de tela (audit de rede social, bio ou análise manual) e transformar isso em um DIAGNÓSTICO ESTRATÉGICO PROFISSIONAL.
      
REGRAS DE OURO:
1. Se houver nomes de contas (como @arroba), utilize-os.
2. Identifique Pontos Positivos e Negativos de forma direta.
3. Se houver uma Bio no print, analise-a especificamente.
4. Gere um Plano de Ação prático de 4 semanas, distribuindo um TOTAL de EXATAMENTE ${videoCount} sugestões de vídeos (Reels/Shorts) ao longo das 4 semanas (distribua de forma equilibrada).
5. Use linguagem de agência premium, focada em conversão e crescimento.
6. CONSIDERE ESTAS OBSERVAÇÕES DO USUÁRIO: ${notes || 'Nenhuma observação extra.'}
7. SEJA CONCISO E DIRETO. Evite parágrafos longos. Foco em impacto imediato.

TOM ESCOLHIDO: ${analysisTone === 'critical' ? `ANÁLISE NEGATIVA — MÁXIMO RIGOR PROFISSIONAL.
- Priorize todos os problemas reais e oportunidades de melhoria observáveis no perfil: bio, posicionamento, identidade visual, conteúdo, autoridade, destaques e conversão.
- Seja direto, exigente e específico. Não suavize problemas com elogios artificiais nem use uma nota mínima para tornar a análise positiva.
- Para cada problema, explique a evidência visível, o impacto potencial e a correção prática; diferencie fatos observados de hipóteses e do que não pode ser confirmado pelo print.
- Só marque um ponto do checklist como atendido quando houver evidência clara de que cumpre o critério por inteiro. Não invente defeitos, métricas, perda de vendas ou desempenho que o print não comprova.
- Liste positivos apenas quando forem reais. A conclusão deve priorizar as melhorias mais urgentes, sem afirmar que o perfil está pronto para escalar.
- Avalie o perfil e a estratégia, sem insultos à pessoa ou à marca. Preserve os 10 critérios existentes e o desconto de 10% por ponto perdido.` : 'ANÁLISE EQUILIBRADA: apresente qualidades reais e pontos de melhoria com evidências, sem inventar resultados.'}

O SEU RESULTADO DEVE SER UM JSON NO SEGUINTE FORMATO:
{
  "cliente": { "nome": "Nome identificado ou 'Cliente'" },
  "presencaDigital": {
    "positivos": ["item 1", "item 2"],
    "negativos": ["item 1", "item 2"]
  },
  "analiseBio": {
    "positivos": ["item 1", "item 2"],
    "negativos": ["item 1", "item 2"]
  },
  "diagnosticoFinal": "Um parágrafo estratégico e persuasivo.",
  "scores": {
    "posicionamento": 85,
    "presenca": 70,
    "autoridade": 60,
    "conversao": 40
  },
  "planoAcao": ["recomendação 1", "recomendação 2", "recomendação 3"],
  "cronograma": {
    "semana1": ["Sugestão de vídeo 1 (Autoridade): [Título]", "... (itens desta semana)"],
    "semana2": ["Sugestão de vídeo 1 (Engajamento): [Título]", "... (itens desta semana)"],
    "semana3": ["Sugestão de vídeo 1 (Conversão): [Título]", "... (itens desta semana)"],
    "semana4": ["Sugestão de vídeo 1 (Escala/Retenção): [Título]", "... (itens desta semana)"]
  }
}

CHECKLIST OBRIGATÓRIO DOS 10 PONTOS: avalie com rigor cada ponto abaixo e inclua no JSON a chave "checklist": [{"id": 1, "ok": true|false, "motivo": "frase curta com o que você viu"}] com os 10 itens. Marque false se não atende ou se não há evidência no print. NÃO invente notas em "scores" — o sistema calcula a partir do checklist.
${PROFILE_POINTS.map(p => `${p.id}. ${p.titulo}: ${p.criterio}`).join('\n')}

IMPORTANTE: Retorne APENAS o JSON puro. Não explique nada fora do JSON.`;

      const { data: fnData, error: fnError } = await supabase.functions.invoke('ai-copywriter', {
        body: {
          systemPrompt,
          userMessage: 'Analise o print enviado e gere o diagnóstico no formato JSON especificado.',
          model: 'google/gemini-2.5-flash',
          imageBase64: base64Data,
          imageMimeType: file.type,
        },
      });

      if (fnError) throw new Error(fnError.message || 'Erro ao chamar IA');
      if (fnData?.error) throw new Error(fnData.error);

      let result: any = fnData?.result;
      if (typeof result === 'string') {
        const cleanText = result.replace(/```json/g, '').replace(/```/g, '').trim();
        result = JSON.parse(cleanText);
      }
      if (!result) throw new Error('IA não retornou dados');
      // Nota baseada nos 10 pontos: cada ponto perdido tira 10% da média geral
      if (Array.isArray(result.checklist) && result.checklist.length > 0) {
        const lost = PROFILE_POINTS.filter(p => !result.checklist.find((c: any) => Number(c.id) === p.id && c.ok));
        const cats = ['posicionamento', 'presenca', 'autoridade', 'conversao'] as const;
        result.scores = Object.fromEntries(cats.map(c => [c, Math.max(0, 100 - 40 * lost.filter(p => p.cat === c).length)]));
        result.checklist = PROFILE_POINTS.map(p => {
          const c = result.checklist.find((x: any) => Number(x.id) === p.id);
          return { id: p.id, titulo: p.titulo, ok: !!c?.ok, motivo: c?.motivo || p.criterio };
        });
        const melhorias = lost.map(p => {
          const c = result.checklist.find((x: any) => x.id === p.id);
          return `Ponto de melhoria (-10%): ${p.titulo} — ${c?.motivo || p.criterio}`;
        });
        result.presencaDigital = result.presencaDigital || { positivos: [], negativos: [] };
        result.presencaDigital.negativos = [...melhorias, ...(result.presencaDigital.negativos || [])];
        result.notaGeral = 100 - lost.length * 10;
      }
      // Add the public URL to the result
      result.imageUrl = publicUrl;
      result.analysisTone = analysisTone;
      
      onDataExtracted(result);
      toast.success("Diagnóstico gerado com sucesso!", { id: toastId });
    } catch (error: any) {
      console.error("AI Vision Error:", error);
      toast.error(`Erro: ${error.message || "Tente uma imagem mais nítida."}`, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <div className="mb-8">
          <div className="inline-flex p-3 bg-primary/10 rounded-2xl mb-4">
            <Sparkles className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter italic">Upload do Print de Análise</h2>
          <p className="text-muted-foreground">Envie um print da análise manual para que a IA transforme em um diagnóstico profissional.</p>
        </div>

        <div className="relative group">
          {!image ? (
            <label className="flex flex-col items-center justify-center w-full h-80 border-2 border-dashed border-white/10 rounded-3xl bg-white/5 hover:bg-white/[0.08] hover:border-primary/50 transition-all cursor-pointer group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <div className="p-4 bg-black/40 rounded-full mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="w-10 h-10 text-primary" />
                </div>
                <p className="mb-2 text-sm text-zinc-400 font-bold uppercase tracking-widest">
                  Arraste ou clique para enviar
                </p>
                <p className="text-xs text-zinc-500">PNG, JPG (Máx 10MB)</p>
              </div>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            </label>
          ) : (
            <AnimatePresence>
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative h-80 w-full rounded-3xl overflow-hidden border border-white/20 shadow-2xl"
              >
                <img src={image} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <Button variant="destructive" size="icon" onClick={removeImage} className="rounded-full shadow-lg">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
           <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-foreground">Tipo de análise</label>
              <ToggleGroup
                type="single"
                variant="outline"
                value={analysisTone}
                onValueChange={value => {
                  if (value === 'balanced' || value === 'critical') setAnalysisTone(value);
                }}
                disabled={isProcessing}
                aria-label="Tipo de análise do perfil"
                className="justify-start flex-wrap"
              >
                <ToggleGroupItem value="balanced" aria-label="Análise equilibrada">Equilibrada</ToggleGroupItem>
                <ToggleGroupItem value="critical" aria-label="Análise negativa — máximo rigor">
                  <AlertCircle className="mr-2 h-4 w-4" /> Negativa · Máximo rigor
                </ToggleGroupItem>
              </ToggleGroup>
           </div>
           <div>
              <label className="text-[10px] font-black uppercase text-primary tracking-widest mb-2 block ml-1">Observações Adicionais</label>
              <textarea 
                value={notes} 
                onChange={e => setNotes(e.target.value)}
                placeholder="Ex: Focar em branding..."
                className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-primary/50 transition-all resize-none"
              />
           </div>
           <div>
              <label className="text-[10px] font-black uppercase text-primary tracking-widest mb-2 block ml-1">Total de Vídeos (Mês)</label>
              <div className="grid grid-cols-3 gap-2">
                {[4, 6, 8, 12, 16, 20].map(num => (
                  <button 
                    key={num} 
                    onClick={() => setVideoCount(num)}
                    className={`h-11 rounded-xl font-black transition-all border ${videoCount === num ? 'bg-primary text-black border-primary' : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'}`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[10px] text-zinc-500 font-medium italic">* A IA distribuirá os {videoCount} vídeos ao longo das 4 semanas.</p>
           </div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="text-zinc-500 hover:text-white font-bold uppercase tracking-widest text-[10px]"
          >
            Voltar
          </Button>
          
          <Button 
            onClick={processImage}
            disabled={!image || isProcessing}
            className="bg-primary text-black font-black px-12 h-14 rounded-2xl hover:scale-105 transition-all shadow-[0_0_20px_rgba(var(--primary),0.3)] disabled:opacity-50 disabled:scale-100"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                PROCESSANDO...
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5 mr-3" />
                TRANSFORMAR EM DIAGNÓSTICO
              </>
            )}
          </Button>
        </div>

        {/* Tips */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
          <div className="flex gap-3 items-start p-4 bg-white/5 rounded-2xl border border-white/5">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
               <ImageIcon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">Dica de Imagem</p>
              <p className="text-xs text-zinc-500 leading-relaxed">Prints nítidos do perfil do Instagram ou notas escritas funcionam melhor.</p>
            </div>
          </div>
          <div className="flex gap-3 items-start p-4 bg-white/5 rounded-2xl border border-white/5">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
               <AlertCircle className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">IA Inteligente</p>
              <p className="text-xs text-zinc-500 leading-relaxed">A IA não apenas lê, mas interpreta as falhas e sugere o cronograma completo.</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
