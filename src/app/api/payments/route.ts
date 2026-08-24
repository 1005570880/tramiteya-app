import { NextResponse } from 'next/server';
import { getSupabaseServer, getUserFromAccessToken } from '../../../lib/supabaseServerClient';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const procedureId = String(url.searchParams.get('procedureId') || '');
    const documentVersionId = url.searchParams.get('documentVersionId');
    const guestAccessToken = String(url.searchParams.get('guestAccessToken') || '').trim();
    if (!procedureId) return NextResponse.json({ error: 'procedureId es requerido.' }, { status: 400 });

    const authorization = request.headers.get('authorization') || '';
    const token = authorization.replace(/^Bearer\s+/i, '').trim();
    const user = token ? await getUserFromAccessToken(token) : null;
    const supabase = getSupabaseServer();

    let query = supabase.from('payments').select('id,status,amount,currency,procedure_id,document_version_id,provider,created_at,approved_at').eq('procedure_id', procedureId).eq('status', 'approved').order('created_at', { ascending: false }).limit(1);
    if (documentVersionId) query = query.eq('document_version_id', documentVersionId);
    if (user) query = query.eq('user_id', user.id);
    else {
      if (!guestAccessToken) return NextResponse.json({ error: 'Acceso de compra requerido.' }, { status: 401 });
      query = query.eq('guest_access_token', guestAccessToken);
    }

    const { data, error } = await query.maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ approved: Boolean(data), payment: data || null });
  } catch {
    return NextResponse.json({ error: 'No fue posible consultar el estado del pago.' }, { status: 400 });
  }
}
