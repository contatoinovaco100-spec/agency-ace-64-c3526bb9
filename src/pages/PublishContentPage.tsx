import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Film, Loader2, RefreshCw, Send, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { AccountSelector } from '@/components/social/AccountSelector';
import { TargetStatusList } from '@/components/social/TargetStatusList';
import { ManualPublishPanel } from '@/components/social/ManualPublishPanel';

import { useSocialAccounts } from '@/hooks/useSocialAccounts';
import { usePublishJobs } from '@/hooks/usePublishJobs';
import { publishingService, type PostType } from '@/services/publishing';

export default function PublishContentPage() {
  const { accounts, byPlatform, loading, refreshing, error, reload } = useSocialAccounts();
  const [jobId, setJobId] = useState<string | null>(null);
  const [mediaPath, setMediaPath] = useState<string>('');

  const { targetsOf } = usePublishJobs(jobId ?? undefined);

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
  const inputRef = useRef<HTMLInputElement>(null);

  const file = files[0] ?? null;
  const preview = previews[0] ?? '';
  const isVideo = !!file && file.type.startsWith('video');
  const effectiveType: PostType = postType !== 'auto'
    ? postType
    : (files.length > 1 ? 'carousel' : isVideo ? 'reels' : 'image');


  const selectedAccounts = useMemo(
    () => accounts.filter(a => selected.includes(a.id)),
    [accounts, selected],
  );

  const pickFiles = (list: File[]) => {
    const valid = list.filter(f => {
      if (f.size > 500 * 1024 * 1024) { toast.error(`${f.name}: maior que 500 MB`); return false; }
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

  const publish = async () => {
    if (!files.length) { toast.error('Envie ao menos uma mídia'); return; }
    if (!selectedAccounts.length) { toast.error('Selecione ao menos uma conta'); return; }
    setPublishing(true);
    setProgress(5);
    try {
      const job = await publishingService.createJob({
        files, caption, firstComment, scheduledAt: scheduledAt || null,
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
        toast.success('Publicação agendada');
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




  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Publicar Conteúdo</h1>
        <p className="text-sm text-muted-foreground">
          Suba o vídeo uma vez e publique em várias contas ao mesmo tempo.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Conteúdo</CardTitle></CardHeader>
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
                      MP4 ou JPG/PNG até 500 MB — selecione várias para criar um carrossel (até 10)
                    </p>
                  </>
                )}

                <input
                  ref={inputRef} type="file" accept="video/*,image/*" multiple className="hidden"
                  onChange={e => { pickFiles(Array.from(e.target.files || [])); e.currentTarget.value = ''; }}
                />
              </div>

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
                {effectiveType === 'carousel' && (
                  <p className="text-xs text-muted-foreground">{files.length} mídia(s) no carrossel</p>
                )}
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
                <div className="space-y-2">
                  <Label>Agendamento (opcional)</Label>
                  <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
                </div>
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
                <Button size="sm" variant="ghost" onClick={() => reload()} disabled={refreshing}>
                  <RefreshCw className={`mr-1 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Atualizar
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

          <Button className="w-full" size="lg" onClick={publish} disabled={publishing}>
            {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {scheduledAt
              ? 'Agendar publicação'
              : autoAccounts.length
                ? `Publicar agora em ${autoAccounts.length} conta(s)`
                : 'Preparar publicação'}
          </Button>
          {publishing && <Progress value={progress} className="h-1.5" />}
        </div>

        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Film className="h-4 w-4" /> Status em tempo real
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

      </div>
    </div>
  );
}
