# Contratos mensais e de valor total

## Objetivo
Permitir que, ao criar ou editar um contrato, seja escolhida uma destas modalidades:
- **Mensal:** mantém mensalidade, vencimento recorrente e prazo mínimo.
- **Valor total:** informa o valor fechado e a duração completa do contrato.

## Alterações
- Adicionar ao contrato a modalidade de cobrança e o valor total, preservando os contratos existentes como mensais.
- Incluir um seletor claro no formulário de contrato e mostrar somente os campos aplicáveis à modalidade escolhida.
- Exibir a modalidade e o valor correto nos cards da área de contratos.
- Adaptar as cláusulas da página pública de assinatura para mensal ou valor total.
- Adaptar o PDF para usar a mesma redação e os mesmos valores.
- Validar criação, edição e visualização pública sem alterar o fluxo de assinatura atual.

## Detalhes técnicos
- Novos campos em `contracts`: `billing_type` (`monthly` ou `total`) e `total_value`.
- Contratos já existentes continuam como `monthly` automaticamente.
- Contratos de valor total continuam usando `duration_months` como duração determinada e não exibem cobrança mensal recorrente.
