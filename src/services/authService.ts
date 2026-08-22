import { getSupabaseBrowser } from '../lib/supabaseBrowserClient';

export async function signUpWithEmail(email: string, password: string) {
  const supabase = getSupabaseBrowser();
  return supabase.auth.signUp({ email, password });
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = getSupabaseBrowser();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const supabase = getSupabaseBrowser();
  return supabase.auth.signOut();
}

export async function getSession() {
  const supabase = getSupabaseBrowser();
  const { data } = await supabase.auth.getSession();
  return data.session;
}
