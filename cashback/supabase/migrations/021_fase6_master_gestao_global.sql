-- ============================================================
-- YANSIX CASHBACK — FASE 6
-- Dashboard Master + Gestão Global + Configurações por Unidade
-- ============================================================

-- Identidade e canais do estabelecimento.
alter table public.estabelecimentos add column if not exists logo_url text;
alter table public.estabelecimentos add column if not exists website_url text;
alter table public.estabelecimentos add column if not exists instagram_url text;
alter table public.estabelecimentos add column if not exists whatsapp text;
alter table public.estabelecimentos add column if not exists descricao text;

-- Permissões granulares para administradores de unidade.
alter table public.perfis add column if not exists permissoes jsonb not null default
  '{"dashboard":true,"clientes":true,"atendimentos":true,"servicos":true,"premios":true,"marketing":true,"configuracoes":true,"equipe":true,"auditoria":true}'::jsonb;

create or replace function public.tem_permissao(p_permissao text, p_estabelecimento_id uuid default null)
returns boolean language sql stable security definer set search_path=public as $$
  select case
    when public.is_admin_master() then true
    when public.minha_role()='admin_estabelecimento'
      and (p_estabelecimento_id is null or p_estabelecimento_id=public.meu_estabelecimento_id())
      then coalesce((select (permissoes ->> p_permissao)::boolean from public.perfis where id=auth.uid()), false)
    else false
  end
$$;
revoke all on function public.tem_permissao(text,uuid) from public;
grant execute on function public.tem_permissao(text,uuid) to authenticated;

-- Administrador de unidade pode consultar sua equipe; somente Master altera perfis/permissões.
drop policy if exists "usuario ve seu proprio perfil" on public.perfis;
drop policy if exists "admin gerencia perfis" on public.perfis;
drop policy if exists "admin atualiza perfis" on public.perfis;
create policy perfis_select_hierarquia on public.perfis for select to authenticated
using (id=auth.uid() or public.is_admin_master() or (public.minha_role()='admin_estabelecimento' and estabelecimento_id=public.meu_estabelecimento_id()));
create policy perfis_insert_master on public.perfis for insert to authenticated
with check (public.is_admin_master());
create policy perfis_update_master on public.perfis for update to authenticated
using (public.is_admin_master()) with check (public.is_admin_master());

-- Configurações: Master ou administrador da própria unidade com permissão de configuração.
drop policy if exists "owner acessa configuracoes" on public.configuracoes;
drop policy if exists "acesso por papel - configuracoes" on public.configuracoes;
create policy configuracoes_select_fase6 on public.configuracoes for select to authenticated
using (public.is_admin_master() or estabelecimento_id=public.meu_estabelecimento_id());
create policy configuracoes_update_fase6 on public.configuracoes for update to authenticated
using (public.is_admin_master() or (estabelecimento_id=public.meu_estabelecimento_id() and public.tem_permissao('configuracoes',estabelecimento_id)))
with check (public.is_admin_master() or (estabelecimento_id=public.meu_estabelecimento_id() and public.tem_permissao('configuracoes',estabelecimento_id)));

-- Dados da unidade: Master ou administrador com permissão de configuração.
drop policy if exists "owner acessa seu estabelecimento" on public.estabelecimentos;
drop policy if exists master_estabelecimentos_select on public.estabelecimentos;
create policy estabelecimentos_select_fase6 on public.estabelecimentos for select to authenticated
using (public.is_admin_master() or id=public.meu_estabelecimento_id());
drop policy if exists master_estabelecimentos_update on public.estabelecimentos;
drop policy if exists estabelecimentos_update_hierarquia on public.estabelecimentos;
create policy estabelecimentos_update_fase6 on public.estabelecimentos for update to authenticated
using (public.is_admin_master() or (id=public.meu_estabelecimento_id() and public.tem_permissao('configuracoes',id)))
with check (public.is_admin_master() or (id=public.meu_estabelecimento_id() and public.tem_permissao('configuracoes',id)));

-- Auditoria específica de alterações administrativas de unidade/configuração.
create or replace function public.registrar_auditoria_configuracao()
returns trigger language plpgsql security definer set search_path=public as $$
declare eid uuid; ent uuid;
begin
  eid := case when tg_op='DELETE' then old.estabelecimento_id else new.estabelecimento_id end;
  ent := case when tg_op='DELETE' then old.estabelecimento_id else new.estabelecimento_id end;
  insert into public.auditoria_admin(estabelecimento_id,ator_id,evento,entidade,entidade_id,detalhes)
  values(eid,auth.uid(),lower(tg_op),tg_table_name,ent,jsonb_build_object('fase','6','operacao',lower(tg_op)));
  return coalesce(new,old);
end $$;

drop trigger if exists trg_auditoria_estabelecimentos_fase6 on public.estabelecimentos;
create trigger trg_auditoria_estabelecimentos_fase6 after insert or update or delete on public.estabelecimentos
for each row execute function public.registrar_auditoria_configuracao();

drop trigger if exists trg_auditoria_configuracoes_fase6 on public.configuracoes;
create trigger trg_auditoria_configuracoes_fase6 after insert or update or delete on public.configuracoes
for each row execute function public.registrar_auditoria_configuracao();

-- Índices para o painel Master e atividade recente.
create index if not exists idx_estabelecimentos_status_created on public.estabelecimentos(status,created_at desc);
create index if not exists idx_perfis_estab_role on public.perfis(estabelecimento_id,role);
create index if not exists idx_auditoria_estab_created_fase6 on public.auditoria_admin(estabelecimento_id,created_at desc);

-- ============================================================
-- RLS por permissão (sem confiar apenas na interface)
-- ============================================================

-- Helper para políticas administrativas por módulo.
-- Master sempre passa; administrador de unidade depende do JSON de permissões.

-- Clientes
DROP POLICY IF EXISTS "hierarquia clientes compartilhados" ON public.clientes;
DROP POLICY IF EXISTS "hierarquia clientes insert" ON public.clientes;
DROP POLICY IF EXISTS "hierarquia clientes update" ON public.clientes;
DROP POLICY IF EXISTS "hierarquia clientes delete" ON public.clientes;
DROP POLICY IF EXISTS "owner acessa clientes" ON public.clientes;
CREATE POLICY fase6_clientes_select ON public.clientes FOR SELECT TO authenticated USING (
  public.is_admin_master() OR
  (public.minha_role()='admin_estabelecimento' AND estabelecimento_id=public.meu_estabelecimento_id() AND public.tem_permissao('clientes',estabelecimento_id)) OR
  (public.minha_role()='profissional' AND estabelecimento_id=public.meu_estabelecimento_id() AND EXISTS(SELECT 1 FROM public.cliente_profissionais cp WHERE cp.cliente_id=clientes.id AND cp.profissional_id=auth.uid()))
);
CREATE POLICY fase6_clientes_insert ON public.clientes FOR INSERT TO authenticated WITH CHECK (
  public.is_admin_master() OR
  (public.minha_role()='admin_estabelecimento' AND estabelecimento_id=public.meu_estabelecimento_id() AND public.tem_permissao('clientes',estabelecimento_id)) OR
  (public.minha_role()='profissional' AND estabelecimento_id=public.meu_estabelecimento_id())
);
CREATE POLICY fase6_clientes_update ON public.clientes FOR UPDATE TO authenticated USING (
  public.is_admin_master() OR
  (public.minha_role()='admin_estabelecimento' AND estabelecimento_id=public.meu_estabelecimento_id() AND public.tem_permissao('clientes',estabelecimento_id)) OR
  (public.minha_role()='profissional' AND estabelecimento_id=public.meu_estabelecimento_id() AND EXISTS(SELECT 1 FROM public.cliente_profissionais cp WHERE cp.cliente_id=clientes.id AND cp.profissional_id=auth.uid()))
) WITH CHECK (
  public.is_admin_master() OR
  (public.minha_role()='admin_estabelecimento' AND estabelecimento_id=public.meu_estabelecimento_id() AND public.tem_permissao('clientes',estabelecimento_id)) OR
  (public.minha_role()='profissional' AND estabelecimento_id=public.meu_estabelecimento_id())
);
CREATE POLICY fase6_clientes_delete ON public.clientes FOR DELETE TO authenticated USING (
  public.is_admin_master() OR
  (public.minha_role()='admin_estabelecimento' AND estabelecimento_id=public.meu_estabelecimento_id() AND public.tem_permissao('clientes',estabelecimento_id)) OR
  (public.minha_role()='profissional' AND estabelecimento_id=public.meu_estabelecimento_id() AND EXISTS(SELECT 1 FROM public.cliente_profissionais cp WHERE cp.cliente_id=clientes.id AND cp.profissional_id=auth.uid()))
);

-- Operações: serviço, prêmio, produto, pontuação, resgate e cashback.
DROP POLICY IF EXISTS "owner acessa servicos" ON public.servicos;
CREATE POLICY fase6_servicos ON public.servicos FOR ALL TO authenticated USING (
  public.is_admin_master() OR
  (estabelecimento_id=public.meu_estabelecimento_id() AND ((public.minha_role()='admin_estabelecimento' AND public.tem_permissao('servicos',estabelecimento_id)) OR public.minha_role()='profissional'))
) WITH CHECK (
  public.is_admin_master() OR
  (estabelecimento_id=public.meu_estabelecimento_id() AND ((public.minha_role()='admin_estabelecimento' AND public.tem_permissao('servicos',estabelecimento_id)) OR public.minha_role()='profissional'))
);
DROP POLICY IF EXISTS "owner acessa premios" ON public.premios;
DROP POLICY IF EXISTS "acesso por papel - premios" ON public.premios;
CREATE POLICY fase6_premios ON public.premios FOR ALL TO authenticated USING (
  public.is_admin_master() OR
  (estabelecimento_id=public.meu_estabelecimento_id() AND ((public.minha_role()='admin_estabelecimento' AND public.tem_permissao('premios',estabelecimento_id)) OR public.minha_role()='profissional'))
) WITH CHECK (
  public.is_admin_master() OR
  (estabelecimento_id=public.meu_estabelecimento_id() AND ((public.minha_role()='admin_estabelecimento' AND public.tem_permissao('premios',estabelecimento_id)) OR public.minha_role()='profissional'))
);
DROP POLICY IF EXISTS "owner acessa produtos" ON public.produtos;
CREATE POLICY fase6_produtos ON public.produtos FOR ALL TO authenticated USING (
  public.is_admin_master() OR (estabelecimento_id=public.meu_estabelecimento_id() AND ((public.minha_role()='admin_estabelecimento' AND public.tem_permissao('servicos',estabelecimento_id)) OR public.minha_role()='profissional'))
) WITH CHECK (
  public.is_admin_master() OR (estabelecimento_id=public.meu_estabelecimento_id() AND ((public.minha_role()='admin_estabelecimento' AND public.tem_permissao('servicos',estabelecimento_id)) OR public.minha_role()='profissional'))
);
DROP POLICY IF EXISTS "owner acessa pontuacoes" ON public.pontuacoes;
CREATE POLICY fase6_pontuacoes ON public.pontuacoes FOR ALL TO authenticated USING (
  public.is_admin_master() OR
  (public.minha_role()='admin_estabelecimento' AND estabelecimento_id=public.meu_estabelecimento_id() AND public.tem_permissao('atendimentos',estabelecimento_id)) OR
  (public.minha_role()='profissional' AND estabelecimento_id=public.meu_estabelecimento_id() AND profissional_id=auth.uid())
) WITH CHECK (
  public.is_admin_master() OR
  (public.minha_role()='admin_estabelecimento' AND estabelecimento_id=public.meu_estabelecimento_id() AND public.tem_permissao('atendimentos',estabelecimento_id)) OR
  (public.minha_role()='profissional' AND estabelecimento_id=public.meu_estabelecimento_id() AND profissional_id=auth.uid())
);
DROP POLICY IF EXISTS "owner acessa resgates" ON public.resgates;
CREATE POLICY fase6_resgates ON public.resgates FOR ALL TO authenticated USING (
  public.is_admin_master() OR
  (public.minha_role()='admin_estabelecimento' AND estabelecimento_id=public.meu_estabelecimento_id() AND public.tem_permissao('premios',estabelecimento_id)) OR
  (public.minha_role()='profissional' AND estabelecimento_id=public.meu_estabelecimento_id())
) WITH CHECK (
  public.is_admin_master() OR
  (public.minha_role()='admin_estabelecimento' AND estabelecimento_id=public.meu_estabelecimento_id() AND public.tem_permissao('premios',estabelecimento_id)) OR
  (public.minha_role()='profissional' AND estabelecimento_id=public.meu_estabelecimento_id())
);
DROP POLICY IF EXISTS "owner acessa cashback" ON public.cashback_lancamentos;
CREATE POLICY fase6_cashback ON public.cashback_lancamentos FOR ALL TO authenticated USING (
  public.is_admin_master() OR
  (public.minha_role()='admin_estabelecimento' AND estabelecimento_id=public.meu_estabelecimento_id() AND public.tem_permissao('atendimentos',estabelecimento_id)) OR
  (public.minha_role()='profissional' AND estabelecimento_id=public.meu_estabelecimento_id() AND profissional_id=auth.uid())
) WITH CHECK (
  public.is_admin_master() OR
  (public.minha_role()='admin_estabelecimento' AND estabelecimento_id=public.meu_estabelecimento_id() AND public.tem_permissao('atendimentos',estabelecimento_id)) OR
  (public.minha_role()='profissional' AND estabelecimento_id=public.meu_estabelecimento_id() AND profissional_id=auth.uid())
);

-- Níveis e marketing são administrativos; profissionais podem consultar a própria unidade para operar.
DROP POLICY IF EXISTS "acesso por papel - niveis" ON public.niveis;
CREATE POLICY fase6_niveis ON public.niveis FOR ALL TO authenticated USING (
  public.is_admin_master() OR
  (estabelecimento_id=public.meu_estabelecimento_id() AND ((public.minha_role()='admin_estabelecimento' AND public.tem_permissao('configuracoes',estabelecimento_id)) OR public.minha_role()='profissional'))
) WITH CHECK (
  public.is_admin_master() OR
  (estabelecimento_id=public.meu_estabelecimento_id() AND ((public.minha_role()='admin_estabelecimento' AND public.tem_permissao('configuracoes',estabelecimento_id)) OR public.minha_role()='profissional'))
);
DROP POLICY IF EXISTS "acesso por papel - marketing" ON public.marketing_mensagens;
CREATE POLICY fase6_marketing ON public.marketing_mensagens FOR ALL TO authenticated USING (
  public.is_admin_master() OR (estabelecimento_id=public.meu_estabelecimento_id() AND public.minha_role()='admin_estabelecimento' AND public.tem_permissao('marketing',estabelecimento_id))
) WITH CHECK (
  public.is_admin_master() OR (estabelecimento_id=public.meu_estabelecimento_id() AND public.minha_role()='admin_estabelecimento' AND public.tem_permissao('marketing',estabelecimento_id))
);

-- Avaliações: leitura/gestão da unidade; cliente público usa RPC security definer.
DROP POLICY IF EXISTS "owner acessa avaliacoes" ON public.avaliacoes;
CREATE POLICY fase6_avaliacoes ON public.avaliacoes FOR ALL TO authenticated USING (
  public.is_admin_master() OR (estabelecimento_id=public.meu_estabelecimento_id() AND (public.minha_role()='profissional' OR (public.minha_role()='admin_estabelecimento' AND public.tem_permissao('dashboard',estabelecimento_id))))
) WITH CHECK (
  public.is_admin_master() OR (estabelecimento_id=public.meu_estabelecimento_id() AND (public.minha_role()='profissional' OR (public.minha_role()='admin_estabelecimento' AND public.tem_permissao('dashboard',estabelecimento_id))))
);

-- Vínculos e atendimentos já possuem hierarquia; agora respeitam permissões do administrador.
DROP POLICY IF EXISTS cliente_profissionais_hierarquia ON public.cliente_profissionais;
CREATE POLICY fase6_cliente_profissionais ON public.cliente_profissionais FOR ALL TO authenticated USING (
  public.is_admin_master() OR
  (public.minha_role()='admin_estabelecimento' AND estabelecimento_id=public.meu_estabelecimento_id() AND public.tem_permissao('equipe',estabelecimento_id)) OR
  (public.minha_role()='profissional' AND profissional_id=auth.uid())
) WITH CHECK (
  public.is_admin_master() OR
  (public.minha_role()='admin_estabelecimento' AND estabelecimento_id=public.meu_estabelecimento_id() AND public.tem_permissao('equipe',estabelecimento_id)) OR
  (public.minha_role()='profissional' AND profissional_id=auth.uid())
);
DROP POLICY IF EXISTS atendimentos_hierarquia ON public.atendimentos;
CREATE POLICY fase6_atendimentos ON public.atendimentos FOR ALL TO authenticated USING (
  public.is_admin_master() OR
  (public.minha_role()='admin_estabelecimento' AND estabelecimento_id=public.meu_estabelecimento_id() AND public.tem_permissao('atendimentos',estabelecimento_id)) OR
  (public.minha_role()='profissional' AND profissional_id=auth.uid())
) WITH CHECK (
  public.is_admin_master() OR
  (public.minha_role()='admin_estabelecimento' AND estabelecimento_id=public.meu_estabelecimento_id() AND public.tem_permissao('atendimentos',estabelecimento_id)) OR
  (public.minha_role()='profissional' AND profissional_id=auth.uid())
);

-- Auditoria: Master global; administrador somente na própria unidade com permissão de auditoria.
DROP POLICY IF EXISTS auditoria_master_select ON public.auditoria_admin;
CREATE POLICY fase6_auditoria_select ON public.auditoria_admin FOR SELECT TO authenticated USING (
  public.is_admin_master() OR (estabelecimento_id=public.meu_estabelecimento_id() AND (public.minha_role()='admin_estabelecimento' AND public.tem_permissao('auditoria',estabelecimento_id)))
);

-- Auditoria de alterações de permissões (executada pelo banco).
create or replace function public.registrar_auditoria_perfil()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='UPDATE' and coalesce(old.permissoes,'{}'::jsonb) is distinct from coalesce(new.permissoes,'{}'::jsonb) then
    insert into public.auditoria_admin(estabelecimento_id,ator_id,evento,entidade,entidade_id,detalhes)
    values(new.estabelecimento_id,auth.uid(),'update','permissoes_admin',new.id,jsonb_build_object('fase','6','permissoes',new.permissoes));
  end if;
  return new;
end $$;
drop trigger if exists trg_auditoria_permissoes_fase6 on public.perfis;
create trigger trg_auditoria_permissoes_fase6 after update of permissoes on public.perfis
for each row execute function public.registrar_auditoria_perfil();
