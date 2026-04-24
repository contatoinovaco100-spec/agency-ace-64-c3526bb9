export type RedePostType = 'atualizacao' | 'oferecendo' | 'procurando';

export interface RedeCompany {
  id: string;
  owner_user_id: string | null;
  name: string;
  logo_url: string;
  description: string;
  niche: string;
  services: string[];
  city: string;
  whatsapp: string;
  instagram: string;
  website: string;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RedePost {
  id: string;
  company_id: string;
  author_user_id: string | null;
  content: string;
  media_url: string;
  media_type: '' | 'image' | 'video';
  post_type: RedePostType;
  is_featured: boolean;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  company?: RedeCompany;
}

export const POST_TYPE_LABELS: Record<RedePostType, string> = {
  atualizacao: 'Atualização',
  oferecendo: 'Oferecendo serviço',
  procurando: 'Procurando serviço',
};

/** Nichos disponíveis — Marketing intencionalmente excluído. */
export const NICHES = [
  'Tecnologia',
  'Construção Civil',
  'Indústria',
  'Comércio Varejista',
  'Alimentação',
  'Educação',
  'Saúde',
  'Estética e Beleza',
  'Moda',
  'Eventos',
  'Logística',
  'Jurídico',
  'Contábil',
  'Imobiliário',
  'Automotivo',
  'Turismo',
  'Agronegócio',
  'Serviços Financeiros',
  'Consultoria',
  'Outros',
];

/** Termos proibidos em serviços/posts (foco anti-marketing). */
export const FORBIDDEN_TERMS = [
  'marketing',
  'social media',
  'gestão de redes',
  'tráfego pago',
  'trafego pago',
  'ads',
  'anúncio pago',
  'anuncio pago',
  'agência de marketing',
  'agencia de marketing',
];

export function containsForbidden(text: string): string | null {
  const t = text.toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    if (t.includes(term)) return term;
  }
  return null;
}
