-- ============================================================
-- FASE 2 — funções públicas (SECURITY DEFINER) para a página do
-- cliente final acessar SOMENTE os próprios dados via link único
-- ============================================================

create or replace function public.cliente_publico_info(p_cliente_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente record;
  v_estab record;
  v_saldo int;
  v_premios json;
begin
  select * into v_cliente from clientes where id = p_cliente_id;
  if not found then return null; end if;

  select * into v_estab from estabelecimentos where id = v_cliente.estabelecimento_id;

  select coalesce(sum(pontos),0) into v_saldo from pontuacoes where cliente_id = p_cliente_id;
  select v_saldo - coalesce(sum(pontos_utilizados),0) into v_saldo from resgates where cliente_id = p_cliente_id;

  select json_agg(json_build_object(
    'id', pr.id, 'nome', pr.nome, 'pontos_necessarios', pr.pontos_necessarios,
    'progresso_pct', least(100, round((v_saldo::numeric / greatest(pr.pontos_necessarios,1)) * 100))
  ) order by pr.pontos_necessarios)
  into v_premios
  from premios pr where pr.estabelecimento_id = v_cliente.estabelecimento_id and pr.ativo = true;

  return json_build_object(
    'nome', v_cliente.nome,
    'saldo', v_saldo,
    'estabelecimento_nome', v_estab.nome,
    'cor_tema', v_estab.cor_tema,
    'premios', coalesce(v_premios, '[]'::json)
  );
end;
$$;
grant execute on function public.cliente_publico_info(uuid) to anon;

create or replace function public.cliente_publico_historico(p_cliente_id uuid)
returns json
language sql
security definer
set search_path = public
as $$
  select json_agg(item order by item->>'data' desc) from (
    select json_build_object('tipo','pontuacao','item', s.nome, 'pontos', p.pontos, 'data', p.created_at) as item
    from pontuacoes p left join servicos s on s.id = p.servico_id
    where p.cliente_id = p_cliente_id
    union all
    select json_build_object('tipo','resgate','item', pr.nome, 'pontos', -r.pontos_utilizados, 'data', r.created_at) as item
    from resgates r left join premios pr on pr.id = r.premio_id
    where r.cliente_id = p_cliente_id
  ) t;
$$;
grant execute on function public.cliente_publico_historico(uuid) to anon;

create or replace function public.cliente_publico_avaliar(p_cliente_id uuid, p_nota smallint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_estab_id uuid;
begin
  select estabelecimento_id into v_estab_id from clientes where id = p_cliente_id;
  if v_estab_id is null then return false; end if;
  if p_nota < 1 or p_nota > 5 then return false; end if;
  insert into avaliacoes (estabelecimento_id, cliente_id, nota) values (v_estab_id, p_cliente_id, p_nota);
  return true;
end;
$$;
grant execute on function public.cliente_publico_avaliar(uuid, smallint) to anon;

create or replace function public.cliente_publico_cupom(p_cliente_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estab_id uuid;
  v_codigo text;
  v_cfg record;
begin
  select estabelecimento_id into v_estab_id from clientes where id = p_cliente_id;
  if v_estab_id is null then return null; end if;

  select codigo into v_codigo from cupons_indicacao where cliente_indicador_id = p_cliente_id limit 1;
  if v_codigo is null then
    v_codigo := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    insert into cupons_indicacao (estabelecimento_id, cliente_indicador_id, codigo)
    values (v_estab_id, p_cliente_id, v_codigo);
  end if;

  select * into v_cfg from configuracoes where estabelecimento_id = v_estab_id;

  return json_build_object(
    'codigo', v_codigo,
    'desconto_pct', coalesce(v_cfg.indicacao_desconto_pct,0),
    'pontos', coalesce(v_cfg.indicacao_pontos,0),
    'observacao', v_cfg.indicacao_observacao
  );
end;
$$;
grant execute on function public.cliente_publico_cupom(uuid) to anon;
