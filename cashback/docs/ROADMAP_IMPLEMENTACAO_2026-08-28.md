# Roadmap de implementação — Yansix Cashback

## Hierarquia
- Admin Master: visão global, cria e administra estabelecimentos e seus administradores.
- Admin Estabelecimento: administra apenas sua unidade e sua equipe.
- Profissional: acesso restrito aos próprios registros/operações permitidas.

## Blocos funcionais
1. Fundação: Auth, roles, RLS, Edge Functions, criação de estabelecimento.
2. Estabelecimentos: CRUD, administrador, dados, aparência e equipe.
3. Operações: pontuação, cashback, prêmios, níveis, resgates e cupons.
4. Histórico: auditoria unificada e filtros Estabelecimento > Profissional > Cliente > evento > período.
5. Master: dashboard global, comparativos e indicadores.
6. Marketing: regras, mensagens, automações e indicadores.
7. Clientes: busca, aniversariantes e segmentação.
8. Testes: isolamento Master/Admin/Profissional e fluxos ponta a ponta.

## Pendências deliberadas
- API oficial do WhatsApp depende das credenciais/provedor.
- Gráficos avançados e métricas de campanha devem ser validados com dados reais.
- O cadastro de estabelecimento precisa ser testado no ambiente do usuário; a Edge Function deve retornar o erro específico caso haja falha.
