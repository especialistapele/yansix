# YANSIX Clínica

Módulo administrativo independente do CRM comercial, conectado ao projeto Supabase `zxeupenncextzrqgthqx`.

## Módulos implementados
- Login Supabase Auth e criação da clínica inicial via RPC `clinic_crm_create_clinic`.
- Dashboard com contatos, oportunidades e agenda.
- Contatos e pacientes administrativos: criação, edição, pesquisa e exclusão conforme o perfil.
- Pipeline Kanban e tabela: criação/edição/exclusão de oportunidades, movimentação de etapas e auditoria.
- Agenda administrativa: criar, editar e excluir agendamentos, atribuição de profissional, validação de horário, detecção de sobreposição e atalho para Google Calendar.
- Tarefas e retornos: CRUD, prioridade, conclusão, responsável e vínculo a contato.
- Interações: registro de ligações, WhatsApp, e-mail, reunião, origem e resultado.
- Orçamentos: status, validade, desconto, impressão e vínculo a oportunidade.
- Financeiro básico: receitas/despesas, vencimentos, estado pago/pendente/cancelado e indicadores.
- Equipe: convite de usuário pelo Supabase Auth, vínculo com clínica, edição de perfil, ativação/desativação e diretório de profissionais.
- Relatórios operacionais, exportação CSV, histórico de auditoria e configurações por clínica.
- Automações opt-in para criar tarefa de primeiro contato, confirmação de agendamento e follow-up de orçamento.
- RLS por clínica e políticas de escrita por perfil; trilha de auditoria.

## Perfis
- `owner`: proprietário da clínica.
- `admin`: administração e equipe.
- `manager`: gestão operacional e configurações.
- `reception`: recepção, contatos, agenda, tarefas, interações e orçamentos.
- `clinician`: agenda própria, tarefas e interações administrativas.
- `finance`: financeiro.
- `marketing`: contatos e oportunidades.

A camada visual oculta ações não autorizadas e o banco também verifica o perfil nas políticas RLS. A Edge Function de convites valida a sessão e exige proprietário ou administrador.

## Banco
A fundação original está documentada em `crm_yansix/CLINIC_CRM.md`. Extensões e políticas por perfil estão em `sql/20261025_clinic_crm_extensions.sql`.

Tabelas adicionais:
- `clinic_crm_quotes`
- `clinic_crm_finance_entries`
- `clinic_crm_settings`

Campos de perfil foram adicionados a `clinic_crm_members`. Não existe acesso cruzado às tabelas comerciais do CRM YANSIX.

## Segurança e limites
- Nunca colocar `service_role` no navegador; a criação/convite usa a Edge Function `clinic-crm-invite-member`.
- Não usar o CRM para prontuário, diagnósticos, prescrições, exames ou anotações clínicas sensíveis.
- O financeiro é um controle administrativo manual; não processa pagamentos, não integra adquirentes e não substitui contabilidade.
- Orçamentos são documentos administrativos simples para impressão; não são assinaturas digitais nem contratos.
- Lembretes são tarefas internas; envio automático de WhatsApp/e-mail e integração com Google Calendar dependem de configuração e credenciais específicas.
- Testes automatizados estáticos não substituem teste real de navegador autenticado com contas de cada perfil.
