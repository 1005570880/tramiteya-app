import { NextRequest, NextResponse } from 'next/server';
import { createOfficialSimitHandoff } from '@/lib/simitOfficial';

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
    officialUrl: handoff.officialUrl,
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
    message: 'TrámiteYa abrió la consulta oficial de SIMIT para el documento indicado. No se generan ni interpretan registros que no provengan de SIMIT.',
  });
}
