

## Unificar Equipe com Funcionários

Hoje **Equipe** e **Funcionários** são duas listas independentes:

| Aba | Tabela | O que faz |
|---|---|---|
| Funcionários (`/funcionarios`) | `profiles` (com `username`) | Cria login real + permissões de página |
| Equipe (`/equipe`) | `team_members` (legada) | Cadastro manual usado em dropdowns de "Responsável" em Tarefas/CRM |

Resultado atual: quem você cria em Funcionários **não aparece** em Equipe nem nos seletores de responsável das tarefas. Precisa cadastrar duas vezes.

### Solução: Equipe passa a refletir os Funcionários

**1. Página Equipe (`/equipe`) vira somente leitura dos Funcionários**
- Lê de `profiles` (filtrando `username IS NOT NULL`, igual à página Funcionários)
- Mostra: nome, cargo (`job_title`), e-mail (`username@domínio`), badge Admin/Inativo, contagem de tarefas pendentes (mantém)
- Remove botões "Novo Membro", edição inline e exclusão
- Adiciona aviso: *"Para adicionar ou editar membros, vá em Funcionários"* + botão de atalho para `/funcionarios`

**2. AgencyContext expõe `team` baseado em `profiles`**
- Substituir o fetch de `team_members` por fetch de `profiles` filtrando `username IS NOT NULL` e `is_active = true`
- Mapear para o tipo `TeamMember` existente: `name = full_name`, `role = job_title`, `email = username@domínio`, `permissions = is_admin ? 'Admin' : 'Editor'`
- Manter assinatura `team: TeamMember[]` para não quebrar `CRMPage`, `TasksPage`, `TaskDetailPanel`, `MyTasksPage` etc. que já consomem `team` para os dropdowns de responsável
- Remover `addTeamMember` / `updateTeamMember` / `deleteTeamMember` (não usados em mais nenhum lugar além de TeamPage)

**3. Tabela `team_members`**
- Mantém-se na base intocada por enquanto (não vamos apagar dados). Apenas deixa de ser lida/escrita pelo app.

### Resultado
- Cadastrou um Funcionário → ele aparece automaticamente na **Equipe** e nos **dropdowns de responsável** de Tarefas e CRM
- Uma única fonte de verdade
- Nenhuma migration de banco necessária

