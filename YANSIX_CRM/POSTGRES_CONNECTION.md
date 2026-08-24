# YANSIX CRM — conexão Supabase/PostgreSQL

Esta versão substitui a API Google Sheets pelo Supabase/PostgreSQL.

## Configuração já aplicada

- Project URL: `https://zxeupenncextzrqgthqx.supabase.co`
- O CRM usa a chave **publishable** do Supabase.
- O navegador não recebe senha do PostgreSQL nem `service_role`.
- As tabelas usam RLS e exigem usuário autenticado.

## Próximo passo obrigatório

Antes de publicar esta versão no GitHub Pages, crie um usuário em **Supabase → Authentication → Users** com o e-mail que será usado para entrar no CRM.

Depois crie o respectivo registro na tabela `usuarios`, com o mesmo e-mail e perfil `Administrador`.

Não adicione senha na tabela `usuarios`: a senha pertence ao Supabase Auth.

## Observação

A tela de gerenciamento de usuários do CRM será ligada ao Supabase Auth em uma etapa seguinte, porque criação administrativa de usuários exige operação segura no servidor/Edge Function e não deve expor credenciais privilegiadas no navegador.
