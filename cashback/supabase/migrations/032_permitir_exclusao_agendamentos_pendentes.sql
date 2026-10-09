-- Permite que Master e administradores autorizados excluam apenas agendamentos pendentes.
-- Registros realizados, com atendimento vinculado ou em outros status preservam o histórico.
DROP POLICY IF EXISTS agendamentos_delete_hierarquia ON public.agendamentos;

CREATE POLICY agendamentos_delete_hierarquia
ON public.agendamentos
FOR DELETE
TO authenticated
USING (
  status IN ('agendado', 'confirmado')
  AND atendimento_id IS NULL
  AND (
    is_admin_master()
    OR (
      estabelecimento_id = meu_estabelecimento_id()
      AND minha_role() = 'admin_estabelecimento'
      AND tem_permissao('atendimentos', estabelecimento_id)
    )
  )
);
