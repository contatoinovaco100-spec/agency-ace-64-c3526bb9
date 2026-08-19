import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Play, Pause, RotateCcw, Settings2, X,
  ChevronUp, ChevronDown, Video, VideoOff,
  FlipHorizontal, Type, Gauge,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type FacingMode = 'user' | 'environment';

// Target output resolution — always portrait 1080x1920
const OUT_W = 1080;
const OUT_H = 1920;

export default function TeleprompterPage() {
  const navigate = useNavigate();

  // Camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>('environment');

  // Canvas for guaranteed 1080x1920 output
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawRafRef = useRef<number | null>(null);

  // Teleprompter
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [script, setScript] = useState('');
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1);
  const [fontSize, setFontSize] = useState(28);
  const [isMirrored, setIsMirrored] = useState(false);
  const scrollAnimRef = useRef<number | null>(null);
  const [editingScript, setEditingScript] = useState(false);

  // Recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  // UI
  const [showSettings, setShowSettings] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ───── Draw camera frame to canvas (no crop, fit inside 1080x1920) ───── */
  const startDrawLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvasCtxRef.current;
    if (!video || !canvas || !ctx) return;

    canvas.width = OUT_W;
    canvas.height = OUT_H;

    const draw = () => {
      if (video.readyState < 2) {
        drawRafRef.current = requestAnimationFrame(draw);
        return;
      }

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw === 0 || vh === 0) {
        drawRafRef.current = requestAnimationFrame(draw);
        return;
      }

      // Black background
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, OUT_W, OUT_H);

      // Scale to FIT inside 1080x1920 (no crop)
      const scale = Math.min(OUT_W / vw, OUT_H / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (OUT_W - dw) / 2;
      const dy = (OUT_H - dh) / 2;

      // Mirror if front camera
      if (isMirrored) {
        ctx.save();
        ctx.translate(OUT_W, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, OUT_W - dx - dw, dy, dw, dh);
        ctx.restore();
      } else {
        ctx.drawImage(video, dx, dy, dw, dh);
      }

      drawRafRef.current = requestAnimationFrame(draw);
    };

    drawRafRef.current = requestAnimationFrame(draw);
  }, [isMirrored]);

  const stopDrawLoop = useCallback(() => {
    if (drawRafRef.current) {
      cancelAnimationFrame(drawRafRef.current);
      drawRafRef.current = null;
    }
  }, []);

  /* ───── Camera ───── */
  const startCamera = useCallback(async (facing: FacingMode) => {
    try {
      setCameraError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      // Request highest resolution possible — we'll resize in canvas
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 2160 },
            height: { ideal: 3840 },
            frameRate: { ideal: 30 },
          },
          audio: true,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: true,
        });
      }

      streamRef.current = stream;

      // Log actual camera resolution
      const track = stream.getVideoTracks()[0];
      if (track) {
        const s = track.getSettings();
        console.log(`Camera: ${s.width}x${s.height} (output: ${OUT_W}x${OUT_H})`);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);

      // Start drawing frames to canvas
      startDrawLoop();
    } catch (err: any) {
      console.error('Camera error:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Permissão da câmera negada.'
          : err.name === 'NotFoundError'
            ? 'Nenhuma câmera encontrada.'
            : `Erro câmera: ${err.message}`
      );
      setCameraActive(false);
    }
  }, [startDrawLoop]);

  const stopCamera = useCallback(() => {
    stopDrawLoop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, [stopDrawLoop]);

  const flipCamera = useCallback(() => {
    const next: FacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    startCamera(next);
  }, [facingMode, startCamera]);

  // Auto-start
  useEffect(() => {
    startCamera(facingMode);
    return () => stopCamera();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ───── Scroll ───── */
  useEffect(() => {
    if (!isScrolling || !scrollContainerRef.current) {
      if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current);
      return;
    }
    const container = scrollContainerRef.current;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      container.scrollTop += scrollSpeed * 60 * dt;
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 2) {
        setIsScrolling(false);
        return;
      }
      scrollAnimRef.current = requestAnimationFrame(tick);
    };
    scrollAnimRef.current = requestAnimationFrame(tick);
    return () => { if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current); };
  }, [isScrolling, scrollSpeed]);

  /* ───── Recording (records canvas stream = guaranteed 1080x1920) ───── */
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

  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !streamRef.current) return;

    // Canvas stream (video frames at 1080x1920)
    const canvasStream = canvas.captureStream(30);

    // Add audio tracks from camera
    const audioTracks = streamRef.current.getAudioTracks();
    if (audioTracks.length > 0) {
      const combined = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioTracks,
      ]);
      startRecorder(combined);
    } else {
      startRecorder(canvasStream);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startRecorder = (stream: MediaStream) => {
    recordedChunksRef.current = [];
    const mimeType = pickMime();

    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 12_000_000,
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: mimeType || 'video/webm' });
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(URL.createObjectURL(blob));
    };

    mediaRecorderRef.current = recorder;
    recorder.start(1000);
    setIsRecording(true);
    setRecordTime(0);
    recordTimerRef.current = setInterval(() => setRecordTime(p => p + 1), 1000);
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const downloadRecording = () => {
    if (!recordedUrl) return;
    const a = document.createElement('a');
    a.href = recordedUrl;
    a.download = `gravacao-${Date.now()}.${recordedUrl.includes('mp4') ? 'mp4' : 'webm'}`;
    a.click();
  };

  /* ───── Controls auto-hide ───── */
  const resetControlsTimer = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (!isRecording && !editingScript && !showSettings) setControlsVisible(false);
    }, 4000);
  }, [isRecording, editingScript, showSettings]);

  useEffect(() => {
    resetControlsTimer();
    return () => { if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current); };
  }, [resetControlsTimer]);

  useEffect(() => () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  }, []);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col select-none bg-black"
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >
      {/* Hidden video element — camera feeds into this */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="hidden"
      />

      {/* Hidden canvas — camera frames drawn here at 1080x1920 */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Visible output: the canvas rendered as an img via CSS */}
      {/* We use a second visible canvas for display */}
      <VisibleCanvas canvasRef={canvasRef} cameraActive={cameraActive} />

      {/* Error */}
      {cameraError && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/90 px-6">
          <VideoOff className="mb-4 h-16 w-16 text-red-500" />
          <p className="mb-6 text-center text-lg text-white">{cameraError}</p>
          <button
            onClick={() => startCamera(facingMode)}
            className="rounded-full bg-white px-6 py-3 text-lg font-semibold text-black"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Teleprompter text overlay */}
      {cameraActive && script && !editingScript && (
        <div
          ref={scrollContainerRef}
          className="absolute left-0 right-0 top-20 z-20 bottom-32 overflow-y-auto px-6 py-4"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <p
            className="whitespace-pre-wrap text-center font-medium leading-relaxed text-white"
            style={{
              fontSize: `${fontSize}px`,
              textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)',
            }}
          >
            {script}
          </p>
        </div>
      )}

      {/* Script editor */}
      {editingScript && (
        <div className="absolute inset-0 z-50 flex flex-col bg-black/95 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Editar Roteiro</h2>
            <button
              onClick={() => setEditingScript(false)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Concluir
            </button>
          </div>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Cole ou digite seu roteiro aqui..."
            className="flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-lg text-white focus:border-primary focus:outline-none"
            autoFocus
          />
          <p className="mt-2 text-center text-xs text-zinc-500">
            {script.length > 0 ? `${script.split(/\s+/).filter(Boolean).length} palavras` : 'Nenhuma palavra ainda'}
          </p>
        </div>
      )}

      {/* Settings */}
      {showSettings && (
        <div className="absolute bottom-0 left-0 right-0 z-40 rounded-t-2xl bg-black/95 p-6 pb-24 backdrop-blur-sm">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Configurações</h3>
            <button onClick={() => setShowSettings(false)}>
              <X className="h-5 w-5 text-zinc-400" />
            </button>
          </div>
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-zinc-300">
                <Gauge className="h-4 w-4" /> Velocidade
              </span>
              <span className="font-mono text-sm text-white">{scrollSpeed.toFixed(1)}x</span>
            </div>
            <input type="range" min="0.2" max="4" step="0.1" value={scrollSpeed}
              onChange={(e) => setScrollSpeed(parseFloat(e.target.value))} className="w-full accent-primary" />
          </div>
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-zinc-300">
                <Type className="h-4 w-4" /> Texto
              </span>
              <span className="font-mono text-sm text-white">{fontSize}px</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setFontSize(p => Math.max(16, p - 2))}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-white">
                <ChevronDown className="h-5 w-5" />
              </button>
              <input type="range" min="16" max="64" step="2" value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value))} className="flex-1 accent-primary" />
              <button onClick={() => setFontSize(p => Math.min(64, p + 2))}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-white">
                <ChevronUp className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-zinc-300">
              <FlipHorizontal className="h-4 w-4" /> Espelhar Texto
            </span>
            <button onClick={() => setIsMirrored(m => !m)}
              className={cn('relative h-6 w-12 rounded-full transition-colors', isMirrored ? 'bg-primary' : 'bg-zinc-700')}>
              <div className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                isMirrored ? 'translate-x-6' : 'translate-x-0.5')} />
            </button>
          </div>
        </div>
      )}

      {/* Top controls */}
      <div className={cn('absolute left-0 right-0 top-0 z-30 transition-opacity duration-300',
        controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0')}>
        <div className="bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-3">
          <div className="flex items-center justify-between">
            <button onClick={() => { stopRecording(); stopCamera(); navigate(-1); }}
              className="rounded-full bg-black/40 p-2.5 backdrop-blur-sm">
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
            <div className="flex items-center gap-3">
              {isRecording && (
                <div className="flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5">
                  <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
                  <span className="font-mono text-sm font-bold text-white">{fmt(recordTime)}</span>
                </div>
              )}
            </div>
            <button onClick={() => setShowSettings(s => !s)}
              className="rounded-full bg-black/40 p-2.5 backdrop-blur-sm">
              <Settings2 className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className={cn('absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-300',
        controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0')}>
        <div className="bg-gradient-to-t from-black/80 via-black/50 to-transparent px-4 pb-8 pt-12">
          {!script && !editingScript && (
            <button onClick={() => setEditingScript(true)}
              className="mb-4 w-full rounded-xl border border-white/20 bg-white/10 p-4 text-center backdrop-blur-sm">
              <Type className="mx-auto mb-2 h-6 w-6 text-white/70" />
              <p className="text-sm text-white/70">Toque para adicionar o roteiro</p>
            </button>
          )}
          {script && !editingScript && (
            <div className="mb-4 flex items-center justify-center gap-2">
              <span className="max-w-[200px] truncate text-xs text-white/60">{script.substring(0, 40)}...</span>
              <button onClick={() => setEditingScript(true)} className="text-xs font-medium text-primary">Editar</button>
            </div>
          )}
          <div className="flex items-center justify-center gap-6">
            <button onClick={flipCamera} className="rounded-full bg-white/15 p-3 backdrop-blur-sm">
              <RotateCcw className="h-6 w-6 text-white" />
            </button>
            {isRecording ? (
              <button onClick={stopRecording}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-red-600 shadow-lg shadow-red-600/30">
                <div className="h-8 w-8 rounded-md bg-white" />
              </button>
            ) : (
              <button onClick={startRecording} disabled={!cameraActive}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg shadow-white/20 disabled:opacity-40">
                <Video className="h-8 w-8 text-red-600" />
              </button>
            )}
            <button onClick={() => {
              if (!script) { setEditingScript(true); return; }
              if (isScrolling) { setIsScrolling(false); }
              else {
                if (scrollContainerRef.current) {
                  const c = scrollContainerRef.current;
                  if (c.scrollTop + c.clientHeight >= c.scrollHeight - 10) c.scrollTop = 0;
                }
                setIsScrolling(true);
              }
            }} className={cn('rounded-full p-3 backdrop-blur-sm', isScrolling ? 'bg-primary' : 'bg-white/15')}>
              {isScrolling ? <Pause className="h-6 w-6 text-white" /> : <Play className="ml-0.5 h-6 w-6 text-white" />}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-center gap-6">
            <span className="w-12 text-center text-[10px] text-white/50">Girar</span>
            <span className="w-20 text-center text-[10px] text-white/50">{isRecording ? 'Parar' : 'Gravar'}</span>
            <span className="w-12 text-center text-[10px] text-white/50">{isScrolling ? 'Pausar' : 'Rolar'}</span>
          </div>
          {recordedUrl && (
            <div className="mt-4 flex justify-center">
              <button onClick={downloadRecording}
                className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm text-white backdrop-blur-sm">
                <Video className="h-4 w-4" /> Baixar última gravação
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───── Visible canvas that mirrors the hidden recording canvas ───── */
function VisibleCanvas({ canvasRef, cameraActive }: { canvasRef: React.RefObject<HTMLCanvasElement | null>; cameraActive: boolean }) {
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!cameraActive) return;

    const draw = () => {
      const src = canvasRef.current;
      const dst = displayCanvasRef.current;
      if (src && dst && src.width > 0 && src.height > 0) {
        dst.width = src.width;
        dst.height = src.height;
        const ctx = dst.getContext('2d');
        if (ctx) ctx.drawImage(src, 0, 0);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [cameraActive, canvasRef]);

  return (
    <canvas
      ref={displayCanvasRef}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
