-- Fase 2 — Estabelecimentos: CRUD, dados, aparência e equipe
alter table public.estabelecimentos add column if not exists documento text;
alter table public.estabelecimentos add column if not exists telefone text;
alter table public.estabelecimentos add column if not exists email text;
alter table public.estabelecimentos add column if not exists endereco text;
alter table public.estabelecimentos add column if not exists horario_funcionamento text;
alter table public.estabelecimentos add column if not exists area_atuacao text;
alter table public.estabelecimentos add column if not exists status text not null default 'ativo';
alter table public.estabelecimentos add column if not exists updated_at timestamptz not null default now();
alter table public.estabelecimentos drop constraint if exists estabelecimentos_status_check;
alter table public.estabelecimentos add constraint estabelecimentos_status_check check (status in ('ativo','inativo'));
create index if not exists idx_estabelecimentos_area_status on public.estabelecimentos(area_atuacao,status);
create index if not exists idx_estabelecimentos_nome on public.estabelecimentos(lower(nome));

-- Master e Admin da unidade podem atualizar somente as unidades que administram.
drop policy if exists estabelecimentos_update_hierarquia on public.estabelecimentos;
create policy estabelecimentos_update_hierarquia on public.estabelecimentos for update to authenticated
using (public.is_admin_master() or id=public.meu_estabelecimento_id())
with check (public.is_admin_master() or id=public.meu_estabelecimento_id());

-- Criação direta continua proibida no navegador; novos estabelecimentos são criados pela Edge Function.
drop policy if exists estabelecimentos_insert_master on public.estabelecimentos;
create policy estabelecimentos_insert_master on public.estabelecimentos for insert to authenticated
with check (public.is_admin_master());
