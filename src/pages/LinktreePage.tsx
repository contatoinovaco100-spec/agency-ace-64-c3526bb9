import { useEffect, useState } from 'react';
import { Link2, Plus, Trash2, Eye, ExternalLink, Loader2, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface LinktreeRow {
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

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);

export default function LinktreePage() {
  const [linktrees, setLinktrees] = useState<LinktreeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkCounts, setLinkCounts] = useState<Record<string, number>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ display_name: '', slug: '', bio: '' });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: lts } = await supabase.from('linktrees').select('*').order('created_at', { ascending: true });
    const list = (lts as LinktreeRow[]) || [];
    setLinktrees(list);

    if (list.length > 0) {
      const { data: links } = await supabase
        .from('linktree_links')
        .select('linktree_id')
        .in(
          'linktree_id',
          list.map((l) => l.id),
        );
      const counts: Record<string, number> = {};
      (links || []).forEach((l: { linktree_id: string }) => {
        counts[l.linktree_id] = (counts[l.linktree_id] || 0) + 1;
      });
      setLinkCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createLinktree = async () => {
    if (!form.display_name.trim()) {
      toast.error('Informe um nome');
      return;
    }
    const finalSlug = slugify(form.slug || form.display_name);
    if (!finalSlug) {
      toast.error('Slug inválido');
      return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .from('linktrees')
      .insert({
        display_name: form.display_name.trim(),
        slug: finalSlug,
        bio: form.bio.trim(),
      })
      .select()
      .single();
    setCreating(false);
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Esse slug já existe' : 'Erro ao criar');
      return;
    }
    toast.success('Linktree criado!');
    setCreateOpen(false);
    setForm({ display_name: '', slug: '', bio: '' });
    setLinktrees((arr) => [...arr, data as LinktreeRow]);
  };

  const removeLinktree = async (id: string, name: string) => {
    if (!confirm(`Remover o linktree "${name}"? Todos os links também serão apagados.`)) return;
    const { error } = await supabase.from('linktrees').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao remover');
      return;
    }
    setLinktrees((arr) => arr.filter((l) => l.id !== id));
    toast.success('Removido');
  };

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
            <Link2 className="h-6 w-6 text-primary" /> Linktrees
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie linktrees personalizados — um para a INOVA e um para cada cliente
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Novo Linktree
        </Button>
      </div>

      {linktrees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Link2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">Nenhum linktree ainda.</p>
          <Button onClick={() => setCreateOpen(true)}>Criar o primeiro</Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {linktrees.map((lt) => (
            <div
              key={lt.id}
              className="rounded-xl border border-border bg-card overflow-hidden group hover:border-primary/50 transition-all"
            >
              {/* Preview header with theme colors */}
              <div
                className="h-28 flex items-center justify-center relative"
                style={{ background: lt.bg_color }}
              >
                {lt.avatar_url ? (
                  <img src={lt.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover ring-2" style={{ boxShadow: `0 0 0 3px ${lt.button_color}80` }} />
                ) : (
                  <div
                    className="h-16 w-16 rounded-full flex items-center justify-center text-3xl ring-2"
                    style={{ background: `${lt.button_color}30`, boxShadow: `0 0 0 3px ${lt.button_color}80` }}
                  >
                    {lt.avatar_emoji}
                  </div>
                )}
                <Badge className="absolute top-2 right-2 bg-black/40 text-white border-0 text-xs">
                  /{lt.slug}
                </Badge>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-foreground truncate">{lt.display_name}</h3>
                  {lt.bio && <p className="text-xs text-muted-foreground truncate">{lt.bio}</p>}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{linkCounts[lt.id] || 0} links</span>
                  <span className="capitalize">{lt.theme}</span>
                </div>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="default" className="flex-1">
                    <Link to={`/linktree/${lt.id}`} className="flex items-center gap-1">
                      <Pencil className="h-3 w-3" /> Editar
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={`/links/${lt.slug}`} target="_blank" rel="noopener noreferrer" title="Abrir página pública">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removeLinktree(lt.id, lt.display_name)}
                    className="text-destructive hover:bg-destructive/10"
                    title="Remover"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Linktree</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Nome / Cliente</Label>
              <Input
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value, slug: f.slug || slugify(e.target.value) }))}
                placeholder="Ex: Empresa XYZ"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Slug (URL)</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">/links/</span>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                  placeholder="empresa-xyz"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Bio (opcional)</Label>
              <Input value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} placeholder="Descrição curta" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createLinktree} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
