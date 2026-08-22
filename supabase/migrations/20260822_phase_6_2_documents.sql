-- TrámiteYa Phase 6.2
-- Run in Supabase SQL editor after the base schema.
create table if not exists public.documents (
  id text primary key,
  title text not null,
  procedure_id text,
  instance_id text,
  content text not null,
  created_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create index if not exists documents_instance_id_idx on public.documents(instance_id);
create index if not exists documents_created_at_idx on public.documents(created_at);

-- Optional relationship to procedure_instances when that table exists.
-- Keep it nullable so legacy instances remain compatible.
