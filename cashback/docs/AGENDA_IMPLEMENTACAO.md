# Módulo Agenda — Yansix Cashback

## Decisões de integração
- Reutiliza `public.servicos` como catálogo oficial: nome, valor, cashback, profissional responsável e estado ativo.
- Acrescenta `duracao_min` aos serviços; os registros existentes recebem 30 minutos como padrão.
- Usa `public.clientes` e `public.perfis` existentes, sem criar catálogos paralelos.
- Mantém os agendamentos em `public.agendamentos`, com snapshots de valor/duração e status operacional.
- O Admin Master escolhe uma unidade no menu Agenda; Admin Estabelecimento opera apenas a própria unidade; Profissional vê e opera seus próprios agendamentos.
- A validação do banco impede referências cruzadas entre estabelecimentos e conflitos de horário, inclusive reservas sem profissional específico.
- Cancelamentos preservam histórico; não há exclusão física pela interface.

## Arquivos
- `cashback/painel/index.html`: menu Agenda com calendário mensal interativo, navegação entre meses, seleção de dia, indicadores de ocupação, consulta dos horários, criação de agendamentos e atualização de status; campo de duração no cadastro de serviços.
- O painel destaca separadamente os agendamentos concluídos que ainda não tiveram pontos/cashback computados, com ação explícita para processamento manual. O botão também aparece na linha do atendimento; após processar, o painel exibe o estado de confirmação.
- `cashback/supabase/migrations/029_modulo_agenda.sql`: schema, RLS, validação de conflito e auditoria.

## Aplicação e verificação
1. Revisar a branch `feat/cashback-agenda-estabelecimentos`.
2. Aplicar a migration 029 no projeto Supabase **cashback** (`uaqbnwwjqhhnqzsavbkh`) somente após revisão.
3. Confirmar que `servicos.duracao_min` existe e que `agendamentos` está com RLS habilitado.
4. Testar com usuários reais de teste:
   - Admin Master alterna entre duas unidades e vê apenas os dados da unidade selecionada.
   - Admin de unidade cria, confirma, conclui e cancela agendamentos da própria unidade.
   - Profissional vê apenas os próprios agendamentos e não consegue reservar serviço vinculado a outro profissional.
   - Dois agendamentos sobrepostos para o mesmo profissional (ou sem profissional específico) são recusados.
   - Serviços já cadastrados continuam disponíveis para pontuação/cashback; valor e percentual de cashback não são alterados pela Agenda.
5. Executar os advisors de segurança/performance e testes ponta a ponta antes de merge.

**Importante:** a migration foi adicionada ao repositório, mas não foi aplicada ao banco de produção. Os testes de integração exigem a migration aplicada em ambiente controlado.


## Cashback vinculado à Agenda
- A configuração `configuracoes.agenda_cashback_modo` é por estabelecimento e inicia em `manual`.
- No modo manual, ao concluir o atendimento, o operador usa **Computar cashback** para chamar a rotina oficial `registrar_atendimento_pontuacao`, que lança os pontos e calcula o cashback conforme o serviço e as configurações existentes.
- No modo automático, a conclusão do agendamento tenta processar o cashback imediatamente. Se falhar (por exemplo, sem profissional atribuído), o agendamento continua concluído e a ação manual fica disponível para nova tentativa.
- `processar_cashback_agendamento` bloqueia concorrência por linha e associa um único atendimento ao agendamento; tentativas repetidas não lançam pontos ou cashback novamente.
- O modo padrão é manual. O automático só deve ser ativado após testes autenticados de ponta a ponta.


## Visualização interativa
- O calendário mensal mostra indicadores de dias com agendamentos, atendimentos concluídos e pendências.
- Ao selecionar um dia, a consulta diária é sincronizada e lista horários, cliente, serviço, profissional, valor, status e ações.
- O botão `Novo agendamento` leva ao formulário e preenche a data selecionada.
- O processamento manual permanece idempotente pela RPC existente; a interface não substitui a validação do banco.
- Validação nesta alteração: sintaxe JavaScript do painel validada; testes de ponta a ponta com sessão autenticada ainda precisam ser executados.
