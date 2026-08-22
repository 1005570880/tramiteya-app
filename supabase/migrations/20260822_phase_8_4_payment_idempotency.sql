-- Phase 8.4 — Prevent duplicate checkout charges/orders on client retries.
-- The key is scoped to the authenticated user and must be supplied by checkout clients.

alter table public.payments
  add column if not exists idempotency_key text null;

create unique index if not exists payments_user_idempotency_key_uidx
  on public.payments(user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists payments_provider_reference_idx
  on public.payments(provider_reference);
