-- Fase 4: histórico global e auditoria com filtros hierárquicos.
alter table public.auditoria_admin add column if not exists profissional_id uuid references auth.users(id) on delete set null;
alter table public.auditoria_admin add column if not exists cliente_id uuid references public.clientes(id) on delete set null;
create index if not exists idx_auditoria_profissional_created on public.auditoria_admin(profissional_id,created_at desc);
create index if not exists idx_auditoria_cliente_created on public.auditoria_admin(cliente_id,created_at desc);
create or replace function public.registrar_auditoria() returns trigger language plpgsql security definer set search_path=public as $$
declare eid uuid; ent uuid; pid uuid; cid uuid;
begin
 eid:=case when tg_op='DELETE' then old.estabelecimento_id else new.estabelecimento_id end;
 ent:=case when tg_op='DELETE' then old.id else new.id end;
 pid:=case when tg_op='DELETE' then old.profissional_id else new.profissional_id end;
 cid:=case when tg_op='DELETE' then old.cliente_id else new.cliente_id end;
 insert into public.auditoria_admin(estabelecimento_id,ator_id,profissional_id,cliente_id,evento,entidade,entidade_id,detalhes)
 values(eid,auth.uid(),pid,cid,lower(tg_op),tg_table_name,ent,jsonb_build_object('operation',lower(tg_op),'profissional_id',pid,'cliente_id',cid));
 return coalesce(new,old);
end $$;
