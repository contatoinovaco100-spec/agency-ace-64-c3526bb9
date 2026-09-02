# Relatório de Diagnóstico Social — tom positivo, zero lacunas, gráficos melhores

## 1. Análise sempre positiva

Prompt da IA em `src/pages/SocialAuditPage.tsx`:
- Proibir palavras negativas: "problema", "gargalo", "fraco", "falha", "crítica", "prejudicando".
- "problemaPrincipal" vira a maior **alavanca de crescimento**.
- "pontosFracos" viram **oportunidades de evolução** com o ganho esperado.
- Classificação mínima "Boa" e score nunca abaixo de 60 quando houver resultados reais.
- "alertas" viram **recomendações** ("Dica de ouro:", "Próximo passo sugerido:").

Rótulos visuais:
- "Gargalo identificado" → "Maior oportunidade de crescimento"
- "Pontos fracos" (vermelho) → "Oportunidades de evolução" (âmbar, ícone de foguete)
- "Alertas importantes" → "Recomendações estratégicas"

O seletor Positiva/Negativa continua, com **Positiva** como padrão.

## 2. Nunca exibir campo sem informação

Hoje aparecem "N/A", "/100" vazio e barras zeradas (os 4 cards de Scores por Dimensão estão sem número).

- **Regra geral:** todo bloco só renderiza se tiver dado real. Sem dado → a seção/campo some, nunca mostra "N/A", "—", "0" falso ou barra vazia.
- **Scores por Dimensão:** só renderiza as dimensões que vierem preenchidas; se nenhuma vier, a seção inteira desaparece.
- **KPIs:** o rodapé de variação só aparece quando existe delta real (fim dos "N/A" nos cards).
- **Prompt reforçado:** a IA é obrigada a preencher scores, benchmark, performance e interpretação de toda métrica que listar — se não souber, não deve listar a métrica.
- Mesma regra para projeção, alertas e pontos: seção vazia = seção oculta.

## 3. Gráficos melhores e Antes x Depois em destaque

**Nova seção "Antes x Depois" logo após os KPIs (posição de destaque):**
- Cards grandes por métrica: valor ANTES em cinza, seta, valor HOJE em lime grande, e badge de variação (verde subiu / vermelho caiu) bem visível.
- Gráfico trocado: em vez de barras absolutas (onde alcance de 79 mil esmaga seguidores de 52 e some da tela), passa a mostrar **a variação percentual de cada métrica** em barras — todas na mesma escala, comparáveis de verdade.
- Segundo gráfico opcional por métrica com par de barras Antes/Hoje normalizado, cada métrica com sua própria escala, sem uma engolir a outra.

**Correções nos gráficos existentes:**
- Labels completos, nunca truncados ("Frequência de Pu…" → "Frequência de Publicação"): largura de eixo maior e quebra de linha em duas linhas.
- Ordenação da pior para a melhor performance, para a leitura ser natural.
- Marcador visual da meta (linha de 100%) no gráfico de comparação com o mercado.
- Valores impressos na ponta de cada barra.
- Arredondar estimativas esquisitas (49,52 → 50) e manter a nota do `*` explicando que é estimativa.

## Observação
O relatório da Abrasul já salvo foi gerado com o tom e o prompt antigos. Para ele ficar positivo e com todos os "antes" preenchidos, será preciso **regenerar** enviando os prints novamente.

## Técnico
- Arquivo único: `src/pages/SocialAuditPage.tsx` (prompt, `ScoresSection`, `KpiSection`, `BeforeAfterSection`, `MetricsChartSection`, `StrategicSection`, `AlertsSection`).
- Recharts: `YAxis` com `width` maior + tick customizado com wrap; `Cell` por cor semântica; `LabelList` nas pontas.
- Validação: build + checagem visual do link público.
