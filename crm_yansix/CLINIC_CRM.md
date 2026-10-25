# YANSIX Clinic CRM — arquitetura inicial

## Objetivo
Criar uma experiência separada do CRM comercial existente para clínicas médicas, odontológicas e operações mistas. O módulo usa tabelas próprias com prefixo `clinic_crm_`; não reaproveita nem modifica os registros do CRM comercial atual.

## Supabase
Projeto-alvo: `yansix-crm` (`zxeupenncextzrqgthqx`), o mesmo configurado em `crm_yansix/js/config.js`.

A fundação SQL está em `sql/clinic_crm_foundation.sql`. Ela foi aplicada ao projeto Supabase em 25/10/2026 e verificada: as oito tabelas existem, estão vazias e têm Row Level Security (RLS) habilitado.

### Tabelas
- `clinic_crm_clinics`: organização/unidade e segmento (médica, odontológica ou mista).
- `clinic_crm_members`: vínculo entre usuário autenticado e clínica, com papel próprio do módulo.
- `clinic_crm_contacts`: leads, pacientes e fontes de indicação; inclui consentimento de marketing e próximo follow-up.
- `clinic_crm_opportunities`: funil de conversão por serviço/procedimento administrativo.
- `clinic_crm_appointments`: agenda, profissional, status, confirmação e faltas.
- `clinic_crm_interactions`: histórico de relacionamento por canal.
- `clinic_crm_tasks`: tarefas, lembretes e follow-up.
- `clinic_crm_audit_events`: trilha de auditoria.

## Isolamento e segurança
- Todas as entidades operacionais carregam `clinic_id`.
- RLS exige vínculo ativo do usuário à clínica.
- Relações entre contato, oportunidade, consulta e tarefa verificam o mesmo `clinic_id`, impedindo referências cruzadas entre clínicas.
- A chave `anon` não recebe acesso às tabelas; as operações são destinadas a usuários autenticados.
- A criação inicial de uma clínica é feita pela função `clinic_crm_create_clinic(nome, segmento)`, que cria a clínica e transforma o usuário autenticado em proprietário.
- O modelo inicial não contém prontuário, diagnósticos, prescrições ou notas clínicas. O CRM deve cuidar de relacionamento e operação administrativa, não substituir o PEP.

## Próxima implementação na interface
1. Adicionar uma entrada independente no menu, sem misturar contatos de clínicas aos clientes comerciais.
2. Implementar seleção/criação da clínica e gestão de membros por papel.
3. Construir dashboard, contatos, funil, agenda, interações, tarefas e relatórios.
4. Aplicar permissões por função além do isolamento por clínica.
5. Adicionar testes de integração para provar que usuários de uma clínica não conseguem ler, alterar nem vincular dados de outra.
6. Só então integrar WhatsApp oficial, lembretes automáticos e sistemas de prontuário/agendamento externos.

## Limites atuais
A fundação do banco está criada; a interface ainda não está conectada a essas tabelas. Nenhuma clínica, usuário ou paciente foi criado. A RLS precisa de testes autenticados com usuários reais antes de usar dados de produção. A análise de segurança também apontou alertas preexistentes em funções SECURITY DEFINER e na proteção contra senhas vazadas; não foram alterados neste trabalho.
