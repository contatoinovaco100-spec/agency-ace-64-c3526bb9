# Nova aba: Pós-Produção (Decupador + Editor)

Uma aba nova no menu lateral com um kanban próprio para o fluxo de pós-produção, separado do kanban de vídeos e do de artes.

## Etapas do board

1. Material Bruto Recebido
2. Decupagem (decupador)
3. Roteiro de Corte (decupador)
4. Em Edição (editor)
5. Revisão Interna
6. Ajustes
7. Finalizado

As etapas ficam editáveis pelo admin na tela de Etapas do Kanban, igual aos outros boards.

## Como os cards chegam nesse board

- O card entra automaticamente na aba quando a tarefa de vídeo recebe o link da pasta de material bruto (campo já existente no card) ou quando é movida para "Em Gravação" concluída.
- Também é possível criar um card manualmente pela própria aba.
- O card é o mesmo card de vídeo (mesmo cliente, roteiro, referências e vídeo final), então o que o editor sobe aqui continua aparecendo no link do cliente e no kanban de vídeos.

## Responsáveis

- Cada card tem dois responsáveis distintos: **Decupador** e **Editor**.
- Filtros no topo por decupador, editor, cliente e prazo.
- A notificação e o histórico de movimentação já existentes passam a avisar o decupador e o editor conforme a etapa.

## Visão do card

Abre o mesmo painel de detalhes já usado hoje, com as abas Roteiro, Referências, Alteração, Legenda e Vídeo — mais um bloco de decupagem (marcações de tempo / melhores trechos) que o editor lê antes de editar.

## Sumário no topo

Contadores por etapa: aguardando decupagem, em decupagem, em edição, em revisão, ajustes e finalizados na semana.

## Detalhes técnicos

- Migração: nova coluna `decupador` em `tasks`, coluna `decupagem_notes` (texto) e novos registros em `kanban_stages` para o board `pos`.
- `useKanbanStages`: incluir `'pos'` em `KanbanBoard` + fallbacks das 7 etapas.
- Nova página `src/pages/PosProducaoPage.tsx` reutilizando `TasksPage` (mesmo padrão do `ArtesPage`), com `taskTypeFilter` próprio e board `pos`.
- Rota `/pos-producao` em `App.tsx` e item no menu em `src/config/app-pages.ts` (categoria Operacional), respeitando as permissões por página já existentes.
- `TaskDetailPanel`: campos Decupador/Editor e aba de decupagem.
