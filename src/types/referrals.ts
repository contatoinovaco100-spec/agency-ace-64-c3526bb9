export type ReferralStatus = 'enviada' | 'negociacao' | 'fechada';

export interface ReferralClient {
  id: string;
  name: string;
  token: string;
  created_at: string;
}

export interface Referral {
  id: string;
  client_id: string;
  referred_name: string;
  referred_whatsapp: string;
  status: ReferralStatus;
  created_at: string;
  updated_at: string;
}

export interface ReferralTier {
  id: string;
  name: string;
  required_count: number;
  prize_description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const STATUS_LABELS: Record<ReferralStatus, string> = {
  enviada: 'Enviada',
  negociacao: 'Em negociação',
  fechada: 'Fechada',
};
