# YANSIX CRM — Integração Supabase Auth

## Banco
O banco Supabase já possui Auth + RLS + hierarquia Administrador/Gestor/Vendedor preparados.

## Aplicação
Esta versão usa o Supabase Auth como fonte de verdade da sessão:
- `signInWithPassword()` para login;
- `getSession()` para restaurar a sessão;
- `onAuthStateChange()` para acompanhar login, logout e renovação do token;
- o perfil do CRM é localizado pelo `auth.uid()` em `public.usuarios.id`;
- usuário inativo é desconectado;
- sem sessão válida, o overlay de login permanece ativo;
- permissões de módulos continuam sendo aplicadas pelo perfil.

## Criação de usuários
A criação administrativa está implementada pela Edge Function `admin-create-user`. O navegador envia apenas o access token do administrador; a `service_role` permanece somente no ambiente seguro da Edge Function.

## Observação
A proteção real dos dados está no RLS do Supabase. O bloqueio de telas no frontend é apenas uma camada adicional de UX/controle de navegação.
