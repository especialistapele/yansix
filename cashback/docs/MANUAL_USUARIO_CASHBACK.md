# Manual de uso — YANSIX Cashback
**Atualizado em:** 9 de outubro de 2026

Este manual orienta a operação cotidiana do painel Cashback. Os nomes podem variar ligeiramente conforme o perfil de acesso e os módulos liberados para cada estabelecimento.

## 1. Acessar o painel
1. Abra [Painel Cashback](https://www.yansix.tech/cashback/painel/index.html).
2. Entre com seu usuário autorizado.
3. Use o menu lateral para abrir o módulo desejado.
4. Se uma atualização recém-publicada não aparecer, atualize a página com **Ctrl + F5**.

## 2. Perfis e escopo de acesso
- **Admin Master:** administra o sistema e pode selecionar a unidade/estabelecimento nos módulos que oferecem esse filtro.
- **Admin do estabelecimento:** opera os dados da própria unidade.
- **Profissional:** consulta e opera os atendimentos dentro do escopo permitido para seu perfil, incluindo os próprios agendamentos quando aplicável.

A disponibilidade de ações depende das permissões da conta. Não compartilhe credenciais nem tente acessar dados de outra unidade.

## 3. Cadastros usados pelo Cashback
### Clientes
Mantenha os dados de cadastro do cliente atualizados. Antes de registrar um atendimento ou agendamento, confirme se está selecionando o cadastro correto para evitar duplicidade.

### Serviços
Confira o nome, o valor, o percentual/regra de cashback e o estado ativo do serviço. A Agenda também utiliza a duração do serviço para calcular os horários disponíveis. Não altere valores ou regras de cashback sem autorização do responsável pelo programa.

### Profissionais e unidades
Confira a unidade e o profissional associados ao serviço e ao agendamento. Essas associações influenciam as permissões e a disponibilidade de horários.

## 4. Usar a Agenda
1. Abra **Agenda** no menu.
2. Selecione a unidade, quando o seu perfil permitir.
3. Navegue entre os meses e selecione o dia desejado.
4. Consulte a grade diária. Ela organiza os registros por **Horário, Situação, Paciente/Cliente, Profissional e Procedimento/Serviço**.
5. Clique em um horário livre para iniciar um agendamento ou use **Novo agendamento**.
6. Preencha os dados solicitados e salve. Verifique data, horário, cliente, serviço e profissional antes de confirmar.

Os horários livres são calculados considerando a duração do serviço e os conflitos de agenda. Se um horário não aparecer, confira a duração, a disponibilidade do profissional e possíveis agendamentos sobrepostos.

## 5. Status dos agendamentos
Use o status que representa o resultado real do atendimento:

- **Agendado:** reserva criada, ainda sem confirmação de realização.
- **Confirmado:** atendimento confirmado, mas ainda não realizado.
- **Realizado:** o atendimento aconteceu de fato.
- **Faltou:** o cliente não compareceu.
- **Cancelado:** o agendamento foi cancelado.

**Importante:** marque **Realizado** somente depois que o serviço tiver sido prestado. Não use esse status para reservas futuras, faltas ou cancelamentos. Registros antigos com status “Concluído” podem ser tratados como “Realizado” nos relatórios históricos.

## 6. Computar pontos e cashback
O atendimento realizado e o lançamento do cashback são etapas relacionadas, mas distintas.

1. Abra a Agenda e localize o atendimento.
2. Confirme cliente, serviço, valor, profissional e status.
3. Altere o status para **Realizado** somente se o atendimento ocorreu.
4. Se o painel apresentar a ação **Computar cashback** ou **Computar pontos + cashback**, use-a para processar o atendimento.
5. Aguarde a confirmação do resultado na interface e confira se o atendimento deixou de aparecer como pendente.

O processamento é protegido contra duplicidade: uma nova tentativa para o mesmo agendamento não deve gerar um segundo lançamento para o mesmo atendimento. Se o processamento falhar, confira os dados obrigatórios e as permissões e tente novamente somente após corrigir a causa. Não crie um lançamento manual duplicado para contornar um erro.

O modo de processamento padrão é manual. Não altere configurações de processamento automático sem testes e autorização.

## 7. Indicadores de Atendimento
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

## 8. Área do cliente
A área do cliente permite que clientes autenticados consultem as informações e funcionalidades disponibilizadas para sua conta. Oriente cada cliente a usar suas próprias credenciais e a não compartilhar códigos ou senhas.

## 9. Boas práticas e solução de problemas
- **Horários não aparecem:** confirme a data, o serviço, a duração, o profissional e conflitos de agenda.
- **Não consigo selecionar uma unidade:** verifique se seu perfil tem permissão para alternar estabelecimentos.
- **O botão de cashback não aparece:** confirme que o status está como **Realizado**, que o atendimento pertence ao seu escopo e que os dados necessários estão preenchidos.
- **O cashback consta como pendente:** abra o registro, verifique os dados e use a ação de processamento disponível. Leia a mensagem de erro antes de repetir.
- **Os indicadores parecem incorretos:** confira datas, unidade, profissional e serviço; lembre-se de que os filtros afetam todos os totais.
- **A interface parece desatualizada:** atualize com **Ctrl + F5**. Se persistir, registre a tela, o horário e a ação realizada para investigação.

Não exclua registros históricos para corrigir erros operacionais. Preserve o histórico e solicite suporte ao administrador quando for necessário corrigir dados ou permissões.

## 10. Checklist de fechamento
- [ ] Os atendimentos ocorridos estão marcados como **Realizado**.
- [ ] Faltas e cancelamentos estão com os status correspondentes.
- [ ] Atendimentos realizados não permanecem indevidamente com cashback pendente.
- [ ] Os indicadores foram consultados com o período e a unidade corretos.
- [ ] Erros de processamento foram registrados para acompanhamento.

---
**Documento operacional.** As regras de negócio, permissões e cálculos efetivos são os implementados no painel e no banco de dados; este manual não substitui os controles de acesso do sistema.
