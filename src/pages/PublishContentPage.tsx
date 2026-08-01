import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Film, Loader2, Send, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { AccountSelector } from '@/components/social/AccountSelector';
import { TargetStatusList } from '@/components/social/TargetStatusList';
import { ManualPublishPanel } from '@/components/social/ManualPublishPanel';

import { useSocialAccounts } from '@/hooks/useSocialAccounts';
import { usePublishJobs } from '@/hooks/usePublishJobs';
import { publishingService } from '@/services/publishing';

export default function PublishContentPage() {
  const { accounts, byPlatform, loading } = useSocialAccounts();
  const [jobId, setJobId] = useState<string | null>(null);
  const [mediaPath, setMediaPath] = useState<string>('');

  const { targetsOf } = usePublishJobs(jobId ?? undefined);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedAccounts = useMemo(
    () => accounts.filter(a => selected.includes(a.id)),
    [accounts, selected],
  );

  const pickFile = (f: File) => {
    if (f.size > 500 * 1024 * 1024) { toast.error('Arquivo maior que 500 MB'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const toggle = (id: string) =>
    setSelected(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  const toggleAll = (ids: string[], checked: boolean) =>
    setSelected(p => (checked ? Array.from(new Set([...p, ...ids])) : p.filter(x => !ids.includes(x))));

  const autoAccounts = selectedAccounts.filter(a => !!a.external_id);
  const manualAccounts = selectedAccounts.filter(a => !a.external_id);

  const publish = async () => {
    if (!file) { toast.error('Envie um vídeo'); return; }
    if (!selectedAccounts.length) { toast.error('Selecione ao menos uma conta'); return; }
    setPublishing(true);
    setProgress(5);
    try {
      const job = await publishingService.createJob({
        file, caption, firstComment, scheduledAt: scheduledAt || null,
        thumbnailUrl, accounts: selectedAccounts, onProgress: setProgress,
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
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) pickFile(f); }}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/50"
                onClick={() => inputRef.current?.click()}
              >
                {preview ? (
                  <div className="relative w-full">
                    <video src={preview} controls className="mx-auto max-h-64 rounded-md" />
                    <Button
                      size="icon" variant="secondary" className="absolute right-2 top-2 h-7 w-7"
                      onClick={e => { e.stopPropagation(); setFile(null); setPreview(''); }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm font-medium">Arraste o vídeo ou clique para escolher</p>
                    <p className="text-xs text-muted-foreground">MP4 vertical até 500 MB</p>
                  </>
                )}
                <input
                  ref={inputRef} type="file" accept="video/*,image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
                />
              </div>

              <div className="space-y-2">
                <Label>Legenda</Label>
                <Textarea rows={4} value={caption} onChange={e => setCaption(e.target.value)}
                  placeholder="Escreva a legenda do post..." />
              </div>

              <div className="space-y-2">
                <Label>Primeiro comentário (opcional)</Label>
                <Textarea rows={2} value={firstComment} onChange={e => setFirstComment(e.target.value)}
                  placeholder="#hashtags ou link" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Agendamento (opcional)</Label>
                  <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Miniatura (URL, quando suportado)</Label>
                  <Input value={thumbnailUrl} onChange={e => setThumbnailUrl(e.target.value)} placeholder="https://..." />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contas ({selected.length} selecionadas)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></>
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
