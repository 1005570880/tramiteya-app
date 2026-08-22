import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseServer } from '../../../../../lib/supabaseServerClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getPathValue(data: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value && typeof value === 'object' && key in value) return (value as Record<string, unknown>)[key];
    return undefined;
  }, data);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a.toLowerCase(), 'utf8');
  const right = Buffer.from(b.toLowerCase(), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyEventSignature(payload: any, secret: string, headerChecksum: string | null): boolean {
  const properties = Array.isArray(payload?.signature?.properties) ? payload.signature.properties : [];
  const timestamp = payload?.timestamp;
  const checksum = String(headerChecksum || payload?.signature?.checksum || '');
  if (!properties.length || timestamp === undefined || !checksum) return false;
  const values = properties.map((property: unknown) => {
    const value = getPathValue(payload?.data, String(property));
    return value === null || value === undefined ? '' : String(value);
  });
  const input = `${values.join('')}${timestamp}${secret}`;
  const calculated = crypto.createHash('sha256').update(input).digest('hex');
  return safeEqual(calculated, checksum);
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.WOMPI_EVENTS_SECRET;
    if (!secret) return NextResponse.json({ error: 'Wompi events secret is not configured.' }, { status: 503 });
    const payload = await request.json();
    if (!verifyEventSignature(payload, secret, request.headers.get('X-Event-Checksum'))) return NextResponse.json({ error: 'Invalid event signature.' }, { status: 401 });
    if (payload?.event !== 'transaction.updated') return NextResponse.json({ received: true, ignored: true });

    const transaction = payload?.data?.transaction;
    const status = String(transaction?.status || '').toUpperCase();
    const reference = String(transaction?.reference || '').trim();
    const amountInCents = Number(transaction?.amount_in_cents ?? transaction?.amountInCents ?? 0);
    if (!reference || !Number.isFinite(amountInCents)) return NextResponse.json({ error: 'Invalid transaction payload.' }, { status: 400 });

    const supabase = getSupabaseServer();
    const { data: payment, error: paymentError } = await supabase.from('payments').select('id,amount,currency,status,document_version_id,provider,provider_reference,metadata').eq('provider', 'wompi').eq('provider_reference', reference).maybeSingle();
    if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 500 });
    if (!payment) return NextResponse.json({ received: true, ignored: true });

    const expectedCents = Number(payment.amount) * 100;
    if (String(payment.currency || 'COP') !== 'COP' || expectedCents !== amountInCents) return NextResponse.json({ error: 'Transaction amount does not match the stored payment.' }, { status: 409 });

    const transactionId = String(transaction?.id || '');
    const metadata = { ...(payment.metadata || {}), wompi_transaction_id: transactionId || undefined, last_event_status: status, last_event_timestamp: payload.timestamp };

    if (status === 'APPROVED') {
      const { error: updatePaymentError } = await supabase.from('payments').update({ status: 'approved', approved_at: new Date().toISOString(), metadata }).eq('id', payment.id);
      if (updatePaymentError) return NextResponse.json({ error: updatePaymentError.message }, { status: 500 });
      if (payment.document_version_id) {
        const { data: document, error: documentError } = await supabase.from('documents').select('id,meta').eq('id', String(payment.document_version_id)).maybeSingle();
        if (documentError) return NextResponse.json({ error: documentError.message }, { status: 500 });
        if (document) {
          const nextMeta = { ...(document.meta || {}), payment_status: 'paid', paid_at: new Date().toISOString(), payment_id: payment.id, wompi_transaction_id: transactionId };
          const { error: documentUpdateError } = await supabase.from('documents').update({ meta: nextMeta }).eq('id', document.id);
          if (documentUpdateError) return NextResponse.json({ error: documentUpdateError.message }, { status: 500 });
        }
      }
    } else if (status === 'DECLINED' || status === 'ERROR' || status === 'VOIDED') {
      const { error: rejectedError } = await supabase.from('payments').update({ status: 'rejected', metadata }).eq('id', payment.id);
      if (rejectedError) return NextResponse.json({ error: rejectedError.message }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Wompi webhook error', error);
    return NextResponse.json({ error: 'Unable to process Wompi event.' }, { status: 400 });
  }
}
