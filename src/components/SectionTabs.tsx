import { Navigate, NavLink } from 'react-router-dom';
import { usePageAccess } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';

export type SectionTab = { path: string; label: string };

/** Abas da Agenda: cada uma continua no próprio endereço (o login do Google volta para /calendario) */
export const AGENDA_TABS: SectionTab[] = [
  { path: '/calendario', label: 'Calendário' },
  { path: '/gravacoes', label: 'Gravações' },
  { path: '/agenda-videos', label: 'Escala semanal' },
];

export const PUBLISH_TABS: SectionTab[] = [
  { path: '/publicar', label: 'Nova publicação' },
  { path: '/publicacoes', label: 'Histórico' },
];

/** Faixa de abas acima de páginas que viraram uma seção só; mostra só as abas que o usuário pode abrir */
export function SectionTabs({ tabs, children }: { tabs: SectionTab[]; children: React.ReactNode }) {
  const { hasPageAccess, loading } = usePageAccess();
  const visible = loading ? tabs : tabs.filter((t) => hasPageAccess(t.path));
  return (
    <div className="space-y-5">
      {visible.length > 1 && (
        <nav aria-label="Seções" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1">
          {visible.map((t) => (
            <NavLink key={t.path} to={t.path} end
              className={({ isActive }) => cn(
                'flex h-8 shrink-0 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors',
                isActive ? 'bg-card text-foreground card-shadow' : 'text-muted-foreground hover:text-foreground',
              )}>
              {t.label}
            </NavLink>
          ))}
        </nav>
      )}
      {children}
    </div>
  );
}

/** Endereço da seção (/agenda): abre a primeira aba liberada para o usuário */
export function SectionRedirect({ tabs }: { tabs: SectionTab[] }) {
  const { hasPageAccess, loading } = usePageAccess();
  if (loading) return null;
  const first = tabs.find((t) => hasPageAccess(t.path)) ?? tabs[0];
  return <Navigate to={first.path} replace />;
}
