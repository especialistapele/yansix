-- Corrige "column reference "valor" is ambiguous" ao registrar atendimento.
-- Causa: a função declara a variável local `valor` e depois faz
-- `SELECT ..., valor, ... FROM public.servicos` sem qualificar a coluna,
-- então o Postgres não sabe se "valor" é a variável ou a coluna da tabela
-- (plpgsql.variable_conflict = error, o padrão). Correção: qualificar as
-- colunas do SELECT com o alias da tabela.

CREATE OR REPLACE FUNCTION public.registrar_atendimento_pontuacao(
  p_estabelecimento_id uuid, p_cliente_id uuid, p_servico_id uuid, p_profissional_id uuid DEFAULT NULL,
  p_usar_cashback boolean DEFAULT false, p_observacao text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE aid uuid; pid uuid; valor numeric; pontos integer; cb numeric:=0; saldo numeric:=0; exp date; pont_id uuid; uso numeric:=0; cfg record; cli_est uuid; srv_est uuid; srv_cb numeric; regra text; principal uuid;
BEGIN
  IF public.minha_role() IN ('admin_estabelecimento','profissional') AND p_estabelecimento_id<>public.meu_estabelecimento_id() THEN RAISE EXCEPTION 'ACESSO_UNIDADE_NEGADO'; END IF;
  SELECT c.estabelecimento_id,c.atendimento_regra,c.profissional_principal_id INTO cli_est,regra,principal FROM public.clientes c WHERE c.id=p_cliente_id;
  SELECT s.estabelecimento_id,s.valor,s.cashback_pct INTO srv_est,valor,srv_cb FROM public.servicos s WHERE s.id=p_servico_id AND s.ativo=true;
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
