import type { Client } from '@/types/agency';

/** Mensalidade que entra no MRR/LTV: serviço pontual (avulso) não é receita recorrente */
export const recurringValue = (c: Pick<Client, 'monthlyValue' | 'billingType'>) =>
  c.billingType === 'pontual' ? 0 : Number(c.monthlyValue) || 0;
