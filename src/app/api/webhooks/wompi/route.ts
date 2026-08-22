import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseServer } from '../../../../lib/supabaseServerClient';

export const dynamic = 'force-dynamic';

function getNestedValue(data: unknown, path: string) {
  return path.split('.').reduce<any>((current, key) => current?.[key], data as any);
}

function safeEqualHex(a: string, b: string) {
  const left = Buffer.from(a.toLowerCase(), 'utf8');
  const right = Buffer.from(b.toLowerCase(), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.WOMPI_EVENTS_SECRET;
    if (!secret) return NextResponse.json({ error: 'Wompi events secret no configurado.' }, { status: 503 });

    const event = await request.json();
    const properties: string[] = Array.isArray(event?.signature?.properties) ? event.signature.properties : [];
    const timestamp = event?.timestamp;
    const receivedChecksum = String(request.headers.get('X-Event-Checksum') || event?.signature?.checksum || '').trim();
    if (!properties.length || timestamp === undefined || !receivedChecksum) return NextResponse.json({ error: 'Firma de evento incompleta.' }, { status: 400 });

    const values = properties.map((property) => String(getNestedValue(event?.data, property) ?? ''));
    const payload = `${values.join('')}${timestamp}${secret}`;
    const calculatedChecksum = crypto.createHash('sha256').update(payload).digest('hex');
    if (!safeEqualHex(calculatedChecksum, receivedChecksum)) return NextResponse.json({ error: 'Firma Wompi inválida.' }, { status: 401 });

    if (event?.environment && event.environment !== 'prod') return NextResponse.json({ ok: true, ignored: true });
    if (event?.event !== 'transaction.updated') return NextResponse.json({ ok: true, ignored: true });

    const transaction = event?.data?.transaction;
    const reference = String(transaction?.reference || '').trim();
    const status = String(transaction?.status || '').trim().toUpperCase();
    const amountInCents = Number(transaction?.amount_in_cents);
    if (!reference || !Number.isFinite(amountInCents)) return NextResponse.json({ error: 'Transacción Wompi incompleta.' }, { status: 400 });

    const supabase = getSupabaseServer();
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id,procedure_id,document_version_id,amount,status,metadata')
      .eq('provider', 'wompi')
      .eq('provider_reference', reference)
      .maybeSingle();
    if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 500 });
    if (!payment) return NextResponse.json({ ok: true, ignored: true, reason: 'payment_not_registered' });

    if (amountInCents !== Number(payment.amount) * 100) return NextResponse.json({ error: 'Monto de la transacción no coincide.' }, { status: 409 });

    const approved = status === 'APPROVED';
    const paymentStatus = approved ? 'approved' : status === 'DECLINED' || status === 'ERROR' || status === 'VOIDED' ? 'rejected' : 'pending';
    const metadata = { ...(payment.metadata || {}), wompi_event: event.event, wompi_transaction_id: transaction.id || null, wompi_status: status, last_event_at: new Date().toISOString() };

    const { error: updateError } = await supabase.from('payments').update({
      status: paymentStatus,
      provider_reference: reference,
      approved_at: approved ? new Date().toISOString() : null,
      metadata,
    }).eq('id', payment.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    if (approved && payment.document_version_id) {
      const { data: document } = await supabase.from('documents').select('id,meta').eq('id', payment.document_version_id).maybeSingle();
      if (document) {
        const nextMeta = { ...(document.meta || {}), payment_status: 'paid', paid_at: new Date().toISOString(), payment_provider: 'wompi', wompi_transaction_id: transaction.id || null };
        const { error: documentError } = await supabase.from('documents').update({ meta: nextMeta }).eq('id', document.id);
        if (documentError) return NextResponse.json({ error: documentError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, status: paymentStatus, activated: approved });
  } catch {
    return NextResponse.json({ error: 'Webhook Wompi inválido.' }, { status: 400 });
  }
}
