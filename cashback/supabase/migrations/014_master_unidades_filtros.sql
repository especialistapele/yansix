alter table public.estabelecimentos add column if not exists area_atuacao text;
create index if not exists idx_estabelecimentos_area on public.estabelecimentos(area_atuacao);

create or replace function public.registrar_auditoria() returns trigger
language plpgsql security definer set search_path=public as $$
declare eid uuid; ent uuid; pid uuid;
begin
 eid := case when tg_op='DELETE' then old.estabelecimento_id else new.estabelecimento_id end;
 ent := case when tg_op='DELETE' then old.id else new.id end;
 begin pid := case when tg_op='DELETE' then old.profissional_id else new.profissional_id end; exception when undefined_column then pid := null; end;
 insert into public.auditoria_admin(estabelecimento_id,ator_id,evento,entidade,entidade_id,detalhes)
 values(eid,auth.uid(),lower(tg_op),tg_table_name,ent,jsonb_build_object('operation',tg_op,'profissional_id',pid));
 return coalesce(new,old);
end $$;
