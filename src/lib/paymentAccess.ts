import { getSupabaseServer } from './supabaseServerClient';
import { hashGuestAccessToken } from './guestAccess';

export async function hasPaidDocumentVersion(userId: string, documentVersionId: string) {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('payments')
    .select('id')
    .eq('user_id', userId)
    .eq('document_version_id', documentVersionId)
    .eq('status', 'approved')
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function hasPaidGuestDocument(accessToken: string, documentVersionId: string) {
  if (!accessToken) return false;
  const supabase = getSupabaseServer();
  const tokenHash = hashGuestAccessToken(accessToken);
  const { data, error } = await supabase
    .from('payments')
    .select('id')
    .eq('document_version_id', documentVersionId)
    .eq('provider', 'wompi')
    .eq('status', 'approved')
    .contains('metadata', { guestAccessTokenHash: tokenHash })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}
