import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { BellOff, BellRing, ChevronLeft, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { usePageAccess } from '@/hooks/useUserRole';
import { usePushNotification } from '@/hooks/usePushNotification';
import { TaskMoveHistoryBell } from '@/components/TaskMoveHistoryBell';
import { APP_PAGES, PAGE_CATEGORIES, type AppPage } from '@/config/app-pages';
import logoInova from '@/assets/logo-inova.png';

/** Destinos fixos da barra inferior no celular (os demais ficam em "Mais") */
const MOBILE_TABS = ['/', '/tarefas', '/planner', '/clientes'];
const MOBILE_TAB_LABEL: Record<string, string> = { '/': 'Início', '/tarefas': 'Tarefas', '/planner': 'Planner', '/clientes': 'Clientes' };
const EXTERNAL_PAGES = ['/roleta', '/teleprompter'];

const isActivePath = (pathname: string, path: string) =>
  pathname === path || (path !== '/' && pathname.startsWith(path));

const iconButton = 'flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { hasPageAccess, isAdmin } = usePageAccess();

  // Build nav from registry filtered by permissions, grouped by category
  const visiblePages = APP_PAGES.filter(p => {
    if (p.hidden) return false;
    if (p.adminOnly) return isAdmin;
    return hasPageAccess(p.path);
  });

  const grouped = PAGE_CATEGORIES
    .map(cat => ({ category: cat, items: visiblePages.filter(p => p.category === cat) }))
    .filter(g => g.items.length > 0);

  const mobileTabs = MOBILE_TABS
    .map(path => visiblePages.find(p => p.path === path))
    .filter((p): p is AppPage => !!p);

  // Fecha o menu do celular ao trocar de página
  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  const compact = collapsed && !mobileMenuOpen;

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background lg:flex-row">
      {/* Cabeçalho do celular */}
      <header className="sticky top-0 z-30 flex h-14 flex-shrink-0 items-center justify-between border-b border-sidebar-border bg-background/90 px-4 backdrop-blur-md lg:hidden">
        <img src={logoInova} alt="INOVA Co." className="-ml-2 h-10 brightness-0 dark:brightness-100" />
        <div className="flex items-center gap-1">
          <TaskMoveHistoryBell />
          <ThemeToggle />
        </div>
      </header>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-full w-[272px] flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] lg:static lg:z-auto lg:translate-x-0 lg:transition-[width]',
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
          collapsed ? 'lg:w-[68px]' : 'lg:w-[248px]',
        )}
      >
        <div className={cn('flex h-14 flex-shrink-0 items-center gap-2 px-4 lg:h-16', compact && 'lg:justify-center lg:px-0')}>
          <img
            src={logoInova}
            alt="INOVA Co."
            className={cn('-ml-2 h-11 brightness-0 dark:brightness-100', compact && 'lg:ml-0 lg:h-9 lg:w-12 lg:object-cover')}
          />
          <button onClick={() => setMobileMenuOpen(false)} className={cn(iconButton, 'ml-auto lg:hidden')} aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className={cn('flex-1 space-y-6 overflow-y-auto pb-4 pt-2', compact ? 'lg:px-2' : 'px-3')}>
          {grouped.map(({ category, items }) => (
            <div key={category} className="space-y-0.5">
              <div className={cn('px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70', compact && 'lg:hidden')}>
                {category}
              </div>
              {items.map(item => (
                <NavItem key={item.path} item={item} active={isActivePath(location.pathname, item.path)} compact={compact} />
              ))}
            </div>
          ))}
        </nav>

        <div className="flex-shrink-0 border-t border-sidebar-border p-2">
          {!compact && user && (
            <div className="flex items-center gap-2.5 px-2 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase text-foreground">
                {user.email?.[0] ?? '?'}
              </div>
              <span className="truncate text-xs font-medium text-muted-foreground">{user.email}</span>
            </div>
          )}
          <div className={cn('flex items-center gap-0.5', compact && 'lg:flex-col')}>
            <button onClick={signOut} className={cn(iconButton, 'hover:text-destructive')} title="Sair" aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </button>
            <div className={cn('hidden lg:block', !compact && 'ml-auto')} />
            <span className="hidden lg:contents"><TaskMoveHistoryBell /></span>
            <AudioActivator />
            <span className="hidden lg:contents"><ThemeToggle /></span>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={cn(iconButton, 'hidden lg:flex')}
              title={collapsed ? 'Expandir menu' : 'Recolher menu'}
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              <ChevronLeft className={cn('h-4 w-4 transition-transform duration-300', collapsed && 'rotate-180')} />
            </button>
          </div>
        </div>
      </aside>

      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-[1720px] px-4 pb-24 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-8">
          {children}
        </div>
      </main>

      {/* Barra inferior do celular */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-sidebar-border bg-background/95 backdrop-blur-md lg:hidden">
        <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${mobileTabs.length + 1}, minmax(0, 1fr))` }}>
          {mobileTabs.map(tab => {
            const active = isActivePath(location.pathname, tab.path) && !mobileMenuOpen;
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.path === '/'}
                className={cn('relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors', active ? 'text-foreground' : 'text-muted-foreground')}
              >
                {active && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-tally" />}
                <Icon className="h-5 w-5" />
                {MOBILE_TAB_LABEL[tab.path] ?? tab.label}
              </NavLink>
            );
          })}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className={cn('relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium', mobileMenuOpen ? 'text-foreground' : 'text-muted-foreground')}
            aria-label="Abrir menu completo"
          >
            {mobileMenuOpen && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-tally" />}
            <Menu className="h-5 w-5" />
            Mais
          </button>
        </div>
      </nav>
    </div>
  );
}

function NavItem({ item, active, compact }: { item: AppPage; active: boolean; compact: boolean }) {
  const Icon = item.icon;
  const base = cn(
    'group relative flex h-9 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-colors duration-150',
    compact && 'lg:justify-center lg:px-0',
  );
  const label = <span className={cn('truncate', compact && 'lg:hidden')}>{item.label}</span>;

  if (EXTERNAL_PAGES.includes(item.path)) {
    return (
      <a href={item.path} target="_blank" rel="noopener noreferrer" title={item.label}
        className={cn(base, 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground')}>
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </a>
    );
  }

  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      title={item.label}
      className={cn(
        base,
        item.highlight
          ? 'bg-brand text-brand-foreground font-semibold shadow-sm hover:bg-brand/90'
          : active
            ? 'bg-sidebar-accent text-foreground'
            : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground',
      )}
      activeClassName=""
    >
      {/* Luz de tally: marca a página ativa */}
      {active && !item.highlight && <span className={cn('absolute -left-3 top-2 bottom-2 w-[3px] rounded-r-full bg-tally', compact && 'lg:-left-2')} />}
      <Icon className={cn('h-4 w-4 shrink-0', active && !item.highlight && 'text-primary')} />
      {label}
    </NavLink>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={iconButton}
      title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function AudioActivator() {
  const { primeAudio, isPrimed } = usePushNotification();

  return (
    <button
      onClick={primeAudio}
      className={cn(iconButton, !isPrimed && 'text-warning hover:text-warning')}
      title={isPrimed ? 'Alertas sonoros ativos' : 'Ativar alertas sonoros'}
      aria-label={isPrimed ? 'Alertas sonoros ativos' : 'Ativar alertas sonoros'}
    >
      {isPrimed ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
    </button>
  );
}
