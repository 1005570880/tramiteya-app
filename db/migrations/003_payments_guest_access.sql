-- Payments and passwordless document access for TrámiteYa.
-- Allows a user to generate and pay without creating a Supabase Auth account.

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id TEXT,
  user_id UUID NULL,
  document_version_id TEXT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'COP',
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL,
  provider_reference TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NULL,
  approved_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_document_version_idx ON payments(document_version_id);
CREATE INDEX IF NOT EXISTS payments_user_idx ON payments(user_id);
CREATE INDEX IF NOT EXISTS payments_provider_status_idx ON payments(provider, status);

ALTER TABLE IF EXISTS payments ENABLE ROW LEVEL SECURITY;

-- Server routes use the Supabase service role. No client-side policy grants access.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS guest_access_token_hash TEXT NULL;
CREATE INDEX IF NOT EXISTS documents_guest_token_hash_idx ON documents(guest_access_token_hash);

ALTER TABLE procedure_instances ADD COLUMN IF NOT EXISTS guest_access_token_hash TEXT NULL;
CREATE INDEX IF NOT EXISTS procedure_instances_guest_token_hash_idx ON procedure_instances(guest_access_token_hash);
