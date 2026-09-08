-- ============================================================
-- FASE 6.8 — Serviços vinculados a um profissional (ou "qualquer profissional")
-- ============================================================
-- Cada serviço passa a poder ser vinculado a um profissional específico (o profissional
-- que o cadastrou, no caso de cadastro feito por ele) ou ficar como "qualquer profissional"
-- (profissional_id = null), que é o comportamento equivalente ao que já existia antes.
alter table public.servicos add column if not exists profissional_id uuid null;

-- O profissional agora pode cadastrar os próprios serviços, mas só pode vinculá-los a si
-- mesmo (nunca a outro colega, nem deixá-los como "qualquer profissional" — isso continua
-- sendo uma decisão do admin da unidade / admin master).
create policy "servicos_insert_profissional" on public.servicos
  for insert with check (
    minha_role() = 'profissional'
    and estabelecimento_id = meu_estabelecimento_id()
    and profissional_id = auth.uid()
  );

-- E pode editar/ativar/desativar apenas os serviços que ele mesmo cadastrou.
create policy "servicos_update_profissional" on public.servicos
  for update using (
    minha_role() = 'profissional'
    and estabelecimento_id = meu_estabelecimento_id()
    and profissional_id = auth.uid()
  ) with check (
    minha_role() = 'profissional'
    and estabelecimento_id = meu_estabelecimento_id()
    and profissional_id = auth.uid()
  );
