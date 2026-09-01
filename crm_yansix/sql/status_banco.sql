-- =========================================================
-- YANSIX CRM — Status do banco (Fase 2 do roadmap)
-- Rodar UMA VEZ no SQL Editor do Supabase DESTE CRM
-- (não é o Supabase do painel central).
--
-- Cria uma função que devolve o tamanho atual do banco em MB,
-- para o próprio CRM mostrar "X% utilizado" na tela de
-- Configurações, sem expor números técnicos ao cliente final.
-- =========================================================

create or replace function public.obter_status_banco()
returns table (tamanho_mb numeric, verificado_em timestamptz)
language sql
security definer
set search_path = public
as $$
  select
    round(pg_database_size(current_database()) / 1024.0 / 1024.0, 2) as tamanho_mb,
    now() as verificado_em;
$$;

-- Só usuários autenticados do próprio CRM podem chamar esta função
-- (o app já autentica via Supabase Auth antes de qualquer chamada).
revoke all on function public.obter_status_banco() from public;
grant execute on function public.obter_status_banco() to authenticated;
