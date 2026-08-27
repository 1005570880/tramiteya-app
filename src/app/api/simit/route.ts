import { NextResponse } from 'next/server';
import { lookupSimitByDocument, SimitDataIntegrityError } from '../../../lib/simitProvider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const documentType = String(body?.documentType || 'CC').trim().toUpperCase() || 'CC';
    const documentNumber = String(body?.documentNumber || '').trim().replace(/[^0-9A-Za-z]/g, '');
    if (!documentNumber) return NextResponse.json({ error: 'El número de documento es obligatorio.' }, { status: 422 });
    const token = process.env.VERIFIK_API_TOKEN?.trim() || process.env.VERIFIK_TOKEN?.trim();
    if (!token) return NextResponse.json({ error: 'SIMIT_PROVIDER_UNAVAILABLE', code: 'SIMIT_PROVIDER_UNAVAILABLE', message: 'La integración SIMIT/Verifik no está configurada en el servidor.' }, { status: 502 });
    console.log('[SIMIT AUDIT] request', JSON.stringify({ documentType, documentNumber, timestamp: new Date().toISOString() }));
    const result = await lookupSimitByDocument(documentType, documentNumber);
    if (result.provider !== 'verifik') return NextResponse.json({ error: 'SIMIT_PROVIDER_UNAVAILABLE', code: 'SIMIT_PROVIDER_UNAVAILABLE', message: 'El proveedor SIMIT activo no es Verifik.' }, { status: 502 });
    if (result.raw !== undefined) console.log('[SIMIT AUDIT] rawResponse', JSON.stringify({ documentType, documentNumber, raw: result.raw }));
    console.log('[SIMIT AUDIT] normalized', JSON.stringify({ documentType, documentNumber, provider: result.provider, found: result.found, pendingCount: result.pendingCount, recordCount: result.comparendos?.length ?? 0, personName: result.personName }));
    // Identity integrity is enforced in simitProvider.normalizeRecords: any record (or payload) whose
    // document number is PRESENT and differs from the queried cédula throws SimitDataIntegrityError.
    // Verifik's comparendos endpoint does not echo a per-record document number (records carry only an
    // infractor/owner NAME), so records legitimately keyed to the queried cédula have no documentNumber
    // field. Requiring one here rejected 100% of valid lookups, so that guard has been removed.
    const safeResult: any = { ...result }; delete safeResult.raw; return NextResponse.json(safeResult);
  } catch (error) {
    console.error('[SIMIT AUDIT] lookup_failed', JSON.stringify({ message: error instanceof Error ? error.message : String(error) }));
    if (error instanceof SimitDataIntegrityError) return NextResponse.json({ error: error.code, code: error.code, message: 'El proveedor devolvió información que no coincide con la cédula consultada. TrámiteYa bloqueó esos datos para evitar generar un documento con información incorrecta.' }, { status: 409 });
    return NextResponse.json({ error: 'SIMIT_PROVIDER_UNAVAILABLE', code: 'SIMIT_PROVIDER_UNAVAILABLE', message: error instanceof Error ? error.message : 'No fue posible consultar SIMIT.' }, { status: 502 });
  }
}
