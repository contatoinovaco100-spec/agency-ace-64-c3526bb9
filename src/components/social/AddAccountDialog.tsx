import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { socialAccountsService } from '@/services/socialAccounts';
import type { SocialPlatform } from '@/types/social';

interface Props {
  platform: SocialPlatform;
  label: string;
  onAdded: () => void;
}

export function AddAccountDialog({ platform, label, onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [picture, setPicture] = useState('');

  const save = async () => {
    const handle = username.trim().replace(/^@/, '');
    if (handle.length < 2) {
      toast.error('Informe o @ da conta');
      return;
    }
    setSaving(true);
    try {
      await socialAccountsService.addManual({
        platform,
        username: handle,
        display_name: displayName.trim(),
        profile_picture: picture.trim(),
      });
      toast.success(`@${handle} adicionada`);
      setUsername(''); setDisplayName(''); setPicture('');
      setOpen(false);
      onAdded();
    } catch (e: any) {
      toast.error('Erro ao adicionar conta', { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" /> Adicionar conta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar conta do {label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>@ da conta</Label>
            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="@minhaempresa" />
          </div>
          <div className="space-y-1.5">
            <Label>Nome exibido (opcional)</Label>
            <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Minha Empresa" />
          </div>
          <div className="space-y-1.5">
            <Label>Foto de perfil — URL (opcional)</Label>
            <Input value={picture} onChange={e => setPicture(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
