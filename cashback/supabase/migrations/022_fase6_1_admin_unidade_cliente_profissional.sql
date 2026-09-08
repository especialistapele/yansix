-- FASE 6.1: Admin Unidade + Cliente x Profissional + correção de auditoria
-- Aplicada ao projeto Supabase uaqbnwwjqhhnqzsavbkh em 2026-08-29.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS atendimento_regra text NOT NULL DEFAULT 'qualquer',
  ADD COLUMN IF NOT EXISTS profissional_principal_id uuid;

ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_atendimento_regra_check;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_atendimento_regra_check CHECK (atendimento_regra IN ('qualquer','selecionados'));
CREATE INDEX IF NOT EXISTS idx_clientes_atendimento_regra ON public.clientes(estabelecimento_id, atendimento_regra);
CREATE INDEX IF NOT EXISTS idx_clientes_profissional_principal ON public.clientes(profissional_principal_id);

CREATE OR REPLACE FUNCTION public.validar_cliente_profissional()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cli_est uuid; prof_est uuid; prof_role text;
BEGIN
  SELECT estabelecimento_id INTO cli_est FROM public.clientes WHERE id=NEW.cliente_id;
  SELECT estabelecimento_id, role INTO prof_est, prof_role FROM public.perfis WHERE id=NEW.profissional_id;
  IF cli_est IS NULL OR cli_est <> NEW.estabelecimento_id THEN RAISE EXCEPTION 'CLIENTE_UNIDADE_INVALIDA'; END IF;
  IF prof_est IS NULL OR prof_est <> NEW.estabelecimento_id OR prof_role <> 'profissional' THEN RAISE EXCEPTION 'PROFISSIONAL_UNIDADE_INVALIDO'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_validar_cliente_profissional ON public.cliente_profissionais;
CREATE TRIGGER trg_validar_cliente_profissional BEFORE INSERT OR UPDATE ON public.cliente_profissionais FOR EACH ROW EXECUTE FUNCTION public.validar_cliente_profissional();

CREATE OR REPLACE FUNCTION public.validar_cliente_atendimento_config()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.atendimento_regra IS NULL OR NEW.atendimento_regra NOT IN ('qualquer','selecionados') THEN RAISE EXCEPTION 'REGRA_ATENDIMENTO_INVALIDA'; END IF;
  IF NEW.profissional_principal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.perfis p WHERE p.id=NEW.profissional_principal_id AND p.role='profissional' AND p.estabelecimento_id=NEW.estabelecimento_id
  ) THEN RAISE EXCEPTION 'PROFISSIONAL_PRINCIPAL_UNIDADE_INVALIDO'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_validar_cliente_atendimento_config ON public.clientes;
CREATE TRIGGER trg_validar_cliente_atendimento_config BEFORE INSERT OR UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.validar_cliente_atendimento_config();

-- Corrige a auditoria genérica: a tabela clientes possui id, não cliente_id.
CREATE OR REPLACE FUNCTION public.registrar_auditoria()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE eid uuid; ent uuid; pid uuid; cid uuid; det jsonb;
BEGIN
  IF TG_OP='DELETE' THEN eid:=OLD.estabelecimento_id; ent:=OLD.id; ELSE eid:=NEW.estabelecimento_id; ent:=NEW.id; END IF;
  pid:=NULL; cid:=NULL;
  IF TG_TABLE_NAME='clientes' THEN
    cid:=ent;
    IF TG_OP='DELETE' THEN pid:=OLD.profissional_id; ELSE pid:=NEW.profissional_id; END IF;
  ELSIF TG_TABLE_NAME IN ('atendimentos','resgates','pontuacoes','cashback_lancamentos','cliente_profissionais') THEN
    IF TG_OP='DELETE' THEN cid:=OLD.cliente_id; pid:=OLD.profissional_id; ELSE cid:=NEW.cliente_id; pid:=NEW.profissional_id; END IF;
  END IF;
  det:=jsonb_build_object('operation',lower(TG_OP),'profissional_id',pid,'cliente_id',cid);
  INSERT INTO public.auditoria_admin(estabelecimento_id,ator_id,profissional_id,cliente_id,evento,entidade,entidade_id,detalhes)
  VALUES(eid,auth.uid(),pid,cid,lower(TG_OP),TG_TABLE_NAME,ent,det);
  RETURN COALESCE(NEW,OLD);
END; $$;

DROP POLICY IF EXISTS "hierarquia clientes compartilhados" ON public.clientes;
CREATE POLICY "hierarquia clientes compartilhados" ON public.clientes FOR SELECT TO authenticated USING (
  is_admin_master() OR
  (minha_role()='admin_estabelecimento' AND estabelecimento_id=meu_estabelecimento_id()) OR
  (minha_role()='profissional' AND estabelecimento_id=meu_estabelecimento_id() AND
    (atendimento_regra='qualquer' OR EXISTS (SELECT 1 FROM public.cliente_profissionais cp WHERE cp.cliente_id=clientes.id AND cp.profissional_id=auth.uid())))
);

DROP POLICY IF EXISTS "hierarquia clientes update" ON public.clientes;
CREATE POLICY "hierarquia clientes update" ON public.clientes FOR UPDATE TO authenticated
USING (is_admin_master() OR (minha_role()='admin_estabelecimento' AND estabelecimento_id=meu_estabelecimento_id()) OR
       (minha_role()='profissional' AND estabelecimento_id=meu_estabelecimento_id() AND (atendimento_regra='qualquer' OR EXISTS (SELECT 1 FROM public.cliente_profissionais cp WHERE cp.cliente_id=clientes.id AND cp.profissional_id=auth.uid()))))
WITH CHECK (is_admin_master() OR (minha_role()='admin_estabelecimento' AND estabelecimento_id=meu_estabelecimento_id()) OR (minha_role()='profissional' AND estabelecimento_id=meu_estabelecimento_id()));

DROP POLICY IF EXISTS "hierarquia clientes delete" ON public.clientes;
CREATE POLICY "hierarquia clientes delete" ON public.clientes FOR DELETE TO authenticated USING (
  is_admin_master() OR (minha_role()='admin_estabelecimento' AND estabelecimento_id=meu_estabelecimento_id()) OR
  (minha_role()='profissional' AND estabelecimento_id=meu_estabelecimento_id() AND (atendimento_regra='qualquer' OR EXISTS (SELECT 1 FROM public.cliente_profissionais cp WHERE cp.cliente_id=clientes.id AND cp.profissional_id=auth.uid())))
);

CREATE OR REPLACE FUNCTION public.registrar_atendimento_pontuacao(
  p_estabelecimento_id uuid, p_cliente_id uuid, p_servico_id uuid, p_profissional_id uuid DEFAULT NULL,
  p_usar_cashback boolean DEFAULT false, p_observacao text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE aid uuid; pid uuid; valor numeric; pontos integer; cb numeric:=0; saldo numeric:=0; exp date; pont_id uuid; uso numeric:=0; cfg record; cli_est uuid; srv_est uuid; srv_cb numeric; regra text; principal uuid;
BEGIN
  IF public.minha_role() IN ('admin_estabelecimento','profissional') AND p_estabelecimento_id<>public.meu_estabelecimento_id() THEN RAISE EXCEPTION 'ACESSO_UNIDADE_NEGADO'; END IF;
  SELECT estabelecimento_id,atendimento_regra,profissional_principal_id INTO cli_est,regra,principal FROM public.clientes WHERE id=p_cliente_id;
  SELECT estabelecimento_id,valor,cashback_pct INTO srv_est,valor,srv_cb FROM public.servicos WHERE id=p_servico_id AND ativo=true;
  IF cli_est IS NULL OR cli_est<>p_estabelecimento_id THEN RAISE EXCEPTION 'CLIENTE_UNIDADE_INVALIDA'; END IF;
  IF srv_est IS NULL OR srv_est<>p_estabelecimento_id THEN RAISE EXCEPTION 'SERVICO_UNIDADE_INVALIDO'; END IF;
  IF public.minha_role()='profissional' THEN pid:=auth.uid(); ELSE pid:=p_profissional_id; END IF;
  IF pid IS NULL THEN RAISE EXCEPTION 'PROFISSIONAL_OBRIGATORIO'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.perfis WHERE id=pid AND role='profissional' AND estabelecimento_id=p_estabelecimento_id) THEN RAISE EXCEPTION 'PROFISSIONAL_UNIDADE_INVALIDO'; END IF;
  IF regra='selecionados' AND NOT EXISTS(SELECT 1 FROM public.cliente_profissionais WHERE cliente_id=p_cliente_id AND profissional_id=pid AND estabelecimento_id=p_estabelecimento_id) THEN RAISE EXCEPTION 'PROFISSIONAL_NAO_AUTORIZADO_CLIENTE'; END IF;
  IF principal IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.perfis WHERE id=principal AND role='profissional' AND estabelecimento_id=p_estabelecimento_id) THEN RAISE EXCEPTION 'PROFISSIONAL_PRINCIPAL_UNIDADE_INVALIDO'; END IF;
  SELECT * INTO cfg FROM public.configuracoes WHERE estabelecimento_id=p_estabelecimento_id;
  pontos:=floor(valor/greatest(coalesce(cfg.valor_por_ponto,1),0.01));
  IF cfg.pontuacao_maxima_servico IS NOT NULL THEN pontos:=least(pontos,cfg.pontuacao_maxima_servico); END IF;
  INSERT INTO public.atendimentos(estabelecimento_id,cliente_id,profissional_id,servico_id,valor,observacao) VALUES(p_estabelecimento_id,p_cliente_id,pid,p_servico_id,valor,p_observacao) RETURNING id INTO aid;
  INSERT INTO public.pontuacoes(estabelecimento_id,cliente_id,servico_id,valor,pontos,expira_em,profissional_id,atendimento_id) VALUES(p_estabelecimento_id,p_cliente_id,p_servico_id,valor,pontos,CASE WHEN cfg.validade_pontos='sem_validade' OR cfg.validade_pontos IS NULL THEN NULL ELSE (CASE cfg.validade_pontos WHEN '8_meses' THEN current_date+interval '8 months' WHEN '10_meses' THEN current_date+interval '10 months' WHEN '1_ano' THEN current_date+interval '1 year' WHEN '1_ano_meio' THEN current_date+interval '18 months' WHEN '2_anos' THEN current_date+interval '2 years' ELSE NULL END)::date END,pid,aid) RETURNING id INTO pont_id;
  IF coalesce(cfg.cashback_ativo,false) AND coalesce(srv_cb,0)>0 THEN cb:=round(valor*(srv_cb/100),2); exp:=current_date+coalesce(cfg.cashback_expiracao_dias,90); INSERT INTO public.cashback_lancamentos(estabelecimento_id,cliente_id,tipo,valor,pontuacao_id,expira_em,profissional_id,atendimento_id) VALUES(p_estabelecimento_id,p_cliente_id,'credito',cb,pont_id,exp,pid,aid); END IF;
  IF p_usar_cashback THEN SELECT coalesce(sum(CASE WHEN tipo='credito' AND (expira_em IS NULL OR expira_em>=current_date) THEN valor WHEN tipo='uso' THEN -valor ELSE 0 END),0) INTO saldo FROM public.cashback_lancamentos WHERE cliente_id=p_cliente_id AND estabelecimento_id=p_estabelecimento_id; uso:=greatest(saldo,0); IF uso>0 THEN INSERT INTO public.cashback_lancamentos(estabelecimento_id,cliente_id,tipo,valor,pontuacao_id,profissional_id,atendimento_id) VALUES(p_estabelecimento_id,p_cliente_id,'uso',uso,pont_id,pid,aid); END IF; END IF;
  RETURN jsonb_build_object('atendimento_id',aid,'pontuacao_id',pont_id,'pontos',pontos,'cashback',cb,'cashback_usado',uso,'profissional_id',pid);
END; $$;

GRANT EXECUTE ON FUNCTION public.registrar_atendimento_pontuacao(uuid,uuid,uuid,uuid,boolean,text) TO authenticated;
