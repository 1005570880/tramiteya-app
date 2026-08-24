import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseServer, getUserFromAccessToken } from '../../../../lib/supabaseServerClient';
import { getProcedurePrice } from '../../../../data/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ExistingPayment = { id: string; user_id: string | null; status: string | null; guest_access_token: string | null; guest_email: string | null };
type PaymentPayload = { procedure_id: string; user_id: string | null; document_version_id: string; amount: number; currency: string; status: string; provider: string; provider_reference: string; guest_access_token: string | null; guest_email: string | null; metadata: Record<string, unknown> };

export async function POST(request: NextRequest) {
  try {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const user = token ? await getUserFromAccessToken(token) : null;
    const body = await request.json();
    const procedureId = String(body?.procedureId || '').trim();
    const documentVersionId = String(body?.documentVersionId || '').trim();
    const guestAccessToken = String(body?.guestAccessToken || '').trim();
    const guestEmail = String(body?.guestEmail || '').trim().toLowerCase();
    if (!procedureId || !documentVersionId) return NextResponse.json({ error: 'Trámite y versión de documento son obligatorios.' }, { status: 400 });
    if (!user && guestAccessToken && guestAccessToken.length < 32) return NextResponse.json({ error: 'Token de acceso invitado inválido.' }, { status: 400 });

    const pricing = getProcedurePrice(procedureId);
    if (!pricing) return NextResponse.json({ error: 'Trámite no disponible para compra.' }, { status: 400 });

    const supabase = getSupabaseServer();
    const documentsTable = supabase.from('documents') as unknown as { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: { id: string; instance_id: string | null; procedure_id: string | null; meta: Record<string, unknown> | null } | null; error: { message: string } | null }> } } };
    const { data: document, error: documentError } = await documentsTable.select('id,instance_id,procedure_id,meta').eq('id', documentVersionId).maybeSingle();
    if (documentError || !document) return NextResponse.json({ error: 'Versión de documento no encontrada.' }, { status: 404 });
    if (document.procedure_id && document.procedure_id !== procedureId) return NextResponse.json({ error: 'El documento no corresponde al trámite.' }, { status: 409 });

    const amountInCents = pricing.price * 100;
    const currency = 'COP';
    const reference = `DOC-${document.id}`;
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
    const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;
    if (!integritySecret || !publicKey) return NextResponse.json({ error: 'Wompi no está configurado en el servidor.' }, { status: 503 });
    const integrity = crypto.createHash('sha256').update(`${reference}${amountInCents}${currency}${integritySecret}`).digest('hex');

    const paymentsTable = supabase.from('payments') as unknown as {
      select: (columns: string) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: ExistingPayment | null; error: { message: string } | null }> } } };
      insert: (values: PaymentPayload) => Promise<{ error: { message: string; code?: string } | null }>;
    };
    const { data: existing } = await paymentsTable.select('id,user_id,status,guest_access_token,guest_email').eq('provider', 'wompi').eq('provider_reference', reference).maybeSingle();
    let accessToken = existing?.guest_access_token || guestAccessToken || null;

    if (!existing) {
      if (!user && !accessToken) accessToken = crypto.randomBytes(32).toString('hex');
      const paymentPayload: PaymentPayload = {
        procedure_id: procedureId,
        user_id: user?.id || null,
        document_version_id: documentVersionId,
        amount: pricing.price,
        currency,
        status: 'pending',
        provider: 'wompi',
        provider_reference: reference,
        guest_access_token: user ? null : accessToken,
        guest_email: user ? null : (guestEmail || null),
        metadata: { reference, amount_in_cents: amountInCents, checkout_mode: user ? 'authenticated' : 'guest' },
      };
      const { error: insertError } = await paymentsTable.insert(paymentPayload);
      if (insertError && insertError.code !== '23505') return NextResponse.json({ error: insertError.message }, { status: 500 });
    } else if (!user && !accessToken) {
      return NextResponse.json({ error: 'Se requiere el enlace de acceso de esta compra.' }, { status: 401 });
    }

    return NextResponse.json({ publicKey, currency, amountInCents, reference, integrity, price: pricing.price, documentVersionId, guestAccessToken: user ? null : accessToken });
  } catch {
    return NextResponse.json({ error: 'No fue posible preparar el pago Wompi.' }, { status: 400 });
  }
}
