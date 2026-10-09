# Manual de uso — YANSIX Cashback
**Atualizado em:** 9 de outubro de 2026

Este manual orienta a operação cotidiana do painel Cashback, incluindo os recursos atuais da Agenda: agendamentos com horário de início e término, inclusão de mais de um procedimento, edição e exclusão restrita de reservas pendentes. Os nomes e ações disponíveis podem variar conforme o perfil e as permissões da conta.

## 1. Acessar o painel
1. Abra [Painel Cashback](https://www.yansix.tech/cashback/painel/index.html).
2. Entre com seu usuário autorizado.
3. Use o menu lateral para abrir o módulo desejado.
4. Se uma atualização recém-publicada não aparecer, atualize a página com **Ctrl + F5**.

## 2. Perfis e escopo de acesso
- **Admin Master:** administra o sistema e pode selecionar a unidade/estabelecimento nos módulos que oferecem esse filtro.
- **Admin do estabelecimento:** opera os dados da própria unidade, conforme as permissões liberadas.
- **Profissional:** consulta e opera os atendimentos dentro do escopo permitido para seu perfil, incluindo os próprios agendamentos quando aplicável.

A disponibilidade de ações depende das permissões da conta. Não compartilhe credenciais nem tente acessar dados de outra unidade. Se uma ação não aparecer ou for recusada, confirme com o administrador se seu perfil tem a permissão necessária.

## 3. Cadastros usados pelo Cashback
### Clientes
Mantenha os dados de cadastro do cliente atualizados. Antes de registrar um atendimento ou agendamento, confirme se está selecionando o cadastro correto para evitar duplicidade.

### Serviços e procedimentos
Confira o nome, o valor, a duração, o percentual/regra de cashback e se o serviço está ativo. A Agenda usa a duração para calcular o término previsto e verificar conflitos de horário. Não altere valores ou regras de cashback sem autorização do responsável pelo programa.

### Profissionais e unidades
Confira a unidade e o profissional associados ao agendamento. Essas associações influenciam as permissões e a disponibilidade de horários.

## 4. Usar a Agenda
1. Abra **Agenda** no menu.
2. Selecione a unidade, quando seu perfil permitir.
3. Navegue até a data desejada e consulte a grade diária.
4. A grade apresenta informações como **Horário, Situação, Cliente, Profissional e Procedimento/Serviço**.
5. Clique em um horário livre para iniciar um agendamento ou use **Novo agendamento**.
6. Selecione o cliente, o profissional e o(s) procedimento(s), preencha os horários solicitados e confira os dados antes de salvar.

### Horário de início, término e múltiplos procedimentos
- Informe o horário de início e confira o horário de término. A duração do procedimento ajuda a determinar o período reservado.
- Quando o atendimento incluir **mais de um procedimento**, adicione todos os itens ao mesmo agendamento e revise a lista antes de salvar.
- O sistema calcula o tempo total e os valores com base nos procedimentos incluídos. Confira se a duração total cabe no período reservado e se o valor exibido corresponde aos itens selecionados.
- A Agenda verifica conflitos de horário. Se o período não estiver disponível, revise a duração, o horário de término, a agenda do profissional e os agendamentos que se sobrepõem.
- Não tente contornar um conflito reservando um horário que já esteja ocupado. Ajuste o horário ou escolha outro período livre.

## 5. Editar um agendamento
A edição serve para corrigir ou atualizar uma reserva existente sem criar outra reserva duplicada.

1. Localize o agendamento na Agenda.
2. Use **Editar agendamento** quando a ação estiver disponível.
3. Revise cliente, profissional, data, horário de início e término e os procedimentos associados.
4. Salve as alterações e confira a Agenda para verificar se o registro foi atualizado.

**Limites da edição:** a edição pela Agenda está disponível para agendamentos com status **Agendado** ou **Confirmado**, desde que ainda não exista um atendimento vinculado. Se o atendimento já foi criado ou o status não permite edição, não tente modificar o registro por outro caminho; solicite ao administrador a correção apropriada. Antes de salvar, verifique os conflitos de horário e os valores/durações recalculados.

## 6. Status dos agendamentos
Use o status que representa o resultado real do atendimento:

- **Agendado:** reserva criada, ainda sem confirmação de realização.
- **Confirmado:** atendimento confirmado, mas ainda não realizado.
- **Realizado:** o atendimento aconteceu de fato.
- **Faltou:** o cliente não compareceu.
- **Cancelado:** o agendamento foi cancelado.

**Importante:** marque **Realizado** somente depois que o serviço tiver sido prestado. Não use esse status para reservas futuras, faltas ou cancelamentos. Registros antigos com status “Concluído” podem ser tratados como “Realizado” nos relatórios históricos.

## 7. Excluir um agendamento
A exclusão é uma ação restrita, destinada a corrigir uma reserva que não deve mais existir — não é a forma normal de registrar uma falta ou um cancelamento.

1. Na Agenda, localize a reserva que precisa ser removida.
2. Confira cuidadosamente cliente, data, horário, profissional e procedimentos para não selecionar outro agendamento da mesma pessoa.
3. Clique em **Excluir agendamento** (ícone de lixeira), se a ação estiver disponível.
4. Leia a confirmação e confirme somente se tiver certeza de que selecionou o registro correto.
5. Atualize a Agenda e confirme que a reserva deixou de aparecer.

**O que pode ser excluído:** somente agendamentos com status **Agendado** ou **Confirmado**, sem atendimento vinculado, e quando o perfil tiver permissão para excluir. A regra de acesso permite essa operação ao Admin Master ou ao administrador da unidade que tenha a permissão de atendimentos.

**O que não pode ser excluído por essa ação:** atendimentos já vinculados, registros realizados, faltas e cancelamentos. Preserve o histórico operacional. Se um atendimento já ocorreu ou foi registrado, não use a exclusão para apagar o histórico; procure o administrador.

Se o botão não funcionar:
- Atualize a página com **Ctrl + F5** e tente novamente.
- Confira se a reserva ainda está **Agendada** ou **Confirmada** e se não tem atendimento vinculado.
- Confirme com o administrador que sua conta tem permissão de atendimentos para a unidade.
- Se continuar falhando, registre a mensagem de erro ou uma captura de tela, o horário da tentativa e o identificador/detalhes da reserva para investigação. Não repita ações sem conferir se o registro já foi removido.

## 8. Computar pontos e cashback
O atendimento realizado e o lançamento do cashback são etapas relacionadas, mas distintas.

1. Abra a Agenda e localize o atendimento.
2. Confirme cliente, serviço(s), valor, profissional e status.
3. Altere o status para **Realizado** somente se o atendimento ocorreu.
4. Se o painel apresentar a ação **Computar cashback** ou **Computar pontos + cashback**, use-a para processar o atendimento.
5. Aguarde a confirmação do resultado na interface e confira se o atendimento deixou de aparecer como pendente.

O processamento é protegido contra duplicidade: uma nova tentativa para o mesmo agendamento não deve gerar um segundo lançamento para o mesmo atendimento. Se o processamento falhar, confira os dados obrigatórios e as permissões e tente novamente somente após corrigir a causa. Não crie um lançamento manual duplicado para contornar um erro.

O modo de processamento padrão é manual. Não altere configurações de processamento automático sem testes e autorização.

## 9. Indicadores de Atendimento
Abra **Indicadores de Atendimento** pelo menu lateral para acompanhar o movimento e a conversão da agenda.

### Filtros
- **Data inicial e data final:** delimitam o período analisado. Por padrão, o relatório abre com o mês atual.
- **Profissional:** permite analisar um profissional específico.
- **Serviço:** permite analisar um serviço específico.
- **Unidade:** disponível para o perfil que pode selecionar estabelecimentos.

Aplique os filtros desejados e confira o período selecionado antes de comparar resultados.

### Indicadores apresentados
- **Agendamentos:** quantidade de registros dentro dos filtros aplicados.
- **Realizados / taxa de conversão:** quantidade de atendimentos marcados como realizados e sua proporção em relação à base considerada pelo relatório.
- **Faltas:** registros com status “Faltou”.
- **Cancelamentos:** registros com status “Cancelado”.
- **Cashback computado:** atendimentos cujo processamento de pontos/cashback foi registrado.
- **Cashback pendente:** atendimentos realizados que ainda precisam de processamento, conforme os critérios do relatório.

O módulo também apresenta resumo por status, conversão por profissional, conversão por serviço e uma tabela de detalhes dos agendamentos, incluindo cliente, unidade, serviço, profissional, valor, status e situação do cashback. A lista detalhada pode ser limitada a até 100 registros; use os filtros para restringir o período ou a seleção.

**Como interpretar:** taxa de conversão é uma métrica operacional do período filtrado, não uma avaliação isolada da qualidade do serviço. Verifique o volume, as faltas, os cancelamentos e os filtros antes de tirar conclusões. Se houver atendimentos antigos com status “Concluído”, eles podem ser contabilizados como “Realizado” para preservar a leitura histórica.

## 10. Área do cliente
A área do cliente permite que clientes autenticados consultem as informações e funcionalidades disponibilizadas para sua conta. Oriente cada cliente a usar suas próprias credenciais e a não compartilhar códigos ou senhas.

## 11. Boas práticas e solução de problemas
- **Horários não aparecem:** confirme a data, o serviço, a duração, o profissional e conflitos de agenda.
- **O horário de término ou valor parece incorreto:** confira os procedimentos adicionados e as durações/valores cadastrados para cada serviço.
- **Não consigo editar:** confira se o status é **Agendado** ou **Confirmado** e se ainda não existe atendimento vinculado.
- **Não consigo excluir:** confira status, vínculo de atendimento, permissão da conta e atualize com **Ctrl + F5**; consulte a seção 7.
- **Não consigo selecionar uma unidade:** verifique se seu perfil tem permissão para alternar estabelecimentos.
- **O botão de cashback não aparece:** confirme que o status está como **Realizado**, que o atendimento pertence ao seu escopo e que os dados necessários estão preenchidos.
- **O cashback consta como pendente:** abra o registro, verifique os dados e use a ação de processamento disponível. Leia a mensagem de erro antes de repetir.
- **Os indicadores parecem incorretos:** confira datas, unidade, profissional e serviço; lembre-se de que os filtros afetam todos os totais.
- **A interface parece desatualizada:** atualize com **Ctrl + F5**. Se persistir, registre a tela, o horário e a ação realizada para investigação.

Não exclua registros históricos para corrigir erros operacionais. Preserve o histórico e solicite suporte ao administrador quando for necessário corrigir dados ou permissões.

## 12. Checklist de fechamento
- [ ] Os agendamentos têm cliente, profissional, data, horário e procedimentos corretos.
- [ ] A duração e o horário de término correspondem aos procedimentos selecionados.
- [ ] Os atendimentos ocorridos estão marcados como **Realizado**.
- [ ] Faltas e cancelamentos estão com os status correspondentes.
- [ ] Atendimentos realizados não permanecem indevidamente com cashback pendente.
- [ ] Os indicadores foram consultados com o período e a unidade corretos.
- [ ] Erros de processamento ou de permissão foram registrados para acompanhamento.

---
**Documento operacional.** As regras de negócio, permissões e cálculos efetivos são os implementados no painel e no banco de dados; este manual não substitui os controles de acesso do sistema.
