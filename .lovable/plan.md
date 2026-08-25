# Nova aba: Pré-Produção (Decupagem para os editores)

Uma aba nova no menu lateral com um kanban próprio, onde o decupador recebe o material bruto, faz os cortes e entrega prontos para o editor. Fica separado do kanban de vídeos e do de artes.

## Etapas do board

1. Material Bruto Recebido
2. Em Decupagem (decupador)
3. Cortes Prontos (entrega para o editor)
4. Em Edição (editor)
5. Revisão
6. Finalizado

As etapas ficam editáveis pelo admin na tela de Etapas do Kanban, igual aos outros boards.

## Como os cards chegam nesse board

- O card entra automaticamente quando a tarefa de vídeo recebe o link da pasta com o material bruto (campo já existente no card).
- Também é possível criar um card manualmente pela própria aba.
- É o mesmo card de vídeo (mesmo cliente, roteiro, referências e vídeo final), então o corte entregue pelo decupador segue direto para o editor sem retrabalho, e o vídeo final continua aparecendo no kanban de vídeos e no link do cliente.
- Ao chegar em "Cortes Prontos", o editor marcado recebe notificação; ao chegar em "Finalizado", o card sai da fila de pré-produção.

## Responsáveis

- Dois responsáveis por card: **Decupador** e **Editor**.
- Filtros no topo por decupador, editor, cliente e prazo.
- As notificações e o histórico de movimentação já existentes passam a avisar o decupador e o editor conforme a etapa.

## Visão do card

Abre o mesmo painel de detalhes já usado hoje (Roteiro, Referências, Alteração, Legenda, Vídeo), com um bloco novo de **Decupagem**: link da pasta bruta, marcações de tempo / melhores trechos e observações do decupador para o editor.

## Sumário no topo

Contadores por etapa: aguardando decupagem, em decupagem, cortes prontos, em edição, em revisão e finalizados na semana.

## Detalhes técnicos

- Migração: colunas `decupador` (texto) e `decupagem_notes` (texto) em `tasks`, e registros das 6 etapas em `kanban_stages` para o board `pre`.
- `useKanbanStages`: incluir `'pre'` em `KanbanBoard` + fallbacks das etapas.
- Nova página `src/pages/PreProducaoPage.tsx` reutilizando `TasksPage` (mesmo padrão do `ArtesPage`), com filtro próprio e board `pre`.
- Rota `/pre-producao` em `App.tsx` e item no menu em `src/config/app-pages.ts` (categoria Operacional), respeitando as permissões por página já existentes.
- `TaskDetailPanel`: campos Decupador/Editor e bloco de decupagem.
