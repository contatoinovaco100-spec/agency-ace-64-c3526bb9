import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, RefreshCw, Copy, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Message { id: string; role: 'user'|'assistant'; content: string; }

const SUGGESTIONS = [
  'Crie uma legenda para Instagram sobre produção audiovisual',
  'Faça um roteiro de 60 segundos para apresentação de empresa',
  'Sugira 5 ideias de conteúdo para uma marca de moda',
  'Redija um email de proposta comercial para cliente novo',
  'Liste os diferenciais de uma produtora audiovisual premium',
];

const RESPONSES: Record<string, string> = {
  default: 'Olá! Sou a Nova, sua assistente inteligente da INOVA Co. Estou aqui para ajudar com roteiros, legendas, estratégias de conteúdo, propostas comerciais e muito mais. Como posso te ajudar hoje? 🚀',
};

export default function NovaAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'assistant', content: RESPONSES.default }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string|null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const generateResponse = async (prompt: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GROQ_API_KEY;
    if (apiKey && import.meta.env.VITE_GEMINI_API_KEY) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: `Você é a Nova, assistente da INOVA Co., uma produtora audiovisual premium. Responda em português brasileiro de forma profissional e criativa.\n\nUsuário: ${prompt}` }] }] })
        });
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || smartReply(prompt);
      } catch { return smartReply(prompt); }
    }
    return smartReply(prompt);
  };

  const smartReply = (prompt: string): string => {
    const p = prompt.toLowerCase();
    if (p.includes('legenda') || p.includes('instagram')) {
      return `✨ **Legenda para Instagram:**\n\nTransformar uma ideia em realidade audiovisual é o que fazemos todos os dias. 🎬\n\nDa captação à entrega final, cada detalhe é pensado para contar a sua história da forma mais impactante.\n\n💡 Quer elevar o nível do seu conteúdo?\n\n📩 Fale conosco!\n\n#Produção #Audiovisual #Criativo #Conteúdo #Marketing`;
    }
    if (p.includes('roteiro')) {
      return `🎬 **Roteiro 60s – Apresentação de Empresa:**\n\n**[0–5s]** Hook: "E se eu te dissesse que sua marca pode ser vista por milhares de pessoas todos os dias?"\n\n**[5–20s]** Problema: "A maioria das empresas não sabe como produzir conteúdo de qualidade de forma consistente."\n\n**[20–40s]** Solução: "A INOVA Co. faz isso por você. Planejamos, gravamos, editamos e entregamos tudo no prazo."\n\n**[40–55s]** Prova social: "Mais de 30 clientes já transformaram sua presença digital conosco."\n\n**[55–60s]** CTA: "Clique no link e agende sua consultoria gratuita!"`;
    }
    if (p.includes('ideia') || p.includes('conteúdo')) {
      return `💡 **5 Ideias de Conteúdo:**\n\n1. 🎭 **Bastidores** – Mostre o processo de criação dos seus produtos\n2. 📊 **Antes/Depois** – Transformações do seu negócio\n3. 🗣️ **Depoimento de cliente** – Histórias reais geram confiança\n4. 🎓 **Tutorial/Dica** – Ensine algo relacionado ao seu nicho\n5. 📅 **Rotina da equipe** – Humanize sua marca`;
    }
    if (p.includes('email') || p.includes('proposta')) {
      return `📧 **Email de Proposta Comercial:**\n\nAssunto: Proposta de Produção de Conteúdo – [Nome da Empresa]\n\nOlá, [Nome]!\n\nFoi um prazer a nossa conversa. Segue a proposta que elaboramos especialmente para a [Empresa].\n\n**O que incluímos:**\n• X vídeos/mês de alta qualidade\n• Planejamento estratégico de conteúdo\n• Edição profissional com identidade visual\n• Relatório mensal de resultados\n\n**Investimento:** R$ X.XXX/mês\n\nEstamos à disposição para alinhar detalhes. Quando posso agendar uma apresentação?\n\nAbraços,\nEquipe INOVA Co.`;
    }
    return `🤖 Entendi sua pergunta sobre: "${prompt}"\n\nComo sua assistente de criação de conteúdo, posso ajudar com:\n\n• ✍️ Roteiros e scripts\n• 📱 Legendas para redes sociais\n• 📊 Estratégias de conteúdo\n• 📧 Emails e propostas comerciais\n• 💡 Brainstorm de ideias\n\nFaça uma pergunta mais específica para eu criar o conteúdo perfeito para você!`;
  };

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: msg };
    setMessages(m => [...m, userMsg]);
    setLoading(true);
    const reply = await generateResponse(msg);
    setMessages(m => [...m, { id: crypto.randomUUID(), role: 'assistant', content: reply }]);
    setLoading(false);
  };

  const copyMsg = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] space-y-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Bot className="h-6 w-6 text-primary" /> Nova Assistente <Badge className="bg-primary/10 text-primary border-primary/30 text-xs">IA</Badge></h1>
          <p className="text-muted-foreground text-sm mt-1">Sua assistente criativa para conteúdo e comunicação</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setMessages([{ id: '0', role: 'assistant', content: RESPONSES.default }])} className="flex items-center gap-2"><RefreshCw className="h-3.5 w-3.5" /> Nova conversa</Button>
      </div>

      <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={cn('flex gap-3', msg.role==='user' && 'flex-row-reverse')}>
              <div className={cn('h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm',
                msg.role==='assistant' ? 'bg-primary/20 text-primary' : 'bg-secondary text-foreground'
              )}>
                {msg.role==='assistant' ? <Sparkles className="h-4 w-4" /> : '👤'}
              </div>
              <div className={cn('max-w-[75%] group', msg.role==='user' && 'items-end flex flex-col')}>
                <div className={cn('px-4 py-3 rounded-xl text-sm whitespace-pre-line leading-relaxed relative',
                  msg.role==='assistant' ? 'bg-secondary text-foreground rounded-tl-sm' : 'bg-primary text-primary-foreground rounded-tr-sm'
                )}>
                  {msg.content}
                  {msg.role==='assistant' && (
                    <button onClick={() => copyMsg(msg.id, msg.content)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/10">
                      {copied===msg.id ? <CheckCheck className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0"><Sparkles className="h-4 w-4 text-primary animate-pulse" /></div>
              <div className="bg-secondary rounded-xl px-4 py-3 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{animationDelay:'0ms'}} />
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{animationDelay:'150ms'}} />
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{animationDelay:'300ms'}} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
            {SUGGESTIONS.map((s,i) => (
              <button key={i} onClick={() => sendMessage(s)}
                className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors bg-card">
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="p-3 border-t border-border flex gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Peça um roteiro, legenda, ideia de conteúdo... (Enter para enviar)"
            className="flex-1 min-h-[52px] max-h-32 resize-none"
          />
          <Button onClick={() => sendMessage()} disabled={loading || !input.trim()} size="icon" className="self-end h-10 w-10"><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
