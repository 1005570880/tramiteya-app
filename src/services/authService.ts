import { getSupabaseBrowser } from '../lib/supabaseBrowserClient';

function requireSupabase() {
  const supabase = getSupabaseBrowser();
  if (!supabase) {
    throw new Error('Supabase no está configurado.');
  }
  return supabase;
}

export async function signUpWithEmail(email: string, password: string) {
  const supabase = requireSupabase();
  return supabase.auth.signUp({ email, password });
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = requireSupabase();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const supabase = requireSupabase();
  return supabase.auth.signOut();
}

export async function getSession() {
  const supabase = requireSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session;
}
