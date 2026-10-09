-- Agenda integrada ao Yansix Cashback.
-- Reaproveita public.servicos, public.clientes, public.perfis e a hierarquia de acesso existente.
ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS duracao_min integer NOT NULL DEFAULT 30;
ALTER TABLE public.servicos DROP CONSTRAINT IF EXISTS servicos_duracao_min_check;
ALTER TABLE public.servicos ADD CONSTRAINT servicos_duracao_min_check CHECK (duracao_min BETWEEN 5 AND 720);

CREATE TABLE IF NOT EXISTS public.agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estabelecimento_id uuid NOT NULL REFERENCES public.estabelecimentos(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  servico_id uuid NOT NULL REFERENCES public.servicos(id) ON DELETE RESTRICT,
  profissional_id uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  inicio timestamptz NOT NULL,
  fim timestamptz NOT NULL,
  duracao_min integer NOT NULL CHECK (duracao_min BETWEEN 5 AND 720),
  valor numeric(10,2) NOT NULL CHECK (valor >= 0),
  status text NOT NULL DEFAULT 'agendado'
    CHECK (status IN ('agendado','confirmado','concluido','cancelado','faltou')),
  observacao text,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fim > inicio)
);
CREATE INDEX IF NOT EXISTS idx_agendamentos_unidade_inicio
  ON public.agendamentos(estabelecimento_id, inicio);
CREATE INDEX IF NOT EXISTS idx_agendamentos_profissional_inicio
  ON public.agendamentos(estabelecimento_id, profissional_id, inicio);
CREATE INDEX IF NOT EXISTS idx_agendamentos_cliente_inicio
  ON public.agendamentos(cliente_id, inicio DESC);

ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agendamentos_select_hierarquia ON public.agendamentos;
CREATE POLICY agendamentos_select_hierarquia ON public.agendamentos
  FOR SELECT TO authenticated
  USING (
    public.is_admin_master()
    OR (
      estabelecimento_id = public.meu_estabelecimento_id()
      AND public.minha_role() = 'admin_estabelecimento'
      AND public.tem_permissao('atendimentos', estabelecimento_id)
    )
    OR (
      estabelecimento_id = public.meu_estabelecimento_id()
      AND public.minha_role() = 'profissional'
      AND profissional_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS agendamentos_insert_hierarquia ON public.agendamentos;
CREATE POLICY agendamentos_insert_hierarquia ON public.agendamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_master()
    OR (
      estabelecimento_id = public.meu_estabelecimento_id()
      AND public.minha_role() = 'admin_estabelecimento'
      AND public.tem_permissao('atendimentos', estabelecimento_id)
    )
    OR (
      estabelecimento_id = public.meu_estabelecimento_id()
      AND public.minha_role() = 'profissional'
      AND profissional_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS agendamentos_update_hierarquia ON public.agendamentos;
CREATE POLICY agendamentos_update_hierarquia ON public.agendamentos
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_master()
    OR (
      estabelecimento_id = public.meu_estabelecimento_id()
      AND public.minha_role() = 'admin_estabelecimento'
      AND public.tem_permissao('atendimentos', estabelecimento_id)
    )
    OR (
      estabelecimento_id = public.meu_estabelecimento_id()
      AND public.minha_role() = 'profissional'
      AND profissional_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin_master()
    OR (
      estabelecimento_id = public.meu_estabelecimento_id()
      AND public.minha_role() = 'admin_estabelecimento'
      AND public.tem_permissao('atendimentos', estabelecimento_id)
    )
    OR (
      estabelecimento_id = public.meu_estabelecimento_id()
      AND public.minha_role() = 'profissional'
      AND profissional_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.agendamentos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.servicos TO authenticated;

CREATE OR REPLACE FUNCTION public.validar_agendamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  srv public.servicos%ROWTYPE;
  cli_est uuid;
  prof_est uuid;
  prof_role text;
BEGIN
  SELECT * INTO srv
  FROM public.servicos
  WHERE id = NEW.servico_id AND estabelecimento_id = NEW.estabelecimento_id;

  IF NOT FOUND OR (TG_OP = 'INSERT' AND NOT srv.ativo) THEN
    RAISE EXCEPTION 'SERVICO_UNIDADE_INVALIDO_OU_INATIVO';
  END IF;

  SELECT estabelecimento_id INTO cli_est
  FROM public.clientes WHERE id = NEW.cliente_id;
  IF cli_est IS NULL OR cli_est <> NEW.estabelecimento_id THEN
    RAISE EXCEPTION 'CLIENTE_UNIDADE_INVALIDA';
  END IF;

  IF NEW.profissional_id IS NULL AND srv.profissional_id IS NOT NULL THEN
    NEW.profissional_id := srv.profissional_id;
  END IF;
  IF srv.profissional_id IS NOT NULL AND NEW.profissional_id IS DISTINCT FROM srv.profissional_id THEN
    RAISE EXCEPTION 'SERVICO_VINCULADO_A_OUTRO_PROFISSIONAL';
  END IF;

  IF NEW.profissional_id IS NOT NULL THEN
    SELECT estabelecimento_id, role INTO prof_est, prof_role
    FROM public.perfis WHERE id = NEW.profissional_id;
    IF prof_est IS NULL OR prof_est <> NEW.estabelecimento_id OR prof_role <> 'profissional' THEN
      RAISE EXCEPTION 'PROFISSIONAL_UNIDADE_INVALIDO';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.servico_id IS DISTINCT FROM OLD.servico_id THEN
    NEW.duracao_min := srv.duracao_min;
    NEW.valor := srv.valor;
  END IF;
  NEW.fim := NEW.inicio + make_interval(mins => NEW.duracao_min);
  NEW.updated_at := now();

  IF NEW.status <> 'cancelado' THEN
    -- Serializa a verificação por unidade para impedir dupla reserva concorrente,
    -- inclusive quando o serviço aceita qualquer profissional.
    PERFORM pg_advisory_xact_lock(hashtext(NEW.estabelecimento_id::text));
    IF EXISTS (
      SELECT 1 FROM public.agendamentos a
      WHERE a.estabelecimento_id = NEW.estabelecimento_id
        AND a.id IS DISTINCT FROM NEW.id
        AND a.status <> 'cancelado'
        AND NEW.inicio < a.fim AND NEW.fim > a.inicio
        AND (
          NEW.profissional_id IS NULL
          OR a.profissional_id IS NULL
          OR a.profissional_id = NEW.profissional_id
        )
    ) THEN
      RAISE EXCEPTION 'CONFLITO_HORARIO_AGENDAMENTO';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validar_agendamento() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_agendamento() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_validar_agendamento ON public.agendamentos;
CREATE TRIGGER trg_validar_agendamento
  BEFORE INSERT OR UPDATE
  ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.validar_agendamento();

-- Auditoria específica da agenda, mantendo cliente e profissional vinculados ao evento.
CREATE OR REPLACE FUNCTION public.registrar_auditoria_agendamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $
DECLARE eid uuid; ent uuid; pid uuid; cid uuid; det jsonb;
BEGIN
  IF TG_OP='DELETE' THEN
    eid:=OLD.estabelecimento_id; ent:=OLD.id; pid:=OLD.profissional_id; cid:=OLD.cliente_id;
  ELSE
    eid:=NEW.estabelecimento_id; ent:=NEW.id; pid:=NEW.profissional_id; cid:=NEW.cliente_id;
  END IF;
  det:=jsonb_build_object('operation',lower(TG_OP),'profissional_id',pid,'cliente_id',cid,'agenda',true);
  INSERT INTO public.auditoria_admin(estabelecimento_id,ator_id,profissional_id,cliente_id,evento,entidade,entidade_id,detalhes)
  VALUES(eid,auth.uid(),pid,cid,lower(TG_OP),'agendamentos',ent,det);
  RETURN COALESCE(NEW,OLD);
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_auditoria_agendamento() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_auditoria_agendamento() TO authenticated, service_role;
DROP TRIGGER IF EXISTS trg_auditoria_agendamentos ON public.agendamentos;
CREATE TRIGGER trg_auditoria_agendamentos
  AFTER INSERT OR UPDATE OR DELETE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria_agendamento();
