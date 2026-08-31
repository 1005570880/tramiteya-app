import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseServer, getUserFromAccessToken } from '../../../../lib/supabaseServerClient';
import { getProcedurePrice } from '../../../../data/pricing';
import { createGuestAccessToken, getGuestAccessToken, hashGuestAccessToken } from '../../../../lib/guestAccess';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PaymentDocument = {
  id: string;
  instance_id: string | null;
  procedure_id: string | null;
  meta: Record<string, any> | null;
};

export async function POST(request: NextRequest) {
  try {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const user = token ? await getUserFromAccessToken(token) : null;

    const supabase = getSupabaseServer();
    const body = await request.json();
    const procedureId = String(body?.procedureId || '').trim();
    const documentVersionId = String(body?.documentVersionId || '').trim();
    if (!procedureId || !documentVersionId) return NextResponse.json({ error: 'Trámite y versión de documento son obligatorios.' }, { status: 400 });

    const pricing = getProcedurePrice(procedureId);
    if (!pricing) return NextResponse.json({ error: 'Trámite no disponible para compra.' }, { status: 400 });

    const { data: rawDocument, error: documentError } = await supabase
      .from('documents')
      .select('id,instance_id,procedure_id,meta')
      .eq('id', documentVersionId)
      .maybeSingle();
    const document = rawDocument as PaymentDocument | null;
    if (documentError || !document) return NextResponse.json({ error: 'Versión de documento no encontrada.' }, { status: 404 });
    if (document.procedure_id && document.procedure_id !== procedureId) return NextResponse.json({ error: 'El documento no corresponde al trámite.' }, { status: 409 });

    let guestToken = user ? '' : getGuestAccessToken(request);
    const storedHash = String(document.meta?.guestAccessTokenHash || '');

    // Guest checkout: create the document access credential on first payment attempt.
    if (!user && !guestToken) guestToken = createGuestAccessToken();
    if (!user && storedHash && storedHash !== hashGuestAccessToken(guestToken)) {
      return NextResponse.json({ error: 'Token de acceso inválido.' }, { status: 403 });
    }

    const guestHash = guestToken ? hashGuestAccessToken(guestToken) : '';
    if (!user && !storedHash) {
      const nextMeta = { ...(document.meta || {}), guestAccessTokenHash: guestHash };
      // Supabase's generated schema currently lacks the JSON column typings for this table.
      // Keep the runtime query intact while narrowing the write payload explicitly.
      const documentsTable = supabase.from('documents') as any;
      const { error: metaError } = await documentsTable.update({ meta: nextMeta }).eq('id', document.id);
      if (metaError) return NextResponse.json({ error: 'No fue posible preparar el acceso de invitado.' }, { status: 500 });
      if (document.instance_id) {
        const { error: instanceMetaError } = await supabase
          .from('procedure_instances')
          .update({ guest_access_token_hash: guestHash })
          .eq('id', document.instance_id);
        if (instanceMetaError) return NextResponse.json({ error: 'No fue posible vincular el acceso al trámite.' }, { status: 500 });
      }
    }

    const amountInCents = pricing.price * 100;
    const currency = 'COP';
    const reference = `DOC-${document.id}`;
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
    const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;
    if (!integritySecret || !publicKey) return NextResponse.json({ error: 'Wompi no está configurado en el servidor.' }, { status: 503 });

    const integrity = crypto.createHash('sha256').update(`${reference}${amountInCents}${currency}${integritySecret}`).digest('hex');
    const { data: existing } = await supabase.from('payments').select('*').eq('provider', 'wompi').eq('provider_reference', reference).maybeSingle();

    if (!existing) {
      const paymentPayload: any = {
        procedure_id: procedureId,
        user_id: user?.id || null,
        document_version_id: documentVersionId,
        amount: pricing.price,
        currency,
        status: 'pending',
        provider: 'wompi',
        provider_reference: reference,
        metadata: { reference, amount_in_cents: amountInCents, guestAccessTokenHash: guestHash || undefined },
      };
      const { error: insertError } = await supabase.from('payments').insert(paymentPayload);
      if (insertError && insertError.code !== '23505') return NextResponse.json({ error: insertError.message }, { status: 500 });
    } else if (!user && guestHash && !String((existing as any).metadata?.guestAccessTokenHash || '')) {
      const paymentsTable = supabase.from('payments') as any;
      await paymentsTable.update({ metadata: { ...((existing as any).metadata || {}), guestAccessTokenHash: guestHash } }).eq('id', existing.id);
    }

    const response = NextResponse.json({ publicKey, currency, amountInCents, reference, integrity, price: pricing.price, documentVersionId, guest: Boolean(guestToken), accessToken: guestToken || undefined });
    if (!user && guestToken) {
      response.cookies.set('tramiteya_guest_access', guestToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return response;
  } catch {
    return NextResponse.json({ error: 'No fue posible preparar el pago Wompi.' }, { status: 400 });
  }
}
