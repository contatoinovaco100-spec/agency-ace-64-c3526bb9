import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle, ExternalLink, Download, RotateCw } from 'lucide-react';

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

/**
 * Player universal — <video> nativo, leve, compatível com computadores fracos,
 * iOS Safari, Android Chrome e webviews. Sem crossOrigin (evita bloqueio de CORS),
 * preload leve, detecção de travamento e fallback com download/nova aba.
 */
export default function UniversalVideoPlayer({ src, poster, className = '', reloadKey = 0 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [stalled, setStalled] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // se demorar demais para carregar (máquina/rede lenta), mostra opções alternativas
  useEffect(() => {
    setState('loading');
    setStalled(false);
    const t = setTimeout(() => {
      setState((s) => (s === 'loading' ? (setStalled(true), 'loading') : s));
    }, 12000);
    return () => clearTimeout(t);
  }, [src, reloadKey, attempt]);

  const retry = () => {
    setAttempt((a) => a + 1);
    const v = videoRef.current;
    if (v) {
      v.load();
      v.play().catch(() => {});
    }
  };

  const fallbackLinks = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        onClick={retry}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-2 text-xs font-semibold text-primary"
      >
        <RotateCw className="h-3.5 w-3.5" /> Tentar novamente
      </button>
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
          {state === 'loading' && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/85 px-4 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              {stalled && (
                <>
                  <p className="text-xs text-gray-300">
                    O vídeo está demorando para carregar neste computador.
                  </p>
                  {fallbackLinks}
                </>
              )}
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
            onLoadedMetadata={() => setState('ready')}
            onLoadedData={() => setState('ready')}
            onCanPlay={() => setState('ready')}
            onPlaying={() => setState('ready')}
            onError={() => setState('error')}
            className="w-full max-h-[70vh] bg-black object-contain"
          >
            <source src={src} type={guessMime(src)} />
            <source src={src} type="video/mp4" />
            <source src={src} />
            Seu navegador não suporta a reprodução de vídeo.
          </video>
        </>
      )}
    </div>
  );
}
