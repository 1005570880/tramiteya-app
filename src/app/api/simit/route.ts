import { NextResponse } from 'next/server';
import { lookupSimitByDocument } from '../../../lib/simitProvider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const documentType = String(body?.documentType || 'CC').trim();
    const documentNumber = String(body?.documentNumber || '').trim().replace(/[^0-9A-Za-z]/g, '');
    if (!documentNumber) return NextResponse.json({ error: 'El número de documento es obligatorio.' }, { status: 422 });

    const token = process.env.VERIFIK_API_TOKEN?.trim() || process.env.VERIFIK_TOKEN?.trim();
    if (!token) return NextResponse.json({ error: 'SIMIT_PROVIDER_UNAVAILABLE', code: 'SIMIT_PROVIDER_UNAVAILABLE', message: 'La integración SIMIT/Verifik no está configurada en el servidor.' }, { status: 502 });

    const result = await lookupSimitByDocument(documentType, documentNumber);
    if (result.provider !== 'verifik') return NextResponse.json({ error: 'SIMIT_PROVIDER_UNAVAILABLE', code: 'SIMIT_PROVIDER_UNAVAILABLE', message: 'El proveedor SIMIT activo no es Verifik.' }, { status: 502 });

    // Do not call /comparendos a second time here. lookupSimitByDocument already
    // performs the authoritative general query and the secondary list query only
    // when needed, then applies the document-integrity gate and de-duplicates.
    const safeResult: any = { ...result };
    delete safeResult.raw;
    return NextResponse.json(safeResult);
  } catch (error) {
    console.error('SIMIT lookup failed:', error);
    return NextResponse.json({ error: 'SIMIT_PROVIDER_UNAVAILABLE', code: 'SIMIT_PROVIDER_UNAVAILABLE', message: error instanceof Error ? error.message : 'No fue posible consultar SIMIT.' }, { status: 502 });
  }
}
