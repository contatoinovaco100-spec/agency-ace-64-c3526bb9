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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Plus, Flame, ExternalLink, Trash2, Settings2, Eye, Medal, RefreshCw, TrendingUp, TrendingDown, Minus, Radio } from 'lucide-react';
import { toast } from 'sonner';

interface Squad { id: string; name: string; color: string | null; }
interface ViralPost {
  id: string;
  squad_id: string;
  post_url: string;
  caption: string | null;
  views_count: number;
  previous_views: number | null;
  thumbnail_url: string | null;
  posted_at: string | null;
  created_at: string;
  auto_refresh: boolean;
  last_scraped_at: string | null;
  scrape_error: string | null;
}

export default function ViralRankingPage() {
  const [squads, setSquads] = useState<Squad[]>([]);
  const [posts, setPosts] = useState<ViralPost[]>([]);
  const [minViews, setMinViews] = useState<number>(100000);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openPost, setOpenPost] = useState(false);
  const [openCfg, setOpenCfg] = useState(false);
  const [form, setForm] = useState({
    squad_id: '', post_url: '', caption: '', views_count: '', thumbnail_url: '', posted_at: '', auto_refresh: true,
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

  // Realtime: qualquer update na tabela recarrega o ranking (o cron atualiza os posts a cada 10min)
  useEffect(() => {
    const ch = supabase
      .channel('squad_viral_posts_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'squad_viral_posts' }, () => {
        fetchAll();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Poll leve a cada 60s como fallback visual (contagem regressiva do próximo scrape)
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const resetForm = () => setForm({ squad_id: '', post_url: '', caption: '', views_count: '', thumbnail_url: '', posted_at: '', auto_refresh: true });

  const savePost = async () => {
    if (!form.squad_id) return toast.error('Escolha um squad');
    if (!form.post_url.trim()) return toast.error('Cole o link do post');
    const views = Number(form.views_count) || 0;

    const { error } = await supabase.from('squad_viral_posts' as any).insert({
      squad_id: form.squad_id,
      post_url: form.post_url.trim(),
      caption: form.caption || null,
      views_count: views,
      thumbnail_url: form.thumbnail_url || null,
      posted_at: form.posted_at || null,
      auto_refresh: form.auto_refresh,
    } as any);
    if (error) return toast.error('Erro ao salvar', { description: error.message });
    toast.success('Post cadastrado — as views serão atualizadas automaticamente a cada 10min');
    resetForm();
    setOpenPost(false);
    fetchAll();
    // dispara o primeiro scrape já
    supabase.functions.invoke('scrape-viral-views', { body: {} });
  };

  const removePost = async (id: string) => {
    if (!confirm('Remover este post?')) return;
    await supabase.from('squad_viral_posts' as any).delete().eq('id', id);
    toast.success('Removido');
    fetchAll();
  };

  const toggleAutoRefresh = async (id: string, value: boolean) => {
    await supabase.from('squad_viral_posts' as any).update({ auto_refresh: value } as any).eq('id', id);
    fetchAll();
  };

  const refreshNow = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('scrape-viral-views', { body: {} });
      if (error) throw error;
      toast.success('Views atualizadas');
      fetchAll();
    } catch (e: any) {
      toast.error('Erro ao atualizar', { description: e?.message });
    } finally {
      setRefreshing(false);
    }
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

  // Ranking geral: soma de views de TODOS posts cadastrados (disputa ao vivo)
  const liveRanking = squads.map(s => {
    const sPosts = posts.filter(p => p.squad_id === s.id);
    const totalViews = sPosts.reduce((sum, p) => sum + Number(p.views_count || 0), 0);
    const previousTotal = sPosts.reduce((sum, p) => sum + Number(p.previous_views ?? p.views_count ?? 0), 0);
    return {
      squad: s,
      postsCount: sPosts.length,
      totalViews,
      delta: totalViews - previousTotal,
      viralCount: sPosts.filter(p => p.views_count >= minViews).length,
    };
  }).sort((a, b) => b.totalViews - a.totalViews);

  const squadName = (id: string) => squads.find(s => s.id === id)?.name || '—';
  const squadColor = (id: string) => squads.find(s => s.id === id)?.color || '#BFF720';

  const medal = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;

  const lastScrape = posts
    .map(p => p.last_scraped_at ? new Date(p.last_scraped_at).getTime() : 0)
    .reduce((max, t) => Math.max(max, t), 0);
  const lastScrapeAgo = lastScrape ? Math.round((Date.now() - lastScrape) / 60000) : null;

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
          <p className="text-muted-foreground mt-1.5 text-sm flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-red-500 animate-pulse" />
              <span className="font-medium text-foreground">Disputa ao vivo</span>
            </span>
            <span>• Views atualizadas a cada <b>10 min</b> automaticamente</span>
            {lastScrapeAgo !== null && (
              <span>• Última atualização: <b>{lastScrapeAgo === 0 ? 'agora' : `${lastScrapeAgo} min atrás`}</b></span>
            )}
            <span>• Meta viral: <span className="font-semibold text-primary">{minViews.toLocaleString('pt-BR')}</span> views</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={refreshNow} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar agora
          </Button>
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
              <Button><Plus className="mr-2 h-4 w-4" />Adicionar post</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Cadastrar post na disputa</DialogTitle></DialogHeader>
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
                  <Input value={form.post_url} onChange={e => setForm({ ...form, post_url: e.target.value })} placeholder="https://www.instagram.com/p/... ou /reel/..." />
                  <p className="text-[11px] text-muted-foreground">As views serão puxadas do Instagram automaticamente a cada 10 min.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Views iniciais (opcional)</Label>
                  <Input type="number" value={form.views_count} onChange={e => setForm({ ...form, views_count: e.target.value })} placeholder="0 — deixe vazio se quiser começar do zero" />
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
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Atualização automática</p>
                    <p className="text-xs text-muted-foreground">Puxar views do IG a cada 10 min</p>
                  </div>
                  <Switch checked={form.auto_refresh} onCheckedChange={v => setForm({ ...form, auto_refresh: v })} />
                </div>
                <Button className="w-full" onClick={savePost}>Cadastrar na disputa</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="live" className="space-y-4">
        <TabsList>
          <TabsTrigger value="live" className="gap-1.5">
            <Radio className="h-3.5 w-3.5 text-red-500" />Ao vivo
          </TabsTrigger>
          <TabsTrigger value="posts">Posts ({posts.length})</TabsTrigger>
        </TabsList>

        {/* AO VIVO */}
        <TabsContent value="live" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Medal className="h-5 w-5 text-primary" />Ranking em tempo real
              </h2>
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : liveRanking.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum squad cadastrado ainda.</p>
              ) : (
                <div className="space-y-2">
                  {liveRanking.map((r, i) => {
                    const up = r.delta > 0;
                    const flat = r.delta === 0;
                    return (
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
                            {r.postsCount} {r.postsCount === 1 ? 'post' : 'posts'} • {r.viralCount} {r.viralCount === 1 ? 'viral' : 'virais'}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold tabular-nums">{r.totalViews.toLocaleString('pt-BR')}</div>
                          <div className={`text-xs flex items-center justify-end gap-1 ${up ? 'text-emerald-500' : flat ? 'text-muted-foreground' : 'text-red-500'}`}>
                            {up ? <TrendingUp className="h-3 w-3" /> : flat ? <Minus className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {flat ? 'sem alteração' : `${up ? '+' : ''}${r.delta.toLocaleString('pt-BR')} views`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* POSTS */}
        <TabsContent value="posts">
          {posts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">Nenhum post cadastrado ainda.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {posts.map(p => {
                const isViral = p.views_count >= minViews;
                const delta = Number(p.views_count) - Number(p.previous_views ?? p.views_count);
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
                        {delta > 0 && (
                          <span className="ml-auto text-xs text-emerald-500 flex items-center gap-0.5">
                            <TrendingUp className="h-3 w-3" />+{delta.toLocaleString('pt-BR')}
                          </span>
                        )}
                      </div>
                      {p.scrape_error && (
                        <p className="text-[10px] text-amber-500">⚠ {p.scrape_error}</p>
                      )}
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
                          <div className="flex items-center gap-1" title="Atualização automática">
                            <Switch checked={p.auto_refresh} onCheckedChange={v => toggleAutoRefresh(p.id, v)} />
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePost(p.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </div>
                      {p.last_scraped_at && (
                        <p className="text-[10px] text-muted-foreground">
                          Atualizado {new Date(p.last_scraped_at).toLocaleString('pt-BR')}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
