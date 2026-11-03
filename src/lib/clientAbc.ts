import { useMemo } from 'react';
import type { Client } from '@/types/agency';
import { recurringValue } from '@/lib/clientBilling';
import { useAgency } from '@/contexts/AgencyContext';

export type AbcLetter = 'A' | 'B' | 'C';

export type ClientAbc = {
  letter: AbcLetter;
  /** Letra pela curva (antes da escolha manual) */
  auto: AbcLetter;
  manual: boolean;
  /** Parte do faturamento recorrente que o cliente representa (0–1) */
  share: number;
};

/**
 * Curva ABC pelo valor mensal dos clientes ativos e pausados: os maiores, que somam até 80% do
 * faturamento, são A; os próximos até 95%, B; o resto (e os pontuais, sem valor recorrente), C.
 * Cancelados ficam sem letra. A letra escolhida à mão (abcClass) vale por cima da curva.
 */
export function computeAbc(clients: Client[]): Record<string, ClientAbc> {
  const live = clients.filter((c) => c.status !== 'Cancelado' && !c.deletedAt);
  const total = live.reduce((s, c) => s + recurringValue(c), 0);
  const sorted = [...live].sort((a, b) => recurringValue(b) - recurringValue(a));
  const out: Record<string, ClientAbc> = {};
  let before = 0;
  for (const c of sorted) {
    const value = recurringValue(c);
    const share = total > 0 ? value / total : 0;
    // Pela soma antes dele: o maior cliente é sempre A, mesmo que sozinho passe de 80%
    const auto: AbcLetter = value <= 0 || total <= 0 ? 'C' : before < 0.8 ? 'A' : before < 0.95 ? 'B' : 'C';
    before += share;
    out[c.id] = { letter: c.abcClass || auto, auto, manual: !!c.abcClass, share };
  }
  return out;
}

export function useClientAbc() {
  const { clients } = useAgency();
  return useMemo(() => computeAbc(clients), [clients]);
}

export const ABC_STYLES: Record<AbcLetter, string> = {
  A: 'bg-success/15 text-success border-success/30',
  B: 'bg-warning/15 text-warning border-warning/30',
  C: 'bg-muted text-muted-foreground border-border',
};

export const ABC_HINT: Record<AbcLetter, string> = {
  A: 'Cliente A: os maiores, que somam até 80% do faturamento',
  B: 'Cliente B: os próximos, até 95% do faturamento',
  C: 'Cliente C: os menores (e os pontuais)',
};
