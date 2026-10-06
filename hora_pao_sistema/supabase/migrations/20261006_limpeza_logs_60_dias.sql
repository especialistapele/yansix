-- Hora do Pão — V11: limpeza automática dos logs com mais de 60 dias.
-- Rodar no Supabase: SQL Editor > New query > colar tudo > Run. Seguro para rodar mais de uma vez.

create extension if not exists pg_cron;

insert into public.plataforma_config(chave, valor) values ('logs', jsonb_build_object('retencao_dias', 60))
on conflict (chave) do nothing;

create or replace function public.limpar_logs_antigos(p_dias int default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_dias int; n int;
begin
  -- o agendador roda sem usuário (auth.uid() nulo); pelo painel só o Master pode chamar
  if auth.uid() is not null and not public.eh_master() then
    raise exception 'Apenas o Master.' using errcode = '42501';
  end if;
  v_dias := coalesce(p_dias, (select (valor->>'retencao_dias')::int from public.plataforma_config where chave = 'logs'), 60);
  if v_dias < 7 then raise exception 'Retenção mínima: 7 dias.'; end if;
  delete from public.logs where criado_em < now() - make_interval(days => v_dias);
  get diagnostics n = row_count;
  if n > 0 then
    insert into public.logs(usuario_id, padaria_id, acao, detalhe)
    values (auth.uid(), null, 'limpeza_logs', jsonb_build_object('removidos', n, 'retencao_dias', v_dias));
  end if;
  return n;
end $$;
revoke all on function public.limpar_logs_antigos(int) from public, anon;
grant execute on function public.limpar_logs_antigos(int) to authenticated;

-- Todos os dias às 03:00 (Brasília = 06:00 UTC) apaga o que passou de 60 dias (janela móvel).
select cron.unschedule(jobid) from cron.job where jobname = 'limpar-logs-antigos';
select cron.schedule('limpar-logs-antigos', '0 6 * * *', $$select public.limpar_logs_antigos()$$);
