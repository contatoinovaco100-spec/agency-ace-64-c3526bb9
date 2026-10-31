import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, Inbox, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { FeedRow } from '@/components/NotificationBell';
import { FEED_FILTERS, useNotificationFeed, type FeedItem } from '@/lib/notificationFeed';
import { cn } from '@/lib/utils';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { items, unread, markRead, clear } = useNotificationFeed();
  const [filter, setFilter] = useState('todas');

  const kinds = FEED_FILTERS.find((f) => f.id === filter)?.kinds;
  const shown = items.filter((i) => !kinds || kinds.includes(i.kind));
  const countOf = (k: (typeof FEED_FILTERS)[number]['kinds']) => (k ? items.filter((i) => k.includes(i.kind)).length : items.length);
  const openItem = (item: FeedItem) => { if (item.link) navigate(item.link); };

  const handleClear = () => {
    if (confirm('Limpar todo o histórico de notificações deste navegador?')) clear();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Central"
        title="Notificações"
        description="Movimentações do Kanban, aprovações dos clientes, menções no chat, leads novos e vendas, num lugar só."
        actions={items.length > 0 && <>
          {unread > 0 && (
            <Button variant="outline" onClick={markRead}><CheckCheck className="h-4 w-4" /> Marcar {unread} como lidas</Button>
          )}
          <Button variant="ghost" onClick={handleClear} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" /> Limpar
          </Button>
        </>}
      />

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FEED_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              filter === f.id ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
            <span className={cn('text-xs', filter === f.id ? 'text-background/70' : 'text-muted-foreground/70')}>{countOf(f.kinds)}</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {shown.length === 0 ? (
          <div className="px-6 py-16 text-center text-muted-foreground">
            <Inbox className="mx-auto h-9 w-9 opacity-40" />
            <p className="mt-3 text-sm">Nenhuma notificação aqui ainda.</p>
            <p className="mt-1 text-xs">Dica: no chat, escreva @ e o nome de um colega para chamar a atenção dele.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((item) => <li key={item.id}><FeedRow item={item} onOpen={openItem} /></li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
