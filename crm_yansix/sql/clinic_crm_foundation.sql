-- YANSIX Clinic CRM — fundação isolada do CRM comercial existente.
-- Aplicar apenas no projeto Supabase yansix-crm (zxeupenncextzrqgthqx).
-- Não reutiliza nem altera as tabelas clientes/negociacoes do CRM comercial.
create extension if not exists pgcrypto;

create table if not exists public.clinic_crm_clinics (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 2 and 160),
 segment text not null default 'medical' check (segment in ('medical','dental','mixed')),
 timezone text not null default 'America/Sao_Paulo',
 active boolean not null default true,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.clinic_crm_members (
 id uuid primary key default gen_random_uuid(),
 clinic_id uuid not null references public.clinic_crm_clinics(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','admin','manager','receptionist','professional','commercial','finance')),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique (clinic_id,user_id)
);
create table if not exists public.clinic_crm_contacts (
 id uuid primary key default gen_random_uuid(),
 clinic_id uuid not null references public.clinic_crm_clinics(id) on delete cascade,
 contact_type text not null default 'lead' check (contact_type in ('lead','patient','referrer')),
 full_name text not null check (length(trim(full_name)) between 1 and 200),
 phone text, whatsapp text, email text, source text,
 status text not null default 'new' check (status in ('new','contacted','qualified','scheduled','active','inactive','lost')),
 assigned_to uuid references auth.users(id) on delete set null,
 marketing_consent boolean not null default false,
 consent_recorded_at timestamptz,
 next_follow_up_at timestamptz,
 tags text[] not null default '{}',
 administrative_notes text,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (clinic_id,id)
);
create index if not exists clinic_crm_contacts_tenant_status_idx on public.clinic_crm_contacts(clinic_id,status,created_at desc);
create index if not exists clinic_crm_contacts_followup_idx on public.clinic_crm_contacts(clinic_id,next_follow_up_at) where next_follow_up_at is not null;

create table if not exists public.clinic_crm_opportunities (
 id uuid primary key default gen_random_uuid(),
 clinic_id uuid not null references public.clinic_crm_clinics(id) on delete cascade,
 contact_id uuid not null,
 title text not null, service_label text,
 stage text not null default 'new' check (stage in ('new','contacted','evaluation','scheduled','proposal','won','lost')),
 estimated_value numeric(12,2) not null default 0 check (estimated_value >= 0),
 loss_reason text, assigned_to uuid references auth.users(id) on delete set null,
 expected_close_date date, created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint clinic_crm_opportunities_contact_tenant_fkey foreign key (clinic_id,contact_id) references public.clinic_crm_contacts(clinic_id,id) on delete cascade,
 check (stage <> 'lost' or loss_reason is not null)
);
create index if not exists clinic_crm_opportunities_tenant_stage_idx on public.clinic_crm_opportunities(clinic_id,stage,created_at desc);

create table if not exists public.clinic_crm_appointments (
 id uuid primary key default gen_random_uuid(),
 clinic_id uuid not null references public.clinic_crm_clinics(id) on delete cascade,
 contact_id uuid not null,
 professional_id uuid references auth.users(id) on delete set null,
 service_label text, starts_at timestamptz not null, ends_at timestamptz not null,
 status text not null default 'pending' check (status in ('pending','confirmed','checked_in','completed','cancelled','no_show','rescheduled')),
 location_label text, administrative_notes text,
 reminder_status text not null default 'not_sent' check (reminder_status in ('not_sent','queued','sent','failed','confirmed')),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint clinic_crm_appointments_contact_tenant_fkey foreign key (clinic_id,contact_id) references public.clinic_crm_contacts(clinic_id,id) on delete cascade,
 check (ends_at > starts_at),
 unique (clinic_id,id)
);
create index if not exists clinic_crm_appointments_tenant_start_idx on public.clinic_crm_appointments(clinic_id,starts_at);
create index if not exists clinic_crm_appointments_professional_idx on public.clinic_crm_appointments(clinic_id,professional_id,starts_at);

create table if not exists public.clinic_crm_interactions (
 id uuid primary key default gen_random_uuid(),
 clinic_id uuid not null references public.clinic_crm_clinics(id) on delete cascade,
 contact_id uuid not null,
 channel text not null check (channel in ('phone','whatsapp','email','in_person','website','other')),
 direction text not null default 'outbound' check (direction in ('inbound','outbound','internal')),
 summary text not null, outcome text, occurred_at timestamptz not null default now(),
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 constraint clinic_crm_interactions_contact_tenant_fkey foreign key (clinic_id,contact_id) references public.clinic_crm_contacts(clinic_id,id) on delete cascade
);
create index if not exists clinic_crm_interactions_contact_idx on public.clinic_crm_interactions(clinic_id,contact_id,occurred_at desc);

create table if not exists public.clinic_crm_tasks (
 id uuid primary key default gen_random_uuid(),
 clinic_id uuid not null references public.clinic_crm_clinics(id) on delete cascade,
 contact_id uuid, appointment_id uuid,
 title text not null, due_at timestamptz,
 status text not null default 'pending' check (status in ('pending','in_progress','completed','cancelled')),
 priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
 assigned_to uuid references auth.users(id) on delete set null, completed_at timestamptz,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint clinic_crm_tasks_contact_tenant_fkey foreign key (clinic_id,contact_id) references public.clinic_crm_contacts(clinic_id,id) on delete cascade,
 constraint clinic_crm_tasks_appointment_tenant_fkey foreign key (clinic_id,appointment_id) references public.clinic_crm_appointments(clinic_id,id) on delete cascade
);
create index if not exists clinic_crm_tasks_tenant_due_idx on public.clinic_crm_tasks(clinic_id,status,due_at);

create table if not exists public.clinic_crm_audit_events (
 id uuid primary key default gen_random_uuid(),
 clinic_id uuid not null references public.clinic_crm_clinics(id) on delete cascade,
 actor_user_id uuid references auth.users(id) on delete set null,
 action text not null, entity_type text not null, entity_id uuid,
 details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists clinic_crm_audit_tenant_time_idx on public.clinic_crm_audit_events(clinic_id,created_at desc);

create or replace function public.clinic_crm_has_access(p_clinic_id uuid,p_roles text[] default null)
returns boolean language sql stable security definer set search_path=public,auth,pg_temp as $$
 select exists(select 1 from public.clinic_crm_members m
 where m.clinic_id=p_clinic_id and m.user_id=auth.uid() and m.active is true
 and (p_roles is null or m.role=any(p_roles)));
$$;
revoke all on function public.clinic_crm_has_access(uuid,text[]) from public,anon;
grant execute on function public.clinic_crm_has_access(uuid,text[]) to authenticated;

create or replace function public.clinic_crm_create_clinic(p_name text,p_segment text default 'medical')
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_clinic_id uuid;
begin
 if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
 if length(trim(coalesce(p_name,'')))<2 then raise exception 'Informe o nome da clínica.'; end if;
 if coalesce(p_segment,'medical') not in ('medical','dental','mixed') then raise exception 'Segmento inválido.'; end if;
 insert into public.clinic_crm_clinics(name,segment,created_by)
 values(trim(p_name),coalesce(p_segment,'medical'),auth.uid()) returning id into v_clinic_id;
 insert into public.clinic_crm_members(clinic_id,user_id,role) values(v_clinic_id,auth.uid(),'owner');
 return v_clinic_id;
end; $$;
revoke all on function public.clinic_crm_create_clinic(text,text) from public,anon;
grant execute on function public.clinic_crm_create_clinic(text,text) to authenticated;

alter table public.clinic_crm_clinics enable row level security;
alter table public.clinic_crm_members enable row level security;
alter table public.clinic_crm_contacts enable row level security;
alter table public.clinic_crm_opportunities enable row level security;
alter table public.clinic_crm_appointments enable row level security;
alter table public.clinic_crm_interactions enable row level security;
alter table public.clinic_crm_tasks enable row level security;
alter table public.clinic_crm_audit_events enable row level security;

drop policy if exists clinic_crm_clinics_select on public.clinic_crm_clinics;
create policy clinic_crm_clinics_select on public.clinic_crm_clinics for select to authenticated using(public.clinic_crm_has_access(id));
drop policy if exists clinic_crm_clinics_update on public.clinic_crm_clinics;
create policy clinic_crm_clinics_update on public.clinic_crm_clinics for update to authenticated using(public.clinic_crm_has_access(id,array['owner','admin'])) with check(public.clinic_crm_has_access(id,array['owner','admin']));

drop policy if exists clinic_crm_members_select on public.clinic_crm_members;
create policy clinic_crm_members_select on public.clinic_crm_members for select to authenticated using(user_id=auth.uid() or public.clinic_crm_has_access(clinic_id,array['owner','admin','manager']));
drop policy if exists clinic_crm_members_insert on public.clinic_crm_members;
create policy clinic_crm_members_insert on public.clinic_crm_members for insert to authenticated with check(public.clinic_crm_has_access(clinic_id,array['owner','admin']));
drop policy if exists clinic_crm_members_update on public.clinic_crm_members;
create policy clinic_crm_members_update on public.clinic_crm_members for update to authenticated using(public.clinic_crm_has_access(clinic_id,array['owner','admin'])) with check(public.clinic_crm_has_access(clinic_id,array['owner','admin']));
drop policy if exists clinic_crm_members_delete on public.clinic_crm_members;
create policy clinic_crm_members_delete on public.clinic_crm_members for delete to authenticated using(public.clinic_crm_has_access(clinic_id,array['owner','admin']) and user_id<>auth.uid());

do $$ declare t text; begin
 foreach t in array array['clinic_crm_contacts','clinic_crm_opportunities','clinic_crm_appointments','clinic_crm_interactions','clinic_crm_tasks'] loop
  execute format('drop policy if exists %I on public.%I',t||'_tenant_access',t);
  execute format('create policy %I on public.%I for all to authenticated using(public.clinic_crm_has_access(clinic_id)) with check(public.clinic_crm_has_access(clinic_id))',t||'_tenant_access',t);
 end loop;
end $$;

drop policy if exists clinic_crm_audit_select on public.clinic_crm_audit_events;
create policy clinic_crm_audit_select on public.clinic_crm_audit_events for select to authenticated using(public.clinic_crm_has_access(clinic_id,array['owner','admin','manager']));
drop policy if exists clinic_crm_audit_insert on public.clinic_crm_audit_events;
create policy clinic_crm_audit_insert on public.clinic_crm_audit_events for insert to authenticated with check(public.clinic_crm_has_access(clinic_id) and (actor_user_id is null or actor_user_id=auth.uid()));

grant select,insert,update,delete on public.clinic_crm_clinics,public.clinic_crm_members,public.clinic_crm_contacts,
 public.clinic_crm_opportunities,public.clinic_crm_appointments,public.clinic_crm_interactions,public.clinic_crm_tasks,
 public.clinic_crm_audit_events to authenticated;
revoke all on public.clinic_crm_clinics,public.clinic_crm_members,public.clinic_crm_contacts,public.clinic_crm_opportunities,
 public.clinic_crm_appointments,public.clinic_crm_interactions,public.clinic_crm_tasks,public.clinic_crm_audit_events from anon;
