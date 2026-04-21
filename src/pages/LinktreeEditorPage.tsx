import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, ExternalLink, Loader2, Save, ArrowUp, ArrowDown,
  MousePointerClick, Upload, Image as ImageIcon, Palette, Copy, CheckCheck, GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface Linktree {
  id: string;
  slug: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  avatar_emoji: string;
  theme: string;
  bg_color: string;
  button_color: string;
  button_text_color: string;
  text_color: string;
  border_color: string;
  button_style: string;
}

interface LinkItem {
  id: string;
  title: string;
  url: string;
  active: boolean;
  icon: string;
  sort_order: number;
  clicks: number;
}

const THEMES: Record<string, { name: string; bg: string; button: string; buttonText: string; text: string; border: string }> = {
  dark: { name: 'Escuro INOVA', bg: '#0a0a0a', button: '#bff720', buttonText: '#0a0a0a', text: '#ffffff', border: '#bff720' },
  light: { name: 'Claro', bg: '#ffffff', button: '#0a0a0a', buttonText: '#ffffff', text: '#0a0a0a', border: '#e5e5e5' },
  neon: { name: 'Neon', bg: '#0a0118', button: '#e91e63', buttonText: '#ffffff', text: '#ffffff', border: '#9c27b0' },
  ocean: { name: 'Oceano', bg: '#0c2340', button: '#5cbdb9', buttonText: '#0c2340', text: '#ffffff', border: '#5cbdb9' },
  sunset: { name: 'Pôr do Sol', bg: '#2d1b3d', button: '#ff6b35', buttonText: '#ffffff', text: '#fef0f5', border: '#ff6b35' },
  sand: { name: 'Areia', bg: '#faf8f5', button: '#8b7355', buttonText: '#ffffff', text: '#2d2d2d', border: '#c9b99a' },
  forest: { name: 'Floresta', bg: '#1a3c2a', button: '#a0c49d', buttonText: '#1a3c2a', text: '#f5f0e8', border: '#a0c49d' },
  midnight: { name: 'Meia-noite', bg: '#0a0a1a', button: '#4f46e5', buttonText: '#ffffff', text: '#ffffff', border: '#4f46e5' },
};

export default function LinktreeEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [linktree, setLinktree] = useState<Linktree | null>(null);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ title: '', url: '', icon: '🔗' });

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [ltRes, linksRes] = await Promise.all([
        supabase.from('linktrees').select('*').eq('id', id).maybeSingle(),
        supabase.from('linktree_links').select('*').eq('linktree_id', id).order('sort_order', { ascending: true }),
      ]);
      if (!ltRes.data) {
        toast.error('Linktree não encontrado');
        navigate('/linktree');
        return;
      }
      setLinktree(ltRes.data as Linktree);
      setLinks((linksRes.data as LinkItem[]) || []);
      setLoading(false);
    })();
  }, [id, navigate]);

  const publicUrl = linktree ? `${window.location.origin}/links/${linktree.slug}` : '';

  const updateLT = (patch: Partial<Linktree>) => setLinktree((lt) => (lt ? { ...lt, ...patch } : lt));

  const applyTheme = (key: string) => {
    const t = THEMES[key];
    if (!t) return;
    updateLT({
      theme: key,
      bg_color: t.bg,
      button_color: t.button,
      button_text_color: t.buttonText,
      text_color: t.text,
      border_color: t.border,
    });
  };

  const saveProfile = async () => {
    if (!linktree) return;
    setSaving(true);
    const { error } = await supabase
      .from('linktrees')
      .update({
        display_name: linktree.display_name,
        bio: linktree.bio,
        avatar_emoji: linktree.avatar_emoji,
        avatar_url: linktree.avatar_url,
        theme: linktree.theme,
        bg_color: linktree.bg_color,
        button_color: linktree.button_color,
        button_text_color: linktree.button_text_color,
        text_color: linktree.text_color,
        border_color: linktree.border_color,
        button_style: linktree.button_style,
      })
      .eq('id', linktree.id);
    setSaving(false);
    if (error) toast.error('Erro ao salvar');
    else toast.success('Salvo!');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !linktree) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Imagem muito grande (max 50MB)');
      return;
    }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${linktree.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('linktree-avatars').upload(path, file, { upsert: true });
    if (upErr) {
      toast.error('Erro no upload');
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from('linktree-avatars').getPublicUrl(path);
    const url = data.publicUrl;
    const { error: updErr } = await supabase.from('linktrees').update({ avatar_url: url }).eq('id', linktree.id);
    if (updErr) {
      toast.error('Erro ao salvar avatar');
    } else {
      updateLT({ avatar_url: url });
      toast.success('Foto atualizada!');
    }
    setUploading(false);
  };

  const removeAvatar = async () => {
    if (!linktree) return;
    const { error } = await supabase.from('linktrees').update({ avatar_url: null }).eq('id', linktree.id);
    if (error) toast.error('Erro');
    else {
      updateLT({ avatar_url: null });
      toast.success('Foto removida');
    }
  };

  const addLink = async () => {
    if (!linktree || !form.title || !form.url) {
      toast.error('Preencha título e URL');
      return;
    }
    const nextOrder = links.length > 0 ? Math.max(...links.map((l) => l.sort_order)) + 1 : 1;
    const { data, error } = await supabase
      .from('linktree_links')
      .insert({
        linktree_id: linktree.id,
        title: form.title,
        url: form.url,
        icon: form.icon,
        active: true,
        sort_order: nextOrder,
      })
      .select()
      .single();
    if (error) {
      toast.error('Erro ao adicionar');
      return;
    }
    setLinks((l) => [...l, data as LinkItem]);
    setForm({ title: '', url: '', icon: '🔗' });
    toast.success('Link adicionado');
  };

  const toggleLink = async (linkId: string) => {
    const link = links.find((l) => l.id === linkId);
    if (!link) return;
    const newActive = !link.active;
    setLinks((l) => l.map((x) => (x.id === linkId ? { ...x, active: newActive } : x)));
    await supabase.from('linktree_links').update({ active: newActive }).eq('id', linkId);
  };

  const removeLink = async (linkId: string) => {
    if (!confirm('Remover este link?')) return;
    setLinks((l) => l.filter((x) => x.id !== linkId));
    await supabase.from('linktree_links').delete().eq('id', linkId);
  };

  const moveLink = async (linkId: string, direction: 'up' | 'down') => {
    const idx = links.findIndex((l) => l.id === linkId);
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

  const updateLinkLocal = (linkId: string, field: 'title' | 'url' | 'icon', value: string) => {
    setLinks((l) => l.map((x) => (x.id === linkId ? { ...x, [field]: value } : x)));
  };

  const persistLinkField = async (linkId: string, field: 'title' | 'url' | 'icon', value: string) => {
    await supabase.from('linktree_links').update({ [field]: value }).eq('id', linkId);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !linktree) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const radius = linktree.button_style === 'pill' ? '9999px' : linktree.button_style === 'square' ? '4px' : '12px';
  const totalClicks = links.reduce((sum, l) => sum + (l.clicks || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/linktree"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{linktree.display_name}</h1>
            <p className="text-xs text-muted-foreground">/links/{linktree.slug}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyUrl} size="sm">
            {copied ? <CheckCheck className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            {copied ? 'Copiado' : 'Copiar URL'}
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" /> Abrir
            </a>
          </Button>
          <Button onClick={saveProfile} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Salvar
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr,360px] gap-6">
        {/* Editor */}
        <div className="space-y-4">
          <Tabs defaultValue="profile">
            <TabsList>
              <TabsTrigger value="profile">Perfil</TabsTrigger>
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="links">Links ({links.length})</TabsTrigger>
            </TabsList>

            {/* Perfil */}
            <TabsContent value="profile" className="space-y-4 mt-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                <h3 className="font-semibold text-foreground">Foto de perfil</h3>
                <div className="flex items-center gap-4">
                  {linktree.avatar_url ? (
                    <img src={linktree.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover" />
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center text-3xl">
                      {linktree.avatar_emoji}
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" />
                    <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} size="sm" variant="outline">
                      {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                      {linktree.avatar_url ? 'Trocar foto' : 'Enviar foto'}
                    </Button>
                    {linktree.avatar_url && (
                      <Button onClick={removeAvatar} size="sm" variant="ghost" className="text-destructive">
                        Remover foto
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Emoji (usado se não tiver foto)</Label>
                  <Input value={linktree.avatar_emoji} onChange={(e) => updateLT({ avatar_emoji: e.target.value })} maxLength={2} className="mt-1 w-20 text-center text-lg" />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div>
                  <Label className="text-xs">Nome exibido</Label>
                  <Input value={linktree.display_name} onChange={(e) => updateLT({ display_name: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Bio</Label>
                  <Input value={linktree.bio} onChange={(e) => updateLT({ bio: e.target.value })} className="mt-1" />
                </div>
              </div>
            </TabsContent>

            {/* Design */}
            <TabsContent value="design" className="space-y-4 mt-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" /> Temas prontos
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(THEMES).map(([key, t]) => (
                    <button
                      key={key}
                      onClick={() => applyTheme(key)}
                      className={cn(
                        'rounded-lg p-2 border-2 transition-all text-xs font-medium',
                        linktree.theme === key ? 'border-primary' : 'border-transparent hover:border-border',
                      )}
                      style={{ background: t.bg, color: t.text }}
                    >
                      <div className="flex gap-1 justify-center mb-1">
                        <span className="h-3 w-3 rounded-full" style={{ background: t.button }} />
                        <span className="h-3 w-3 rounded-full border" style={{ background: t.bg, borderColor: t.border }} />
                      </div>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h3 className="font-semibold text-foreground">Cores customizadas</h3>
                <div className="grid grid-cols-2 gap-3">
                  <ColorField label="Fundo" value={linktree.bg_color} onChange={(v) => updateLT({ bg_color: v, theme: 'custom' })} />
                  <ColorField label="Cor dos botões" value={linktree.button_color} onChange={(v) => updateLT({ button_color: v, theme: 'custom' })} />
                  <ColorField label="Texto dos botões" value={linktree.button_text_color} onChange={(v) => updateLT({ button_text_color: v, theme: 'custom' })} />
                  <ColorField label="Texto principal" value={linktree.text_color} onChange={(v) => updateLT({ text_color: v, theme: 'custom' })} />
                  <ColorField label="Borda" value={linktree.border_color} onChange={(v) => updateLT({ border_color: v, theme: 'custom' })} />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h3 className="font-semibold text-foreground">Estilo dos botões</h3>
                <div className="flex gap-2">
                  {(['rounded', 'pill', 'square'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => updateLT({ button_style: s })}
                      className={cn(
                        'flex-1 px-3 py-2 text-xs border-2 transition-all',
                        linktree.button_style === s ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50',
                        s === 'pill' ? 'rounded-full' : s === 'square' ? 'rounded-sm' : 'rounded-xl',
                      )}
                    >
                      {s === 'rounded' ? 'Arredondado' : s === 'pill' ? 'Pílula' : 'Quadrado'}
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Links */}
            <TabsContent value="links" className="space-y-4 mt-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                <h3 className="font-semibold text-foreground">Adicionar link</h3>
                <div className="grid grid-cols-[60px,1fr,1fr] gap-2">
                  <div>
                    <Label className="text-xs">Ícone</Label>
                    <Input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} maxLength={2} className="mt-1 text-center text-lg" />
                  </div>
                  <div>
                    <Label className="text-xs">Título</Label>
                    <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Instagram" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">URL</Label>
                    <Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://..." className="mt-1" />
                  </div>
                </div>
                <Button onClick={addLink} className="w-full">
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>

              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {links.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">Nenhum link.</p>
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
                        onChange={(e) => updateLinkLocal(link.id, 'icon', e.target.value)}
                        onBlur={(e) => persistLinkField(link.id, 'icon', e.target.value)}
                        className="w-12 text-center text-lg p-1 h-9"
                        maxLength={2}
                      />
                      <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
                        <Input value={link.title} onChange={(e) => updateLinkLocal(link.id, 'title', e.target.value)} onBlur={(e) => persistLinkField(link.id, 'title', e.target.value)} className="h-9 text-sm" />
                        <Input value={link.url} onChange={(e) => updateLinkLocal(link.id, 'url', e.target.value)} onBlur={(e) => persistLinkField(link.id, 'url', e.target.value)} className="h-9 text-sm" />
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground" title="Cliques">
                        <MousePointerClick className="h-3 w-3" />
                        {link.clicks || 0}
                      </div>
                      <Switch checked={link.active} onCheckedChange={() => toggleLink(link.id)} />
                      <button onClick={() => removeLink(link.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <MousePointerClick className="h-4 w-4 text-primary" /> Cliques totais
                </span>
                <span className="font-bold text-primary text-lg">{totalClicks}</span>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Live Preview */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="bg-muted/50 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2 border-b border-border">
              <ImageIcon className="h-3 w-3" /> Pré-visualização ao vivo
            </div>
            <div className="p-4 min-h-[500px]" style={{ background: linktree.bg_color, color: linktree.text_color }}>
              <div className="text-center space-y-3 mb-6">
                {linktree.avatar_url ? (
                  <img src={linktree.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover mx-auto" style={{ boxShadow: `0 0 0 3px ${linktree.button_color}60` }} />
                ) : (
                  <div className="h-20 w-20 rounded-full mx-auto flex items-center justify-center text-3xl" style={{ background: `${linktree.button_color}20`, boxShadow: `0 0 0 3px ${linktree.button_color}60` }}>
                    {linktree.avatar_emoji}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold" style={{ color: linktree.text_color }}>{linktree.display_name}</h2>
                  {linktree.bio && <p className="text-xs opacity-80">{linktree.bio}</p>}
                </div>
              </div>
              <div className="space-y-2">
                {links.filter((l) => l.active).map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-medium"
                    style={{
                      background: linktree.button_color,
                      color: linktree.button_text_color,
                      border: `1px solid ${linktree.border_color}`,
                      borderRadius: radius,
                    }}
                  >
                    <span>{link.icon}</span>
                    <span className="flex-1">{link.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 rounded cursor-pointer border border-border" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 text-xs font-mono" />
      </div>
    </div>
  );
}
