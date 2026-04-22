import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Search, MessageCircle, Settings, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Conversation {
  id: string;
  contact_phone: string;
  contact_name: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  lead_id: string | null;
  client_id: string | null;
}

interface Message {
  id: string;
  direction: 'in' | 'out';
  content: string;
  type: string;
  status: string;
  created_at: string;
}

export default function WhatsAppPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carrega conversas + realtime
  useEffect(() => {
    loadConversations();
    const ch = supabase
      .channel('wa-conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversations' }, () => {
        loadConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Carrega mensagens da conversa + realtime
  useEffect(() => {
    if (!selected) return;
    loadMessages(selected.id);
    // zera não lidas
    if (selected.unread_count > 0) {
      supabase.from('wa_conversations').update({ unread_count: 0 }).eq('id', selected.id);
    }
    const ch = supabase
      .channel(`wa-messages-${selected.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wa_messages', filter: `conversation_id=eq.${selected.id}` },
        () => loadMessages(selected.id)
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selected?.id]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    const { data } = await supabase
      .from('wa_conversations')
      .select('*')
      .order('last_message_at', { ascending: false });
    setConversations((data as Conversation[]) || []);
  };

  const loadMessages = async (convId: string) => {
    const { data } = await supabase
      .from('wa_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    setMessages((data as Message[]) || []);
  };

  const sendMessage = async () => {
    if (!input.trim() || !selected) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('wa-send', {
        body: { to: selected.contact_phone, text: input },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Erro ao enviar');
      setInput('');
    } catch (e: any) {
      toast({
        title: 'Erro ao enviar',
        description: e.message?.includes('24') 
          ? 'Fora da janela de 24h — use um template aprovado' 
          : e.message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const filtered = conversations.filter(
    c =>
      c.contact_name.toLowerCase().includes(search.toLowerCase()) ||
      c.contact_phone.includes(search)
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Lista de conversas */}
      <div className="w-80 flex flex-col rounded-lg border bg-card">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Conversas</h2>
            <Link to="/whatsapp/config">
              <Button variant="ghost" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Nenhuma conversa ainda.
              <br />
              Aguardando mensagens...
            </div>
          )}
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className={`w-full text-left p-3 border-b hover:bg-secondary/50 transition-default ${
                selected?.id === c.id ? 'bg-secondary' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm truncate">{c.contact_name}</span>
                {c.unread_count > 0 && (
                  <span className="bg-primary text-primary-foreground text-[10px] rounded-full px-1.5 py-0.5">
                    {c.unread_count}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{c.last_message}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true, locale: ptBR })}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col rounded-lg border bg-card">
        {selected ? (
          <>
            <div className="p-3 border-b">
              <p className="font-semibold">{selected.contact_name}</p>
              <p className="text-xs text-muted-foreground">+{selected.contact_phone}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map(m => (
                <div
                  key={m.id}
                  className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-3 py-2 ${
                      m.direction === 'out'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                    <p className="text-[10px] opacity-70 mt-1 text-right">
                      {new Date(m.created_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {m.direction === 'out' && ` · ${m.status}`}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-3 border-t flex gap-2">
              <Input
                placeholder="Digite uma mensagem..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                disabled={sending}
              />
              <Button onClick={sendMessage} disabled={sending || !input.trim()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Selecione uma conversa</p>
              <Link to="/whatsapp/config" className="text-sm text-primary hover:underline">
                Configurar WhatsApp
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
