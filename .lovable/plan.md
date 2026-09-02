# Análise sempre positiva — Diagnóstico Social

Deixar o relatório com tom 100% positivo e encorajador.

## Mudanças

1. **Prompt da IA (tom positivo reforçado)** — `src/pages/SocialAuditPage.tsx`:
   - Proibir palavras negativas: "problema", "gargalo", "fraco", "falha", "crítica", "prejudicando".
   - "problemaPrincipal" vira a maior **alavanca de crescimento**.
   - "pontosFracos" viram **oportunidades de evolução** com ganho esperado.
   - Classificação mínima "Boa" e score nunca abaixo de 60 quando houver resultados reais.
   - "alertas" viram **recomendações** ("Dica de ouro:", "Próximo passo sugerido:").

2. **Rótulos das seções (visuais)**:
   - "Gargalo identificado" → "Maior oportunidade de crescimento"
   - Subtítulo "Onde está o gargalo real" → "Onde está a maior alavanca de resultado"
   - "Pontos fracos" (vermelho) → "Oportunidades de evolução" (âmbar/dourado, ícone de foguete)
   - "Alertas importantes" → "Recomendações estratégicas", subtítulo "Cuidados para potencializar ainda mais os resultados"

3. O seletor de tom (Positiva/Negativa) continua existindo, com **Positiva** como padrão.

## Observação
O relatório da Abrasul já salvo (`abrasul-setembro-6zjf8r`) foi gerado com o tom antigo — para ele ficar positivo, será preciso **regenerar** enviando os prints novamente com o tom "Positiva" selecionado.

## Técnico
- Arquivo único: `src/pages/SocialAuditPage.tsx` (prompt + labels das seções `StrategicSection` e `AlertsSection`).
- Validação: build OK.
