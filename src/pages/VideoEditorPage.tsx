import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  ArrowLeft, Download, Film, Loader2, Scissors, Trash2, Upload,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

type Segment = { start: number; end: number; keep: boolean };

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${sec.padStart(4, '0')}`;
};

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpeg(onProgress?: (msg: string) => void) {
  if (ffmpegInstance) return ffmpegInstance;
  const ffmpeg = new FFmpeg();
  ffmpeg.on('log', ({ message }) => {
    if (message.includes('silence_')) onProgress?.(message);
  });
  onProgress?.('Carregando FFmpeg (pode demorar na primeira vez)...');
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

export default function VideoEditorPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'detecting' | 'trimming' | 'done'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState('');
  const [resultSize, setResultSize] = useState(0);
  const [silenceThreshold, setSilenceThreshold] = useState(-30);
  const [minSilenceDuration, setMinSilenceDuration] = useState(0.5);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('video/')) { toast.error('Selecione um video'); return; }
    if (f.size > 500 * 1024 * 1024) { toast.error('Maximo 500 MB'); return; }
    setFile(f);
    setVideoUrl(URL.createObjectURL(f));
    setSegments([]);
    setResultUrl('');
    setStatus('idle');
    setProgress(0);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (v) setDuration(v.duration);
  };

  const detectSilence = useCallback(async () => {
    if (!file) return;
    setStatus('loading');
    setStatusMsg('Preparando video...');
    setProgress(5);

    try {
      const ffmpeg = await getFFmpeg((msg) => setStatusMsg(msg));
      setProgress(15);
      setStatus('detecting');
      setStatusMsg('Detectando silencios...');
      await ffmpeg.writeFile('input.mp4', await fetchFile(file));
      setProgress(30);

      const logData: string[] = [];
      const unsub = ffmpeg.on('log', ({ message }) => logData.push(message));

      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-af', `silencedetect=noise=${silenceThreshold}dB:d=${minSilenceDuration}`,
        '-f', 'null', '-',
      ]);
      unsub();
      setProgress(55);

      const silenceStarts: number[] = [];
      const silenceEnds: number[] = [];
      for (const line of logData) {
        const startMatch = line.match(/silence_start:\s*([\d.]+)/);
        const endMatch = line.match(/silence_end:\s*([\d.]+)/);
        if (startMatch) silenceStarts.push(parseFloat(startMatch[1]));
        if (endMatch) silenceEnds.push(parseFloat(endMatch[1]));
      }

      const newSegments: Segment[] = [];
      let cursor = 0;

      for (let i = 0; i < silenceStarts.length; i++) {
        const sStart = silenceStarts[i];
        const sEnd = silenceEnds[i] ?? duration;

        if (sStart > cursor + 0.05) {
          newSegments.push({ start: cursor, end: sStart, keep: true });
        }
        newSegments.push({ start: sStart, end: sEnd, keep: false });
        cursor = sEnd;
      }

      if (cursor < duration - 0.05) {
        newSegments.push({ start: cursor, end: duration, keep: true });
      }

      setSegments(newSegments);
      setProgress(60);
      setStatus('idle');

      const speechCount = newSegments.filter(s => s.keep).length;
      const silenceCount = newSegments.filter(s => !s.keep).length;
      setStatusMsg(`${speechCount} partes com fala, ${silenceCount} silencios encontrados`);

      toast.success('Silencios detectados!', {
        description: `${silenceCount} trechos de silencio encontrados`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Erro na deteccao', { description: msg });
      setStatus('idle');
    }
  }, [file, duration, silenceThreshold, minSilenceDuration]);

  const trimVideo = useCallback(async () => {
    if (!file || !segments.length) return;
    const keepSegments = segments.filter(s => s.keep);
    if (!keepSegments.length) { toast.error('Nenhum trecho para manter'); return; }

    setStatus('trimming');
    setStatusMsg('Cortando video...');
    setProgress(65);

    try {
      const ffmpeg = await getFFmpeg((msg) => setStatusMsg(msg));
      await ffmpeg.writeFile('input.mp4', await fetchFile(file));
      setProgress(70);

      const filterParts: string[] = [];
      const inputArgs: string[] = ['-i', 'input.mp4'];

      keepSegments.forEach((seg, i) => {
        inputArgs.push('-ss', String(seg.start), '-to', String(seg.end), '-i', 'input.mp4');
        filterParts.push(`[${i}:v:0][${i}:a:0]`);
      });

      const concatFilter = `${filterParts.join('')}concat=n=${keepSegments.length}:v=1:a=1[outv][outa]`;
      const args = [
        ...inputArgs,
        '-filter_complex', concatFilter,
        '-map', '[outv]', '-map', '[outa]',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        'output.mp4',
      ];

      await ffmpeg.exec(args);
      setProgress(95);

      const data = await ffmpeg.readFile('output.mp4');
      const blob = new Blob([data], { type: 'video/mp4' });
      setResultUrl(URL.createObjectURL(blob));
      setResultSize(blob.size);

      await ffmpeg.deleteFile('input.mp4').catch(() => {});
      await ffmpeg.deleteFile('output.mp4').catch(() => {});

      setProgress(100);
      setStatus('done');
      setStatusMsg('Video cortado com sucesso!');

      toast.success('Video pronto!', {
        description: `${keepSegments.length} trechos mantidos, silencios removidos`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Erro ao cortar', { description: msg });
      setStatus('idle');
    }
  }, [file, segments]);

  const toggleSegment = (idx: number) => {
    setSegments(prev => prev.map((s, i) => i === idx ? { ...s, keep: !s.keep } : s));
  };

  const downloadResult = () => {
    if (!resultUrl || !file) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `${file.name.replace(/\.[^.]+$/, '')}_editado.mp4`;
    a.click();
  };

  const totalKeep = segments.filter(s => s.keep).reduce((acc, s) => acc + (s.end - s.start), 0);
  const totalRemove = segments.filter(s => !s.keep).reduce((acc, s) => acc + (s.end - s.start), 0);

  const isProcessing = status === 'loading' || status === 'detecting' || status === 'trimming';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Editor de Video</h1>
          <p className="text-sm text-muted-foreground">Corte automatico de silencios e respiracoes</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Film className="h-4 w-4" /> Video
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!file ? (
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Arraste o video ou clique para escolher</p>
                  <p className="text-xs text-muted-foreground">MP4, MOV ou WebM ate 500 MB</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-lg overflow-hidden bg-black">
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      controls
                      onLoadedMetadata={onLoadedMetadata}
                      className="w-full max-h-[400px] object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate">{file.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{fmt(duration)} / {(file.size / 1024 / 1024).toFixed(1)} MB</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => { setFile(null); setVideoUrl(''); setSegments([]); setResultUrl(''); setStatus('idle'); setProgress(0); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ''; }} />
            </CardContent>
          </Card>

          {segments.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Scissors className="h-4 w-4" /> Segmentos detectados ({segments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-4 text-xs">
                  <span className="text-emerald-500 font-medium">Manter: {fmt(totalKeep)}</span>
                  <span className="text-destructive font-medium">Remover: {fmt(totalRemove)}</span>
                  <span className="text-muted-foreground">Final: {fmt(totalKeep)}</span>
                </div>

                <div className="flex gap-[2px] h-8 rounded-md overflow-hidden">
                  {segments.map((seg, i) => {
                    const pct = duration > 0 ? ((seg.end - seg.start) / duration) * 100 : 0;
                    return (
                      <div
                        key={i}
                        onClick={() => toggleSegment(i)}
                        className={`cursor-pointer transition-opacity hover:opacity-80 ${
                          seg.keep ? 'bg-emerald-500' : 'bg-destructive/40'
                        }`}
                        style={{ width: `${Math.max(pct, 0.3)}%` }}
                        title={`${seg.keep ? 'Manter' : 'Remover'}: ${fmt(seg.start)} - ${fmt(seg.end)}`}
                      />
                    );
                  })}
                </div>

                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {segments.map((seg, i) => (
                    <div
                      key={i}
                      onClick={() => toggleSegment(i)}
                      className={`flex items-center gap-3 rounded-md border px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                        seg.keep
                          ? 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
                          : 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10 opacity-60'
                      }`}
                    >
                      <div className={`h-2 w-2 rounded-full ${seg.keep ? 'bg-emerald-500' : 'bg-destructive'}`} />
                      <span className="font-mono">{fmt(seg.start)} - {fmt(seg.end)}</span>
                      <span className="text-muted-foreground">{fmt(seg.end - seg.start)}</span>
                      <span className="ml-auto">{seg.keep ? 'Fala' : 'Silencio'}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {status === 'done' && resultUrl && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-emerald-600">
                  Video cortado pronto!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <video src={resultUrl} controls className="w-full max-h-[300px] rounded-lg bg-black object-contain" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{(resultSize / 1024 / 1024).toFixed(1)} MB</span>
                  <Button size="sm" onClick={downloadResult}>
                    <Download className="mr-1 h-4 w-4" /> Baixar video
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Configuracoes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm">Sensibilidade do silencio: {silenceThreshold} dB</Label>
                <p className="text-xs text-muted-foreground">Valores mais baixos = mais sensivel</p>
                <input
                  type="range" min={-50} max={-10} step={1}
                  value={silenceThreshold}
                  onChange={e => setSilenceThreshold(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Duracao minima do silencio: {minSilenceDuration}s</Label>
                <p className="text-xs text-muted-foreground">Silencios menores que isso sao ignorados</p>
                <input
                  type="range" min={0.1} max={3} step={0.1}
                  value={minSilenceDuration}
                  onChange={e => setMinSilenceDuration(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Acoes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isProcessing && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="truncate">{statusMsg}</span>
                  </div>
                </div>
              )}

              {!isProcessing && status !== 'done' && file && segments.length === 0 && (
                <Button className="w-full" onClick={detectSilence}>
                  <Scissors className="mr-2 h-4 w-4" /> Detectar silencios
                </Button>
              )}

              {!isProcessing && segments.length > 0 && (
                <Button className="w-full" onClick={trimVideo}>
                  <Scissors className="mr-2 h-4 w-4" /> Cortar video
                </Button>
              )}

              {!isProcessing && segments.length > 0 && (
                <Button className="w-full" variant="outline" onClick={detectSilence}>
                  Refazer deteccao
                </Button>
              )}

              {!file && (
                <p className="text-center text-xs text-muted-foreground">
                  Envie um video para comecar
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
