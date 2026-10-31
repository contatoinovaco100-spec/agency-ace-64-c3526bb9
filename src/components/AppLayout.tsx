import { NavLink } from '@/components/NavLink';
import { useLocation, useNavigate } from 'react-router-dom';
import { BellOff, BellRing, ChevronDown, ChevronLeft, LogOut, Menu, Moon, Plus, Search, Settings, Star, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { usePageAccess } from '@/hooks/useUserRole';
import { usePushNotification } from '@/hooks/usePushNotification';
import { NotificationBell } from '@/components/NotificationBell';
import { APP_PAGES, PAGE_CATEGORIES, type AppPage } from '@/config/app-pages';
import logoInova from '@/assets/logo-inova.png';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProfileSettingsDialog, initialsOf, useMyProfile } from '@/components/ProfileSettingsDialog';
import { ChatDock } from '@/components/ChatDock';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CommandPalette, QUICK_CREATE, SEARCH_SHORTCUT } from '@/components/CommandPalette';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

/** Destinos fixos da barra inferior no celular (os demais ficam em "Mais") */
const MOBILE_TABS = ['/', '/tarefas', '/planner', '/clientes'];
const MOBILE_TAB_LABEL: Record<string, string> = { '/': 'Início', '/tarefas': 'Tarefas', '/planner': 'Planner', '/clientes': 'Clientes' };
const EXTERNAL_PAGES = ['/roleta', '/teleprompter'];

/** Preferências do menu guardadas no navegador: páginas fixadas no topo e seções recolhidas */
function useStoredList(key: string) {
  const [list, setList] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
  });
  const toggle = (item: string) => setList((prev) => {
    const next = prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item];
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* sem armazenamento: vale só nesta aba */ }
    return next;
  });
  return [list, toggle] as const;
}

const isActivePath = (pathname: string, path: string) =>
  pathname === path || (path !== '/' && pathname.startsWith(path));

const iconButton = 'flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { hasPageAccess, isAdmin } = usePageAccess();
  const [profile, setProfile] = useMyProfile();
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const canOpen = (path: string) => isAdmin || hasPageAccess(path);

  // Build nav from registry filtered by permissions, grouped by category
  const visiblePages = APP_PAGES.filter(p => {
    if (p.hidden) return false;
    if (p.adminOnly) return isAdmin;
    return hasPageAccess(p.path);
  });

  const [favorites, toggleFavorite] = useStoredList('menu-favoritos');
  const [collapsedCats, toggleCategory] = useStoredList('menu-secoes-recolhidas');
  const favoritePages = favorites
    .map(path => visiblePages.find(p => p.path === path))
    .filter((p): p is AppPage => !!p);

  const grouped = [
    ...(favoritePages.length ? [{ category: 'Favoritos', items: favoritePages }] : []),
    ...PAGE_CATEGORIES
      .map(cat => ({ category: cat as string, items: visiblePages.filter(p => p.category === cat && !favorites.includes(p.path)) }))
      .filter(g => g.items.length > 0),
  ];

  const mobileTabs = MOBILE_TABS
    .map(path => visiblePages.find(p => p.path === path))
    .filter((p): p is AppPage => !!p);

  // Ao trocar de página: fecha o menu do celular e volta ao topo (o <main> é quem rola, não a janela)
  useEffect(() => {
    setMobileMenuOpen(false);
    mainRef.current?.scrollTo(0, 0);
  }, [location.pathname]);

  const compact = collapsed && !mobileMenuOpen;

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background lg:flex-row">
      {/* Cabeçalho do celular */}
      <header className="sticky top-0 z-30 flex h-14 flex-shrink-0 items-center justify-between border-b border-sidebar-border bg-background/90 px-4 backdrop-blur-md lg:hidden">
        <img src={logoInova} alt="INOVA Co." className="-ml-2 h-10 brightness-0 dark:brightness-100" />
        <div className="flex items-center gap-1">
          <button onClick={() => setSearchOpen(true)} className={iconButton} aria-label="Buscar">
            <Search className="h-4 w-4" />
          </button>
          <QuickCreateMenu canOpen={canOpen} trigger={<button className={iconButton} aria-label="Criar novo"><Plus className="h-5 w-5" /></button>} />
          <NotificationBell side="bottom" />
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

        {/* Busca e criação rápida: alcançáveis de qualquer tela */}
        <div className={cn('hidden gap-1.5 px-3 pb-2 lg:flex', compact && 'lg:flex-col lg:items-center lg:px-2')}>
          <button
            onClick={() => setSearchOpen(true)}
            className={cn(
              'flex h-9 items-center gap-2 rounded-md border border-sidebar-border bg-background/60 px-2.5 text-[13px] text-muted-foreground transition-colors hover:border-border hover:text-foreground',
              compact ? 'w-9 justify-center px-0' : 'flex-1',
            )}
            title={`Buscar (${SEARCH_SHORTCUT})`}
            aria-label="Buscar"
          >
            <Search className="h-4 w-4 shrink-0" />
            {!compact && <>
              <span className="flex-1 text-left">Buscar…</span>
              <kbd className="rounded border border-border px-1.5 font-sans text-[10px] font-medium">{SEARCH_SHORTCUT}</kbd>
            </>}
          </button>
          <QuickCreateMenu
            canOpen={canOpen}
            trigger={
              <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-background/60 text-foreground transition-colors hover:bg-sidebar-accent" title="Criar novo" aria-label="Criar novo">
                <Plus className="h-4 w-4" />
              </button>
            }
          />
        </div>

        <nav className={cn('flex-1 space-y-6 overflow-y-auto pb-4 pt-2', compact ? 'lg:px-2' : 'px-3')}>
          {grouped.map(({ category, items }) => {
            const isActiveItem = (item: AppPage) => [item.path, ...(item.includes ?? [])].some((p) => isActivePath(location.pathname, p));
            // Seção recolhida continua mostrando a página aberta, para ninguém se perder
            const shown = collapsedCats.includes(category) && !compact ? items.filter(isActiveItem) : items;
            return (
              <div key={category} className="space-y-0.5">
                <button
                  onClick={() => toggleCategory(category)}
                  className={cn('group/cat flex w-full items-center gap-1 px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70 transition-colors hover:text-foreground', compact && 'lg:hidden')}
                  aria-expanded={!collapsedCats.includes(category)}
                >
                  {category === 'Favoritos' && <Star className="h-3 w-3 fill-current" />}
                  {category}
                  {collapsedCats.includes(category) && <span className="font-medium normal-case tracking-normal text-muted-foreground/60">· {items.length}</span>}
                  <ChevronDown className={cn('ml-auto h-3 w-3 opacity-0 transition-[transform,opacity] group-hover/cat:opacity-100', collapsedCats.includes(category) && '-rotate-90 opacity-100')} />
                </button>
                {shown.map(item => (
                  <NavItem key={item.path} item={item} compact={compact} active={isActiveItem(item)}
                    favorite={favorites.includes(item.path)} onToggleFavorite={() => toggleFavorite(item.path)} />
                ))}
              </div>
            );
          })}
        </nav>

        <div className="flex-shrink-0 border-t border-sidebar-border p-2">
          {!compact && user && (
            <button
              onClick={() => setProfileOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-sidebar-accent"
              title="Meu perfil"
            >
              <Avatar className="h-8 w-8 shrink-0">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt="" className="object-cover" />}
                <AvatarFallback className="bg-secondary text-xs font-semibold text-foreground">
                  {initialsOf(profile?.full_name, user.email)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0">
                {profile?.full_name && <span className="block truncate text-xs font-semibold text-foreground">{profile.full_name}</span>}
                <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
            </button>
          )}
          <div className={cn('flex items-center gap-0.5', compact && 'lg:flex-col')}>
            <button onClick={signOut} className={cn(iconButton, 'hover:text-destructive')} title="Sair" aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </button>
            <button onClick={() => setProfileOpen(true)} className={iconButton} title="Configurações do perfil" aria-label="Configurações do perfil">
              <Settings className="h-4 w-4" />
            </button>
            <div className={cn('hidden lg:block', !compact && 'ml-auto')} />
            <span className="hidden lg:contents"><NotificationBell /></span>
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

      <ChatDock />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} pages={visiblePages} canOpen={canOpen} />
      <ProfileSettingsDialog open={profileOpen} onOpenChange={setProfileOpen} profile={profile} onProfileChange={setProfile} />

      <main ref={mainRef} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-[1720px] px-4 pb-24 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-8">
          {/* Erro numa tela não derruba o menu; trocar de página tenta de novo */}
          <ErrorBoundary compact key={location.pathname}>{children}</ErrorBoundary>
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

function NavItem({ item, active, compact, favorite, onToggleFavorite }: {
  item: AppPage; active: boolean; compact: boolean; favorite: boolean; onToggleFavorite: () => void;
}) {
  const Icon = item.icon;
  const base = cn(
    'group relative flex h-9 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-colors duration-150',
    compact && 'lg:justify-center lg:px-0',
  );
  const label = <span className={cn('truncate', compact && 'lg:hidden')}>{item.label}</span>;

  const star = !item.highlight && (
    <button
      onClick={onToggleFavorite}
      className={cn(
        'absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/item:opacity-100 [@media(hover:none)]:opacity-50',
        favorite && 'text-warning hover:text-warning',
        compact && 'lg:hidden',
      )}
      title={favorite ? 'Tirar dos favoritos' : 'Fixar nos favoritos'}
      aria-label={favorite ? `Tirar ${item.label} dos favoritos` : `Fixar ${item.label} nos favoritos`}
    >
      <Star className={cn('h-3.5 w-3.5', favorite && 'fill-current')} />
    </button>
  );

  if (EXTERNAL_PAGES.includes(item.path)) {
    return (
      <div className="group/item relative">
        <a href={item.path} target="_blank" rel="noopener noreferrer" title={item.label}
          className={cn(base, !compact && 'pr-8', 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground')}>
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </a>
        {star}
      </div>
    );
  }

  return (
    <div className="group/item relative">
      <NavLink
        to={item.path}
        end={item.path === '/'}
        title={item.label}
        className={cn(
          base,
          !compact && !item.highlight && 'pr-8',
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
      {star}
    </div>
  );
}

/** Botão "+ Novo": abre a página certa já com o formulário de criação */
function QuickCreateMenu({ trigger, canOpen }: { trigger: React.ReactNode; canOpen: (path: string) => boolean }) {
  const navigate = useNavigate();
  const items = QUICK_CREATE.filter((a) => canOpen(a.path));
  if (!items.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Criar</DropdownMenuLabel>
        {items.map(({ label, path, icon: Icon }) => (
          <DropdownMenuItem key={path} onSelect={() => navigate(`${path}?novo=1`)} className="gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
