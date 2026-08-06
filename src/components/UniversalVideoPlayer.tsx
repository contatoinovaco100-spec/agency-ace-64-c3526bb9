import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle, ExternalLink, Download, RotateCw, Play, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  src: string;
  poster?: string;
  className?: string;
  /** força remontagem externa (botão recarregar) */
  reloadKey?: number;
}

function guessMime(url: string) {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'webm': return 'video/webm';
    case 'ogv':
    case 'ogg': return 'video/ogg';
    case 'mov': return 'video/quicktime';
    case 'm4v': return 'video/x-m4v';
    default: return 'video/mp4';
  }
}

// Detecta H.265/HEVC lendo os primeiros 2MB do arquivo (o box stsd fica no moov).
async function detectHevc(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-2097151' } });
    if (!res.ok) return false;
    const buf = new Uint8Array(await res.arrayBuffer());
    for (let i = 0; i < buf.length - 4; i++) {
      const t = String.fromCharCode(buf[i], buf[i + 1], buf[i + 2], buf[i + 3]);
      if (t === 'hvc1' || t === 'hev1') return true;
    }
    return false;
  } catch {
    return false;
  }
}

function canPlayHevc(): boolean {
  try {
    const v = document.createElement('video');
    return !!(
      v.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"') ||
      v.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"')
    );
  } catch {
    return false;
  }
}

/**
 * Player universal — <video> nativo, leve, compatível com computadores fracos,
 * iOS Safari, Android Chrome e webviews. Sem crossOrigin (evita bloqueio de CORS),
 * detecção de H.265/HEVC (não reproduz em Chrome/Firefox/Edge), e fallback com
 * download/nova aba em vez de spinner infinito.
 */
export default function UniversalVideoPlayer({ src, poster, className = '', reloadKey = 0 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [started, setStarted] = useState(false);
  const [hevcUnsupported, setHevcUnsupported] = useState<boolean>(false);

  const clearSlow = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const armSlow = () => {
    clearSlow();
    timerRef.current = window.setTimeout(() => setSlow(true), 8000);
  };

  // Detecta HEVC (formato que trava em Chrome/Firefox/Edge) e reinicia estados
  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setSlow(false);
    setStarted(false);
    setHevcUnsupported(false);
    armSlow();

    detectHevc(src).then((isHevc) => {
      if (!cancelled && isHevc && !canPlayHevc()) setHevcUnsupported(true);
    });
    return () => {
      cancelled = true;
      clearSlow();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, reloadKey, attempt]);

  const retry = () => {
    setAttempt((a) => a + 1);
    setSlow(false);
    const v = videoRef.current;
    if (v) {
      v.load();
      v.play().catch(() => {});
    }
  };

  const startPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    setStarted(true);
    setSlow(false);
    armSlow();
    // Sem await: o overlay some na hora e o buffering fica visível nos controles nativos.
    video.play().catch(() => {});
  };

  const fallbackLinks = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={retry}
        className="gap-1.5 text-xs font-semibold"
      >
        <RotateCw className="h-3.5 w-3.5" /> Tentar novamente
      </Button>
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
      >
        <ExternalLink className="h-3.5 w-3.5" /> Abrir em nova aba
      </a>
      <a
        href={src}
        download
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-2 text-xs font-semibold text-primary"
      >
        <Download className="h-3.5 w-3.5" /> Baixar vídeo
      </a>
    </div>
  );

  if (hevcUnsupported) {
    return (
      <div className={`relative w-full overflow-hidden rounded-xl border border-yellow-500/40 bg-black ${className}`}>
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <Film className="h-8 w-8 text-yellow-500" />
          <p className="text-sm font-semibold text-white">
            Este vídeo está em formato H.265 (HEVC), que seu navegador não reproduz.
          </p>
          <p className="max-w-md text-xs text-gray-300">
            Abra no Safari (iPhone, iPad ou Mac) ou baixe o arquivo para assistir no computador
            (QuickTime, VLC ou Windows).
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <a
              href={src}
              download
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
            >
              <Download className="h-3.5 w-3.5" /> Baixar vídeo
            </a>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-2 text-xs font-semibold text-primary"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Abrir em nova aba
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full overflow-hidden rounded-xl border border-primary/20 bg-black ${className}`}>
      {state === 'error' ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-yellow-500" />
          <p className="text-sm text-gray-300">
            Não foi possível reproduzir o vídeo aqui. Baixe o arquivo ou abra em nova aba.
          </p>
          {fallbackLinks}
        </div>
      ) : (
        <>
          {!started && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card px-4 text-center">
              <Button
                type="button"
                size="icon"
                onClick={startPlayback}
                className="h-14 w-14 rounded-full shadow-lg"
                aria-label="Reproduzir vídeo"
              >
                <Play className="h-6 w-6 fill-current" />
              </Button>
              <p className="text-sm font-semibold text-foreground">Clique para reproduzir</p>
            </div>
          )}

          {slow && started && (
            <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 bg-black/80 px-4 py-3 text-center backdrop-blur-sm">
              <p className="text-xs text-gray-200">
                <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                Ainda carregando… se demorar, use uma das opções abaixo.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <a href={src} download className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground">
                  <Download className="h-3 w-3" /> Baixar
                </a>
                <a href={src} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-2.5 py-1.5 text-[11px] font-semibold text-white">
                  <ExternalLink className="h-3 w-3" /> Abrir em nova aba
                </a>
              </div>
            </div>
          )}

          <video
            key={`${src}-${reloadKey}-${attempt}`}
            ref={videoRef}
            controls
            playsInline
            webkit-playsinline="true"
            x5-playsinline="true"
            preload="metadata"
            poster={poster}
            disablePictureInPicture={false}
            controlsList="noremoteplayback"
            onCanPlay={() => { clearSlow(); setState('ready'); }}
            onLoadedData={() => { clearSlow(); setState('ready'); }}
            onPlaying={() => { clearSlow(); setState('ready'); }}
            onWaiting={() => { if (started) armSlow(); }}
            onStalled={() => { if (started) armSlow(); }}
            onError={() => setState('error')}
            className="w-full max-h-[70vh] bg-black object-contain"
          >
            <source src={src} type={guessMime(src)} />
            Seu navegador não suporta a reprodução de vídeo.
          </video>
        </>
      )}
    </div>
  );
}
