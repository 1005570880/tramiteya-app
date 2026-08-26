import { NextRequest, NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import { parseOfficialSimitText } from '@/lib/simitOfficialParser';

export const runtime = 'nodejs';
const MAX_FILE_BYTES = 10 * 1024 * 1024;

type ExtractedRecord = {
  kind?: 'multa' | 'comparendo'; number?: string; date?: string; authority?: string;
  department?: string; plate?: string; ownerName?: string; documentNumber?: string;
  infractionCode?: string; description?: string; status?: string; value?: number;
  resolutionNumber?: string; resolutionDate?: string; notificationDate?: string; paymentDate?: string;
};

async function aiExtract(text: string): Promise<ExtractedRecord[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !text.trim()) return [];
  const prompt = `Analiza exclusivamente el texto del Estado de Cuenta de SIMIT. Extrae cada comparendo o multa real que figure. No inventes, completes ni deduzcas información. Devuelve JSON puro con {"records":[{"kind":"comparendo|multa","number":"","date":"","authority":"","department":"","plate":"","ownerName":"","documentNumber":"","infractionCode":"","description":"","status":"","value":0,"resolutionNumber":"","resolutionDate":"","notificationDate":"","paymentDate":""}]}. Un registro por comparendo/multa. Conserva literalmente números, fechas, placas y valores. Si un campo no aparece, usa cadena vacía o null. TEXTO:\n${text.slice(0, 120000)}`;
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: process.env.OPENAI_SIMIT_MODEL || 'gpt-4o-mini', temperature: 0, messages: [
        { role: 'system', content: 'Eres un extractor documental jurídico. Solo estructuras información explícitamente presente en el documento. Nunca inventes datos.' },
        { role: 'user', content: prompt },
      ], response_format: { type: 'json_object' } }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return [];
    const parsed = JSON.parse(content);
    return Array.isArray(parsed?.records) ? parsed.records : [];
  } catch (error) { console.error('[SIMIT AI] extraction fallback', error); return []; }
}

function normalizeNumber(value: unknown) { return String(value ?? '').replace(/\D/g, ''); }

function mergeRecords(base: ExtractedRecord[], ai: ExtractedRecord[]) {
  const merged = new Map<string, ExtractedRecord>();
  for (const record of [...base, ...ai]) {
    const number = String(record.number || '').replace(/\s+/g, '').trim();
    if (!number) continue;
    const previous = merged.get(number);
    merged.set(number, { ...(previous || {}), ...record, number });
  }
  return [...merged.values()];
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    const documentNumber = normalizeNumber(form.get('documentNumber'));
    if (!(file instanceof File)) return NextResponse.json({ ok: false, message: 'Selecciona el Estado de Cuenta de SIMIT.' }, { status: 400 });
    if (!documentNumber) return NextResponse.json({ ok: false, message: 'Ingresa la cédula antes de subir el Estado de Cuenta.' }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ ok: false, message: 'El archivo supera el límite de 10 MB.' }, { status: 413 });
    if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) return NextResponse.json({ ok: false, message: 'Sube únicamente el Estado de Cuenta en PDF descargado desde SIMIT.' }, { status: 415 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await pdf(buffer);
    const text = parsed.text || '';
    if (!text.trim()) return NextResponse.json({ ok: false, code: 'SIMIT_PDF_NO_TEXT', message: 'El PDF no contiene texto extraíble. Descarga el Estado de Cuenta como PDF directamente desde SIMIT.' }, { status: 422 });

    // TrámiteYa NO consulta SIMIT. Solo analiza el documento que el usuario aporta.
    const deterministicRecords = parseOfficialSimitText(text);
    const aiRecords = await aiExtract(text);
    const records = mergeRecords(deterministicRecords, aiRecords);
    if (!records.length) return NextResponse.json({ ok: false, code: 'SIMIT_DOCUMENT_NOT_STRUCTURED', message: 'El PDF fue recibido, pero no se encontraron comparendos o multas identificables. Sube el Estado de Cuenta oficial completo.' }, { status: 422 });

    // Protección contra cargar el estado de cuenta de una persona distinta.
    if (!normalizeNumber(text).includes(documentNumber)) return NextResponse.json({ ok: false, code: 'SIMIT_DOCUMENT_MISMATCH', message: 'La cédula ingresada no coincide con el Estado de Cuenta. Verifica el PDF y vuelve a intentarlo.' }, { status: 422 });

    const safeRecords = records.map((record) => ({ ...record, documentNumber: record.documentNumber || documentNumber }));
    console.log('[SIMIT AUDIT] statement_upload', JSON.stringify({ documentType: 'CC', documentNumber, fileName: file.name, size: file.size, records: safeRecords.length, aiUsed: Boolean(process.env.OPENAI_API_KEY), timestamp: new Date().toISOString() }));
    return NextResponse.json({ ok: true, source: 'SIMIT_STATEMENT_UPLOAD', extraction: process.env.OPENAI_API_KEY ? 'hybrid' : 'deterministic', documentType: 'CC', documentNumber, fileName: file.name, records: safeRecords, message: `Estado de Cuenta analizado. Se encontraron ${safeRecords.length} registro(s). Selecciona uno para continuar.` });
  } catch (error) {
    console.error('[SIMIT] statement upload error', error);
    return NextResponse.json({ ok: false, message: 'No fue posible analizar el Estado de Cuenta de SIMIT.' }, { status: 500 });
  }
}
