-- DB schema for TrámiteYa (Postgres / Supabase)

-- users: handled by Supabase Auth (recommended)

CREATE TABLE IF NOT EXISTS procedures (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  estimated_time TEXT,
  available BOOLEAN DEFAULT TRUE,
  meta JSONB
);

CREATE TABLE IF NOT EXISTS procedure_instances (
  id TEXT PRIMARY KEY,
  user_id TEXT, -- reference to auth.users (Supabase)
  procedure_id TEXT REFERENCES procedures(id) ON DELETE SET NULL,
  procedure_slug TEXT,
  status TEXT NOT NULL,
  answers JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  procedure_id TEXT,
  instance_id TEXT REFERENCES procedure_instances(id) ON DELETE CASCADE,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  meta JSONB
);

CREATE TABLE IF NOT EXISTS document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
  version_number INT DEFAULT 1,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
