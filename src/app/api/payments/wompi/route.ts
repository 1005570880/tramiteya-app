import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseServer, getUserFromAccessToken } from '../../../../lib/supabaseServerClient';
import { getProcedurePrice } from '../../../../data/pricing';
import { procedures } from '../../../../data/procedures';
import { getRepositoryFactory } from '../../../../lib/repositoryFactory';
import { generateStrictTrafficDocument } from '../../../../lib/strictTrafficDocumentGenerator';
import { getGuestAccessToken, hashGuestAccessToken } from '../../../../lib/guestAccess';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PaymentDocument = { id: string; procedure_id: string | null; instance_id?: string | null; meta: Record<string, any> | null };

export async function POST(request: NextRequest) {
  try {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const user = token ? await getUserFromAccessToken(token) : null;
    const requestedGuestToken = getGuestAccessToken(request);
    const body = await request.json();
    const procedureId = String(body?.procedureId || '').trim();
    const requestedDocumentVersionId = String(body?.documentVersionId || '').trim();
    const requestedInstanceId = String(body?.instanceId || '').trim();
    if (!procedureId || (!requestedDocumentVersionId && !requestedInstanceId)) {
      return NextResponse.json({ error: 'Trámite e instancia o versión de documento son obligatorios.' }, { status: 400 });
    }

    const pricing = getProcedurePrice(procedureId);
    if (!pricing) return NextResponse.json({ error: 'Trámite no disponible para compra.' }, { status: 400 });
    const supabase = getSupabaseServer();
    let rawDocument: unknown = null;
    let documentError: any = null;

    if (requestedDocumentVersionId) {
      const result = await supabase.from('documents').select('id,procedure_id,instance_id,meta').eq('id', requestedDocumentVersionId).maybeSingle();
      rawDocument = result.data;
      documentError = result.error;
    }

    // A procedure instance may be the only durable identifier available to a guest.
    // If its document has not yet been persisted, materialize the legal document now.
    if (!rawDocument && requestedInstanceId) {
      const factory = getRepositoryFactory();
      const instance = await factory.getInstanceRepo().get(requestedInstanceId);
      if (instance && (!instance.userId || !user || instance.userId === user.id)) {
        const procedure = procedures.find((item) => item.id === procedureId || item.slug === instance.procedureSlug);
        if (procedure) {
          const generated = await generateStrictTrafficDocument(procedure, instance.answers || {}, requestedInstanceId);
          const docRepo = factory.getDocumentRepo();
          if (docRepo) {
            const guestToken = user ? '' : requestedGuestToken || requestedInstanceId;
            const persisted = await docRepo.create({
              ...generated,
              instanceId: undefined,
              meta: !user && guestToken ? { guestAccessTokenHash: hashGuestAccessToken(guestToken), guestAccessType: 'instance-id' } : undefined,
            } as any);
            rawDocument = persisted;
            documentError = null;
          }
        }
      }
    }

    if ((!rawDocument || documentError) && requestedInstanceId) {
      const result = await supabase.from('documents').select('id,procedure_id,instance_id,meta').eq('instance_id', requestedInstanceId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      rawDocument = result.data || rawDocument;
      documentError = result.error;
    }

    const document = rawDocument as PaymentDocument | null;
    if (documentError || !document) return NextResponse.json({ error: 'Versión de documento no encontrada.' }, { status: 404 });
    if (document.procedure_id && document.procedure_id !== procedureId) return NextResponse.json({ error: 'El documento no corresponde al trámite.' }, { status: 409 });

    const guestToken = user ? '' : requestedGuestToken || requestedInstanceId || document.id;
    const storedHash = String(document.meta?.guestAccessTokenHash || '');
    const directIdGuest = !user && (guestToken === document.id || guestToken === document.instance_id || guestToken === requestedInstanceId);
    if (!user && !guestToken) return NextResponse.json({ error: 'Se requiere autenticación o token de acceso del documento.' }, { status: 401 });
    if (!user && storedHash && !directIdGuest && storedHash !== hashGuestAccessToken(guestToken)) return NextResponse.json({ error: 'Token de acceso inválido.' }, { status: 403 });
    if (!user && !storedHash && !directIdGuest) return NextResponse.json({ error: 'Token de acceso inválido.' }, { status: 403 });

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
        procedure_id: procedureId, user_id: user?.id || null, document_version_id: document.id, amount: pricing.price, currency, status: 'pending', provider: 'wompi', provider_reference: reference,
        metadata: { reference, amount_in_cents: amountInCents, guestAccessTokenHash: !user ? hashGuestAccessToken(guestToken) : undefined, guestAccessType: !user ? (directIdGuest ? 'document_or_instance_id' : 'token') : undefined, instanceId: requestedInstanceId || document.instance_id || undefined },
      };
      const { error: insertError } = await supabase.from('payments').insert(paymentPayload);
      if (insertError && insertError.code !== '23505') return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    return NextResponse.json({ publicKey, currency, amountInCents, reference, integrity, price: pricing.price, documentVersionId: document.id, instanceId: requestedInstanceId || document.instance_id || undefined, guest: !Boolean(user), accessToken: !user ? guestToken : undefined });
  } catch (error) {
    console.error('WOMPI_CHECKOUT_ERROR:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No fue posible preparar el pago Wompi.' }, { status: 400 });
  }
}
