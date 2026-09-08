-- Fase 3 — Operações de fidelidade
-- Índices e integridade das operações vinculadas ao estabelecimento.
create index if not exists idx_pontuacoes_estabelecimento_created on public.pontuacoes(estabelecimento_id, created_at desc);
create index if not exists idx_pontuacoes_profissional_created on public.pontuacoes(profissional_id, created_at desc);
create index if not exists idx_resgates_estabelecimento_created on public.resgates(estabelecimento_id, created_at desc);
create index if not exists idx_resgates_profissional_created on public.resgates(profissional_id, created_at desc);
create index if not exists idx_premios_estabelecimento_ativo on public.premios(estabelecimento_id, ativo);
create index if not exists idx_niveis_estabelecimento_pontos on public.niveis(estabelecimento_id, pontos_necessarios);

alter table public.pontuacoes drop constraint if exists pontuacoes_estabelecimento_fk;
alter table public.pontuacoes add constraint pontuacoes_estabelecimento_fk foreign key (estabelecimento_id) references public.estabelecimentos(id) on delete cascade;
alter table public.resgates drop constraint if exists resgates_estabelecimento_fk;
alter table public.resgates add constraint resgates_estabelecimento_fk foreign key (estabelecimento_id) references public.estabelecimentos(id) on delete cascade;
alter table public.premios drop constraint if exists premios_estabelecimento_fk;
alter table public.premios add constraint premios_estabelecimento_fk foreign key (estabelecimento_id) references public.estabelecimentos(id) on delete cascade;
alter table public.niveis drop constraint if exists niveis_estabelecimento_fk;
alter table public.niveis add constraint niveis_estabelecimento_fk foreign key (estabelecimento_id) references public.estabelecimentos(id) on delete cascade;
