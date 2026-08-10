# YANSIX — GA4 / Funil do Diagnóstico

## Eventos principais

- `diagnostico_clique` — clique em CTA que leva ao diagnóstico.
- `diagnostico_inicio` — início do diagnóstico.
- `diagnostico_question_view` — pergunta visualizada.
- `diagnostico_question_answer` — resposta/progresso da pergunta, quando acionado pelo fluxo.
- `diagnostico_resultado` — resultado calculado.
- `diagnostico_contato_inicio` — início da interação com o formulário de contato.
- `diagnostico_concluido` — envio concluído com sucesso.

## Parâmetros do progresso

- `numero_pergunta`
- `total_perguntas`
- `progresso_percentual`

## Observação

As alterações foram feitas como uma camada de monitoramento, preservando a lógica existente do questionário sempre que possível.
