import { useEffect, useState } from 'react';
import { Link2, Plus, Trash2, Eye, GripVertical, ExternalLink, Copy, CheckCheck, Loader2, Save, ArrowUp, ArrowDown, MousePointerClick } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface LinkItem {
  id: string;
  title: string;
  url: string;
  active: boolean;
  icon: string;
  sort_order: number;
  clicks: number;
}

interface Profile {
  display_name: string;
  bio: string;
  avatar_emoji: string;
}

const PUBLIC_URL = `${window.location.origin}/links`;

export default function LinktreePage() {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [profile, setProfile] = useState<Profile>({ display_name: 'INOVA Co.', bio: 'Produtora Audiovisual', avatar_emoji: '🎬' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ title: '', url: '', icon: '🔗' });

  const load = async () => {
    setLoading(true);
    const [linksRes, profileRes] = await Promise.all([
      supabase.from('linktree_links').select('*').order('sort_order', { ascending: true }),
      supabase.from('linktree_profile').select('*').eq('id', 1).maybeSingle(),
    ]);
    setLinks((linksRes.data as LinkItem[]) || []);
    if (profileRes.data) {
      setProfile({
        display_name: profileRes.data.display_name,
        bio: profileRes.data.bio,
        avatar_emoji: profileRes.data.avatar_emoji,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addLink = async () => {
    if (!form.title || !form.url) {
      toast.error('Preencha título e URL');
      return;
    }
    const nextOrder = links.length > 0 ? Math.max(...links.map((l) => l.sort_order)) + 1 : 1;
    const { data, error } = await supabase
      .from('linktree_links')
      .insert({ title: form.title, url: form.url, icon: form.icon, active: true, sort_order: nextOrder })
      .select()
      .single();
    if (error) {
      toast.error('Erro ao adicionar link');
      return;
    }
    setLinks((l) => [...l, data as LinkItem]);
    setForm({ title: '', url: '', icon: '🔗' });
    toast.success('Link adicionado!');
  };

  const toggleLink = async (id: string) => {
    const link = links.find((l) => l.id === id);
    if (!link) return;
    const newActive = !link.active;
    setLinks((l) => l.map((x) => (x.id === id ? { ...x, active: newActive } : x)));
    const { error } = await supabase.from('linktree_links').update({ active: newActive }).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar');
      load();
    }
  };

  const removeLink = async (id: string) => {
    if (!confirm('Remover este link?')) return;
    setLinks((l) => l.filter((x) => x.id !== id));
    const { error } = await supabase.from('linktree_links').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao remover');
      load();
    } else {
      toast.success('Link removido');
    }
  };

  const moveLink = async (id: string, direction: 'up' | 'down') => {
    const idx = links.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= links.length) return;
    const a = links[idx];
    const b = links[swapIdx];
    const newLinks = [...links];
    newLinks[idx] = { ...b, sort_order: a.sort_order };
    newLinks[swapIdx] = { ...a, sort_order: b.sort_order };
    setLinks(newLinks);
    await Promise.all([
      supabase.from('linktree_links').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('linktree_links').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
  };

  const updateLinkField = async (id: string, field: 'title' | 'url' | 'icon', value: string) => {
    setLinks((l) => l.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
  };

  const persistLinkField = async (id: string, field: 'title' | 'url' | 'icon', value: string) => {
    const { error } = await supabase.from('linktree_links').update({ [field]: value }).eq('id', id);
    if (error) toast.error('Erro ao salvar');
  };

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('linktree_profile')
      .update({ display_name: profile.display_name, bio: profile.bio, avatar_emoji: profile.avatar_emoji })
      .eq('id', 1);
    setSaving(false);
    if (error) toast.error('Erro ao salvar perfil');
    else toast.success('Perfil salvo!');
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(PUBLIC_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeLinks = links.filter((l) => l.active);
  const totalClicks = links.reduce((sum, l) => sum + (l.clicks || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Link2 className="h-6 w-6 text-primary" /> Linktree
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Sua página pública de links — salva no banco de dados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyUrl} className="flex items-center gap-2">
            {copied ? <CheckCheck className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiado!' : 'Copiar Link'}
          </Button>
          <Button asChild variant="outline">
            <a href="/links" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" /> Abrir página
            </a>
          </Button>
          <Button onClick={() => setPreview(!preview)} variant={preview ? 'default' : 'outline'} className="flex items-center gap-2">
            <Eye className="h-4 w-4" /> {preview ? 'Editar' : 'Pré-visualizar'}
          </Button>
        </div>
      </div>

      {preview ? (
        <div className="flex justify-center py-8">
          <div className="w-80 space-y-4 text-center">
            <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto text-3xl">{profile.avatar_emoji}</div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{profile.display_name}</h2>
              <p className="text-sm text-muted-foreground">{profile.bio}</p>
            </div>
            <div className="space-y-3">
              {activeLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 w-full px-5 py-3.5 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <span className="text-xl">{link.icon}</span>
                  <span className="flex-1 font-medium text-foreground text-sm text-left">{link.title}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </a>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-[1fr,300px] gap-6">
          <div className="space-y-4">
            {/* Profile editor */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h3 className="font-semibold text-foreground">Perfil</h3>
              <div className="grid grid-cols-[60px,1fr,1fr] gap-2">
                <div>
                  <Label className="text-xs">Avatar</Label>
                  <Input value={profile.avatar_emoji} onChange={(e) => setProfile((p) => ({ ...p, avatar_emoji: e.target.value }))} className="mt-1 text-center text-lg" maxLength={2} />
                </div>
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input value={profile.display_name} onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Bio</Label>
                  <Input value={profile.bio} onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <Button onClick={saveProfile} disabled={saving} className="w-full flex items-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar Perfil
              </Button>
            </div>

            {/* Add link */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h3 className="font-semibold text-foreground">Adicionar Link</h3>
              <div className="grid grid-cols-[60px,1fr,1fr] gap-2">
                <div>
                  <Label className="text-xs">Ícone</Label>
                  <Input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} className="mt-1 text-center text-lg" maxLength={2} />
                </div>
                <div>
                  <Label className="text-xs">Título</Label>
                  <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex: Instagram" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">URL</Label>
                  <Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://..." className="mt-1" />
                </div>
              </div>
              <Button onClick={addLink} className="w-full flex items-center gap-2">
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </div>

            {/* Links list */}
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              {links.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhum link cadastrado.</p>
              ) : (
                links.map((link, idx) => (
                  <div key={link.id} className={cn('flex items-center gap-2 px-3 py-3', !link.active && 'opacity-50')}>
                    <div className="flex flex-col">
                      <button onClick={() => moveLink(link.id, 'up')} disabled={idx === 0} className="text-muted-foreground hover:text-primary disabled:opacity-30">
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button onClick={() => moveLink(link.id, 'down')} disabled={idx === links.length - 1} className="text-muted-foreground hover:text-primary disabled:opacity-30">
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={link.icon}
                      onChange={(e) => updateLinkField(link.id, 'icon', e.target.value)}
                      onBlur={(e) => persistLinkField(link.id, 'icon', e.target.value)}
                      className="w-12 text-center text-lg p-1 h-9"
                      maxLength={2}
                    />
                    <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
                      <Input
                        value={link.title}
                        onChange={(e) => updateLinkField(link.id, 'title', e.target.value)}
                        onBlur={(e) => persistLinkField(link.id, 'title', e.target.value)}
                        className="h-9 text-sm"
                      />
                      <Input
                        value={link.url}
                        onChange={(e) => updateLinkField(link.id, 'url', e.target.value)}
                        onBlur={(e) => persistLinkField(link.id, 'url', e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground" title="Cliques">
                      <MousePointerClick className="h-3 w-3" />
                      {link.clicks || 0}
                    </div>
                    <Switch checked={link.active} onCheckedChange={() => toggleLink(link.id)} />
                    <button onClick={() => removeLink(link.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold text-foreground mb-3">Status</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Links ativos</span>
                  <Badge className="bg-primary/10 text-primary">{activeLinks.length}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Links inativos</span>
                  <Badge variant="outline">{links.length - activeLinks.length}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold text-foreground">{links.length}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-border">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <MousePointerClick className="h-3 w-3" /> Cliques totais
                  </span>
                  <span className="font-semibold text-primary">{totalClicks}</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold text-foreground mb-2">Seu Link</h3>
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground truncate">{PUBLIC_URL}</span>
              </div>
              <Button onClick={copyUrl} variant="outline" size="sm" className="w-full mt-2 text-xs">
                {copied ? '✓ Copiado!' : 'Copiar URL'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
