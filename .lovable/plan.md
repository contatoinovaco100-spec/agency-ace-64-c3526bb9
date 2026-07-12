
## Nova aba: Figma → Landing Page

Aba admin no menu lateral em **Ferramentas**, rota `/figma-to-lp`, que aceita JSON exportado do Figma **ou** link + token pessoal, converte em uma landing page híbrida (renderer fiel de nós + IA melhorando copy/responsividade), salva no banco e gera URL pública.

### 1. Banco (migration)

Tabela `figma_landing_pages`:
- `id uuid pk`, `slug text unique`, `title text`
- `source_type text` ('upload' | 'api')
- `figma_json jsonb` (documento bruto do Figma)
- `generated_html text` (LP final renderizada + otimizada por IA)
- `ai_notes jsonb` (sugestões de copy/melhorias)
- `published boolean default true`
- `created_by uuid`, `created_at`, `updated_at`

RLS: admin faz tudo; leitura pública apenas quando `published = true` (via SECURITY DEFINER `get_public_landing_page(_slug)`).
GRANTs + trigger `updated_at`.

### 2. Página admin `/figma-to-lp` (adminOnly)

**Lista** de LPs geradas (título, slug, data, link público, ações: ver, editar HTML, excluir).

**Botão "Nova LP"** abre dialog com 2 abas:
- **Upload JSON**: drop de arquivo `.json` (export do plugin "Figma to JSON" ou API)
- **Link Figma**: input do URL `figma.com/file/KEY/...` + input do Personal Access Token → chama Edge Function que faz `GET https://api.figma.com/v1/files/{KEY}` com header `X-Figma-Token`. Token não é salvo (só usado na hora).

Após obter JSON: preview do parsing, campo de título/slug, botão "Gerar Landing Page".

### 3. Conversão híbrida (edge function `figma-to-lp`)

Fluxo:
1. Recebe `figma_json` + metadados.
2. **Renderer fiel**: percorre a primeira `FRAME` de tamanho de página, extrai nós (TEXT, RECTANGLE com fills, IMAGE via `imageRef`, FRAME/GROUP como containers) e gera HTML com posicionamento absoluto dentro de um container com `aspect-ratio` da frame — preservando cores, fontes, tamanhos.
3. **Camada IA (Gemini via Lovable AI Gateway, modelo `google/gemini-2.5-pro`)**: recebe o HTML fiel + resumo textual do design e retorna:
   - Versão responsiva com Tailwind (breakpoints sm/md/lg), estrutura semântica (`<header>`, `<section>`, `<footer>`).
   - Sugestões de copy melhorada (retornadas em `ai_notes`).
   - CTA principal identificado e destacado.
4. Salva `figma_json`, `generated_html` e `ai_notes` na tabela.

Retorna `{ slug, public_url }`.

### 4. Rota pública `/lp/:slug`

Nova página `PublicLandingPage.tsx` que:
- Busca via `supabase.rpc('get_public_landing_page', { _slug })`.
- Renderiza `generated_html` dentro de um container isolado (sanitizado com DOMPurify).
- Sem chrome do app (tema claro, sem sidebar).

### 5. Editor rápido

No admin, clicar em uma LP abre painel lateral com:
- Preview iframe da rota pública.
- Textarea com o HTML gerado (edição manual opcional, salva de volta).
- Lista de `ai_notes` com sugestões aplicáveis.

### 6. Menu / roteamento

- `src/config/app-pages.ts`: adicionar `{ path: '/figma-to-lp', label: 'Figma → LP', icon: Palette, category: 'Ferramentas', adminOnly: true }`.
- `src/App.tsx`: lazy import da página admin + rota pública `/lp/:slug`.

### Detalhes técnicos

- Parser Figma: helper `src/lib/figmaParser.ts` (paleta, extração de nós, cálculo de posição relativa dentro da frame).
- Fontes do Figma mapeadas para Google Fonts mais próximas (fallback `Inter`).
- Imagens embutidas via `imageRef` da API Figma → precisam do endpoint `/v1/images/{key}` (só disponível no modo API com token). No modo upload puro sem token, imagens viram placeholders com cor de fundo do nó.
- Edge Function `figma-to-lp` reutiliza padrão do `ai-copywriter` (CORS, LOVABLE_API_KEY, tratamento de 429/402).
- Slug único gerado a partir do título (kebab-case + sufixo aleatório se colidir).

### Fora do escopo (por ora)

- Editor visual drag-and-drop (edição só via HTML por enquanto).
- Componentes interativos do Figma (variants/prototype).
- Publicação em domínio próprio (usa apenas rota `/lp/:slug` do app).
