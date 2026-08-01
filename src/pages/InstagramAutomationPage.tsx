import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Instagram, Plus, Trash2, Loader2, CheckCircle2, Copy, Download,
  Image as ImageIcon, Film, Layers, RefreshCw, X, ExternalLink, Clock, ListChecks,
} from 'lucide-react';
import { toast } from 'sonner';

interface QueueAccount {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string;
  active: boolean;
}

interface QueuePost {
  id: string;
  account_id: string;
  caption: string;
  media_urls: string[];
  media_paths: string[];
  media_type: string;
  scheduled_at: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
}

type MediaType = 'IMAGE' | 'REELS' | 'CAROUSEL';
interface LocalMedia { file: File; preview: string; isVideo: boolean }

const typeMeta: Record<MediaType, { label: string; icon: any; hint: string; accept: string }> = {
  IMAGE: { label: 'Feed', icon: ImageIcon, hint: '1 imagem para o feed.', accept: 'image/*' },
  REELS: { label: 'Reels', icon: Film, hint: '1 vídeo vertical.', accept: 'video/*' },
  CAROUSEL: { label: 'Carrossel', icon: Layers, hint: 'De 2 a 10 mídias.', accept: 'image/*,video/*' },
};

export default function InstagramAutomationPage() {
  const [accounts, setAccounts] = useState<QueueAccount[]>([]);
  const [posts, setPosts] = useState<QueuePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('IMAGE');
  const [medias, setMedias] = useState<LocalMedia[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');

  const [accOpen, setAccOpen] = useState(false);
  const [accForm, setAccForm] = useState({ handle: '', display_name: '' });

  const load = useCallback(async () => {
    const [{ data: accs }, { data: qp }] = await Promise.all([
      supabase.from('ig_queue_accounts' as any).select('*').order('handle'),
      supabase.from('ig_queue_posts' as any).select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    setAccounts((accs as any) || []);
    setPosts((qp as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ---------------- Contas ---------------- */
  const addAccount = async () => {
    const handle = accForm.handle.trim().replace(/^@/, '');
    if (!handle) { toast.error('Informe o @ da conta'); return; }
    if (accounts.some(a => a.handle.toLowerCase() === handle.toLowerCase())) {
      toast.error('Essa conta já está cadastrada'); return;
    }
    const { error } = await supabase.from('ig_queue_accounts' as any).insert({
      handle, display_name: accForm.display_name.trim(),
    } as any);
    if (error) { toast.error('Erro ao salvar', { description: error.message }); return; }
    toast.success(`@${handle} adicionada`);
    setAccForm({ handle: '', display_name: '' });
    setAccOpen(false);
    load();
  };

  const removeAccount = async (a: QueueAccount) => {
    if (!confirm(`Remover @${a.handle} e os posts pendentes dela?`)) return;
    await supabase.from('ig_queue_accounts' as any).delete().eq('id', a.id);
    setSelected(s => s.filter(x => x !== a.id));
    toast.success('Conta removida');
    load();
  };

  /* ---------------- Mídia ---------------- */
  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const max = mediaType === 'CAROUSEL' ? 10 : 1;
    const next: LocalMedia[] = [];
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith('video');
      if (mediaType === 'IMAGE' && isVideo) { toast.error('Feed aceita apenas imagem'); continue; }
      if (mediaType === 'REELS' && !isVideo) { toast.error('Reels aceita apenas vídeo'); continue; }
      next.push({ file, preview: URL.createObjectURL(file), isVideo });
    }
    setMedias(prev => [...prev, ...next].slice(0, max));
  };

  const changeType = (t: MediaType) => { setMediaType(t); setMedias([]); };

  /* ---------------- Fila ---------------- */
  const addToQueue = async () => {
    if (!selected.length) { toast.error('Selecione ao menos uma conta'); return; }
    if (!medias.length) { toast.error('Envie ao menos uma mídia'); return; }

    setSaving(true);
    try {
      const urls: string[] = [];
      const paths: string[] = [];
      for (const m of medias) {
        const ext = m.file.name.split('.').pop() || (m.isVideo ? 'mp4' : 'jpg');
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('instagram-media')
          .upload(path, m.file, { contentType: m.file.type, upsert: false });
        if (upErr) throw new Error(`Falha no upload: ${upErr.message}`);
        const { data: signed } = await supabase.storage
          .from('instagram-media')
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        urls.push(signed?.signedUrl || '');
        paths.push(path);
      }

      const rows = selected.map(id => ({
        account_id: id,
        caption,
        media_urls: urls,
        media_paths: paths,
        media_type: mediaType,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        status: 'pendente',
      }));

      const { error } = await supabase.from('ig_queue_posts' as any).insert(rows as any);
      if (error) throw new Error(error.message);

      toast.success(`Adicionado à fila para ${selected.length} conta(s)`);
      setMedias([]);
      setCaption('');
      setScheduledAt('');
      load();
    } catch (e) {
      toast.error('Erro', { description: e instanceof Error ? e.message : 'erro' });
    } finally {
      setSaving(false);
    }
  };

  const markPublished = async (post: QueuePost, done: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('ig_queue_posts' as any).update({
      status: done ? 'publicado' : 'pendente',
      published_at: done ? new Date().toISOString() : null,
      published_by: done ? user?.id : null,
    } as any).eq('id', post.id);
    setPosts(p => p.map(x => x.id === post.id
      ? { ...x, status: done ? 'publicado' : 'pendente', published_at: done ? new Date().toISOString() : null }
      : x));
  };

  const deletePost = async (post: QueuePost) => {
    if (!confirm('Remover este item da fila?')) return;
    await supabase.from('ig_queue_posts' as any).delete().eq('id', post.id);
    setPosts(p => p.filter(x => x.id !== post.id));
    toast.success('Removido da fila');
  };

  const copyCaption = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Legenda copiada');
  };

  const downloadMedia = async (post: QueuePost) => {
    try {
      for (let i = 0; i < post.media_paths.length; i++) {
        const path = post.media_paths[i];
        const { data, error } = await supabase.storage.from('instagram-media').download(path);
        if (error || !data) throw new Error(error?.message || 'falha');
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = path;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      toast.success('Download iniciado');
    } catch (e) {
      toast.error('Erro no download', { description: e instanceof Error ? e.message : 'erro' });
    }
  };

  const accountOf = (id: string) => accounts.find(a => a.id === id);
  const pending = posts.filter(p => p.status === 'pendente');
  const published = posts.filter(p => p.status === 'publicado');

  const renderPost = (post: QueuePost) => {
    const acc = accountOf(post.account_id);
    const done = post.status === 'publicado';
    return (
      <Card key={post.id} className={done ? 'opacity-70' : ''}>
        <CardContent className="p-4 flex flex-col md:flex-row gap-4">
          {post.media_urls[0] && (
            <div className="h-24 w-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              {/\.(mp4|mov|webm|m4v)/i.test(post.media_urls[0])
                ? <video src={post.media_urls[0]} className="h-full w-full object-cover" muted />
                : <img src={post.media_urls[0]} alt="" className="h-full w-full object-cover" />}
            </div>
          )}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">@{acc?.handle || '—'}</span>
              <Badge variant="secondary" className="text-[10px]">{typeMeta[post.media_type as MediaType]?.label || post.media_type}</Badge>
              {post.media_urls.length > 1 && <Badge variant="outline" className="text-[10px]">{post.media_urls.length} mídias</Badge>}
              {post.scheduled_at && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />{new Date(post.scheduled_at).toLocaleString('pt-BR')}
                </span>
              )}
              {done && <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Publicado</Badge>}
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
              {post.caption || '(sem legenda)'}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => copyCaption(post.caption)}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />Copiar legenda
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadMedia(post)}>
                <Download className="mr-1.5 h-3.5 w-3.5" />Baixar mídia
              </Button>
              <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Abrir Instagram</Button>
              </a>
              <Button size="sm" variant={done ? 'outline' : 'default'} onClick={() => markPublished(post, !done)}>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />{done ? 'Reabrir' : 'Marcar como publicado'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => deletePost(post)}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Instagram className="h-5 w-5 text-white" />
            </div>
            Fila de Publicação
          </h1>
          <p className="text-muted-foreground mt-1.5">
            Monte o post uma vez, distribua para várias contas e publique pelo app — sem API da Meta e sem custo.
          </p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Contas</p>
          <p className="text-3xl font-bold mt-1">{accounts.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Pendentes</p>
          <p className="text-3xl font-bold text-primary mt-1">{pending.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Publicados</p>
          <p className="text-3xl font-bold text-emerald-500 mt-1">{published.length}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="montar">
        <TabsList>
          <TabsTrigger value="montar">Montar post</TabsTrigger>
          <TabsTrigger value="fila">Fila ({pending.length})</TabsTrigger>
          <TabsTrigger value="feitos">Publicados</TabsTrigger>
          <TabsTrigger value="contas">Contas ({accounts.length})</TabsTrigger>
        </TabsList>

        {/* -------- Montar -------- */}
        <TabsContent value="montar" className="mt-6">
          {accounts.length === 0 && !loading ? (
            <Card><CardContent className="flex flex-col items-center py-16 text-center">
              <Instagram className="h-10 w-10 opacity-30 mb-4" />
              <h3 className="font-semibold">Cadastre suas contas primeiro</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Adicione o @ de cada perfil que você gerencia. Nenhum login é necessário.
              </p>
              <Button className="mt-5" onClick={() => setAccOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />Adicionar conta
              </Button>
            </CardContent></Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">1. Formato</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      {(Object.keys(typeMeta) as MediaType[]).map(t => {
                        const Icon = typeMeta[t].icon;
                        return (
                          <Button key={t} variant={mediaType === t ? 'default' : 'outline'} onClick={() => changeType(t)}>
                            <Icon className="mr-2 h-4 w-4" />{typeMeta[t].label}
                          </Button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">{typeMeta[mediaType].hint}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">2. Mídia</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl py-10 cursor-pointer hover:border-primary/50 transition-colors">
                      <Plus className="h-6 w-6 text-muted-foreground mb-2" />
                      <span className="text-sm font-medium">Clique para enviar do computador</span>
                      <input
                        type="file" className="hidden"
                        accept={typeMeta[mediaType].accept}
                        multiple={mediaType === 'CAROUSEL'}
                        onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
                      />
                    </label>
                    {medias.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        {medias.map((m, i) => (
                          <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted group">
                            {m.isVideo
                              ? <video src={m.preview} className="h-full w-full object-cover" />
                              : <img src={m.preview} alt="" className="h-full w-full object-cover" />}
                            <button
                              onClick={() => setMedias(prev => prev.filter((_, x) => x !== i))}
                              className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">3. Legenda e agendamento</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      value={caption}
                      onChange={e => setCaption(e.target.value)}
                      rows={6}
                      placeholder="Escreva a legenda que será usada em todas as contas..."
                    />
                    <p className="text-xs text-muted-foreground text-right -mt-2">{caption.length} / 2200</p>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Data e hora prevista (opcional)</Label>
                      <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card className="sticky top-4">
                  <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">4. Contas</CardTitle>
                    <Button variant="ghost" size="sm"
                      onClick={() => setSelected(selected.length === accounts.length ? [] : accounts.map(a => a.id))}>
                      {selected.length === accounts.length ? 'Limpar' : 'Todas'}
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
                    {accounts.map(a => (
                      <label key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                        <Checkbox
                          checked={selected.includes(a.id)}
                          onCheckedChange={v => setSelected(s => v ? [...s, a.id] : s.filter(x => x !== a.id))}
                        />
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <Instagram className="h-4 w-4 opacity-50" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">@{a.handle}</p>
                          {a.display_name && <p className="text-[11px] text-muted-foreground truncate">{a.display_name}</p>}
                        </div>
                      </label>
                    ))}
                  </CardContent>
                  <CardContent className="pt-0">
                    <Button className="w-full h-11" onClick={addToQueue} disabled={saving}>
                      {saving
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</>
                        : <><ListChecks className="mr-2 h-4 w-4" />Adicionar à fila ({selected.length})</>}
                    </Button>
                    <p className="text-[11px] text-muted-foreground mt-2 text-center">
                      A mídia fica guardada aqui; é só baixar e postar pelo app.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* -------- Fila -------- */}
        <TabsContent value="fila" className="mt-6 space-y-3">
          {pending.length === 0
            ? <p className="text-sm text-muted-foreground">Nada pendente na fila.</p>
            : pending.map(renderPost)}
        </TabsContent>

        <TabsContent value="feitos" className="mt-6 space-y-3">
          {published.length === 0
            ? <p className="text-sm text-muted-foreground">Nenhum post publicado ainda.</p>
            : published.map(renderPost)}
        </TabsContent>

        {/* -------- Contas -------- */}
        <TabsContent value="contas" className="mt-6 space-y-4">
          <Dialog open={accOpen} onOpenChange={setAccOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Adicionar conta</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Nova conta do Instagram</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>@ da conta *</Label>
                  <Input value={accForm.handle} onChange={e => setAccForm({ ...accForm, handle: e.target.value })} placeholder="minhaempresa" />
                </div>
                <div className="space-y-1.5">
                  <Label>Nome / cliente</Label>
                  <Input value={accForm.display_name} onChange={e => setAccForm({ ...accForm, display_name: e.target.value })} placeholder="Inova Marketing" />
                </div>
                <Button className="w-full" onClick={addAccount}>Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map(a => (
              <Card key={a.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center">
                    <Instagram className="h-5 w-5 opacity-50" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">@{a.handle}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.display_name || '—'}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeAccount(a)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            {accounts.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
