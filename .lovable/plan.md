## Quiz Builder — MVP enxuto

Módulo novo, totalmente separado do Diagnóstico/Briefings existentes. Foco em entregar uma base sólida que depois evolui para lógica condicional, score, templates e analytics avançado.

### O que entra no MVP

**Gestão de clientes do Quiz** (separado da tabela `clients` da agência)
- Listagem com nome, slug, nº de quizzes, nº de respostas, status
- Cadastro: nome, slug auto-gerado e editável (validação de unicidade em tempo real), email, empresa, notas, status ativo/inativo

**Gestão de quizzes por cliente**
- Cards: nome, slug, status, nº respostas, data
- Ações: Editar, Duplicar, Ver Respostas, Copiar Link, Ativar/Pausar, Excluir
- Criação: nome, slug auto-gerado e editável, descrição interna, preview da URL final

**Editor visual com drag-and-drop completo (@dnd-kit)**
- Painel esquerdo: biblioteca de blocos arrastáveis
- Canvas central: lista ordenável de blocos, com preview ao vivo
- Painel direito: configurações do bloco selecionado
- Topo: nome do quiz, Salvar, Publicar/Pausar, Preview, Copiar Link

Blocos do MVP (subset enxuto):
- Pergunta múltipla escolha (várias respostas)
- Pergunta escolha única
- Pergunta aberta (texto livre)
- Captura de lead (nome, email, telefone — todos com validação)
- Bloco visual: título/subtítulo + imagem (URL)
- Página de resultado simples (texto + CTA com link/WhatsApp)

Sem MVP: branching, lógica condicional, score, timer, gamificação, NPS, templates, webhook, pixel, senha, expiração, gráficos avançados, vídeo embed, depoimentos. Tudo isso vira fase 2.

**Página pública `/quiz/:clientSlug/:quizSlug`**
- Rota fora do AppLayout (sem header/sidebar), tema claro independente
- Mobile-first, responsiva
- Progresso uma pergunta por vez, barra de progresso simples
- Captura de UTMs (utm_source, utm_medium, utm_campaign) da URL
- Progresso parcial salvo em localStorage por slug
- Tela de "quiz pausado" / "quiz não encontrado" amigável
- Tela final com texto de resultado + CTA configurado

**Respostas (aba dentro do quiz)**
- Cards no topo: visualizações (lidas do contador), inícios, conclusões, taxa de conclusão, leads
- Tabela de respostas: data, nome, email, telefone, UTM source, ação "ver detalhes" (modal com todas respostas)
- Botão "Exportar CSV"

**Navegação**
- Novo item no sidebar "Quiz Builder" (ícone Layers), categoria Ferramentas, admin-only
- Rotas: `/quiz-builder` (clientes), `/quiz-builder/c/:clientId` (quizzes), `/quiz-builder/editor/:quizId`
- Pública: `/quiz/:clientSlug/:quizSlug` adicionada ao bloco `isPublicPage` em `App.tsx`

### Detalhes técnicos

**Tabelas Supabase novas** (todas com RLS):

```text
quiz_clients (id, name, slug UNIQUE, email, company, notes, status, created_at, updated_at)
quizzes (id, client_id FK, name, slug, description, status[draft|active|paused],
         result_title, result_text, result_cta_label, result_cta_url,
         views_count, starts_count, completions_count,
         created_at, updated_at, UNIQUE(client_id, slug))
quiz_questions (id, quiz_id FK, type, title, description, required, order_index, config jsonb)
quiz_options (id, question_id FK, text, order_index)
quiz_responses (id, quiz_id FK, started_at, completed_at, lead_name, lead_email,
                lead_phone, utm_source, utm_medium, utm_campaign)
quiz_answers (id, response_id FK, question_id FK, option_ids uuid[], text_answer)
```

**RLS:**
- Painel: tudo gerenciável por authenticated (admin verificado em UI via `useUserRole`).
- Pública: SELECT em `quiz_clients`, `quizzes` (apenas status='active'), `quiz_questions`, `quiz_options` para anon. INSERT em `quiz_responses` e `quiz_answers` para anon. UPDATE de `views_count`/`starts_count`/`completions_count` via RPC `increment_quiz_counter(quiz_id, field)` (security definer) para evitar abuso.

**Slug**
- Helper `slugify(name)` (lowercase, hifens, sem acento, 3-60 chars).
- Validação de unicidade: query Supabase no blur do input + feedback visual.

**Editor drag-and-drop**
- `@dnd-kit/core` + `@dnd-kit/sortable`.
- Biblioteca lateral com `useDraggable`; canvas com `SortableContext` vertical.
- Estado local do quiz em edição via Zustand (novo, isolado do resto do app).
- Save explícito em botão (não autosave nesta fase).

**Página pública**
- Componente `PublicQuizPage` carrega quiz pelo par de slugs, valida status='active'.
- Se inválido → tela "Quiz indisponível".
- Renderiza uma pergunta por vez com transição fade. Captura UTMs no mount.
- Ao iniciar: cria `quiz_responses` (started_at) + RPC starts_count++.
- Ao finalizar: atualiza completed_at + RPC completions_count++ + insere todas `quiz_answers`.

**Export CSV**
- Geração client-side a partir das respostas carregadas (sem dependências novas).

### O que NÃO entra agora (próximas fases sugeridas)

1. Score por opção + página de resultado por faixa
2. Lógica condicional / branching / variáveis dinâmicas
3. Templates iniciais (4 templates de produtora)
4. Personalização visual avançada (fontes, animações, cores por quiz, upload logo)
5. Webhook + pixel Meta/Google + notificação por email
6. Gamificação (timer, badge, barra animada, NPS)
7. Analytics avançado (funil de abandono, distribuição por pergunta, gráficos)
8. QR Code, embed iframe, senha, expiração
9. Vídeo embed, depoimentos, gráfico comparativo

### Arquivos novos/alterados

Novos:
- `supabase/migrations/<ts>_quiz_builder.sql` — tabelas, RLS, RPC counter
- `src/lib/quizSlug.ts` — slugify + validador
- `src/stores/quizEditorStore.ts` — Zustand do editor
- `src/pages/QuizBuilderClientsPage.tsx`
- `src/pages/QuizBuilderQuizzesPage.tsx`
- `src/pages/QuizEditorPage.tsx`
- `src/pages/QuizResponsesPage.tsx`
- `src/pages/PublicQuizPage.tsx`
- `src/components/quiz/BlockLibrary.tsx`
- `src/components/quiz/QuizCanvas.tsx`
- `src/components/quiz/BlockSettings.tsx`
- `src/components/quiz/blocks/*.tsx` (renderizadores por tipo)

Alterados:
- `src/App.tsx` — rotas novas + `isPublicPage` inclui `/quiz/`
- `src/config/app-pages.ts` — entrada Quiz Builder (Ferramentas, adminOnly)
- `package.json` — adiciona `@dnd-kit/core`, `@dnd-kit/sortable`, `zustand` (se ainda não presente)

Após esse MVP rodar bem, te pergunto qual fase atacar a seguir.
