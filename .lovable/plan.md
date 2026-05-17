## Programa de Afiliados Innova

Sistema completo de afiliados com cadastro público, aprovação admin, links únicos de rastreamento, captura de leads, contratos e comissões recorrentes.

### 1. Banco de Dados (migração)

Novas tabelas:

- **affiliates**
  - `id`, `user_id` (FK auth.users, null até criar conta), `full_name`, `cpf_cnpj`, `whatsapp`, `email`, `instagram`, `city_state`, `how_found`, `sales_experience` (bool), `slug` (único, gerado na aprovação), `status` (`em_analise` | `aprovado` | `reprovado` | `suspenso`), `approved_at`, `approved_by`, timestamps
- **affiliate_leads**
  - `id`, `affiliate_id` (FK), `lead_name`, `whatsapp`, `company`, `email`, `status` (`novo` | `em_negociacao` | `convertido` | `perdido`), `notes`, `converted_at`, timestamps
- **affiliate_contracts**
  - `id`, `affiliate_id`, `lead_id`, `client_name`, `monthly_value`, `signed_at`, `status` (`ativo` | `pendente` | `cancelado` | `inadimplente`), `cancelled_at`, timestamps
- **affiliate_commissions**
  - `id`, `affiliate_id`, `contract_id`, `type` (`fechamento` | `recorrencia`), `amount` (R$300 ou R$100), `reference_month` (date), `status` (`pendente` | `pago`), `paid_at`, timestamps

Enums via CHECK constraints. RLS:
- `affiliates`: insert público (cadastro), select próprio + admin, update admin
- `affiliate_leads`: insert público (via link), select próprio afiliado + admin
- `affiliate_contracts` / `affiliate_commissions`: select próprio + admin, write admin

Função `generate_monthly_recurring_commissions()` para gerar R$100 mensal para contratos ativos (rodar manualmente via botão admin ou cron futuro).

### 2. Páginas públicas (sem auth)

- **`/afiliados/cadastro`** — formulário de cadastro do afiliado, cria registro com status `em_analise` + conta auth (signUp). Mostra mensagem "Cadastro em análise".
- **`/in/:slug`** — landing simples com formulário de lead (nome, whatsapp, empresa, email). Insere em `affiliate_leads` vinculado ao afiliado pelo slug. Só funciona se afiliado `aprovado`.

Rotas adicionadas em `App.tsx` na lista `isPublicPage`.

### 3. Painel do Afiliado (autenticado)

- **`/afiliado`** — dashboard do afiliado logado:
  - Status do cadastro (se não aprovado, mostra aviso)
  - Link único copiável + share WhatsApp
  - Lista de leads
  - Lista de contratos ativos
  - Comissões: pendentes vs pagas, totais
- `ProtectedRoute` permite acesso se usuário tem registro em `affiliates`.

### 4. Painel Admin

- **`/afiliados-admin`** — nova rota admin-only:
  - Tab "Afiliados": lista com filtro por status, ações aprovar/reprovar/suspender
  - Tab "Leads": todos os leads com afiliado responsável
  - Tab "Contratos": criar contrato a partir de lead convertido, editar status (ativo/pendente/cancelado/inadimplente)
  - Tab "Comissões": lista, marcar como pago, botão "Gerar recorrência do mês" (R$100 por contrato ativo)

Aprovação gera `slug` a partir do nome (`nomedoafiliado`) garantindo unicidade.

### 5. Sidebar / navegação

Adicionar em `src/config/app-pages.ts`:
- `/afiliados-admin` → "Programa de Afiliados" (categoria Administração, adminOnly)
- `/afiliado` → "Meu Afiliado" (alwaysAllowed para quem tem registro)

### 6. Regras de comissão (código)

- Ao mudar contrato para `ativo` pela primeira vez (signed_at preenchido) → inserir comissão `fechamento` R$300 status `pendente`.
- Botão admin "Gerar recorrência mensal" → insere R$100 `recorrencia` para cada contrato `ativo` no mês de referência (constraint única por contract_id + reference_month).
- Cancelar contrato (`cancelado`) → para de gerar recorrência (filtro no gerador).
- Marcar comissão como `pago` → preenche `paid_at`.

### Arquivos a criar/editar

Novos:
- `supabase/migrations/<timestamp>_affiliates.sql`
- `src/types/affiliates.ts`
- `src/pages/AffiliateSignupPage.tsx`
- `src/pages/AffiliateLandingPage.tsx` (`/in/:slug`)
- `src/pages/AffiliateDashboardPage.tsx` (`/afiliado`)
- `src/pages/AffiliatesAdminPage.tsx` (`/afiliados-admin`)

Editar:
- `src/App.tsx` — rotas + lista pública
- `src/config/app-pages.ts` — entradas de menu

### Detalhes técnicos

- Auth: usa Supabase Auth padrão (email+senha). Após signUp, insere row em `affiliates` com `user_id`.
- Slug: gerado no momento da aprovação a partir de `full_name` (slugify + sufixo numérico se conflito).
- Validação: zod nos formulários (nome, email, whatsapp, CPF formato).
- Estilo: tema escuro padrão do sistema (#000000 / #BFF720). Página `/in/:slug` light theme (regra de páginas públicas de contrato).
- Sem integração com tabela `clients` existente — afiliados é fluxo separado.
- Comissão recorrente: gerada manualmente pelo admin (cron pode ser adicionado depois).

Após aprovação do plano, executo a migração e implemento todos os arquivos.