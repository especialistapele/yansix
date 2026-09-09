
## 2026-09-08 — 5 novos módulos: Catálogo, Automação real, Financeiro, Motivo de perda, NPS
- **Catálogo de Produtos/Serviços** (aba "Produtos"): CRUD simples (nome, categoria, preço padrão, ativo/inativo). Só Administrador cadastra/edita/exclui; Gestor só visualiza. No formulário de negociação, "Produto/Serviço" agora sugere os itens do catálogo (campo combo com `<datalist>` — continua aceitando texto livre, então negociações antigas não quebram), e se o item tem preço padrão e o campo valor está vazio, o valor é preenchido automaticamente. Nova tabela `produtos_servicos` no Supabase.
- **Automação ativada de verdade**: `runAutomations()` já existia no código mas nunca era chamado — agora roda a cada sincronização (a cada 60s e ao logar), criando as tarefas de follow-up de proposta, lead parado e recuperação de oportunidade perdida que já estavam configuradas em Configurações.
- **Financeiro** (aba "Financeiro", Administrador e Gestor): faturas por cliente (valor, valor pago, status Em aberto/Parcial/Pago/Cancelado, forma de pagamento, vencimento, data de pagamento), pode ser vinculada a uma negociação. Cards de faturado/recebido/em aberto no período, e uma tabela simples de fluxo de caixa dos últimos 6 meses. Nova tabela `faturas` no Supabase.
- **Motivo de perda**: ao mover uma negociação para "Perdido" (no Kanban por arrastar-e-soltar, ou editando a negociação), o sistema agora pede o motivo (campo combo com sugestões: Preço, Concorrência, Sem retorno do cliente, Timing/orçamento, etc., mas aceita texto livre) — obrigatório para salvar. Relatórios ganhou um painel novo "Motivos de perda" com o ranking de motivos e as perdas cruzadas por origem do lead. Nova coluna `negociacoes.motivoPerda`.
- **Satisfação/NPS** (aba "Satisfação", Administrador e Gestor): registro manual de nota (0–10) e comentário por cliente, com nota média, total de respondidas e pendentes. É registro manual (não há envio automático de pesquisa por e-mail/WhatsApp — isso exigiria uma integração de envio que o projeto ainda não tem). Nova tabela `pesquisas_satisfacao` no Supabase.
- `js/config.js`, `js/api.js` atualizados com as novas tabelas/permissões (Gestor ganhou acesso a Produtos, Financeiro e Satisfação).

## 2026-09-08 — Nome do vendedor na tela do gestor
- No modal "Ver vendas" aberto a partir da aba Gestores, agora aparece uma coluna **Vendedor** mostrando quem fez cada venda (antes só aparecia o cliente).
- Confirmado que a "Taxa de conversão (reunião → fechamento)" não é bug: a tabela `interacoes` do banco está vazia — assim que interações do tipo "Reunião" forem registradas na aba Interações, a conversão passa a calcular sozinha.

## 2026-09-08 — Correção: percentual da comissão não salvava
- Bug encontrado com acesso direto ao Supabase: `ensureCommissionRecords()` tentava gravar `percentual: ""` (texto vazio) numa coluna `numeric`, o que o Postgres rejeita (`invalid input syntax for type numeric`). O erro caía num try/catch silencioso, então nenhuma linha de comissão chegava a ser criada — por isso o botão Salvar não tinha em cima do que gravar, e o total geral ficava sempre zerado.
- Corrigido para `percentual: null`. As linhas de comissão que faltavam para as 5 negociações já fechadas foram criadas diretamente no banco (9 linhas: 5 de vendedor + 4 de gestor).

## 2026-09-08 — Botão Salvar nas comissões + filtros avançados de Desempenho
- Nos modais "Ver vendas" (vendedor e gestor), o % de comissão, o status e a data de pagamento agora só são salvos ao clicar em **Salvar** na linha (antes salvava sozinho ao sair do campo).
- Sub-aba Desempenho ganhou: filtro por origem do lead, filtro por produto/serviço, ticket médio por vendedor/equipe, tempo médio entre criação do lead e fechamento, metas de vendas por vendedor e por equipe (com barra de progresso, editável direto na tabela), comparativo do período atual vs. anterior por vendedor, e exportação do ranking em CSV e PDF (impressão).
- Metas ficam salvas na tabela `configuracoes` (chave `metasComerciais`), sem precisar de nova tabela no banco.

## 2026-09-08 — Tabela `comissoes` criada no Supabase
- Confirmado (com acesso direto ao projeto Supabase `zxeupenncextzrqgthqx` / "yansix-crm") que este é de fato um projeto dedicado ao CRM, com todas as tabelas já existentes (`usuarios`, `clientes`, `negociacoes`, `interacoes`, `tarefas`, `propostas`, `historico`, `configuracoes`, `logs`). A investigação anterior (entrada de 2026-09-07 abaixo) usou por engano projetos errados (bancos do painel central da YANSIX); o schema prefixado `crm_yansix_*` criado a partir dela foi descartado.
- Tabela `comissoes` criada diretamente neste projeto (ver `sql/comissoes.sql`), com `id`s em `text` (para bater com o restante do schema) e RLS seguindo o mesmo padrão hierárquico das demais tabelas (`public.is_crm_admin()` / `public.can_access_crm_user()`): Administrador vê/edita tudo; Gestor vê/edita as comissões da própria equipe; cada usuário vê/edita as próprias.
- `js/config.js` (`DB_TABLES`) mantido com os nomes reais (sem prefixo).

## 2026-09-07 — Módulo de Comissões (Vendedores e Gestores)
- Nova aba **Comissões** (Administrador e Gestor), com sub-abas Vendedores, Gestores e Desempenho.
- Vendedores: lista todos os vendedores com o nome do gestor ao lado; ao clicar, abre a lista de negociações fechadas do vendedor com valor da venda, % de comissão (editável), comissão calculada automaticamente, status (Pendente/A pagar/Pago), data de pagamento e total geral do período.
- Gestores: mesma lógica aplicada às vendas de toda a equipe do gestor, com percentual próprio por venda (independente do percentual do vendedor).
- Desempenho: ranking de vendedores e de equipes por valor vendido no período, destaque de "vendedor do mês" e "em destaque" (maior crescimento vs. período anterior), taxa de conversão de reunião → fechamento por vendedor, filtro por período (mês) e por equipe, e uma lista de sugestões de novos filtros para próximas iterações.
- Nova tabela `comissoes` no Supabase (ver `sql/comissoes.sql`) — 1 linha por negociação fechada e papel (vendedor/gestor), criada automaticamente pelo próprio CRM.
- `usuarios.gestorId` (já existente desde a Fase 14.3) é reaproveitado para vincular a comissão do gestor às vendas da sua equipe.

## 2026-09-02 — Status operacional exposto ao Painel Central
- Nova função `public.obter_status_operacional()` (substitui `obter_status_banco()`): devolve tamanho do banco + contagem de clientes/administradores/gestores/vendedores — nunca dados individuais.
- Liberada tanto para `authenticated` (tela de Configurações → Status do CRM, dentro do próprio CRM) quanto para `anon` (consulta somente-leitura feita pelo Painel Central usando a anon key já cadastrada, sem login e sem `service_role`).
- Ver `sql/status_operacional.sql`.

## 2026-08-24 — Provisionamento seguro de usuários
- Implantada a Edge Function `admin-create-user` no Supabase.
- A criação de Administrador/Gestor/Vendedor agora usa Supabase Auth + perfil em `public.usuarios`.
- `service_role` permanece somente no ambiente seguro da Edge Function.
- Frontend configurado para chamar `admin-create-user`.
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


## 2026-08-24 — Supabase Auth
- Sessão do CRM passou a ser restaurada diretamente do Supabase Auth.
- Perfil `public.usuarios` é localizado pelo ID do usuário autenticado.
- Adicionado listener de mudanças de autenticação.
- Rotas/telas dependem de sessão válida e permissões do perfil.
- RLS permanece como camada de segurança dos dados.
