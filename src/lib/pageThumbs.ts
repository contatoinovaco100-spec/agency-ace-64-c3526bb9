/**
 * Capas (thumbnails) fixas por tipo de página pública.
 * Usadas no og:image / twitter:image quando o link é compartilhado
 * (WhatsApp, Instagram, LinkedIn, etc.).
 * Os arquivos ficam em /public/og e são servidos na raiz do domínio.
 */
export const PAGE_THUMBS = {
  ads: '/og/og-ads.jpg',
  diagnostico: '/og/og-diag.jpg',
  conteudo: '/og/og-conteudo.jpg',
  comercial: '/og/og-comercial.jpg',
} as const;

export type PageThumb = keyof typeof PAGE_THUMBS;
