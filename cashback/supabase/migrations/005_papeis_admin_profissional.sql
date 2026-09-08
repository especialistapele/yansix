-- ============================================================
-- PAPÉIS DE USUÁRIO: admin_master (Yansix) x profissional (dono do
-- salão/empresa que usa o sistema). Clientes finais não logam.
-- ============================================================

create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin_master','profissional')) default 'profissional',
  estabelecimento_id uuid references public.estabelecimentos(id),
  nome text,
  created_at timestamptz not null default now()
);

create or replace function public.minha_role()
returns text language sql security definer set search_path = public stable
as $$ select role from perfis where id = auth.uid() $$;

create or replace function public.meu_estabelecimento_id()
returns uuid language sql security definer set search_path = public stable
as $$ select estabelecimento_id from perfis where id = auth.uid() $$;

alter table public.perfis enable row level security;
create policy "usuario ve seu proprio perfil" on public.perfis
  for select using (id = auth.uid() or minha_role() = 'admin_master');
create policy "admin gerencia perfis" on public.perfis
  for insert with check (minha_role() = 'admin_master');
create policy "admin atualiza perfis" on public.perfis
  for update using (minha_role() = 'admin_master');

-- Substitui as policies antigas (owner_id) por policies baseadas em papel
-- (repita o padrão abaixo para: estabelecimentos, configuracoes, clientes,
--  servicos, produtos, pontuacoes, premios, resgates, cupons_indicacao,
--  avaliacoes, cashback_lancamentos)
--
-- drop policy if exists "owner acessa <tabela>" on public.<tabela>;
-- create policy "acesso por papel - <tabela>" on public.<tabela>
--   for all using (minha_role()='admin_master' or estabelecimento_id = meu_estabelecimento_id())
--   with check (minha_role()='admin_master' or estabelecimento_id = meu_estabelecimento_id());
--
-- (ver histórico completo de migrations aplicadas no projeto Supabase)

-- Conversão de dinheiro em pontos, configurável pelo profissional
alter table public.configuracoes add column if not exists valor_por_ponto numeric(10,2) not null default 1;

-- Seed: usuário existente vira "profissional" dono do Salão Modelo (demo)
insert into public.perfis (id, role, estabelecimento_id, nome)
values ('28c65b78-0dd4-41b0-a08a-8dcfb63330b5', 'profissional',
        (select id from estabelecimentos where nome = 'Salão Modelo — Demonstração'),
        'Salão Modelo — Demonstração')
on conflict (id) do update set estabelecimento_id = excluded.estabelecimento_id;
