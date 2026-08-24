-- TrámiteYa — Guest checkout / compra sin cuenta
-- Permite pagar y descargar un documento sin crear una cuenta previa.
-- Ejecutar esta migración en Supabase antes de activar el checkout invitado en producción.

alter table public.payments
  alter column user_id drop not null;

-- Documents use text IDs (e.g. doc_...), so payment linkage must use the same type.
alter table public.payments
  alter column document_version_id type text using document_version_id::text;

alter table public.payments
  add column if not exists guest_access_token text null;

alter table public.payments
  add column if not exists guest_email text null;

create unique index if not exists payments_guest_access_token_uidx
  on public.payments(guest_access_token)
  where guest_access_token is not null;

create index if not exists payments_guest_email_idx on public.payments(guest_email);

-- Guest rows are accessed only by trusted server-side code using the service role.
-- Do not add public SELECT/INSERT policies for guest payments.
