import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServerClient';
import { getProcedurePrice } from '@/data/pricing';

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production' && process.env.PAYMENTS_MOCK !== 'true') {
    return NextResponse.json({ error: 'Checkout simulado deshabilitado en producción.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const procedureId = String(body?.procedureId || '');
    const documentVersionId = body?.documentVersionId ? String(body.documentVersionId) : null;
    const idempotencyKey = String(body?.idempotencyKey || '').trim();
    const pricing = getProcedurePrice(procedureId);

    if (!procedureId || !pricing) {
      return NextResponse.json({ error: 'Trámite no disponible para compra.' }, { status: 400 });
    }
    if (!idempotencyKey || idempotencyKey.length > 128) {
      return NextResponse.json({ error: 'Clave de idempotencia requerida.' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Autenticación requerida.' }, { status: 401 });

    const { data: existing, error: existingError } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', user.id)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    if (existing) return NextResponse.json({ ok: true, payment: existing, reused: true });

    const reference = `MOCK-${crypto.randomUUID()}`;
    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        procedure_id: procedureId,
        user_id: user.id,
        document_version_id: documentVersionId,
        idempotency_key: idempotencyKey,
        amount: pricing.price,
        currency: pricing.currency,
        status: 'approved',
        provider: 'mock',
        provider_reference: reference,
        approved_at: new Date().toISOString(),
        metadata: { simulated: true, pricing_source: 'server_catalog' },
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        const { data: concurrent } = await supabase
          .from('payments')
          .select('*')
          .eq('user_id', user.id)
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();
        if (concurrent) return NextResponse.json({ ok: true, payment: concurrent, reused: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, payment, reused: false });
  } catch {
    return NextResponse.json({ error: 'Solicitud de checkout inválida.' }, { status: 400 });
  }
}
