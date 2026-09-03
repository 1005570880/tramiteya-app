import { NextResponse } from 'next/server';
import { getSupabaseServer, getUserFromAccessToken } from '../../../lib/supabaseServerClient';
import { getGuestAccessToken, hashGuestAccessToken } from '../../../lib/guestAccess';

type PaymentRow = {
  id: string;
  status: string;
  amount: number | null;
  currency: string | null;
  procedure_id: string;
  document_version_id: string | null;
  provider: string | null;
  created_at: string;
  approved_at: string | null;
  metadata: Record<string, unknown> | null;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const procedureId = String(url.searchParams.get('procedureId') || '');
    const documentVersionId = String(url.searchParams.get('documentVersionId') || '');
    const instanceId = String(url.searchParams.get('instanceId') || '');
    if (!procedureId) return NextResponse.json({ error: 'procedureId es requerido.' }, { status: 400 });

    const authorization = request.headers.get('authorization') || '';
    const token = authorization.replace(/^Bearer\s+/i, '').trim();
    const user = token ? await getUserFromAccessToken(token) : null;
    const guestToken = user ? '' : getGuestAccessToken(request) || instanceId || documentVersionId;
    if (!user && !guestToken) return NextResponse.json({ error: 'Autenticación o token de acceso requerido.' }, { status: 401 });

    const supabase = getSupabaseServer();
    let query = supabase.from('payments')
      .select('id,status,amount,currency,procedure_id,document_version_id,provider,created_at,approved_at,metadata')
      .eq('procedure_id', procedureId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1);

    if (documentVersionId) query = query.eq('document_version_id', documentVersionId);
    if (instanceId) query = query.contains('metadata', { instanceId });
    if (user) query = query.eq('user_id', user.id);
    else query = query.contains('metadata', { guestAccessTokenHash: hashGuestAccessToken(guestToken) });

    const { data, error } = await query.maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Supabase no tiene un tipo Database explícito en este cliente, por lo que
    // TypeScript puede inferir `data` como `never` al encadenar filtros.
    // El SELECT anterior define exactamente la forma que consumimos aquí.
    const payment = data as PaymentRow | null;

    return NextResponse.json({
      approved: Boolean(payment),
      payment,
      documentVersionId: payment?.document_version_id || null,
      guest: Boolean(guestToken),
    });
  } catch {
    return NextResponse.json({ error: 'No fue posible consultar el estado del pago.' }, { status: 400 });
  }
}
