-- YANSIX CRM: módulo de reuniões compartilhadas
-- Aplicado no projeto Supabase zxeupenncextzrqgthqx em 2026-10-15.
-- Reaplicável: tabela/índices são IF NOT EXISTS e as políticas são recriadas.

create table if not exists public.reunioes (
  id text primary key,
  titulo text not null check (char_length(trim(titulo)) between 2 and 160),
  cliente_id text null references public.clientes(id) on delete set null,
  participantes jsonb not null default '[]'::jsonb check (jsonb_typeof(participantes) = 'array'),
  data_inicio timestamptz not null,
  duracao_minutos integer not null default 30 check (duracao_minutos between 5 and 480),
  pauta text not null default '' check (char_length(pauta) <= 5000),
  link_video text not null default '' check (char_length(link_video) <= 2048),
  status text not null default 'agendada' check (status in ('agendada','realizada','cancelada')),
  criado_por text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists reunioes_data_inicio_idx on public.reunioes(data_inicio);
create index if not exists reunioes_cliente_id_idx on public.reunioes(cliente_id);

alter table public.reunioes enable row level security;
grant select, insert, update, delete on public.reunioes to authenticated;

drop policy if exists "CRM active users can read meetings" on public.reunioes;
create policy "CRM active users can read meetings"
on public.reunioes for select to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.id = (select auth.uid())::text and u.ativo is true
  )
);

drop policy if exists "CRM active users can create meetings" on public.reunioes;
create policy "CRM active users can create meetings"
on public.reunioes for insert to authenticated
with check (
  exists (
    select 1 from public.usuarios u
    where u.id = (select auth.uid())::text and u.ativo is true
  )
  and criado_por = (select auth.uid())::text
);

drop policy if exists "CRM active users can update meetings" on public.reunioes;
create policy "CRM active users can update meetings"
on public.reunioes for update to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.id = (select auth.uid())::text and u.ativo is true
  )
  and criado_por = (select auth.uid())::text
)
with check (
  exists (
    select 1 from public.usuarios u
    where u.id = (select auth.uid())::text and u.ativo is true
  )
  and criado_por = (select auth.uid())::text
);

drop policy if exists "CRM active users can delete meetings" on public.reunioes;
create policy "CRM active users can delete meetings"
on public.reunioes for delete to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.id = (select auth.uid())::text and u.ativo is true
  )
  and criado_por = (select auth.uid())::text
);
