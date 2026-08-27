# Recuperar as marcações dos últimos funcionários

## O que foi encontrado

- 37 tarefas estão com o responsável marcado como texto de ex-funcionário:
  - `[Ex-funcionário: lucas]` — 19 tarefas (vídeos de autoescola, clínica, imóveis etc.)
  - `[Ex-funcionário: Marcos Romero]` — 18 tarefas (vídeos Lauer, doces, prova social etc.)
  - 1 tarefa também tem `[Ex-funcionário: lucas]` no campo Videomaker.
- A tabela de Equipe hoje só tem 2 cadastros: **Fernando Veloso** e um registro chamado **"Scanner Admin"** com e-mail estranho (`scannerkix7szh56e@web-library.net`) — provável resquício do incidente de segurança.
- Existem perfis de acesso recentes com os nomes **Lucas Maia** e **Marcos Romero** não aparece na Equipe.

## O que será feito

1. **Restaurar as marcações**: trocar `[Ex-funcionário: lucas]` por **Lucas Maia** e `[Ex-funcionário: Marcos Romero]` por **Marcos Romero** nas 37 tarefas (campo responsável) e no campo Videomaker da tarefa afetada.
2. **Recadastrar na Equipe**: criar novamente os cadastros de **Lucas Maia** e **Marcos Romero** na aba Equipe (função Filmmaker/Editor, permissões padrão de tarefas/calendário/gravações), para que voltem a aparecer nos seletores de responsável dos cards.
3. **Limpar o cadastro suspeito**: remover o registro "Scanner Admin" da Equipe (não é um funcionário real).
4. **Conferência**: rodar uma verificação final mostrando quantas tarefas ficaram com cada nome e confirmando que nenhuma marcação `[Ex-funcionário: ...]` sobrou.

## Observações

- Nenhuma tarefa é apagada — apenas o nome do responsável é corrigido, incluindo as já concluídas (para manter o histórico correto).
- Se algum desses dois nomes estiver escrito diferente do que você usa hoje (ex.: "Lucas" em vez de "Lucas Maia"), me avise que ajusto antes de aplicar.
- Se houver outros funcionários que sumiram além desses dois, me passe os nomes e funções que eu recadastro junto.

## Detalhes técnicos

- Atualização de dados em `public.tasks` nos campos `assignee` e `videomaker` (SQL de dados, sem mudança de estrutura).
- Inserção de linhas em `public.team_members` (nome, função, e-mail, permissões) e remoção da linha "Scanner Admin".
- Nenhuma alteração de código no frontend é necessária.
