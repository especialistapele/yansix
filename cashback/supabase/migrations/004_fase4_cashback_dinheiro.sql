-- ============================================================
-- FASE 4 — Cashback em dinheiro real
-- ============================================================

alter table public.servicos add column if not exists cashback_pct numeric(5,2) not null default 0;
alter table public.configuracoes add column if not exists cashback_expiracao_dias integer not null default 90;
alter table public.configuracoes add column if not exists cashback_ativo boolean not null default false;

create table public.cashback_lancamentos (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo text not null check (tipo in ('credito','uso')),
  valor numeric(10,2) not null,
  pontuacao_id uuid references public.pontuacoes(id),
  expira_em date,
  created_at timestamptz not null default now()
);
create index idx_cashback_cliente on public.cashback_lancamentos(cliente_id);

alter table public.cashback_lancamentos enable row level security;
create policy "owner acessa cashback" on public.cashback_lancamentos
  for all using (estabelecimento_id in (select id from public.estabelecimentos where owner_id = auth.uid()))
  with check (estabelecimento_id in (select id from public.estabelecimentos where owner_id = auth.uid()));

create or replace function public.cliente_publico_saldo_cashback(p_cliente_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo numeric;
  v_ativo boolean;
  v_estab_id uuid;
begin
  select estabelecimento_id into v_estab_id from clientes where id = p_cliente_id;
  if v_estab_id is null then return null; end if;
  select coalesce(cashback_ativo,false) into v_ativo from configuracoes where estabelecimento_id = v_estab_id;

  select coalesce(sum(case when tipo='credito' and (expira_em is null or expira_em >= current_date) then valor
                            when tipo='uso' then -valor else 0 end),0)
  into v_saldo
  from cashback_lancamentos where cliente_id = p_cliente_id;

  return json_build_object('ativo', v_ativo, 'saldo', v_saldo);
end;
$$;
grant execute on function public.cliente_publico_saldo_cashback(uuid) to anon;
