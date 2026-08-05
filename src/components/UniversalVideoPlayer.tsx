import { useRef, useState } from 'react';
import { Loader2, AlertTriangle, ExternalLink } from 'lucide-react';

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
 * Player universal — usa o <video> nativo (compatível com iOS Safari, Android
 * Chrome, desktop e webviews de Instagram/WhatsApp) com playsInline,
 * fallback de MIME type e mensagem de erro amigável.
 */
export default function UniversalVideoPlayer({ src, poster, className = '', reloadKey = 0 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  return (
    <div className={`relative w-full overflow-hidden rounded-xl border border-primary/20 bg-black ${className}`}>
      {state === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 pointer-events-none">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      )}

      {state === 'error' ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-yellow-500" />
          <p className="text-sm text-gray-300">Não foi possível reproduzir o vídeo neste aparelho.</p>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Abrir vídeo em nova aba
          </a>
        </div>
      ) : (
        <video
          key={`${src}-${reloadKey}`}
          ref={videoRef}
          controls
          playsInline
          // @ts-expect-error atributos legados necessários em iOS/Android antigos
          webkit-playsinline="true"
          x5-playsinline="true"
          preload="metadata"
          poster={poster}
          controlsList="nodownload noremoteplayback"
          crossOrigin="anonymous"
          onLoadedMetadata={() => setState('ready')}
          onCanPlay={() => setState('ready')}
          onError={() => setState('error')}
          className="w-full max-h-[70vh] bg-black object-contain"
        >
          <source src={src} type={guessMime(src)} />
          <source src={src} />
          Seu navegador não suporta a reprodução de vídeo.
        </video>
      )}
    </div>
  );
}
