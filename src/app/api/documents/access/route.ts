import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../../lib/supabaseServerClient';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const documentVersionId = String(url.searchParams.get('documentVersionId') || '').trim();
    if (!documentVersionId) return NextResponse.json({ error: 'documentVersionId es requerido.' }, { status: 400 });

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('payments')
      .select('id')
      .eq('document_version_id', documentVersionId)
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const paid = Boolean(data);
    return NextResponse.json({ documentVersionId, paid, downloadAllowed: paid });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No fue posible verificar el acceso.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
