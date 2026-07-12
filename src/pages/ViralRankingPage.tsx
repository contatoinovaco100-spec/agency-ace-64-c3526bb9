import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trophy, Plus, Flame, ExternalLink, Trash2, Settings2, Eye, Medal } from 'lucide-react';
import { toast } from 'sonner';

interface Squad { id: string; name: string; color: string | null; }
interface ViralPost {
  id: string;
  squad_id: string;
  post_url: string;
  caption: string | null;
  views_count: number;
  thumbnail_url: string | null;
  posted_at: string | null;
  created_at: string;
}

export default function ViralRankingPage() {
  const [squads, setSquads] = useState<Squad[]>([]);
  const [posts, setPosts] = useState<ViralPost[]>([]);
  const [minViews, setMinViews] = useState<number>(100000);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openPost, setOpenPost] = useState(false);
  const [openCfg, setOpenCfg] = useState(false);
  const [form, setForm] = useState({
    squad_id: '', post_url: '', caption: '', views_count: '', thumbnail_url: '', posted_at: '',
  });
  const [threshold, setThreshold] = useState('100000');

  const fetchAll = async () => {
    const [s, p, cfg] = await Promise.all([
      supabase.from('squads').select('id,name,color').order('name'),
      supabase.from('squad_viral_posts' as any).select('*').order('views_count', { ascending: false }),
      supabase.from('viral_settings' as any).select('*').limit(1).maybeSingle(),
    ]);
    setSquads((s.data as Squad[]) || []);
    setPosts(((p.data as any[]) || []) as ViralPost[]);
    if (cfg.data) {
      const c: any = cfg.data;
      setMinViews(Number(c.min_views) || 100000);
      setThreshold(String(c.min_views ?? 100000));
      setSettingsId(c.id);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const resetForm = () => setForm({ squad_id: '', post_url: '', caption: '', views_count: '', thumbnail_url: '', posted_at: '' });

  const savePost = async () => {
    if (!form.squad_id) return toast.error('Escolha um squad');
    if (!form.post_url.trim()) return toast.error('Cole o link do post');
    const views = Number(form.views_count);
    if (!views || views < 0) return toast.error('Informe a quantidade de views');

    const { error } = await supabase.from('squad_viral_posts' as any).insert({
      squad_id: form.squad_id,
      post_url: form.post_url.trim(),
      caption: form.caption || null,
      views_count: views,
      thumbnail_url: form.thumbnail_url || null,
      posted_at: form.posted_at || null,
    } as any);
    if (error) return toast.error('Erro ao salvar', { description: error.message });
    if (views < minViews) {
      toast.warning('Post salvo — mas ainda não atingiu a meta viral', {
        description: `Meta atual: ${minViews.toLocaleString('pt-BR')} views.`,
      });
    } else {
      toast.success('🔥 Post viral registrado!');
    }
    resetForm();
    setOpenPost(false);
    fetchAll();
  };

  const removePost = async (id: string) => {
    if (!confirm('Remover este post?')) return;
    await supabase.from('squad_viral_posts' as any).delete().eq('id', id);
    toast.success('Removido');
    fetchAll();
  };

  const saveThreshold = async () => {
    const v = Number(threshold);
    if (!v || v < 1) return toast.error('Meta inválida');
    if (settingsId) {
      const { error } = await supabase.from('viral_settings' as any).update({ min_views: v } as any).eq('id', settingsId);
      if (error) return toast.error('Erro', { description: error.message });
    } else {
      const { error } = await supabase.from('viral_settings' as any).insert({ min_views: v } as any);
      if (error) return toast.error('Erro', { description: error.message });
    }
    toast.success('Meta atualizada');
    setOpenCfg(false);
    fetchAll();
  };

  // Ranking: apenas posts que atingiram o mínimo contam
  const viralPosts = posts.filter(p => p.views_count >= minViews);
  const ranking = squads.map(s => {
    const sPosts = viralPosts.filter(p => p.squad_id === s.id);
    return {
      squad: s,
      viralCount: sPosts.length,
      totalViews: sPosts.reduce((sum, p) => sum + Number(p.views_count || 0), 0),
    };
  })
  .sort((a, b) => b.viralCount - a.viralCount || b.totalViews - a.totalViews);

  const squadName = (id: string) => squads.find(s => s.id === id)?.name || '—';
  const squadColor = (id: string) => squads.find(s => s.id === id)?.color || '#BFF720';

  const medal = (i: number) =>
    i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            Ranking Viral dos Squads
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Meta atual: <span className="font-semibold text-primary">{minViews.toLocaleString('pt-BR')}</span> views para um post ser considerado viral.
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openCfg} onOpenChange={setOpenCfg}>
            <DialogTrigger asChild>
              <Button variant="outline"><Settings2 className="mr-2 h-4 w-4" />Meta de views</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Definir meta de views</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <Label>Views mínimos para considerar viral</Label>
                <Input type="number" value={threshold} onChange={e => setThreshold(e.target.value)} />
                <Button className="w-full" onClick={saveThreshold}>Salvar meta</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={openPost} onOpenChange={(v) => { setOpenPost(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Adicionar post viral</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Registrar post viral</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Squad *</Label>
                  <Select value={form.squad_id} onValueChange={v => setForm({ ...form, squad_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o squad" /></SelectTrigger>
                    <SelectContent>
                      {squads.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Link do post no Instagram *</Label>
                  <Input value={form.post_url} onChange={e => setForm({ ...form, post_url: e.target.value })} placeholder="https://www.instagram.com/p/..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Quantidade de views *</Label>
                  <Input type="number" value={form.views_count} onChange={e => setForm({ ...form, views_count: e.target.value })} placeholder="Ex: 250000" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Data do post</Label>
                    <Input type="date" value={form.posted_at} onChange={e => setForm({ ...form, posted_at: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Thumb (URL)</Label>
                    <Input value={form.thumbnail_url} onChange={e => setForm({ ...form, thumbnail_url: e.target.value })} placeholder="opcional" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição / observação</Label>
                  <Textarea value={form.caption} onChange={e => setForm({ ...form, caption: e.target.value })} rows={3} placeholder="Ex: reel de humor com cliente X..." />
                </div>
                <Button className="w-full" onClick={savePost}>Registrar post</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Ranking */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Medal className="h-5 w-5 text-primary" />Ranking</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum squad cadastrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {ranking.map((r, i) => (
                <div
                  key={r.squad.id}
                  className="flex items-center gap-4 p-4 rounded-xl border bg-card/60 hover:bg-accent/30 transition"
                >
                  <div className="text-2xl w-10 text-center">{medal(i)}</div>
                  <div
                    className="h-10 w-10 rounded-lg flex-shrink-0"
                    style={{ background: r.squad.color || '#BFF720' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{r.squad.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.totalViews.toLocaleString('pt-BR')} views totais em posts virais
                    </p>
                  </div>
                  <Badge className="gap-1 bg-primary/15 text-primary border-primary/20">
                    <Flame className="h-3.5 w-3.5" /> {r.viralCount} {r.viralCount === 1 ? 'viral' : 'virais'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Posts */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />Posts registrados ({posts.length})
        </h2>
        {posts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Nenhum post registrado ainda.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {posts.map(p => {
              const isViral = p.views_count >= minViews;
              return (
                <Card key={p.id} className={isViral ? 'border-primary/40' : ''}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: squadColor(p.squad_id) }} />
                        <span className="text-sm font-semibold truncate">{squadName(p.squad_id)}</span>
                      </div>
                      {isViral && (
                        <Badge className="bg-primary/15 text-primary border-primary/20 gap-1 text-[10px]">
                          <Flame className="h-3 w-3" />VIRAL
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span className="text-2xl font-bold">{Number(p.views_count).toLocaleString('pt-BR')}</span>
                      <span className="text-xs text-muted-foreground">views</span>
                    </div>
                    {p.caption && <p className="text-xs text-muted-foreground line-clamp-2">{p.caption}</p>}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <a
                        href={p.post_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />Ver post
                      </a>
                      <div className="flex items-center gap-2">
                        {p.posted_at && <span className="text-[10px] text-muted-foreground">{new Date(p.posted_at).toLocaleDateString('pt-BR')}</span>}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePost(p.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
