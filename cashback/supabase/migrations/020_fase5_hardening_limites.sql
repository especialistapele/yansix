-- Hardening da Fase 5: não permite atingir/exceder a cota por cadastro
-- e restringe RPCs de consumo/operação ao escopo do usuário.

create or replace function public.consumo_dados_estabelecimento(p_estabelecimento_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_bytes bigint:=0; v_quota bigint; v_clientes integer; v_profissionais integer; v_pct numeric; v_status text;
begin
  if auth.uid() is not null and not public.is_admin_master() and p_estabelecimento_id<>public.meu_estabelecimento_id() then
    raise exception 'ACESSO_UNIDADE_NEGADO';
  end if;
  select quota_dados_bytes into v_quota from public.estabelecimentos where id=p_estabelecimento_id;
  if v_quota is null then v_quota:=41943040; end if;
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
  v_pct:=round((v_bytes::numeric/greatest(v_quota,1)::numeric)*100,2);
  v_status:=case when v_bytes>=v_quota then 'bloqueado' when v_bytes>=36700160 then 'critico' when v_bytes>=31457280 then 'atencao' else 'normal' end;
  return jsonb_build_object('bytes',v_bytes,'quota_bytes',v_quota,'percentual',v_pct,'mb',round(v_bytes/1048576.0,2),'quota_mb',round(v_quota/1048576.0,2),'clientes',v_clientes,'max_clientes',500,'profissionais',v_profissionais,'max_profissionais',8,'status',v_status,'alerta_30mb',v_bytes>=31457280);
end $$;

create or replace function public.verificar_limite_cadastro(p_estabelecimento_id uuid,p_tipo text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c integer; p integer; maxc integer; maxp integer; consumo jsonb;
begin
  if auth.uid() is not null and not public.is_admin_master() and p_estabelecimento_id<>public.meu_estabelecimento_id() then raise exception 'ACESSO_UNIDADE_NEGADO'; end if;
  select max_clientes,max_profissionais into maxc,maxp from public.estabelecimentos where id=p_estabelecimento_id;
  select count(*) into c from public.clientes where estabelecimento_id=p_estabelecimento_id;
  select count(*) into p from public.perfis where estabelecimento_id=p_estabelecimento_id and role='profissional';
  consumo:=public.consumo_dados_estabelecimento(p_estabelecimento_id);
  if p_tipo='cliente' and c>=maxc then return jsonb_build_object('ok',false,'codigo','limite_clientes','mensagem',format('Limite de %s clientes atingido.',maxc),'consumo',consumo); end if;
  if p_tipo='profissional' and p>=maxp then return jsonb_build_object('ok',false,'codigo','limite_profissionais','mensagem',format('Limite de %s profissionais atingido.',maxp),'consumo',consumo); end if;
  if (consumo->>'bytes')::bigint >= (consumo->>'quota_bytes')::bigint then return jsonb_build_object('ok',false,'codigo','cota_dados','mensagem','Limite de armazenamento da unidade atingido. Novos cadastros estão bloqueados.','consumo',consumo); end if;
  return jsonb_build_object('ok',true,'consumo',consumo);
end $$;

create or replace function public.validar_limites_cliente()
returns trigger language plpgsql security definer set search_path=public as $$
declare c integer; q bigint; used bigint; maxc integer; projected bigint;
begin
  select max_clientes,quota_dados_bytes into maxc,q from public.estabelecimentos where id=new.estabelecimento_id;
  select count(*) into c from public.clientes where estabelecimento_id=new.estabelecimento_id;
  if c>=coalesce(maxc,500) then raise exception 'LIMITE_CLIENTES: o estabelecimento atingiu o limite de % clientes.',coalesce(maxc,500); end if;
  used:=coalesce((public.consumo_dados_estabelecimento(new.estabelecimento_id)->>'bytes')::bigint,0);
  projected:=used+coalesce(pg_column_size(new),0);
  if projected>=coalesce(q,41943040) then raise exception 'COTA_DADOS: este cadastro faria a unidade atingir o limite de 40 MB.'; end if;
  return new;
end $$;

create or replace function public.validar_limites_profissional()
returns trigger language plpgsql security definer set search_path=public as $$
declare c integer; q bigint; used bigint; maxp integer; projected bigint;
begin
  if new.role<>'profissional' then return new; end if;
  select max_profissionais,quota_dados_bytes into maxp,q from public.estabelecimentos where id=new.estabelecimento_id;
  select count(*) into c from public.perfis where estabelecimento_id=new.estabelecimento_id and role='profissional';
  if c>=coalesce(maxp,8) then raise exception 'LIMITE_PROFISSIONAIS: o estabelecimento atingiu o limite de % profissionais.',coalesce(maxp,8); end if;
  used:=coalesce((public.consumo_dados_estabelecimento(new.estabelecimento_id)->>'bytes')::bigint,0);
  projected:=used+coalesce(pg_column_size(new),0);
  if projected>=coalesce(q,41943040) then raise exception 'COTA_DADOS: este cadastro faria a unidade atingir o limite de 40 MB.'; end if;
  return new;
end $$;

create or replace function public.registrar_atendimento_pontuacao(p_estabelecimento_id uuid,p_cliente_id uuid,p_servico_id uuid,p_profissional_id uuid default null,p_usar_cashback boolean default false,p_observacao text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare aid uuid; pid uuid; valor numeric; pontos integer; cb numeric:=0; saldo numeric:=0; exp date; pont_id uuid; uso numeric:=0; cfg record; cli_est uuid; srv_est uuid; srv_cb numeric;
begin
  if public.minha_role()='admin_estabelecimento' and p_estabelecimento_id<>public.meu_estabelecimento_id() then raise exception 'ACESSO_UNIDADE_NEGADO'; end if;
  if public.minha_role()='profissional' and p_estabelecimento_id<>public.meu_estabelecimento_id() then raise exception 'ACESSO_UNIDADE_NEGADO'; end if;
  select estabelecimento_id into cli_est from public.clientes where id=p_cliente_id;
  select estabelecimento_id,valor,cashback_pct into srv_est,valor,srv_cb from public.servicos where id=p_servico_id and ativo=true;
  if cli_est is null or cli_est<>p_estabelecimento_id then raise exception 'CLIENTE_UNIDADE_INVALIDA'; end if;
  if srv_est is null or srv_est<>p_estabelecimento_id then raise exception 'SERVICO_UNIDADE_INVALIDO'; end if;
  if public.minha_role()='profissional' then pid:=auth.uid(); else pid:=p_profissional_id; end if;
  if pid is null then raise exception 'PROFISSIONAL_OBRIGATORIO'; end if;
  if not exists(select 1 from public.perfis where id=pid and role='profissional' and estabelecimento_id=p_estabelecimento_id) then raise exception 'PROFISSIONAL_UNIDADE_INVALIDO'; end if;
  if public.minha_role()='profissional' and not exists(select 1 from public.cliente_profissionais where cliente_id=p_cliente_id and profissional_id=auth.uid()) then insert into public.cliente_profissionais(cliente_id,profissional_id,estabelecimento_id) values(p_cliente_id,auth.uid(),p_estabelecimento_id) on conflict do nothing; end if;
  select * into cfg from public.configuracoes where estabelecimento_id=p_estabelecimento_id;
  pontos:=floor(valor/greatest(coalesce(cfg.valor_por_ponto,1),0.01)); if cfg.pontuacao_maxima_servico is not null then pontos:=least(pontos,cfg.pontuacao_maxima_servico); end if;
  insert into public.atendimentos(estabelecimento_id,cliente_id,profissional_id,servico_id,valor,observacao) values(p_estabelecimento_id,p_cliente_id,pid,p_servico_id,valor,p_observacao) returning id into aid;
  insert into public.pontuacoes(estabelecimento_id,cliente_id,servico_id,valor,pontos,expira_em,profissional_id,atendimento_id) values(p_estabelecimento_id,p_cliente_id,p_servico_id,valor,pontos,case when cfg.validade_pontos='sem_validade' or cfg.validade_pontos is null then null else (case cfg.validade_pontos when '8_meses' then current_date+interval '8 months' when '10_meses' then current_date+interval '10 months' when '1_ano' then current_date+interval '1 year' when '1_ano_meio' then current_date+interval '18 months' when '2_anos' then current_date+interval '2 years' else null end)::date end,pid,aid) returning id into pont_id;
  if coalesce(cfg.cashback_ativo,false) and coalesce(srv_cb,0)>0 then cb:=round(valor*(srv_cb/100),2); exp:=current_date+coalesce(cfg.cashback_expiracao_dias,90); insert into public.cashback_lancamentos(estabelecimento_id,cliente_id,tipo,valor,pontuacao_id,expira_em,profissional_id,atendimento_id) values(p_estabelecimento_id,p_cliente_id,'credito',cb,pont_id,exp,pid,aid); end if;
  if p_usar_cashback then select coalesce(sum(case when tipo='credito' and (expira_em is null or expira_em>=current_date) then valor when tipo='uso' then -valor else 0 end),0) into saldo from public.cashback_lancamentos where cliente_id=p_cliente_id and estabelecimento_id=p_estabelecimento_id; uso:=greatest(saldo,0); if uso>0 then insert into public.cashback_lancamentos(estabelecimento_id,cliente_id,tipo,valor,pontuacao_id,profissional_id,atendimento_id) values(p_estabelecimento_id,p_cliente_id,'uso',uso,pont_id,pid,aid); end if; end if;
  return jsonb_build_object('atendimento_id',aid,'pontuacao_id',pont_id,'pontos',pontos,'cashback',cb,'cashback_usado',uso,'profissional_id',pid);
end $$;
