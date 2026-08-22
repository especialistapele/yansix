# CHANGELOG — YANSIX CRM

## 21/08/2026 — Fase 14.3
- **Hierarquia Gestor → Vendedor**: novo campo `gestorId` em `USUARIOS`. Vendedor é vinculado a um Gestor pela tela de usuários (Configurações).
- **Correção de visibilidade**: até esta fase, o perfil Gestor enxergava todos os registros do sistema (mesmo comportamento do Administrador), pois `isOwnRecord_`/`filterVisibleRows_` só filtravam para o Vendedor. Agora Gestor vê apenas Clientes/Negociações/Interações/Tarefas/Propostas/Histórico dos vendedores vinculados a ele (+ registros próprios); Vendedor continua vendo só os seus; Administrador continua vendo tudo.
- **Segurança de usuários**: `doPost` agora bloqueia `create`/`update`/`delete` em `USUARIOS` para quem não é Administrador (antes o backend não validava isso, só o front escondia a tela).
- **Sessão sempre atualizada**: `requireAuth_` agora recarrega perfil/nome do usuário na planilha a cada requisição autenticada, então uma mudança de perfil/gestor feita pelo Administrador passa a valer na próxima ação do usuário (sem esperar expirar o token de 30 min).
- **Estados de carregamento nos botões**: Criar/Salvar/Excluir em Cliente, Negociação, Tarefa, Proposta, Atividade, Pipeline e Usuário agora mostram "Criando.../Salvando.../Excluindo..." e ficam desabilitados durante o processamento (evita duplo clique / duplicidade de registros).
- **Cache do PWA**: `service-worker.js` bump para `yansix-crm-v2` para forçar atualização dos arquivos em dispositivos com o app instalado.

## 12/08/2026 — Fase 7
- Implantado funil comercial avançado.
- Adicionados produto/serviço, probabilidade, previsão de fechamento, responsável, origem e prioridade às negociações.
- Expandidas as etapas para Lead → Contato → Qualificação → Reunião → Proposta → Negociação → Fechado → Perdido.
- Kanban com cards detalhados, valores por etapa e resumo ponderado do pipeline.
- Drag & drop atualiza a etapa e registra auditoria.
- Filtros e busca no pipeline.
- Configuração persistente dos nomes das etapas via `CONFIGURACOES`.
- Mantida compatibilidade com registros antigos da Fase 6.

# CHANGELOG — YANSIX CRM

## 11/08/2026 — Fase 6

### Visual
- Redesign completo seguindo a nova identidade visual YANSIX.
- Sidebar branca com logo.
- Topbar clara e busca global.
- Cards, botões, formulários, tabelas e Kanban atualizados.
- Paleta oficial da Fase 6 aplicada.
- Responsividade revisada para desktop e mobile.

### Clientes
- Edição completa.
- Exclusão com confirmação.
- Ficha reorganizada.
- Timeline de auditoria.
- Histórico preservado.

### Negociações
- Edição.
- Exclusão com confirmação.
- Auditoria de criação, edição, mudança de etapa e exclusão.
- Drag & drop preservado.

### Tarefas
- Edição.
- Exclusão com confirmação.
- Status concluída/pendente.
- Auditoria.

### Dados
- Nova aba `HISTORICO`.
- Nova chave localStorage `yansix_crm_mock_v4`.
- Apps Script atualizado para a nova coleção.
- CRUD continua separado entre `app.js` e `api.js`.

### Dashboard
- Métricas revisadas.
- Pipeline por etapa.
- Leads por origem.
- Valor do pipeline.
- Tarefas pendentes.
- Atividades recentes.


## Fase 8 — Atividades e Follow-up — 12/08/2026
- Implementado registro completo de atividades comerciais.
- Adicionados último/registro de contato e próximo contato.
- Criada agenda operacional com atrasadas, hoje, próximas e concluídas.
- Criados indicadores de atividades e follow-ups.
- Adicionada edição/exclusão de atividades com histórico.
- Atualizada integração Google Sheets com novos campos.
- Mantida compatibilidade com registros existentes da Fase 7.

## Fase 9 — Propostas e Orçamentos
- Módulo completo de propostas comerciais.
- Campos: cliente, negociação, serviço/item, quantidade, valor unitário, desconto, total, validade, status, número e observações.
- Status: rascunho, enviada, visualizada, negociação, aprovada, recusada e expirada.
- Numeração automática no padrão PROP-0001.
- Busca e filtro por status.
- Edição e exclusão com auditoria.
- Geração de documento imprimível para “Salvar como PDF”.
- Aprovação vinculada a uma negociação move automaticamente o negócio para Fechado com probabilidade de 100%.
- Nova aba PROPOSTAS no Google Sheets.


## Fase 10 — Relatórios e Analytics
- Implementado módulo de Relatórios e Analytics.
- Filtro temporal por período.
- Indicadores de leads, oportunidades, faturamento, ticket médio, conversão e pipeline ponderado.
- Gráficos de origem, etapas e faturamento mensal.
- Ranking de origem e serviço/oportunidade.
- Histórico mensal comercial.
- Layout responsivo integrado à identidade visual atual.
- Validação de sintaxe JS e integridade do pacote realizadas.


## Fase 11 — Automação comercial
- Criadas regras automáticas de follow-up pós-proposta.
- Criado alerta automático para oportunidades sem atividade.
- Criada recuperação automática de oportunidades perdidas.
- Criada atualização automática de status do cliente conforme resultado da negociação.
- Criada configuração de automações com parâmetros ajustáveis.
- Tarefas automáticas recebem `automationKey` e `origemAutomacao` para controle de duplicidade e rastreabilidade.
- Atualizado Google Apps Script para os novos campos das tarefas.


## 12/08/2026 — Fase 12 — Usuários, Login e Permissões
- Adicionada tela de login e controle de sessão.
- Criados perfis Administrador, Gestor e Vendedor.
- Implementadas permissões por módulo e bloqueio de navegação sem autorização.
- Criada área de gerenciamento de usuários exclusiva do Administrador.
- Adicionado CRUD de usuários no `api.js`.
- Adicionada aba `USUARIOS` ao Google Apps Script.
- Mantida compatibilidade com as Fases 7, 8, 9, 10 e 11.
- Mantida a identidade visual YANSIX em roxo/lavanda da Fase 6.


## Fase 13 — Integrações
- Adicionado módulo de Integrações.
- E-mail administrativo alterado para `yansix.tech@gmail.com`.
- Adicionado endpoint Site → CRM para recebimento de leads.
- Adicionada configuração de WhatsApp, Google Calendar e Meta.

## Fase 13 — Ajuste responsivo pós-implantação
- Corrigido o comportamento do CRM em notebooks de 15/15,6 polegadas e resoluções intermediárias.
- O dashboard passa a reorganizar cards e painéis antes de ficar comprimido.
- Pipeline/dashboard e tabelas possuem rolagem horizontal própria quando necessário.
- Sidebar passa a ter rolagem vertical própria em alturas menores.
- Reduzido espaçamento estrutural em telas intermediárias sem reduzir o zoom ou a legibilidade.
- Mantida a experiência para monitores maiores, que continuam aproveitando a largura disponível.
- Nenhuma regra de negócio ou fluxo das Fases 7–13 foi alterada.


## 12/08/2026 — Fase 14 — Segurança, backup e produção
- Implementada expiração de sessão por inatividade e aviso prévio.
- Implementado bloqueio temporário após múltiplas tentativas de login.
- Implementada migração automática de senhas para SHA-256.
- Removida a senha da sessão persistida no navegador.
- Adicionado timeout e recuperação de requisições da API.
- Criada coleção/aba `LOGS` para autenticação, CRUD, erros e eventos técnicos.
- Adicionado backup integral da planilha via `backupAllSheets()`.
- Adicionada limpeza opcional de backups antigos via `cleanupOldBackups(days)`.
- Adicionadas proteções básicas de frontend: noindex, referrer policy e CSP.
- Preservada toda a funcionalidade das Fases 7–13 e o layout responsivo.

## 12/08/2026 — Fase 14.1 — Auditoria de segurança + estrutura /crm
- Corrigida a autenticação para ocorrer no backend Google Apps Script.
- CRUD e leitura agora exigem token de sessão válido.
- Dados do CRM não são sincronizados antes do login.
- Senhas são validadas e armazenadas como SHA-256 no backend.
- Usuários não recebem o campo de senha nas listagens.
- Sessões expiram em 30 minutos e são armazenadas no CacheService do Apps Script.
- Frontend preparado para `MOCK:false` e URL real do Web App.
- Projeto preparado para ser colocado em `/crm/` dentro do site YANSIX.
