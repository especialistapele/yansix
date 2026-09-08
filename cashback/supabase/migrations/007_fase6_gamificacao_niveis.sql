-- ============================================================
-- FASE 6 — Gamificação com níveis
-- ============================================================

create table public.niveis (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  nome text not null,
  pontos_necessarios integer not null default 0,
  beneficios text,
  cor text not null default '#2F6FED',
  created_at timestamptz not null default now()
);
create index idx_niveis_estab on public.niveis(estabelecimento_id, pontos_necessarios);

alter table public.niveis enable row level security;
create policy "acesso por papel - niveis" on public.niveis
  for all using (minha_role()='admin_master' or estabelecimento_id = meu_estabelecimento_id())
  with check (minha_role()='admin_master' or estabelecimento_id = meu_estabelecimento_id());

-- seed: 3 níveis padrão para o Salão Modelo (demo)
insert into public.niveis (estabelecimento_id, nome, pontos_necessarios, beneficios, cor)
select id, v.nome, v.pontos, v.beneficios, v.cor
from estabelecimentos, (values
  ('Bronze', 0,   'Acúmulo padrão de pontos e acesso a todos os prêmios do catálogo.', '#8A5A2B'),
  ('Prata',  300, '5% de pontos extra em todo atendimento e prioridade na fila de espera.', '#8A93A6'),
  ('Ouro',   700, '10% de pontos extra, brinde de aniversário exclusivo e acesso antecipado a promoções.', '#C79A3D')
) as v(nome, pontos, beneficios, cor)
where estabelecimentos.nome = 'Salão Modelo — Demonstração';

-- cliente_publico_info atualizada: inclui nível atual, progresso e benefícios
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
  v_pontos_totais int;
  v_premios json;
  v_nivel_atual record;
  v_proximo_nivel record;
  v_nivel_json json;
begin
  select * into v_cliente from clientes where id = p_cliente_id;
  if not found then return null; end if;

  select * into v_estab from estabelecimentos where id = v_cliente.estabelecimento_id;
  select * into v_cfg from configuracoes where estabelecimento_id = v_cliente.estabelecimento_id;

  select coalesce(sum(pontos),0) into v_saldo from pontuacoes
    where cliente_id = p_cliente_id and (expira_em is null or expira_em >= current_date);
  select v_saldo - coalesce(sum(pontos_utilizados),0) into v_saldo from resgates where cliente_id = p_cliente_id;

  select coalesce(sum(pontos),0) into v_pontos_totais from pontuacoes where cliente_id = p_cliente_id;

  select json_agg(json_build_object(
    'id', pr.id, 'nome', pr.nome, 'pontos_necessarios', pr.pontos_necessarios,
    'progresso_pct', least(100, round((v_saldo::numeric / greatest(pr.pontos_necessarios,1)) * 100))
  ) order by pr.pontos_necessarios)
  into v_premios
  from premios pr where pr.estabelecimento_id = v_cliente.estabelecimento_id and pr.ativo = true;

  select * into v_nivel_atual from niveis
    where estabelecimento_id = v_cliente.estabelecimento_id and pontos_necessarios <= v_pontos_totais
    order by pontos_necessarios desc limit 1;
  select * into v_proximo_nivel from niveis
    where estabelecimento_id = v_cliente.estabelecimento_id and pontos_necessarios > v_pontos_totais
    order by pontos_necessarios asc limit 1;

  if v_nivel_atual.id is not null then
    v_nivel_json := json_build_object(
      'nome', v_nivel_atual.nome, 'cor', v_nivel_atual.cor, 'beneficios', v_nivel_atual.beneficios,
      'proximo_nome', v_proximo_nivel.nome,
      'pontos_faltando', case when v_proximo_nivel.id is not null then v_proximo_nivel.pontos_necessarios - v_pontos_totais else null end,
      'progresso_pct', case when v_proximo_nivel.id is not null then
          least(100, round(((v_pontos_totais - v_nivel_atual.pontos_necessarios)::numeric /
            greatest(v_proximo_nivel.pontos_necessarios - v_nivel_atual.pontos_necessarios,1)) * 100))
        else 100 end
    );
  end if;

  return json_build_object(
    'nome', v_cliente.nome,
    'saldo', v_saldo,
    'estabelecimento_nome', v_estab.nome,
    'cor_tema', v_estab.cor_tema,
    'premios', coalesce(v_premios, '[]'::json),
    'avaliacao_ativo', coalesce(v_cfg.avaliacao_ativo, true),
    'indicacao_ativa', coalesce(v_cfg.marketing_boca_boca_ativo, false),
    'nivel', v_nivel_json
  );
end;
$$;
grant execute on function public.cliente_publico_info(uuid) to anon;
