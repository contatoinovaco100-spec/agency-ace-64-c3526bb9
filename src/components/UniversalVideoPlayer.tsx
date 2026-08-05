import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle, ExternalLink, Download, RotateCw, Play } from 'lucide-react';
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

/**
 * Player universal — <video> nativo, leve, compatível com computadores fracos,
 * iOS Safari, Android Chrome e webviews. Sem crossOrigin (evita bloqueio de CORS),
 * preload leve, detecção de travamento e fallback com download/nova aba.
 */
export default function UniversalVideoPlayer({ src, poster, className = '', reloadKey = 0 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [started, setStarted] = useState(false);

  const clearSlow = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Só marca "demorando" depois de um tempo sem progresso de reprodução.
  // NUNCA vira estado de erro — carregamento lento não é erro.
  const armSlow = () => {
    clearSlow();
    timerRef.current = window.setTimeout(() => setSlow(true), 15000);
  };

  // reinicia sempre que troca fonte/tenta de novo
  useEffect(() => {
    setState('loading');
    setSlow(false);
    setStarted(false);
    armSlow();
    return clearSlow;
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

  const startPlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    setStarted(true);
    setSlow(false);
    armSlow();
    try {
      await video.play();
      setState('ready');
    } catch {
      setState('error');
    }
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
           {state === 'loading' && !started && (
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
               {slow && (
                <>
                  <p className="text-xs text-gray-300">
                     O vídeo ainda está carregando. Se demorar, use as opções abaixo.
                  </p>
                  {fallbackLinks}
                </>
              )}
            </div>
          )}

           {state === 'loading' && started && (
             <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card/95 px-4 text-center">
               <Loader2 className="h-7 w-7 animate-spin text-primary" />
               <p className="text-sm text-muted-foreground">
                 {slow ? 'O vídeo está demorando para carregar em sua conexão…' : 'Preparando vídeo…'}
               </p>
               {slow && (
                 <div className="mt-1 flex flex-col items-center gap-2">
                   <p className="text-xs text-gray-300">Se continuar assim, use uma das opções:</p>
                   {fallbackLinks}
                 </div>
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
            onCanPlay={() => { if (started) { clearSlow(); setState('ready'); } }}
            onLoadedData={() => { if (started) { clearSlow(); setState('ready'); } }}
            onPlaying={() => { clearSlow(); setState('ready'); }}
            onWaiting={() => { if (started) { setState('loading'); armSlow(); } }}
            onStalled={() => { if (started) armSlow(); }}
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
