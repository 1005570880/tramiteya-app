import { createClient } from '@supabase/supabase-js';

let admin: ReturnType<typeof createClient> | null = null;

export function getSupabaseServer() {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase service not configured (SUPABASE_SERVICE_ROLE_KEY missing)');
  }
  admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  return admin;
}

export async function getUserFromAccessToken(token: string) {
  const supabase = getSupabaseServer();
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) throw error;
    return data.user || null;
  } catch (e) {
    return null;
  }
}
