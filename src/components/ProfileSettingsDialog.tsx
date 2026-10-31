import { useEffect, useRef, useState } from 'react';
import { Camera, Eye, EyeOff, KeyRound, Loader2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type MyProfile = { full_name: string; avatar_url: string | null };

/** Perfil de quem está logado (nome e foto), para o rodapé do menu e o diálogo de configurações */
export function useMyProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<MyProfile | null>(null);

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).maybeSingle()
      .then(({ data }) => setProfile(data ?? { full_name: '', avatar_url: null }));
  }, [user]);

  return [profile, setProfile] as const;
}

export const initialsOf = (name: string | undefined, email: string | undefined) => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length) return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  return (email?.[0] ?? '?').toUpperCase();
};

/** Recorta no centro e reduz para 320px em WebP: a foto fica leve em toda a plataforma */
async function squareThumb(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(320, side);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  canvas.getContext('2d')!.drawImage(
    bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size,
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível processar a imagem.'))), 'image/webp', 0.85),
  );
}

export function ProfileSettingsDialog({
  open, onOpenChange, profile, onProfileChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: MyProfile | null;
  onProfileChange: (p: MyProfile) => void;
}) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    if (open) {
      setName(profile?.full_name ?? '');
      setCurrent(''); setNext(''); setConfirm(''); setShow(false);
    }
  }, [open, profile?.full_name]);

  if (!user) return null;

  const uploadPhoto = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Escolha um arquivo de imagem.'); return; }
    setUploading(true);
    try {
      const blob = await squareThumb(file);
      // A pasta com o id do usuário é a que a regra do armazenamento deixa cada um alterar
      const path = `${user.id}/avatar-${Date.now()}.webp`;
      const { error: upErr } = await supabase.storage.from('rede-media').upload(path, blob, { contentType: 'image/webp' });
      if (upErr) throw upErr;
      const url = supabase.storage.from('rede-media').getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
      if (error) throw error;
      onProfileChange({ full_name: profile?.full_name ?? '', avatar_url: url });
      toast.success('Foto de perfil atualizada.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível enviar a foto.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removePhoto = async () => {
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
    if (error) { toast.error(error.message); return; }
    onProfileChange({ full_name: profile?.full_name ?? '', avatar_url: null });
    toast.success('Foto removida.');
  };

  const saveName = async () => {
    const full_name = name.trim();
    if (!full_name) { toast.error('Digite seu nome.'); return; }
    setSavingName(true);
    const { error } = await supabase.from('profiles').update({ full_name }).eq('id', user.id);
    setSavingName(false);
    if (error) { toast.error(error.message); return; }
    onProfileChange({ full_name, avatar_url: profile?.avatar_url ?? null });
    toast.success('Nome atualizado.');
  };

  const pwdError =
    next && next.length < 8 ? 'A nova senha precisa ter pelo menos 8 caracteres.'
      : confirm && next !== confirm ? 'As senhas não conferem.'
        : next && current && next === current ? 'A nova senha é igual à atual.'
          : null;

  const savePassword = async () => {
    if (!current || !next || !confirm || pwdError) return;
    setSavingPwd(true);
    try {
      // Confere a senha atual antes de trocar: ninguém troca a senha só por achar o computador aberto
      const { error: authErr } = await supabase.auth.signInWithPassword({ email: user.email!, password: current });
      if (authErr) throw new Error('Senha atual incorreta.');
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      setCurrent(''); setNext(''); setConfirm('');
      toast.success('Senha alterada.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível alterar a senha.');
    } finally {
      setSavingPwd(false);
    }
  };

  const nameChanged = name.trim() !== (profile?.full_name ?? '').trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Meu perfil</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        {/* Foto */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Trocar foto de perfil"
          >
            <Avatar className="h-20 w-20">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt="" className="object-cover" />}
              <AvatarFallback className="bg-secondary text-lg font-semibold">
                {initialsOf(profile?.full_name, user.email)}
              </AvatarFallback>
            </Avatar>
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70 opacity-0 transition-opacity group-hover:opacity-100">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            </span>
          </button>
          <div className="min-w-0 space-y-2">
            <p className="text-sm text-muted-foreground">JPG, PNG ou WebP. A foto é recortada no centro.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {profile?.avatar_url ? 'Trocar foto' : 'Enviar foto'}
              </Button>
              {profile?.avatar_url && (
                <Button size="sm" variant="ghost" onClick={removePhoto} disabled={uploading}>Remover</Button>
              )}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }}
          />
        </div>

        {/* Nome */}
        <div className="space-y-2 border-t border-border pt-5">
          <Label htmlFor="profile-name" className="flex items-center gap-2"><UserRound className="h-4 w-4 text-muted-foreground" /> Nome</Label>
          <div className="flex gap-2">
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Seu nome" />
            <Button variant="outline" onClick={saveName} disabled={!nameChanged || savingName}>
              {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </div>

        {/* Senha */}
        <form
          className="space-y-3 border-t border-border pt-5"
          onSubmit={(e) => { e.preventDefault(); savePassword(); }}
        >
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-muted-foreground" /> Alterar senha</Label>
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {show ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          <Input type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Senha atual"
            value={current} onChange={(e) => setCurrent(e.target.value)} />
          <Input type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Nova senha (mín. 8 caracteres)"
            value={next} onChange={(e) => setNext(e.target.value)} />
          <Input type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Repita a nova senha"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {pwdError && <p className="text-xs text-destructive">{pwdError}</p>}
          <Button type="submit" className="w-full" disabled={!current || !next || !confirm || !!pwdError || savingPwd}>
            {savingPwd && <Loader2 className="h-4 w-4 animate-spin" />}
            Alterar senha
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
