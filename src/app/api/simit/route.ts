import { NextRequest, NextResponse } from 'next/server';
import { lookupSimitByDocumentPlacApi } from '@/lib/simitPlacApi';

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

  console.log('[SIMIT AUDIT] request', JSON.stringify({ provider: 'placapi', documentType, documentNumber, timestamp: new Date().toISOString() }));

  try {
    const result = await lookupSimitByDocumentPlacApi(documentType, documentNumber);
    const { raw, ...safeResult } = result;
    console.log('[SIMIT AUDIT] normalized', JSON.stringify({ provider: 'placapi', documentType, documentNumber, found: result.found, recordCount: result.comparendos.length, pendingCount: result.pendingCount, status: result.status }));
    return NextResponse.json({ ok: true, code: result.status ?? (result.found ? 'SUCCESS' : 'NO_RESULTS'), ...safeResult });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error inesperado consultando SIMIT.';
    const code = message.startsWith('SIMIT_DATA_INTEGRITY_ERROR') ? 'SIMIT_DATA_INTEGRITY_ERROR' : message.startsWith('PLACAPI_401') || message.startsWith('PLACAPI_403') ? 'AUTH_ERROR' : message.startsWith('PLACAPI_402') ? 'CREDITS_ERROR' : 'PROVIDER_ERROR';
    console.error('[SIMIT AUDIT] provider_error', JSON.stringify({ provider: 'placapi', documentType, documentNumber, code, message }));
    return NextResponse.json({ ok: false, code, message }, { status: code === 'AUTH_ERROR' ? 401 : code === 'CREDITS_ERROR' ? 402 : 502 });
  }
}
