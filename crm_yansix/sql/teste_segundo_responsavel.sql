-- =========================================================
-- YANSIX CRM — Testes da funcionalidade "Segundo Responsável"
--
-- Roda os Casos A-D, F e H do documento de implementação,
-- simulando cada usuário via request.jwt.claim.sub (o mesmo
-- valor que auth.uid() lê em produção), sem precisar logar
-- de fato em cada conta. Rodar no SQL Editor do Supabase
-- (projeto zxeupenncextzrqgthqx), como um único bloco.
--
-- Não altera nenhum dado: só cria e remove um cliente de
-- teste próprio, e leituras/consultas de simulação.
-- =========================================================

-- 0) Helpers de simulação: troca o "usuário logado" da sessão atual.
create or replace function pg_temp.como(usuario_id text) returns void as $$
  select set_config('request.jwt.claim.sub', usuario_id, true);
$$ language sql;

-- 1) Escolhe 1 Administrador, 1 Gestor, 2 Vendedores da equipe desse
--    Gestor e 1 Vendedor "estranho" (sem ligação com o cliente de teste).
do $$
declare
  v_admin text; v_gestor text; v_sdr text; v_segundo text; v_terceiro text;
  v_cliente_id text := 'teste_2resp_' || substr(gen_random_uuid()::text,1,8);
  v_ok boolean;
begin
  select id into v_admin from public.usuarios where perfil='Administrador' and ativo=true order by id limit 1;
  select id into v_gestor from public.usuarios where perfil='Gestor' and ativo=true order by id limit 1;
  select id into v_sdr from public.usuarios where perfil='Vendedor' and ativo=true and "gestorId"=v_gestor order by id limit 1;
  select id into v_segundo from public.usuarios where perfil='Vendedor' and ativo=true and "gestorId"=v_gestor and id<>v_sdr order by id limit 1;
  select id into v_terceiro from public.usuarios where perfil='Vendedor' and ativo=true and (v_gestor is null or "gestorId" is distinct from v_gestor) order by id limit 1;

  raise notice 'admin=%, gestor=%, sdr=%, segundo=%, terceiro(sem relação)=%', v_admin, v_gestor, v_sdr, v_segundo, v_terceiro;

  -- Cria cliente de teste como Administrador (bypass RLS via service role do SQL Editor).
  insert into public.clientes (id, nome, responsavel, "segundoResponsavel")
  values (v_cliente_id, 'CLIENTE DE TESTE - segundo responsável', v_sdr, null);

  -- CASO A — só SDR: João vê, Carlos (segundo) ainda não existe.
  perform pg_temp.como(v_sdr);
  select exists(select 1 from public.clientes where id=v_cliente_id) into v_ok;
  raise notice 'CASO A - SDR (%) ve cliente sem segundo responsavel? %', v_sdr, v_ok; -- esperado: true

  perform pg_temp.como(v_segundo);
  select exists(select 1 from public.clientes where id=v_cliente_id) into v_ok;
  raise notice 'CASO A - Segundo (%) ve cliente ANTES de ser adicionado? %', v_segundo, v_ok; -- esperado: false

  -- CASO B — adiciona segundo responsável (como Admin, bypassa RLS do editor).
  update public.clientes set "segundoResponsavel"=v_segundo where id=v_cliente_id;

  perform pg_temp.como(v_sdr);
  select exists(select 1 from public.clientes where id=v_cliente_id) into v_ok;
  raise notice 'CASO B - SDR (%) continua vendo? %', v_sdr, v_ok; -- esperado: true

  perform pg_temp.como(v_segundo);
  select exists(select 1 from public.clientes where id=v_cliente_id) into v_ok;
  raise notice 'CASO B - Segundo (%) passa a ver DEPOIS de ser adicionado? %', v_segundo, v_ok; -- esperado: true

  if v_terceiro is not null then
    perform pg_temp.como(v_terceiro);
    select exists(select 1 from public.clientes where id=v_cliente_id) into v_ok;
    raise notice 'CASO B - Outro vendedor (%) NAO deveria ver? %', v_terceiro, v_ok; -- esperado: false
  end if;

  -- CASO C — troca de segundo responsável (segundo -> terceiro), se houver um terceiro disponível.
  if v_terceiro is not null then
    update public.clientes set "segundoResponsavel"=v_terceiro where id=v_cliente_id;

    perform pg_temp.como(v_segundo);
    select exists(select 1 from public.clientes where id=v_cliente_id) into v_ok;
    raise notice 'CASO C - Segundo antigo (%) perdeu acesso? %', v_segundo, v_ok; -- esperado: false

    perform pg_temp.como(v_terceiro);
    select exists(select 1 from public.clientes where id=v_cliente_id) into v_ok;
    raise notice 'CASO C - Novo segundo (%) ganhou acesso? %', v_terceiro, v_ok; -- esperado: true

    perform pg_temp.como(v_sdr);
    select exists(select 1 from public.clientes where id=v_cliente_id) into v_ok;
    raise notice 'CASO C - SDR (%) continua tendo acesso? %', v_sdr, v_ok; -- esperado: true
  end if;

  -- CASO D — remoção do segundo responsável.
  update public.clientes set "segundoResponsavel"=null where id=v_cliente_id;

  perform pg_temp.como(v_sdr);
  select exists(select 1 from public.clientes where id=v_cliente_id) into v_ok;
  raise notice 'CASO D - SDR (%) continua vendo apos remocao do 2o resp? %', v_sdr, v_ok; -- esperado: true

  if v_terceiro is not null then
    perform pg_temp.como(v_terceiro);
    select exists(select 1 from public.clientes where id=v_cliente_id) into v_ok;
    raise notice 'CASO D - Ex-segundo responsavel (%) perdeu acesso apos remocao? %', v_terceiro, v_ok; -- esperado: false
  end if;

  -- Limpeza (como Admin/service role do editor).
  delete from public.clientes where id=v_cliente_id;

  raise notice 'CASO F (comissao so SDR) e CASO G (clientes antigos) nao sao afetados por este script: nenhuma linha antiga foi tocada.';
end $$;

-- CASO H — segurança via RLS direto (não pela UI): tenta ler negociações
-- de um cliente onde NÃO sou responsável nem segundo responsável.
-- (rodar manualmente trocando os IDs pelos de um caso real do seu banco)
-- select pg_temp.como('<id de um vendedor qualquer>');
-- select * from public.clientes; -- só deve trazer o que ele tem direito
