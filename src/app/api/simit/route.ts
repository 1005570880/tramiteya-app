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
    const unverifiedIdentity = result.comparendos.some((record: any) => record.ownerName && !record.documentNumber);
    if (unverifiedIdentity) {
      console.error('[SIMIT AUDIT] identity_unverified', JSON.stringify({ documentType, documentNumber, personName: result.personName, recordCount: result.comparendos.length }));
      return NextResponse.json({ error: 'SIMIT_DATA_INTEGRITY_ERROR', code: 'SIMIT_DATA_INTEGRITY_ERROR', message: 'SIMIT/Verifik devolvió registros con identidad no verificable para la cédula consultada. TrámiteYa bloqueó esos registros para evitar mostrar comparendos de otra persona.' }, { status: 409 });
    }
    const safeResult: any = { ...result }; delete safeResult.raw; return NextResponse.json(safeResult);
  } catch (error) {
    console.error('[SIMIT AUDIT] lookup_failed', JSON.stringify({ message: error instanceof Error ? error.message : String(error) }));
    if (error instanceof SimitDataIntegrityError) return NextResponse.json({ error: error.code, code: error.code, message: 'El proveedor devolvió información que no coincide con la cédula consultada. TrámiteYa bloqueó esos datos para evitar generar un documento con información incorrecta.' }, { status: 409 });
    return NextResponse.json({ error: 'SIMIT_PROVIDER_UNAVAILABLE', code: 'SIMIT_PROVIDER_UNAVAILABLE', message: error instanceof Error ? error.message : 'No fue posible consultar SIMIT.' }, { status: 502 });
  }
}
