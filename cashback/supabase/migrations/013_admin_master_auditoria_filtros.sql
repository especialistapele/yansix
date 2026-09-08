-- Fase Master: auditoria e base para filtros hierarquicos
create or replace function public.is_admin_master() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.perfis where id=auth.uid() and role='admin_master'); $$;
create or replace function public.minha_role() returns text language sql stable security definer set search_path=public as $$ select role from public.perfis where id=auth.uid(); $$;
create or replace function public.meu_estabelecimento_id() returns uuid language sql stable security definer set search_path=public as $$ select estabelecimento_id from public.perfis where id=auth.uid(); $$;
revoke all on function public.is_admin_master() from public; grant execute on function public.is_admin_master() to authenticated;
revoke all on function public.minha_role() from public; grant execute on function public.minha_role() to authenticated;
revoke all on function public.meu_estabelecimento_id() from public; grant execute on function public.meu_estabelecimento_id() to authenticated;

create table if not exists public.auditoria_admin (
 id uuid primary key default gen_random_uuid(), estabelecimento_id uuid references public.estabelecimentos(id) on delete set null,
 ator_id uuid references auth.users(id) on delete set null, evento text not null, entidade text, entidade_id uuid,
 detalhes jsonb default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists idx_auditoria_admin_estab_created on public.auditoria_admin(estabelecimento_id,created_at desc);
create index if not exists idx_auditoria_admin_evento on public.auditoria_admin(evento);
alter table public.auditoria_admin enable row level security;
drop policy if exists auditoria_master_select on public.auditoria_admin;
create policy auditoria_master_select on public.auditoria_admin for select to authenticated using (public.is_admin_master() or estabelecimento_id=public.meu_estabelecimento_id());

create or replace function public.registrar_auditoria() returns trigger language plpgsql security definer set search_path=public as $$
declare eid uuid; ent uuid;
begin
 eid := case when tg_op='DELETE' then old.estabelecimento_id else new.estabelecimento_id end;
 ent := case when tg_op='DELETE' then old.id else new.id end;
 insert into public.auditoria_admin(estabelecimento_id,ator_id,evento,entidade,entidade_id,detalhes)
 values(eid,auth.uid(),lower(tg_op),tg_table_name,ent,jsonb_build_object('operation',tg_op));
 return coalesce(new,old);
end $$;

do $$ declare t text; begin foreach t in array array['pontuacoes','cashback_lancamentos','resgates','cupons_indicacao','marketing_mensagens','premios','niveis','clientes'] loop
 execute format('drop trigger if exists trg_auditoria_%I on public.%I',t,t);
 execute format('create trigger trg_auditoria_%I after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()',t,t);
end loop; end $$;

create index if not exists idx_clientes_nascimento on public.clientes(data_nascimento);
create index if not exists idx_pontuacoes_profissional_created on public.pontuacoes(profissional_id,created_at desc);
create index if not exists idx_resgates_profissional_created on public.resgates(profissional_id,created_at desc);
create index if not exists idx_marketing_estab_created on public.marketing_mensagens(estabelecimento_id,created_at desc);
