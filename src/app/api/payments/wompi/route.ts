import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseServer } from '../../../../lib/supabaseServerClient';
import { getProcedurePrice } from '../../../../data/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const body = await request.json();
    const procedureKey = String(body?.procedureId || '').trim();
    const documentVersionId = String(body?.documentVersionId || '').trim();
    if (!procedureKey || !documentVersionId) return NextResponse.json({ error: 'Trámite y versión de documento son obligatorios.' }, { status: 400 });

    const pricing = getProcedurePrice(procedureKey);
    if (!pricing) return NextResponse.json({ error: 'Trámite no disponible para compra.' }, { status: 400 });

    const { data: procedure, error: procedureError } = await supabase
      .from('procedures')
      .select('id,slug')
      .eq('slug', procedureKey)
      .limit(1)
      .maybeSingle();
    if (procedureError || !procedure) return NextResponse.json({ error: 'El trámite no está configurado en la base de datos.' }, { status: 409 });

    const procedureId = procedure.id as string;
    const documentsTable = supabase.from('documents') as any;
    const { data: document, error: documentError } = await documentsTable
      .select('id,instance_id,procedure_id,meta')
      .eq('id', documentVersionId)
      .maybeSingle();
    if (documentError || !document) return NextResponse.json({ error: 'Versión de documento no encontrada.' }, { status: 404 });
    if (document.procedure_id && document.procedure_id !== procedureId) return NextResponse.json({ error: 'El documento no corresponde al trámite.' }, { status: 409 });

    const amountInCents = pricing.price * 100;
    const currency = 'COP';
    const reference = `DOC-${document.id}`;
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
    const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;
    if (!integritySecret || !publicKey) return NextResponse.json({ error: 'Wompi no está configurado en el servidor.' }, { status: 503 });

    const integrity = crypto.createHash('sha256').update(`${reference}${amountInCents}${currency}${integritySecret}`).digest('hex');
    const paymentsTable = supabase.from('payments') as any;
    const { data: existing } = await paymentsTable.select('*').eq('provider', 'wompi').eq('provider_reference', reference).maybeSingle();

    if (!existing) {
      const paymentPayload = {
        procedure_id: procedureId,
        user_id: null,
        document_version_id: documentVersionId,
        document_id: document.id,
        amount: pricing.price,
        currency,
        status: 'pending',
        provider: 'wompi',
        provider_reference: reference,
        metadata: { reference, amount_in_cents: amountInCents, procedureSlug: procedureKey },
      };
      const { error: insertError } = await paymentsTable.insert(paymentPayload);
      if (insertError && insertError.code !== '23505') return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ publicKey, currency, amountInCents, reference, integrity, price: pricing.price, documentVersionId });
  } catch (error) {
    console.error('Wompi preparation failed:', error);
    return NextResponse.json({ error: 'No fue posible preparar el pago Wompi.' }, { status: 400 });
  }
}
