import { getSupabaseServer } from './supabaseServerClient';

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
