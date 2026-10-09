-- Agenda: horário final personalizável, serviços adicionais e cashback por procedimento.
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS servico_valor_snapshot numeric(10,2),
  ADD COLUMN IF NOT EXISTS servico_cashback_pct_snapshot numeric(5,2);
UPDATE public.agendamentos a
SET servico_valor_snapshot=s.valor, servico_cashback_pct_snapshot=s.cashback_pct
FROM public.servicos s
WHERE s.id=a.servico_id AND (a.servico_valor_snapshot IS NULL OR a.servico_cashback_pct_snapshot IS NULL);
ALTER TABLE public.agendamentos ALTER COLUMN servico_valor_snapshot SET DEFAULT 0;
ALTER TABLE public.agendamentos ALTER COLUMN servico_cashback_pct_snapshot SET DEFAULT 0;
ALTER TABLE public.agendamentos ALTER COLUMN servico_valor_snapshot SET NOT NULL;
ALTER TABLE public.agendamentos ALTER COLUMN servico_cashback_pct_snapshot SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.agendamento_procedimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  servico_id uuid NOT NULL REFERENCES public.servicos(id) ON DELETE RESTRICT,
  ordem integer NOT NULL DEFAULT 1 CHECK (ordem > 0),
  valor_snapshot numeric(10,2) NOT NULL DEFAULT 0 CHECK (valor_snapshot >= 0),
  duracao_min_snapshot integer NOT NULL DEFAULT 30 CHECK (duracao_min_snapshot BETWEEN 5 AND 720),
  cashback_pct_snapshot numeric(5,2) NOT NULL DEFAULT 0 CHECK (cashback_pct_snapshot >= 0 AND cashback_pct_snapshot <= 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agendamento_procedimentos_agendamento ON public.agendamento_procedimentos(agendamento_id,ordem);
ALTER TABLE public.agendamento_procedimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agendamento_procedimentos_select_hierarquia ON public.agendamento_procedimentos;
CREATE POLICY agendamento_procedimentos_select_hierarquia ON public.agendamento_procedimentos FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.agendamentos a WHERE a.id=agendamento_id AND (public.is_admin_master() OR (a.estabelecimento_id=public.meu_estabelecimento_id() AND public.minha_role()='admin_estabelecimento' AND public.tem_permissao('atendimentos',a.estabelecimento_id)) OR (a.estabelecimento_id=public.meu_estabelecimento_id() AND public.minha_role()='profissional' AND a.profissional_id=auth.uid())))
);
DROP POLICY IF EXISTS agendamento_procedimentos_insert_hierarquia ON public.agendamento_procedimentos;
CREATE POLICY agendamento_procedimentos_insert_hierarquia ON public.agendamento_procedimentos FOR INSERT TO authenticated WITH CHECK (
 EXISTS (SELECT 1 FROM public.agendamentos a WHERE a.id=agendamento_id AND (public.is_admin_master() OR (a.estabelecimento_id=public.meu_estabelecimento_id() AND public.minha_role()='admin_estabelecimento' AND public.tem_permissao('atendimentos',a.estabelecimento_id)) OR (a.estabelecimento_id=public.meu_estabelecimento_id() AND public.minha_role()='profissional' AND a.profissional_id=auth.uid())))
);
DROP POLICY IF EXISTS agendamento_procedimentos_update_hierarquia ON public.agendamento_procedimentos;
CREATE POLICY agendamento_procedimentos_update_hierarquia ON public.agendamento_procedimentos FOR UPDATE TO authenticated USING (
 EXISTS (SELECT 1 FROM public.agendamentos a WHERE a.id=agendamento_id AND (public.is_admin_master() OR (a.estabelecimento_id=public.meu_estabelecimento_id() AND public.minha_role()='admin_estabelecimento' AND public.tem_permissao('atendimentos',a.estabelecimento_id)) OR (a.estabelecimento_id=public.meu_estabelecimento_id() AND public.minha_role()='profissional' AND a.profissional_id=auth.uid())))
) WITH CHECK (
 EXISTS (SELECT 1 FROM public.agendamentos a WHERE a.id=agendamento_id AND (public.is_admin_master() OR (a.estabelecimento_id=public.meu_estabelecimento_id() AND public.minha_role()='admin_estabelecimento' AND public.tem_permissao('atendimentos',a.estabelecimento_id)) OR (a.estabelecimento_id=public.meu_estabelecimento_id() AND public.minha_role()='profissional' AND a.profissional_id=auth.uid())))
);
DROP POLICY IF EXISTS agendamento_procedimentos_delete_hierarquia ON public.agendamento_procedimentos;
CREATE POLICY agendamento_procedimentos_delete_hierarquia ON public.agendamento_procedimentos FOR DELETE TO authenticated USING (
 EXISTS (SELECT 1 FROM public.agendamentos a WHERE a.id=agendamento_id AND (public.is_admin_master() OR (a.estabelecimento_id=public.meu_estabelecimento_id() AND public.minha_role()='admin_estabelecimento' AND public.tem_permissao('atendimentos',a.estabelecimento_id)) OR (a.estabelecimento_id=public.meu_estabelecimento_id() AND public.minha_role()='profissional' AND a.profissional_id=auth.uid())))
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.agendamento_procedimentos TO authenticated;

CREATE OR REPLACE FUNCTION public.validar_agendamento_procedimento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.agendamentos%ROWTYPE; srv public.servicos%ROWTYPE;
BEGIN
 SELECT * INTO a FROM public.agendamentos WHERE id=NEW.agendamento_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'AGENDAMENTO_NAO_ENCONTRADO'; END IF;
 SELECT * INTO srv FROM public.servicos WHERE id=NEW.servico_id AND estabelecimento_id=a.estabelecimento_id AND ativo=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROCEDIMENTO_UNIDADE_INVALIDO_OU_INATIVO'; END IF;
 IF srv.profissional_id IS NOT NULL AND srv.profissional_id IS DISTINCT FROM a.profissional_id THEN RAISE EXCEPTION 'SERVICO_VINCULADO_A_OUTRO_PROFISSIONAL'; END IF;
 IF NEW.servico_id=a.servico_id THEN RAISE EXCEPTION 'PROCEDIMENTO_PRINCIPAL_DUPLICADO'; END IF;
 NEW.valor_snapshot:=srv.valor; NEW.duracao_min_snapshot:=srv.duracao_min; NEW.cashback_pct_snapshot:=srv.cashback_pct;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.validar_agendamento_procedimento() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_agendamento_procedimento() TO authenticated,service_role;
DROP TRIGGER IF EXISTS trg_validar_agendamento_procedimento ON public.agendamento_procedimentos;
CREATE TRIGGER trg_validar_agendamento_procedimento BEFORE INSERT OR UPDATE ON public.agendamento_procedimentos FOR EACH ROW EXECUTE FUNCTION public.validar_agendamento_procedimento();

CREATE OR REPLACE FUNCTION public.recalcular_valor_agendamento_procedimentos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE aid uuid;
BEGIN
 aid:=CASE WHEN TG_OP='DELETE' THEN OLD.agendamento_id ELSE NEW.agendamento_id END;
 UPDATE public.agendamentos a SET valor=a.servico_valor_snapshot+COALESCE((SELECT sum(ap.valor_snapshot) FROM public.agendamento_procedimentos ap WHERE ap.agendamento_id=aid),0) WHERE a.id=aid;
 IF TG_OP='UPDATE' AND OLD.agendamento_id IS DISTINCT FROM NEW.agendamento_id THEN
   UPDATE public.agendamentos a SET valor=a.servico_valor_snapshot+COALESCE((SELECT sum(ap.valor_snapshot) FROM public.agendamento_procedimentos ap WHERE ap.agendamento_id=OLD.agendamento_id),0) WHERE a.id=OLD.agendamento_id;
 END IF;
 RETURN COALESCE(NEW,OLD);
END; $$;
REVOKE ALL ON FUNCTION public.recalcular_valor_agendamento_procedimentos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalcular_valor_agendamento_procedimentos() TO authenticated,service_role;
DROP TRIGGER IF EXISTS trg_recalcular_valor_agendamento_procedimentos ON public.agendamento_procedimentos;
CREATE TRIGGER trg_recalcular_valor_agendamento_procedimentos AFTER INSERT OR UPDATE OR DELETE ON public.agendamento_procedimentos FOR EACH ROW EXECUTE FUNCTION public.recalcular_valor_agendamento_procedimentos();

DO $fix$
DECLARE f text; old_block text; new_block text;
BEGIN
 SELECT pg_get_functiondef('public.validar_agendamento()'::regprocedure) INTO f;
 old_block := $old$IF TG_OP = 'INSERT' OR NEW.servico_id IS DISTINCT FROM OLD.servico_id THEN
    NEW.duracao_min := srv.duracao_min;
    NEW.valor := srv.valor;
  END IF;$old$;
 new_block := $new$IF TG_OP = 'INSERT' OR NEW.servico_id IS DISTINCT FROM OLD.servico_id THEN
    NEW.servico_valor_snapshot := srv.valor;
    NEW.servico_cashback_pct_snapshot := srv.cashback_pct;
    IF NEW.duracao_min IS NULL OR NEW.duracao_min < 5 THEN NEW.duracao_min := srv.duracao_min; END IF;
  END IF;
  NEW.servico_valor_snapshot := COALESCE(NEW.servico_valor_snapshot,srv.valor);
  NEW.servico_cashback_pct_snapshot := COALESCE(NEW.servico_cashback_pct_snapshot,srv.cashback_pct);
  NEW.valor := NEW.servico_valor_snapshot + COALESCE((SELECT sum(ap.valor_snapshot) FROM public.agendamento_procedimentos ap WHERE ap.agendamento_id=NEW.id),0);$new$;
 IF position(old_block in f)=0 THEN RAISE EXCEPTION 'Bloco original de duração não encontrado.'; END IF;
 EXECUTE replace(f,old_block,new_block);
END $fix$;

DO $fix$
DECLARE f text; old_decl text; new_decl text; old_call text; new_call text;
BEGIN
 SELECT pg_get_functiondef('public.processar_cashback_agendamento(uuid,boolean)'::regprocedure) INTO f;
 old_decl := $old$  resultado jsonb;
  role_atual text;$old$;
 new_decl := $new$  resultado jsonb;
  role_atual text;
  cfg record;
  aid uuid;
  pont_id uuid;
  pontos integer;
  cb numeric:=0;
  cb_item numeric:=0;
  uso numeric:=0;
  saldo numeric:=0;
  exp date;
  proc record;
  n_proc integer:=1;$new$;
 old_call := $old$resultado := public.registrar_atendimento_pontuacao(
    ag.estabelecimento_id,
    ag.cliente_id,
    ag.servico_id,
    ag.profissional_id,
    coalesce(p_usar_cashback,false),
    'Computado pela Agenda ' || ag.id::text
  );$old$;
 new_call := $new$SELECT * INTO cfg FROM public.configuracoes WHERE estabelecimento_id=ag.estabelecimento_id;
  resultado := public.registrar_atendimento_pontuacao(ag.estabelecimento_id,ag.cliente_id,ag.servico_id,ag.profissional_id,coalesce(p_usar_cashback,false),'Computado pela Agenda '||ag.id::text);
  aid := (resultado->>'atendimento_id')::uuid;
  pont_id := (resultado->>'pontuacao_id')::uuid;
  pontos := floor(ag.valor/greatest(coalesce(cfg.valor_por_ponto,1),0.01));
  IF cfg.pontuacao_maxima_servico IS NOT NULL THEN pontos:=least(pontos,cfg.pontuacao_maxima_servico); END IF;
  UPDATE public.atendimentos SET valor=ag.valor WHERE id=aid;
  UPDATE public.pontuacoes SET valor=ag.valor,pontos=pontos WHERE id=pont_id;
  cb:=coalesce((resultado->>'cashback')::numeric,0);
  FOR proc IN SELECT valor_snapshot,cashback_pct_snapshot FROM public.agendamento_procedimentos WHERE agendamento_id=ag.id ORDER BY ordem,id LOOP
    n_proc:=n_proc+1;
    cb_item:=CASE WHEN coalesce(cfg.cashback_ativo,false) THEN round(proc.valor_snapshot*proc.cashback_pct_snapshot/100,2) ELSE 0 END;
    IF cb_item>0 THEN
      INSERT INTO public.cashback_lancamentos(estabelecimento_id,cliente_id,tipo,valor,pontuacao_id,expira_em,profissional_id,atendimento_id)
      VALUES(ag.estabelecimento_id,ag.cliente_id,'credito',cb_item,pont_id,current_date+coalesce(cfg.cashback_expiracao_dias,90),ag.profissional_id,aid);
      cb:=cb+cb_item;
    END IF;
  END LOOP;
  resultado:=resultado||jsonb_build_object('pontos',pontos,'cashback',cb,'procedimentos',n_proc);$new$;
 IF position(old_decl in f)=0 OR position(old_call in f)=0 THEN RAISE EXCEPTION 'Bloco original de processamento do cashback não encontrado.'; END IF;
 f:=replace(f,old_decl,new_decl);
 f:=replace(f,old_call,new_call);
 EXECUTE f;
END $fix$;
