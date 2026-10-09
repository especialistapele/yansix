-- Rename the appointment status without changing the separate attendance status.
ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_status_check;

UPDATE public.agendamentos
SET status = 'realizado', updated_at = now()
WHERE status = 'concluido';

ALTER TABLE public.agendamentos
  ADD CONSTRAINT agendamentos_status_check
  CHECK (status = ANY (ARRAY['agendado'::text, 'confirmado'::text, 'realizado'::text, 'cancelado'::text, 'faltou'::text]));

CREATE OR REPLACE FUNCTION public.processar_cashback_agendamento(p_agendamento_id uuid, p_usar_cashback boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ag public.agendamentos%ROWTYPE;
  cfg_modo text;
  resultado jsonb;
  role_atual text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTENTICACAO_OBRIGATORIA';
  END IF;

  role_atual := public.minha_role();
  SELECT * INTO ag FROM public.agendamentos WHERE id=p_agendamento_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AGENDAMENTO_NAO_ENCONTRADO'; END IF;

  IF role_atual <> 'admin_master'
     AND ag.estabelecimento_id IS DISTINCT FROM public.meu_estabelecimento_id() THEN
    RAISE EXCEPTION 'ACESSO_UNIDADE_NEGADO';
  END IF;
  IF role_atual IS NULL OR role_atual NOT IN ('admin_master','admin_estabelecimento','profissional') THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA';
  END IF;
  IF role_atual='profissional' AND ag.profissional_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'AGENDAMENTO_DE_OUTRO_PROFISSIONAL';
  END IF;
  IF ag.status <> 'realizado' THEN
    RAISE EXCEPTION 'AGENDAMENTO_PRECISA_ESTAR_REALIZADO';
  END IF;

  IF ag.atendimento_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ja_processado', true,
      'atendimento_id', ag.atendimento_id,
      'resultado', coalesce(ag.cashback_resultado,'{}'::jsonb)
    );
  END IF;

  SELECT agenda_cashback_modo INTO cfg_modo
  FROM public.configuracoes WHERE estabelecimento_id=ag.estabelecimento_id;
  IF cfg_modo IS NULL THEN cfg_modo := 'manual'; END IF;

  IF ag.profissional_id IS NULL THEN
    RAISE EXCEPTION 'SELECIONE_PROFISSIONAL_ANTES_DE_COMPUTAR';
  END IF;

  resultado := public.registrar_atendimento_pontuacao(
    ag.estabelecimento_id,
    ag.cliente_id,
    ag.servico_id,
    ag.profissional_id,
    coalesce(p_usar_cashback,false),
    'Computado pela Agenda ' || ag.id::text
  );

  UPDATE public.agendamentos
  SET atendimento_id=(resultado->>'atendimento_id')::uuid,
      cashback_processado_at=now(),
      cashback_resultado=resultado,
      updated_at=now()
  WHERE id=ag.id;

  RETURN jsonb_build_object(
    'ja_processado', false,
    'modo_configurado', cfg_modo,
    'atendimento_id', resultado->>'atendimento_id',
    'resultado', resultado
  );
END;
$function$;
