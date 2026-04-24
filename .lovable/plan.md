

# Restringir acesso da Rede de Negócios

Empresas parceiras logadas só devem ver o feed `/negocios` e seu perfil `/rede/perfil`. Não devem acessar Dashboard, Tarefas, Clientes, etc. — nada da plataforma interna da Inova.

## Como funciona hoje (problema)

- Qualquer usuário autenticado (incluindo empresas da Rede) tem acesso a páginas marcadas como `alwaysAllowed` (Dashboard, Minhas Tarefas, Calendário, Chat, Notificações, Roleta).
- Após login, empresas caem em `/minhas-tarefas` e veem o sidebar inteiro da Inova.
- Não existe diferenciação de "tipo de usuário" — só admin vs não-admin.

## Solução

Criar um conceito de **"usuário de empresa parceira"**: identificado por ter um registro em `rede_companies.owner_user_id = user.id`. Esses usuários ficam confinados à Rede.

### 1. Hook novo `useIsRedeCompanyUser`
Em `src/hooks/useUserRole.ts`, adicionar hook que consulta `rede_companies` pelo `owner_user_id` do usuário logado. Retorna `{ isRedeCompanyUser, companyId, loading }`.

### 2. Atualizar `usePageAccess` (`src/hooks/useUserRole.ts`)
- Se `isRedeCompanyUser` (e não é admin), liberar **somente** `/negocios`, `/rede/perfil`, `/rede/novo` e `/login`.
- Ignorar todas as flags `alwaysAllowed` para esse tipo de usuário.
- Bloquear qualquer outra rota.

### 3. Atualizar `ProtectedRoute` (`src/components/ProtectedRoute.tsx`)
- Se usuário é da Rede e tenta acessar qualquer rota fora da whitelist → redireciona para `/negocios`.
- Admin continua com acesso total; funcionários Inova continuam com regras atuais.

### 4. Redirecionamento pós-login (`src/pages/LoginPage.tsx`)
Após login bem-sucedido, checar nesta ordem:
1. Admin → `/`
2. Empresa da Rede (`rede_companies.owner_user_id = user.id`) → `/negocios`
3. Demais → `/minhas-tarefas`

### 5. Esconder sidebar/AppLayout para empresas da Rede
Como `/negocios` já é rota pública (fora do `AppLayout`), empresas da Rede nunca verão o sidebar da Inova ao navegar pelo feed. Mas precisamos garantir que `/rede/perfil` e `/rede/novo` (que estão dentro do `AppLayout`) também NÃO mostrem o sidebar interno para usuários da Rede.

Solução: mover essas duas rotas para fora do `AppLayout` em `src/App.tsx` — elas terão seu próprio header simples (botões "Voltar ao feed" e "Sair") já presentes no código. Adicionar `/rede/perfil` e `/rede/novo` ao bloco `isPublicPage` (com guard interno: redirecionam para `/login` se não autenticado, igual já fazem hoje).

### 6. Header no feed `/negocios` para empresas logadas
No `RedeNegociosPage.tsx`, quando o usuário é uma empresa da Rede, mostrar botões: "Meu perfil" (`/rede/perfil`), "Nova publicação" (`/rede/novo`) e "Sair". Sem nenhum link para áreas internas da Inova.

## Detalhes técnicos

**Arquivos editados:**
- `src/hooks/useUserRole.ts` — novo hook `useIsRedeCompanyUser` + ajuste em `usePageAccess`
- `src/components/ProtectedRoute.tsx` — guard de redirecionamento para empresas da Rede
- `src/pages/LoginPage.tsx` — lógica de redirecionamento por tipo de usuário
- `src/App.tsx` — mover `/rede/perfil` e `/rede/novo` para fora do `AppLayout`
- `src/pages/RedeNegociosPage.tsx` — botão "Sair" e CTAs contextuais para empresas logadas

**Sem mudanças no banco** — a relação `rede_companies.owner_user_id` já é o suficiente para identificar o tipo de usuário. RLS continua igual.

**Comportamento final:**
- Login de empresa da Rede → cai em `/negocios` → só vê o feed, seu perfil e botão de nova publicação. Tentar acessar `/`, `/clientes`, `/tarefas` etc. → redireciona para `/negocios`.
- Admin e funcionários Inova → comportamento atual preservado.

