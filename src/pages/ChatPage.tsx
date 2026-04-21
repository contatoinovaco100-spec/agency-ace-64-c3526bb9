import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Hash, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  channel: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  content: string;
  created_at: string;
}

interface Employee {
  id: string;
  full_name: string;
  username: string | null;
  job_title: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

const CHANNELS = [
  { id: 'geral', name: 'geral' },
  { id: 'producao', name: 'produção' },
  { id: 'comercial', name: 'comercial' },
  { id: 'avisos', name: 'avisos' },
];

export default function ChatPage() {
  const { user } = useAuth();
  const [channel, setChannel] = useState('geral');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [myProfile, setMyProfile] = useState<Employee | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Carregar funcionários (online list) e perfil próprio
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, username, job_title, avatar_url, is_active')
        .eq('is_active', true)
        .order('full_name');
      const list = (profs || []) as Employee[];
      setEmployees(list);
      setMyProfile(list.find(p => p.id === user.id) || null);
    })();
  }, [user]);

  // Carregar mensagens do canal
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('channel', channel)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) {
        toast.error('Erro ao carregar mensagens');
      } else {
        setMessages(data || []);
      }
      setLoading(false);
    })();
  }, [channel, user]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`chat-${channel}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel=eq.${channel}` },
        (payload) => {
          setMessages(m => {
            const msg = payload.new as ChatMessage;
            if (m.some(x => x.id === msg.id)) return m;
            return [...m, msg];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_messages' },
        (payload) => {
          setMessages(m => m.filter(x => x.id !== (payload.old as any).id));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [channel, user]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, channel]);

  const send = async () => {
    if (!text.trim() || !user || sending) return;
    setSending(true);
    const content = text.trim();
    setText('');
    const { error } = await supabase.from('chat_messages').insert({
      channel,
      author_id: user.id,
      author_name: myProfile?.full_name || user.email?.split('@')[0] || 'Usuário',
      author_avatar: myProfile?.avatar_url || null,
      content,
    });
    if (error) {
      toast.error('Erro ao enviar mensagem');
      setText(content);
    }
    setSending(false);
  };

  const deleteMessage = async (id: string) => {
    const { error } = await supabase.from('chat_messages').delete().eq('id', id);
    if (error) toast.error('Não foi possível apagar');
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-xl border border-border overflow-hidden bg-card">
      {/* Sidebar canais + funcionários */}
      <aside className="w-60 flex-shrink-0 bg-sidebar border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" /> Chat Interno
          </h2>
        </div>

        <div className="px-3 pt-3 pb-1 text-xs uppercase tracking-wider text-muted-foreground">Canais</div>
        <nav className="px-2 space-y-1">
          {CHANNELS.map(ch => (
            <button
              key={ch.id}
              onClick={() => setChannel(ch.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                channel === ch.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <Hash className="h-4 w-4" />
              <span>{ch.name}</span>
            </button>
          ))}
        </nav>

        <div className="px-3 pt-4 pb-1 text-xs uppercase tracking-wider text-muted-foreground">
          Funcionários ({employees.length})
        </div>
        <div className="flex-1 px-2 space-y-1 overflow-y-auto pb-2">
          {employees.map(emp => (
            <div
              key={emp.id}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-foreground"
            >
              <div className="relative h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary uppercase flex-shrink-0">
                {emp.avatar_url ? (
                  <img src={emp.avatar_url} alt={emp.full_name} className="h-full w-full rounded-full object-cover" />
                ) : (
                  getInitials(emp.full_name)
                )}
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-sidebar" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{emp.full_name || emp.username}</p>
                {emp.job_title && (
                  <p className="truncate text-[10px] text-muted-foreground">{emp.job_title}</p>
                )}
              </div>
            </div>
          ))}
          {employees.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum funcionário cadastrado.</p>
          )}
        </div>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary uppercase flex-shrink-0">
              {getInitials(myProfile?.full_name || user?.email || 'U')}
            </div>
            <span className="text-xs text-muted-foreground truncate flex-1">
              {myProfile?.full_name || user?.email}
            </span>
            <span className="h-2 w-2 rounded-full bg-green-500" />
          </div>
        </div>
      </aside>

      {/* Painel principal */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="h-12 flex items-center gap-2 px-4 border-b border-border bg-card flex-shrink-0">
          <Hash className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-foreground">
            {CHANNELS.find(c => c.id === channel)?.name}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">{messages.length} mensagens</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-2 opacity-20" />
              <p>Nenhuma mensagem ainda. Seja o primeiro!</p>
            </div>
          ) : (
            messages.map((m, i) => {
              const isMe = m.author_id === user?.id;
              const showAuthor = i === 0 || messages[i - 1].author_id !== m.author_id;
              return (
                <div key={m.id} className={cn('flex gap-3 group', isMe && 'flex-row-reverse')}>
                  {showAuthor ? (
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary uppercase flex-shrink-0 overflow-hidden">
                      {m.author_avatar ? (
                        <img src={m.author_avatar} alt={m.author_name} className="h-full w-full object-cover" />
                      ) : (
                        getInitials(m.author_name)
                      )}
                    </div>
                  ) : (
                    <div className="w-8 flex-shrink-0" />
                  )}
                  <div className={cn('max-w-[70%] flex flex-col', isMe && 'items-end')}>
                    {showAuthor && (
                      <span className="text-xs text-muted-foreground mb-1">
                        {m.author_name} · {formatTime(m.created_at)}
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'px-3 py-2 rounded-xl text-sm whitespace-pre-wrap break-words',
                          isMe
                            ? 'bg-primary text-primary-foreground rounded-tr-sm'
                            : 'bg-secondary text-foreground rounded-tl-sm'
                        )}
                      >
                        {m.content}
                      </div>
                      {isMe && (
                        <button
                          onClick={() => deleteMessage(m.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          title="Apagar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-3 border-t border-border bg-card flex gap-2 flex-shrink-0">
          <Input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            placeholder={`Mensagem em #${CHANNELS.find(c => c.id === channel)?.name}...`}
            className="flex-1"
            disabled={sending}
          />
          <Button onClick={send} size="icon" disabled={sending || !text.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
