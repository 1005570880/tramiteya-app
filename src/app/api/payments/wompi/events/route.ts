import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseServer } from '../../../../../lib/supabaseServerClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type WompiEvent = {
  event?: string;
  environment?: string;
  data?: Record<string, unknown>;
  signature?: { properties?: string[]; checksum?: string };
  timestamp?: number;
};

type PaymentRecord = {
  id: string;
  amount: number | string;
  currency: string;
  status: string | null;
  metadata: Record<string, unknown> | null;
  provider_reference: string;
  provider: string;
};

function getPathValue(root: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) return (current as Record<string, unknown>)[key];
    return undefined;
  }, root);
}

function safeEqualHex(a: string, b: string) {
  const left = Buffer.from(a.trim().toLowerCase(), 'utf8');
  const right = Buffer.from(b.trim().toLowerCase(), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyEventSignature(event: WompiEvent, secret: string, headerChecksum: string | null) {
  const properties = event.signature?.properties;
  const timestamp = event.timestamp;
  if (!Array.isArray(properties) || typeof timestamp !== 'number') return false;
  const values = properties.map((property) => getPathValue(event.data, property));
  if (values.some((value) => value === undefined || value === null)) return false;
  const payload = `${values.map((value) => String(value)).join('')}${timestamp}${secret}`;
  const calculated = crypto.createHash('sha256').update(payload).digest('hex');
  const received = headerChecksum || event.signature?.checksum || '';
  return Boolean(received) && safeEqualHex(calculated, received);
}

export async function POST(request: Request) {
  try {
    const secret = process.env.WOMPI_EVENTS_SECRET;
    if (!secret) return NextResponse.json({ error: 'Wompi events secret no configurado.' }, { status: 503 });

    const event = (await request.json()) as WompiEvent;
    if (!verifyEventSignature(event, secret, request.headers.get('x-event-checksum'))) {
      return NextResponse.json({ error: 'Firma de evento inválida.' }, { status: 401 });
    }
    if (event.event !== 'transaction.updated') return NextResponse.json({ received: true });

    const transaction = (event.data?.transaction || {}) as Record<string, unknown>;
    const reference = String(transaction.reference || '').trim();
    const transactionId = String(transaction.id || '').trim();
    const status = String(transaction.status || '').toLowerCase();
    const amountInCents = Number(transaction.amount_in_cents ?? transaction.amountInCents);
    const currency = String(transaction.currency || '').trim().toUpperCase();

    if (!reference || !transactionId || !status || !Number.isFinite(amountInCents) || !currency) {
      return NextResponse.json({ error: 'Evento de transacción incompleto.' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error: paymentError } = await supabase
      .from('payments')
      .select('id,amount,currency,status,metadata,provider_reference,provider')
      .eq('provider', 'wompi')
      .eq('provider_reference', reference)
      .maybeSingle();

    if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 500 });
    if (!data) return NextResponse.json({ received: true, ignored: 'unknown_reference' });

    const payment = data as unknown as PaymentRecord;
    const expectedCents = Number(payment.amount) * 100;
    if (!Number.isFinite(expectedCents) || expectedCents !== amountInCents || String(payment.currency).toUpperCase() !== currency) {
      return NextResponse.json({ error: 'Monto o moneda del evento no coinciden con el pago.' }, { status: 409 });
    }

    const approved = status === 'approved';
    const metadata = {
      ...(payment.metadata && typeof payment.metadata === 'object' ? payment.metadata : {}),
      wompi: { transactionId, status: String(transaction.status), amountInCents, currency, environment: event.environment || null, updatedAt: new Date().toISOString() },
    };

    const { error: updateError } = await supabase.from('payments').update({
      status,
      approved_at: approved ? new Date().toISOString() : null,
      metadata,
    }).eq('id', payment.id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ received: true, paymentId: payment.id, status });
  } catch {
    return NextResponse.json({ error: 'No fue posible procesar el evento de Wompi.' }, { status: 400 });
  }
}
