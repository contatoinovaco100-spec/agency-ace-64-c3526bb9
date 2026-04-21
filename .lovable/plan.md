

## Plano: Sistema de Funcionários com E-mail Fictício e Permissões Auto-Atualizáveis

### O que será construído

**1. Cadastro de funcionário sem e-mail real** (`/funcionarios`)
- Admin define apenas: nome, cargo, "usuário" (ex: `marcos`) e senha
- Sistema gera automaticamente o e-mail interno: `{usuario}@inova.mov`
- Sem envio de e-mail de confirmação (auto-confirmado via service_role)
- Funcionário faz login normalmente com `marcos@inova.mov` + senha
- Admin pode resetar senha a qualquer momento (define nova senha direto, sem link por e-mail)

**2. Registry centralizado de páginas** (`src/config/app-pages.ts`)
- Arquivo único com a lista de TODAS as páginas do sistema (path, label, ícone, categoria, se é admin-only)
- **Toda página nova criada na plataforma só precisa ser adicionada nesse arquivo** — automaticamente aparece no menu lateral, no controle de permissões e na proteção de rotas
- Categorias: Comercial, Operacional, Produção, Financeiro, Administração

**3. Permissões granulares por página**
- Nova tabela `user_page_access` (user_id + page_path) substitui o controle antigo por módulo
- Página `/permissoes` reformulada:
  - Lista todos os funcionários com avatar e usuário
  - Para cada um, mostra **todas as páginas do registry agrupadas por categoria** com toggles
  - Botão "Liberar tudo" / "Bloquear tudo" por funcionário
  - Botão "Copiar permissões de outro funcionário"
  - Aviso visual quando uma página nova é detectada no registry mas ninguém tem acesso ainda

**4. Painel "Minhas Tarefas"** (`/minhas-tarefas`)
- Página padrão para funcionários ao logar (admin continua indo para `/`)
- Mostra apenas tarefas onde o funcionário é responsável (assignee, copywriter, editor, director, videomaker, script_writer batem com seu nome)
- Visão Kanban + Lista, com filtros (prioridade, prazo, cliente)
- Resumo no topo: pendentes, atrasadas, para hoje
- Funcionário pode mover tarefa entre colunas e comentar

**5. Menu lateral dinâmico**
- Lê o registry de páginas + permissões do usuário
- Mostra somente o que ele pode acessar, agrupado por categoria
- Admin sempre vê tudo

### Estrutura técnica

**Banco de dados (migração):**
- Nova tabela `user_page_access (user_id uuid, page_path text, unique(user_id, page_path))` com RLS: admin gerencia, usuário lê o próprio
- Coluna `username` em `profiles` (string única, ex: "marcos")
- Coluna `job_title` em `profiles`
- Coluna `is_active` em `profiles` (boolean, default true)
- Função `has_page_access(_user_id uuid, _path text)` security definer

**Edge Functions (usam service_role):**
- `create-employee` — cria usuário no auth com `email_confirm: true`, gera e-mail `{username}@inova.mov`, cria profile, popula `user_page_access` com as páginas marcadas
- `reset-employee-password` — admin define nova senha diretamente
- `delete-employee` — desativa (`is_active = false`) sem apagar histórico

**Frontend:**
- `src/config/app-pages.ts` — registry central (fonte única de verdade)
- `src/pages/EmployeesPage.tsx` (nova) — gestão de funcionários
- `src/pages/PermissionsPage.tsx` (reformulada) — toggles por página agrupados por categoria
- `src/pages/MyTasksPage.tsx` (nova) — painel do funcionário
- `src/hooks/useUserRole.ts` — adicionar `usePageAccess()` lendo `user_page_access`
- `src/components/ProtectedRoute.tsx` — checa `hasPageAccess(pathname)` em vez de módulo
- `src/components/AppLayout.tsx` (sidebar) — menu construído a partir do registry filtrado por permissões
- `src/App.tsx` — pós-login: admin → `/`, funcionário → `/minhas-tarefas`

### Fluxo de uso

```text
ADMIN cadastra funcionário              FUNCIONÁRIO
├─ Nome: Marcos Silva                    │
├─ Cargo: Editor                         │
├─ Usuário: marcos                       │
│  → e-mail gerado: marcos@inova.mov     │
├─ Senha: ••••••••                       │
└─ Marca páginas liberadas ──────────────┼─→ login com marcos@inova.mov
                                         │
ADMIN cria nova página /relatorios-x     ├─ vai para /minhas-tarefas
└─ Adiciona em app-pages.ts              │  (vê só suas tarefas)
   → aparece em /permissoes              │
   com aviso "nova página"               │  Menu lateral mostra
                                         │  apenas páginas liberadas
```

### Decisões importantes

- **E-mail fictício**: domínio fixo `@inova.mov` (configurável no código). Nenhum e-mail real é enviado.
- **Auto-confirmação**: service_role cria usuários já confirmados (sem link de verificação).
- **Reset de senha**: admin define nova senha direto na interface (não há fluxo "esqueci minha senha" para funcionários, já que não têm e-mail real).
- **Páginas sempre liberadas**: Dashboard, Calendário, Notificações, Chat (configurável no registry com flag `alwaysAllowed`).
- **Páginas só admin** (flag `adminOnly` no registry): Funcionários, Permissões, Contratos, Despesas, Relatórios.
- **Atualizar quando criar página nova**: basta adicionar uma linha em `src/config/app-pages.ts` — o restante do sistema (menu, permissões, proteção de rotas) lê dali automaticamente.
- **Migração dos dados atuais**: a página `/equipe` (puramente visual) é mantida temporariamente. Acessos por módulo existentes serão convertidos em acessos por página correspondentes.

### Ordem de implementação

1. Migração do banco (`user_page_access`, colunas em `profiles`, função `has_page_access`)
2. Registry `src/config/app-pages.ts`
3. Edge Functions (`create-employee`, `reset-employee-password`, `delete-employee`)
4. Página `/funcionarios` (admin)
5. Página `/permissoes` reformulada (toggles por página + auto-detecção de páginas novas)
6. Página `/minhas-tarefas` (funcionário)
7. Atualizar `ProtectedRoute`, sidebar e redirecionamento pós-login

