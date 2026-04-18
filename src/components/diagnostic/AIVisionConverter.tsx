import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Sparkles, Image as ImageIcon, Loader2, AlertCircle, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AIVisionConverterProps {
  onDataExtracted: (data: any) => void;
  onBack: () => void;
}

export const AIVisionConverter: React.FC<AIVisionConverterProps> = ({ onDataExtracted, onBack }) => {
  const [image, setImage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notes, setNotes] = useState("");
  const [videoCount, setVideoCount] = useState(3);

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

      // 2. Process with AI
      const base64Data = image.split(',')[1];
      
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      
      const systemPrompt = `Você é um Consultor de Marketing Estratégico Sênior. Sua tarefa é analisar um PRINT de tela (audit de rede social, bio ou análise manual) e transformar isso em um DIAGNÓSTICO ESTRATÉGICO PROFISSIONAL.
      
REGRAS DE OURO:
1. Se houver nomes de contas (como @arroba), utilize-os.
2. Identifique Pontos Positivos e Negativos de forma direta.
3. Se houver uma Bio no print, analise-a especificamente.
4. Gere um Plano de Ação prático de 4 semanas, com EXATAMENTE ${videoCount} sugestões de vídeos (Reels/Shorts) por semana.
5. Use linguagem de agência premium, focada em conversão e crescimento.
6. CONSIDERE ESTAS OBSERVAÇÕES DO USUÁRIO: ${notes || 'Nenhuma observação extra.'}
7. SEJA CONCISO E DIRETO. Evite parágrafos longos. Foco em impacto imediato.

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
    "semana1": ["Sugestão de vídeo 1 (Autoridade): [Título]", "... (retorne ${videoCount} itens)"],
    "semana2": ["Sugestão de vídeo 1 (Engajamento): [Título]", "... (retorne ${videoCount} itens)"],
    "semana3": ["Sugestão de vídeo 1 (Conversão): [Título]", "... (retorne ${videoCount} itens)"],
    "semana4": ["Sugestão de vídeo 1 (Escala/Retenção): [Título]", "... (retorne ${videoCount} itens)"]
  }
}

IMPORTANTE: Retorne APENAS o JSON puro. Não explique nada fora do JSON.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: systemPrompt },
              { inline_data: { mime_type: file.type, data: base64Data } }
            ]
          }],
          generation_config: {}
        })
      });

      if (!response.ok) {
        const errorDetail = await response.json().catch(() => ({}));
        console.error("Gemini API Error Detail:", errorDetail);
        const errorMessage = errorDetail.error?.message || `Status ${response.status}`;
        throw new Error(errorMessage);
      }

      const resData = await response.json();
      const text = resData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        console.error("Gemini Response Data:", resData);
        throw new Error("IA não retornou dados");
      }

      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(cleanText);
      // Add the public URL to the result
      result.imageUrl = publicUrl;
      
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
              <label className="text-[10px] font-black uppercase text-primary tracking-widest mb-2 block ml-1">Vídeos por Semana</label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <button 
                    key={num} 
                    onClick={() => setVideoCount(num)}
                    className={`h-11 rounded-xl font-black transition-all border ${videoCount === num ? 'bg-primary text-black border-primary' : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'}`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[10px] text-zinc-500 font-medium italic">* A IA gerará {videoCount} sugestões para cada uma das 4 semanas.</p>
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
