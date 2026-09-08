-- ============================================================
-- FASE 6.9 — Corrige "permission denied for function minha_role" em updates
-- feitos pelas Edge Functions (ex: editar-profissional)
-- ============================================================
-- O gatilho "trg_proteger_vinculo_perfil" (BEFORE UPDATE em perfis) chama minha_role(),
-- e como esse gatilho não é SECURITY DEFINER, ele executa com o papel de quem fez o UPDATE.
-- Quando uma Edge Function usa a service role (supabaseAdmin) para atualizar um perfil,
-- o Postgres bloqueava a chamada porque a service_role nunca tinha permissão de EXECUTE
-- nessas funções auxiliares (só "authenticated" e "postgres" tinham).
grant execute on function public.minha_role() to service_role;
grant execute on function public.is_admin_master() to service_role;
grant execute on function public.meu_estabelecimento_id() to service_role;
grant execute on function public.is_admin_estabelecimento(uuid) to service_role;
