import { NextRequest, NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import { parseOfficialSimitText } from '@/lib/simitOfficialParser';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    const documentNumber = String(form.get('documentNumber') ?? '').replace(/\D/g, '');

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: 'Selecciona el estado de cuenta de SIMIT.' }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ ok: false, message: 'El archivo supera el límite de 10 MB.' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = '';

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const parsed = await pdf(buffer);
      text = parsed.text || '';
    } else if (file.type.startsWith('text/') || /\.(txt|csv)$/i.test(file.name)) {
      text = buffer.toString('utf8');
    } else {
      return NextResponse.json({ ok: false, message: 'Por ahora sube el estado de cuenta en PDF o TXT.' }, { status: 415 });
    }

    const records = parseOfficialSimitText(text);
    if (!records.length) {
      return NextResponse.json({
        ok: false,
        code: 'SIMIT_DOCUMENT_NOT_STRUCTURED',
        message: 'El archivo se recibió correctamente, pero no encontré registros de comparendos estructurables. Usa el PDF descargado directamente desde SIMIT.',
      }, { status: 422 });
    }

    console.log('[SIMIT AUDIT] statement_upload', JSON.stringify({
      documentType: 'CC',
      documentNumber,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      records: records.length,
      timestamp: new Date().toISOString(),
    }));

    return NextResponse.json({
      ok: true,
      source: 'SIMIT_STATEMENT_UPLOAD',
      documentType: 'CC',
      documentNumber,
      fileName: file.name,
      records,
      message: 'Estado de cuenta procesado. Selecciona el comparendo que deseas revisar.',
    });
  } catch (error) {
    console.error('[SIMIT] statement upload error', error);
    return NextResponse.json({ ok: false, message: 'No fue posible procesar el estado de cuenta de SIMIT.' }, { status: 500 });
  }
}
