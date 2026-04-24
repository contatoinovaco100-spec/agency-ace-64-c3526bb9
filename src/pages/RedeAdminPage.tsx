import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Loader2, Plus, EyeOff, Eye, Trash2, Star, StarOff, ArrowLeft, Building2, Pencil, KeyRound, CheckCircle2,
} from 'lucide-react';
import { NICHES, POST_TYPE_LABELS, containsForbidden, type RedeCompany, type RedePost } from '@/types/rede';

const empty: Partial<RedeCompany> = {
  name: '', logo_url: '', description: '', niche: '', services: [], city: '',
  whatsapp: '', instagram: '', website: '', is_featured: false, is_active: true,
};

export default function RedeAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const nav = useNavigate();
  const [tab, setTab] = useState<'posts' | 'empresas'>('empresas');
  const [posts, setPosts] = useState<RedePost[]>([]);
  const [companies, setCompanies] = useState<RedeCompany[]>([]);
  const [loading, setLoading] = useState(true);

  // company form state
  const [editing, setEditing] = useState<Partial<RedeCompany> | null>(null);
  const [servicesText, setServicesText] = useState('');

  // access modal state
  const [accessFor, setAccessFor] = useState<RedeCompany | null>(null);
  const [accessEmail, setAccessEmail] = useState('');
  const [accessPassword, setAccessPassword] = useState('');
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessResult, setAccessResult] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!user) { nav('/login'); return; }
    if (!isAdmin) { nav('/negocios'); return; }
    refresh();
  }, [user, isAdmin, authLoading, roleLoading, nav]);

  async function refresh() {
    setLoading(true);
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('rede_companies').select('*').order('created_at', { ascending: false }),
      supabase.from('rede_posts').select('*, company:rede_companies(*)').order('created_at', { ascending: false }).limit(200),
    ]);
    setCompanies((c ?? []) as unknown as RedeCompany[]);
    setPosts((p ?? []) as unknown as RedePost[]);
    setLoading(false);
  }

  function openNewCompany() {
    setEditing({ ...empty });
    setServicesText('');
  }

  function openEditCompany(c: RedeCompany) {
    setEditing({ ...c });
    setServicesText(c.services.join(', '));
  }

  function openCreateAccess(c: RedeCompany) {
    setAccessFor(c);
    setAccessEmail('');
    setAccessPassword(genPassword());
    setAccessResult(null);
  }

  function genPassword() {
    return Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6);
  }

  async function createAccess() {
    if (!accessFor) return;
    if (!accessEmail.trim() || !accessPassword.trim()) {
      toast.error('Preencha email e senha.');
      return;
    }
    setAccessLoading(true);
    const { data, error } = await supabase.functions.invoke('rede-create-company-user', {
      body: {
        company_id: accessFor.id,
        email: accessEmail.trim(),
        password: accessPassword.trim(),
        full_name: accessFor.name,
      },
    });
    setAccessLoading(false);
    if (error || (data as { error?: string })?.error) {
      const msg = (data as { error?: string })?.error || error?.message || 'Falha ao criar acesso.';
      toast.error(msg);
      return;
    }
    setAccessResult({ email: accessEmail.trim(), password: accessPassword });
    toast.success('Acesso criado com sucesso!');
    refresh();
  }

  async function saveCompany() {
    if (!editing) return;
    if (!editing.name?.trim()) { toast.error('Nome é obrigatório.'); return; }
    const services = servicesText.split(',').map(s => s.trim()).filter(Boolean);
    const forbidden = services.find(s => containsForbidden(s)) || containsForbidden(editing.description || '');
    if (forbidden) { toast.error(`Termo não permitido: "${forbidden}".`); return; }

    const owner_user_id = editing.owner_user_id ?? null;

    const payload = {
      name: editing.name!.trim(),
      logo_url: editing.logo_url || '',
      description: editing.description || '',
      niche: editing.niche || '',
      services,
      city: editing.city || '',
      whatsapp: editing.whatsapp || '',
      instagram: editing.instagram || '',
      website: editing.website || '',
      is_featured: !!editing.is_featured,
      is_active: editing.is_active !== false,
      owner_user_id,
    };

    if (editing.id) {
      const { error } = await supabase.from('rede_companies').update(payload).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Empresa atualizada.');
    } else {
      const { error } = await supabase.from('rede_companies').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Empresa criada.');
    }
    setEditing(null);
    refresh();
  }

  async function uploadLogo(file: File) {
    if (!user) return;
    const ext = file.name.split('.').pop() || 'png';
    const path = `${user.id}/logos/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('rede-media').upload(path, file, { upsert: false });
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from('rede-media').getPublicUrl(path);
    setEditing(prev => prev ? { ...prev, logo_url: data.publicUrl } : prev);
    toast.success('Logo carregado.');
  }

  async function deleteCompany(id: string) {
    if (!confirm('Excluir empresa e todos os seus posts?')) return;
    const { error } = await supabase.from('rede_companies').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Empresa removida.');
    refresh();
  }

  async function togglePost(id: string, field: 'is_hidden' | 'is_featured', value: boolean) {
    const payload = field === 'is_hidden' ? { is_hidden: value } : { is_featured: value };
    const { error } = await supabase.from('rede_posts').update(payload).eq('id', id);
    if (error) return toast.error(error.message);
    refresh();
  }

  async function deletePost(id: string) {
    if (!confirm('Excluir esta publicação?')) return;
    const { error } = await supabase.from('rede_posts').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Publicação removida.');
    refresh();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Button asChild variant="ghost" size="sm" className="mb-4 gap-2">
          <Link to="/negocios"><ArrowLeft className="h-4 w-4" /> Voltar para o feed</Link>
        </Button>

        <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Painel — Rede de Negócios</h1>
            <p className="text-sm text-muted-foreground">Modere publicações e gerencie as empresas da rede.</p>
          </div>
          <div className="flex gap-2">
            <Button variant={tab === 'empresas' ? 'default' : 'outline'} size="sm" onClick={() => setTab('empresas')}>
              <Building2 className="h-4 w-4 mr-1" /> Empresas ({companies.length})
            </Button>
            <Button variant={tab === 'posts' ? 'default' : 'outline'} size="sm" onClick={() => setTab('posts')}>
              Posts ({posts.length})
            </Button>
          </div>
        </header>

        {tab === 'empresas' && (
          <>
            <div className="flex justify-end mb-3">
              <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
                <DialogTrigger asChild>
                  <Button onClick={openNewCompany} className="gap-2"><Plus className="h-4 w-4" /> Nova empresa</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>{editing?.id ? 'Editar empresa' : 'Nova empresa'}</DialogTitle></DialogHeader>
                  {editing && (
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nome *</Label>
                          <Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Cidade</Label>
                          <Input value={editing.city || ''} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Logo</Label>
                        <div className="flex items-center gap-3">
                          {editing.logo_url && <img src={editing.logo_url} alt="" className="h-12 w-12 rounded-full object-cover bg-muted" />}
                          <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Descrição</Label>
                        <Textarea rows={3} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nicho</Label>
                          <Select value={editing.niche || ''} onValueChange={(v) => setEditing({ ...editing, niche: v })}>
                            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                            <SelectContent>
                              {NICHES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>WhatsApp (com DDI)</Label>
                          <Input value={editing.whatsapp || ''} onChange={(e) => setEditing({ ...editing, whatsapp: e.target.value })} placeholder="5511999999999" />
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Instagram (@ ou link)</Label>
                          <Input value={editing.instagram || ''} onChange={(e) => setEditing({ ...editing, instagram: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Site</Label>
                          <Input value={editing.website || ''} onChange={(e) => setEditing({ ...editing, website: e.target.value })} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Serviços oferecidos (separe por vírgula — sem marketing)</Label>
                        <Textarea rows={2} value={servicesText} onChange={(e) => setServicesText(e.target.value)} placeholder="Ex: Reformas, Pintura, Elétrica" />
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={!!editing.is_featured} onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked })} />
                          Empresa em destaque
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={editing.is_active !== false} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                          Ativa (visível no feed)
                        </label>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                        <Button onClick={saveCompany}>Salvar</Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {companies.map(c => (
                <Card key={c.id} className="p-4 flex gap-3 items-start">
                  {c.logo_url
                    ? <img src={c.logo_url} alt={c.name} className="h-12 w-12 rounded-full object-cover bg-muted shrink-0" />
                    : <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">{c.name.slice(0, 2).toUpperCase()}</div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{c.name}</span>
                      {c.is_featured && <Badge className="gap-1 bg-primary/15 text-primary border border-primary/30"><Star className="h-3 w-3" /> Destaque</Badge>}
                      {!c.is_active && <Badge variant="outline" className="text-muted-foreground">Inativa</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{c.niche || 'Sem nicho'} · {c.city || 'Sem cidade'}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEditCompany(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteCompany(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </Card>
              ))}
              {companies.length === 0 && (
                <Card className="p-8 text-center text-muted-foreground md:col-span-2">Nenhuma empresa cadastrada ainda.</Card>
              )}
            </div>
          </>
        )}

        {tab === 'posts' && (
          <div className="space-y-3">
            {posts.map(p => (
              <Card key={p.id} className={`p-4 ${p.is_hidden ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="font-medium">{p.company?.name || '—'}</span>
                      <Badge variant="outline">{POST_TYPE_LABELS[p.post_type]}</Badge>
                      {p.is_featured && <Badge className="bg-primary/15 text-primary border border-primary/30 gap-1"><Star className="h-3 w-3" /> Destaque</Badge>}
                      {p.is_hidden && <Badge variant="outline" className="text-muted-foreground">Oculto</Badge>}
                      <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                    {p.content && <p className="text-sm mt-2 whitespace-pre-wrap line-clamp-4">{p.content}</p>}
                    {p.media_url && p.media_type === 'image' && <img src={p.media_url} alt="" className="mt-2 rounded h-24 object-cover" />}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" title={p.is_featured ? 'Remover destaque' : 'Destacar'} onClick={() => togglePost(p.id, 'is_featured', !p.is_featured)}>
                      {p.is_featured ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" title={p.is_hidden ? 'Mostrar' : 'Ocultar'} onClick={() => togglePost(p.id, 'is_hidden', !p.is_hidden)}>
                      {p.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deletePost(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </Card>
            ))}
            {posts.length === 0 && <Card className="p-8 text-center text-muted-foreground">Nenhuma publicação ainda.</Card>}
          </div>
        )}
      </div>
    </div>
  );
}
