-- ============================================================
-- FASE 6.3 — Correções apontadas em testes:
--  1) perfis passa a guardar o e-mail de login (hoje só existia no
--     Auth, então a tela "Equipe" não conseguia exibi-lo).
--  2) Backfill do e-mail dos profissionais/admins já cadastrados,
--     copiando de auth.users (mesmo id).
--  3) Índice para consultas de atendimentos por serviço + profissional
--     (usado no novo filtro "Histórico > Serviços" do login do
--     profissional).
-- ============================================================

alter table public.perfis add column if not exists email text;

-- Backfill: preenche o e-mail dos perfis existentes a partir do Auth.
-- (roda com privilégio de owner da migration, que enxerga auth.users)
update public.perfis p
set email = u.email
from auth.users u
where u.id = p.id
  and (p.email is null or p.email = '');

create index if not exists idx_atendimentos_prof_servico on public.atendimentos(profissional_id, servico_id, created_at desc);

-- A leitura de perfis já é permitida para admin_master e para o admin da
-- própria unidade (policy perfis_select_hierarquia, migration 021).
-- A escrita direta de nome/e-mail/senha do profissional passa a ser feita
-- exclusivamente pela Edge Function `editar-profissional` (chave de serviço),
-- que também atualiza o Supabase Auth — por isso não é preciso nova policy
-- de UPDATE aqui.
