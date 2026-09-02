# Melhoria visual das métricas — Diagnóstico Social

Analisei o relatório ao vivo (abrasul-setembro-6zjf8r) e identifiquei os problemas reais. Plano de correção:

## Problemas encontrados

1. **Scores por Dimensão vazios** — os 4 cards (Criativo, Público, Oferta, Estrutura) mostram barra zerada e "/100" sem número: a IA não retornou os valores ou o render falha silenciosamente.
2. **Gráfico "Antes x Hoje" ilegível** — Alcance (79.604) esmaga a escala e o crescimento de seguidores (49→52) vira uma barra invisível. Labels truncados ("Crescimento de Seg...", "Alcance Total (30...").
3. **"Comparação Visual" com labels truncados** — "Frequência de Pu...", "Crescimento de S...", "Taxa de Engajame...".
4. **Números estimados estranhos** — "49,52*" seguidores com casa decimal.
5. **Cards de métrica com muito texto** — interpretação longa compete com o número; selo de classificação pouco legível.

## O que vou implementar

### Antes x Hoje (seção principal)
- Substituir o gráfico de barras absolutas por **barras de variação percentual** (cada métrica mostra +15%, +5% etc.) — resolve a distorção de escala e comunica evolução direto.
- Cards com `Antes → Hoje` grandes, seta colorida e delta em destaque.
- Arredondar estimativas (49,52 → 50) e explicar o `*` numa nota de rodapé clara.

### Comparação Visual das Métricas
- Labels completos (largura fixa maior + quebra de linha, nunca truncar).
- Barra com **marcador da meta** (linha vertical em 100%) e cor semântica: lime ≥70%, âmbar 40–69%, vermelho <40%.
- Ordenar da pior para a melhor — o que precisa de atenção aparece primeiro.

### Leitura Completa (cards de métrica)
- Número muito maior (hierarquia extrema), selo de status (Excelente/Boa/Média/Baixa/Crítica) com cor de fundo sólida e legível.
- Interpretação limitada a 2 linhas com "ler mais" expansível.
- Antes x Hoje inline mantido, com delta colorido.

### Scores por Dimensão
- Corrigir o render: se a IA não retornar scores, ocultar a seção em vez de mostrar barras vazias; quando houver, mostrar número grande + barra animada.

## Detalhes técnicos
- Arquivo único: `src/pages/SocialAuditPage.tsx` (seções `BeforeAfterSection`, `MetricsChartSection`, `MetricsSection`, scores).
- Recharts para o gráfico de variação (label width ~180px, `tick` com wrap), barras com `Cell` por cor semântica.
- Nada muda no prompt da IA nem nos dados — apenas apresentação.
- Validação: build + Playwright no slug público para conferir labels e escalas.
