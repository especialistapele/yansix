-- FASE 3 — módulos ativáveis (aniversário e avaliação; indicação já existe como marketing_boca_boca_ativo)
alter table public.configuracoes
  add column if not exists aniversario_ativo boolean not null default true,
  add column if not exists avaliacao_ativo boolean not null default true;

-- cliente_publico_info atualizada: respeita validade dos pontos (expira_em) e informa quais
-- módulos estão ativos, para a página do cliente esconder abas desativadas.
create or replace function public.cliente_publico_info(p_cliente_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente record;
  v_estab record;
  v_cfg record;
  v_saldo int;
  v_premios json;
begin
  select * into v_cliente from clientes where id = p_cliente_id;
  if not found then return null; end if;

  select * into v_estab from estabelecimentos where id = v_cliente.estabelecimento_id;
  select * into v_cfg from configuracoes where estabelecimento_id = v_cliente.estabelecimento_id;

  select coalesce(sum(pontos),0) into v_saldo from pontuacoes
    where cliente_id = p_cliente_id and (expira_em is null or expira_em >= current_date);
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
    'premios', coalesce(v_premios, '[]'::json),
    'avaliacao_ativo', coalesce(v_cfg.avaliacao_ativo, true),
    'indicacao_ativa', coalesce(v_cfg.marketing_boca_boca_ativo, false)
  );
end;
$$;
grant execute on function public.cliente_publico_info(uuid) to anon;
