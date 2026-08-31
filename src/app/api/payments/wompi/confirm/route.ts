import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../../../lib/supabaseServerClient';
import { getGuestAccessToken, hashGuestAccessToken } from '../../../../../lib/guestAccess';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PaymentRow = {
  id: string;
  user_id: string | null;
  metadata: Record<string, any> | null;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const transactionId = String(body?.transactionId || '').trim();
    const reference = String(body?.reference || '').trim();
    if (!transactionId || !reference) return NextResponse.json({ error: 'Transacción y referencia son obligatorias.' }, { status: 400 });

    const guestToken = getGuestAccessToken(request);
    const supabase = getSupabaseServer();
    const { data: payment, error: paymentError } = await (supabase as any)
      .from('payments')
      .select('*')
      .eq('provider', 'wompi')
      .eq('provider_reference', reference)
      .maybeSingle() as { data: PaymentRow | null; error: { message: string } | null };
    if (paymentError || !payment) return NextResponse.json({ error: 'Pago no encontrado.' }, { status: 404 });

    if (guestToken) {
      const storedHash = String(payment.metadata?.guestAccessTokenHash || '');
      if (!storedHash || storedHash !== hashGuestAccessToken(guestToken)) return NextResponse.json({ error: 'Acceso no autorizado.' }, { status: 403 });
    } else if (payment.user_id) {
      return NextResponse.json({ error: 'Token de acceso requerido.' }, { status: 401 });
    }

    const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;
    if (!publicKey) return NextResponse.json({ error: 'Wompi no está configurado.' }, { status: 503 });
    const apiBase = process.env.WOMPI_API_URL || 'https://production.wompi.co';
    const wompiResponse = await fetch(`${apiBase}/v1/transactions/${encodeURIComponent(transactionId)}`, {
      headers: { Authorization: `Bearer ${publicKey}` },
      cache: 'no-store',
    });
    const wompiData = await wompiResponse.json();
    if (!wompiResponse.ok) return NextResponse.json({ error: 'No fue posible verificar la transacción en Wompi.' }, { status: 502 });

    const transaction = wompiData?.data;
    if (!transaction || transaction.reference !== reference) return NextResponse.json({ error: 'La referencia de la transacción no coincide.' }, { status: 409 });

    const status = String(transaction.status || '').toUpperCase();
    const nextStatus = status === 'APPROVED' ? 'approved' : status === 'DECLINED' || status === 'ERROR' || status === 'VOIDED' ? status.toLowerCase() : 'pending';
    const update: Record<string, any> = {
      status: nextStatus,
      metadata: { ...(payment.metadata || {}), wompiTransactionId: transaction.id, wompiStatus: status },
      updated_at: new Date().toISOString(),
    };
    if (nextStatus === 'approved') update.approved_at = new Date().toISOString();

    const { error: updateError } = await (supabase as any).from('payments').update(update).eq('id', payment.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ approved: nextStatus === 'approved', status: nextStatus, transactionId: transaction.id });
  } catch {
    return NextResponse.json({ error: 'No fue posible confirmar el pago.' }, { status: 400 });
  }
}
