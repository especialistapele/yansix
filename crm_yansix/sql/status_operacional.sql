-- =========================================================
-- YANSIX CRM — Status operacional (Fase 2 e Fase 6 do roadmap)
-- Rodar UMA VEZ no SQL Editor do Supabase DESTE CRM
-- (não é o Supabase do painel central).
--
-- Cria uma função que devolve só NÚMEROS AGREGADOS — nunca
-- nomes, e-mails ou qualquer dado individual:
--   - tamanho do banco em MB
--   - total de clientes cadastrados
--   - total de administradores / gestores / vendedores ativos
--
-- Usada em dois lugares:
--   1. Dentro do próprio CRM, na tela de Configurações
--      (usuário já autenticado).
--   2. Pelo Painel Central (admin.yansix.tech), usando só a
--      chave pública (anon key) — por isso a liberação abaixo
--      inclui o papel "anon", e não só "authenticated". Nenhum
--      dado sensível é exposto por essa função, só contagens.
-- =========================================================

create or replace function public.obter_status_operacional()
returns table (
  tamanho_mb numeric,
  total_clientes int,
  total_administradores int,
  total_gestores int,
  total_vendedores int,
  verificado_em timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    round(pg_database_size(current_database()) / 1024.0 / 1024.0, 2) as tamanho_mb,
    (select count(*) from public.clientes) as total_clientes,
    (select count(*) from public.usuarios where perfil = 'Administrador' and ativo is not false) as total_administradores,
    (select count(*) from public.usuarios where perfil = 'Gestor' and ativo is not false) as total_gestores,
    (select count(*) from public.usuarios where perfil = 'Vendedor' and ativo is not false) as total_vendedores,
    now() as verificado_em;
$$;

revoke all on function public.obter_status_operacional() from public;
grant execute on function public.obter_status_operacional() to authenticated, anon;

-- ---------------------------------------------------------
-- Se você já tinha rodado a versão antiga (obter_status_banco),
-- pode removê-la — foi substituída pela função acima.
-- ---------------------------------------------------------
drop function if exists public.obter_status_banco();
