-- ============================================================
-- YANSIX CASHBACK — schema inicial (Fase 1-3 + preparo Fase 2)
-- Projeto Supabase: cashback (uaqbnwwjqhhnqzsavbkh)
-- ============================================================

create table public.estabelecimentos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  nome text not null default 'Meu Estabelecimento',
  cor_tema text not null default '#5B3DF5',
  created_at timestamptz not null default now()
);

create table public.configuracoes (
  estabelecimento_id uuid primary key references public.estabelecimentos(id) on delete cascade,
  desconto_aniversariante_pct numeric(5,2) not null default 0,
  validade_pontos text not null default 'sem_validade'
    check (validade_pontos in ('sem_validade','8_meses','10_meses','1_ano','1_ano_meio','2_anos')),
  pontuacao_maxima_servico integer,
  marketing_boca_boca_ativo boolean not null default false,
  indicacao_desconto_pct numeric(5,2) not null default 0,
  indicacao_pontos integer not null default 0,
  indicacao_observacao text,
  updated_at timestamptz not null default now()
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  nome text not null,
  telefone text not null,
  cpf text,
  email text,
  data_nascimento date,
  genero text check (genero in ('feminino','masculino')),
  indicado_por_cliente_id uuid references public.clientes(id),
  created_at timestamptz not null default now()
);
create index idx_clientes_estabelecimento on public.clientes(estabelecimento_id);
create index idx_clientes_telefone on public.clientes(telefone);

create table public.servicos (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  nome text not null,
  valor numeric(10,2) not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  nome text not null,
  valor numeric(10,2),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.pontuacoes (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  servico_id uuid references public.servicos(id),
  valor numeric(10,2) not null,
  pontos integer not null,
  expira_em date,
  created_at timestamptz not null default now()
);
create index idx_pontuacoes_cliente on public.pontuacoes(cliente_id);

create table public.premios (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  nome text not null,
  pontos_necessarios integer not null,
  estoque integer,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.resgates (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  premio_id uuid not null references public.premios(id),
  pontos_utilizados integer not null,
  created_at timestamptz not null default now()
);

create table public.cupons_indicacao (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  cliente_indicador_id uuid not null references public.clientes(id) on delete cascade,
  codigo text not null unique,
  ativo boolean not null default true,
  validado_por_cliente_id uuid references public.clientes(id),
  validado_em timestamptz,
  created_at timestamptz not null default now()
);
create index idx_cupons_codigo on public.cupons_indicacao(codigo);

create table public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  pontuacao_id uuid references public.pontuacoes(id),
  nota smallint not null check (nota between 1 and 5),
  created_at timestamptz not null default now()
);

alter table public.estabelecimentos enable row level security;
alter table public.configuracoes enable row level security;
alter table public.clientes enable row level security;
alter table public.servicos enable row level security;
alter table public.produtos enable row level security;
alter table public.pontuacoes enable row level security;
alter table public.premios enable row level security;
alter table public.resgates enable row level security;
alter table public.cupons_indicacao enable row level security;
alter table public.avaliacoes enable row level security;

create policy "owner acessa seu estabelecimento" on public.estabelecimentos
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner acessa configuracoes" on public.configuracoes
  for all using (estabelecimento_id in (select id from public.estabelecimentos where owner_id = auth.uid()))
  with check (estabelecimento_id in (select id from public.estabelecimentos where owner_id = auth.uid()));

create policy "owner acessa clientes" on public.clientes
  for all using (estabelecimento_id in (select id from public.estabelecimentos where owner_id = auth.uid()))
  with check (estabelecimento_id in (select id from public.estabelecimentos where owner_id = auth.uid()));

create policy "owner acessa servicos" on public.servicos
  for all using (estabelecimento_id in (select id from public.estabelecimentos where owner_id = auth.uid()))
  with check (estabelecimento_id in (select id from public.estabelecimentos where owner_id = auth.uid()));

create policy "owner acessa produtos" on public.produtos
  for all using (estabelecimento_id in (select id from public.estabelecimentos where owner_id = auth.uid()))
  with check (estabelecimento_id in (select id from public.estabelecimentos where owner_id = auth.uid()));

create policy "owner acessa pontuacoes" on public.pontuacoes
  for all using (estabelecimento_id in (select id from public.estabelecimentos where owner_id = auth.uid()))
  with check (estabelecimento_id in (select id from public.estabelecimentos where owner_id = auth.uid()));

create policy "owner acessa premios" on public.premios
  for all using (estabelecimento_id in (select id from public.estabelecimentos where owner_id = auth.uid()))
  with check (estabelecimento_id in (select id from public.estabelecimentos where owner_id = auth.uid()));

create policy "owner acessa resgates" on public.resgates
  for all using (estabelecimento_id in (select id from public.estabelecimentos where owner_id = auth.uid()))
  with check (estabelecimento_id in (select id from public.estabelecimentos where owner_id = auth.uid()));

create policy "owner acessa cupons" on public.cupons_indicacao
  for all using (estabelecimento_id in (select id from public.estabelecimentos where owner_id = auth.uid()))
  with check (estabelecimento_id in (select id from public.estabelecimentos where owner_id = auth.uid()));

create policy "owner acessa avaliacoes" on public.avaliacoes
  for all using (estabelecimento_id in (select id from public.estabelecimentos where owner_id = auth.uid()))
  with check (estabelecimento_id in (select id from public.estabelecimentos where owner_id = auth.uid()));
