-- ============================================================
-- FASE 5 — Marketing automático
-- ============================================================

alter table public.configuracoes
  add column if not exists inatividade_dias integer not null default 45,
  add column if not exists inatividade_ativo boolean not null default false,
  add column if not exists lembrete_pontos_faltando integer not null default 20,
  add column if not exists lembrete_pontos_ativo boolean not null default false,
  add column if not exists reativacao_desconto_pct numeric(5,2) not null default 10,
  add column if not exists reativacao_ativo boolean not null default false;

create table public.marketing_mensagens (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo text not null check (tipo in ('inatividade','lembrete_pontos','reativacao')),
  mensagem text not null,
  cupom_codigo text,
  status text not null default 'pendente' check (status in ('pendente','enviada','ignorada')),
  created_at timestamptz not null default now(),
  enviada_em timestamptz
);
create index idx_marketing_estab on public.marketing_mensagens(estabelecimento_id, status);

alter table public.marketing_mensagens enable row level security;
create policy "acesso por papel - marketing" on public.marketing_mensagens
  for all using (minha_role()='admin_master' or estabelecimento_id = meu_estabelecimento_id())
  with check (minha_role()='admin_master' or estabelecimento_id = meu_estabelecimento_id());

create or replace function public.gerar_mensagens_marketing(p_estabelecimento_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg record;
  v_geradas integer := 0;
  v_cliente record;
  v_cupom text;
begin
  select * into v_cfg from configuracoes where estabelecimento_id = p_estabelecimento_id;
  if v_cfg is null then return 0; end if;

  if v_cfg.inatividade_ativo then
    for v_cliente in
      select c.id, c.nome, max(p.created_at)::date as ultima
      from clientes c left join pontuacoes p on p.cliente_id = c.id
      where c.estabelecimento_id = p_estabelecimento_id
      group by c.id, c.nome
      having max(p.created_at) is not null
         and max(p.created_at) < now() - (v_cfg.inatividade_dias || ' days')::interval
         and not exists (
           select 1 from marketing_mensagens m
           where m.cliente_id = c.id and m.tipo = 'inatividade'
             and m.created_at > now() - (v_cfg.inatividade_dias || ' days')::interval
         )
    loop
      insert into marketing_mensagens (estabelecimento_id, cliente_id, tipo, mensagem)
      values (p_estabelecimento_id, v_cliente.id, 'inatividade',
        format('Olá %s! Sentimos sua falta 💜 Já faz um tempo desde sua última visita. Que tal voltar e aproveitar seus pontos?', v_cliente.nome));
      v_geradas := v_geradas + 1;
    end loop;
  end if;

  if v_cfg.lembrete_pontos_ativo then
    for v_cliente in
      select c.id, c.nome,
        coalesce((select sum(pontos) from pontuacoes where cliente_id=c.id and (expira_em is null or expira_em>=current_date)),0)
        - coalesce((select sum(pontos_utilizados) from resgates where cliente_id=c.id),0) as saldo
      from clientes c where c.estabelecimento_id = p_estabelecimento_id
    loop
      if exists (
        select 1 from premios pr
        where pr.estabelecimento_id = p_estabelecimento_id and pr.ativo
          and pr.pontos_necessarios > v_cliente.saldo
          and pr.pontos_necessarios - v_cliente.saldo <= v_cfg.lembrete_pontos_faltando
      ) and not exists (
        select 1 from marketing_mensagens m where m.cliente_id = v_cliente.id and m.tipo='lembrete_pontos'
          and m.created_at > now() - interval '7 days'
      ) then
        insert into marketing_mensagens (estabelecimento_id, cliente_id, tipo, mensagem)
        values (p_estabelecimento_id, v_cliente.id, 'lembrete_pontos',
          format('Olá %s! Você está quase lá — faltam pouquíssimos pontos para resgatar seu próximo prêmio 🎁', v_cliente.nome));
        v_geradas := v_geradas + 1;
      end if;
    end loop;
  end if;

  if v_cfg.reativacao_ativo then
    for v_cliente in
      select c.id, c.nome from clientes c
      join cupons_indicacao ci on ci.validado_por_cliente_id = c.id
      where c.estabelecimento_id = p_estabelecimento_id
        and ci.validado_em < now() - interval '30 days'
        and not exists (select 1 from pontuacoes p where p.cliente_id = c.id and p.created_at > ci.validado_em)
        and not exists (select 1 from marketing_mensagens m where m.cliente_id = c.id and m.tipo='reativacao')
    loop
      v_cupom := 'REAT' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
      insert into marketing_mensagens (estabelecimento_id, cliente_id, tipo, mensagem, cupom_codigo)
      values (p_estabelecimento_id, v_cliente.id, 'reativacao',
        format('Olá %s! Preparamos um cupom especial de %s%% de desconto pra você voltar a nos visitar 💜 Código: %s',
          v_cliente.nome, v_cfg.reativacao_desconto_pct, v_cupom), v_cupom);
      v_geradas := v_geradas + 1;
    end loop;
  end if;

  return v_geradas;
end;
$$;
