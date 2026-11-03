import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Adesivo lima inclinado: no máximo um por tela, no número ou palavra mais importante. */
export function Sticker({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('sticker', className)}>{children}</span>;
}

/** Painel azul (o do diagnóstico): só no topo de telas de resumo, como o Meu Dia. */
export function SpotlightPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('spotlight-panel relative overflow-hidden rounded-2xl p-5 text-spotlight-foreground sm:p-7', className)}>
      <div className="relative z-[1]">{children}</div>
    </section>
  );
}
