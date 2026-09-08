-- FASE 6.1: auditoria de exclusão de cliente sem violar FK cliente_id.
CREATE OR REPLACE FUNCTION public.registrar_auditoria()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE eid uuid; ent uuid; pid uuid; cid uuid; det jsonb;
BEGIN
  IF TG_OP='DELETE' THEN eid:=OLD.estabelecimento_id; ent:=OLD.id; ELSE eid:=NEW.estabelecimento_id; ent:=NEW.id; END IF;
  pid:=NULL; cid:=NULL;
  IF TG_TABLE_NAME='clientes' THEN
    IF TG_OP<>'DELETE' THEN cid:=ent; pid:=NEW.profissional_id; ELSE pid:=OLD.profissional_id; END IF;
  ELSIF TG_TABLE_NAME IN ('atendimentos','resgates','pontuacoes','cashback_lancamentos','cliente_profissionais') THEN
    IF TG_OP='DELETE' THEN cid:=OLD.cliente_id; pid:=OLD.profissional_id; ELSE cid:=NEW.cliente_id; pid:=NEW.profissional_id; END IF;
  END IF;
  det:=jsonb_build_object('operation',lower(TG_OP),'profissional_id',pid,'cliente_id',cid);
  INSERT INTO public.auditoria_admin(estabelecimento_id,ator_id,profissional_id,cliente_id,evento,entidade,entidade_id,detalhes)
  VALUES(eid,auth.uid(),pid,cid,lower(TG_OP),TG_TABLE_NAME,ent,det);
  RETURN COALESCE(NEW,OLD);
END; $$;
