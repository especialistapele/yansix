-- YANSIX CASHBACK — Fase 5
-- Limites por unidade, consumo lógico, relacionamento cliente-profissional
-- e atendimento como origem obrigatória de pontos/cashback.

alter table public.estabelecimentos
  add column if not exists max_clientes integer not null default 500,
  add column if not exists max_profissionais integer not null default 8,
  add column if not exists quota_dados_bytes bigint not null default 41943040;

update public.estabelecimentos
set max_clientes=500, max_profissionais=8, quota_dados_bytes=41943040
where max_clientes is null or max_profissionais is null or quota_dados_bytes is null;

create table if not exists public.cliente_profissionais (
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  profissional_id uuid not null references auth.users(id) on delete cascade,
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cliente_id, profissional_id)
);
create index if not exists idx_cliente_profissionais_prof on public.cliente_profissionais(profissional_id, estabelecimento_id);
create index if not exists idx_cliente_profissionais_estab on public.cliente_profissionais(estabelecimento_id, cliente_id);

create table if not exists public.atendimentos (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  profissional_id uuid not null references auth.users(id) on delete restrict,
  servico_id uuid not null references public.servicos(id) on delete restrict,
  valor numeric(10,2) not null check (valor >= 0),
  observacao text,
  status text not null default 'concluido' check (status in ('concluido','cancelado')),
  created_at timestamptz not null default now()
);
create index if not exists idx_atendimentos_estab_created on public.atendimentos(estabelecimento_id,created_at desc);
create index if not exists idx_atendimentos_prof_created on public.atendimentos(profissional_id,created_at desc);
create index if not exists idx_atendimentos_cliente_created on public.atendimentos(cliente_id,created_at desc);

alter table public.pontuacoes add column if not exists atendimento_id uuid references public.atendimentos(id) on delete restrict;
create index if not exists idx_pontuacoes_atendimento on public.pontuacoes(atendimento_id);
alter table public.cashback_lancamentos add column if not exists atendimento_id uuid references public.atendimentos(id) on delete restrict;
create index if not exists idx_cashback_atendimento on public.cashback_lancamentos(atendimento_id);

-- Compatibilidade: converte pontuações antigas em atendimentos quando houver profissional.
do $$
declare r record; aid uuid;
begin
  for r in select p.* from public.pontuacoes p where p.atendimento_id is null loop
    insert into public.atendimentos(estabelecimento_id,cliente_id,profissional_id,servico_id,valor,created_at)
    select r.estabelecimento_id,r.cliente_id,r.profissional_id,r.servico_id,r.valor,r.created_at
    where r.profissional_id is not null
    returning id into aid;
    if aid is not null then
      update public.pontuacoes set atendimento_id=aid where id=r.id;
    end if;
  end loop;
end $$;

-- Relacionamentos existentes: preserva o vínculo legado profissional_id quando disponível.
insert into public.cliente_profissionais(cliente_id,profissional_id,estabelecimento_id)
select c.id,c.profissional_id,c.estabelecimento_id
from public.clientes c
where c.profissional_id is not null
on conflict (cliente_id,profissional_id) do nothing;

create or replace function public.consumo_dados_estabelecimento(p_estabelecimento_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_bytes bigint := 0; v_quota bigint; v_clientes integer; v_profissionais integer; v_pct numeric; v_status text;
begin
  select quota_dados_bytes into v_quota from public.estabelecimentos where id=p_estabelecimento_id;
  if v_quota is null then v_quota := 41943040; end if;
  select count(*) into v_clientes from public.clientes where estabelecimento_id=p_estabelecimento_id;
  select count(*) into v_profissionais from public.perfis where estabelecimento_id=p_estabelecimento_id and role='profissional';

  select coalesce(sum(x.bytes),0) into v_bytes from (
    select coalesce(sum(pg_column_size(t)),0)::bigint bytes from public.clientes t where t.estabelecimento_id=p_estabelecimento_id
    union all select coalesce(sum(pg_column_size(t)),0)::bigint from public.servicos t where t.estabelecimento_id=p_estabelecimento_id
    union all select coalesce(sum(pg_column_size(t)),0)::bigint from public.produtos t where t.estabelecimento_id=p_estabelecimento_id
    union all select coalesce(sum(pg_column_size(t)),0)::bigint from public.pontuacoes t where t.estabelecimento_id=p_estabelecimento_id
    union all select coalesce(sum(pg_column_size(t)),0)::bigint from public.premios t where t.estabelecimento_id=p_estabelecimento_id
    union all select coalesce(sum(pg_column_size(t)),0)::bigint from public.resgates t where t.estabelecimento_id=p_estabelecimento_id
    union all select coalesce(sum(pg_column_size(t)),0)::bigint from public.cupons_indicacao t where t.estabelecimento_id=p_estabelecimento_id
    union all select coalesce(sum(pg_column_size(t)),0)::bigint from public.avaliacoes t where t.estabelecimento_id=p_estabelecimento_id
    union all select coalesce(sum(pg_column_size(t)),0)::bigint from public.cashback_lancamentos t where t.estabelecimento_id=p_estabelecimento_id
    union all select coalesce(sum(pg_column_size(t)),0)::bigint from public.marketing_mensagens t where t.estabelecimento_id=p_estabelecimento_id
    union all select coalesce(sum(pg_column_size(t)),0)::bigint from public.niveis t where t.estabelecimento_id=p_estabelecimento_id
    union all select coalesce(sum(pg_column_size(t)),0)::bigint from public.auditoria_admin t where t.estabelecimento_id=p_estabelecimento_id
    union all select coalesce(sum(pg_column_size(t)),0)::bigint from public.configuracoes t where t.estabelecimento_id=p_estabelecimento_id
    union all select coalesce(sum(pg_column_size(t)),0)::bigint from public.atendimentos t where t.estabelecimento_id=p_estabelecimento_id
    union all select coalesce(sum(pg_column_size(t)),0)::bigint from public.cliente_profissionais t where t.estabelecimento_id=p_estabelecimento_id
    union all select coalesce(sum(pg_column_size(t)),0)::bigint from public.perfis t where t.estabelecimento_id=p_estabelecimento_id and t.role in ('admin_estabelecimento','profissional')
  ) x;

  v_pct := round((v_bytes::numeric / greatest(v_quota,1)::numeric)*100,2);
  v_status := case when v_bytes >= v_quota then 'bloqueado' when v_bytes >= 36700160 then 'critico' when v_bytes >= 31457280 then 'atencao' else 'normal' end;
  return jsonb_build_object('bytes',v_bytes,'quota_bytes',v_quota,'percentual',v_pct,'mb',round(v_bytes/1048576.0,2),'quota_mb',round(v_quota/1048576.0,2),'clientes',v_clientes,'max_clientes',500,'profissionais',v_profissionais,'max_profissionais',8,'status',v_status,'alerta_30mb',v_bytes>=31457280);
end $$;
grant execute on function public.consumo_dados_estabelecimento(uuid) to authenticated;

create or replace function public.verificar_limite_cadastro(p_estabelecimento_id uuid, p_tipo text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare c integer; p integer; maxc integer; maxp integer; consumo jsonb;
begin
  select max_clientes,max_profissionais into maxc,maxp from public.estabelecimentos where id=p_estabelecimento_id;
  select count(*) into c from public.clientes where estabelecimento_id=p_estabelecimento_id;
  select count(*) into p from public.perfis where estabelecimento_id=p_estabelecimento_id and role='profissional';
  consumo := public.consumo_dados_estabelecimento(p_estabelecimento_id);
  if p_tipo='cliente' and c >= maxc then return jsonb_build_object('ok',false,'codigo','limite_clientes','mensagem',format('Limite de %s clientes atingido.',maxc),'consumo',consumo); end if;
  if p_tipo='profissional' and p >= maxp then return jsonb_build_object('ok',false,'codigo','limite_profissionais','mensagem',format('Limite de %s profissionais atingido.',maxp),'consumo',consumo); end if;
  if (consumo->>'bytes')::bigint >= (consumo->>'quota_bytes')::bigint then return jsonb_build_object('ok',false,'codigo','cota_dados','mensagem','Limite de armazenamento da unidade atingido. Novos cadastros estão bloqueados.','consumo',consumo); end if;
  return jsonb_build_object('ok',true,'consumo',consumo);
end $$;
grant execute on function public.verificar_limite_cadastro(uuid,text) to authenticated;

create or replace function public.validar_limites_cliente()
returns trigger language plpgsql security definer set search_path=public as $$
declare c integer; q bigint; used bigint; maxc integer;
begin
  select max_clientes,quota_dados_bytes into maxc,q from public.estabelecimentos where id=new.estabelecimento_id;
  select count(*) into c from public.clientes where estabelecimento_id=new.estabelecimento_id;
  if c >= coalesce(maxc,500) then raise exception 'LIMITE_CLIENTES: o estabelecimento atingiu o limite de % clientes.',coalesce(maxc,500); end if;
  used := coalesce((public.consumo_dados_estabelecimento(new.estabelecimento_id)->>'bytes')::bigint,0);
  if used >= coalesce(q,41943040) then raise exception 'COTA_DADOS: o estabelecimento atingiu o limite de 40 MB.'; end if;
  return new;
end $$;
drop trigger if exists trg_limite_clientes on public.clientes;
create trigger trg_limite_clientes before insert on public.clientes for each row execute function public.validar_limites_cliente();

create or replace function public.validar_limites_profissional()
returns trigger language plpgsql security definer set search_path=public as $$
declare c integer; q bigint; used bigint; maxp integer;
begin
  if new.role <> 'profissional' then return new; end if;
  select max_profissionais,quota_dados_bytes into maxp,q from public.estabelecimentos where id=new.estabelecimento_id;
  select count(*) into c from public.perfis where estabelecimento_id=new.estabelecimento_id and role='profissional';
  if c >= coalesce(maxp,8) then raise exception 'LIMITE_PROFISSIONAIS: o estabelecimento atingiu o limite de % profissionais.',coalesce(maxp,8); end if;
  used := coalesce((public.consumo_dados_estabelecimento(new.estabelecimento_id)->>'bytes')::bigint,0);
  if used >= coalesce(q,41943040) then raise exception 'COTA_DADOS: o estabelecimento atingiu o limite de 40 MB.'; end if;
  return new;
end $$;
drop trigger if exists trg_limite_profissionais on public.perfis;
create trigger trg_limite_profissionais before insert on public.perfis for each row execute function public.validar_limites_profissional();

-- Máximo inicial de 10 unidades na plataforma.
create or replace function public.validar_limite_estabelecimentos()
returns trigger language plpgsql security definer set search_path=public as $$
declare n integer;
begin
  select count(*) into n from public.estabelecimentos;
  if n >= 10 then raise exception 'LIMITE_ESTABELECIMENTOS: a plataforma permite no máximo 10 estabelecimentos.'; end if;
  return new;
end $$;
drop trigger if exists trg_limite_estabelecimentos on public.estabelecimentos;
create trigger trg_limite_estabelecimentos before insert on public.estabelecimentos for each row execute function public.validar_limite_estabelecimentos();

-- Cria automaticamente o vínculo entre profissional e cliente quando o cliente é cadastrado pelo profissional.
create or replace function public.vincular_cliente_profissional_automatico()
returns trigger language plpgsql security definer set search_path=public as $$
declare pid uuid;
begin
  if public.minha_role()='profissional' then
    pid := auth.uid();
    insert into public.cliente_profissionais(cliente_id,profissional_id,estabelecimento_id)
    values(new.id,pid,new.estabelecimento_id)
    on conflict do nothing;
  elsif new.profissional_id is not null then
    insert into public.cliente_profissionais(cliente_id,profissional_id,estabelecimento_id)
    values(new.id,new.profissional_id,new.estabelecimento_id)
    on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists trg_vincular_cliente_profissional on public.clientes;
create trigger trg_vincular_cliente_profissional after insert on public.clientes for each row execute function public.vincular_cliente_profissional_automatico();

-- RLS dos vínculos e atendimentos.
alter table public.cliente_profissionais enable row level security;
drop policy if exists cliente_profissionais_hierarquia on public.cliente_profissionais;
create policy cliente_profissionais_hierarquia on public.cliente_profissionais for all to authenticated
using (public.is_admin_master() or (public.minha_role()='admin_estabelecimento' and estabelecimento_id=public.meu_estabelecimento_id()) or (public.minha_role()='profissional' and profissional_id=auth.uid()))
with check (public.is_admin_master() or (public.minha_role()='admin_estabelecimento' and estabelecimento_id=public.meu_estabelecimento_id()) or (public.minha_role()='profissional' and profissional_id=auth.uid()));

alter table public.atendimentos enable row level security;
drop policy if exists atendimentos_hierarquia on public.atendimentos;
create policy atendimentos_hierarquia on public.atendimentos for all to authenticated
using (public.minha_role()='admin_master' or (public.minha_role()='admin_estabelecimento' and estabelecimento_id=public.meu_estabelecimento_id()) or (public.minha_role()='profissional' and profissional_id=auth.uid()))
with check (public.minha_role()='admin_master' or (public.minha_role()='admin_estabelecimento' and estabelecimento_id=public.meu_estabelecimento_id()) or (public.minha_role()='profissional' and profissional_id=auth.uid()));

-- Clientes passam a ser compartilhados por unidade; o profissional só enxerga clientes vinculados a ele.
drop policy if exists "hierarquia clientes" on public.clientes;
create policy "hierarquia clientes compartilhados" on public.clientes for select to authenticated
using (public.is_admin_master() or (public.minha_role()='admin_estabelecimento' and estabelecimento_id=public.meu_estabelecimento_id()) or (public.minha_role()='profissional' and estabelecimento_id=public.meu_estabelecimento_id() and exists(select 1 from public.cliente_profissionais cp where cp.cliente_id=clientes.id and cp.profissional_id=auth.uid())));
drop policy if exists "hierarquia clientes insert" on public.clientes;
create policy "hierarquia clientes insert" on public.clientes for insert to authenticated
with check (public.is_admin_master() or (public.minha_role()='admin_estabelecimento' and estabelecimento_id=public.meu_estabelecimento_id()) or (public.minha_role()='profissional' and estabelecimento_id=public.meu_estabelecimento_id()));
drop policy if exists "hierarquia clientes update" on public.clientes;
create policy "hierarquia clientes update" on public.clientes for update to authenticated
using (public.is_admin_master() or (public.minha_role()='admin_estabelecimento' and estabelecimento_id=public.meu_estabelecimento_id()) or (public.minha_role()='profissional' and estabelecimento_id=public.meu_estabelecimento_id() and exists(select 1 from public.cliente_profissionais cp where cp.cliente_id=clientes.id and cp.profissional_id=auth.uid())))
with check (public.is_admin_master() or (public.minha_role()='admin_estabelecimento' and estabelecimento_id=public.meu_estabelecimento_id()) or (public.minha_role()='profissional' and estabelecimento_id=public.meu_estabelecimento_id()));
drop policy if exists "hierarquia clientes delete" on public.clientes;
create policy "hierarquia clientes delete" on public.clientes for delete to authenticated
using (public.is_admin_master() or (public.minha_role()='admin_estabelecimento' and estabelecimento_id=public.meu_estabelecimento_id()) or (public.minha_role()='profissional' and estabelecimento_id=public.meu_estabelecimento_id() and exists(select 1 from public.cliente_profissionais cp where cp.cliente_id=clientes.id and cp.profissional_id=auth.uid())));

-- RPC atômica: atendimento + pontos + cashback. Garante que o cashback tenha origem em um atendimento.
create or replace function public.registrar_atendimento_pontuacao(
  p_estabelecimento_id uuid,
  p_cliente_id uuid,
  p_servico_id uuid,
  p_profissional_id uuid default null,
  p_usar_cashback boolean default false,
  p_observacao text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare aid uuid; pid uuid; sid uuid; valor numeric; pontos integer; cb numeric; saldo numeric; exp date; pont_id uuid; uso numeric := 0;
  cfg record; cli_est uuid; srv_est uuid;
begin
  select estabelecimento_id into cli_est from public.clientes where id=p_cliente_id;
  select estabelecimento_id,valor into srv_est,valor from public.servicos where id=p_servico_id and ativo=true;
  if cli_est is null or cli_est<>p_estabelecimento_id then raise exception 'CLIENTE_UNIDADE_INVALIDA'; end if;
  if srv_est is null or srv_est<>p_estabelecimento_id then raise exception 'SERVICO_UNIDADE_INVALIDO'; end if;
  if public.minha_role()='profissional' then pid:=auth.uid();
  else pid:=p_profissional_id; end if;
  if pid is null then raise exception 'PROFISSIONAL_OBRIGATORIO'; end if;
  if not exists(select 1 from public.perfis where id=pid and role='profissional' and estabelecimento_id=p_estabelecimento_id) then raise exception 'PROFISSIONAL_UNIDADE_INVALIDO'; end if;
  if public.minha_role()='profissional' and not exists(select 1 from public.cliente_profissionais where cliente_id=p_cliente_id and profissional_id=auth.uid()) then
    insert into public.cliente_profissionais(cliente_id,profissional_id,estabelecimento_id) values(p_cliente_id,auth.uid(),p_estabelecimento_id) on conflict do nothing;
  end if;
  select * into cfg from public.configuracoes where estabelecimento_id=p_estabelecimento_id;
  pontos := floor(valor / greatest(coalesce(cfg.valor_por_ponto,1),0.01));
  if cfg.pontuacao_maxima_servico is not null then pontos:=least(pontos,cfg.pontuacao_maxima_servico); end if;
  insert into public.atendimentos(estabelecimento_id,cliente_id,profissional_id,servico_id,valor,observacao) values(p_estabelecimento_id,p_cliente_id,pid,p_servico_id,valor,p_observacao) returning id into aid;
  insert into public.pontuacoes(estabelecimento_id,cliente_id,servico_id,valor,pontos,expira_em,profissional_id,atendimento_id) values(p_estabelecimento_id,p_cliente_id,p_servico_id,valor,pontos,case when cfg.validade_pontos='sem_validade' or cfg.validade_pontos is null then null else (current_date + interval '8 months')::date end,pid,aid) returning id into pont_id;
  if coalesce(cfg.cashback_ativo,false) and coalesce((select cashback_pct from public.servicos where id=p_servico_id),0)>0 then
    cb := round(valor*((select cashback_pct from public.servicos where id=p_servico_id)/100),2);
    exp := current_date + coalesce(cfg.cashback_expiracao_dias,90);
    insert into public.cashback_lancamentos(estabelecimento_id,cliente_id,tipo,valor,pontuacao_id,expira_em,profissional_id,atendimento_id) values(p_estabelecimento_id,p_cliente_id,'credito',cb,pont_id,exp,pid,aid);
  end if;
  if p_usar_cashback then
    select coalesce(sum(case when tipo='credito' and (expira_em is null or expira_em>=current_date) then valor when tipo='uso' then -valor else 0 end),0) into saldo from public.cashback_lancamentos where cliente_id=p_cliente_id and estabelecimento_id=p_estabelecimento_id;
    uso:=greatest(saldo,0);
    if uso>0 then insert into public.cashback_lancamentos(estabelecimento_id,cliente_id,tipo,valor,pontuacao_id,profissional_id,atendimento_id) values(p_estabelecimento_id,p_cliente_id,'uso',uso,pont_id,pid,aid); end if;
  end if;
  return jsonb_build_object('atendimento_id',aid,'pontuacao_id',pont_id,'pontos',pontos,'cashback',coalesce(cb,0),'cashback_usado',uso,'profissional_id',pid);
end $$;
grant execute on function public.registrar_atendimento_pontuacao(uuid,uuid,uuid,uuid,boolean,text) to authenticated;

-- Bloqueia cashback sem origem operacional válida.
create or replace function public.validar_cashback_origem()
returns trigger language plpgsql security definer set search_path=public as $$
declare a_est uuid; a_cli uuid; a_prof uuid; p_at uuid;
begin
  if new.pontuacao_id is null or new.atendimento_id is null then raise exception 'CASHBACK_ORIGEM_OBRIGATORIA: cashback deve estar ligado a atendimento e pontuacao.'; end if;
  select atendimento_id,estabelecimento_id,cliente_id,profissional_id into p_at,a_est,a_cli,a_prof from public.pontuacoes where id=new.pontuacao_id;
  if p_at is null or p_at<>new.atendimento_id or a_est<>new.estabelecimento_id or a_cli<>new.cliente_id or (new.profissional_id is not null and a_prof<>new.profissional_id) then raise exception 'CASHBACK_ORIGEM_INVALIDA'; end if;
  return new;
end $$;
drop trigger if exists trg_validar_cashback_origem on public.cashback_lancamentos;
create trigger trg_validar_cashback_origem before insert or update on public.cashback_lancamentos for each row execute function public.validar_cashback_origem();

-- Garante que pontuação nova tenha atendimento.
create or replace function public.validar_pontuacao_origem()
returns trigger language plpgsql security definer set search_path=public as $$
declare a record;
begin
  if new.atendimento_id is null then raise exception 'ATENDIMENTO_OBRIGATORIO: pontuação deve nascer de um atendimento.'; end if;
  select * into a from public.atendimentos where id=new.atendimento_id;
  if a.id is null or a.estabelecimento_id<>new.estabelecimento_id or a.cliente_id<>new.cliente_id or a.profissional_id<>new.profissional_id or a.servico_id<>new.servico_id then raise exception 'ATENDIMENTO_ORIGEM_INVALIDA'; end if;
  return new;
end $$;
drop trigger if exists trg_validar_pontuacao_origem on public.pontuacoes;
create trigger trg_validar_pontuacao_origem before insert or update on public.pontuacoes for each row execute function public.validar_pontuacao_origem();

-- Auditoria passa a carregar profissional/cliente também para atendimentos.
drop trigger if exists trg_auditoria_atendimentos on public.atendimentos;
create trigger trg_auditoria_atendimentos after insert or update or delete on public.atendimentos for each row execute function public.registrar_auditoria();
