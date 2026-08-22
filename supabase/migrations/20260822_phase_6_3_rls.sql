-- TrámiteYa Phase 6.3 — ownership and RLS
alter table if exists public.documents enable row level security;

create policy "documents_owner_select" on public.documents
for select using (
  instance_id is not null and exists (
    select 1 from public.procedure_instances pi
    where pi.id = documents.instance_id and pi.user_id = auth.uid()
  )
);

create policy "documents_owner_insert" on public.documents
for insert with check (
  instance_id is not null and exists (
    select 1 from public.procedure_instances pi
    where pi.id = documents.instance_id and pi.user_id = auth.uid()
  )
);

-- Server-side service role operations remain available through Supabase service role.
