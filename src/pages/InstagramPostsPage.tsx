import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Instagram, ExternalLink, Edit2, Copy, GripVertical, Eye, AlertTriangle, CheckCircle2, BarChart3, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { InstagramEmbed } from '@/components/InstagramEmbed';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  const [urlError, setUrlError] = useState('');

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
    setUrlError('');
  };

  const validateUrl = (url: string) => {
    if (!url.trim()) {
      setUrlError('');
      return;
    }
    if (!IG_URL_REGEX.test(url.trim())) {
      setUrlError('URL inválida. Use o formato: instagram.com/p/ABC123/ ou /reel/ABC123/');
    } else {
      setUrlError('');
    }
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
      toast.success('Post atualizado com sucesso');
    } else {
      // Verifica duplicata
      const cleanUrl = url.split('?')[0].replace(/\/$/, '');
      const duplicated = posts.some(p => p.post_url.split('?')[0].replace(/\/$/, '') === cleanUrl);
      if (duplicated) {
        toast.error('Este post já foi adicionado à vitrine');
        return;
      }
      const { error } = await supabase.from('instagram_posts' as any).insert({
        post_url: url,
        strategic_description: form.strategic_description,
        post_result: form.post_result,
        sort_order: posts.length,
      } as any);
      if (error) { toast.error('Erro ao adicionar', { description: error.message }); return; }
      toast.success('Post adicionado à vitrine!');
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = posts.findIndex((p) => p.id === active.id);
    const newIndex = posts.findIndex((p) => p.id === over.id);

    const newPosts = arrayMove(posts, oldIndex, newIndex);
    setPosts(newPosts);

    const updates = newPosts.map((p, i) => ({
      id: p.id,
      sort_order: i,
    }));

    try {
      for (const update of updates) {
        await supabase.from('instagram_posts' as any).update({ sort_order: update.sort_order } as any).eq('id', update.id);
      }
    } catch (err) {
      toast.error('Erro ao salvar nova ordem');
    }
  };

  const postsWithStrategy = posts.filter(p => p.strategic_description);
  const postsWithResult = posts.filter(p => p.post_result);

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Instagram className="h-5 w-5 text-white" />
            </div>
            Posts do Instagram
          </h1>
          <p className="text-muted-foreground mt-1.5">
            Gerencie os posts públicos exibidos na sua vitrine de portfólio.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => {
              const url = `${window.location.origin}/vitrine`;
              navigator.clipboard.writeText(url);
              toast.success('Link copiado!', { description: url });
            }}
          >
            <Copy className="mr-2 h-4 w-4" />Copiar link
          </Button>
          <a href="/vitrine" target="_blank" rel="noreferrer">
            <Button variant="outline"><Eye className="mr-2 h-4 w-4" />Ver Vitrine</Button>
          </a>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="shadow-lg shadow-primary/20 transition-all hover:scale-105">
                <Plus className="mr-2 h-4 w-4" />Adicionar post
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl flex items-center gap-2">
                  {editingId ? <Edit2 className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                  {editingId ? 'Editar post' : 'Adicionar post do Instagram'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 py-2">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">URL do post *</Label>
                  <Input
                    value={form.post_url}
                    onChange={e => {
                      setForm({ ...form, post_url: e.target.value });
                      validateUrl(e.target.value);
                    }}
                    placeholder="https://www.instagram.com/p/ABC123/"
                    className={`h-11 ${urlError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  />
                  {urlError ? (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                      <AlertTriangle className="h-3 w-3" /> {urlError}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      Aceita posts, reels e IGTV. O perfil deve ser público.
                    </p>
                  )}
                </div>

                <div className="border-t pt-4 space-y-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <BarChart3 className="h-3.5 w-3.5" /> Contexto de marketing (opcional)
                  </p>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">Descrição estratégica</Label>
                    <Textarea
                      value={form.strategic_description}
                      onChange={e => setForm({ ...form, strategic_description: e.target.value })}
                      placeholder="Ex: Campanha de lançamento focada em desejo e prova social..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">Resultado do post</Label>
                    <Textarea
                      value={form.post_result}
                      onChange={e => setForm({ ...form, post_result: e.target.value })}
                      placeholder="Ex: +30k visualizações, 2.5k novos seguidores em 48h..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                </div>

                <Button className="w-full h-11 text-sm font-semibold" onClick={handleSave}>
                  {editingId ? 'Salvar alterações' : 'Adicionar à vitrine'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Total de Posts</p>
              <p className="text-3xl font-bold text-foreground mt-1">{posts.length}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Com Estratégia</p>
              <p className="text-3xl font-bold text-purple-500 mt-1">{postsWithStrategy.length}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Com Resultados</p>
              <p className="text-3xl font-bold text-emerald-500 mt-1">{postsWithResult.length}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Completude</p>
              <p className="text-3xl font-bold text-primary mt-1">
                {posts.length > 0 ? Math.round((postsWithStrategy.length / posts.length) * 100) : 0}%
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl border border-border/50 bg-muted/30 p-4 text-sm text-muted-foreground flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <AlertTriangle className="h-4 w-4 text-blue-500" />
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm">Sobre os dados exibidos</p>
          <p className="text-xs mt-1">
            Esta funcionalidade usa o embed oficial do Instagram, exibindo apenas dados públicos
            (mídia, perfil, legenda, curtidas e comentários quando disponíveis). Métricas privadas como
            alcance, impressões e conversões não estão incluídas.
          </p>
        </div>
      </div>

      {/* Posts Grid */}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-2xl bg-muted/30 animate-pulse h-[500px]" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-muted-foreground"
        >
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-400/10 flex items-center justify-center mb-5">
            <Instagram className="h-10 w-10 opacity-40" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Nenhum post adicionado ainda</h3>
          <p className="text-sm mt-1.5 max-w-sm text-center">
            Cole o link de um post público do Instagram para começar a montar sua vitrine de portfólio.
          </p>
          <Button className="mt-6" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar primeiro post
          </Button>
        </motion.div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={posts.map(p => p.id)} strategy={rectSortingStrategy}>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <SortableInstagramPost
                  key={post.id}
                  post={post}
                  handleEdit={handleEdit}
                  handleDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableInstagramPost({
  post, handleEdit, handleDelete
}: {
  post: InstagramPost;
  handleEdit: (post: InstagramPost) => void;
  handleDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: post.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className="overflow-hidden rounded-2xl border-border/50 shadow-sm hover:shadow-md transition-all group relative">
      <div 
        {...attributes} 
        {...listeners} 
        className="absolute top-2 left-2 z-10 p-1.5 bg-black/60 text-white rounded-md cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="bg-muted/30 p-3 flex items-center justify-center min-h-[380px]">
        <InstagramEmbed url={post.post_url} />
      </div>

      <CardContent className="p-5 space-y-4">
        {/* Strategy & Result badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {post.strategic_description && (
            <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider gap-1">
              <BarChart3 className="h-3 w-3" /> Estratégia
            </Badge>
          )}
          {post.post_result && (
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] uppercase font-bold tracking-wider gap-1">
              <TrendingUp className="h-3 w-3" /> Resultado
            </Badge>
          )}
        </div>

        {post.strategic_description && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Estratégia
            </p>
            <p className="text-sm text-foreground leading-relaxed line-clamp-3">{post.strategic_description}</p>
          </div>
        )}
        {post.post_result && (
          <div className={post.strategic_description ? 'pt-3 border-t border-border/40' : ''}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1">
              Resultado
            </p>
            <p className="text-sm text-foreground leading-relaxed line-clamp-3">{post.post_result}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border/40">
          <a
            href={post.post_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5 font-medium transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Ver no Instagram
          </a>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(post)} title="Editar">
              <Edit2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(post.id)} title="Remover">
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-muted-foreground/60 leading-tight">
          Este conteúdo exibe apenas dados públicos do Instagram. Métricas como alcance, impressões e conversões não estão incluídas.
        </p>
      </CardContent>
    </Card>
  );
}
