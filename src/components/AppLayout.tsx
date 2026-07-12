import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { ChevronLeft, LogOut, Palette, Bell, BellRing } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { usePageAccess } from '@/hooks/useUserRole';
import { usePushNotification } from '@/hooks/usePushNotification';
import { TaskMoveHistoryBell } from '@/components/TaskMoveHistoryBell';
import { APP_PAGES, PAGE_CATEGORIES } from '@/config/app-pages';
import logoInova from '@/assets/logo-inova.png';


export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { hasPageAccess, isAdmin } = usePageAccess();

  // Build nav from registry filtered by permissions, grouped by category
  const visiblePages = APP_PAGES.filter(p => {
    if (p.adminOnly) return isAdmin;
    return hasPageAccess(p.path);
  });

  const grouped = PAGE_CATEGORIES
    .map(cat => ({ category: cat, items: visiblePages.filter(p => p.category === cat) }))
    .filter(g => g.items.length > 0);

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  return (
    <div className="flex h-screen w-full bg-background flex-col lg:flex-row overflow-hidden">
      {/* Mobile Header */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-sidebar px-4 lg:hidden sticky top-0 z-50">
        <img src={logoInova} alt="INOVA Co." className="h-8" />
        <button onClick={toggleMobileMenu} className="p-2 text-muted-foreground hover:text-foreground">
          <Palette className="h-6 w-6" />
        </button>
      </header>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-full flex-col border-r border-border bg-sidebar transition-all duration-300 lg:static',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          collapsed ? 'lg:w-16' : 'lg:w-60',
          'w-60 flex-shrink-0'
        )}
      >
        <div className="hidden h-14 items-center gap-2 border-b border-border px-4 lg:flex flex-shrink-0">
          <img src={logoInova} alt="INOVA Co." className={cn('transition-all duration-300', collapsed ? 'h-8 w-8 object-contain' : 'h-8')} />
          {!collapsed && <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">v1.2</span>}
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
          {grouped.map(({ category, items }) => (
            <div key={category} className="space-y-1">
              {!collapsed && (
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {category}
                </div>
              )}
              {items.map(item => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                const Icon = item.icon;
                if (item.path === '/roleta') {
                  return (
                    <a
                      key={item.path}
                      href={item.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-body transition-all duration-200',
                        'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className={cn('transition-all duration-300', collapsed ? 'lg:hidden' : 'block')}>
                        {item.label}
                      </span>
                    </a>
                  );
                }

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-body transition-all duration-200',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    )}
                    activeClassName=""
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className={cn('transition-all duration-300', collapsed ? 'lg:hidden' : 'block')}>
                      {item.label}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-border flex-shrink-0">
          {(!collapsed || mobileMenuOpen) && user && (
            <div className="px-4 py-2 text-xs text-muted-foreground truncate font-medium">
              {user.email}
            </div>
          )}
          <div className="flex items-center justify-between p-2">
            <button
              onClick={signOut}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-all duration-200 hover:text-destructive',
                collapsed && !mobileMenuOpen ? 'w-full justify-center' : 'flex-1'
              )}
              title="Sair"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {(!collapsed || mobileMenuOpen) && <span>Sair</span>}
            </button>
            <div className="flex items-center gap-1">
              <AudioActivator collapsed={collapsed && !mobileMenuOpen} />
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="hidden lg:flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-all duration-200 hover:bg-secondary hover:text-foreground"
              >
                <ChevronLeft className={cn('h-4 w-4 transition-all duration-300', collapsed && 'rotate-180')} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background h-full">
        <div className="mx-auto w-full max-w-screen-2xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function AudioActivator({ collapsed }: { collapsed: boolean }) {
  const { primeAudio, isPrimed } = usePushNotification();

  return (
    <button
      onClick={primeAudio}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md transition-all duration-300",
        isPrimed
          ? "text-primary bg-primary/10"
          : "text-amber-500 bg-amber-500/10 animate-pulse hover:bg-amber-500/20"
      )}
      title={isPrimed ? "Alertas Ativos" : "Clique para Ativar Alertas"}
    >
      {isPrimed ? <Bell className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
    </button>
  );
}
