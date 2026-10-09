-- Segurança: não permitir marcar nem computar um atendimento antes do horário final agendado.
CREATE OR REPLACE FUNCTION public.impedir_realizado_antes_do_fim()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'realizado' AND NEW.fim > now() THEN
    RAISE EXCEPTION 'ATENDIMENTO_AINDA_NAO_TERMINOU';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_impedir_realizado_antes_do_fim ON public.agendamentos;
CREATE TRIGGER trg_impedir_realizado_antes_do_fim
BEFORE INSERT OR UPDATE OF status, fim ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.impedir_realizado_antes_do_fim();

DO $guard$
DECLARE
  f text;
  old_block text;
  new_block text;
BEGIN
  SELECT pg_get_functiondef('public.processar_cashback_agendamento(uuid,boolean)'::regprocedure) INTO f;
  old_block := $old$  IF ag.status <> 'realizado' THEN
    RAISE EXCEPTION 'AGENDAMENTO_PRECISA_ESTAR_REALIZADO';
  END IF;$old$;
  new_block := $new$  IF ag.status <> 'realizado' THEN
    RAISE EXCEPTION 'AGENDAMENTO_PRECISA_ESTAR_REALIZADO';
  END IF;

  IF ag.fim > now() THEN
    RAISE EXCEPTION 'ATENDIMENTO_AINDA_NAO_TERMINOU';
  END IF;$new$;
  IF position(old_block IN f) = 0 THEN
    RAISE EXCEPTION 'Não foi encontrado o bloco de validação do status em processar_cashback_agendamento.';
  END IF;
  EXECUTE replace(f, old_block, new_block);
END
$guard$;
