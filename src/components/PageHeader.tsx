import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Rótulo curto acima do título (ex.: "Operacional") */
  eyebrow?: React.ReactNode;
  /** Botões e filtros do topo; quebram linha no celular */
  actions?: React.ReactNode;
  className?: string;
}

/** Cabeçalho padrão das páginas internas: mesma hierarquia em todas as telas. */
export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{eyebrow}</p>
        )}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[28px] sm:leading-9">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground [text-wrap:pretty]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
