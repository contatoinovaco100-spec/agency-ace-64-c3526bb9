import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, Send, RefreshCw, Wifi, WifiOff, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';

interface Chat {
  phone: string;
  name: string;
  lastMessage?: string;
  lastMessageTimestamp?: number;
  unreadCount?: number;
  profilePicUrl?: string;
}

interface Message {
  messageId: string;
  phone: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  type?: string;
}

export function WhatsAppPanel() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [search, setSearch] = useState('');
  const [waSession, setWaSession] = useState<{ status: string; qr_code: string | null }>({ status: 'DISCONNECTED', qr_code: null });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const callLocalService = async (endpoint: string, options: RequestInit = {}) => {
    try {
      const response = await fetch(`http://localhost:3001${endpoint}`, {
        ...options,
        headers: {
          ...options.headers,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Local service error');
      return await response.json();
    } catch (err) {
      return null;
    }
  };

  const callZapi = async (action: string, body: Record<string, unknown> = {}) => {
    // Tenta o serviço local primeiro
    if (action === 'get-status') {
      const localData = await callLocalService('/status');
      if (localData) return localData;
    }
    if (action === 'get-chats') {
      const localData = await callLocalService('/chats');
      if (localData) return localData;
    }
    if (action === 'get-messages') {
      const localData = await callLocalService(`/messages?phone=${body.phone}`);
      if (localData) return localData;
    }
    if (action === 'send-text') {
      const localData = await callLocalService('/send-text', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      if (localData) return localData;
    }

    // Fallback para Z-API (Supabase Edge Function)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const res = await supabase.functions.invoke('zapi-whatsapp', {
      body: { action, ...body },
    });

    if (res.error) throw new Error(res.error.message);
    return res.data;
  };

  const loadChats = async () => {
    setLoading(true);
    try {
      const data = await callZapi('get-chats');
      const chatList: Chat[] = (Array.isArray(data) ? data : []).map((c: any) => ({
        phone: c.phone || c.id?.replace('@c.us', '') || '',
        name: c.name || c.contact?.name || c.phone || 'Desconhecido',
        lastMessage: c.lastMessageBody || c.lastMessage?.body || '',
        lastMessageTimestamp: c.lastMessageTimestamp || c.lastMessage?.timestamp || 0,
        unreadCount: c.unreadCount || 0,
        profilePicUrl: c.profilePicUrl || c.imgUrl || '',
      }));
      chatList.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
      setChats(chatList);
    } catch (err: any) {
      toast({ title: 'Erro ao carregar conversas', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (chat: Chat) => {
    setSelectedChat(chat);
    setMessages([]);
    try {
      const data = await callZapi('get-messages', { phone: chat.phone });
      const msgs: Message[] = (Array.isArray(data) ? data : []).map((m: any) => ({
        messageId: m.messageId || m.id || crypto.randomUUID(),
        phone: m.phone || chat.phone,
        body: m.body || m.text?.message || m.content || '',
        fromMe: m.fromMe ?? false,
        timestamp: m.timestamp || m.mompiledAt || 0,
        type: m.type || 'chat',
      }));
      msgs.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      toast({ title: 'Erro ao carregar mensagens', description: err.message, variant: 'destructive' });
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;
    setSending(true);
    try {
      await callZapi('send-text', { phone: selectedChat.phone, message: newMessage });
      setMessages(prev => [...prev, {
        messageId: crypto.randomUUID(),
        phone: selectedChat.phone,
        body: newMessage,
        fromMe: true,
        timestamp: Math.floor(Date.now() / 1000),
      }]);
      setNewMessage('');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    callZapi('get-status').then((data) => {
      setConnected(data?.connected ?? false);
    }).catch(() => setConnected(false));
    loadChats();

    // Listener Realtime para a sessão do WhatsApp
    const channel = supabase
      .channel('whatsapp_session_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wa_sync_v1', filter: 'id=eq.default-session' },
        (payload) => {
          const newData = payload.new as any;
          if (newData) {
            setWaSession({ status: newData.status || 'DISCONNECTED', qr_code: newData.qr_code || null });
            setConnected(newData.status === 'CONNECTED');
          }
        }
      )
      .subscribe();

    // Carregar estado inicial
    const fetchSession = async () => {
      try {
        const { data, error } = await (supabase
          .from('wa_sync_v1' as any)
          .select('*')
          .eq('id', 'default-session')
          .maybeSingle() as any);
        
        if (data) {
          setWaSession({ status: data.status, qr_code: data.qr_code });
          setConnected(data.status === 'CONNECTED');
        }
      } catch (err) {
        console.error('Erro ao carregar sessão do WA');
      }
    };
    fetchSession();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredChats = chats.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const formatTime = (ts: number) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-[calc(100vh-220px)] rounded-lg border border-border bg-card overflow-hidden">
      {/* Sidebar - Chat list */}
      <div className="flex w-80 flex-col border-r border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-success" />
            <span className="text-body font-semibold text-foreground">WhatsApp</span>
            {connected !== null && (
              connected
                ? <Wifi className="h-3.5 w-3.5 text-success" />
                : <WifiOff className="h-3.5 w-3.5 text-destructive" />
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={loadChats} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.length === 0 && !loading && (
            <p className="px-4 py-8 text-center text-caption text-muted-foreground">
              {connected === false ? 'WhatsApp não conectado na Z-API' : 'Nenhuma conversa encontrada'}
            </p>
          )}
          {filteredChats.map(chat => (
            <button
              key={chat.phone}
              onClick={() => loadMessages(chat)}
              className={cn(
                'flex w-full items-start gap-3 px-4 py-3 text-left transition-default hover:bg-secondary/50',
                selectedChat?.phone === chat.phone && 'bg-primary/10'
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/20 text-sm font-medium text-success">
                {chat.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate text-body font-medium text-foreground">{chat.name}</span>
                  <span className="text-[10px] text-muted-foreground">{formatTime(chat.lastMessageTimestamp || 0)}</span>
                </div>
                <p className="truncate text-caption text-muted-foreground">{chat.lastMessage}</p>
              </div>
              {(chat.unreadCount ?? 0) > 0 && (
                <span className="mt-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-success px-1 text-[10px] font-bold text-success-foreground">
                  {chat.unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {connected ? (
          selectedChat ? (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/20 text-sm font-medium text-success">
                  {selectedChat.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-body font-medium text-foreground">{selectedChat.name}</p>
                  <p className="text-caption text-muted-foreground">+{selectedChat.phone}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {messages.map(msg => (
                  <div key={msg.messageId} className={cn('flex', msg.fromMe ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[70%] rounded-lg px-3 py-2 text-body',
                      msg.fromMe
                        ? 'bg-success/20 text-foreground'
                        : 'bg-secondary text-foreground'
                    )}>
                      <p className="whitespace-pre-wrap break-words">{msg.body || `[${msg.type}]`}</p>
                      <span className="mt-1 block text-right text-[10px] text-muted-foreground">{formatTime(msg.timestamp)}</span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="flex items-end gap-2 border-t border-border px-4 py-3">
                <Textarea
                  placeholder="Digite uma mensagem..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  className="min-h-[40px] max-h-[120px] resize-none"
                  rows={1}
                />
                <Button onClick={sendMessage} disabled={sending || !newMessage.trim()} size="icon" className="shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="mx-auto mb-3 h-12 w-12 opacity-30" />
                <p className="text-body">Selecione uma conversa</p>
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-secondary/10">
            {waSession.qr_code ? (
              <div className="space-y-6">
                <div className="bg-white p-4 rounded-xl shadow-xl inline-block">
                  <QRCodeSVG value={waSession.qr_code} size={256} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">Escaneie o QR Code</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Abra o WhatsApp no seu celular, vá em Aparelhos Conectados e scaneie o código acima para integrar com o CRM.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-success animate-pulse">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-caption font-medium uppercase tracking-wider">Aguardando Conexão...</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <WifiOff className="mx-auto h-12 w-12 text-muted-foreground opacity-30" />
                <div className="space-y-1">
                  <p className="text-lg font-medium">WhatsApp Desconectado</p>
                  <p className="text-muted-foreground">Inicie o serviço localmente para gerar o QR Code.</p>
                </div>
                <div className="p-4 bg-background/50 border border-dashed border-border rounded-lg text-left font-mono text-[11px] text-muted-foreground">
                  <p className="mb-2">Execute no seu terminal:</p>
                  <code>cd whatsapp-service-standalone && bun run start</code>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
