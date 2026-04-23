import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, X, FileDown, Edit3, Sparkles, Wand2, Calendar, FileText, Loader2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAgency } from '@/contexts/AgencyContext';
import { toast } from 'sonner';

// Formata texto com quebras de linha e destaca [INSTRUÇÕES] de gravação
function FormattedText({ text, className }: { text: string; className?: string }) {
  if (!text || text === '-') return <span className={className}>-</span>;
  
  const lines = text.split('\n').filter(l => l.trim() !== '');
  
  return (
    <div className={className}>
      {lines.map((line, i) => {
        // Detecta e estiliza [INSTRUÇÕES DE GRAVAÇÃO]
        const parts = line.split(/(\[.*?\])/);
        return (
          <p key={i} className={`mb-2 last:mb-0 ${line.match(/^\d+\./) ? 'mt-3 first:mt-0' : ''}`}>
            {parts.map((part, j) => {
              if (part.match(/^\[.*\]$/)) {
                return (
                  <span key={j} className="inline-block bg-primary/20 text-primary border border-primary/30 rounded px-2 py-0.5 text-xs font-black tracking-wider my-1">
                    {part}
                  </span>
                );
              }
              return <span key={j}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

interface ContentItem {
  id: string;
  title: string;
  pillar: string;
  date: string;
  hook: string;
  development: string;
  cta: string;
  isGeneratingAi?: boolean;
}

export function UnifiedContentGenerator({ clientId }: { clientId: string }) {
  const { clients } = useAgency();
  const clientName = clients.find(c => c.id === clientId)?.companyName || 'Cliente';

  const [previewMode, setPreviewMode] = useState(false);
  
  // Identidade Estratégica
  const [niche, setNiche] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('');
  const [objective, setObjective] = useState('');
  const [pillars, setPillars] = useState<string[]>([]);
  const [newPillar, setNewPillar] = useState('');

  // Itens de Conteúdo (Ideias + Roteiros + Calendário)
  const [items, setItems] = useState<ContentItem[]>([]);

  // IA Configuration
  const [promptData, setPromptData] = useState<{ [key: string]: string }>({});

  const addPillar = () => {
    if (!newPillar.trim() || pillars.includes(newPillar.trim())) return;
    setPillars([...pillars, newPillar.trim()]);
    setNewPillar('');
  };

  const removePillar = (p: string) => {
    setPillars(pillars.filter(item => item !== p));
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        title: '',
        pillar: '',
        date: '',
        hook: '',
        development: '',
        cta: '',
      }
    ]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const updateItem = (id: string, field: keyof ContentItem, value: any) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleGenerateAI = async (itemId: string) => {
    const prompt = promptData[itemId];
    if (!prompt?.trim()) {
      toast.error('Descreva a ideia principal para a IA.');
      return;
    }

    updateItem(itemId, 'isGeneratingAi', true);

    try {
      const systemPrompt = `Você é um roteirista viral com mais de 10 anos de experiência criando conteúdo que gera milhões de views em Reels, TikTok e Shorts. Você domina técnicas avançadas de copywriting como Open Loops, Pattern Interrupt, Storytelling Micro-Narrativo e Gatilhos Mentais.

PERFIL DO CLIENTE:
- Nicho: ${niche || 'Geral'}
- Público-alvo: ${audience || 'Público geral'}
- Tom de voz: ${tone || 'Autêntico e magnético'}
- Objetivo: ${objective || 'Viralizar e converter'}
- Pilares: ${pillars.join(', ') || 'Livre'}

REGRAS DE OURO PARA O ROTEIRO:

🎯 HOOK (Gancho — 3 primeiros segundos):
- Use UMA dessas técnicas: Pergunta provocativa | Afirmação polêmica | Dado chocante | Promessa irresistível | Negação forte ("Pare de fazer isso AGORA")
- O gancho deve criar um "Open Loop" — algo que a pessoa PRECISA saber e só vai descobrir se continuar assistindo
- Inclua a direção de cena entre colchetes: [OLHE PRA CÂMERA], [COMECE ANDANDO], [MOSTRE O PRODUTO]
- Exemplo bom: "[OLHE FIXO PRA CÂMERA COM CARA SÉRIA] 'Eu perdi R$47 mil antes de aprender isso...'"
- Exemplo ruim: "Oi gente, hoje eu vou falar sobre..."

📖 DEVELOPMENT (Desenvolvimento — Corpo do vídeo):
- Conte uma MICRO-HISTÓRIA real e envolvente, não liste dicas genéricas
- Use o formato: PROBLEMA → VIRADA → REVELAÇÃO
- Escreva como se estivesse contando pra um amigo, não lendo um teleprompter
- Frases CURTAS. Máximo 12 palavras por frase
- Numere os blocos de fala (1. 2. 3.)
- Coloque instruções visuais entre colchetes: [CORTE SECO], [ZOOM NO ROSTO], [B-ROLL], [TEXTO NA TELA: "dado importante"]
- Alterne entre falas diretas e instruções de câmera
- Máximo 4 blocos de fala

🔥 CTA (Chamada para ação):
- Seja ESPECÍFICO. Não diga "me siga". Diga algo como: "Se isso abriu sua mente, toca no SEGUIR porque amanhã eu vou contar a parte 2 dessa história"
- Crie urgência ou curiosidade para o próximo conteúdo
- Inclua direção: [APONTE PARA BAIXO], [GESTO DE "SEGUIR"]

FORMATO DE RESPOSTA:
Retorne SOMENTE um JSON válido:
{"hook": "texto do gancho com [DIREÇÕES]", "development": "1. Primeira fala...\\n\\n[INSTRUÇÃO]\\n\\n2. Segunda fala...\\n\\n[INSTRUÇÃO]\\n\\n3. Terceira fala...", "cta": "texto do cta com [DIREÇÃO]"}

IMPORTANTE: Cada roteiro deve ser ÚNICO, INESPERADO e fazer a pessoa pensar "caramba, isso é genial". Nunca seja óbvio ou previsível.`;

      const { data: fnData, error: fnError } = await supabase.functions.invoke('ai-copywriter', {
        body: {
          systemPrompt,
          userMessage: prompt,
          model: 'google/gemini-2.5-flash',
        },
      });

      if (fnError) throw new Error(fnError.message || 'Erro ao chamar IA');
      if (fnData?.error) throw new Error(fnData.error);

      let result: any = fnData?.result;
      if (typeof result === 'string') {
        const cleanContent = result.replace(/```json/g, '').replace(/```/g, '').trim();
        result = JSON.parse(cleanContent);
      }

      if (!result) throw new Error("A resposta da IA veio vazia.");
      setItems(prev => prev.map(i => {
        if (i.id === itemId) {
          return {
            ...i,
            title: i.title || prompt.substring(0, 30) + '...',
            hook: result.hook || i.hook,
            development: result.development || i.development,
            cta: result.cta || i.cta
          };
        }
        return i;
      }));
      toast.success('✨ Roteiro gerado pelo Gemini!');
      setPromptData(prev => ({ ...prev, [itemId]: '' })); // clear prompt box
    } catch (err: any) {
      console.error('AI Error:', err);
      toast.error(`Falha: ${err.message}`);
    } finally {
      updateItem(itemId, 'isGeneratingAi', false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // ================= VIEW DE IMPRESSÃO (PDF) =================
  if (previewMode) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex justify-end gap-2 print:hidden">
          <Button variant="outline" onClick={() => setPreviewMode(false)} className="border-white/10">
            <Edit3 className="w-4 h-4 mr-2" />
            Editar Estratégia
          </Button>
          <Button onClick={handlePrint} className="bg-primary text-black font-bold">
            <FileDown className="w-4 h-4 mr-2" />
            Salvar PDF
          </Button>
        </div>

        {/* CONTAINER PRINCIPAL DO PDF COM ESTILO DARK PREMIUM E FORÇAMENTO DE CORES */}
        <div 
          className="bg-[#050505] text-zinc-100 p-8 sm:p-12 rounded-xl border border-white/10 shadow-2xl max-w-5xl mx-auto print:shadow-none print:w-full print:m-0 print:border-none print:p-0"
          style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
        >
          
          {/* Header */}
          <div className="border-b-4 border-primary/50 pb-8 mb-10 text-center">
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight drop-shadow-sm">Masterplan de Conteúdo</h1>
            <p className="text-xl text-primary mt-3 font-semibold uppercase tracking-widest">{clientName}</p>
          </div>

          {/* Section 1: Marca */}
          <div className="mb-14">
            <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-2">
              <Sparkles className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold text-white">1. Identidade e Estratégia</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 bg-[#0f0f0f] border border-white/5 shadow-inner p-8 rounded-2xl">
              
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-2">Nicho de Mercado</h3>
                <p className="text-lg text-zinc-300 font-medium">✨ {niche || 'N/A'}</p>
              </div>

              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-2">Objetivo Principal</h3>
                <p className="text-lg text-zinc-300 font-medium">🎯 {objective || 'N/A'}</p>
              </div>

              <div className="md:col-span-2">
                <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-2">Público-alvo (Avatar)</h3>
                <p className="text-lg text-zinc-400 leading-relaxed border-l-4 border-primary/40 bg-primary/5 pl-4 py-3 rounded-r-lg italic shadow-sm">
                  "{audience || 'N/A'}"
                </p>
              </div>

              <div className="md:col-span-2">
                <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-2">Voz e Tom da Marca</h3>
                <p className="text-lg text-zinc-400 leading-relaxed border-l-4 border-primary/40 bg-primary/5 pl-4 py-3 rounded-r-lg italic shadow-sm">
                  "{tone || 'N/A'}"
                </p>
              </div>

              <div className="md:col-span-2 pt-4 border-t border-white/5">
                <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-4">Pilares de Comunicação</h3>
                <div className="flex flex-wrap gap-2">
                  {pillars.length === 0 ? <span className="text-zinc-600 font-medium">Nenhum definido</span> : pillars.map((p, i) => (
                    <span key={i} className="px-5 py-2 bg-primary/10 text-primary rounded-full text-sm font-bold border border-primary/20 shadow-[0_0_10px_rgba(var(--primary),0.1)]">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Calendário e Roteiros */}
          <div>
            <div className="flex items-center gap-2 mb-8 border-b border-white/10 pb-2">
              <Calendar className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold text-white">2. Cronograma de Gravação</h2>
            </div>

            {items.length === 0 ? (
              <p className="text-center text-zinc-500 py-10 font-medium">Nenhum conteúdo planejado para esta leva.</p>
            ) : (
              <div className="space-y-12">
                {items.map((item, index) => (
                  <div key={item.id} className="border border-white/5 bg-[#0f0f0f] rounded-3xl overflow-hidden shadow-lg shadow-black/50 break-inside-avoid">
                    {/* Header do Post */}
                    <div className="bg-[#1a1a1a] px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-primary/20">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary text-black w-10 h-10 rounded-full flex items-center justify-center font-black text-lg shadow-[0_0_10px_rgba(var(--primary),0.3)]">
                          {index + 1}
                        </div>
                        <h3 className="text-xl font-bold text-white">{item.title || 'Mídia sem título'}</h3>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm font-semibold">
                        {item.pillar && <span className="bg-primary/20 text-primary border border-primary/30 px-3 py-1.5 rounded-lg shadow-sm">{item.pillar}</span>}
                        {item.date && <span className="bg-white/10 text-zinc-300 px-3 py-1.5 rounded-lg border border-white/5">📅 {new Date(item.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</span>}
                      </div>
                    </div>

                    {/* Corpo do Roteiro */}
                    <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr] gap-6">
                      
                      <div className="bg-[#141b14] p-5 rounded-2xl border border-green-500/20 shadow-inner">
                        <div className="flex items-center gap-2 mb-3 border-b border-green-500/20 pb-2">
                           <div className="w-2 h-2 rounded-full bg-green-500"></div>
                           <p className="text-xs font-black uppercase text-green-400 tracking-widest">Atenção (3s)</p>
                        </div>
                        <FormattedText text={item.hook || '-'} className="text-zinc-300 font-medium leading-relaxed" />
                      </div>

                      <div className="bg-[#141414] p-5 rounded-2xl border border-white/10 shadow-inner">
                        <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2">
                           <div className="w-2 h-2 rounded-full bg-zinc-500"></div>
                           <p className="text-xs font-black uppercase text-zinc-400 tracking-widest">Desenvolvimento</p>
                        </div>
                        <FormattedText text={item.development || '-'} className="text-zinc-300 leading-relaxed" />
                      </div>

                      <div className="bg-[#1a130f] p-5 rounded-2xl border border-orange-500/20 shadow-inner">
                        <div className="flex items-center gap-2 mb-3 border-b border-orange-500/20 pb-2">
                           <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                           <p className="text-xs font-black uppercase text-orange-400 tracking-widest">Chamada (CTA)</p>
                        </div>
                        <FormattedText text={item.cta || '-'} className="text-zinc-300 font-medium leading-relaxed" />
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Footer PDF */}
          <div className="mt-20 pt-8 border-t border-white/10 flex justify-between items-center text-xs text-zinc-600 font-bold tracking-widest uppercase print:mt-32">
            <span>Doc: {clientName}</span>
            <span className="text-primary/50">Gerado pelo Sistema Estratégico da Agência</span>
            <span>{new Date().toLocaleDateString('pt-BR')}</span>
          </div>

        </div>
      </div>
    );
  }

  // ================= VIEW DE EDIÇÃO (SISTEMA) =================
  return (
    <div className="space-y-8 pb-32 animate-in fade-in">
      
      {/* Bloco 1: Estratégia */}
      <Card className="border-primary/20 bg-primary/5 backdrop-blur-sm shadow-xl shadow-black/40">
        <CardHeader className="pb-4 border-b border-primary/10 mb-6">
          <CardTitle className="text-2xl text-primary flex items-center gap-2">
            <Sparkles className="w-5 h-5" /> 1. Linha Editorial e Estratégia
          </CardTitle>
          <CardDescription className="text-base text-zinc-400">
            A fundação inteligente que vai guiar a inteligência artificial e a equipe na criação desse documento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Nicho de Mercado</Label>
              <Input placeholder="Ex: Clínica Odontológica" value={niche} onChange={e => setNiche(e.target.value)} className="bg-black/60 border-white/10" />
            </div>
            <div className="space-y-2">
              <Label>Objetivo Maior da Conta</Label>
              <Input placeholder="Ex: Captação de leads qualificados" value={objective} onChange={e => setObjective(e.target.value)} className="bg-black/60 border-white/10" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Público-alvo / Avatar</Label>
              <Textarea placeholder="Para quem estamos escrevendo?" value={audience} onChange={e => setAudience(e.target.value)} className="bg-black/60 border-white/10 min-h-[80px]" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Voz e Tom</Label>
              <Textarea placeholder="Como transmitimos a mensagem? Ex: Científico, acolhedor..." value={tone} onChange={e => setTone(e.target.value)} className="bg-black/60 border-white/10 min-h-[80px]" />
            </div>
            <div className="space-y-2 md:col-span-2 bg-black/40 p-4 rounded-xl border border-white/5">
              <Label className="text-primary mb-3 block">Pilares Centrais (Para uso nos roteiros)</Label>
              <div className="flex gap-2 mb-4">
                <Input placeholder="Qual quadro ou linha quer fixar?" value={newPillar} onChange={e => setNewPillar(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPillar()} className="bg-black/60 border-white/10 max-w-xs" />
                <Button type="button" variant="secondary" onClick={addPillar}>Adicionar</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {pillars.map(p => (
                  <Badge key={p} variant="outline" className="py-1 px-3 bg-primary/10 text-primary border-primary/20">
                    {p}
                    <button onClick={() => removePillar(p)} className="ml-2 hover:text-white"><X className="w-3 h-3" /></button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bloco 2: Cronograma */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" /> 2. Roteiros e Ideias
            </h2>
            <p className="text-muted-foreground text-sm mt-1">Acrescente as postagens na esteira e deixe a IA trabalhar por você.</p>
          </div>
          <Button onClick={addItem} className="shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4 mr-2" /> Adicionar Vídeo
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16 border border-white/5 border-dashed rounded-2xl bg-black/20">
            <p className="text-zinc-500 mb-4">Seu cronograma deste PDF está vazio.</p>
            <Button onClick={addItem} variant="outline"><Plus className="w-4 h-4 mr-2" /> Criar a primeira ideia</Button>
          </div>
        ) : (
          <div className="space-y-8">
             {items.map((item, index) => (
                <div key={item.id} className="border border-white/10 bg-[#111111] rounded-2xl overflow-hidden relative shadow-md">
                   
                   <div className="absolute right-4 top-4">
                     <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="text-zinc-500 hover:text-red-500 hover:bg-red-500/10">
                       <Trash2 className="w-4 h-4" />
                     </Button>
                   </div>

                   {/* Item Header */}
                   <div className="p-6 border-b border-white/5 bg-black/40">
                     <div className="flex flex-wrap gap-4 items-end mb-2 pr-10">
                        <div className="flex-1 min-w-[250px] space-y-1">
                          <Label className="text-xs text-muted-foreground uppercase">Título / Ideia Principal</Label>
                          <Input value={item.title} onChange={e => updateItem(item.id, 'title', e.target.value)} placeholder="Ex: 5 erros matinais..." className="bg-black/60 border-white/10 font-bold text-lg h-12" />
                        </div>
                        <div className="w-full sm:w-[200px] space-y-1">
                          <Label className="text-xs text-muted-foreground uppercase">Dia Agendado</Label>
                          <Input type="date" value={item.date} onChange={e => updateItem(item.id, 'date', e.target.value)} className="bg-black/60 border-white/10 h-12" />
                        </div>
                        <div className="w-full sm:w-[200px] space-y-1">
                          <Label className="text-xs text-muted-foreground uppercase">Pilar Utilizado</Label>
                          <select 
                            value={item.pillar} 
                            onChange={e => updateItem(item.id, 'pillar', e.target.value)}
                            className="flex h-12 w-full items-center justify-between rounded-md border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="">Nenhum pilar</option>
                            {pillars.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                     </div>
                   </div>

                   {/* Roteiro e IA */}
                   <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 relative">
                     
                     {/* Módulo de Inteligência Artificial do Bloco */}
                     <div className="lg:col-span-4 bg-primary/5 border border-primary/20 rounded-xl p-5 mb-2 relative overflow-hidden">
                       <div className="flex items-center justify-between mb-4">
                         <h4 className="text-primary font-bold flex items-center gap-2">
                           <Wand2 className="w-4 h-4" /> Escrever Mágica da IA para este Vídeo
                         </h4>
                       </div>
                       
                       <div className="flex gap-2 items-start relative z-10 w-full sm:w-2/3 lg:w-3/4">
                          <Textarea 
                            value={promptData[item.id] || ''} 
                            onChange={e => setPromptData({...promptData, [item.id]: e.target.value})} 
                            placeholder="Do que se trata o vídeo? Ex: Dá uma super dica para atrair clientes pela manhã..." 
                            className="bg-black/60 border-primary/20 focus-visible:ring-primary/40 min-h-[60px]" 
                          />
                          <Button 
                            onClick={() => handleGenerateAI(item.id)} 
                            disabled={!promptData[item.id]?.trim() || item.isGeneratingAi} 
                            className="bg-primary text-black hover:bg-primary/90 min-h-[60px]"
                          >
                            {item.isGeneratingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          </Button>
                       </div>
                     </div>

                     <div className="space-y-2 lg:col-span-1">
                       <Label className="text-xs uppercase text-green-400 font-bold tracking-widest">Atenção (Gancho)</Label>
                       <Textarea 
                         placeholder="Frase bomba dos 3 segundos." 
                         value={item.hook} 
                         onChange={e => updateItem(item.id, 'hook', e.target.value)} 
                         className="bg-black/40 border-green-500/20 focus-visible:ring-green-500/30 min-h-[120px]" 
                       />
                     </div>
                     <div className="space-y-2 lg:col-span-2">
                       <Label className="text-xs uppercase text-zinc-400 font-bold tracking-widest">Conteúdo Bruto</Label>
                       <Textarea 
                         placeholder="O script principal. Mantenha direto ao ponto." 
                         value={item.development} 
                         onChange={e => updateItem(item.id, 'development', e.target.value)} 
                         className="bg-black/40 border-white/10 min-h-[120px]" 
                       />
                     </div>
                     <div className="space-y-2 lg:col-span-1">
                       <Label className="text-xs uppercase text-orange-400 font-bold tracking-widest">Ação (CTA)</Label>
                       <Textarea 
                         placeholder="Salve, Siga, Comente..." 
                         value={item.cta} 
                         onChange={e => updateItem(item.id, 'cta', e.target.value)} 
                         className="bg-black/40 border-orange-500/20 focus-visible:ring-orange-500/30 min-h-[120px]" 
                       />
                     </div>
                   </div>

                </div>
             ))}
          </div>
        )}
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/90 to-transparent flex justify-center z-50 pointer-events-none">
        <div className="pointer-events-auto bg-black border border-white/10 p-2 rounded-2xl shadow-2xl flex items-center gap-2">
           <Button onClick={() => setPreviewMode(true)} className="px-8 h-12 text-md bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-[0_0_20px_rgba(var(--primary),0.3)]">
             <FileText className="w-5 h-5 mr-2" />
             Gerar Documento Unificado (PDF)
           </Button>
        </div>
      </div>
    </div>
  );
}
