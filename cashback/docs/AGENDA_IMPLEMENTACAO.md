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
- `cashback/painel/index.html`: menu Agenda, criação/consulta diária, atualização de status e campo de duração no cadastro de serviços.
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
