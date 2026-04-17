import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Users, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface Message { id: string; author: string; text: string; time: string; channel: string; }

const CHANNELS = [
  { id: 'geral', name: 'geral', icon: Hash },
  { id: 'producao', name: 'produção', icon: Hash },
  { id: 'comercial', name: 'comercial', icon: Hash },
  { id: 'equipe', name: 'equipe', icon: Users },
];

const SEED: Message[] = [
  { id: '1', author: 'Lucas', text: 'Bom dia time! 🚀', time: '09:00', channel: 'geral' },
  { id: '2', author: 'Ana', text: 'Bom dia! Tudo pronto para as gravações de hoje.', time: '09:02', channel: 'geral' },
  { id: '3', author: 'Carlos', text: 'Confirmando reunião às 14h.', time: '09:10', channel: 'comercial' },
];

export default function ChatPage() {
  const { user } = useAuth();
  const [channel, setChannel] = useState('geral');
  const [messages, setMessages] = useState<Message[]>(SEED);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const userName = user?.email?.split('@')[0] ?? 'Usuário';

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, channel]);

  const send = () => {
    if (!text.trim()) return;
    setMessages(m => [...m, {
      id: crypto.randomUUID(),
      author: userName,
      text: text.trim(),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      channel,
    }]);
    setText('');
  };

  const chMessages = messages.filter(m => m.channel === channel);

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-xl border border-border overflow-hidden bg-card">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 bg-sidebar border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-bold text-foreground flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" /> Chat Interno</h2>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {CHANNELS.map(ch => (
            <button
              key={ch.id}
              onClick={() => setChannel(ch.id)}
              className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                channel === ch.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <ch.icon className="h-4 w-4" />
              <span>#{ch.name}</span>
              {messages.filter(m => m.channel === ch.id).length > 0 && (
                <span className="ml-auto text-xs bg-primary/20 text-primary rounded-full px-1.5">{messages.filter(m => m.channel === ch.id).length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary uppercase">{userName[0]}</div>
            <span className="text-xs text-muted-foreground truncate">{userName}</span>
            <span className="ml-auto h-2 w-2 rounded-full bg-green-400" />
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="h-12 flex items-center gap-2 px-4 border-b border-border bg-card flex-shrink-0">
          <Hash className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-foreground">{CHANNELS.find(c => c.id === channel)?.name}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {chMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-2 opacity-20" />
              <p>Nenhuma mensagem ainda. Seja o primeiro!</p>
            </div>
          )}
          {chMessages.map((m, i) => {
            const isMe = m.author === userName;
            const showAuthor = i === 0 || chMessages[i-1].author !== m.author;
            return (
              <div key={m.id} className={cn('flex gap-3', isMe && 'flex-row-reverse')}>
                {showAuthor && (
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary uppercase flex-shrink-0">{m.author[0]}</div>
                )}
                {!showAuthor && <div className="w-8 flex-shrink-0" />}
                <div className={cn('max-w-[70%]', isMe && 'items-end flex flex-col')}>
                  {showAuthor && <span className="text-xs text-muted-foreground mb-1">{m.author} · {m.time}</span>}
                  <div className={cn('px-3 py-2 rounded-xl text-sm', isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-secondary text-foreground rounded-tl-sm')}>{m.text}</div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="p-3 border-t border-border bg-card flex gap-2 flex-shrink-0">
          <Input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder={`Mensagem em #${CHANNELS.find(c=>c.id===channel)?.name}...`}
            className="flex-1"
          />
          <Button onClick={send} size="icon"><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
