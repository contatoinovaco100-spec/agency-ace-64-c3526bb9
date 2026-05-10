
# Quiz Builder Inlead-like — Pacote completo

Você escolheu: **Pacote completo**, **bucket público novo `quiz-media`**, **tema visual global por quiz**.

Como é muito conteúdo, vou dividir em **4 fases**. Cada fase termina funcional e testável. Após cada fase, você confirma e seguimos para a próxima.

---

## FASE 1 — Mídia self-hosted + Tema visual global

### Banco de dados
- Criar bucket público `quiz-media` (com RLS: leitura pública, upload/delete por authenticated).
- Adicionar colunas em `quizzes`:
  - `theme jsonb default '{}'` — guarda toda a config visual em um único campo flexível.
  - `result_image_url text`, `redirect_url text`, `redirect_delay_seconds int`.
  - `score_enabled boolean default false`, `score_ranges jsonb default '[]'` (faixas: `{min, max, title, text, cta_label, cta_url, image_url}`).
  - `pixel_meta text`, `pixel_ga text`, `webhook_url text`.
  - `progress_bar boolean default true`, `show_question_numbers boolean default true`.
- Adicionar colunas em `quiz_questions`:
  - `image_url text` — imagem opcional acima do bloco.
  - `next_question_id uuid` e `branching jsonb default '[]'` (`[{option_id, target_question_id|"end"}]`) — para Fase 2.
- Adicionar colunas em `quiz_options`:
  - `points int default 0`, `image_url text` (cards visuais).

### Estrutura `theme` (jsonb)
```json
{
  "primary_color": "#bff720",
  "background_color": "#0a0a0a",
  "background_image_url": "",
  "text_color": "#ffffff",
  "card_background": "#171717",
  "button_text_color": "#000000",
  "font_family": "Inter",
  "heading_weight": 700,
  "body_weight": 400,
  "border_radius": 12,
  "logo_url": "",
  "cover_image_url": "",
  "show_logo": true,
  "button_style": "rounded",
  "animation": "fade"
}
```

### Frontend
- Editor: nova aba lateral **"Tema"** com:
  - Color pickers (primária, fundo, texto, card, botão).
  - Upload de logo, capa e imagem de fundo (componente `QuizMediaUploader` reutilizável → bucket `quiz-media/{client_id}/`).
  - Seletor de fonte (Google Fonts: Inter, Poppins, Roboto, Montserrat, Plus Jakarta, Manrope, Sora, Playfair, DM Sans, Space Grotesk + custom).
  - Pesos heading/body (300/400/500/600/700/800).
  - Slider de border radius (0–24px).
  - Toggle de barra de progresso, números de pergunta, animação (fade/slide/none).
- Cada bloco no editor: campo de "Imagem do bloco" (upload).
- Cada opção (single/multiple): campo opcional de imagem (vira card visual).
- Página pública `PublicQuizPage`: aplica `theme` via CSS-in-JS (style inline + `<link>` Google Fonts dinâmico).

---

## FASE 2 — Lógica condicional + Score + Variáveis dinâmicas

- Editor: aba "Lógica" no painel direito de cada pergunta.
  - Default: "Próxima na ordem" / "Pular para…" / "Finalizar".
  - Por opção (single choice): destino diferente.
  - Pontos por opção (input number).
- Toggle global "Habilitar pontuação" → libera UI de **faixas de resultado** (min–max → título/texto/CTA/imagem).
- Variáveis dinâmicas: `{{nome}}`, `{{email}}`, `{{score}}`, `{{resposta:slug-da-pergunta}}` substituídas no result/CTA/redirect.
- Página pública: roteamento condicional baseado em `next_question_id` ou `branching`. Cálculo de score acumulado. Resolução da faixa de resultado e renderização correspondente.

---

## FASE 3 — Blocos avançados + Integrações

### Novos tipos de bloco
- **video** — embed YouTube/Vimeo/MP4.
- **testimonial** — citação + avatar + nome.
- **comparative** — tabela "antes/depois" ou "nós vs. concorrente".
- **nps** — escala 0–10.
- **rating** — estrelas 1–5.
- **cta** — botão intermediário (destino: próxima, url, whatsapp).
- **divider** — separador estético.

### Integrações
- **Webhook**: POST com payload completo da resposta (campo `webhook_url` no quiz). Edge Function `quiz-webhook-dispatch` chamada após completar.
- **Pixel Meta**: injeta script no `PublicQuizPage` quando `pixel_meta` definido + dispara `Lead`/`CompleteRegistration`.
- **Google Analytics**: gtag.js + eventos `quiz_start`, `quiz_complete`, `quiz_lead`.
- **Notificação por e-mail** ao admin via Edge Function existente (reaproveitar `notify-contract-signed` como base → criar `notify-quiz-lead`).
- **Redirect** automático após X segundos (campo `redirect_url` + `redirect_delay_seconds`).

---

## FASE 4 — Templates + Analytics avançado + Compartilhamento

- **4 templates** prontos para produtora audiovisual:
  1. Diagnóstico de presença digital.
  2. Qual estilo de vídeo combina com você?
  3. Briefing rápido para orçamento.
  4. Quiz de leads para Reels/Shorts.
  - Botão "Criar a partir de template" na criação de quiz.
- **Analytics por quiz**:
  - Funil de abandono (quantos chegaram em cada pergunta).
  - Distribuição por opção (gráfico de barras).
  - Tempo médio para completar.
  - Origem (UTM gráfico de pizza).
  - Conversão por dia (linha).
- **Compartilhamento**:
  - QR Code (com `qrcode.react`).
  - Embed iframe (snippet copiável).
  - Senha opcional (`password text` no quiz).
  - Data de expiração (`expires_at timestamp`).

---

## Detalhes técnicos

- Arquivos novos por fase: componentes `QuizThemeEditor`, `QuizMediaUploader`, `QuizLogicPanel`, `QuizScoringPanel`, `QuizPublicRenderer` (refatorado), `QuizAnalyticsCharts`, `QuizTemplatesGallery`.
- Bibliotecas adicionais: `recharts` (já presente), `qrcode.react` (Fase 4).
- Renderização de fontes Google: hook `useGoogleFont(family, weights)` adiciona `<link>` ao `<head>`.
- Compatibilidade: quizzes existentes recebem theme padrão dark Inova ao migrar (#000/#bff720/Inter).

---

## O que faço agora

Executo a **Fase 1 completa** (migration + bucket + editor de tema + uploads + página pública aplicando tema). Após você validar visualmente, sigo para a Fase 2.

Confirma para começar pela Fase 1?
