-- Hora do Pão — V7: envio de cobranças às unidades
-- Rodar no Supabase: SQL Editor > New query > colar tudo > Run.
-- Seguro para rodar mais de uma vez.

alter table public.cobrancas_mensais
  add column if not exists enviada_em timestamptz,
  add column if not exists enviada_por uuid references auth.users(id),
  add column if not exists mensagem text,
  add column if not exists visualizada_em timestamptz;

-- Dados de pagamento da plataforma (PIX etc.), editados pelo Master e lidos pelas padarias.
create table if not exists public.plataforma_config (
  chave text primary key,
  valor jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);
alter table public.plataforma_config enable row level security;
drop policy if exists plataforma_config_select on public.plataforma_config;
drop policy if exists plataforma_config_master on public.plataforma_config;
create policy plataforma_config_select on public.plataforma_config for select to authenticated using (true);
create policy plataforma_config_master on public.plataforma_config for all to authenticated
  using ((select public.eh_master())) with check ((select public.eh_master()));
insert into public.plataforma_config(chave, valor) values
 ('cobranca', jsonb_build_object('favorecido','','pix_chave','','instrucoes','Pague via PIX e envie o comprovante ao suporte do Hora do Pão.'))
on conflict (chave) do nothing;

-- O administrador da padaria só enxerga cobranças já ENVIADAS pelo Master.
drop policy if exists cobrancas_admin_select on public.cobrancas_mensais;
create policy cobrancas_admin_select on public.cobrancas_mensais for select to authenticated
  using (padaria_id = (select public.minha_padaria()) and enviada_em is not null);

-- Gerar cobrança não altera mais uma cobrança já paga, cancelada ou enviada.
create or replace function public.gerar_cobranca_mensal(p_padaria uuid, p_competencia date)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_a public.assinaturas_padaria%rowtype; v_venc date; v_comp date := date_trunc('month', p_competencia)::date;
begin
  if not public.eh_master() then raise exception 'Apenas o Master pode gerar cobranças.' using errcode='42501'; end if;
  select * into v_a from public.assinaturas_padaria where padaria_id = p_padaria and status = 'ativa';
  if not found then raise exception 'Padaria sem assinatura ativa.'; end if;
  v_venc := make_date(extract(year from v_comp)::int, extract(month from v_comp)::int,
    least(v_a.dia_vencimento, extract(day from (v_comp + interval '1 month - 1 day'))::int));
  insert into public.cobrancas_mensais(padaria_id, assinatura_padaria_id, competencia, valor, vencimento_em)
  values (p_padaria, v_a.padaria_id, v_comp, v_a.valor_mensal, v_venc)
  on conflict (padaria_id, competencia) do update
    set valor = excluded.valor, vencimento_em = excluded.vencimento_em, atualizado_em = now()
    where cobrancas_mensais.status in ('pendente','atrasado') and cobrancas_mensais.enviada_em is null
  returning id into v_id;
  if v_id is null then select id into v_id from public.cobrancas_mensais where padaria_id = p_padaria and competencia = v_comp; end if;
  insert into public.logs(usuario_id, padaria_id, acao, detalhe)
    values (auth.uid(), p_padaria, 'gerar_cobranca_mensal', jsonb_build_object('cobranca_id', v_id, 'competencia', v_comp));
  return v_id;
end $$;

-- Master envia a cobrança à unidade (passa a aparecer no painel da padaria).
create or replace function public.enviar_cobranca(p_cobranca uuid, p_mensagem text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v public.cobrancas_mensais%rowtype;
begin
  if not public.eh_master() then raise exception 'Apenas o Master pode enviar cobranças.' using errcode='42501'; end if;
  select * into v from public.cobrancas_mensais where id = p_cobranca;
  if not found then raise exception 'Cobrança não encontrada.'; end if;
  if v.status in ('pago','cancelado') then raise exception 'Cobrança % não pode ser enviada.', v.status; end if;
  update public.cobrancas_mensais
     set enviada_em = now(), enviada_por = auth.uid(),
         mensagem = nullif(left(trim(coalesce(p_mensagem,'')),500),''), visualizada_em = null, atualizado_em = now()
   where id = p_cobranca;
  insert into public.logs(usuario_id, padaria_id, acao, detalhe)
    values (auth.uid(), v.padaria_id, 'enviar_cobranca', jsonb_build_object('cobranca_id', v.id, 'competencia', v.competencia, 'valor', v.valor));
  return jsonb_build_object('ok', true, 'padaria_id', v.padaria_id);
end $$;

-- Administrador registra que viu a cobrança (só a da própria padaria).
create or replace function public.marcar_cobranca_vista(p_cobranca uuid)
returns void language sql security definer set search_path to 'public' as $$
  update public.cobrancas_mensais set visualizada_em = now()
  where id = p_cobranca and padaria_id = public.minha_padaria() and enviada_em is not null and visualizada_em is null
$$;

-- Marca como "atrasado" as cobranças pendentes vencidas (data de Brasília).
create or replace function public.atualizar_atrasos()
returns int language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  if not public.eh_master() then raise exception 'Apenas o Master.' using errcode='42501'; end if;
  update public.cobrancas_mensais set status='atrasado', atualizado_em=now()
   where status='pendente' and vencimento_em < (now() at time zone 'America/Sao_Paulo')::date;
  get diagnostics n = row_count; return n;
end $$;

revoke all on function public.enviar_cobranca(uuid,text), public.marcar_cobranca_vista(uuid),
  public.atualizar_atrasos(), public.gerar_cobranca_mensal(uuid,date) from public, anon;
grant execute on function public.enviar_cobranca(uuid,text), public.marcar_cobranca_vista(uuid),
  public.atualizar_atrasos(), public.gerar_cobranca_mensal(uuid,date) to authenticated;
