import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Instagram, ExternalLink, Edit2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { InstagramEmbed } from '@/components/InstagramEmbed';

interface InstagramPost {
  id: string;
  post_url: string;
  strategic_description: string;
  post_result: string;
  sort_order: number;
  created_at: string;
}

const IG_URL_REGEX = /^https?:\/\/(www\.)?instagram\.com\/(p|reel|reels|tv)\/[\w-]+/i;

export default function InstagramPostsPage() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ post_url: '', strategic_description: '', post_result: '' });

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('instagram_posts' as any)
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    setPosts((data as any[] as InstagramPost[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  const resetForm = () => {
    setForm({ post_url: '', strategic_description: '', post_result: '' });
    setEditingId(null);
  };

  const handleSave = async () => {
    const url = form.post_url.trim();
    if (!url) {
      toast.error('Cole a URL do post do Instagram');
      return;
    }
    if (!IG_URL_REGEX.test(url)) {
      toast.error('URL inválida', { description: 'Use um link no formato instagram.com/p/... ou /reel/...' });
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from('instagram_posts' as any)
        .update({
          post_url: url,
          strategic_description: form.strategic_description,
          post_result: form.post_result,
        } as any)
        .eq('id', editingId);
      if (error) { toast.error('Erro ao atualizar', { description: error.message }); return; }
      toast.success('Post atualizado');
    } else {
      // Verifica duplicata
      const cleanUrl = url.split('?')[0].replace(/\/$/, '');
      const duplicated = posts.some(p => p.post_url.split('?')[0].replace(/\/$/, '') === cleanUrl);
      if (duplicated) {
        toast.error('Este post já foi adicionado');
        return;
      }
      const { error } = await supabase.from('instagram_posts' as any).insert({
        post_url: url,
        strategic_description: form.strategic_description,
        post_result: form.post_result,
        sort_order: posts.length,
      } as any);
      if (error) { toast.error('Erro ao adicionar', { description: error.message }); return; }
      toast.success('Post adicionado à vitrine');
    }

    resetForm();
    setOpen(false);
    fetchPosts();
  };

  const handleEdit = (post: InstagramPost) => {
    setEditingId(post.id);
    setForm({
      post_url: post.post_url,
      strategic_description: post.strategic_description,
      post_result: post.post_result,
    });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este post da vitrine?')) return;
    await supabase.from('instagram_posts' as any).delete().eq('id', id);
    toast.success('Post removido');
    fetchPosts();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Instagram className="h-6 w-6 text-[#bff720]" />
            Posts do Instagram
          </h1>
          <p className="text-sm text-muted-foreground">
            Adicione posts públicos do Instagram à vitrine — exibe mídia, perfil, legenda e métricas via embed oficial
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const url = `${window.location.origin}/vitrine`;
              navigator.clipboard.writeText(url);
              toast.success('Link copiado!', { description: url });
            }}
          >
            <Copy className="mr-2 h-4 w-4" />Copiar link da LP
          </Button>
          <a href="/vitrine" target="_blank" rel="noreferrer">
            <Button variant="outline"><ExternalLink className="mr-2 h-4 w-4" />Ver LP</Button>
          </a>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Adicionar post</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Editar post' : 'Adicionar post do Instagram'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>URL do post *</Label>
                  <Input
                    value={form.post_url}
                    onChange={e => setForm({ ...form, post_url: e.target.value })}
                    placeholder="https://www.instagram.com/p/ABC123/"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Aceita posts, reels e IGTV. O perfil deve ser público.
                  </p>
                </div>
                <div>
                  <Label>Descrição estratégica (opcional)</Label>
                  <Textarea
                    value={form.strategic_description}
                    onChange={e => setForm({ ...form, strategic_description: e.target.value })}
                    placeholder="Ex: Campanha de lançamento focada em desejo e prova social..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Resultado do post (opcional)</Label>
                  <Textarea
                    value={form.post_result}
                    onChange={e => setForm({ ...form, post_result: e.target.value })}
                    placeholder="Ex: +30k visualizações, 2.5k novos seguidores em 48h..."
                    rows={3}
                  />
                </div>
                <Button className="w-full" onClick={handleSave}>
                  {editingId ? 'Salvar alterações' : 'Adicionar à vitrine'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <strong className="text-foreground">ℹ️ Sobre os dados exibidos:</strong> Esta funcionalidade usa o embed
        oficial do Instagram, que exibe apenas dados públicos (mídia, perfil, legenda, curtidas e comentários quando
        disponíveis). Métricas privadas como alcance, impressões e conversões não estão incluídas.
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Instagram className="h-12 w-12 mb-3 opacity-40" />
          <p>Nenhum post adicionado ainda</p>
          <p className="text-xs mt-1">Cole o link de um post público do Instagram para começar</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map(post => (
            <Card key={post.id} className="overflow-hidden">
              <div className="bg-muted/50 p-3 flex items-center justify-center">
                <InstagramEmbed url={post.post_url} />
              </div>
              <CardContent className="p-4 space-y-3">
                {post.strategic_description && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Estratégia
                    </p>
                    <p className="text-sm text-foreground mt-1">{post.strategic_description}</p>
                  </div>
                )}
                {post.post_result && (
                  <div>
                    <p className="text-xs font-semibold text-[#bff720] uppercase tracking-wide">
                      Resultado
                    </p>
                    <p className="text-sm text-foreground mt-1">{post.post_result}</p>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t">
                  <a
                    href={post.post_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" /> Abrir no Instagram
                  </a>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(post)}
                      className="p-1.5 rounded hover:bg-muted"
                      title="Editar"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="p-1.5 rounded hover:bg-muted"
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
