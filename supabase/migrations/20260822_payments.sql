-- Phase 8 — Motor Transaccional
-- Payments are deliberately independent from provider-specific checkout details.

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  procedure_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_version_id uuid null,
  amount integer not null default 0 check (amount >= 0),
  currency text not null default 'COP',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  provider text not null default 'mock',
  provider_reference text null,
  metadata jsonb not null default '{}'::jsonb,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists payments_procedure_id_idx on public.payments(procedure_id);
create index if not exists payments_document_version_id_idx on public.payments(document_version_id);
create index if not exists payments_status_idx on public.payments(status);

alter table public.payments enable row level security;

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own"
  on public.payments for select
  using (auth.uid() = user_id);

drop policy if exists "payments_insert_own" on public.payments;
create policy "payments_insert_own"
  on public.payments for insert
  with check (auth.uid() = user_id);

-- Updates are intentionally restricted to trusted server-side code.
drop policy if exists "payments_update_own" on public.payments;
create policy "payments_update_own"
  on public.payments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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
