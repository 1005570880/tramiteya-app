import { NextRequest, NextResponse } from 'next/server';
import { queryOfficialFcmSimit } from '@/lib/simitFcmClient';

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

  const result = await queryOfficialFcmSimit(documentType, documentNumber);

  console.log('[SIMIT AUDIT] official_fcm_query', JSON.stringify({
    documentType,
    documentNumber,
    endpoint: result.endpoint,
    status: result.status,
    records: result.records.length,
    timestamp: new Date().toISOString(),
  }));

  if (result.ok) {
    return NextResponse.json({
      ok: true,
      code: result.records.length ? 'SIMIT_RESULTS' : 'SIMIT_NO_RESULTS',
      provider: 'official-fcm-service',
      source: 'SIMIT',
      documentType,
      documentNumber,
      automatedExtractionAvailable: true,
      comparendos: result.records,
      message: result.records.length
        ? 'Resultados obtenidos directamente del servicio público utilizado por SIMIT.'
        : 'La consulta oficial respondió, pero no se encontraron registros estructurables.',
    });
  }

  const officialUrl = `https://fcm.org.co/simit/#/estado-cuenta?numDocPlacaProp=${encodeURIComponent(documentNumber)}`;
  return NextResponse.json({
    ok: true,
    code: 'OFFICIAL_SIMIT_UNAVAILABLE',
    provider: 'official-navigation',
    source: 'SIMIT',
    officialUrl,
    documentType,
    documentNumber,
    automatedExtractionAvailable: false,
    comparendos: [],
    message: 'El servicio público de SIMIT no respondió con una consulta automatizable. No se generan ni interpretan datos que no provengan de SIMIT.',
  });
}
