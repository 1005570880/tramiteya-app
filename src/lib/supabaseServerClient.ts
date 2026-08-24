import { createClient, SupabaseClient } from '@supabase/supabase-js';

let admin: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

export function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) {
    throw new Error('Supabase server credentials are missing');
  }

  // Recreate the singleton if Vercel/runtime provides a refreshed environment.
  if (!admin || cachedUrl !== url || cachedKey !== serviceKey) {
    admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'X-Client-Info': 'tramiteya-server' } },
    });
    cachedUrl = url;
    cachedKey = serviceKey;
  }

  return admin;
}

export async function getUserFromAccessToken(token: string) {
  if (!token) return null;
  const supabase = getSupabaseServer();
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) return null;
    return data.user || null;
  } catch {
    return null;
  }
}
