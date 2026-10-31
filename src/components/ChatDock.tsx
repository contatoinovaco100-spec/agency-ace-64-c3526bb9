import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowLeft, Hash, Loader2, Maximize2, MessageCircle, Send, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { NavLink } from '@/components/NavLink';
import { useOnlineUsers } from '@/hooks/useOnlineUsers';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  CHAT_CHANNELS, chatInitials, chatTime, dmChannel, markSeen, readSeen,
  type ChatEmployee, type ChatMessage,
} from '@/lib/chat';
import { MentionText, useMentionInput } from '@/components/ChatMentions';

/**
 * Chat Interno estilo Messenger: bolha no canto que acompanha todas as páginas, com contador de
 * não lidas, e uma janelinha com as conversas. Fechada não ocupa espaço da tela de trabalho.
 */
export function ChatDock() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [employees, setEmployees] = useState<ChatEmployee[]>([]);
  const [recent, setRecent] = useState<ChatMessage[]>([]);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [seen, setSeen] = useState(readSeen);
  const online = useOnlineUsers();
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const onChatPage = location.pathname.startsWith('/chat');
  const me = employees.find(e => e.id === user?.id);
  const mention = useMentionInput(text, setText, employees, user?.id);

  // Conversas que me dizem respeito: canais + privadas com cada colega
  const channels = useMemo(() => {
    if (!user) return [];
    return [
      ...CHAT_CHANNELS.map(c => ({ id: c.id, name: `#${c.name}`, emp: null as ChatEmployee | null })),
      ...employees.filter(e => e.id !== user.id).map(e => ({ id: dmChannel(user.id, e.id), name: e.full_name || e.username || 'Colega', emp: e })),
    ];
  }, [employees, user]);
  const channelIds = useMemo(() => new Set(channels.map(c => c.id)), [channels]);

  useEffect(() => {
    const sync = () => setSeen(readSeen());
    window.addEventListener('chat-seen', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('chat-seen', sync); window.removeEventListener('storage', sync); };
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles')
      .select('id, full_name, username, job_title, avatar_url, is_active')
      .eq('is_active', true).not('username', 'is', null).order('full_name')
      .then(({ data }) => setEmployees((data ?? []) as ChatEmployee[]));
  }, [user]);

  // Última mensagem de cada conversa, para a lista e o contador
  useEffect(() => {
    if (!user || !channels.length) return;
    supabase.from('chat_messages').select('*')
      .in('channel', channels.map(c => c.id))
      .order('created_at', { ascending: false }).limit(400)
      .then(({ data }) => setRecent((data ?? []) as ChatMessage[]));
  }, [user, channels]);

  // Tempo real: um canal só, filtrando aqui o que é meu
  useEffect(() => {
    if (!user || !channelIds.size) return;
    const ch = supabase
      .channel('chat-dock')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const msg = payload.new as ChatMessage;
        if (!channelIds.has(msg.channel)) return;
        setRecent(r => (r.some(x => x.id === msg.id) ? r : [msg, ...r]));
        if (msg.channel === activeRef.current) setThread(t => (t.some(x => x.id === msg.id) ? t : [...t, msg]));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (payload) => {
        const id = (payload.old as { id: string }).id;
        setRecent(r => r.filter(x => x.id !== id));
        setThread(t => t.filter(x => x.id !== id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, channelIds]);

  useEffect(() => {
    if (!active) return;
    setLoadingThread(true);
    supabase.from('chat_messages').select('*').eq('channel', active)
      .order('created_at', { ascending: true }).limit(200)
      .then(({ data }) => { setThread((data ?? []) as ChatMessage[]); setLoadingThread(false); });
  }, [active]);

  useEffect(() => {
    if (!open || !active) return;
    bottomRef.current?.scrollIntoView({ block: 'end' });
    markSeen(active);
  }, [thread, open, active]);

  const lastByChannel = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const m of recent) if (!map.has(m.channel)) map.set(m.channel, m);
    return map;
  }, [recent]);

  const unreadOf = (channel: string) =>
    recent.filter(m => m.channel === channel && m.author_id !== user?.id && m.created_at > (seen[channel] ?? '')).length;
  const totalUnread = channels.reduce((n, c) => n + unreadOf(c.id), 0);

  // Conversas com mensagem primeiro (mais recente no topo), depois os colegas sem conversa
  const list = useMemo(() => [...channels].sort((a, b) => {
    const la = lastByChannel.get(a.id)?.created_at ?? '';
    const lb = lastByChannel.get(b.id)?.created_at ?? '';
    if (la || lb) return lb.localeCompare(la);
    return Number(!!b.emp && online.has(b.emp.id)) - Number(!!a.emp && online.has(a.emp.id));
  }), [channels, lastByChannel, online]);
  const onlineCount = employees.filter(e => e.id !== user?.id && online.has(e.id)).length;

  if (!user || onChatPage) return null;

  const current = channels.find(c => c.id === active);

  const send = async () => {
    const content = text.trim();
    if (!content || !active || sending) return;
    setSending(true);
    setText('');
    const { data, error } = await supabase.from('chat_messages').insert({
      channel: active,
      author_id: user.id,
      author_name: me?.full_name || user.email?.split('@')[0] || 'Usuário',
      author_avatar: me?.avatar_url || null,
      content,
    }).select().single();
    if (error) setText(content);
    else if (data) {
      const msg = data as ChatMessage;
      setThread(t => (t.some(x => x.id === msg.id) ? t : [...t, msg]));
      setRecent(r => (r.some(x => x.id === msg.id) ? r : [msg, ...r]));
    }
    setSending(false);
  };

  const face = (emp: ChatEmployee | null, name: string, size = 'h-9 w-9') => (
    <span className="relative shrink-0">
      <Avatar className={size}>
        {emp?.avatar_url && <AvatarImage src={emp.avatar_url} alt="" className="object-cover" />}
        <AvatarFallback className="bg-secondary text-[11px] font-semibold">
          {emp ? chatInitials(name) : <Hash className="h-4 w-4 text-muted-foreground" />}
        </AvatarFallback>
      </Avatar>
      {emp && online.has(emp.id) && (
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-success" aria-label="Online" />
      )}
    </span>
  );

  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-3 lg:bottom-5 lg:right-5">
      {open && (
        <div className="raised-shadow flex h-[min(540px,calc(100dvh-180px))] w-[min(360px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border border-border bg-card">
          {/* Topo */}
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-2">
            {current ? (
              <>
                <button onClick={() => setActive(null)} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Voltar às conversas">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                {face(current.emp, current.name, 'h-7 w-7')}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold leading-tight">{current.name}</span>
                  {current.emp && (
                    <span className="block text-[11px] leading-tight text-muted-foreground">{online.has(current.emp.id) ? 'Online agora' : 'Offline'}</span>
                  )}
                </span>
              </>
            ) : (
              <span className="flex-1 pl-2">
                <span className="block font-display text-sm font-semibold leading-tight">Chat interno</span>
                <span className="flex items-center gap-1.5 text-[11px] leading-tight text-muted-foreground">
                  <span className={cn('h-1.5 w-1.5 rounded-full', onlineCount ? 'bg-success' : 'bg-muted-foreground/50')} />
                  {onlineCount === 1 ? '1 colega online' : `${onlineCount} colegas online`}
                </span>
              </span>
            )}
            <NavLink to="/chat" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" title="Abrir em tela cheia" aria-label="Abrir em tela cheia">
              <Maximize2 className="h-4 w-4" />
            </NavLink>
            <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Fechar chat">
              <X className="h-4 w-4" />
            </button>
          </div>

          {!current ? (
            <ul className="flex-1 overflow-y-auto py-1">
              {list.map(c => {
                const last = lastByChannel.get(c.id);
                const unread = unreadOf(c.id);
                return (
                  <li key={c.id}>
                    <button onClick={() => setActive(c.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent">
                      {face(c.emp, c.name)}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className={cn('truncate text-sm', unread ? 'font-semibold text-foreground' : 'font-medium text-foreground/90')}>{c.name}</span>
                          {last && <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{chatTime(last.created_at)}</span>}
                        </span>
                        <span className={cn('block truncate text-xs', unread ? 'text-foreground' : 'text-muted-foreground')}>
                          {last
                            ? `${last.author_id === user.id ? 'Você: ' : c.emp ? '' : `${last.author_name.split(' ')[0]}: `}${last.content}`
                            : c.emp ? (online.has(c.emp.id) ? 'Online agora' : c.emp.job_title || 'Offline') : 'Nenhuma mensagem ainda'}
                        </span>
                      </span>
                      {!!unread && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-brand-foreground">{unread}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <>
              <div className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
                {loadingThread ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : !thread.length ? (
                  <p className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">Nenhuma mensagem ainda. Diga oi!</p>
                ) : thread.map((m, i) => {
                  const mine = m.author_id === user.id;
                  const first = i === 0 || thread[i - 1].author_id !== m.author_id;
                  return (
                    <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start', first && i > 0 && 'pt-2')}>
                      {first && !mine && !current.emp && <span className="mb-0.5 px-1 text-[11px] text-muted-foreground">{m.author_name}</span>}
                      <div
                        className={cn(
                          'max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm',
                          mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-muted text-foreground',
                        )}
                        title={chatTime(m.created_at)}
                      >
                        <MentionText content={m.content} onPrimary={mine} />
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <form className="relative flex shrink-0 items-end gap-2 border-t border-border p-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
                {mention.list}
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (mention.onKeyDown(e)) return; if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  rows={1}
                  placeholder="Mensagem (@ para mencionar)"
                  className="max-h-28 min-h-9 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  autoFocus
                />
                <button type="submit" disabled={!text.trim() || sending} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground disabled:opacity-40" aria-label="Enviar">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        className="raised-shadow relative flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground transition-transform hover:scale-105"
        aria-label={open ? 'Fechar chat interno' : 'Abrir chat interno'}
        title="Chat interno"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        {!open && totalUnread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rec px-1 text-[11px] font-semibold text-rec-foreground">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>
    </div>
  );
}
