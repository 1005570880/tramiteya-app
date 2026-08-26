import { NextRequest, NextResponse } from 'next/server';
import { createOfficialSimitHandoff, OFFICIAL_SIMIT_URL } from '@/lib/simitOfficial';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: { documentType?: string; documentNumber?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: 'INVALID_RESPONSE', message: 'Cuerpo de solicitud inválido.' }, { status: 400 });
  }

  const documentType = String(body.documentType ?? 'CC').trim().toUpperCase() || 'CC';
  const documentNumber = String(body.documentNumber ?? '').replace(/\D/g, '');
  if (!documentNumber) {
    return NextResponse.json({ ok: false, code: 'INVALID_RESPONSE', message: 'documentNumber es requerido.' }, { status: 400 });
  }

  const handoff = createOfficialSimitHandoff(documentType, documentNumber);
  console.log('[SIMIT AUDIT] official_handoff', JSON.stringify({
    documentType,
    documentNumber,
    officialUrl: OFFICIAL_SIMIT_URL,
    timestamp: new Date().toISOString(),
  }));

  return NextResponse.json({
    ok: true,
    code: 'OFFICIAL_SIMIT_PANEL',
    provider: handoff.provider,
    source: handoff.source,
    officialUrl: handoff.officialUrl,
    documentType: handoff.documentType,
    documentNumber: handoff.documentNumber,
    automatedExtractionAvailable: false,
    comparendos: [],
    message: 'La consulta se realiza directamente en el portal oficial de SIMIT. TrámiteYa no inventa ni interpreta resultados de terceros.',
  });
}
