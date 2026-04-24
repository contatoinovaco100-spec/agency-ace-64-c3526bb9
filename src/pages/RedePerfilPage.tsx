import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Plus, Building2, MessageCircle, Star, EyeOff } from 'lucide-react';
import { containsForbidden, type RedeCompany, type RedePost, POST_TYPE_LABELS } from '@/types/rede';

export default function RedePerfilPage() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [company, setCompany] = useState<RedeCompany | null>(null);
  const [posts, setPosts] = useState<RedePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [servicesText, setServicesText] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { nav('/login'); return; }
    refresh();
  }, [user, authLoading, nav]);

  async function refresh() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('rede_companies').select('*').eq('owner_user_id', user.id).maybeSingle();
    const c = data as unknown as RedeCompany | null;
    setCompany(c);
    setServicesText(c?.services?.join(', ') ?? '');
    if (c) {
      const { data: ps } = await supabase
        .from('rede_posts').select('*').eq('company_id', c.id).order('created_at', { ascending: false });
      setPosts((ps ?? []) as unknown as RedePost[]);
    }
    setLoading(false);
  }

  async function uploadLogo(file: File) {
    if (!user) return;
    const ext = file.name.split('.').pop() || 'png';
    const path = `${user.id}/logos/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('rede-media').upload(path, file, { upsert: false });
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from('rede-media').getPublicUrl(path);
    setCompany(prev => prev ? { ...prev, logo_url: data.publicUrl } : prev);
    toast.success('Logo carregado.');
  }

  async function save() {
    if (!company) return;
    const services = servicesText.split(',').map(s => s.trim()).filter(Boolean);
    const forbidden = services.find(s => containsForbidden(s)) || containsForbidden(company.description || '');
    if (forbidden) { toast.error(`Termo não permitido: "${forbidden}".`); return; }
    setSaving(true);
    const { error } = await supabase.from('rede_companies').update({
      logo_url: company.logo_url || '',
      description: company.description || '',
      city: company.city || '',
      whatsapp: company.whatsapp || '',
      instagram: company.instagram || '',
      website: company.website || '',
      services,
    }).eq('id', company.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Perfil atualizado.');
    refresh();
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center space-y-3">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground" />
          <h2 className="font-semibold text-lg">Você ainda não tem um perfil de empresa</h2>
          <p className="text-sm text-muted-foreground">
            Os perfis da Rede de Negócios Inova são criados pela equipe Inova.
            Fale com a gente para entrar na rede.
          </p>
          <div className="flex gap-2 justify-center">
            <Button asChild variant="outline"><Link to="/negocios">Ver feed</Link></Button>
            <Button asChild className="gap-2">
              <a href="https://wa.me/5500000000000?text=Olá! Quero participar da Rede de Negócios Inova." target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" /> Falar com a Inova
              </a>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Button asChild variant="ghost" size="sm" className="mb-4 gap-2">
          <Link to="/negocios"><ArrowLeft className="h-4 w-4" /> Voltar para o feed</Link>
        </Button>

        <header className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Meu perfil — {company.name}</h1>
            <p className="text-sm text-muted-foreground">Gerencie seus dados públicos e suas publicações.</p>
          </div>
          <Button asChild className="gap-2"><Link to="/rede/novo"><Plus className="h-4 w-4" /> Nova publicação</Link></Button>
        </header>

        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            {company.logo_url
              ? <img src={company.logo_url} alt={company.name} className="h-16 w-16 rounded-full object-cover bg-muted" />
              : <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">{company.name.slice(0, 2).toUpperCase()}</div>
            }
            <div className="flex-1">
              <Label>Trocar logo</Label>
              <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} className="mt-1" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea rows={3} value={company.description} onChange={(e) => setCompany({ ...company, description: e.target.value })} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={company.city} onChange={(e) => setCompany({ ...company, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp (com DDI)</Label>
              <Input value={company.whatsapp} onChange={(e) => setCompany({ ...company, whatsapp: e.target.value })} placeholder="5511999999999" />
            </div>
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input value={company.instagram} onChange={(e) => setCompany({ ...company, instagram: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Site</Label>
              <Input value={company.website} onChange={(e) => setCompany({ ...company, website: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Serviços (separe por vírgula — sem marketing)</Label>
            <Textarea rows={2} value={servicesText} onChange={(e) => setServicesText(e.target.value)} />
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </Button>
          </div>
        </Card>

        <h2 className="text-lg font-semibold mt-8 mb-3">Minhas publicações</h2>
        <div className="space-y-2">
          {posts.length === 0 && <Card className="p-6 text-center text-muted-foreground text-sm">Você ainda não publicou nada.</Card>}
          {posts.map(p => (
            <Card key={p.id} className={`p-4 ${p.is_hidden ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                <Badge variant="outline">{POST_TYPE_LABELS[p.post_type]}</Badge>
                {p.is_featured && <Badge className="bg-primary/15 text-primary border border-primary/30 gap-1"><Star className="h-3 w-3" /> Destaque</Badge>}
                {p.is_hidden && <Badge variant="outline" className="gap-1"><EyeOff className="h-3 w-3" /> Oculto</Badge>}
                <span>{new Date(p.created_at).toLocaleString('pt-BR')}</span>
              </div>
              {p.content && <p className="text-sm mt-2 whitespace-pre-wrap line-clamp-3">{p.content}</p>}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
