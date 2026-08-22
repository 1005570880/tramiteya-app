-- TrámiteYa Phase 6.4: production persistence + RLS
create table if not exists public.procedure_instances (
  id text primary key,
  user_id uuid,
  procedure_id text,
  procedure_slug text not null,
  status text not null default 'in_progress',
  answers jsonb not null default '{}'::jsonb,
  document jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.procedure_instances enable row level security;
alter table public.documents enable row level security;

create index if not exists procedure_instances_user_id_idx on public.procedure_instances(user_id);
create index if not exists procedure_instances_updated_at_idx on public.procedure_instances(updated_at desc);

-- Browser clients can only access their own records. Server-side service-role
-- operations remain available for API routes and are not restricted by RLS.
drop policy if exists "instances_select_own" on public.procedure_instances;
drop policy if exists "instances_insert_own" on public.procedure_instances;
drop policy if exists "instances_update_own" on public.procedure_instances;
drop policy if exists "instances_delete_own" on public.procedure_instances;
create policy "instances_select_own" on public.procedure_instances for select using (auth.uid() = user_id);
create policy "instances_insert_own" on public.procedure_instances for insert with check (auth.uid() = user_id);
create policy "instances_update_own" on public.procedure_instances for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "instances_delete_own" on public.procedure_instances for delete using (auth.uid() = user_id);

drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own" on public.documents for select using (
  exists (select 1 from public.procedure_instances pi where pi.id = documents.instance_id and pi.user_id = auth.uid())
);

-- Keep document writes server-side through the service role/API boundary.
