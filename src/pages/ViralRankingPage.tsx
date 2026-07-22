import { useEffect, useState, useMemo } from 'react';
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
import { Progress } from '@/components/ui/progress';
import {
  Trophy, Plus, Flame, ExternalLink, Trash2, Settings2, Eye, Medal,
  RefreshCw, TrendingUp, TrendingDown, Minus, Radio, Heart, MessageCircle,
  Clock, Zap, BarChart3, Users, Instagram
} from 'lucide-react';
import { toast } from 'sonner';

interface Squad { id: string; name: string; color: string | null; description: string | null; }
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
  like_count?: number;
  comment_count?: number;
  media_type?: string;
}

export default function ViralRankingPage() {
  const [squads, setSquads] = useState<Squad[]>([]);
  const [posts, setPosts] = useState<ViralPost[]>([]);
  const [minViews, setMinViews] = useState<number>(50000);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [openPost, setOpenPost] = useState(false);
  const [openCfg, setOpenCfg] = useState(false);
  const [form, setForm] = useState({
    squad_id: '', post_url: '', caption: '', views_count: '', thumbnail_url: '', posted_at: '', auto_refresh: true,
  });
  const [threshold, setThreshold] = useState('50000');
  const [nextScrape, setNextScrape] = useState(600);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const monthLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const fetchAll = async () => {
    const [s, p, cfg] = await Promise.all([
      supabase.from('squads').select('id,name,color,description').order('name'),
      supabase.from('squad_viral_posts' as any).select('*').gte('posted_at', monthStart).lte('posted_at', monthEnd).order('views_count', { ascending: false }),
      supabase.from('viral_settings' as any).select('*').limit(1).maybeSingle(),
    ]);
    setSquads((s.data as Squad[]) || []);
    setPosts(((p.data as any[]) || []) as ViralPost[]);
    if (cfg.data) {
      const c: any = cfg.data;
      setMinViews(Number(c.min_views) || 50000);
      setThreshold(String(c.min_views ?? 50000));
      setSettingsId(c.id);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    const ch = supabase
      .channel('squad_viral_posts_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'squad_viral_posts' }, () => {
        fetchAll();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNextScrape(v => (v <= 1 ? 600 : v - 1)), 1000);
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
    toast.success('Post cadastrado — views serão atualizadas automaticamente');
    resetForm();
    setOpenPost(false);
    fetchAll();
    supabase.functions.invoke('scrape-viral-views', { body: { post_id: undefined } });
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
      toast.success('Views atualizadas!');
      setNextScrape(600);
      fetchAll();
    } catch (e: any) {
      toast.error('Erro ao atualizar', { description: e?.message });
    } finally {
      setRefreshing(false);
    }
  };

  const autoImport = async () => {
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-import-viral', { body: {} });
      if (error) throw error;
      const count = data?.imported || 0;
      if (count > 0) {
        toast.success(`${count} post${count > 1 ? 's' : ''} importado${count > 1 ? 's' : ''} do Instagram!`);
      } else {
        toast.info('Nenhum post novo encontrado');
      }
      fetchAll();
    } catch (e: any) {
      toast.error('Erro ao importar', { description: e?.message });
    } finally {
      setImporting(false);
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

  const liveRanking = useMemo(() => squads.map(s => {
    const sPosts = posts.filter(p => p.squad_id === s.id);
    const totalViews = sPosts.reduce((sum, p) => sum + Number(p.views_count || 0), 0);
    const previousTotal = sPosts.reduce((sum, p) => sum + Number(p.previous_views ?? p.views_count ?? 0), 0);
    const totalLikes = sPosts.reduce((sum, p) => sum + Number(p.like_count || 0), 0);
    const totalComments = sPosts.reduce((sum, p) => sum + Number(p.comment_count || 0), 0);
    return {
      squad: s,
      postsCount: sPosts.length,
      totalViews,
      totalLikes,
      totalComments,
      delta: totalViews - previousTotal,
      viralCount: sPosts.filter(p => p.views_count >= minViews).length,
      topPost: sPosts[0] || null,
    };
  }).sort((a, b) => b.totalViews - a.totalViews), [squads, posts, minViews]);

  const stats = useMemo(() => ({
    totalPosts: posts.length,
    totalViews: posts.reduce((s, p) => s + Number(p.views_count || 0), 0),
    viralPosts: posts.filter(p => p.views_count >= minViews).length,
    totalLikes: posts.reduce((s, p) => s + Number(p.like_count || 0), 0),
    totalComments: posts.reduce((s, p) => s + Number(p.comment_count || 0), 0),
  }), [posts, minViews]);

  const squadName = (id: string) => squads.find(s => s.id === id)?.name || '—';
  const squadColor = (id: string) => squads.find(s => s.id === id)?.color || '#BFF720';

  const medal = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatCompact = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString('pt-BR');
  };

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            Ranking Viral
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-red-500 animate-pulse" />
              <span className="font-medium text-foreground">Ao vivo</span>
            </span>
            <span className="text-muted-foreground/60">|</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Próximo scrape em <b className="tabular-nums">{formatCountdown(nextScrape)}</b>
            </span>
            <span className="text-muted-foreground/60">|</span>
            <span>{monthLabel}</span>
            <span className="text-muted-foreground/60">|</span>
            <span>Meta: <span className="font-semibold text-primary">{minViews.toLocaleString('pt-BR')}</span> views</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={autoImport} disabled={importing}>
            <Instagram className={`mr-2 h-4 w-4 ${importing ? 'animate-pulse' : ''}`} />
            {importing ? 'Importando...' : 'Importar do IG'}
          </Button>
          <Button variant="outline" size="sm" onClick={refreshNow} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Dialog open={openCfg} onOpenChange={setOpenCfg}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Settings2 className="mr-2 h-4 w-4" />Meta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Definir meta de views</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <Label>Views mínimas para considerar viral</Label>
                <Input type="number" value={threshold} onChange={e => setThreshold(e.target.value)} />
                <Button className="w-full" onClick={saveThreshold}>Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={openPost} onOpenChange={(v) => { setOpenPost(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" />Adicionar post</Button>
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
                  <p className="text-[11px] text-muted-foreground">Views, likes e comments serão puxados automaticamente.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Views iniciais (opcional)</Label>
                  <Input type="number" value={form.views_count} onChange={e => setForm({ ...form, views_count: e.target.value })} placeholder="0" />
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
                  <Label>Descrição</Label>
                  <Textarea value={form.caption} onChange={e => setForm({ ...form, caption: e.target.value })} rows={3} placeholder="Ex: reel de humor..." />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Atualização automática</p>
                    <p className="text-xs text-muted-foreground">Puxar dados do IG a cada 10 min</p>
                  </div>
                  <Switch checked={form.auto_refresh} onCheckedChange={v => setForm({ ...form, auto_refresh: v })} />
                </div>
                <Button className="w-full" onClick={savePost}>Cadastrar na disputa</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Posts', value: stats.totalPosts, icon: Instagram, color: 'from-pink-500 to-purple-500' },
          { label: 'Views totais', value: formatCompact(stats.totalViews), icon: Eye, color: 'from-blue-500 to-cyan-500' },
          { label: 'Virais', value: stats.viralPosts, icon: Flame, color: 'from-orange-500 to-red-500' },
          { label: 'Likes', value: formatCompact(stats.totalLikes), icon: Heart, color: 'from-rose-500 to-pink-500' },
          { label: 'Comentários', value: formatCompact(stats.totalComments), icon: MessageCircle, color: 'from-emerald-500 to-teal-500' },
        ].map((s, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center flex-shrink-0`}>
                  <s.icon className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold tabular-nums truncate">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
                <Medal className="h-5 w-5 text-primary" />Ranking em tempo real
              </h2>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
                  ))}
                </div>
              ) : liveRanking.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum squad cadastrado ainda.</p>
              ) : (
                <div className="space-y-3">
                  {liveRanking.map((r, i) => {
                    const up = r.delta > 0;
                    const flat = r.delta === 0;
                    const progress = minViews > 0 ? Math.min((r.totalViews / minViews) * 100, 100) : 0;
                    return (
                      <div
                        key={r.squad.id}
                        className={`relative rounded-2xl border-2 p-5 transition-all hover:shadow-lg ${
                          i === 0 ? 'border-yellow-400/60 bg-gradient-to-r from-yellow-500/5 to-orange-500/5' :
                          i === 1 ? 'border-gray-300/60 bg-gradient-to-r from-gray-200/10 to-gray-300/5' :
                          i === 2 ? 'border-amber-600/40 bg-gradient-to-r from-amber-500/5 to-amber-600/5' :
                          'border-border bg-card/60 hover:bg-accent/20'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-3xl w-12 text-center font-bold">{medal(i)}</div>
                          <div
                            className="h-12 w-12 rounded-xl flex-shrink-0 shadow-md"
                            style={{ background: r.squad.color || '#BFF720' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-lg truncate">{r.squad.name}</p>
                              {r.viralCount > 0 && (
                                <Badge className="bg-orange-500/15 text-orange-500 border-orange-500/20 gap-1 text-[10px]">
                                  <Flame className="h-3 w-3" />{r.viralCount}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {r.postsCount} {r.postsCount === 1 ? 'post' : 'posts'}
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Heart className="h-3 w-3" />{formatCompact(r.totalLikes)}
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <MessageCircle className="h-3 w-3" />{formatCompact(r.totalComments)}
                              </span>
                            </div>
                            <div className="mt-2.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-muted-foreground">Progresso viral</span>
                                <span className="text-[10px] font-medium">{Math.round(progress)}%</span>
                              </div>
                              <Progress value={progress} className="h-2" />
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-3xl font-black tabular-nums tracking-tight">{formatCompact(r.totalViews)}</div>
                            <div className={`text-xs flex items-center justify-end gap-1 font-medium ${up ? 'text-emerald-500' : flat ? 'text-muted-foreground' : 'text-red-500'}`}>
                              {up ? <TrendingUp className="h-3 w-3" /> : flat ? <Minus className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {flat ? 'sem alteração' : `${up ? '+' : ''}${formatCompact(r.delta)}`}
                            </div>
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
            <Card>
              <CardContent className="py-16 text-center">
                <Instagram className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Nenhum post cadastrado ainda.</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Adicione posts pra começar a disputa</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {posts.map(p => {
                const isViral = p.views_count >= minViews;
                const delta = Number(p.views_count) - Number(p.previous_views ?? p.views_count);
                const progress = minViews > 0 ? Math.min((p.views_count / minViews) * 100, 100) : 0;
                return (
                  <Card key={p.id} className={`overflow-hidden transition-all hover:shadow-md ${
                    isViral ? 'border-primary/40 ring-1 ring-primary/20' : ''
                  }`}>
                    {/* Thumbnail */}
                    {p.thumbnail_url ? (
                      <div className="relative h-40 overflow-hidden">
                        <img
                          src={p.thumbnail_url}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        {isViral && (
                          <Badge className="absolute top-2 right-2 bg-orange-500 text-white border-0 gap-1 text-[10px] shadow-lg">
                            <Flame className="h-3 w-3" />VIRAL
                          </Badge>
                        )}
                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ background: squadColor(p.squad_id) }} />
                            <span className="text-xs font-semibold text-white drop-shadow">{squadName(p.squad_id)}</span>
                          </div>
                          {p.media_type && (
                            <Badge variant="secondary" className="text-[9px] bg-black/40 text-white border-0 backdrop-blur-sm">
                              {p.media_type === 'VIDEO' ? 'Reel' : p.media_type === 'CAROUSEL_ALBUM' ? 'Carousel' : 'Post'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="relative h-24 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                        <Instagram className="h-10 w-10 text-muted-foreground/20" />
                        {isViral && (
                          <Badge className="absolute top-2 right-2 bg-orange-500 text-white border-0 gap-1 text-[10px]">
                            <Flame className="h-3 w-3" />VIRAL
                          </Badge>
                        )}
                        <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ background: squadColor(p.squad_id) }} />
                          <span className="text-xs font-semibold">{squadName(p.squad_id)}</span>
                        </div>
                      </div>
                    )}
                    <CardContent className="p-4 space-y-3">
                      {/* Views */}
                      <div className="flex items-baseline gap-2">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        <span className="text-2xl font-black tabular-nums">{formatCompact(p.views_count)}</span>
                        <span className="text-xs text-muted-foreground">views</span>
                        {delta > 0 && (
                          <span className="ml-auto text-xs text-emerald-500 font-medium flex items-center gap-0.5">
                            <TrendingUp className="h-3 w-3" />+{formatCompact(delta)}
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground">Progresso viral</span>
                          <span className="text-[10px] font-medium">{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3" />{(p.like_count || 0).toLocaleString('pt-BR')}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />{(p.comment_count || 0).toLocaleString('pt-BR')}
                        </span>
                      </div>

                      {p.scrape_error && (
                        <p className="text-[10px] text-amber-500 bg-amber-500/10 rounded-md px-2 py-1">⚠ {p.scrape_error}</p>
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
                          <Switch checked={p.auto_refresh} onCheckedChange={v => toggleAutoRefresh(p.id, v)} />
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
