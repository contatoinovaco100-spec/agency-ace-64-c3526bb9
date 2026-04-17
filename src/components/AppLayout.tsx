import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Target, CheckSquare, UserCog,
  ChevronLeft, LogOut, Shield, FileText, BarChart3, Film,
  Clapperboard, Palette, LayoutList, Bot, Sparkles, Settings,
  Bell, BellRing, Calendar, MessageSquare, Goal, TrendingUp,
  Images, BookOpen, CalculatorIcon, Gift, Link2, Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useModuleAccess, type AppModule } from '@/hooks/useUserRole';
import { usePushNotification } from '@/hooks/usePushNotification';
import logoInova from '@/assets/logo-inova.png';

type NavItem = { title: string; url: string; icon: any; module?: AppModule };

const allNavItems: NavItem[] = [
  { title: 'Dashboard',          url: '/',                     icon: LayoutDashboard },
  { title: 'Roleta de Prêmios',  url: '/roleta',               icon: Gift },
  { title: 'CRM',                url: '/crm',                  icon: Target,        module: 'comercial' },
  { title: 'Clientes',           url: '/clientes',             icon: Users,         module: 'operacional' },
  { title: 'Tarefas',            url: '/tarefas',              icon: CheckSquare,   module: 'operacional' },
  { title: 'Galeria',            url: '/galeria',              icon: Images,        module: 'operacional' },
  { title: 'Planejamento',       url: '/planejamento',         icon: LayoutList,    module: 'operacional' },
  { title: 'Portfólio',          url: '/portfolio',            icon: Film,          module: 'operacional' },
  { title: 'Gravações',          url: '/gravacoes',            icon: Clapperboard,  module: 'operacional' },
  { title: 'Whiteboard',         url: '/whiteboard',           icon: Palette },
  { title: 'Prospecção IA',      url: '/prospeccao',           icon: Bot,           module: 'comercial' },
  { title: 'Diagnóstico',        url: '/diagnostico/editar',   icon: Target,        module: 'operacional' },
  { title: 'Linktree',           url: '/linktree',             icon: Link2 },
  { title: 'Proposta Comercial', url: '/proposta',             icon: Sparkles,      module: 'comercial' },
  { title: 'Editar Proposta',    url: '/proposta/editar',      icon: Settings,      module: 'comercial' },
  { title: 'Onboarding Kit',     url: '/onboarding',           icon: BookOpen },
  { title: 'Calculadora',        url: '/calculadora',          icon: CalculatorIcon },
  { title: 'Calendário',         url: '/calendario',           icon: Calendar },
  { title: 'Chat Interno',       url: '/chat',                 icon: MessageSquare },
  { title: 'Nova Assistente',    url: '/nova',                 icon: Bot },
  { title: 'Metas',              url: '/metas',                icon: Target },
  { title: 'Resultados Semanais',url: '/resultados-semanais',  icon: TrendingUp },
  { title: 'Notificações',       url: '/notificacoes',         icon: Bell },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { hasModule, isAdmin } = useModuleAccess();

  const navItems = [
    ...allNavItems.filter(item => !item.module || hasModule(item.module)),
    ...(isAdmin ? [
      { title: 'Equipe', url: '/equipe', icon: UserCog },
      { title: 'Contratos', url: '/contratos', icon: FileText },
      { title: 'Contratos de Prestadores', url: '/contratos-prestadores', icon: FileText },
      { title: 'Relatórios', url: '/relatorios', icon: BarChart3 },
      { title: 'Permissões', url: '/permissoes', icon: Shield },
    ] : []),
  ];

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  return (
    <div className="flex h-screen w-full bg-background flex-col lg:flex-row overflow-hidden">
      {/* Mobile Header */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-sidebar px-4 lg:hidden sticky top-0 z-50">
        <img src={logoInova} alt="INOVA Co." className="h-8" />
        <button
          onClick={toggleMobileMenu}
          className="p-2 text-muted-foreground hover:text-foreground"
        >
          <Palette className="h-6 w-6" />
        </button>
      </header>

      {/* Sidebar Overlay (Mobile) */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-full flex-col border-r border-border bg-sidebar transition-all duration-300 lg:static',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          collapsed ? 'lg:w-16' : 'lg:w-60',
          'w-60 flex-shrink-0'
        )}
      >
        {/* Logo (Desktop) */}
        <div className="hidden h-14 items-center gap-2 border-b border-border px-4 lg:flex flex-shrink-0">
          <img src={logoInova} alt="INOVA Co." className={cn('transition-all duration-300', collapsed ? 'h-8 w-8 object-contain' : 'h-8')} />
          {!collapsed && <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">v1.1</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.url || (item.url !== '/' && location.pathname.startsWith(item.url));
            return (
              <NavLink
                key={item.url}
                to={item.url}
                end={item.url === '/'}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-body transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
                activeClassName=""
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className={cn('transition-all duration-300', collapsed ? 'lg:hidden' : 'block')}>
                  {item.title}
                </span>
              </NavLink>
            );
          })}
        </nav>

        {/* User & Logout */}
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

      {/* Main */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background h-full">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
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
