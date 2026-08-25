import { NextResponse } from 'next/server';
import { lookupSimitByDocument } from '../../../lib/simitProvider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const documentType = String(body?.documentType || 'CC').trim();
    const documentNumber = String(body?.documentNumber || '').trim();

    if (!documentNumber) {
      return NextResponse.json({ error: 'El número de documento es obligatorio.' }, { status: 422 });
    }

    const result = await lookupSimitByDocument(documentType, documentNumber);
    const { raw: _raw, ...safeResult } = result;
    return NextResponse.json(safeResult);
  } catch (error) {
    console.error('SIMIT lookup failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No fue posible consultar SIMIT.' },
      { status: 502 },
    );
  }
}
