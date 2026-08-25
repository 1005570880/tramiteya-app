import { createClient } from '@supabase/supabase-js';
let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowser(): ReturnType<typeof createClient> {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // The application intentionally supports a local/file-backed fallback when
  // Supabase environment variables are unavailable. Keep that runtime behavior
  // while exposing a stable client type to TypeScript callers that perform their
  // own null checks before using the client.
  if (!url || !anonKey) return null as unknown as ReturnType<typeof createClient>;
  client = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
}
