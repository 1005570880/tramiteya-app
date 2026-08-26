import { NextRequest, NextResponse } from 'next/server';
import { OFFICIAL_SIMIT_URL } from '@/lib/simitOfficial';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: { documentType?: string; documentNumber?: string; numeroComparendo?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, code: 'INVALID_RESPONSE', message: 'Cuerpo de solicitud inválido.' }, { status: 400 }); }
  const documentType = String(body.documentType ?? 'CC').trim().toUpperCase() || 'CC';
  const documentNumber = String(body.documentNumber ?? '').replace(/\D/g, '');
  const numeroComparendo = String(body.numeroComparendo ?? '').trim();
  if (!documentNumber || !numeroComparendo) return NextResponse.json({ ok: false, code: 'INVALID_RESPONSE', message: 'Cédula y número de comparendo son obligatorios.' }, { status: 400 });

  return NextResponse.json({
    ok: false,
    code: 'OFFICIAL_SIMIT_REQUIRED',
    provider: 'official-manual',
    source: 'SIMIT',
    officialUrl: OFFICIAL_SIMIT_URL,
    documentType,
    documentNumber,
    numeroComparendo,
    message: 'El detalle debe verificarse directamente en el portal oficial de SIMIT; TrámiteYa no utiliza proveedores de terceros para este dato.',
  }, { status: 409 });
}
