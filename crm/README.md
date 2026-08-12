# YANSIX CRM — Fase 14

## Versão
**Fase 7 — Funil comercial avançado + redesign visual**
**Data:** 11/08/2026

Esta entrega foi aplicada diretamente sobre a versão **Yansix_CRM_Fase_5_implantada.zip**, preservando a arquitetura planejada no roadmap:
`Interface → app.js → api.js → Google Apps Script → Google Sheets`.

O Roadmap oficial define a Fase 6 como a etapa de gerenciamento completo dos registros, incluindo edição, exclusão, tratamento de erros, histórico de alterações e auditoria com data, usuário, ação, registro e alteração. 

## O que foi implantado
## Fase 7 — Funil comercial avançado

Esta entrega foi aplicada diretamente sobre a versão da Fase 6, preservando a arquitetura `Interface → app.js → api.js → Google Apps Script → Google Sheets`. O roadmap define a Fase 7 como um pipeline profissional com dados comerciais completos, oito etapas, Kanban detalhado e movimentação por drag & drop.

### O que foi implantado
- Negociação com cliente, produto/serviço, valor, etapa, probabilidade, previsão de fechamento, responsável, origem e prioridade.
- Etapas padrão: Lead, Contato, Qualificação, Reunião, Proposta, Negociação, Fechado e Perdido.
- Probabilidade padrão por etapa, editável em cada negociação.
- Kanban com cards detalhados e valores por etapa.
- Drag & drop atualizando automaticamente a etapa e registrando auditoria.
- Filtros por prioridade, responsável e origem, além de busca por cliente, produto/serviço e responsável.
- Resumo do pipeline com oportunidades abertas, valor aberto, valor ponderado por probabilidade e urgentes.
- Configuração dos nomes das etapas preservando os IDs internos.
- Nova aba `CONFIGURACOES` para persistir a configuração do pipeline.
- Compatibilidade com negociações antigas: `previsao` continua reconhecida como fallback para `previsaoFechamento`.


### 1. Novo visual YANSIX
Paleta aplicada:
- Primária: `#5B3DF5`
- Secundária: `#8B6CFF`
- Destaque: `#C8B8FF`
- Fundo principal: `#F7F7FC`
- Cards: `#FFFFFF`
- Bordas: `#E7E9F4`
- Texto principal: `#1F2340`
- Texto secundário: `#6B7090`

O layout foi redesenhado com sidebar branca, logo YANSIX, topbar clara, cards suaves, lavanda/roxo, sombras discretas, maior espaçamento e responsividade.

### 2. Clientes
- Editar cliente completo.
- Exclusão com confirmação.
- Ficha comercial reorganizada.
- Ações de edição e exclusão dentro da ficha.
- Timeline de auditoria na ficha.
- Histórico de alterações preservado após exclusão.

### 3. Negociações
- Editar negociação.
- Alterar cliente, etapa, valor e previsão.
- Excluir negociação com confirmação.
- Auditoria de criação, edição, mudança de etapa e exclusão.
- Kanban mantém drag & drop e registra mudança de etapa.

### 4. Tarefas
- Editar tarefa.
- Alterar cliente, título, data, hora, canal e status.
- Excluir tarefa com confirmação.
- Concluir/reabrir tarefa.
- Auditoria de criação, edição e exclusão.

### 5. Auditoria
Nova coleção/aba `HISTORICO`:
- `id`
- `clienteId`
- `entidade`
- `registroId`
- `dataHora`
- `usuario`
- `acao`
- `alteracao`

No modo local, o histórico é persistido junto com os dados. No Google Sheets, `setupSheets()` cria a aba e as colunas sem apagar cabeçalhos existentes.

### 6. Dashboard
As métricas foram reorganizadas para refletir:
- Total de leads atuais.
- Oportunidades em aberto.
- Negócios ganhos.
- Valor do pipeline ativo.
- Distribuição de negociações por etapa.
- Valor por etapa.
- Leads por origem.
- Tarefas pendentes.
- Atividades recentes.

## Configuração do Google Sheets

1. Copie o conteúdo de `apps-script/Code.gs` para o Apps Script.
2. Configure `SPREADSHEET_ID` se o script não estiver vinculado à planilha.
3. Execute `setupSheets()` uma vez.
4. Publique/atualize o Web App.
5. Em `js/config.js`, altere:
   - `MOCK: false`
   - `SHEETS_API_URL: "URL_DO_WEB_APP"`

## Modo local
O projeto inicia com `MOCK: true`, usando localStorage com a chave:
`yansix_crm_mock_v4`

Isso evita conflito com a estrutura local anterior.

## Roadmap
- Fase 0 — Auditoria: base
- Fase 1 — Fundação: concluída
- Fase 2 — Persistência: concluída
- Fase 3 — API / Apps Script: concluída
- Fase 4 — Dashboard + CRM básico: concluída
- Fase 5 — Cadastro completo: concluída
- **Fase 6 — Edição, exclusão e histórico: concluída**
- **Fase 7 — Funil comercial avançado: concluída nesta entrega**
- Fase 8 — Atividades e Follow-up
- Fase 11 — Relatórios e Analytics
- Fase 10 — Relatórios e Analytics
- Fase 11 — Automação comercial
- Fase 12 — Usuários, Login e Permissões
- Fase 13 — Integrações
- Fase 14 — Segurança, backup e produção


## Fase 8 — Atividades e Follow-up

Implementada sobre a base da Fase 7, mantendo a arquitetura Interface → app.js → api.js → Google Apps Script → Google Sheets.

- Registro de atividades: Ligação, WhatsApp, E-mail, Reunião, Proposta, Visita e Observação.
- Data e hora da atividade.
- Resultado/assunto e descrição.
- Próximo contato.
- Agenda com visões: atrasadas, hoje, próximas e concluídas.
- Alertas de follow-up atrasado.
- Edição e exclusão de atividades com auditoria.
- Tarefas agora identificam também o tipo/canal.
- Estrutura do Google Sheets atualizada para INTERACOES e TAREFAS.

## Fase 10 — Relatórios e Analytics
O CRM agora possui uma camada formal de propostas comerciais, mantendo a arquitetura Interface → app.js → api.js → Google Apps Script → Google Sheets.

### Recursos
- Cadastro de proposta com cliente e negociação vinculada.
- Serviço/item, quantidade, valor unitário, desconto e total calculado.
- Validade, observações e status comercial.
- Numeração automática `PROP-0001`, `PROP-0002` etc.
- Status: Rascunho, Enviada, Visualizada, Negociação, Aprovada, Recusada e Expirada.
- Busca, filtro, edição e exclusão.
- Auditoria das alterações.
- Documento de proposta pronto para impressão/“Salvar como PDF”.
- Quando uma proposta vinculada é marcada como Aprovada, a negociação correspondente é automaticamente movida para Fechado com probabilidade de 100%.

### Google Sheets
A aba `PROPOSTAS` é criada pelo `setupSheets()` com as colunas:
`id, numero, clienteId, negociacaoId, servico, quantidade, valorUnitario, desconto, total, validade, status, observacoes, criadoEm, atualizadoEm`.

> Após atualizar o Apps Script, execute `setupSheets()` uma vez na planilha para criar a nova aba/colunas antes de publicar a nova versão do Web App.


## Fase 10 — Relatórios e Analytics

- Relatórios por período: 30, 90, 180, 365 dias ou todo o período.
- Leads por origem.
- Funil por etapa com quantidade e valor.
- Faturamento por mês.
- Ticket médio e taxa de conversão.
- Pipeline aberto e pipeline ponderado.
- Propostas e taxa de aprovação.
- Melhor origem e serviço/oportunidade.
- Indicadores históricos de leads, oportunidades, vendas e faturamento.
- Ciclo médio de vendas quando houver datas de criação e fechamento disponíveis.


## Fase 11 — Automação comercial

A versão inclui regras automáticas para reduzir trabalho manual e acelerar o follow-up:

- Follow-up automático após proposta enviada, visualizada ou em negociação.
- Alertas para oportunidades abertas sem atividade pelo período configurado.
- Atualização automática do status do cliente quando uma negociação é ganha ou perdida.
- Recuperação automática de oportunidades perdidas após o período configurado.
- Regras configuráveis em **Configurações → Automação comercial**.
- Tarefas automáticas identificadas por `automationKey` para evitar duplicidades.
- Histórico das alterações de status executadas pela automação.
- Compatibilidade com localStorage e Google Sheets.

### Regras padrão

- Proposta → follow-up: 3 dias.
- Oportunidade parada: 7 dias sem atividade.
- Recuperação: 30 dias após a referência da oportunidade perdida.
- Automação ativada por padrão.


## Fase 12 — Usuários, Login e Permissões
**Data:** 12/08/2026

A Fase 12 adiciona a camada de acesso do CRM sem alterar a arquitetura `Interface → app.js → api.js → Google Apps Script → Google Sheets`. O objetivo é preparar o sistema para equipes com login, perfis e controle de visibilidade por módulo.

### Entregas
- Tela de login antes do acesso ao CRM.
- Sessão persistida no navegador para manter o acesso entre recarregamentos.
- Perfis **Administrador**, **Gestor** e **Vendedor**.
- Permissões por módulo e bloqueio de navegação não autorizada.
- Área **Usuários** exclusiva do Administrador.
- Cadastro, edição, ativação/desativação e alteração de perfil de usuários.
- Nova aba `USUARIOS` preparada no Google Sheets.
- Auditoria passa a utilizar o usuário autenticado como responsável quando aplicável.
- Compatibilidade preservada com todas as funcionalidades das Fases 7–11.

### Perfis
| Perfil | Acesso |
|---|---|
| Administrador | Todos os módulos + gestão de usuários |
| Gestor | Dashboard, clientes, funil, tarefas, interações, calendário, propostas, relatórios e automação |
| Vendedor | Dashboard, clientes, funil, tarefas, interações, calendário e propostas |

### Primeiro acesso local
- E-mail: `yansix.tech@gmail.com`
- Senha: `Yansix@2026`

> Esta autenticação da Fase 12 é uma camada funcional de acesso para o estágio atual do projeto. A proteção criptográfica de credenciais, autenticação robusta de API, controle de sessão no servidor, logs de acesso e demais controles de produção permanecem planejados para a Fase 14.

### Google Sheets
A execução de `setupSheets()` agora também cria a aba `USUARIOS` com as colunas `id`, `nome`, `email`, `senha`, `perfil`, `ativo` e `criadoEm`.


## Fase 13 — Integrações
- E-mail padrão: `yansix.tech@gmail.com`.
- WhatsApp Business configurável.
- Google Calendar preparado.
- Webhook Site → CRM para criação automática de leads via Google Apps Script.
- Estrutura preparada para Instagram/Meta.
- Configurações persistidas na aba `INTEGRACOES` / chave `integrations`.

### Webhook de lead
Envie um POST JSON para a URL do Web App do Apps Script com `action: "lead"` e `data` contendo `nome`, `email`, `telefone/contato`, `whatsapp`, `empresa`, `origem` e `mensagem/observacoes`. O endpoint cria o lead na aba `CLIENTES`.

### Ajuste responsivo — Fase 13
A interface foi refinada para funcionar melhor em notebooks de 15/15,6" e resoluções intermediárias, sem exigir redução do zoom do navegador. O layout reorganiza os painéis, mantém rolagem horizontal localizada em tabelas/Kanban e permite rolagem vertical da barra lateral quando a altura da tela é menor. Em monitores maiores, o CRM continua utilizando a área disponível.


## Fase 14 — Segurança, backup e produção
**Data:** 12/08/2026

- Sessões com expiração por inatividade (30 minutos) e aviso prévio.
- Bloqueio temporário após 5 tentativas de login malsucedidas.
- Senhas migradas para SHA-256 no primeiro login bem-sucedido; novas senhas também são armazenadas como hash.
- Sessão local não armazena a senha do usuário.
- Logout e invalidação de sessão quando o usuário é desativado.
- Requisições à API com timeout, `cache: no-store` e uma tentativa de recuperação automática.
- Logs de auditoria, CRUD, autenticação, erros e health-check na coleção `LOGS`.
- Google Apps Script preparado para criação de backup integral da planilha com `backupAllSheets()` e limpeza opcional com `cleanupOldBackups(30)`.
- Proteções básicas no frontend: `noindex`, `Referrer-Policy` e Content Security Policy compatível com o CRM.
- Mantida a responsividade implantada na Fase 13.

### Observação de produção
A autenticação ainda depende do Google Apps Script/Google Sheets enquanto `MOCK` permanecer desligado. Para produção definitiva, recomenda-se executar o Web App com controle de acesso adequado e manter o Apps Script/planilha protegidos por conta Google. O hash de senha reduz a exposição de credenciais armazenadas, mas não substitui um provedor de identidade dedicado.

### Backup
No Apps Script, execute `backupAllSheets()` para criar uma cópia integral da planilha no Google Drive. `cleanupOldBackups(30)` pode ser executada periodicamente para remover cópias antigas.
