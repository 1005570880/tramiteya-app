import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseServer, getUserFromAccessToken } from '../../../../lib/supabaseServerClient';
import { getProcedurePrice } from '../../../../data/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ExistingPayment = { id: string; user_id: string | null; status: string | null; guest_access_token: string | null; guest_email: string | null };
type PaymentPayload = { procedure_id: string; user_id: string | null; document_id: string | null; document_version_id: string | null; amount: number; currency: string; status: string; provider: string; provider_reference: string; guest_access_token: string | null; guest_email: string | null; metadata: Record<string, unknown> };
type ProcedureRow = { id: string; slug?: string | null };
type VersionRow = { id: string; document_id: string };
type DocumentRow = { id: string; instance_id: string | null; procedure_id: string | null; user_id: string | null };

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function POST(request: NextRequest) {
  try {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const user = token ? await getUserFromAccessToken(token) : null;
    const body = await request.json();
    const procedureSlug = String(body?.procedureId || '').trim();
    const suppliedVersionId = String(body?.documentVersionId || '').trim();
    const guestAccessToken = String(body?.guestAccessToken || '').trim();
    const guestEmail = String(body?.guestEmail || '').trim().toLowerCase();
    if (!procedureSlug || !suppliedVersionId) return NextResponse.json({ error: 'Trámite y versión de documento son obligatorios.' }, { status: 400 });
    if (!user && guestAccessToken && guestAccessToken.length < 32) return NextResponse.json({ error: 'Token de acceso invitado inválido.' }, { status: 400 });

    const pricing = getProcedurePrice(procedureSlug);
    if (!pricing) return NextResponse.json({ error: 'Trámite no disponible para compra.' }, { status: 400 });
    if (!isUuid(suppliedVersionId)) return NextResponse.json({ error: 'Identificador de documento inválido.' }, { status: 400 });

    const supabase = getSupabaseServer();
    const proceduresTable = supabase.from('procedures') as unknown as { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: ProcedureRow | null; error: { message: string } | null }> } } };
    const versionsTable = supabase.from('document_versions') as unknown as { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: VersionRow | null; error: { message: string } | null }> } } };
    const documentsTable = supabase.from('documents') as unknown as { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: DocumentRow | null; error: { message: string } | null }> } } };
    const paymentsTable = supabase.from('payments') as unknown as {
      select: (columns: string) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: ExistingPayment | null; error: { message: string } | null }> } } };
      insert: (values: PaymentPayload) => Promise<{ error: { message: string; code?: string } | null }>;
    };

    const { data: version, error: versionError } = await versionsTable.select('id,document_id').eq('id', suppliedVersionId).maybeSingle();
    if (versionError || !version) return NextResponse.json({ error: 'Versión de documento no encontrada.' }, { status: 404 });

    const { data: document, error: documentError } = await documentsTable.select('id,instance_id,procedure_id,user_id').eq('id', version.document_id).maybeSingle();
    if (documentError || !document) return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 });
    if (user && document.user_id && document.user_id !== user.id) return NextResponse.json({ error: 'No tienes acceso a este documento.' }, { status: 403 });

    // The document is the source of truth for the procedure actually used to
    // generate it. This avoids breaking guest checkout when the UI/catalog slug
    // differs from the database slug. Fall back to slug lookup for legacy docs.
    let procedureId = document.procedure_id;
    let procedure: ProcedureRow | null = procedureId ? { id: procedureId } : null;

    if (!procedure) {
      const { data: bySlug, error: procedureError } = await proceduresTable.select('id,slug').eq('slug', procedureSlug).maybeSingle();
      if (procedureError || !bySlug) {
        if (isUuid(procedureSlug)) {
          const { data: byId, error: byIdError } = await proceduresTable.select('id,slug').eq('id', procedureSlug).maybeSingle();
          if (!byIdError && byId) {
            procedure = byId;
            procedureId = byId.id;
          }
        }
      } else {
        procedure = bySlug;
        procedureId = bySlug.id;
      }
    }

    if (!procedure || !procedureId) return NextResponse.json({ error: 'El trámite asociado al documento no existe en la base de datos.' }, { status: 404 });
    if (document.procedure_id && document.procedure_id !== procedureId) return NextResponse.json({ error: 'El documento no corresponde al trámite.' }, { status: 409 });

    const amountInCents = pricing.price * 100;
    const currency = 'COP';
    const reference = `DOC-${document.id}`;
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
    const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;
    if (!integritySecret || !publicKey) return NextResponse.json({ error: 'Wompi no está configurado en el servidor.' }, { status: 503 });
    const integrity = crypto.createHash('sha256').update(`${reference}${amountInCents}${currency}${integritySecret}`).digest('hex');

    const { data: existing } = await paymentsTable.select('id,user_id,status,guest_access_token,guest_email').eq('provider', 'wompi').eq('provider_reference', reference).maybeSingle();
    let accessToken = existing?.guest_access_token || guestAccessToken || null;
    if (!existing) {
      if (!user && !accessToken) accessToken = crypto.randomBytes(32).toString('hex');
      const paymentPayload: PaymentPayload = { procedure_id: procedureId, user_id: user?.id || null, document_id: document.id, document_version_id: version.id, amount: pricing.price, currency, status: 'pending', provider: 'wompi', provider_reference: reference, guest_access_token: user ? null : accessToken, guest_email: user ? null : (guestEmail || null), metadata: { reference, amount_in_cents: amountInCents, checkout_mode: user ? 'authenticated' : 'guest' } };
      const { error: insertError } = await paymentsTable.insert(paymentPayload);
      if (insertError && insertError.code !== '23505') return NextResponse.json({ error: insertError.message }, { status: 500 });
    } else if (!user && !accessToken) {
      return NextResponse.json({ error: 'Se requiere el enlace de acceso de esta compra.' }, { status: 401 });
    }
    return NextResponse.json({ publicKey, currency, amountInCents, reference, integrity, price: pricing.price, documentVersionId: version.id, guestAccessToken: user ? null : accessToken });
  } catch (error) {
    console.error('WOMPI_CHECKOUT_ERROR', error);
    return NextResponse.json({ error: 'No fue posible preparar el pago Wompi.' }, { status: 400 });
  }
}
