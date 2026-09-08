-- FASE 1: hierarquia e gestão de estabelecimentos
alter table public.estabelecimentos add column if not exists documento text;
alter table public.estabelecimentos add column if not exists telefone text;
alter table public.estabelecimentos add column if not exists email text;
alter table public.estabelecimentos add column if not exists endereco text;
alter table public.estabelecimentos add column if not exists horario_funcionamento text;
alter table public.estabelecimentos add column if not exists area_atuacao text;
alter table public.estabelecimentos add column if not exists status text not null default 'ativo' check (status in ('ativo','inativo'));
create index if not exists idx_estabelecimentos_status on public.estabelecimentos(status);
create index if not exists idx_estabelecimentos_area_status on public.estabelecimentos(area_atuacao,status);

create or replace function public.is_admin_master() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.perfis where id=auth.uid() and role='admin_master' and estabelecimento_id is null); $$;
create or replace function public.is_admin_estabelecimento(p_estabelecimento_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.perfis where id=auth.uid() and role='admin_estabelecimento' and estabelecimento_id=p_estabelecimento_id); $$;
create or replace function public.is_profissional(p_estabelecimento_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.perfis where id=auth.uid() and role='profissional' and estabelecimento_id=p_estabelecimento_id); $$;
revoke all on function public.is_admin_master() from public; grant execute on function public.is_admin_master() to authenticated;
revoke all on function public.is_admin_estabelecimento(uuid) from public; grant execute on function public.is_admin_estabelecimento(uuid) to authenticated;
revoke all on function public.is_profissional(uuid) from public; grant execute on function public.is_profissional(uuid) to authenticated;

alter table public.perfis drop constraint if exists perfis_admin_estab_check;
alter table public.perfis add constraint perfis_admin_estab_check check ((role='admin_master' and estabelecimento_id is null) or (role in ('admin_estabelecimento','profissional') and estabelecimento_id is not null));
create index if not exists idx_perfis_estabelecimento_role on public.perfis(estabelecimento_id,role);

alter table public.estabelecimentos enable row level security;
drop policy if exists master_estabelecimentos_select on public.estabelecimentos;
create policy master_estabelecimentos_select on public.estabelecimentos for select to authenticated using (public.is_admin_master() or id=public.meu_estabelecimento_id());
drop policy if exists master_estabelecimentos_update on public.estabelecimentos;
create policy master_estabelecimentos_update on public.estabelecimentos for update to authenticated using (public.is_admin_master() or public.is_admin_estabelecimento(id)) with check (public.is_admin_master() or public.is_admin_estabelecimento(id));
