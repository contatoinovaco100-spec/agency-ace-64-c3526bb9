import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Play, Pause, RotateCcw, Settings2, X,
  ChevronUp, ChevronDown, Video, VideoOff,
  FlipHorizontal, Type, Gauge, Download, Trash2,
  Sparkles, Maximize2, Minimize2, Eye, HelpCircle,
  Clock, CheckCircle2, RefreshCw, Volume2, Film
} from 'lucide-react';
import { cn } from '@/lib/utils';

type FacingMode = 'user' | 'environment';
type FitMode = 'contain' | 'cover';

const SCRIPT_STORAGE_KEY = 'inova_teleprompter_script';
const SPEED_STORAGE_KEY = 'inova_teleprompter_speed';
const FONT_SIZE_STORAGE_KEY = 'inova_teleprompter_font_size';
const FIT_MODE_STORAGE_KEY = 'inova_teleprompter_fit_mode';

const SAMPLE_SCRIPT = `Olá! Seja muito bem-vindo ao nosso canal.

Hoje vamos falar sobre como aumentar os resultados da sua empresa utilizando estratégias inteligentes de marketing digital e produção de conteúdo em alta escala.

Se você ainda não conhece a Inova, somos especialistas em transformar ideias em resultados reais.

Acompanhe até o final deste vídeo para conferir as dicas práticas que preparamos para você!`;

export default function TeleprompterPage() {
  const navigate = useNavigate();

  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>('user');
  const [videoResolution, setVideoResolution] = useState<{ width: number; height: number } | null>(null);

  // Display & Framing
  const [fitMode, setFitMode] = useState<FitMode>(() => {
    return (localStorage.getItem(FIT_MODE_STORAGE_KEY) as FitMode) || 'contain';
  });
  const [isMirroredVideo, setIsMirroredVideo] = useState(false);
  const [isMirroredText, setIsMirroredText] = useState(false);
  const [textWidthPercent, setTextWidthPercent] = useState(80); // 60% to 100%
  const [bgDimOpacity, setBgDimOpacity] = useState(40); // 0 to 80%

  // Teleprompter state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [script, setScript] = useState<string>(() => {
    return localStorage.getItem(SCRIPT_STORAGE_KEY) || '';
  });
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState<number>(() => {
    const saved = localStorage.getItem(SPEED_STORAGE_KEY);
    return saved ? parseFloat(saved) : 1.2;
  });
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    return saved ? parseInt(saved, 10) : 32;
  });
  const scrollAnimRef = useRef<number | null>(null);
  const [editingScript, setEditingScript] = useState(false);

  // Recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Countdown state
  const [countdown, setCountdown] = useState<number | null>(null);
  const [countdownSetting, setCountdownSetting] = useState<number>(3); // 0, 3, 5 seconds

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showGuideLine, setShowGuideLine] = useState(true);

  // Persist script
  useEffect(() => {
    localStorage.setItem(SCRIPT_STORAGE_KEY, script);
  }, [script]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem(SPEED_STORAGE_KEY, scrollSpeed.toString());
  }, [scrollSpeed]);

  useEffect(() => {
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSize.toString());
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem(FIT_MODE_STORAGE_KEY, fitMode);
  }, [fitMode]);

  /* ───── Start / Stop Camera ───── */
  const startCamera = useCallback(async (facing: FacingMode) => {
    try {
      setCameraError(null);

      // Stop existing tracks first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      let stream: MediaStream | null = null;

      // Strategy 1: Ideal 1080p / high resolution with audio
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 60, min: 24 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (err1) {
        console.warn('Initial camera constraints failed, attempting fallback...', err1);
        try {
          // Strategy 2: Simple facingMode & audio
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facing },
            audio: true,
          });
        } catch (err2) {
          console.warn('Facing camera fallback failed, requesting any camera...', err2);
          // Strategy 3: Basic video + audio
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        }
      }

      if (!stream) {
        throw new Error('Não foi possível obter o fluxo de vídeo da câmera.');
      }

      streamRef.current = stream;

      // Detect resolution
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        if (settings.width && settings.height) {
          setVideoResolution({ width: settings.width, height: settings.height });
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video play error (possibly awaiting user interaction):', playErr);
        }
      }

      setCameraActive(true);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Permissão da câmera/microfone negada. Permita o acesso nas configurações do navegador.'
          : err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError'
            ? 'Nenhuma câmera encontrada conectada ao dispositivo.'
            : err.name === 'NotReadableError'
              ? 'A câmera está sendo usada por outro aplicativo ou aba.'
              : `Erro ao acessar câmera: ${err.message || 'Desconhecido'}`
      );
      setCameraActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const flipCamera = useCallback(() => {
    const nextMode: FacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  }, [facingMode, startCamera]);

  // Start camera on mount
  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stopCamera();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle video metadata loaded to capture resolution
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const w = videoRef.current.videoWidth;
      const h = videoRef.current.videoHeight;
      if (w > 0 && h > 0) {
        setVideoResolution({ width: w, height: h });
      }
    }
  };

  /* ───── Teleprompter Scroll Animation ───── */
  useEffect(() => {
    if (!isScrolling || !scrollContainerRef.current) {
      if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current);
      return;
    }

    const container = scrollContainerRef.current;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // Base speed factor: 50 pixels/sec per 1.0x
      const deltaScroll = scrollSpeed * 50 * dt;
      container.scrollTop += deltaScroll;

      // Check if reached the end
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 5) {
        setIsScrolling(false);
        return;
      }

      scrollAnimRef.current = requestAnimationFrame(tick);
    };

    scrollAnimRef.current = requestAnimationFrame(tick);

    return () => {
      if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current);
    };
  }, [isScrolling, scrollSpeed]);

  const resetScroll = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  /* ───── Media Recorder (Direct 100% Uncropped Stream) ───── */
  const pickBestMimeType = () => {
    const candidates = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=h264,aac',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
    ];
    for (const mime of candidates) {
      if (MediaRecorder.isTypeSupported?.(mime)) {
        return mime;
      }
    }
    return '';
  };

  const startActualRecording = () => {
    if (!streamRef.current) {
      alert('Câmera não conectada.');
      return;
    }

    recordedChunksRef.current = [];
    const mimeType = pickBestMimeType();

    try {
      const recorder = new MediaRecorder(streamRef.current, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 12_000_000, // 12 Mbps for crystal-clear 100% quality
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const type = mimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type });
        setRecordedBlob(blob);
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        setShowReviewModal(true);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // chunk every 1 second
      setIsRecording(true);
      setRecordTime(0);

      // Auto start teleprompter scroll when recording begins if script exists
      if (script && !isScrolling) {
        setIsScrolling(true);
      }

      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recordTimerRef.current = setInterval(() => {
        setRecordTime(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Failed to start MediaRecorder:', err);
      alert(`Erro ao iniciar gravação: ${err.message}`);
    }
  };

  const handleRecordClick = () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    if (countdownSetting > 0) {
      setCountdown(countdownSetting);
      let count = countdownSetting;
      const interval = setInterval(() => {
        count -= 1;
        if (count <= 0) {
          clearInterval(interval);
          setCountdown(null);
          startActualRecording();
        } else {
          setCountdown(count);
        }
      }, 1000);
    } else {
      startActualRecording();
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecording(false);
    setIsScrolling(false);
  }, []);

  const downloadRecording = () => {
    if (!recordedUrl) return;
    const ext = recordedUrl.includes('mp4') || (recordedBlob && recordedBlob.type.includes('mp4')) ? 'mp4' : 'webm';
    const a = document.createElement('a');
    a.href = recordedUrl;
    a.download = `gravacao-teleprompter-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  /* ───── Auto-hide Controls ───── */
  const resetControlsTimer = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (!isRecording && !editingScript && !showSettings && !showReviewModal && countdown === null) {
        setControlsVisible(false);
      }
    }, 4500);
  }, [isRecording, editingScript, showSettings, showReviewModal, countdown]);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [resetControlsTimer]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingScript || showSettings || showReviewModal) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!script) {
          setEditingScript(true);
          return;
        }
        setIsScrolling(prev => !prev);
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        handleRecordClick();
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setScrollSpeed(s => Math.min(4.0, +(s + 0.1).toFixed(1)));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setScrollSpeed(s => Math.max(0.2, +(s - 0.1).toFixed(1)));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingScript, showSettings, showReviewModal, script, isRecording]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;
  // Average reading speed ~130 words per minute at 1.0x
  const estimatedSeconds = wordCount > 0 ? Math.round((wordCount / (130 * scrollSpeed)) * 60) : 0;

  // Determine mirroring: front camera defaults to mirrored selfie feel unless disabled
  const shouldMirrorVideo = facingMode === 'user' ? !isMirroredVideo : isMirroredVideo;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col select-none bg-black overflow-hidden"
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >
      {/* ───── CAMERA FEED (100% DIRECT HARDWARE STREAM - NO CROPPING) ───── */}
      <div className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          onLoadedMetadata={handleLoadedMetadata}
          className={cn(
            'w-full h-full transition-all duration-300 pointer-events-none',
            fitMode === 'contain' ? 'object-contain' : 'object-cover',
            shouldMirrorVideo && '-scale-x-100'
          )}
        />

        {/* Framing watermark / badge (shows resolution & 100% full view indicator) */}
        {cameraActive && videoResolution && (
          <div className="absolute bottom-3 left-4 z-20 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-white/70 backdrop-blur-md border border-white/10 pointer-events-none">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{videoResolution.width}x{videoResolution.height}</span>
            <span>•</span>
            <span className="text-emerald-400 font-semibold">
              {fitMode === 'contain' ? '100% Completo (Sem corte)' : 'Preenchido'}
            </span>
          </div>
        )}
      </div>

      {/* Background dimmer overlay behind text for high legibility */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{ backgroundColor: `rgba(0, 0, 0, ${bgDimOpacity / 100})` }}
      />

      {/* Eye-Contact Guide Line (helps the creator look directly towards the camera lens) */}
      {showGuideLine && cameraActive && script && !editingScript && (
        <div className="absolute left-0 right-0 top-[28%] z-10 pointer-events-none flex items-center justify-center opacity-40">
          <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent" />
          <div className="absolute -top-3 rounded-full bg-primary/20 border border-primary/40 px-2 py-0.5 text-[9px] font-semibold text-primary uppercase tracking-wider backdrop-blur-sm">
            Olhe aqui
          </div>
        </div>
      )}

      {/* Camera Error Screen */}
      {cameraError && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/95 px-6 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
            <VideoOff className="h-10 w-10 text-red-500" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-white">Câmera Indisponível</h2>
          <p className="mb-6 max-w-md text-sm text-zinc-400 leading-relaxed">{cameraError}</p>
          <div className="flex gap-3">
            <button
              onClick={() => startCamera(facingMode)}
              className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
            >
              <RefreshCw className="h-4 w-4" /> Tentar Novamente
            </button>
            <button
              onClick={() => navigate(-1)}
              className="rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-medium text-white hover:bg-white/10"
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {/* Countdown Overlay (3... 2... 1... GO!) */}
      {countdown !== null && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="animate-ping absolute h-40 w-40 rounded-full bg-red-500/20" />
          <span className="text-9xl font-black text-white drop-shadow-[0_0_35px_rgba(239,68,68,0.8)]">
            {countdown}
          </span>
        </div>
      )}

      {/* ───── TELEPROMPTER TEXT OVERLAY ───── */}
      {cameraActive && script && !editingScript && (
        <div
          ref={scrollContainerRef}
          className="absolute inset-x-0 top-16 bottom-36 z-20 overflow-y-auto px-4 py-8 select-none"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <div
            className="mx-auto flex flex-col items-center justify-center transition-all duration-300"
            style={{
              maxWidth: `${textWidthPercent}%`,
              transform: isMirroredText ? 'scaleX(-1)' : 'none',
            }}
          >
            {/* Top spacer so text starts scrolling into view smoothly */}
            <div className="h-28" />

            <p
              className="whitespace-pre-wrap text-center font-semibold leading-relaxed tracking-wide text-white transition-all duration-200"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: 1.45,
                textShadow: '0 2px 10px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,1)',
              }}
            >
              {script}
            </p>

            {/* Bottom spacer */}
            <div className="h-64" />
          </div>
        </div>
      )}

      {/* ───── TOP CONTROLS BAR ───── */}
      <div
        className={cn(
          'absolute left-0 right-0 top-0 z-30 transition-all duration-300',
          controlsVisible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'
        )}
      >
        <div className="flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent px-4 pb-6 pt-3">
          {/* Back button */}
          <button
            onClick={() => {
              stopRecording();
              stopCamera();
              navigate(-1);
            }}
            className="flex items-center gap-2 rounded-full bg-black/50 p-2.5 text-white backdrop-blur-md border border-white/10 hover:bg-white/10 active:scale-95 transition-all"
            title="Sair do teleprompter"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Center Info / Recording Timer / Status */}
          <div className="flex items-center gap-2">
            {isRecording ? (
              <div className="flex items-center gap-2.5 rounded-full bg-red-600/90 px-4 py-1.5 shadow-lg shadow-red-600/30 backdrop-blur-md border border-red-400/30 animate-pulse">
                <div className="h-3 w-3 rounded-full bg-white animate-ping" />
                <span className="font-mono text-sm font-bold text-white tracking-wider">
                  REC {formatTime(recordTime)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full bg-black/50 px-3.5 py-1.5 text-xs font-medium text-white/80 backdrop-blur-md border border-white/10">
                <Film className="h-3.5 w-3.5 text-primary" />
                <span>Teleprompter HD</span>
                {script && (
                  <>
                    <span className="text-white/40">•</span>
                    <span>{wordCount} palavras</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Top right actions */}
          <div className="flex items-center gap-2">
            {/* Toggle Full/Contain framing */}
            <button
              onClick={() => setFitMode(f => f === 'contain' ? 'cover' : 'contain')}
              className="rounded-full bg-black/50 p-2.5 text-white backdrop-blur-md border border-white/10 hover:bg-white/10 active:scale-95 transition-all"
              title={fitMode === 'contain' ? 'Modo atual: 100% Sem corte (clique para preencher)' : 'Modo atual: Preencher tela (clique para 100% sem corte)'}
            >
              {fitMode === 'contain' ? <Minimize2 className="h-5 w-5 text-emerald-400" /> : <Maximize2 className="h-5 w-5 text-zinc-300" />}
            </button>

            {/* Settings button */}
            <button
              onClick={() => setShowSettings(prev => !prev)}
              className={cn(
                'rounded-full p-2.5 text-white backdrop-blur-md border transition-all active:scale-95',
                showSettings ? 'bg-primary border-primary' : 'bg-black/50 border-white/10 hover:bg-white/10'
              )}
              title="Configurações"
            >
              <Settings2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ───── BOTTOM CONTROLS BAR ───── */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 z-30 transition-all duration-300',
          controlsVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
        )}
      >
        <div className="bg-gradient-to-t from-black/95 via-black/70 to-transparent px-4 pb-6 pt-10">
          {/* Quick Script Bar */}
          {!script && !editingScript && (
            <button
              onClick={() => setEditingScript(true)}
              className="mb-4 mx-auto flex max-w-sm w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/20 p-3.5 text-center text-sm font-semibold text-white backdrop-blur-md hover:bg-primary/30 active:scale-98 transition-all shadow-lg"
            >
              <Type className="h-5 w-5 text-primary" />
              <span>Toque aqui para colar seu roteiro</span>
            </button>
          )}

          {script && !editingScript && (
            <div className="mb-4 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-black/60 px-3.5 py-2 backdrop-blur-md border border-white/10">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Type className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate text-xs text-zinc-300">
                  {script.substring(0, 35)}...
                </span>
                <span className="shrink-0 text-[10px] text-zinc-500 font-mono">
                  (~{estimatedSeconds}s)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={resetScroll}
                  className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium text-white hover:bg-white/20"
                  title="Voltar ao início do texto"
                >
                  Início
                </button>
                <button
                  onClick={() => setEditingScript(true)}
                  className="rounded-md bg-primary/20 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/30"
                >
                  Editar
                </button>
              </div>
            </div>
          )}

          {/* Main Action Buttons */}
          <div className="flex items-center justify-center gap-6 sm:gap-8">
            {/* Flip Camera */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={flipCamera}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md border border-white/10 hover:bg-white/25 active:scale-95 transition-all shadow-md"
                title="Girar câmera"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
              <span className="text-[11px] font-medium text-white/60">Girar</span>
            </div>

            {/* Record / Stop Button */}
            <div className="flex flex-col items-center gap-1.5">
              {isRecording ? (
                <button
                  onClick={stopRecording}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-red-600 shadow-xl shadow-red-600/40 hover:bg-red-500 active:scale-95 transition-all border-4 border-white/30"
                  title="Parar gravação"
                >
                  <div className="h-7 w-7 rounded-md bg-white shadow-sm" />
                </button>
              ) : (
                <button
                  onClick={handleRecordClick}
                  disabled={!cameraActive}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-xl shadow-white/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 border-4 border-red-500/20"
                  title="Iniciar gravação"
                >
                  <Video className="h-9 w-9 text-red-600 fill-red-600" />
                </button>
              )}
              <span className="text-[11px] font-semibold text-white/80">
                {isRecording ? 'Parar' : 'Gravar'}
              </span>
            </div>

            {/* Scroll Play/Pause */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={() => {
                  if (!script) {
                    setEditingScript(true);
                    return;
                  }
                  setIsScrolling(prev => !prev);
                }}
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-md border transition-all active:scale-95 shadow-md',
                  isScrolling
                    ? 'bg-primary border-primary text-primary-foreground shadow-primary/30'
                    : 'bg-white/15 border-white/10 text-white hover:bg-white/25'
                )}
                title={isScrolling ? 'Pausar rolagem' : 'Iniciar rolagem'}
              >
                {isScrolling ? (
                  <Pause className="h-5 w-5 fill-current" />
                ) : (
                  <Play className="ml-0.5 h-5 w-5 fill-current" />
                )}
              </button>
              <span className="text-[11px] font-medium text-white/60">
                {isScrolling ? 'Pausar' : 'Rolar'}
              </span>
            </div>
          </div>

          {/* Quick Speed / Last recording banner */}
          {recordedUrl && !isRecording && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setShowReviewModal(true)}
                className="flex items-center gap-2 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-4 py-2 text-xs font-semibold text-emerald-300 backdrop-blur-md hover:bg-emerald-500/30 active:scale-95 transition-all"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Ver última gravação salva
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ───── SCRIPT EDITOR MODAL ───── */}
      {editingScript && (
        <div className="absolute inset-0 z-50 flex flex-col bg-black/95 p-4 sm:p-6 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Type className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-white">Editar Roteiro</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setScript(SAMPLE_SCRIPT)}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/10"
                title="Inserir modelo de exemplo"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                Exemplo
              </button>
              {script && (
                <button
                  onClick={() => setScript('')}
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Limpar
                </button>
              )}
              <button
                onClick={() => {
                  setEditingScript(false);
                  resetScroll();
                }}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/20"
              >
                Concluir
              </button>
            </div>
          </div>

          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Cole ou digite o roteiro do seu vídeo aqui... O texto irá rolar suavemente na tela durante a gravação."
            className="flex-1 resize-none rounded-2xl border border-zinc-700/60 bg-zinc-900/80 p-5 text-base sm:text-lg text-white placeholder-zinc-500 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none leading-relaxed"
            autoFocus
          />

          <div className="mt-3 flex items-center justify-between text-xs text-zinc-400 px-1">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-zinc-500" />
              Tempo estimado de leitura: <strong className="text-white">~{estimatedSeconds} segundos</strong>
            </span>
            <span>
              <strong>{wordCount}</strong> palavras • <strong>{script.length}</strong> caracteres
            </span>
          </div>
        </div>
      )}

      {/* ───── SETTINGS DRAWER ───── */}
      {showSettings && (
        <div className="absolute bottom-0 left-0 right-0 z-40 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-zinc-950/95 p-6 pb-12 backdrop-blur-2xl shadow-2xl animate-in slide-in-from-bottom duration-300">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-bold text-white">Ajustes do Teleprompter</h3>
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="rounded-full bg-white/10 p-2 text-zinc-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Framing Mode (100% Sem corte vs Preencher) */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-white flex items-center gap-2">
                  <Maximize2 className="h-4 w-4 text-primary" /> Enquadramento da Câmera
                </span>
              </div>
              <p className="text-xs text-zinc-400 mb-3">
                {fitMode === 'contain'
                  ? 'Modo 100% Completo: todo o campo de visão da câmera é exibido sem cortar bordas.'
                  : 'Modo Preencher: o vídeo se expande para cobrir 100% da tela cheia.'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setFitMode('contain')}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold border transition-all',
                    fitMode === 'contain'
                      ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20'
                      : 'bg-black/40 text-zinc-300 border-white/10 hover:bg-white/10'
                  )}
                >
                  <Minimize2 className="h-3.5 w-3.5" /> 100% Completo (Sem corte)
                </button>
                <button
                  onClick={() => setFitMode('cover')}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold border transition-all',
                    fitMode === 'cover'
                      ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20'
                      : 'bg-black/40 text-zinc-300 border-white/10 hover:bg-white/10'
                  )}
                >
                  <Maximize2 className="h-3.5 w-3.5" /> Preencher Tela
                </button>
              </div>
            </div>

            {/* Scroll Speed */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Gauge className="h-4 w-4 text-primary" /> Velocidade de Rolagem
                </span>
                <span className="font-mono text-sm font-bold text-primary">{scrollSpeed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.3"
                max="3.5"
                step="0.1"
                value={scrollSpeed}
                onChange={(e) => setScrollSpeed(parseFloat(e.target.value))}
                className="w-full accent-primary h-2 bg-zinc-800 rounded-lg cursor-pointer"
              />
              <div className="mt-3 flex items-center justify-between gap-1">
                {[0.8, 1.2, 1.6, 2.0, 2.5].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setScrollSpeed(speed)}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all',
                      scrollSpeed === speed ? 'bg-primary text-primary-foreground' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    )}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Type className="h-4 w-4 text-primary" /> Tamanho da Letra
                </span>
                <span className="font-mono text-sm font-bold text-primary">{fontSize}px</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setFontSize(p => Math.max(18, p - 2))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-white hover:bg-zinc-700"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
                <input
                  type="range"
                  min="18"
                  max="64"
                  step="2"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                  className="flex-1 accent-primary h-2 bg-zinc-800 rounded-lg cursor-pointer"
                />
                <button
                  onClick={() => setFontSize(p => Math.min(64, p + 2))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-white hover:bg-zinc-700"
                >
                  <ChevronUp className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Countdown before recording */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Clock className="h-4 w-4 text-primary" /> Contagem Regressiva
                </span>
                <span className="font-mono text-sm font-bold text-primary">
                  {countdownSetting === 0 ? 'Sem contagem' : `${countdownSetting}s`}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[0, 3, 5].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setCountdownSetting(sec)}
                    className={cn(
                      'rounded-xl py-2 text-xs font-semibold border transition-all',
                      countdownSetting === sec
                        ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20'
                        : 'bg-black/40 text-zinc-300 border-white/10 hover:bg-white/10'
                    )}
                  >
                    {sec === 0 ? 'Instantâneo' : `${sec} segundos`}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Margins & Dimmer */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Largura do Bloco de Texto</span>
                <span className="font-mono text-xs text-primary">{textWidthPercent}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={textWidthPercent}
                onChange={(e) => setTextWidthPercent(parseInt(e.target.value, 10))}
                className="w-full accent-primary h-2 bg-zinc-800 rounded-lg cursor-pointer mb-4"
              />

              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Escurecimento de Fundo</span>
                <span className="font-mono text-xs text-primary">{bgDimOpacity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                step="10"
                value={bgDimOpacity}
                onChange={(e) => setBgDimOpacity(parseInt(e.target.value, 10))}
                className="w-full accent-primary h-2 bg-zinc-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Mirroring & Guides toggles */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-white block">Linha Guia de Olhar</span>
                  <span className="text-xs text-zinc-400">Guia visual para manter contato com a lente</span>
                </div>
                <button
                  onClick={() => setShowGuideLine(g => !g)}
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors',
                    showGuideLine ? 'bg-primary' : 'bg-zinc-800'
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                      showGuideLine ? 'translate-x-5.5' : 'translate-x-0.5'
                    )}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-white block">Espelhar Texto</span>
                  <span className="text-xs text-zinc-400">Para uso com vidro reflexivo de teleprompter</span>
                </div>
                <button
                  onClick={() => setIsMirroredText(m => !m)}
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors',
                    isMirroredText ? 'bg-primary' : 'bg-zinc-800'
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                      isMirroredText ? 'translate-x-5.5' : 'translate-x-0.5'
                    )}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-white block">Espelhar Vídeo (Selfie)</span>
                  <span className="text-xs text-zinc-400">Inverter visualização horizontal da câmera</span>
                </div>
                <button
                  onClick={() => setIsMirroredVideo(m => !m)}
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors',
                    isMirroredVideo ? 'bg-primary' : 'bg-zinc-800'
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                      isMirroredVideo ? 'translate-x-5.5' : 'translate-x-0.5'
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───── RECORDING REVIEW & DOWNLOAD MODAL ───── */}
      {showReviewModal && recordedUrl && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 p-4 sm:p-6 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-3xl border border-white/15 bg-zinc-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                <h3 className="text-lg font-bold text-white">Gravação Concluída!</h3>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="rounded-full bg-white/10 p-2 text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Video Player */}
            <div className="relative mb-5 flex-1 min-h-0 overflow-hidden rounded-2xl bg-black border border-white/10 flex items-center justify-center">
              <video
                src={recordedUrl}
                controls
                playsInline
                className="max-h-[50vh] w-full object-contain"
              />
            </div>

            {/* Recording details */}
            <div className="mb-5 flex items-center justify-between rounded-xl bg-white/5 px-4 py-2.5 text-xs text-zinc-400 border border-white/5">
              <span>Duração: <strong className="text-white">{formatTime(recordTime)}</strong></span>
              <span>Qualidade: <strong className="text-emerald-400">100% Resolução Nativa</strong></span>
              <span>Tamanho: <strong className="text-white">{recordedBlob ? `${(recordedBlob.size / (1024 * 1024)).toFixed(1)} MB` : 'Pronto'}</strong></span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={downloadRecording}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 active:scale-98 transition-all"
              >
                <Download className="h-5 w-5" /> Baixar Vídeo (.mp4)
              </button>

              <button
                onClick={() => {
                  setShowReviewModal(false);
                  resetScroll();
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-5 py-3.5 text-sm font-semibold text-white hover:bg-white/15 active:scale-98 transition-all"
              >
                <RotateCcw className="h-4 w-4" /> Gravar Novo Take
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
