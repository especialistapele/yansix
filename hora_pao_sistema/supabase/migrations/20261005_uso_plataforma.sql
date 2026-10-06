-- V10: monitoramento do Supabase (banco e storage). JÁ APLICADO no projeto scnzyxvtaizfsbwiofvf.
insert into public.plataforma_config(chave, valor)
values ('limites', jsonb_build_object('db_bytes', 524288000, 'storage_bytes', 1073741824))
on conflict (chave) do nothing;

create or replace function public.uso_plataforma()
returns jsonb language plpgsql stable security definer set search_path = public, storage, auth as $$
declare v_lim jsonb; v_db bigint; v_st bigint; v_files int; v_tabs jsonb; v_users int; v_logs bigint;
begin
  if not public.eh_master() then raise exception 'Apenas o Master.' using errcode = '42501'; end if;
  select valor into v_lim from public.plataforma_config where chave = 'limites';
  v_lim := coalesce(v_lim, jsonb_build_object('db_bytes', 524288000, 'storage_bytes', 1073741824));
  v_db := pg_database_size(current_database());
  select coalesce(sum((metadata->>'size')::bigint),0), count(*)::int into v_st, v_files from storage.objects;
  select coalesce(jsonb_agg(jsonb_build_object('tabela', t.relname, 'bytes', t.b, 'linhas', t.n) order by t.b desc), '[]'::jsonb) into v_tabs
    from (select c.relname, pg_total_relation_size(c.oid) b, c.reltuples::bigint n
          from pg_class c join pg_namespace s on s.oid = c.relnamespace
          where s.nspname = 'public' and c.relkind = 'r' order by 2 desc limit 8) t;
  select count(*)::int into v_users from auth.users;
  select count(*) into v_logs from public.logs;
  return jsonb_build_object('db_bytes', v_db, 'db_limite', (v_lim->>'db_bytes')::bigint,
    'storage_bytes', v_st, 'storage_limite', (v_lim->>'storage_bytes')::bigint, 'storage_arquivos', v_files,
    'tabelas', v_tabs, 'usuarios', v_users, 'logs_total', v_logs, 'medido_em', now());
end $$;
revoke all on function public.uso_plataforma() from public, anon;
grant execute on function public.uso_plataforma() to authenticated;
