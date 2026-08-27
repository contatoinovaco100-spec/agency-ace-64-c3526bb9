# Divisão por dia na área de Finalizados

## Objetivo
Agrupar os conteúdos já finalizados por data, tanto na página de **Vídeos Finalizados** quanto na aba **Finalizadas** do kanban de artes, facilitando a visualização do que precisa ser postado em cada dia.

## O que será feito

### 1. Vídeos Finalizados (`/videos-finalizados`)
- Manter o filtro de busca e o botão "Marcar como Postado".
- Dividir a lista em seções por data:
  - **Hoje**, **Amanhã**, dias da semana + data completa.
  - Grupo **"Sem data programada"** para tarefas sem `postDate`/`dueDate`.
- Dentro de cada dia, ordenar por `postTime` (quando existir) e depois por cliente.
- Se não houver vídeos, manter o estado vazio atual.

### 2. Artes Finalizadas (aba "Finalizadas" em `/artes`)
- Substituir a visualização atual da aba **Finalizadas** (que mostra colunas de kanban) por uma lista agrupada por dia.
- Usar o mesmo critério de data (`postDate` ou `dueDate`).
- Preservar as ações do card:
  - abrir detalhe,
  - duplicar,
  - pré-visualizar anexos,
  - reabrir/reverter etapa.
- Manter o contador de finalizadas no botão da aba.

### 3. Helper compartilhado
- Criar/utilizar `src/lib/kanbanDateGroups.ts` para evitar duplicar a lógica de agrupamento e rótulos de datas.

## Arquivos envolvidos
- `src/pages/VideosFinalizadosPage.tsx`
- `src/pages/TasksPage.tsx` (renderização da aba `arteTab === 'done'`)
- `src/lib/kanbanDateGroups.ts` (função de agrupamento reutilizável)

## Não será alterado
- Estrutura do banco de dados ou RLS.
- Lógica de finalização/postagem dos cards.
- Kanban de produção em andamento (aba "Em produção").
