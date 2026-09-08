-- ============================================================
-- FASE 6.4 — Correções de segurança para o papel "profissional"
-- ============================================================
-- 1) estabelecimentos: existiam DUAS policies de UPDATE amplas demais que permitiam
--    a qualquer usuário vinculado à unidade (inclusive profissional) editar
--    "Identidade e dados da unidade" (nome, documento, endereço, logo, etc).
--    Como policies de RLS são combinadas com OR, bastava uma delas ser permissiva
--    para anular a restrição da policy correta (master_estabelecimentos_update).
--    Aqui removemos as duas policies amplas e mantemos só a correta
--    (admin_master ou admin_estabelecimento da própria unidade).
drop policy if exists "estabelecimentos_update_hierarquia" on public.estabelecimentos;
drop policy if exists "master_all_update" on public.estabelecimentos;

-- 2) auditoria_admin: a policy de SELECT existente só comparava estabelecimento_id,
--    sem checar o papel — então um profissional conseguia ler TODO o histórico de
--    auditoria da unidade (ações de outros profissionais e do admin), não só as suas.
--    Agora: admin_master vê tudo; admin_estabelecimento vê a sua unidade inteira;
--    profissional só vê os eventos em que ele mesmo é o profissional_id.
drop policy if exists "auditoria_master_select" on public.auditoria_admin;
create policy "auditoria_select_hierarquia" on public.auditoria_admin
  for select using (
    is_admin_master()
    or (minha_role() = 'admin_estabelecimento' and estabelecimento_id = meu_estabelecimento_id())
    or (minha_role() = 'profissional' and profissional_id = auth.uid())
  );
