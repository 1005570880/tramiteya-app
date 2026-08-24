import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseServer } from '../../../../lib/supabaseServerClient';
import { DEFAULT_PROCEDURE_PRICING, getProcedurePrice } from '../../../../data/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const body = await request.json();
    const procedureKey = String(body?.procedureId || '').trim();
    const documentVersionId = String(body?.documentVersionId || '').trim();
    if (!procedureKey || !documentVersionId) {
      return NextResponse.json({ error: 'Trámite y versión de documento son obligatorios.' }, { status: 400 });
    }

    const proceduresTable = supabase.from('procedures') as any;
    let procedure: any = null;
    let procedureError: any = null;

    // El frontend puede enviar tanto el slug como el UUID de procedures.
    if (UUID_RE.test(procedureKey)) {
      const result = await proceduresTable
        .select('id,slug,name,price,is_active')
        .eq('id', procedureKey)
        .limit(1)
        .maybeSingle();
      procedure = result.data;
      procedureError = result.error;
    } else {
      const result = await proceduresTable
        .select('id,slug,name,price,is_active')
        .eq('slug', procedureKey)
        .limit(1)
        .maybeSingle();
      procedure = result.data;
      procedureError = result.error;
    }

    // La BD es la fuente primaria del precio. El catálogo de código y el
    // precio estándar son mecanismos de continuidad para no bloquear checkout.
    const catalogPricing = getProcedurePrice(procedureKey);
    const dbPrice = procedure && Number(procedure.price) > 0 ? Number(procedure.price) : null;
    const pricing = {
      price: dbPrice ?? catalogPricing.price ?? DEFAULT_PROCEDURE_PRICING.price,
      currency: 'COP' as const,
    };

    // Si por una migración incompleta todavía no existe el registro, créalo
    // automáticamente con el precio del catálogo o el estándar de $49.900.
    if ((procedureError || !procedure) && !UUID_RE.test(procedureKey)) {
      const fallbackPrice = catalogPricing.price;
      const { data: createdProcedure, error: createError } = await proceduresTable
        .upsert({
          slug: procedureKey,
          name: String(body?.procedureName || procedureKey),
          description: 'Trámite habilitado automáticamente para checkout.',
          price: fallbackPrice,
          is_active: true,
          config: {},
          updated_at: new Date().toISOString(),
        }, { onConflict: 'slug' })
        .select('id,slug,name,price,is_active')
        .single();

      if (!createError && createdProcedure) {
        procedure = createdProcedure;
        procedureError = null;
      }
    }

    if (procedureError || !procedure) {
      return NextResponse.json({
        error: 'El trámite no pudo configurarse para el pago.',
        detail: 'El catálogo de respaldo fue aplicado, pero no fue posible crear o localizar el registro del trámite.',
      }, { status: 409 });
    }

    if (procedure.is_active === false) {
      return NextResponse.json({ error: 'Este trámite no está habilitado para compra.' }, { status: 409 });
    }

    const procedureId = String(procedure.id);
    const documentsTable = supabase.from('documents') as any;
    const { data: document, error: documentError } = await documentsTable
      .select('id,instance_id,procedure_id,meta')
      .eq('id', documentVersionId)
      .maybeSingle();
    if (documentError || !document) {
      return NextResponse.json({ error: 'Versión de documento no encontrada.' }, { status: 404 });
    }
    if (document.procedure_id && document.procedure_id !== procedureId) {
      return NextResponse.json({ error: 'El documento no corresponde al trámite.' }, { status: 409 });
    }

    const amountInCents = Math.round(pricing.price * 100);
    const currency = pricing.currency;
    const reference = `DOC-${document.id}`;
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
    const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;
    if (!integritySecret || !publicKey) {
      return NextResponse.json({ error: 'Wompi no está configurado en el servidor.' }, { status: 503 });
    }

    const integrity = crypto
      .createHash('sha256')
      .update(`${reference}${amountInCents}${currency}${integritySecret}`)
      .digest('hex');

    const paymentsTable = supabase.from('payments') as any;
    const { data: existing } = await paymentsTable
      .select('*')
      .eq('provider', 'wompi')
      .eq('provider_reference', reference)
      .maybeSingle();

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
        metadata: {
          reference,
          amount_in_cents: amountInCents,
          procedureSlug: procedure.slug,
          pricingSource: dbPrice ? 'database' : catalogPricing ? 'catalog' : 'default',
        },
      };
      const { error: insertError } = await paymentsTable.insert(paymentPayload);
      if (insertError && insertError.code !== '23505') {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      publicKey,
      currency,
      amountInCents,
      reference,
      integrity,
      price: pricing.price,
      documentVersionId,
      procedureId,
      procedureSlug: procedure.slug,
    });
  } catch (error) {
    console.error('Wompi preparation failed:', error);
    return NextResponse.json({ error: 'No fue posible preparar el pago Wompi.' }, { status: 400 });
  }
}
