import {
  LayoutDashboard, Users, Target, CheckSquare, UserCog,
  Shield, FileText, BarChart3,   Film, Clapperboard, Palette, Play,
  LayoutList, Bot, Sparkles, Settings, Bell, Calendar, CalendarDays,
  MessageSquare, TrendingUp, Images, BookOpen, CalculatorIcon,
  Gift, Link2, Video, Rocket, NotebookPen, ListChecks, Search, Wallet, Network, Layers, KeyRound, UsersRound, Trophy, Scissors, Gauge, Bug,
} from 'lucide-react';

export type PageCategory =
  | 'Geral'
  | 'Postagens'
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
  /** Only visible to approved affiliates */
  affiliateOnly?: boolean;
  /** Only admins can ever access */
  adminOnly?: boolean;
  /** Do not render in sidebar (still routable) */
  hidden?: boolean;
  /** Render in a highlighted style in the sidebar (e.g. Publicar) */
  highlight?: boolean;
  /** Página que reúne outras em abas: liberada para quem tem acesso a qualquer uma delas */
  includes?: string[];

}

/**
 * SINGLE SOURCE OF TRUTH for all app pages.
 * Add a new entry here whenever you create a new page — it will
 * automatically appear in the sidebar, permissions screen and route guard.
 */
export const APP_PAGES: AppPage[] = [
  // Geral
  { path: '/',                    label: 'Dashboard',           icon: LayoutDashboard, category: 'Geral' },
  { path: '/desempenho',          label: 'Desempenho da Equipe', icon: Gauge,          category: 'Administração', adminOnly: true, hidden: true },
  // Meu dia: resumo pessoal do dia, com Minhas Tarefas como segunda aba
  { path: '/meu-dia',             label: 'Meu dia',             icon: Sparkles,        category: 'Geral', alwaysAllowed: true, includes: ['/minhas-tarefas'] },
  { path: '/minhas-tarefas',      label: 'Minhas Tarefas',      icon: ListChecks,      category: 'Geral', hidden: true },
  // Agenda reúne Calendário, Gravações e Escala semanal em abas (cada aba mantém o próprio endereço e permissão)
  { path: '/agenda',              label: 'Agenda',              icon: Calendar,        category: 'Geral', includes: ['/calendario', '/gravacoes', '/agenda-videos'] },
  { path: '/calendario',          label: 'Calendário',          icon: Calendar,        category: 'Geral', hidden: true },
  { path: '/notificacoes',        label: 'Notificações',        icon: Bell,            category: 'Geral' },
  // A troca de senha agora fica em Meu perfil (rodapé do menu); a página continua no endereço antigo
  { path: '/alterar-senha',       label: 'Alterar Senha',       icon: KeyRound,        category: 'Geral', alwaysAllowed: true, hidden: true },
  { path: '/historico-kanban',    label: 'Histórico Kanban',    icon: Bell,            category: 'Geral', alwaysAllowed: true, hidden: true },
  { path: '/chat',                label: 'Chat Interno',        icon: MessageSquare,   category: 'Geral' },

  { path: '/roleta',              label: 'Roleta de Prêmios',   icon: Gift,            category: 'Geral' },
  // { path: '/negocios',            label: 'Rede de Negócios',    icon: Network,         category: 'Geral' },

  // Postagens (publicar + relatórios de cliente)
  { path: '/publicar',            label: 'Publicar Conteúdo',    icon: Sparkles,        category: 'Postagens', highlight: true, includes: ['/publicacoes'] },
  { path: '/publicacoes',         label: 'Histórico de Posts',   icon: ListChecks,      category: 'Postagens', hidden: true },
  { path: '/automacoes',          label: 'Automações WhatsApp', icon: MessageSquare,   category: 'Postagens' },
  { path: '/redes-sociais',       label: 'Redes Sociais',        icon: Network,         category: 'Postagens' },
  { path: '/portfolio-instagram', label: 'Posts Instagram',      icon: Sparkles,        category: 'Postagens', hidden: true },
  { path: '/instagram-analytics', label: 'Relatório Cliente',    icon: BarChart3,       category: 'Postagens' },
  // Sem uso (fila vazia): fora do menu, rota mantida
  { path: '/instagram-automacao', label: 'Fila Instagram',       icon: Sparkles,        category: 'Postagens', adminOnly: true, hidden: true },

  // Comercial
  { path: '/crm',                 label: 'CRM',                 icon: Target,          category: 'Comercial' },
  // { path: '/whatsapp',            label: 'WhatsApp',            icon: MessageSquare,   category: 'Comercial' },
  // { path: '/whatsapp/config',     label: 'Config. WhatsApp',    icon: Settings,        category: 'Comercial', adminOnly: true },
  { path: '/prospeccao',          label: 'Prospecção IA',       icon: Bot,             category: 'Comercial' },
  { path: '/consulta-cnpj',       label: 'Consulta CNPJ',       icon: Search,          category: 'Comercial' },
  { path: '/time-comercial',      label: 'Time Comercial',      icon: TrendingUp,      category: 'Comercial' },
  // { path: '/proposta',            label: 'Proposta Comercial',  icon: Sparkles,        category: 'Comercial' },
  // { path: '/proposta/editar',     label: 'Editar Proposta',     icon: Settings,        category: 'Comercial' },

  // Operacional
  { path: '/clientes',            label: 'Clientes',            icon: Users,           category: 'Operacional' },
  { path: '/tarefas',             label: 'Tarefas (Kanban)',    icon: CheckSquare,     category: 'Operacional' },
  // Substituído pelo Planner (o endereço antigo leva para lá)
  { path: '/calendario-postagens', label: 'Calendário Posts',   icon: CalendarDays,    category: 'Operacional', hidden: true },
  { path: '/planner',             label: 'Planner',             icon: CalendarDays,    category: 'Operacional', includes: ['/calendario-postagens'] },
  { path: '/onboarding-clientes', label: 'Onboarding Clientes', icon: Rocket,          category: 'Operacional' },
  { path: '/briefings',           label: 'Briefings',           icon: FileText,        category: 'Operacional' },
  { path: '/artes',               label: 'Artes Estáticas',     icon: Palette,         category: 'Operacional' },
  { path: '/videos-finalizados',  label: 'Vídeos Finalizados',  icon: Play,            category: 'Operacional' },
  { path: '/agenda-videos',       label: 'Agenda de Vídeos',    icon: CalendarDays,    category: 'Operacional', hidden: true },
  { path: '/pre-producao',        label: 'Pré-Produção',        icon: Scissors,        category: 'Operacional' },
  { path: '/editor-video',        label: 'Editor de Vídeo',     icon: Scissors,        category: 'Operacional' },
  { path: '/escopos',             label: 'Escopo do Cliente',   icon: ListChecks,      category: 'Operacional' },
  { path: '/nota-cliente',        label: 'Nota do Cliente',     icon: Gauge,           category: 'Operacional' },
  { path: '/observacoes-semanais', label: 'Observações Semanais', icon: NotebookPen,    category: 'Operacional' },
  // Planejamento reúne o gerador com IA e a importação de PDF/planilha em abas
  { path: '/planejamento',        label: 'Planejamento',        icon: LayoutList,      category: 'Operacional', includes: ['/planejamento-pdf'] },
  { path: '/planejamento-pdf',    label: 'Planejamento PDF',     icon: FileText,        category: 'Operacional', hidden: true },
  { path: '/diagnostico/editar',  label: 'Diagnóstico',         icon: Target,          category: 'Operacional' },
  // { path: '/metas',               label: 'Metas',               icon: Target,          category: 'Operacional' },
  // { path: '/resultados-semanais', label: 'Resultados Semanais', icon: TrendingUp,      category: 'Operacional' },

  // Produção
  // { path: '/galeria',             label: 'Galeria',             icon: Images,          category: 'Produção' },
  // Portfólio reúne os vídeos e os posts do Instagram da vitrine em abas
  { path: '/portfolio',           label: 'Portfólio',           icon: Film,            category: 'Produção', includes: ['/portfolio-instagram'] },
  { path: '/gravacoes',           label: 'Gravações',           icon: Clapperboard,    category: 'Produção', hidden: true },
  { path: '/teleprompter',        label: 'Teleprompter',        icon: Video,           category: 'Produção' },

  // Ferramentas
  { path: '/whiteboard',          label: 'Whiteboard',          icon: Palette,         category: 'Ferramentas' },
  { path: '/linktree',            label: 'Linktree',            icon: Link2,           category: 'Ferramentas' },
  { path: '/onboarding',          label: 'Onboarding Kit',      icon: BookOpen,        category: 'Ferramentas' },
  { path: '/calculadora',         label: 'Calculadora',         icon: CalculatorIcon,  category: 'Ferramentas' },
  { path: '/nova',                label: 'Nova Assistente',     icon: Bot,             category: 'Ferramentas' },
  { path: '/diagnostico-anuncios', label: 'Diagnóstico de Anúncios', icon: BarChart3,    category: 'Ferramentas' },
  { path: '/quiz-builder',        label: 'Quiz Builder',        icon: Layers,          category: 'Ferramentas', adminOnly: true },
  { path: '/figma-to-lp',         label: 'Figma → LP',          icon: Palette,         category: 'Ferramentas', adminOnly: true },


  // Administração (só admin)
  // Equipe reúne Funcionários, Squads e Desempenho em abas (cada aba mantém o próprio endereço)
  { path: '/equipe',              label: 'Equipe',              icon: UsersRound,      category: 'Administração', adminOnly: true, includes: ['/funcionarios', '/squads', '/desempenho'] },
  { path: '/funcionarios',        label: 'Funcionários',        icon: UserCog,         category: 'Administração', adminOnly: true, hidden: true },
  { path: '/squads',              label: 'Squads',              icon: UsersRound,      category: 'Administração', adminOnly: true, hidden: true },
  // Sem dados (nenhum post viral importado): fora do menu, rota mantida
  { path: '/ranking-viral',       label: 'Ranking Viral',       icon: Trophy,          category: 'Administração', adminOnly: true, hidden: true },
  { path: '/erros',               label: 'Erros da plataforma', icon: Bug,             category: 'Administração', adminOnly: true },
  { path: '/etapas-kanban',       label: 'Etapas do Kanban',    icon: Layers,          category: 'Administração', adminOnly: true },

  { path: '/contratos',           label: 'Contratos',           icon: FileText,        category: 'Administração', adminOnly: true },
  { path: '/contratos-prestadores', label: 'Contratos Prestadores', icon: FileText,    category: 'Administração', adminOnly: true },
  { path: '/relatorios',          label: 'Relatórios',          icon: BarChart3,       category: 'Administração', adminOnly: true },
  { path: '/financeiro',          label: 'Financeiro',          icon: Wallet,          category: 'Administração', adminOnly: true },
  // { path: '/rede/admin',          label: 'Rede de Negócios',    icon: Network,         category: 'Administração', adminOnly: true },
  { path: '/afiliados-admin',     label: 'Programa de Afiliados', icon: Gift,          category: 'Administração', adminOnly: true },
  { path: '/afiliado/leads',        label: 'Meus Leads',          icon: Target,          category: 'Geral', affiliateOnly: true },
  { path: '/afiliado/contratos',    label: 'Meus Contratos',      icon: FileText,        category: 'Geral', affiliateOnly: true },
  { path: '/afiliado/comissoes',    label: 'Minhas Comissões',    icon: Wallet,          category: 'Geral', affiliateOnly: true },
  { path: '/afiliado/info',         label: 'Regras do Programa',  icon: BookOpen,        category: 'Geral', affiliateOnly: true },
  { path: '/afiliado/vitrine',      label: 'Nossos Serviços',     icon: Film,            category: 'Geral', affiliateOnly: true },
  { path: '/afiliado/video-aulas',  label: 'Vídeo Aulas',         icon: Play,            category: 'Geral', affiliateOnly: true },
];

export const PAGE_CATEGORIES: PageCategory[] = [
  'Geral', 'Postagens', 'Comercial', 'Operacional', 'Produção', 'Ferramentas', 'Administração',
];

export function getPage(path: string): AppPage | undefined {
  return APP_PAGES.find(p => p.path === path);
}

/** Pages that show up in the permissions UI (excludes always-allowed and admin-only). */
export const PERMISSIONABLE_PAGES = APP_PAGES.filter(
  p => !p.alwaysAllowed && !p.adminOnly,
);

export const EMPLOYEE_EMAIL_DOMAIN = 'inova.mov';
