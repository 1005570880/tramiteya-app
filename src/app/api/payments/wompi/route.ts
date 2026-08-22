import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseServer, getUserFromAccessToken } from '../../../../../lib/supabaseServerClient';
import { getProcedurePrice } from '../../../../../data/pricing';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const user = token ? await getUserFromAccessToken(token) : null;
    if (!user) return NextResponse.json({ error: 'Autenticación requerida.' }, { status: 401 });

    const supabase = getSupabaseServer();
    const body = await request.json();
    const procedureId = String(body?.procedureId || '').trim();
    const documentVersionId = String(body?.documentVersionId || '').trim();
    if (!procedureId || !documentVersionId) return NextResponse.json({ error: 'Trámite y versión de documento son obligatorios.' }, { status: 400 });

    const pricing = getProcedurePrice(procedureId);
    if (!pricing) return NextResponse.json({ error: 'Trámite no disponible para compra.' }, { status: 400 });

    const { data: document, error: documentError } = await supabase.from('documents').select('id,instance_id,procedure_id,meta').eq('id', documentVersionId).maybeSingle();
    if (documentError || !document) return NextResponse.json({ error: 'Versión de documento no encontrada.' }, { status: 404 });
    if (document.procedure_id && document.procedure_id !== procedureId) return NextResponse.json({ error: 'El documento no corresponde al trámite.' }, { status: 409 });

    const amountInCents = pricing.price * 100;
    const currency = 'COP';
    const reference = `DOC-${document.id}`;
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
    const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;
    if (!integritySecret || !publicKey) return NextResponse.json({ error: 'Wompi no está configurado en el servidor.' }, { status: 503 });

    const integrity = crypto.createHash('sha256').update(`${reference}${amountInCents}${currency}${integritySecret}`).digest('hex');
    const { data: existing } = await supabase.from('payments').select('*').eq('user_id', user.id).eq('provider', 'wompi').eq('provider_reference', reference).maybeSingle();

    if (!existing) {
      const { error: insertError } = await supabase.from('payments').insert({ procedure_id: procedureId, user_id: user.id, document_version_id: documentVersionId, amount: pricing.price, currency, status: 'pending', provider: 'wompi', provider_reference: reference, metadata: { reference, amount_in_cents: amountInCents } });
      if (insertError && insertError.code !== '23505') return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ publicKey, currency, amountInCents, reference, integrity, price: pricing.price, documentVersionId });
  } catch {
    return NextResponse.json({ error: 'No fue posible preparar el pago Wompi.' }, { status: 400 });
  }
}
