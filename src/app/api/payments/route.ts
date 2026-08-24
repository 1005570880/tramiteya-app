import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../lib/supabaseServerClient';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const procedureKey = String(url.searchParams.get('procedureId') || '').trim();
    const documentVersionId = String(url.searchParams.get('documentVersionId') || '').trim();
    if (!procedureKey || !documentVersionId) return NextResponse.json({ error: 'procedureId y documentVersionId son requeridos.' }, { status: 400 });

    const supabase = getSupabaseServer();
    const proceduresTable = supabase.from('procedures') as any;
    const { data: procedure } = await proceduresTable.select('id').eq('slug', procedureKey).limit(1).maybeSingle();
    const procedureId = procedure?.id || procedureKey;

    const paymentsTable = supabase.from('payments') as any;
    const { data, error } = await paymentsTable
      .select('id,status,amount,currency,procedure_id,document_version_id,provider,created_at,approved_at')
      .eq('procedure_id', procedureId)
      .eq('document_version_id', documentVersionId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ approved: Boolean(data), payment: data || null });
  } catch (error) {
    console.error('Payment status lookup failed:', error);
    return NextResponse.json({ error: 'No fue posible consultar el estado del pago.' }, { status: 400 });
  }
}
