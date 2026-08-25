import { NextRequest, NextResponse } from 'next/server';
import { getSimitComparendoDetailPlacApi } from '@/lib/simitPlacApi';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: { documentType?: string; documentNumber?: string; numeroComparendo?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, code: 'INVALID_RESPONSE', message: 'Cuerpo de solicitud inválido.' }, { status: 400 }); }
  const documentType = String(body.documentType ?? 'CC').trim().toUpperCase() || 'CC';
  const documentNumber = String(body.documentNumber ?? '').replace(/\D/g, '');
  const numeroComparendo = String(body.numeroComparendo ?? '').trim();
  if (!documentNumber || !numeroComparendo) return NextResponse.json({ ok: false, code: 'INVALID_RESPONSE', message: 'Cédula y número de comparendo son obligatorios.' }, { status: 400 });

  try {
    const result = await getSimitComparendoDetailPlacApi(documentType, documentNumber, numeroComparendo);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No fue posible consultar el detalle del comparendo.';
    const code = message.startsWith('SIMIT_DATA_INTEGRITY_ERROR') ? 'SIMIT_DATA_INTEGRITY_ERROR' : message.startsWith('PLACAPI_401') || message.startsWith('PLACAPI_403') ? 'AUTH_ERROR' : message.startsWith('PLACAPI_402') ? 'CREDITS_ERROR' : 'PROVIDER_ERROR';
    return NextResponse.json({ ok: false, code, message }, { status: code === 'AUTH_ERROR' ? 401 : code === 'CREDITS_ERROR' ? 402 : 502 });
  }
}
