import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AtSign, Instagram, Music2 } from 'lucide-react';
import { PLATFORM_META, type SocialAccount, type SocialPlatform } from '@/types/social';

interface Props {
  platform: SocialPlatform;
  accounts: SocialAccount[];
  selected: string[];
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
}

export function AccountSelector({ platform, accounts, selected, onToggle, onToggleAll }: Props) {
  if (!accounts.length) return null;
  const Icon = platform === 'instagram' ? Instagram : platform === 'threads' ? AtSign : Music2;
  const ids = accounts.map(a => a.id);
  const allChecked = ids.every(id => selected.includes(id));

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {PLATFORM_META[platform].label}
          <span className="text-xs font-normal text-muted-foreground">({accounts.length})</span>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Checkbox checked={allChecked} onCheckedChange={c => onToggleAll(ids, !!c)} />
          Selecionar todas
        </label>
      </div>

      <div className="grid gap-1.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map(a => (
          <label
            key={a.id}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-transparent bg-muted/40 px-2 py-1.5 transition-colors hover:border-primary/40"
          >
            <Checkbox checked={selected.includes(a.id)} onCheckedChange={() => onToggle(a.id)} />
            <Avatar className="h-6 w-6">
              <AvatarImage src={a.profile_picture} />
              <AvatarFallback className="text-[9px]">{a.username.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="truncate text-xs">@{a.username}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
