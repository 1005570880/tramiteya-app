import { NextResponse } from 'next/server';
import { getSupabaseServer, getUserFromAccessToken } from '@/lib/supabaseServerClient';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const procedureId = String(url.searchParams.get('procedureId') || '');
    const documentVersionId = url.searchParams.get('documentVersionId');
    if (!procedureId) return NextResponse.json({ error: 'procedureId es requerido.' }, { status: 400 });

    const authorization = request.headers.get('authorization') || '';
    const token = authorization.replace(/^Bearer\s+/i, '').trim();
    const user = token ? await getUserFromAccessToken(token) : null;
    if (!user) return NextResponse.json({ error: 'Autenticación requerida.' }, { status: 401 });

    const supabase = getSupabaseServer();
    let query = supabase.from('payments')
      .select('id,status,amount,currency,procedure_id,document_version_id,provider,created_at,approved_at')
      .eq('user_id', user.id)
      .eq('procedure_id', procedureId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1);

    if (documentVersionId) query = query.eq('document_version_id', documentVersionId);

    const { data, error } = await query.maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ approved: Boolean(data), payment: data || null });
  } catch {
    return NextResponse.json({ error: 'No fue posible consultar el estado del pago.' }, { status: 400 });
  }
}
