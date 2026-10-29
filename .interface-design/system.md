# Sistema visual da Plataforma INOVA

Referência para qualquer tela nova ou alterada. Tokens em `src/index.css`, cores no `tailwind.config.ts`.

## Direção

"Ilha de edição": a plataforma é a mesa de trabalho de uma produtora audiovisual (pauta → roteiro → gravação → edição → aprovação → entrega). Denso e calmo, com cor só onde ela significa algo.

- **Escuro (padrão):** grafite levemente esverdeado (`--background: 150 8% 5%`), nunca preto puro.
- **Claro:** papel de roteiro, off-white quente (`--background: 60 14% 96%`), cards brancos, tinta grafite.
- **Verde-lima da marca** é escasso: botão principal, item "Publicar Conteúdo" e a luz de tally da página ativa.

## Cores (sempre tokens, nunca hex ou `zinc/gray/slate`)

| Uso | Classe | Observação |
| --- | --- | --- |
| Fundo da página | `bg-background` | |
| Card, painel, diálogo | `bg-card` | |
| Superfície rebaixada, hover | `bg-muted`, `bg-accent`, `bg-foreground/5` | `foreground/N` funciona nos dois temas |
| Texto principal / secundário | `text-foreground` / `text-muted-foreground` | Use `text-foreground/80` para um nível intermediário |
| Borda | `border-border` ou `border-foreground/10` | Nunca `border-white/N` |
| Ação principal (fundo lima) | `bg-brand text-brand-foreground` | É o `variant="default"` do Button |
| Verde em texto, ícone, anel, tint | `text-primary`, `bg-primary/10`, `ring-ring` | `--primary` é lima no escuro e oliva no claro (legível) |
| Página ativa / "agora" | `bg-tally` | Barrinha de 3px; é a assinatura visual |
| Gravação / alerta forte | `rec`, `destructive` | |
| Aprovado / entregue | `success` | |
| Atenção | `warning` | |
| Gráficos | `hsl(var(--chart-1..5))` | Nunca `hsl(73, 93%, 55%)` fixo |

Texto colorido claro (`text-emerald-400`, `text-pink-400`…) só é legível no escuro. Sempre em par: `text-emerald-700 dark:text-emerald-400`.

Branco fixo (`text-white`) só sobre fundo sólido colorido (`bg-success`, `bg-purple-500`, gradiente) ou sobre foto/vídeo com `bg-black/N`.

## Profundidade

- Cards: `border` + sombra mínima no claro, só borda no escuro (já no `Card`).
- Elementos soltos: `card-shadow` (anel suave); flutuantes (menus, popovers, diálogos): `raised-shadow`.
- Sem brilhos, manchas de luz (`blur-3xl`), gradientes decorativos ou `backdrop-blur` em superfícies comuns.

## Tipografia

- Sora (`font-display`) em títulos; Manrope no corpo.
- Título de página: `PageHeader` — 24px (28px no desktop), `font-semibold`, `tracking-tight`.
- Rótulo/eyebrow: 11px, `font-semibold`, `uppercase`, `tracking-[0.08em]`, `text-muted-foreground`.
- Números dinâmicos: `tabular-nums`. Valor de KPI: 18px no celular, 24–28px no desktop, `font-bold`/`font-semibold`.

## Espaçamento e forma

- Grade de 4px. Card: `p-4` no celular, `p-5` no desktop. Entre seções: `space-y-4` a `space-y-6`.
- Raio: `--radius` 10px; cards `rounded-xl`, controles `rounded-md`, pills `rounded-full`.
- Altura de controle: 40px (`h-10`); ícones-botão 36px (`h-9 w-9`).

## Padrões de componente

- **Página nova:** comece com `<PageHeader eyebrow title description actions />` (`src/components/PageHeader.tsx`). Não adicione padding próprio na raiz da página — o `AppLayout` já dá.
- **Navegação:** `src/config/app-pages.ts` alimenta menu, permissões e rotas. Item ativo = `bg-sidebar-accent` + barrinha `bg-tally`.
- **Celular:** barra inferior com Início, Tarefas, Planner, Clientes e Mais (`MOBILE_TABS` no `AppLayout`). Reserve `pb-24` no conteúdo (já no layout).
- **KPIs:** 2 colunas no celular (`grid-cols-2`), o principal pode ocupar `col-span-2`.
- **Kanban/colunas:** largura mínima de ~200px e rolagem lateral; nunca encolher até ficar ilegível.
- **Abas e grupos de botões:** `whitespace-nowrap` + rolagem lateral no celular.
- **Calendários em semana:** no celular, dias empilhados em lista em vez de 7 colunas.

## Escopos de tema

- Editores que produzem conteúdo para clientes ficam sempre escuros: envolva a rota em `<StudioScope>` (App.tsx).
- Páginas públicas ficam sempre escuras: adicione o caminho em `PUBLIC_DARK_PATHS` (App.tsx) **e** na lista do script de tema do `index.html`.
- Bloco que precisa ser escuro dentro de uma página clara (ex.: prévia de PDF escuro): classe `dark` no contêiner.

## Movimento

- Até 300ms, `ease-out` (`cubic-bezier(0.23,1,0.32,1)`); só `transform`/`opacity`/cores.
- Botões: `active:scale-[0.97]`. Sem `animate-pulse` decorativo.
