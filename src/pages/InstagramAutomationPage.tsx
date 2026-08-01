import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Instagram, Plus, Trash2, Send, Loader2, CheckCircle2, XCircle,
  Image as ImageIcon, Film, Layers, ExternalLink, RefreshCw, X,
} from 'lucide-react';
import { toast } from 'sonner';

interface IgAccount {
  id: string;
  ig_user_id: string;
  username: string;
  page_name: string;
  profile_picture_url: string;
  active: boolean;
}

interface Publication {
  id: string;
  caption: string;
  media_type: string;
  results: any;
  success_count: number;
  fail_count: number;
  created_at: string;
}

type MediaType = 'IMAGE' | 'REELS' | 'CAROUSEL';

interface LocalMedia { file: File; preview: string; isVideo: boolean }

export default function InstagramAutomationPage() {
  const [accounts, setAccounts] = useState<IgAccount[]>([]);
  const [history, setHistory] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('IMAGE');
  const [medias, setMedias] = useState<LocalMedia[]>([]);
  const [results, setResults] = useState<any[] | null>(null);

  const redirectUri = `${window.location.origin}/instagram-automacao`;

  const load = useCallback(async () => {
    const [{ data: accs }, { data: pubs }] = await Promise.all([
      supabase.from('ig_accounts' as any).select('*').order('username'),
      supabase.from('ig_publications' as any).select('*').order('created_at', { ascending: false }).limit(20),
    ]);
    setAccounts((accs as any) || []);
    setHistory((pubs as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Retorno do login do Facebook
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;
    window.history.replaceState({}, '', '/instagram-automacao');
    setConnecting(true);
    supabase.functions
      .invoke('instagram-publish', { body: { action: 'connect', code, redirect_uri: redirectUri } })
      .then(({ data, error }) => {
        if (error || data?.error) {
          toast.error('Erro ao conectar', { description: data?.error || error?.message });
        } else if (data.count === 0) {
          toast.error('Nenhuma conta encontrada', {
            description: 'Verifique se o Instagram é Business/Criador e está vinculado a uma Página do Facebook.',
          });
        } else {
          toast.success(`${data.count} conta(s) conectada(s)`, { description: data.connected.join(', ') });
        }
        load();
      })
      .finally(() => setConnecting(false));
  }, [load, redirectUri]);

  const handleConnect = async () => {
    setConnecting(true);
    const { data, error } = await supabase.functions.invoke('instagram-publish', {
      body: { action: 'auth_url', redirect_uri: redirectUri },
    });
    setConnecting(false);
    if (error || !data?.url) {
      toast.error('Erro ao iniciar conexão', { description: data?.error || error?.message });
      return;
    }
    window.location.href = data.url;
  };

  const handleDisconnect = async (id: string, username: string) => {
    if (!confirm(`Desconectar @${username}?`)) return;
    await supabase.from('ig_accounts' as any).delete().eq('id', id);
    setSelected(s => s.filter(x => x !== id));
    toast.success('Conta desconectada');
    load();
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files);
    const max = mediaType === 'CAROUSEL' ? 10 : 1;
    const next: LocalMedia[] = [];
    for (const file of list) {
      const isVideo = file.type.startsWith('video');
      if (mediaType === 'IMAGE' && isVideo) { toast.error('Feed aceita apenas imagem'); continue; }
      if (mediaType === 'REELS' && !isVideo) { toast.error('Reels aceita apenas vídeo'); continue; }
      next.push({ file, preview: URL.createObjectURL(file), isVideo });
    }
    setMedias(prev => [...prev, ...next].slice(0, max));
  };

  const changeType = (t: MediaType) => {
    setMediaType(t);
    setMedias([]);
    setResults(null);
  };

  const handlePublish = async () => {
    if (!selected.length) { toast.error('Selecione ao menos uma conta'); return; }
    if (!medias.length) { toast.error('Envie ao menos uma mídia'); return; }

    setPublishing(true);
    setResults(null);
    try {
      const urls: string[] = [];
      for (const m of medias) {
        const ext = m.file.name.split('.').pop() || (m.isVideo ? 'mp4' : 'jpg');
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('instagram-media')
          .upload(path, m.file, { contentType: m.file.type, upsert: false });
        if (upErr) throw new Error(`Falha no upload: ${upErr.message}`);
        const { data: signed, error: sErr } = await supabase.storage
          .from('instagram-media')
          .createSignedUrl(path, 60 * 60 * 6);
        if (sErr || !signed) throw new Error('Falha ao gerar link da mídia');
        urls.push(signed.signedUrl);
      }

      const { data, error } = await supabase.functions.invoke('instagram-publish', {
        body: { action: 'publish', account_ids: selected, caption, media_type: mediaType, media_urls: urls },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);

      setResults(data.results);
      const ok = data.results.filter((r: any) => r.ok).length;
      if (ok === data.results.length) toast.success(`Publicado em ${ok} conta(s)!`);
      else toast.warning(`${ok} de ${data.results.length} publicações concluídas`);
      load();
    } catch (e) {
      toast.error('Erro ao publicar', { description: e instanceof Error ? e.message : 'erro' });
    } finally {
      setPublishing(false);
    }
  };

  const typeMeta: Record<MediaType, { label: string; icon: any; hint: string; accept: string }> = {
    IMAGE: { label: 'Feed', icon: ImageIcon, hint: '1 imagem (JPEG). Proporção entre 4:5 e 1.91:1.', accept: 'image/jpeg,image/png' },
    REELS: { label: 'Reels', icon: Film, hint: '1 vídeo vertical (MP4/MOV), até 90s.', accept: 'video/mp4,video/quicktime' },
    CAROUSEL: { label: 'Carrossel', icon: Layers, hint: 'De 2 a 10 mídias (imagens e/ou vídeos).', accept: 'image/jpeg,image/png,video/mp4' },
  };

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Instagram className="h-5 w-5 text-white" />
            </div>
            Automação do Instagram
          </h1>
          <p className="text-muted-foreground mt-1.5">
            Conecte várias contas e publique o mesmo conteúdo em todas de uma vez.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
          <Button onClick={handleConnect} disabled={connecting}>
            {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Conectar contas
          </Button>
        </div>
      </div>

      <Tabs defaultValue="publicar">
        <TabsList>
          <TabsTrigger value="publicar">Publicar</TabsTrigger>
          <TabsTrigger value="contas">Contas ({accounts.length})</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* ---------------- Publicar ---------------- */}
        <TabsContent value="publicar" className="space-y-6 mt-6">
          {accounts.length === 0 && !loading ? (
            <Card>
              <CardContent className="flex flex-col items-center py-16 text-center">
                <Instagram className="h-10 w-10 opacity-30 mb-4" />
                <h3 className="font-semibold">Nenhuma conta conectada</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Conecte pelo Facebook as contas Instagram Business/Criador vinculadas às suas Páginas.
                </p>
                <Button className="mt-5" onClick={handleConnect}>
                  <Plus className="mr-2 h-4 w-4" /> Conectar contas
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">1. Formato</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
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
                        type="file"
                        className="hidden"
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
                  <CardHeader className="pb-3"><CardTitle className="text-base">3. Legenda</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <Textarea
                      value={caption}
                      onChange={e => setCaption(e.target.value)}
                      rows={6}
                      placeholder="Escreva a legenda que será usada em todas as contas..."
                    />
                    <p className="text-xs text-muted-foreground text-right">{caption.length} / 2200</p>
                  </CardContent>
                </Card>

                {results && (
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-base">Resultado</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {results.map((r, i) => (
                        <div key={i} className="flex items-center justify-between text-sm border-b border-border/40 last:border-0 py-2">
                          <span className="flex items-center gap-2">
                            {r.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                            @{r.account}
                          </span>
                          {r.ok
                            ? r.permalink && <a href={r.permalink} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1"><ExternalLink className="h-3 w-3" />ver post</a>
                            : <span className="text-xs text-destructive max-w-[60%] text-right">{r.error}</span>}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Contas */}
              <div className="space-y-4">
                <Card className="sticky top-4">
                  <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">4. Contas</CardTitle>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => setSelected(selected.length === accounts.length ? [] : accounts.map(a => a.id))}
                    >
                      {selected.length === accounts.length ? 'Limpar' : 'Todas'}
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
                    {accounts.map(a => (
                      <label key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                        <Checkbox
                          checked={selected.includes(a.id)}
                          onCheckedChange={v => setSelected(s => v ? [...s, a.id] : s.filter(x => x !== a.id))}
                        />
                        {a.profile_picture_url
                          ? <img src={a.profile_picture_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                          : <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center"><Instagram className="h-4 w-4 opacity-50" /></div>}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">@{a.username || a.ig_user_id}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{a.page_name}</p>
                        </div>
                      </label>
                    ))}
                  </CardContent>
                  <CardContent className="pt-0">
                    <Button className="w-full h-11" onClick={handlePublish} disabled={publishing}>
                      {publishing
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Publicando...</>
                        : <><Send className="mr-2 h-4 w-4" />Publicar em {selected.length} conta(s)</>}
                    </Button>
                    <p className="text-[11px] text-muted-foreground mt-2 text-center">
                      Reels podem levar alguns minutos para processar.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ---------------- Contas ---------------- */}
        <TabsContent value="contas" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map(a => (
              <Card key={a.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  {a.profile_picture_url
                    ? <img src={a.profile_picture_url} alt="" className="h-11 w-11 rounded-full object-cover" />
                    : <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center"><Instagram className="h-5 w-5 opacity-50" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">@{a.username || a.ig_user_id}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.page_name}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDisconnect(a.id, a.username)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            {accounts.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conta conectada ainda.</p>}
          </div>
        </TabsContent>

        {/* ---------------- Histórico ---------------- */}
        <TabsContent value="historico" className="mt-6 space-y-3">
          {history.map(h => (
            <Card key={h.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{h.media_type}</Badge>
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{h.success_count} ok</Badge>
                  {h.fail_count > 0 && <Badge variant="destructive">{h.fail_count} falha(s)</Badge>}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(h.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className="text-sm line-clamp-2 text-muted-foreground">{h.caption || '(sem legenda)'}</p>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(h.results) ? h.results : []).map((r: any, i: number) => (
                    <span key={i} className={`text-[11px] px-2 py-0.5 rounded-full ${r.ok ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'}`}>
                      @{r.account}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          {history.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma publicação ainda.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
