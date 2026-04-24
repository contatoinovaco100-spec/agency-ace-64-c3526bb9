import {
  LayoutDashboard, Users, Target, CheckSquare, UserCog,
  Shield, FileText, BarChart3, Film, Clapperboard, Palette,
  LayoutList, Bot, Sparkles, Settings, Bell, Calendar,
  MessageSquare, TrendingUp, Images, BookOpen, CalculatorIcon,
  Gift, Link2, ListChecks, Wallet, Network,
} from 'lucide-react';

export type PageCategory =
  | 'Geral'
  | 'Comercial'
  | 'Operacional'
  | 'Produção'
  | 'Ferramentas'
  | 'Administração';

export interface AppPage {
  path: string;
  label: string;
  icon: any;
  category: PageCategory;
  /** Always visible to any authenticated user (no permission needed) */
  alwaysAllowed?: boolean;
  /** Only admins can ever access */
  adminOnly?: boolean;
}

/**
 * SINGLE SOURCE OF TRUTH for all app pages.
 * Add a new entry here whenever you create a new page — it will
 * automatically appear in the sidebar, permissions screen and route guard.
 */
export const APP_PAGES: AppPage[] = [
  // Geral (sempre liberadas)
  { path: '/',                    label: 'Dashboard',           icon: LayoutDashboard, category: 'Geral', alwaysAllowed: true },
  { path: '/minhas-tarefas',      label: 'Minhas Tarefas',      icon: ListChecks,      category: 'Geral', alwaysAllowed: true },
  { path: '/calendario',          label: 'Calendário',          icon: Calendar,        category: 'Geral', alwaysAllowed: true },
  { path: '/notificacoes',        label: 'Notificações',        icon: Bell,            category: 'Geral', alwaysAllowed: true },
  { path: '/chat',                label: 'Chat Interno',        icon: MessageSquare,   category: 'Geral', alwaysAllowed: true },
  { path: '/roleta',              label: 'Roleta de Prêmios',   icon: Gift,            category: 'Geral', alwaysAllowed: true },
  { path: '/negocios',            label: 'Rede de Negócios',    icon: Network,         category: 'Geral', alwaysAllowed: true },

  // Comercial
  { path: '/crm',                 label: 'CRM',                 icon: Target,          category: 'Comercial' },
  { path: '/whatsapp',            label: 'WhatsApp',            icon: MessageSquare,   category: 'Comercial' },
  { path: '/whatsapp/config',     label: 'Config. WhatsApp',    icon: Settings,        category: 'Comercial', adminOnly: true },
  { path: '/prospeccao',          label: 'Prospecção IA',       icon: Bot,             category: 'Comercial' },
  { path: '/proposta',            label: 'Proposta Comercial',  icon: Sparkles,        category: 'Comercial' },
  { path: '/proposta/editar',     label: 'Editar Proposta',     icon: Settings,        category: 'Comercial' },

  // Operacional
  { path: '/clientes',            label: 'Clientes',            icon: Users,           category: 'Operacional' },
  { path: '/tarefas',             label: 'Tarefas (Kanban)',    icon: CheckSquare,     category: 'Operacional' },
  { path: '/planejamento',        label: 'Planejamento',        icon: LayoutList,      category: 'Operacional' },
  { path: '/diagnostico/editar',  label: 'Diagnóstico',         icon: Target,          category: 'Operacional' },
  { path: '/metas',               label: 'Metas',               icon: Target,          category: 'Operacional' },
  { path: '/resultados-semanais', label: 'Resultados Semanais', icon: TrendingUp,      category: 'Operacional' },

  // Produção
  { path: '/galeria',             label: 'Galeria',             icon: Images,          category: 'Produção' },
  { path: '/portfolio',           label: 'Portfólio',           icon: Film,            category: 'Produção' },
  { path: '/portfolio-instagram', label: 'Posts Instagram',     icon: Sparkles,        category: 'Produção' },
  { path: '/gravacoes',           label: 'Gravações',           icon: Clapperboard,    category: 'Produção' },

  // Ferramentas
  { path: '/whiteboard',          label: 'Whiteboard',          icon: Palette,         category: 'Ferramentas' },
  { path: '/linktree',            label: 'Linktree',            icon: Link2,           category: 'Ferramentas' },
  { path: '/onboarding',          label: 'Onboarding Kit',      icon: BookOpen,        category: 'Ferramentas' },
  { path: '/calculadora',         label: 'Calculadora',         icon: CalculatorIcon,  category: 'Ferramentas' },
  { path: '/nova',                label: 'Nova Assistente',     icon: Bot,             category: 'Ferramentas' },

  // Administração (só admin)
  { path: '/funcionarios',        label: 'Funcionários',        icon: UserCog,         category: 'Administração', adminOnly: true },
  { path: '/permissoes',          label: 'Permissões',          icon: Shield,          category: 'Administração', adminOnly: true },
  { path: '/equipe',              label: 'Equipe (legado)',     icon: UserCog,         category: 'Administração', adminOnly: true },
  { path: '/contratos',           label: 'Contratos',           icon: FileText,        category: 'Administração', adminOnly: true },
  { path: '/contratos-prestadores', label: 'Contratos Prestadores', icon: FileText,    category: 'Administração', adminOnly: true },
  { path: '/relatorios',          label: 'Relatórios',          icon: BarChart3,       category: 'Administração', adminOnly: true },
  { path: '/financeiro',          label: 'Financeiro',          icon: Wallet,          category: 'Administração', adminOnly: true },
  { path: '/rede/admin',          label: 'Rede de Negócios',    icon: Network,         category: 'Administração', adminOnly: true },
];

export const PAGE_CATEGORIES: PageCategory[] = [
  'Geral', 'Comercial', 'Operacional', 'Produção', 'Ferramentas', 'Administração',
];

export function getPage(path: string): AppPage | undefined {
  return APP_PAGES.find(p => p.path === path);
}

/** Pages that show up in the permissions UI (excludes always-allowed and admin-only). */
export const PERMISSIONABLE_PAGES = APP_PAGES.filter(
  p => !p.alwaysAllowed && !p.adminOnly,
);

export const EMPLOYEE_EMAIL_DOMAIN = 'inova.mov';
