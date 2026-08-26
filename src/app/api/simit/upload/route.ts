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
  const prompt = `Extrae exclusivamente los comparendos/multas que aparezcan en el siguiente Estado de Cuenta oficial de SIMIT. No inventes datos. Devuelve JSON puro con esta forma: {"records":[{"kind":"comparendo|multa","number":"","date":"","authority":"","department":"","plate":"","ownerName":"","documentNumber":"","infractionCode":"","description":"","status":"","value":0,"resolutionNumber":"","resolutionDate":"","notificationDate":"","paymentDate":""}]}. Si un campo no aparece, déjalo vacío o null. Conserva literalmente números, fechas, placas y valores. Un registro por comparendo/multa. Texto fuente:\n${text.slice(0, 120000)}`;
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: process.env.OPENAI_SIMIT_MODEL || 'gpt-4o-mini', temperature: 0, messages: [
        { role: 'system', content: 'Eres un extractor documental. Solo estructuras información presente en el documento. Nunca completes ni inventes datos.' },
        { role: 'user', content: prompt },
      ], response_format: { type: 'json_object' } }),
    });
    if (!response.ok) return [];
    const data = await response.json(); const content = data?.choices?.[0]?.message?.content;
    if (!content) return [];
    const parsed = JSON.parse(content);
    return Array.isArray(parsed?.records) ? parsed.records : [];
  } catch (error) { console.error('[SIMIT AI] extraction fallback', error); return []; }
}

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

function inferDocumentNumber(records: ExtractedRecord[], text: string) {
  const fromRecord = records.map(r => String(r.documentNumber || '').replace(/\D/g, '')).find(v => v.length >= 5);
  if (fromRecord) return fromRecord;
  const labels = /(c[eé]dula|documento|identificaci[oó]n|cc)\s*(?:n[roº°.]?\s*)?[:\-]?\s*(\d{6,12})/i;
  const match = text.match(labels);
  return match?.[2] || '';
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData(); const file = form.get('file');
    const suppliedDocumentNumber = String(form.get('documentNumber') ?? '').replace(/\D/g, '');
    if (!(file instanceof File)) return NextResponse.json({ ok: false, message: 'Selecciona el Estado de Cuenta de SIMIT.' }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ ok: false, message: 'El archivo supera el límite de 10 MB.' }, { status: 413 });
    if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) return NextResponse.json({ ok: false, message: 'Sube únicamente el Estado de Cuenta en PDF descargado desde SIMIT.' }, { status: 415 });

    const buffer = Buffer.from(await file.arrayBuffer()); const parsed = await pdf(buffer); const text = parsed.text || '';
    if (!text.trim()) return NextResponse.json({ ok: false, code: 'SIMIT_PDF_NO_TEXT', message: 'El PDF no contiene texto extraíble. Descarga nuevamente el Estado de Cuenta desde SIMIT.' }, { status: 422 });

    const deterministicRecords = parseOfficialSimitText(text); const aiRecords = await aiExtract(text); const records = mergeRecords(deterministicRecords, aiRecords);
    if (!records.length) return NextResponse.json({ ok: false, code: 'SIMIT_DOCUMENT_NOT_STRUCTURED', message: 'El PDF fue recibido, pero no se encontraron comparendos o multas identificables. Usa el Estado de Cuenta oficial descargado directamente desde SIMIT.' }, { status: 422 });

    const documentNumber = suppliedDocumentNumber || inferDocumentNumber(records, text);
    const recordsWithDocument = records.map(r => ({ ...r, documentNumber: r.documentNumber || documentNumber || undefined }));

    if (suppliedDocumentNumber) {
      const mismatched = recordsWithDocument.some(r => r.documentNumber && r.documentNumber !== suppliedDocumentNumber);
      if (mismatched) return NextResponse.json({ ok: false, code: 'SIMIT_DOCUMENT_MISMATCH', message: 'La cédula indicada no coincide con el titular del Estado de Cuenta.' }, { status: 422 });
    }

    console.log('[SIMIT AUDIT] statement_upload', JSON.stringify({ documentType: 'CC', documentNumber, fileName: file.name, mimeType: file.type, size: file.size, records: recordsWithDocument.length, aiUsed: Boolean(process.env.OPENAI_API_KEY), timestamp: new Date().toISOString() }));
    return NextResponse.json({ ok: true, source: 'SIMIT_STATEMENT_UPLOAD', extraction: process.env.OPENAI_API_KEY ? 'hybrid' : 'deterministic', documentType: 'CC', documentNumber, fileName: file.name, records: recordsWithDocument, message: `Estado de Cuenta analizado. Se encontraron ${recordsWithDocument.length} registro(s).` });
  } catch (error) { console.error('[SIMIT] statement upload error', error); return NextResponse.json({ ok: false, message: 'No fue posible analizar el Estado de Cuenta de SIMIT.' }, { status: 500 }); }
}
