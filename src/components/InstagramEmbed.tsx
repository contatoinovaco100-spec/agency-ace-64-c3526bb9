import { useEffect, useRef } from 'react';

interface InstagramEmbedProps {
  url: string;
  captioned?: boolean;
}

declare global {
  interface Window {
    instgrm?: {
      Embeds: {
        process: () => void;
      };
    };
  }
}

let scriptLoaded = false;
let scriptLoading: Promise<void> | null = null;

function loadInstagramScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src*="instagram.com/embed.js"]');
    if (existing) {
      scriptLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.instagram.com/embed.js';
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    document.body.appendChild(script);
  });
  return scriptLoading;
}

export function InstagramEmbed({ url, captioned = true }: InstagramEmbedProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadInstagramScript().then(() => {
      if (cancelled) return;
      // Pequeno delay para garantir que o blockquote foi montado
      setTimeout(() => {
        if (!cancelled && window.instgrm?.Embeds) {
          window.instgrm.Embeds.process();
        }
      }, 50);
    });
    return () => { cancelled = true; };
  }, [url]);

  // Normaliza URL: remove query params para evitar duplicatas
  const cleanUrl = url.split('?')[0].replace(/\/$/, '');

  return (
    <div ref={ref} className="instagram-embed-wrapper">
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={`${cleanUrl}/?utm_source=ig_embed&utm_campaign=loading`}
        data-instgrm-version="14"
        data-instgrm-captioned={captioned ? '' : undefined}
        style={{
          background: '#FFF',
          border: 0,
          borderRadius: '12px',
          boxShadow: '0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)',
          margin: 0,
          maxWidth: '540px',
          minWidth: '280px',
          padding: 0,
          width: '100%',
        }}
      >
        <a href={cleanUrl} target="_blank" rel="noreferrer" style={{ display: 'block', padding: '16px', textDecoration: 'none' }}>
          Ver no Instagram
        </a>
      </blockquote>
    </div>
  );
}
