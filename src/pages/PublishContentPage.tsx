import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Clock, Film, History, Loader2, RefreshCw, Send, Timer, Trash2, Upload, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AccountSelector } from '@/components/social/AccountSelector';
import { TargetStatusList } from '@/components/social/TargetStatusList';
import { ManualPublishPanel } from '@/components/social/ManualPublishPanel';
import { PublishedPlannerTab } from '@/components/social/PublishedPlannerTab';

import { useSocialAccounts } from '@/hooks/useSocialAccounts';
import { usePublishJobs } from '@/hooks/usePublishJobs';
import { publishingService, type PostType } from '@/services/publishing';
import { socialAccountsService } from '@/services/socialAccounts';
import { supabase } from '@/integrations/supabase/client';

const JOB_STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendente', cls: 'bg-muted text-muted-foreground' },
  processing: { label: 'Processando', cls: 'bg-primary/15 text-primary' },
  published: { label: 'Publicado', cls: 'bg-emerald-500/15 text-emerald-600' },
  partial: { label: 'Parcial', cls: 'bg-warning/15 text-warning' },
  failed: { label: 'Falhou', cls: 'bg-destructive/15 text-destructive' },
  scheduled: { label: 'Agendado', cls: 'bg-info/15 text-info' },
};

function formatJobDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function PublishContentPage() {
  const { accounts, byPlatform, loading, refreshing, error, reload } = useSocialAccounts();
  const [syncingAccounts, setSyncingAccounts] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [mediaPath, setMediaPath] = useState<string>('');

  const { jobs, targetsOf, loading: jobsLoading, reload: reloadJobs } = usePublishJobs(jobId ?? undefined);

  // Evita publicar o mesmo job agendado duas vezes na mesma sessão.
  const autoPublishedRef = useRef<Set<string>>(new Set());

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [postType, setPostType] = useState<PostType>('auto');
  const [shareToFeed, setShareToFeed] = useState(true);
  const [collaborators, setCollaborators] = useState('');
  const [locationId, setLocationId] = useState('');
  const [userTags, setUserTags] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [thumbOffset, setThumbOffset] = useState('');
  const [audioName, setAudioName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkCaptions, setBulkCaptions] = useState<Record<number, string>>({});
  const [bulkDone, setBulkDone] = useState(0);
  const [schedulePattern, setSchedulePattern] = useState<string>('none');
  const [scheduledItems, setScheduledItems] = useState<Array<{ jobId: string; fileName: string; publishAt: Date; status: 'waiting' | 'publishing' | 'done' | 'error' }>>([]);
  const [stuckJobs, setStuckJobs] = useState<Array<{ id: string; caption: string; scheduled_at: string }>>([]);
  const [reprocessing, setReprocessing] = useState(false);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, forceTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const file = files[0] ?? null;
  const preview = previews[0] ?? '';
  const isVideo = !!file && file.type.startsWith('video');
  const effectiveType: PostType = postType !== 'auto'
    ? postType
    : (!bulkMode && files.length > 1 ? 'carousel' : isVideo ? 'reels' : 'image');



  const selectedAccounts = useMemo(
    () => accounts.filter(a => selected.includes(a.id)),
    [accounts, selected],
  );

  const maxFiles = bulkMode ? 30 : 10;

  const pickFiles = (list: File[]) => {
    const valid = list.filter(f => {
      if (f.size > 500 * 1024 * 1024) { toast.error(`${f.name}: maior que 500 MB`); return false; }
      return true;
    });
    if (!valid.length) return;
    setFiles(prev => [...prev, ...valid].slice(0, maxFiles));
    setPreviews(prev => [...prev, ...valid.map(f => URL.createObjectURL(f))].slice(0, maxFiles));
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
    setBulkCaptions(prev => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k);
        if (i < idx) next[i] = v;
        else if (i > idx) next[i - 1] = v;
      });
      return next;
    });
  };



  const toggle = (id: string) =>
    setSelected(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  const toggleAll = (ids: string[], checked: boolean) =>
    setSelected(p => (checked ? Array.from(new Set([...p, ...ids])) : p.filter(x => !ids.includes(x))));

  const autoAccounts = selectedAccounts.filter(a => !!a.external_id);
  const manualAccounts = selectedAccounts.filter(a => !a.external_id);

  const commonOptions = () => ({
    postType,
    shareToFeed,
    collaborators: collaborators.split(',').map(s => s.trim()).filter(Boolean),
    locationId,
    userTags: userTags.split(',').map(s => s.trim()).filter(Boolean),
    coverUrl,
    thumbOffset: Number(thumbOffset) || 0,
    audioName,
  });

  /** Sincroniza contas com o Meta (Instagram/TikTok) e depois recarrega a lista */
  const syncAndReload = async () => {
    setSyncingAccounts(true);
    try {
      const withExternal = accounts.filter(a => !!a.external_id);
      if (withExternal.length === 0) {
        await reload();
        return;
      }
      let synced = 0;
      let failed = 0;
      for (const a of withExternal) {
        try {
          const res = await socialAccountsService.sync(a.id);
          if (res.status !== 'expired') synced++;
          else failed++;
        } catch {
          failed++;
        }
      }
      await reload();
      if (synced > 0 && !failed) toast.success(`${synced} conta(s) sincronizada(s)`);
      else if (synced > 0 && failed) toast.warning(`${synced} sincronizada(s), ${failed} falha(s)`);
      else if (failed) toast.error('Falha ao sincronizar contas com o Meta');
    } finally {
      setSyncingAccounts(false);
    }
  };

  function formatCountdown(target: Date): string {
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return 'Publicando...';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (h > 0) return `${h}h ${m}min`;
    if (m > 0) return `${m}min ${s}s`;
    return `${s}s`;
  }

  const publishScheduledItem = async (item: { jobId: string; fileName: string }) => {
    setScheduledItems(prev => prev.map(si =>
      si.jobId === item.jobId ? { ...si, status: 'publishing' } : si
    ));
    try {
      await publishingService.run(item.jobId);
      setScheduledItems(prev => prev.map(si =>
        si.jobId === item.jobId ? { ...si, status: 'done' } : si
      ));
      toast.success(`${item.fileName} publicado!`);
    } catch (e: any) {
      setScheduledItems(prev => prev.map(si =>
        si.jobId === item.jobId ? { ...si, status: 'error' } : si
      ));
      toast.error(`Erro ao publicar ${item.fileName}`, { description: e?.message });
    }
    forceTick(n => n + 1);
  };

  useEffect(() => {
    const pending = scheduledItems.filter(si => si.status === 'waiting');
    if (!pending.length) {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }

    for (const item of pending) {
      if (timersRef.current.has(item.jobId)) continue;
      const delay = item.publishAt.getTime() - Date.now();
      if (delay <= 0) {
        publishScheduledItem(item);
        continue;
      }
      const timer = setTimeout(() => {
        timersRef.current.delete(item.jobId);
        publishScheduledItem(item);
      }, delay);
      timersRef.current.set(item.jobId, timer);
    }

    if (!tickRef.current) {
      tickRef.current = setInterval(() => forceTick(n => n + 1), 1000);
    }

    return () => {};
  }, [scheduledItems]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current.clear();
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const loadStuckJobs = useCallback(async () => {
    const { data } = await (await import('@/integrations/supabase/client')).supabase
      .from('publish_jobs' as any)
      .select('id, caption, scheduled_at, status')
      .in('status', ['pending', 'scheduled'])
      .order('created_at');
    setStuckJobs((data ?? []) as any);
  }, []);

  useEffect(() => { loadStuckJobs(); }, [loadStuckJobs]);

  const reprocessAll = async () => {
    setReprocessing(true);
    try {
      const { processed, errors } = await publishingService.reprocessPending();
      if (processed > 0) toast.success(`${processed} publicação(ões) publicada(s)`);
      if (errors > 0) toast.warning(`${errors} falha(s) ao publicar`);
      if (processed === 0 && errors === 0) toast.info('Nenhuma publicação pendente');
      await loadStuckJobs();
    } catch (e: any) {
      toast.error('Erro ao reprocessar', { description: e?.message });
    } finally {
      setReprocessing(false);
    }
  };

  // Auto-publica posts agendados que já venceram ao abrir/atualizar a página, e
  // agenda timers para os agendados futuros. Cobre o caso em que a aba estava
  // fechada no horário marcado (o cron backend não estando ativo).
  useEffect(() => {
    if (jobsLoading) return;
    const now = Date.now();

    // Jobs travados em 'processing' (publicação antiga cujo background foi
    // encerrado) nunca são reprocessados sozinhos — recupera e re-avalia.
    const stuck = jobs.filter((j) => j.status === 'processing');
    if (stuck.length) {
      publishingService
        .recoverStuckJobs()
        .then((ids) => {
          if (ids.length) {
            ids.forEach((id) => autoPublishedRef.current.delete(id));
            reloadJobs();
          }
        })
        .catch(() => {});
    }

    jobs
      .filter(
        (j) =>
          j.status === 'scheduled' &&
          !!j.scheduled_at &&
          !scheduledItems.some((si) => si.jobId === j.id) &&
          !autoPublishedRef.current.has(j.id),
      )
      .forEach((j) => {
        const when = new Date(j.scheduled_at as string).getTime();
        if (when <= now) {
          autoPublishedRef.current.add(j.id);
          publishingService
            .run(j.id)
            .then(() => reloadJobs())
            .catch((e: any) => {
              toast.error(`Erro ao publicar agendado`, { description: e?.message });
              reloadJobs();
            });
        } else {
          if (timersRef.current.has(j.id)) return;
          const t = setTimeout(() => {
            timersRef.current.delete(j.id);
            publishingService
              .run(j.id)
              .then(() => reloadJobs())
              .catch((e: any) => {
                toast.error(`Erro ao publicar agendado`, { description: e?.message });
                reloadJobs();
              });
          }, when - now);
          timersRef.current.set(j.id, t);
        }
      });
  }, [jobs, jobsLoading, scheduledItems, reloadJobs]);

  // Watchdog: enquanto a página estiver aberta, recupera jobs travados em
  // 'processing' (e volta a publicá-los) mesmo sem mudanças no banco.
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const recovered = await publishingService.recoverStuckJobs();
        if (recovered.length) {
          recovered.forEach((id) => autoPublishedRef.current.delete(id));
          reloadJobs();
        }
      } catch {
        /* silencioso */
      }
    }, 60_000);
    return () => clearInterval(iv);
  }, [reloadJobs]);

  /** Modo em massa: cada vídeo/foto vira uma publicação separada. */
  const publishBulk = async () => {
    setPublishing(true);
    setProgress(2);
    setBulkDone(0);
    let ok = 0;
    const errors: string[] = [];
    let lastJobId: string | null = null;
    let lastPath = '';

    const intervals: Record<string, number> = {
      '30min': 30, '1h': 60, '2h': 120, '3h': 180,
      '4h': 240, '6h': 360, '8h': 480, '12h': 720, '24h': 1440,
    };
    const intervalMin = schedulePattern !== 'none' ? (intervals[schedulePattern] ?? 0) : 0;
    const hasInterval = intervalMin > 0;

    const newScheduledItems: Array<{ jobId: string; fileName: string; publishAt: Date; status: 'waiting' | 'publishing' | 'done' | 'error' }> = [];
    let lastScheduledAt = Date.now();

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const job = await publishingService.createJob({
          files: [f],
          caption: (bulkCaptions[i] ?? '').trim() || caption,
          firstComment,
          scheduledAt: null,
          thumbnailUrl,
          accounts: selectedAccounts,
          onProgress: p => setProgress(Math.round(((i + p / 100) / files.length) * 100)),
          ...commonOptions(),
        });
        lastJobId = job.id;
        lastPath = job.media_path;

        if (i === 0) {
          if (autoAccounts.length) {
            await publishingService.run(job.id);
            lastScheduledAt = Date.now();
          }
        } else if (hasInterval) {
          const publishAt = new Date(lastScheduledAt + intervalMin * 60000);
          // Persist scheduled_at in DB so time shows even after re-renders
          const { error: updateErr } = await (supabase as any)
            .from('publish_jobs')
            .update({ scheduled_at: publishAt.toISOString(), status: 'scheduled' })
            .eq('id', job.id);
          if (updateErr) console.error('Failed to set scheduled_at:', updateErr);
          newScheduledItems.push({ jobId: job.id, fileName: f.name, publishAt, status: 'waiting' });
          lastScheduledAt = publishAt.getTime();
        } else if (autoAccounts.length) {
          await publishingService.run(job.id);
          lastScheduledAt = Date.now();
        }
        ok++;
      } catch (e: any) {
        errors.push(`${f.name}: ${e?.message ?? 'erro'}`);
      }
      setBulkDone(i + 1);
      setProgress(Math.round(((i + 1) / files.length) * 100));
    }

    if (newScheduledItems.length) {
      setScheduledItems(prev => [...prev, ...newScheduledItems]);
    }

    if (lastJobId) { setJobId(lastJobId); setMediaPath(lastPath); }
    setPublishing(false);

    if (ok && !errors.length) {
      if (hasInterval) {
        toast.success(`${ok} publicação(ões) enviada(s)`, {
          description: `1º post publicado agora · Último em ${new Date(lastScheduledAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
        });
      } else {
        toast.success(`${ok} publicação(ões) enviada(s) em massa`, {
          description: scheduledAt ? 'Todas agendadas.' : 'Acompanhe cada uma em "Em andamento".',
        });
      }
    } else if (ok) {
      toast.warning(`${ok} enviada(s), ${errors.length} com erro`, { description: errors[0] });
    } else {
      toast.error('Nenhuma publicação enviada', { description: errors[0] });
    }
  };

  const publish = async () => {
    if (!files.length) { toast.error('Envie ao menos uma mídia'); return; }
    if (!selectedAccounts.length) { toast.error('Selecione ao menos uma conta'); return; }
    if (bulkMode) return publishBulk();

    setPublishing(true);
    setProgress(5);
    try {
      const job = await publishingService.createJob({
        files, caption, firstComment,
        scheduledAt: scheduledAt || null,
        thumbnailUrl, accounts: selectedAccounts, onProgress: setProgress,
        postType,
        shareToFeed,
        collaborators: collaborators.split(',').map(s => s.trim()).filter(Boolean),
        locationId,
        userTags: userTags.split(',').map(s => s.trim()).filter(Boolean),
        coverUrl,
        thumbOffset: Number(thumbOffset) || 0,
        audioName,
      });

      setJobId(job.id);
      setMediaPath(job.media_path);

      if (scheduledAt) {
        const formattedDate = new Date(scheduledAt).toLocaleString('pt-BR', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        });
        toast.success('Publicação agendada', {
          description: `Será publicada em ${formattedDate}`,
        });
      } else if (autoAccounts.length) {
        await publishingService.run(job.id);
        toast.success(`Publicando em ${autoAccounts.length} conta(s) conectada(s)`, {
          description: manualAccounts.length
            ? `${manualAccounts.length} conta(s) manual(is) ficam no painel ao lado.`
            : 'Acompanhe o status ao lado.',
        });
      } else {
        toast.success('Material pronto! Baixe a mídia e poste em cada conta manual');
      }
    } catch (e: any) {
      toast.error('Erro ao publicar', { description: e?.message });
    } finally {
      setPublishing(false);
    }
  };

  const targets = jobId ? targetsOf(jobId) : [];
  const manualTargets = targets.filter(t =>
    manualAccounts.some(a => a.username === t.username && a.platform === t.platform));

  const currentJob = jobs.find(j => j.id === jobId) ?? null;
  const finished = !!currentJob && ['published', 'partial', 'failed'].includes(currentJob.status);

  const resetForm = useCallback(() => {
    setPreviews(prev => { prev.forEach(u => URL.revokeObjectURL(u)); return []; });
    setJobId(null);
    setMediaPath('');
    setFiles([]);
    setCaption('');
    setFirstComment('');
    setScheduledAt('');
    setThumbnailUrl('');
    setPostType('auto');
    setShareToFeed(true);
    setCollaborators('');
    setLocationId('');
    setUserTags('');
    setCoverUrl('');
    setThumbOffset('');
    setAudioName('');
    setSelected([]);
    setProgress(0);
    setBulkCaptions({});
    setBulkDone(0);
    setSchedulePattern('none');
    setScheduledItems([]);
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current.clear();
    loadStuckJobs();

  }, [loadStuckJobs]);

  // Avisa uma única vez quando o job termina — sem limpar a tela automaticamente,
  // para o usuário conseguir ler o resultado de cada conta.
  const notifiedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentJob || !finished) return;
    if (notifiedRef.current === currentJob.id) return;
    notifiedRef.current = currentJob.id;
    if (currentJob.status === 'published') toast.success('Publicação concluída em todas as contas!');
    else if (currentJob.status === 'partial') toast.warning('Publicado em parte das contas — veja os erros ao lado.');
    else toast.error('A publicação falhou. Confira os detalhes ao lado.');
  }, [currentJob, finished]);





  return (
    <div className="space-y-6 p-4 md:p-6 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-bold">Publicar Conteúdo</h1>
        <p className="text-sm text-muted-foreground">
          Suba o vídeo uma vez e publique em várias contas ao mesmo tempo.
        </p>
      </div>

      <Tabs defaultValue="publicar">
        <TabsList>
          <TabsTrigger value="publicar">Publicar</TabsTrigger>
          <TabsTrigger value="planner">Planner</TabsTrigger>
        </TabsList>

        <TabsContent value="publicar" className="mt-4">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Conteúdo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="text-sm">Publicação em massa</Label>
                  <p className="text-xs text-muted-foreground">
                    Cada vídeo/foto vira um post separado (até 30), em vez de carrossel.
                  </p>
                </div>
                <Switch checked={bulkMode} onCheckedChange={setBulkMode} disabled={publishing} />
              </div>

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
                          <img src={src} alt={`Mídia ${i + 1}`} className="h-28 w-full rounded-md object-cover" />
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
                    <p className="text-sm font-medium">Arraste os vídeos/fotos ou clique para escolher</p>
                    <p className="text-xs text-muted-foreground">
                      {bulkMode
                        ? 'MP4 ou JPG/PNG até 500 MB — cada arquivo vira um post (até 30)'
                        : 'MP4 ou JPG/PNG até 500 MB — selecione várias para criar um carrossel (até 10)'}
                    </p>
                  </>
                )}

                <input
                  ref={inputRef} type="file" accept="video/*,image/*" multiple className="hidden"
                  onChange={e => { pickFiles(Array.from(e.target.files || [])); e.currentTarget.value = ''; }}
                />
              </div>

              {bulkMode && files.length > 0 && (
                <div className="space-y-2 rounded-md border p-3">
                  <Label className="text-sm">Legenda de cada post ({files.length})</Label>
                  <p className="text-xs text-muted-foreground">
                    Deixe em branco para usar a legenda padrão abaixo.
                  </p>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {files.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="space-y-1">
                        <p className="truncate text-[11px] text-muted-foreground">{i + 1}. {f.name}</p>
                        <Textarea
                          rows={2}
                          value={bulkCaptions[i] ?? ''}
                          onChange={e => setBulkCaptions(p => ({ ...p, [i]: e.target.value }))}
                          placeholder="Legenda deste post..."
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {bulkMode && files.length > 0 && (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Intervalo entre posts</Label>
                    <Select value={schedulePattern} onValueChange={setSchedulePattern}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Publicar todos agora</SelectItem>
                        <SelectItem value="30min">A cada 30 minutos</SelectItem>
                        <SelectItem value="1h">A cada 1 hora</SelectItem>
                        <SelectItem value="2h">A cada 2 horas</SelectItem>
                        <SelectItem value="3h">A cada 3 horas</SelectItem>
                        <SelectItem value="4h">A cada 4 horas</SelectItem>
                        <SelectItem value="6h">A cada 6 horas</SelectItem>
                        <SelectItem value="8h">A cada 8 horas</SelectItem>
                        <SelectItem value="12h">A cada 12 horas</SelectItem>
                        <SelectItem value="24h">A cada 24 horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {schedulePattern !== 'none' && (
                    <div className="space-y-2 rounded-md bg-muted/50 p-3">
                      <p className="text-xs font-medium">Pré-visualização da programação</p>
                      <div className="space-y-1.5">
                        {files.slice(0, 5).map((f, i) => {
                          const intervals: Record<string, number> = {
                            '30min': 30, '1h': 60, '2h': 120, '3h': 180,
                            '4h': 240, '6h': 360, '8h': 480, '12h': 720, '24h': 1440,
                          };
                          const min = intervals[schedulePattern] ?? 60;
                          const now = new Date();
                          const postTime = new Date(now.getTime() + i * min * 60000);
                          return (
                            <div key={i} className="flex items-center gap-2 text-[11px]">
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                                i === 0 ? 'bg-emerald-500 text-white' : 'bg-primary/15 text-primary'
                              }`}>
                                {i + 1}
                              </span>
                              <span className="truncate text-muted-foreground">{f.name}</span>
                              <span className="ml-auto shrink-0 font-medium text-foreground">
                                {i === 0 ? 'Agora' : postTime.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          );
                        })}
                        {files.length > 5 && (
                          <p className="text-[10px] text-muted-foreground pl-7">
                            +{files.length - 5} mais... Último às {
                              (() => {
                                const intervals: Record<string, number> = {
                                  '30min': 30, '1h': 60, '2h': 120, '3h': 180,
                                  '4h': 240, '6h': 360, '8h': 480, '12h': 720, '24h': 1440,
                                };
                                const totalMin = (files.length - 1) * (intervals[schedulePattern] ?? 60);
                                return new Date(Date.now() + totalMin * 60000).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                              })()
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}


              <div className="space-y-2">
                <Label>Tipo de publicação</Label>
                <Select value={postType} onValueChange={(v) => setPostType(v as PostType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automático (vídeo → Reels, imagem → Feed, várias → Carrossel)</SelectItem>
                    <SelectItem value="reels">Reels</SelectItem>
                    <SelectItem value="image">Foto no feed</SelectItem>
                    <SelectItem value="carousel">Carrossel</SelectItem>
                    <SelectItem value="stories">Stories</SelectItem>
                  </SelectContent>
                </Select>
                {bulkMode ? (
                  <p className="text-xs text-muted-foreground">
                    Em massa: o tipo escolhido vale para todos os {files.length} post(s).
                  </p>
                ) : effectiveType === 'carousel' ? (
                  <p className="text-xs text-muted-foreground">{files.length} mídia(s) no carrossel</p>
                ) : null}
              </div>



              <div className="space-y-2">
                <Label>Legenda</Label>
                <Textarea rows={4} value={caption} onChange={e => setCaption(e.target.value)}
                  placeholder="Escreva a legenda do post..."
                  disabled={effectiveType === 'stories'} />
                <p className="text-xs text-muted-foreground">
                  {effectiveType === 'stories'
                    ? 'Stories não aceita legenda pela API.'
                    : `${caption.length}/2200 caracteres`}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Primeiro comentário (opcional)</Label>
                <Textarea rows={2} value={firstComment} onChange={e => setFirstComment(e.target.value)}
                  placeholder="#hashtags ou link" />
              </div>

              {effectiveType === 'reels' && (
                <>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <Label className="text-sm">Compartilhar também no feed</Label>
                      <p className="text-xs text-muted-foreground">O Reels aparece na grade do perfil.</p>
                    </div>
                    <Switch checked={shareToFeed} onCheckedChange={setShareToFeed} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Capa do Reels (URL)</Label>
                      <Input value={coverUrl} onChange={e => setCoverUrl(e.target.value)} placeholder="https://..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Ou segundo da capa (ms)</Label>
                      <Input type="number" min={0} value={thumbOffset}
                        onChange={e => setThumbOffset(e.target.value)} placeholder="Ex: 1000" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Nome do áudio (opcional)</Label>
                    <Input value={audioName} onChange={e => setAudioName(e.target.value)}
                      placeholder="Áudio original do perfil" />
                  </div>
                </>
              )}

              {effectiveType !== 'stories' && (
                <>
                  <div className="space-y-2">
                    <Label>Colaboradores (até 3, separados por vírgula)</Label>
                    <Input value={collaborators} onChange={e => setCollaborators(e.target.value)}
                      placeholder="@perfil1, @perfil2" />
                  </div>

                  {effectiveType === 'image' && (
                    <div className="space-y-2">
                      <Label>Marcar pessoas na foto (separadas por vírgula)</Label>
                      <Input value={userTags} onChange={e => setUserTags(e.target.value)}
                        placeholder="@cliente, @parceiro" />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Localização (ID da página do Facebook)</Label>
                    <Input value={locationId} onChange={e => setLocationId(e.target.value)}
                      placeholder="Ex: 1234567890" />
                  </div>
                </>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {!bulkMode && (
                  <div className="space-y-2">
                    <Label>Agendamento (opcional)</Label>
                    <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Miniatura (URL, outras redes)</Label>
                  <Input value={thumbnailUrl} onChange={e => setThumbnailUrl(e.target.value)} placeholder="https://..." />
                </div>
              </div>

            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Contas ({selected.length} selecionadas)</CardTitle>
                <Button size="sm" variant="ghost" onClick={syncAndReload} disabled={refreshing || syncingAccounts}>
                  <RefreshCw className={`mr-1 h-4 w-4 ${refreshing || syncingAccounts ? 'animate-spin' : ''}`} />
                  {syncingAccounts ? 'Sincronizando...' : 'Atualizar'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></>
              ) : error ? (
                <div className="space-y-2 text-sm">
                  <p className="text-destructive">Não foi possível carregar as contas.</p>
                  <Button size="sm" variant="outline" onClick={() => reload()}>Tentar novamente</Button>
                </div>
              ) : accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma conta conectada. Vá em <strong>Redes Sociais</strong> para conectar.
                </p>
              ) : (
                <>
                  <AccountSelector platform="instagram" accounts={byPlatform('instagram')}
                    selected={selected} onToggle={toggle} onToggleAll={toggleAll} />
                  <AccountSelector platform="tiktok" accounts={byPlatform('tiktok')}
                    selected={selected} onToggle={toggle} onToggleAll={toggleAll} />
                </>
              )}
            </CardContent>
          </Card>

          <div className="sticky bottom-2 z-10 space-y-2 rounded-lg bg-background/80 p-1 backdrop-blur">
            <Button className="w-full" size="lg" onClick={publish} disabled={publishing || (!bulkMode && !!jobId && !finished)}>
              {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {publishing
                ? bulkMode ? `Enviando ${bulkDone}/${files.length}...` : 'Enviando...'
                : (schedulePattern !== 'none' && bulkMode)
                  ? `Publicar ${files.length} post(s) (1º agora, demais a cada ${schedulePattern === '30min' ? '30min' : schedulePattern})`
                  : scheduledAt
                    ? bulkMode ? `Agendar ${files.length} publicação(ões)` : 'Agendar publicação'
                    : autoAccounts.length
                      ? bulkMode
                        ? `Publicar ${files.length} post(s) em ${autoAccounts.length} conta(s)`
                        : `Publicar agora em ${autoAccounts.length} conta(s)`
                      : 'Preparar publicação'}
            </Button>
            {(publishing || (!bulkMode && !!jobId && !finished)) && (
              <Progress value={publishing ? progress : 100} className="h-1.5" />
            )}

            {finished && (
              <Button variant="outline" className="w-full" onClick={resetForm}>
                Nova publicação
              </Button>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-5 lg:space-y-6">
        <Card className="h-fit min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Film className="h-4 w-4" /> Status em tempo real
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 min-h-[120px] px-4 pb-4 sm:px-5">

            {!jobId ? (
              <p className="text-xs text-muted-foreground">
                O progresso de cada conta aparece aqui assim que você publicar.
              </p>
            ) : (
              <>
                <TargetStatusList targets={targets} />
                {manualTargets.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="mb-2 text-xs font-medium">Contas manuais</p>
                    <ManualPublishPanel
                      jobId={jobId}
                      mediaPath={mediaPath}
                      caption={caption}
                      firstComment={firstComment}
                      targets={manualTargets}
                    />
                  </div>
                )}
              </>
            )}

          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="px-4 pt-4 pb-3 sm:px-5">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" /> Em andamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 min-h-[100px] px-4 pb-4 sm:px-5">
            {jobsLoading ? (
              <><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></>
            ) : jobs.filter(j => j.status !== 'published').length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nada em andamento. Publicações concluídas somem daqui automaticamente.
              </p>
            ) : (
              jobs
                .filter(j => j.status !== 'published')
                .slice(0, 10)
                .map(job => {
                const m = JOB_STATUS_META[job.status] ?? JOB_STATUS_META.pending;
                const jobTargets = targetsOf(job.id);
                const done = jobTargets.filter(t => t.status === 'published').length;
                const title = job.caption?.trim() || (job.media_type === 'video' ? 'Vídeo' : 'Imagem');
                const scheduledItem = scheduledItems.find(si => si.jobId === job.id);
                const isPending = job.status === 'pending' || job.status === 'scheduled';
                return (
                  <div key={job.id} className="rounded-lg border p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                      <span className="flex min-w-0 items-center gap-2 text-xs font-medium">
                        <Film className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{title}</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.cls}`}>
                          {m.label}
                        </span>
                        {isPending && (
                          <>
                            <Button
                              size="icon" variant="ghost" className="h-5 w-5"
                              onClick={async () => {
                                try {
                                  await publishingService.cancelJob(job.id);
                                  toast.success('Publicação cancelada');
                                  setScheduledItems(prev => prev.filter(si => si.jobId !== job.id));
                                  { const t = timersRef.current.get(job.id); if (t) clearTimeout(t); }
                                  timersRef.current.delete(job.id);
                                  reload();
                                } catch (e: any) {
                                  toast.error('Erro ao cancelar', { description: e?.message });
                                }
                              }}
                              title="Cancelar"
                            >
                              <X className="h-3 w-3 text-destructive" />
                            </Button>
                            <Button
                              size="icon" variant="ghost" className="h-5 w-5"
                              onClick={async () => {
                                try {
                                  await publishingService.deleteJob(job.id);
                                  toast.success('Publicação excluída');
                                  setScheduledItems(prev => prev.filter(si => si.jobId !== job.id));
                                  { const t = timersRef.current.get(job.id); if (t) clearTimeout(t); }
                                  timersRef.current.delete(job.id);
                                  reload();
                                } catch (e: any) {
                                  toast.error('Erro ao excluir', { description: e?.message });
                                }
                              }}
                              title="Excluir"
                            >
                              <Trash2 className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground text-balance">
                      {scheduledItem ? (
                        <span className="flex min-w-0 items-center gap-0.5 text-info font-medium">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span className="break-words">Publica: {scheduledItem.publishAt.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                      ) : job.scheduled_at ? (
                        <span className="flex min-w-0 items-center gap-0.5 text-info font-medium">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span className="break-words">Agendado: {formatJobDate(job.scheduled_at)}</span>
                        </span>
                      ) : (
                        <span className="break-words">{formatJobDate(job.created_at)}</span>
                      )}
                      {jobTargets.length > 0 && (
                        <>
                          <span>·</span>
                          <span className="shrink-0">{done}/{jobTargets.length} conta(s)</span>
                        </>
                      )}
                    </div>
                    <TargetStatusList targets={jobTargets} />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {scheduledItems.length > 0 && (
          <Card className="min-w-0">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Timer className="h-4 w-4" /> Programação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const done = scheduledItems.filter(s => s.status === 'done').length;
                const total = scheduledItems.length + 1;
                const pct = Math.round(((done + 1) / total) * 100);
                return (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{done + 1}/{total} publicado(s)</span>
                      <span className="font-medium">{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </>
                );
              })()}

              <div className="space-y-1">
                {scheduledItems.map((item, idx) => {
                  const statusMap = {
                    waiting: { icon: Clock, label: formatCountdown(item.publishAt), cls: 'text-info', bg: 'bg-info/10 border-info/20', iconCls: '' },
                    publishing: { icon: Loader2, label: 'Publicando...', cls: 'text-primary', bg: 'bg-primary/10 border-primary/20', iconCls: 'animate-spin' },
                    done: { icon: CheckCircle2, label: 'Publicado', cls: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20', iconCls: '' },
                    error: { icon: AlertCircle, label: 'Erro', cls: 'text-destructive', bg: 'bg-destructive/10 border-destructive/20', iconCls: '' },
                  };
                  const s = statusMap[item.status];
                  const Icon = s.icon;
                  return (
                    <div key={item.jobId} className={`flex items-center gap-2.5 rounded-md border p-2 ${s.bg}`}>
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${s.cls} ${s.iconCls}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{idx + 2}. {item.fileName}</p>
                      </div>
                      <span className={`shrink-0 text-[10px] font-semibold ${s.cls}`}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {stuckJobs.length > 0 && (
          <Card className="min-w-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-warning" /> Pendentes ({stuckJobs.length})
                </CardTitle>
                <Button size="sm" onClick={reprocessAll} disabled={reprocessing}>
                  {reprocessing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                  Publicar todas
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {stuckJobs.map((job, idx) => (
                <div key={job.id} className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/5 p-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning/15 text-[9px] font-bold text-warning">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{job.caption?.trim() || 'Sem legenda'}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Criado: {formatJobDate(job.scheduled_at || job.id)}
                    </p>
                  </div>
                  <Button
                    size="icon" variant="ghost" className="h-5 w-5 shrink-0"
                    onClick={async () => {
                      try {
                        await publishingService.deleteJob(job.id);
                        toast.success('Excluído');
                        loadStuckJobs();
                      } catch (e: any) {
                        toast.error('Erro', { description: e?.message });
                      }
                    }}
                    title="Excluir"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </Button>
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
