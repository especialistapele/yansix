-- YANSIX CRM - PostgreSQL / Supabase
-- Execute este arquivo no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  nome text not null,
  email text not null unique,
  perfil text not null default 'Vendedor' check (perfil in ('Administrador','Gestor','Vendedor')),
  gestor_id uuid references public.usuarios(id) on delete set null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.negociacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.interacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.tarefas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.propostas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete cascade,
  negociacao_id uuid references public.negociacoes(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.historico (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete set null,
  entidade text not null,
  registro_id text,
  data_hora timestamptz not null default now(),
  usuario text,
  acao text,
  alteracao text,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.configuracoes (
  id text primary key,
  chave text not null unique,
  valor text,
  payload jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  tipo text,
  usuario text,
  acao text,
  entidade text,
  registro_id text,
  detalhes text,
  data_hora timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_negociacoes_cliente on public.negociacoes(cliente_id);
create index if not exists idx_interacoes_cliente on public.interacoes(cliente_id);
create index if not exists idx_tarefas_cliente on public.tarefas(cliente_id);
create index if not exists idx_propostas_cliente on public.propostas(cliente_id);
create index if not exists idx_propostas_negociacao on public.propostas(negociacao_id);
create index if not exists idx_historico_cliente on public.historico(cliente_id);
create index if not exists idx_historico_registro on public.historico(entidade, registro_id);

-- O frontend não acessa estas tabelas diretamente. A Edge Function usa a service role.
alter table public.usuarios enable row level security;
alter table public.clientes enable row level security;
alter table public.negociacoes enable row level security;
alter table public.interacoes enable row level security;
alter table public.tarefas enable row level security;
alter table public.propostas enable row level security;
alter table public.historico enable row level security;
alter table public.configuracoes enable row level security;
alter table public.logs enable row level security;

-- Garante que a função sempre consiga atualizar o timestamp.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_usuarios_updated on public.usuarios;
create trigger trg_usuarios_updated before update on public.usuarios for each row execute function public.set_updated_at();
drop trigger if exists trg_clientes_updated on public.clientes;
create trigger trg_clientes_updated before update on public.clientes for each row execute function public.set_updated_at();
drop trigger if exists trg_negociacoes_updated on public.negociacoes;
create trigger trg_negociacoes_updated before update on public.negociacoes for each row execute function public.set_updated_at();
drop trigger if exists trg_interacoes_updated on public.interacoes;
create trigger trg_interacoes_updated before update on public.interacoes for each row execute function public.set_updated_at();
drop trigger if exists trg_tarefas_updated on public.tarefas;
create trigger trg_tarefas_updated before update on public.tarefas for each row execute function public.set_updated_at();
drop trigger if exists trg_propostas_updated on public.propostas;
create trigger trg_propostas_updated before update on public.propostas for each row execute function public.set_updated_at();
drop trigger if exists trg_configuracoes_updated on public.configuracoes;
create trigger trg_configuracoes_updated before update on public.configuracoes for each row execute function public.set_updated_at();

-- Insere as configurações padrão usadas pelo CRM.
insert into public.configuracoes (id, chave, valor, payload)
values
  ('pipelineStages', 'pipelineStages', '[{"id":"lead","label":"Lead","defaultProbability":10},{"id":"contato","label":"Contato","defaultProbability":25},{"id":"qualificacao","label":"Qualificação","defaultProbability":40},{"id":"reuniao","label":"Reunião","defaultProbability":60},{"id":"proposta","label":"Proposta","defaultProbability":75},{"id":"negociacao","label":"Negociação","defaultProbability":85},{"id":"fechado","label":"Fechado","defaultProbability":100},{"id":"perdido","label":"Perdido","defaultProbability":0}]', '{"chave":"pipelineStages"}'::jsonb),
  ('automationRules', 'automationRules', '{"followupProposalDays":3,"stalledLeadDays":7,"recoveryDays":30,"reminderDays":0,"enabled":true}', '{"chave":"automationRules"}'::jsonb),
  ('integrations', 'integrations', '{"email":"yansix.tech@gmail.com","whatsappBusiness":"","googleCalendarEnabled":true,"siteWebhookEnabled":true,"metaEnabled":false,"siteWebhookSecret":""}', '{"chave":"integrations"}'::jsonb)
on conflict (id) do nothing;
