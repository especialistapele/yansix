-- =========================================================
-- YANSIX CRM — Módulo de Comissões (Vendedores e Gestores)
--
-- Este script JÁ FOI APLICADO no projeto Supabase do CRM
-- (zxeupenncextzrqgthqx / "yansix-crm") em 2026-09-08.
-- Fica aqui só como referência/documentação, ou para reaplicar
-- em outro ambiente (ex.: staging).
--
-- Cria a tabela "comissoes", usada pela aba Comissões do CRM
-- para guardar, por negociação com etapa "fechado":
--   - a comissão do vendedor responsável  → papel = 'vendedor'
--   - a comissão do gestor da equipe      → papel = 'gestor'
--     (só é criada se o vendedor tiver um gestor vinculado,
--     campo usuarios.gestorId)
--
-- O próprio CRM cria essas linhas automaticamente (percentual
-- em branco, status "pendente") assim que um Administrador ou
-- Gestor abre a aba Comissões. O "unique" abaixo garante no
-- máximo 1 linha por negociação/papel.
--
-- "id" nas tabelas usuarios/negociacoes/clientes deste projeto
-- é do tipo TEXT (não uuid) — por isso as colunas de referência
-- abaixo também são text.
--
-- RLS segue o mesmo padrão hierárquico já usado nas demais
-- tabelas do projeto (funções public.is_crm_admin() e
-- public.can_access_crm_user()): Administrador vê/edita tudo;
-- Gestor vê/edita as comissões da própria equipe e as suas
-- próprias; Vendedor vê/edita só as próprias (o módulo em si
-- fica oculto para o perfil Vendedor no frontend).
-- =========================================================

create table if not exists public.comissoes (
  "id" text primary key default gen_random_uuid()::text,
  "negociacaoId" text not null references public.negociacoes ("id") on delete cascade,
  "clienteId" text references public.clientes ("id") on delete set null,
  "usuarioId" text not null references public.usuarios ("id") on delete cascade,
  "papel" text not null check ("papel" in ('vendedor','gestor')),
  "valorVenda" numeric not null default 0,
  "percentual" numeric,
  "valorComissao" numeric not null default 0,
  "status" text not null default 'pendente' check ("status" in ('pendente','a_pagar','pago')),
  "dataPagamento" text,
  "criadoEm" timestamptz not null default now(),
  "atualizadoEm" timestamptz,
  unique ("negociacaoId","papel")
);

create index if not exists comissoes_usuario_idx on public.comissoes ("usuarioId");
create index if not exists comissoes_negociacao_idx on public.comissoes ("negociacaoId");
create index if not exists comissoes_cliente_idx on public.comissoes ("clienteId");

alter table public.comissoes enable row level security;

drop policy if exists "CRM hierarchy - comissoes select" on public.comissoes;
create policy "CRM hierarchy - comissoes select" on public.comissoes
  for select to authenticated
  using (public.can_access_crm_user("usuarioId"));

drop policy if exists "CRM hierarchy - comissoes insert" on public.comissoes;
create policy "CRM hierarchy - comissoes insert" on public.comissoes
  for insert to authenticated
  with check (public.can_access_crm_user("usuarioId"));

drop policy if exists "CRM hierarchy - comissoes update" on public.comissoes;
create policy "CRM hierarchy - comissoes update" on public.comissoes
  for update to authenticated
  using (public.can_access_crm_user("usuarioId"))
  with check (public.can_access_crm_user("usuarioId"));

drop policy if exists "CRM hierarchy - comissoes delete" on public.comissoes;
create policy "CRM hierarchy - comissoes delete" on public.comissoes
  for delete to authenticated
  using (public.is_crm_admin());
