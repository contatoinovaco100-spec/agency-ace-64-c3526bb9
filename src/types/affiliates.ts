export type AffiliateStatus = 'em_analise' | 'aprovado' | 'reprovado' | 'suspenso';
export type AffiliateLeadStatus = 'novo' | 'em_negociacao' | 'convertido' | 'perdido';
export type AffiliateContractStatus = 'ativo' | 'pendente' | 'cancelado' | 'inadimplente';
export type AffiliateCommissionType = 'fechamento' | 'recorrencia';
export type AffiliateCommissionStatus = 'pendente' | 'pago';

export interface Affiliate {
  id: string;
  user_id: string | null;
  full_name: string;
  cpf_cnpj: string;
  whatsapp: string;
  email: string;
  instagram: string;
  city_state: string;
  how_found: string;
  sales_experience: boolean;
  pix_key: string;
  slug: string | null;
  status: AffiliateStatus;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AffiliateLead {
  id: string;
  affiliate_id: string;
  lead_name: string;
  whatsapp: string;
  company: string;
  email: string;
  status: AffiliateLeadStatus;
  notes: string;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AffiliateContract {
  id: string;
  affiliate_id: string;
  lead_id: string | null;
  client_name: string;
  monthly_value: number;
  signed_at: string | null;
  status: AffiliateContractStatus;
  cancelled_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface AffiliateCommission {
  id: string;
  affiliate_id: string;
  contract_id: string;
  type: AffiliateCommissionType;
  amount: number;
  reference_month: string;
  status: AffiliateCommissionStatus;
  paid_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
