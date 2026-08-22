# YANSIX CRM — migração para PostgreSQL online

Esta versão troca o Google Sheets por **PostgreSQL hospedado no Supabase**, mantendo a interface e a camada `API` do CRM.

## Arquitetura

`CRM (frontend) → Supabase Edge Function → PostgreSQL`

O navegador **não recebe a senha do PostgreSQL/service role**. A Edge Function é a única camada que usa a service role.

## 1. Criar o projeto Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**.
3. Execute todo o arquivo `supabase/schema.sql`.

## 2. Criar a função da API

A função está em:

`supabase/functions/crm-api/index.ts`

Ela mantém os mesmos comandos que o CRM já usava:

- `login`
- `logout`
- `list`
- `create`
- `update`
- `delete`

### Pelo Supabase CLI

Instale/login no Supabase CLI e, dentro desta pasta do CRM:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_ID
supabase functions deploy crm-api --no-verify-jwt
```

O `--no-verify-jwt` é necessário porque o endpoint de login precisa aceitar uma requisição sem token; a própria função valida o token depois do login.

### Variáveis usadas pela função

O Supabase fornece automaticamente:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` no frontend.**

## 3. Criar o primeiro usuário

O CRM usa o **Supabase Auth** para autenticação. O primeiro usuário precisa ser criado antes do primeiro login.

No Supabase:

1. Abra **Authentication → Users**.
2. Crie um usuário com o e-mail que será usado no CRM.
3. Marque o e-mail como confirmado, se essa opção aparecer.
4. Copie o UUID desse usuário.
5. No **SQL Editor**, execute:

```sql
insert into public.usuarios
  (auth_user_id, nome, email, perfil, ativo)
values
  ('UUID_DO_USUARIO_AUTH', 'Administrador', 'SEU_EMAIL', 'Administrador', true);
```

Substitua `UUID_DO_USUARIO_AUTH` e `SEU_EMAIL` pelos dados reais.

Depois disso, o login do CRM passa a funcionar.

## 4. Apontar o CRM para a API PostgreSQL

Abra:

`js/config.js`

Encontre:

```js
POSTGRES_API_URL:"COLE_AQUI_A_URL_DA_EDGE_FUNCTION"
```

Substitua pela URL da função, normalmente no formato:

```text
https://SEU_PROJECT_ID.supabase.co/functions/v1/crm-api
```

Não coloque a URL entre espaços ou acrescente `/` no final.

## 5. Publicar o CRM

Depois de configurar `POSTGRES_API_URL`, publique a pasta do CRM normalmente no seu serviço de hospedagem.

O frontend não precisa de Node.js para funcionar.

## 6. O que foi alterado

- Removida a dependência do Google Apps Script/Google Sheets na camada de dados.
- Mantida a interface atual do CRM.
- Mantidas as chamadas `API.get`, `API.getAll`, `API.create`, `API.update`, `API.remove` e `API.audit`.
- Login migrado para Supabase Auth.
- Senhas deixam de ser armazenadas na tabela `usuarios`.
- Usuários continuam sendo administrados pela tela existente do CRM.
- Clientes, negociações, interações, tarefas, propostas, histórico, configurações e logs passam para PostgreSQL.
- Relacionamentos com clientes são feitos por chaves estrangeiras PostgreSQL.
- Exclusão de cliente remove os registros comerciais relacionados, mas preserva o histórico de auditoria.

## 7. Dados que já estavam no Google Sheets

A adaptação **não apaga nem importa automaticamente** os dados antigos do Google Sheets.

Isso é proposital para evitar uma migração destrutiva.

Se o seu Google Sheets já tiver clientes, negociações etc., exporte os dados antes da troca. A migração pode ser feita depois para as tabelas PostgreSQL.

## 8. Segurança

A arquitetura evita colocar a `service_role` no JavaScript do navegador.

O fluxo é:

1. Usuário faz login.
2. Supabase Auth entrega um access token.
3. CRM envia `Authorization: Bearer TOKEN`.
4. Edge Function valida o token.
5. Edge Function consulta PostgreSQL usando a service role.
6. Somente dados necessários retornam ao CRM.

Para produção, recomenda-se também restringir o CORS da Edge Function ao domínio real do CRM, em vez de `*`.
