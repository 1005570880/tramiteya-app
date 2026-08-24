-- TrámiteYa — Bootstrap completo de Supabase
-- Ejecutar una sola vez en Supabase SQL Editor sobre un proyecto nuevo.
-- Incluye esquema base, documentos, instancias, pagos, checkout invitado,
-- idempotencia y RLS. Es idempotente para tablas/columnas/índices/policies.

create extension if not exists pgcrypto;

-- ============================================================
-- 1. Catálogo de trámites
-- ============================================================
create table if not exists public.procedures (
  id text primary key,
  slug text unique not null,
  title text not null,
  description text,
  category text,
  estimated_time text,
  available boolean not null default true,
  meta jsonb not null default '{}'::jsonb
);

-- ============================================================
-- 2. Instancias de trámite
-- ============================================================
create table if not exists public.procedure_instances (
  id text primary key,
  user_id uuid null references auth.users(id) on delete set null,
  procedure_id text null references public.procedures(id) on delete set null,
  procedure_slug text not null,
  status text not null default 'in_progress',
  answers jsonb not null default '{}'::jsonb,
  document jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists procedure_instances_user_id_idx on public.procedure_instances(user_id);
create index if not exists procedure_instances_updated_at_idx on public.procedure_instances(updated_at desc);

-- ============================================================
-- 3. Documentos
-- ============================================================
create table if not exists public.documents (
  id text primary key,
  title text not null,
  procedure_id text null,
  instance_id text null references public.procedure_instances(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create index if not exists documents_instance_id_idx on public.documents(instance_id);
create index if not exists documents_created_at_idx on public.documents(created_at);

-- Versionado documental del esquema histórico.
create table if not exists public.document_versions (
  id text primary key,
  document_id text references public.documents(id) on delete cascade,
  version_number integer not null default 1,
  content text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 4. Pagos
-- ============================================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  procedure_id text not null,
  user_id uuid null references auth.users(id) on delete set null,
  document_version_id text null,
  amount integer not null default 0 check (amount >= 0),
  currency text not null default 'COP',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  provider text not null default 'mock',
  provider_reference text null,
  metadata jsonb not null default '{}'::jsonb,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  guest_access_token text null,
  guest_email text null,
  idempotency_key text null
);

create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists payments_procedure_id_idx on public.payments(procedure_id);
create index if not exists payments_document_version_id_idx on public.payments(document_version_id);
create index if not exists payments_status_idx on public.payments(status);
create index if not exists payments_provider_reference_idx on public.payments(provider_reference);
create index if not exists payments_guest_email_idx on public.payments(guest_email);
create unique index if not exists payments_guest_access_token_uidx on public.payments(guest_access_token) where guest_access_token is not null;
create unique index if not exists payments_user_idempotency_key_uidx on public.payments(user_id, idempotency_key) where user_id is not null and idempotency_key is not null;

-- ============================================================
-- 5. RLS
-- ============================================================
alter table public.procedures enable row level security;
alter table public.procedure_instances enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.payments enable row level security;

-- Catálogo público: lectura de trámites disponibles.
drop policy if exists "procedures_public_select" on public.procedures;
create policy "procedures_public_select" on public.procedures
for select using (available = true);

-- Instancias: solo el propietario desde navegador. Las rutas server-side usan service role.
drop policy if exists "instances_select_own" on public.procedure_instances;
create policy "instances_select_own" on public.procedure_instances
for select using (auth.uid() = user_id);

drop policy if exists "instances_insert_own" on public.procedure_instances;
create policy "instances_insert_own" on public.procedure_instances
for insert with check (auth.uid() = user_id);

drop policy if exists "instances_update_own" on public.procedure_instances;
create policy "instances_update_own" on public.procedure_instances
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "instances_delete_own" on public.procedure_instances;
create policy "instances_delete_own" on public.procedure_instances
for delete using (auth.uid() = user_id);

-- Documentos: lectura del propietario. Las escrituras se realizan por API/service role.
drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own" on public.documents
for select using (
  exists (
    select 1 from public.procedure_instances pi
    where pi.id = documents.instance_id
      and pi.user_id = auth.uid()
  )
);

-- Versiones: lectura cuando el documento pertenece al usuario autenticado.
drop policy if exists "document_versions_select_own" on public.document_versions;
create policy "document_versions_select_own" on public.document_versions
for select using (
  exists (
    select 1 from public.documents d
    join public.procedure_instances pi on pi.id = d.instance_id
    where d.id = document_versions.document_id
      and pi.user_id = auth.uid()
  )
);

-- Pagos: los usuarios autenticados solo ven sus propios pagos.
drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
for select using (auth.uid() = user_id);

drop policy if exists "payments_insert_own" on public.payments;
create policy "payments_insert_own" on public.payments
for insert with check (auth.uid() = user_id);

drop policy if exists "payments_update_own" on public.payments;
create policy "payments_update_own" on public.payments
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Nunca se exponen pagos invitados al navegador mediante RLS.
-- El checkout invitado y la descarga utilizan exclusivamente service role.

-- ============================================================
-- 6. updated_at de pagos
-- ============================================================
create or replace function public.set_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_payments_updated_at();

-- ============================================================
-- 7. Catálogo inicial usado por TrámiteYa
-- ============================================================
insert into public.procedures (id, slug, title, description, category, estimated_time, available, meta)
values
('derecho-peticion', 'derecho-de-peticion', 'Derecho de petición', 'Solicitud escrita dirigida a una entidad pública o privada para pedir información o reclamar derechos.', 'Administrativo', '15 minutos', true, '{}'::jsonb),
('accion-de-tutela', 'accion-de-tutela', 'Acción de tutela', 'Protección inmediata de derechos constitucionales cuando están siendo vulnerados.', 'Constitucional', '30 minutos', false, '{}'::jsonb),
('reclamacion-laboral', 'reclamacion-laboral', 'Reclamación laboral', 'Reclamo ante el empleador por incumplimientos laborales.', 'Laboral', '20 minutos', true, '{}'::jsonb),
('contrato-arrendamiento', 'contrato-de-arrendamiento', 'Contrato de arrendamiento', 'Contrato para formalizar el arrendamiento de un inmueble o local comercial.', 'Civil', '25 minutos', true, '{}'::jsonb)
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  estimated_time = excluded.estimated_time,
  available = excluded.available,
  meta = excluded.meta;

-- ============================================================
-- Verificación rápida
-- ============================================================
select 'procedures' as table_name, count(*) as rows from public.procedures
union all
select 'procedure_instances', count(*) from public.procedure_instances
union all
select 'documents', count(*) from public.documents
union all
select 'document_versions', count(*) from public.document_versions
union all
select 'payments', count(*) from public.payments;
