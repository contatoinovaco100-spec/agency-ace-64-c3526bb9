import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AtSign, Clock, Loader2, RefreshCw, Send, Trash2, Upload, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AccountSelector } from '@/components/social/AccountSelector';
import { TargetStatusList } from '@/components/social/TargetStatusList';
import { ManualPublishPanel } from '@/components/social/ManualPublishPanel';
import { PublishedPlannerTab } from '@/components/social/PublishedPlannerTab';
import { useSocialAccounts } from '@/hooks/useSocialAccounts';
import { usePublishJobs } from '@/hooks/usePublishJobs';
import { publishingService } from '@/services/publishing';
import { socialAccountsService } from '@/services/socialAccounts';
import { supabase } from '@/integrations/supabase/client';

function formatJobDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function ThreadsPublishPage() {
  const { accounts, byPlatform, loading, refreshing, error, reload } = useSocialAccounts();
  const [syncingAccounts, setSyncingAccounts] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [mediaPath, setMediaPath] = useState<string>('');

  const { jobs, targetsOf, loading: jobsLoading, reload: reloadJobs } = usePublishJobs(jobId ?? undefined);

  const autoPublishedRef = useRef<Set<string>>(new Set());

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [stuckJobs, setStuckJobs] = useState<Array<{ id: string; caption: string; scheduled_at: string }>>([]);
  const [reprocessing, setReprocessing] = useState(false);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, forceTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const threadsAccounts = useMemo(() => byPlatform('threads'), [byPlatform]);
  const selectedAccounts = useMemo(
    () => accounts.filter(a => selected.includes(a.id)),
    [accounts, selected],
  );

  const pickFiles = (list: File[]) => {
    const valid = list.filter(f => {
      if (f.size > 100 * 1024 * 1024) { toast.error(`${f.name}: maximo 100 MB`); return false; }
      return true;
    });
    if (!valid.length) return;
    setFiles(prev => [...prev, ...valid].slice(0, 10));
    setPreviews(prev => [...prev, ...valid.map(f => URL.createObjectURL(f))].slice(0, 10));
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const toggle = (id: string) =>
    setSelected(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  const toggleAll = (ids: string[], checked: boolean) =>
    setSelected(p => (checked ? Array.from(new Set([...p, ...ids])) : p.filter(x => !ids.includes(x))));

  const autoAccounts = selectedAccounts.filter(a => !!a.external_id);
  const manualAccounts = selectedAccounts.filter(a => !a.external_id);

  const isVideo = !!files[0]?.type.startsWith('video');
  const effectiveType = files.length > 1 ? 'carousel' : isVideo ? 'video' : files.length === 1 ? 'image' : null;

  const publish = async () => {
    if (!files.length) { toast.error('Envie ao menos uma midia'); return; }
    if (!selectedAccounts.length) { toast.error('Selecione ao menos uma conta Threads'); return; }

    setPublishing(true);
    setProgress(5);
    try {
      const job = await publishingService.createJob({
        files, caption,
        scheduledAt: scheduledAt || null,
        accounts: selectedAccounts,
        onProgress: setProgress,
        postType: effectiveType === 'carousel' ? 'carousel' : effectiveType === 'video' ? 'reels' : 'image',
      });

      setJobId(job.id);
      setMediaPath(job.media_path);

      if (scheduledAt) {
        const formattedDate = new Date(scheduledAt).toLocaleString('pt-BR', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        });
        toast.success('Publicacao agendada', { description: `Sera publicada em ${formattedDate}` });
      } else if (autoAccounts.length) {
        await publishingService.run(job.id);
        toast.success(`Publicando em ${autoAccounts.length} conta(s) Threads`, {
          description: manualAccounts.length
            ? `${manualAccounts.length} conta(s) manual(is) ficam no painel ao lado.`
            : 'Acompanhe o status ao lado.',
        });
      } else {
        toast.success('Material pronto! Baixe a midia e poste manualmente no Threads');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Erro ao publicar', { description: msg });
    } finally {
      setPublishing(false);
    }
  };

  const targets = jobId ? targetsOf(jobId) : [];

  const cancelJob = async (id: string) => {
    try {
      await publishingService.cancelJob(id);
      reloadJobs();
      toast.success('Publicacao cancelada');
    } catch {
      toast.error('Erro ao cancelar');
    }
  };

  const deleteJob = async (id: string) => {
    try {
      await publishingService.deleteJob(id);
      reloadJobs();
      toast.success('Publicacao removida');
    } catch {
      toast.error('Erro ao remover');
    }
  };

  const syncAndReload = async () => {
    setSyncingAccounts(true);
    try {
      const withExternal = accounts.filter(a => !!a.external_id);
      if (withExternal.length === 0) { await reload(); return; }
      let synced = 0;
      for (const a of withExternal) {
        try {
          const res = await socialAccountsService.sync(a.id);
          if (res.status !== 'expired') synced++;
        } catch { /* skip */ }
      }
      await reload();
      if (synced) toast.success(`${synced} conta(s) sincronizada(s)`);
    } finally {
      setSyncingAccounts(false);
    }
  };

  useEffect(() => {
    if (!jobId) return;
    const iv = setInterval(async () => {
      try {
        const stuck = await publishingService.recoverStuckJobs();
        if (stuck.length > 0) reloadJobs();
      } catch { /* silent */ }
    }, 60_000);
    return () => clearInterval(iv);
  }, [reloadJobs]);

  const activeJobs = useMemo(
    () => jobs.filter(j => j.status !== 'published' && j.status !== 'failed'),
    [jobs],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <AtSign className="h-5 w-5" /> Publicar no Threads
        </h1>
        <p className="text-sm text-muted-foreground">
          Envie fotos, videos ou carrosseis para o Threads
        </p>
      </div>

      <Tabs defaultValue="publicar">
        <TabsList>
          <TabsTrigger value="publicar">Publicar</TabsTrigger>
          <TabsTrigger value="planner">Planner</TabsTrigger>
        </TabsList>

        <TabsContent value="publicar" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Midia</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); pickFiles(Array.from(e.dataTransfer.files || [])); }}
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/50"
                    onClick={() => inputRef.current?.click()}
                  >
                    {previews.length > 0 ? (
                      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
                        {previews.map((src, i) => (
                          <div key={src} className="relative">
                            {files[i]?.type.startsWith('video') ? (
                              <video src={src} className="h-28 w-full rounded-md object-cover" />
                            ) : (
                              <img src={src} alt={`Midia ${i + 1}`} className="h-28 w-full rounded-md object-cover" />
                            )}
                            <span className="absolute left-1 top-1 rounded bg-background/80 px-1 text-[10px] font-medium">
                              {i + 1}
                            </span>
                            <Button
                              size="icon" variant="secondary" className="absolute right-1 top-1 h-6 w-6"
                              onClick={e => { e.stopPropagation(); removeFile(i); }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <p className="text-sm font-medium">Arraste fotos/videos ou clique para escolher</p>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG ou MP4 ate 100 MB — selecionar varias cria um carrossel (ate 10)
                        </p>
                      </>
                    )}

                    <input
                      ref={inputRef} type="file" accept="video/*,image/*" multiple className="hidden"
                      onChange={e => { pickFiles(Array.from(e.target.files || [])); e.currentTarget.value = ''; }}
                    />
                  </div>

                  {effectiveType && (
                    <p className="text-xs text-muted-foreground">
                      Tipo detectado: <span className="font-medium">
                        {effectiveType === 'carousel' ? 'Carrossel' : effectiveType === 'video' ? 'Video' : 'Foto'}
                      </span>
                      {files.length > 1 && ` (${files.length} midias)`}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Legenda</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>Texto do post</Label>
                    <Textarea rows={5} value={caption} onChange={e => setCaption(e.target.value)}
                      placeholder="Escreva a legenda do post..." className="resize-none" />
                    <p className="text-[11px] text-muted-foreground text-right">{caption.length}/500</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Conta Threads ({selected.length} selecionadas)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loading ? (
                    <><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></>
                  ) : error ? (
                    <div className="space-y-2 text-sm">
                      <p className="text-destructive">Nao foi possivel carregar as contas.</p>
                      <Button size="sm" variant="outline" onClick={() => reload()}>Tentar novamente</Button>
                    </div>
                  ) : threadsAccounts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma conta Threads conectada. Vá em <strong>Redes Sociais</strong> para conectar.
                    </p>
                  ) : (
                    <AccountSelector platform="threads" accounts={threadsAccounts}
                      selected={selected} onToggle={toggle} onToggleAll={toggleAll} />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-3">
                  <div className="space-y-2">
                    <Label>Agendamento (opcional)</Label>
                    <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
                  </div>

                  <div className="flex items-center gap-3">
                    <Button className="flex-1" onClick={publish} disabled={publishing || !files.length || !selected.length}>
                      {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      {publishing ? 'Publicando...' : 'Publicar no Threads'}
                    </Button>
                  </div>
                  {publishing && <Progress value={progress} className="h-1.5" />}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">Status em tempo real</CardTitle>
                    <Button size="sm" variant="ghost" onClick={syncAndReload} disabled={refreshing || syncingAccounts}>
                      <RefreshCw className={`mr-1 h-4 w-4 ${refreshing || syncingAccounts ? 'animate-spin' : ''}`} />
                      {syncingAccounts ? 'Sincronizando...' : 'Atualizar'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {targets.length > 0 ? (
                    <div className="space-y-3">
                      <TargetStatusList targets={targets} />
                      {manualAccounts.length > 0 && (
                        <ManualPublishPanel
                          jobId={jobId!} mediaPath={mediaPath} caption={caption} firstComment=""
                          targets={targets.filter(t => manualAccounts.some(a => a.id === t.account_id))} />
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma publicacao ativa.</p>
                  )}
                </CardContent>
              </Card>

              {activeJobs.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Em andamento ({activeJobs.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {activeJobs.slice(0, 5).map(j => (
                      <div key={j.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{j.caption || '(sem legenda)'}</p>
                          <p className="text-[11px] text-muted-foreground">{formatJobDate(j.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            j.status === 'processing' ? 'bg-primary/15 text-primary' :
                            j.status === 'scheduled' ? 'bg-info/15 text-info' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {j.status === 'processing' ? 'Processando' : j.status === 'scheduled' ? 'Agendado' : 'Pendente'}
                          </span>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => cancelJob(j.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="planner" className="mt-4">
          <PublishedPlannerTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
