import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera, CameraOff, Circle, Square, Download, Play, Pause,
  RotateCcw, SwitchCamera, Minus, Plus, Type, Trash2, Maximize2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';


const DEFAULT_TEXT =
  'Cole aqui o seu roteiro.\n\nO texto vai subir por cima da imagem da câmera enquanto você grava, igual a um teleprompter profissional.\n\nAjuste a velocidade, o tamanho da letra e comece a gravar.';

export default function TeleprompterPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const rafRef = useRef<number | null>(null);
  const offsetRef = useRef(0);

  const [text, setText] = useState(DEFAULT_TEXT);
  const [fontSize, setFontSize] = useState(34);
  const [speed, setSpeed] = useState(40); // px por segundo
  const [mirrored, setMirrored] = useState(false);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [cameraOn, setCameraOn] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);


  /* ---------------- câmera ---------------- */
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async (mode: 'user' | 'environment' = facing) => {
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
      // Pede a maior resolução nativa possível — sem cortes/redimensionamento
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: mode,
          width: { ideal: 2160 },
          height: { ideal: 3840 },
          frameRate: { ideal: 30 },
          // @ts-expect-error: suportado em navegadores baseados em Chromium
          resizeMode: 'none',
        },
        audio: { echoCancellation: true, noiseSuppression: true },
      };
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: true });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraOn(true);
    } catch (e: any) {
      toast.error('Não foi possível acessar a câmera', {
        description: e?.message ?? 'Verifique as permissões do navegador.',
      });
    }
  }, [facing]);


  useEffect(() => () => {
    stopCamera();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, [stopCamera]);

  const switchCamera = async () => {
    const next = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    if (cameraOn) await startCamera(next);
  };

  /* ---------------- rolagem do texto ---------------- */
  useEffect(() => {
    if (!scrolling) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const el = scrollRef.current;
      if (el) {
        offsetRef.current += speed * dt;
        const max = el.scrollHeight - el.clientHeight;
        if (offsetRef.current >= max) {
          offsetRef.current = max;
          el.scrollTop = max;
          setScrolling(false);
          return;
        }
        el.scrollTop = offsetRef.current;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scrolling, speed]);

  const resetScroll = () => {
    offsetRef.current = 0;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setScrolling(false);
  };

  /* ---------------- gravação ---------------- */
  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setElapsed(e => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  const pickMime = () => {
    const list = [
      'video/mp4;codecs=h264,aac',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    return list.find(t => MediaRecorder.isTypeSupported?.(t)) ?? '';
  };

  const startRecording = async () => {
    if (!streamRef.current) {
      await startCamera();
      if (!streamRef.current) return;
    }
    try {
      const mimeType = pickMime();
      const rec = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
        setRecordedUrl(URL.createObjectURL(blob));
      };
      rec.start(1000);
      recorderRef.current = rec;
      setElapsed(0);
      setRecording(true);
      resetScroll();
      setScrolling(true);
    } catch (e: any) {
      toast.error('Falha ao iniciar a gravação', { description: e?.message });
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
    setScrolling(false);
  };

  const downloadRecording = () => {
    if (!recordedUrl) return;
    const a = document.createElement('a');
    a.href = recordedUrl;
    a.download = `teleprompter-${Date.now()}.${recordedUrl.includes('mp4') ? 'mp4' : 'webm'}`;
    a.click();
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Teleprompter</h1>
        <p className="text-sm text-muted-foreground">
          Grave com a câmera do celular com o roteiro passando por cima da tela.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* Preview / gravação */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative aspect-[9/16] w-full bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="absolute inset-0 h-full w-full object-cover"
                style={{ transform: mirrored ? 'scaleX(-1)' : undefined }}
              />

              {!cameraOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <CameraOff className="h-10 w-10" />
                  <Button size="sm" onClick={() => startCamera()}>
                    <Camera className="mr-2 h-4 w-4" /> Ligar câmera
                  </Button>
                </div>
              )}

              {/* Texto sobreposto */}
              <div
                ref={scrollRef}
                className="absolute inset-x-0 top-0 h-[62%] overflow-hidden bg-black/45 px-5 py-6 backdrop-blur-[2px]"
              >
                <p
                  className="whitespace-pre-wrap font-bold leading-tight text-white drop-shadow-lg"
                  style={{ fontSize: `${fontSize}px` }}
                >
                  {text}
                </p>
                <div style={{ height: '60%' }} />
              </div>

              {/* Timer */}
              {recording && (
                <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
                  {fmt(elapsed)}
                </div>
              )}

              {/* Controles inferiores */}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 bg-gradient-to-t from-black/80 to-transparent p-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="rounded-full"
                  onClick={() => setScrolling(s => !s)}
                  title={scrolling ? 'Pausar texto' : 'Rolar texto'}
                >
                  {scrolling ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>

                <button
                  type="button"
                  onClick={recording ? stopRecording : startRecording}
                  className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/80 bg-destructive text-destructive-foreground transition-transform active:scale-95"
                  title={recording ? 'Parar gravação' : 'Gravar'}
                >
                  {recording ? <Square className="h-6 w-6" /> : <Circle className="h-7 w-7 fill-current" />}
                </button>

                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="rounded-full"
                  onClick={switchCamera}
                  title="Trocar câmera"
                >
                  <SwitchCamera className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Controles */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Type className="h-4 w-4" /> Roteiro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={10}
                placeholder="Cole aqui o texto que vai aparecer na tela..."
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={resetScroll}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Voltar ao início
                </Button>
                <Button variant="outline" size="sm" onClick={() => setMirrored(m => !m)}>
                  <SwitchCamera className="mr-2 h-4 w-4" /> {mirrored ? 'Desespelhar' : 'Espelhar vídeo'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setText('')}>
                  <Trash2 className="mr-2 h-4 w-4" /> Limpar
                </Button>
                {cameraOn && (
                  <Button variant="outline" size="sm" onClick={stopCamera}>
                    <CameraOff className="mr-2 h-4 w-4" /> Desligar câmera
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ajustes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span>Velocidade</span>
                  <span className="text-muted-foreground">{speed} px/s</span>
                </Label>
                <div className="flex items-center gap-3">
                  <Minus className="h-4 w-4 text-muted-foreground" />
                  <Slider value={[speed]} min={10} max={160} step={5} onValueChange={v => setSpeed(v[0])} />
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span>Tamanho da letra</span>
                  <span className="text-muted-foreground">{fontSize}px</span>
                </Label>
                <div className="flex items-center gap-3">
                  <Minus className="h-4 w-4 text-muted-foreground" />
                  <Slider value={[fontSize]} min={16} max={72} step={2} onValueChange={v => setFontSize(v[0])} />
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          {recordedUrl && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Última gravação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <video src={recordedUrl} controls playsInline className="w-full rounded-md bg-black" />
                <Button onClick={downloadRecording}>
                  <Download className="mr-2 h-4 w-4" /> Baixar vídeo
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
