import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Instagram, Music2, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { STATUS_LABEL, type SocialAccount } from '@/types/social';

interface Props {
  account: SocialAccount;
  syncing?: boolean;
  onReconnect: (a: SocialAccount) => void;
  onRemove: (a: SocialAccount) => void;
}

const statusVariant: Record<string, string> = {
  connected: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  expired: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  disconnected: 'bg-destructive/15 text-destructive border-destructive/30',
};

export function AccountCard({ account, syncing, onReconnect, onRemove }: Props) {
  const Icon = account.platform === 'instagram' ? Instagram : Music2;
  const synced = account.last_synced_at
    ? new Date(account.last_synced_at).toLocaleString('pt-BR')
    : '—';

  return (
    <Card className="group transition-all hover:border-primary/40 hover:shadow-lg animate-in fade-in-50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11 border border-border">
            <AvatarImage src={account.profile_picture} alt={account.username} />
            <AvatarFallback>{account.username.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 truncate text-sm font-semibold">
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{account.display_name || account.username}</span>
            </div>
            <p className="truncate text-xs text-muted-foreground">@{account.username}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className={statusVariant[account.status] ?? ''}>
            {STATUS_LABEL[account.status] ?? account.status}
          </Badge>
          <span className="text-[11px] text-muted-foreground">Sync: {synced}</span>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm" variant="outline" className="flex-1"
            disabled={syncing} onClick={() => onReconnect(account)}
          >
            {syncing
              ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
            Atualizar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onRemove(account)}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
