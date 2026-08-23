# Avaliação de Equipe e Gargalos

Substituir a aba "Cockpit do Gestor" por uma aba **Desempenho da Equipe** (`/desempenho`), visível só para admin, onde o gestor avalia o trabalho de cada funcionário demanda por demanda e enxerga onde a operação trava.

## O que o gestor vê

**1. Ranking de funcionários**
Uma linha por funcionário com:
- Score final (métricas automáticas + nota manual do gestor)
- Entregas no período, entregas no prazo, atrasadas, em alteração (retrabalho)
- Tempo médio para concluir uma demanda
- Nota média dada pelo gestor
- Semáforo 🟢 ≥ 90 / 🟡 75–89 / 🔴 < 75

Clicando no funcionário, abre a lista das demandas dele no período: cada demanda mostra cliente, etapa, prazo, se atrasou, e um campo de **nota 0–10 + comentário** que o gestor preenche ali mesmo.

**2. Gargalos (três visões, em abas)**
- **Por etapa:** quantas tarefas estão paradas em cada etapa do Kanban, há quantos dias em média, e qual etapa acumula mais fila.
- **Por funcionário:** quem tem mais demandas paradas/atrasadas na fila hoje.
- **Por cliente:** quais clientes concentram mais demandas travadas.

Cada visão destaca no topo o maior gargalo em uma frase ("Maior gargalo: Em edição — 12 tarefas paradas, média de 6 dias").

**3. Filtros**
Período (semana atual, últimos 30 dias, mês passado), cliente, tipo de demanda (Vídeo / Arte / Geral) e funcionário.

## Como o score é calculado

Score final = média de:
- Entrega no prazo (% das demandas com prazo concluídas até a data)
- Volume entregue vs. fila (quanto da carga foi concluída no período)
- Qualidade = 100 − % de demandas que voltaram para alteração
- Nota do gestor (nota média × 10), quando houver notas lançadas

Se o funcionário não tem nota manual, o score usa só as três métricas automáticas.

## Detalhes técnicos

- Nova tabela `task_evaluations`: `task_id`, `member_name` (funcionário avaliado), `score` (0–10), `comment`, `evaluated_by`, `created_at`, `updated_at`, com unicidade por (`task_id`, `member_name`), GRANTs para `authenticated`/`service_role` e RLS: leitura para autenticados, escrita apenas para admin (`has_role`).
- Funcionários vêm de `profiles` (`is_active = true`, `job_title` como setor), casados com as tarefas pelos campos de papel já existentes: `assignee`, `copywriter`, `director`, `videomaker`, `editor`, `script_writer` (comparação por nome, minúsculas/trim — mesmo padrão já usado em `TaskMoveNotifications.tsx`).
- Tempo por etapa e tempo de conclusão vêm de `task_stage_history` (`from_stage`, `to_stage`, `created_at`); quando a tarefa não tem histórico, usa `created_at`/`updated_at` da tarefa como aproximação.
- Retrabalho = tarefa que passou por qualquer etapa contendo "altera" no histórico, ou que está nela agora.
- Clientes com status `Cancelado` ficam fora de todos os cálculos, como no resto do sistema.
- Nova página `src/pages/DesempenhoPage.tsx` + componentes em `src/components/desempenho/`.
- Remover `src/pages/CockpitPage.tsx`, sua rota `/cockpit` em `src/App.tsx` e a entrada no menu; registrar `/desempenho` em `src/App.tsx` e em `src/config/app-pages.ts` (categoria Administração, `adminOnly`).
