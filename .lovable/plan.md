## Objetivo
Permitir que o admin renomeie, adicione, remova e reordene as colunas (etapas) dos kanbans de **Tarefas**, **CRM** e **Artes**, com persistência no banco.

## Como vai funcionar
- Nova tabela `kanban_stages` no banco com as colunas de cada quadro (`board`, `name`, `position`, `color`, `is_default`).
- Nova página **"Etapas do Kanban"** no menu lateral (admin-only) com 3 abas (Tarefas / CRM / Artes). Em cada aba:
  - Lista de colunas com arrastar-para-reordenar
  - Botão **Adicionar etapa** (nome + cor)
  - Editar nome inline / mudar cor
  - Excluir etapa (só permite se não houver cards nela; caso contrário pede para mover os cards primeiro)
- Os kanbans (`TasksPage`, `CRMPage`, `ArtesPage`) passam a carregar a lista de colunas dessa tabela em vez de constantes fixas. Cards já existentes com status antigos continuam funcionando — colunas removidas que ainda têm cards aparecem como "Sem etapa".

## Sementes iniciais
Para não quebrar nada, a migração popula `kanban_stages` com as etapas atuais:
- **Tarefas:** Ideias / Backlog, Em Copy, Em Direção, Em Gravação, Em Edição, Revisão, Finalizado, Concluído, Postado, Programado
- **CRM:** Lead novo, Contato iniciado, Reunião agendada, Proposta enviada, Negociação, Cliente fechado, Perdido
- **Artes:** mesmas etapas do quadro de Tarefas filtradas para tipo Arte

## Renomear etapa
Ao renomear, faz UPDATE em massa nos registros (`tasks.status` / `leads.stage`) que usam o nome antigo, para os cards continuarem aparecendo na coluna.

## Restrições
- Apenas admin (`has_role(uid,'admin')`) pode criar/editar/excluir/reordenar. Leitura liberada para qualquer usuário autenticado.
- Etapas marcadas `is_system = true` (ex.: "Postado", "Programado" das Tarefas, "Cliente fechado"/"Perdido" do CRM) podem ser renomeadas e reordenadas mas **não** removidas, porque há regras de negócio amarradas a elas.

## Detalhes técnicos
- Tabela: `kanban_stages(id uuid, board text check in ('tasks','crm','artes'), name text, position int, color text, is_system bool, created_at, updated_at)`, índice único em `(board, name)`.
- RLS: SELECT para `authenticated`; INSERT/UPDATE/DELETE só `admin`.
- Hook novo `useKanbanStages(board)` em `src/hooks/useKanbanStages.ts` retornando `{ stages, loading, refetch, addStage, updateStage, deleteStage, reorder }`.
- Refatorar `TasksPage.tsx`, `CRMPage.tsx`, `ArtesPage.tsx` para consumir o hook. Os mapas de cor (`COLUMN_BG_CLASSES`, etc.) passam a derivar de `stage.color` (paleta fixa de 8 cores semânticas para escolher).
- Rename em massa via função SQL `rename_kanban_stage(board,_old,_new)` SECURITY DEFINER para garantir atomicidade.
- Nova rota `/etapas-kanban` adicionada em `App.tsx` e `src/config/app-pages.ts`.

## Arquivos afetados
- Migração nova: `kanban_stages` + seeds + função `rename_kanban_stage`
- Novo: `src/hooks/useKanbanStages.ts`
- Novo: `src/pages/KanbanStagesPage.tsx`
- Editar: `src/App.tsx`, `src/config/app-pages.ts`
- Editar: `src/pages/TasksPage.tsx`, `src/pages/CRMPage.tsx`, `src/pages/ArtesPage.tsx`
- Editar: `src/lib/taskStatus.ts` (manter compatibilidade)

Confirma para eu implementar?