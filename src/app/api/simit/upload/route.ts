import { NextRequest, NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import { parseOfficialSimitText } from '@/lib/simitOfficialParser';

export const runtime = 'nodejs';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 140000;

type ExtractedRecord = {
  kind?: 'multa' | 'comparendo'; number?: string; date?: string; authority?: string;
  department?: string; plate?: string; ownerName?: string; documentNumber?: string;
  infractionCode?: string; description?: string; status?: string; value?: number;
  resolutionNumber?: string; resolutionDate?: string; notificationDate?: string; paymentDate?: string;
};

type AiAnalysis = {
  documentType?: string; documentConfidence?: number; ownerName?: string; documentNumber?: string;
  records?: ExtractedRecord[]; confidence?: number; evidence?: string[];
};

function normalizeRecord(record: ExtractedRecord): ExtractedRecord | undefined {
  const number = String(record.number ?? '').replace(/\s+/g, '').trim();
  if (!number) return undefined;
  const kind = String(record.kind ?? '').toLowerCase().includes('multa') ? 'multa' : 'comparendo';
  const value = typeof record.value === 'number' && Number.isFinite(record.value) ? record.value : undefined;
  return {
    ...record, kind, number,
    date: record.date ? String(record.date).trim() : undefined,
    authority: record.authority ? String(record.authority).trim() : undefined,
    department: record.department ? String(record.department).trim() : undefined,
    plate: record.plate ? String(record.plate).trim().toUpperCase() : undefined,
    ownerName: record.ownerName ? String(record.ownerName).trim() : undefined,
    documentNumber: record.documentNumber ? String(record.documentNumber).replace(/\D/g, '') : undefined,
    infractionCode: record.infractionCode ? String(record.infractionCode).trim().toUpperCase() : undefined,
    description: record.description ? String(record.description).trim() : undefined,
    status: record.status ? String(record.status).trim() : undefined, value,
  };
}

function mergeRecords(base: ExtractedRecord[], ai: ExtractedRecord[]) {
  const merged = new Map<string, ExtractedRecord>();
  for (const source of [base, ai]) for (const raw of source) {
    const record = normalizeRecord(raw); if (!record) continue;
    const previous = merged.get(record.number!);
    merged.set(record.number!, {
      ...(previous || {}), ...record, number: record.number,
      authority: record.authority || previous?.authority,
      date: record.date || previous?.date, value: record.value ?? previous?.value,
      status: record.status || previous?.status, infractionCode: record.infractionCode || previous?.infractionCode,
    });
  }
  return [...merged.values()];
}

function inferDocumentNumber(records: ExtractedRecord[], text: string, ai?: AiAnalysis) {
  const aiNumber = String(ai?.documentNumber ?? '').replace(/\D/g, '');
  if (aiNumber.length >= 5) return aiNumber;
  const fromRecord = records.map(r => String(r.documentNumber || '').replace(/\D/g, '')).find(v => v.length >= 5);
  if (fromRecord) return fromRecord;
  const labels = /(c[eé]dula|documento|identificaci[oó]n|cc)\s*(?:n[roº°.]?\s*)?[:\-]?\s*(?:\n\s*)?(\d{6,12})/i;
  const match = text.match(labels); if (match?.[2]) return match[2];
  const heading = text.match(/estado\s+de\s+cuenta\s*\n\s*(\d{6,12})\s*\n\s*fecha\s+de\s+expedici[oó]n/i);
  return heading?.[1] || '';
}

function looksLikeSimitStatement(text: string) {
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ' ');
  const markers = ['estado de cuenta','simit','federacion colombiana de municipios','comparendo','secretaria','codigo de infraccion','total a pagar','resolucion sancion','estado de la infraccion'];
  return markers.filter(marker => normalized.includes(marker)).length >= 2;
}

async function aiAnalyze(text: string, pass: 'primary' | 'recovery'): Promise<AiAnalysis> {
  const key = process.env.OPENAI_API_KEY; if (!key || !text.trim()) return {};
  const system = `Eres el motor documental de TrámiteYa especializado en Estados de Cuenta SIMIT de Colombia.\nTu trabajo NO es inventar ni completar datos: debes identificar y estructurar únicamente información literalmente sustentada por el texto fuente.\nEl Estado de Cuenta SIMIT puede cambiar de diseño y pdf-parse puede desordenar columnas. Reconstruye cada registro usando contexto, encabezados, tablas y filas, no una posición fija de columnas.\nCampos relevantes: nombre del infractor, documento, número de comparendo, secretaría/organismo, fecha, resolución, estado, código de infracción, intereses, valor adicional y total a pagar/pagado.\nSi un dato no está en el texto, usa null. Los números de comparendo no deben confundirse con cédulas, teléfonos, valores, fechas o números de página. Devuelve exclusivamente JSON válido.`;
  const task = pass === 'primary'
    ? `Analiza TODO el texto y devuelve: documentType, documentConfidence (0-100), ownerName, documentNumber, records, confidence (0-100) y evidence. Un record por cada comparendo/multa realmente visible. Cada record puede tener kind, number, date, authority, department, plate, ownerName, documentNumber, infractionCode, description, status, value, resolutionNumber, resolutionDate, notificationDate y paymentDate. Incluye registros aunque falten campos. Evidence: hasta 5 fragmentos breves que justifiquen la identificación.`
    : `Haz una segunda lectura de recuperación. Busca específicamente encabezados como Número de comparendo/multa, Fecha, Secretaría/Organismo, Código de infracción, Estado, Resolución, Valor y Total a pagar/pagado. Detecta identificadores separados de su fecha por saltos de línea o columnas reordenadas. Devuelve documentType, documentConfidence, ownerName, documentNumber, records, confidence y evidence. No inventes registros.`;
  const prompt = `${task}\n\nTEXTO EXTRAÍDO DEL PDF:\n---\n${text.slice(0, MAX_TEXT_CHARS)}\n---`;
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: process.env.OPENAI_SIMIT_MODEL || 'gpt-4o-mini', temperature: 0, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], response_format: { type: 'json_object' } }),
    });
    if (!response.ok) { console.error('[SIMIT AI] HTTP', response.status, await response.text().catch(() => '')); return {}; }
    const data = await response.json(); const content = data?.choices?.[0]?.message?.content; if (!content) return {};
    const parsed = JSON.parse(content);
    return {
      documentType: String(parsed?.documentType ?? ''), documentConfidence: Number(parsed?.documentConfidence ?? 0),
      ownerName: parsed?.ownerName ? String(parsed.ownerName) : undefined,
      documentNumber: parsed?.documentNumber ? String(parsed.documentNumber).replace(/\D/g, '') : undefined,
      records: Array.isArray(parsed?.records) ? parsed.records : [], confidence: Number(parsed?.confidence ?? 0),
      evidence: Array.isArray(parsed?.evidence) ? parsed.evidence.map(String).slice(0, 5) : [],
    };
  } catch (error) { console.error('[SIMIT AI] extraction error', error); return {}; }
}

function validateRecords(records: ExtractedRecord[], text: string) {
  const compact = text.toLowerCase().replace(/\s+/g, '');
  return records.filter(record => {
    const number = String(record.number || '').replace(/\s+/g, '');
    if (!number || number.length < 8) return false;
    const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const appears = new RegExp(escaped).test(compact);
    const hasContext = Boolean(record.date || record.infractionCode || record.status || record.value || record.authority);
    return appears && hasContext;
  });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData(); const file = form.get('file');
    const suppliedDocumentNumber = String(form.get('documentNumber') ?? '').replace(/\D/g, '');
    if (!(file instanceof File)) return NextResponse.json({ ok: false, message: 'Selecciona el Estado de Cuenta de SIMIT.' }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ ok: false, message: 'El archivo supera el límite de 10 MB.' }, { status: 413 });
    if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) return NextResponse.json({ ok: false, message: 'Sube únicamente el Estado de Cuenta en PDF descargado desde SIMIT.' }, { status: 415 });

    const buffer = Buffer.from(await file.arrayBuffer()); const parsed = await pdf(buffer); const text = String(parsed.text || '').trim();
    if (!text) return NextResponse.json({ ok: false, code: 'SIMIT_PDF_NO_TEXT', message: 'El PDF no contiene texto extraíble. Descarga nuevamente el Estado de Cuenta desde SIMIT o genera una versión con texto seleccionable.' }, { status: 422 });

    const deterministicRecords = parseOfficialSimitText(text);
    const primary = await aiAnalyze(text, 'primary');
    const primaryRecords = validateRecords(primary.records || [], text);
    let recovery: AiAnalysis = {}; let recoveryRecords: ExtractedRecord[] = [];
    const mergedPrimary = mergeRecords(deterministicRecords, primaryRecords);
    const needsRecovery = Boolean(process.env.OPENAI_API_KEY) && (!mergedPrimary.length || (primary.documentConfidence || 0) < 75 || (primary.confidence || 0) < 75);
    if (needsRecovery) { recovery = await aiAnalyze(text, 'recovery'); recoveryRecords = validateRecords(recovery.records || [], text); }

    const records = mergeRecords(mergedPrimary, recoveryRecords);
    const bestAi = (recovery.confidence || 0) >= (primary.confidence || 0) ? recovery : primary;
    const documentNumber = suppliedDocumentNumber || inferDocumentNumber(records, text, bestAi);
    const ownerName = recovery.ownerName || primary.ownerName || records.find(r => r.ownerName)?.ownerName;
    const documentConfidence = Math.max(primary.documentConfidence || 0, recovery.documentConfidence || 0);
    const extractionConfidence = Math.max(primary.confidence || 0, recovery.confidence || 0);
    const documentLooksLikeSimit = looksLikeSimitStatement(text) || documentConfidence >= 70;

    if (suppliedDocumentNumber) {
      const aiNumbers = [primary.documentNumber, recovery.documentNumber].filter(Boolean).map(value => String(value).replace(/\D/g, ''));
      if (aiNumbers.some(value => value && value !== suppliedDocumentNumber)) return NextResponse.json({ ok: false, code: 'SIMIT_DOCUMENT_MISMATCH', message: 'La cédula indicada no coincide con el titular del Estado de Cuenta.' }, { status: 422 });
    }

    if (!records.length) {
      if (!documentLooksLikeSimit) return NextResponse.json({ ok: false, code: 'SIMIT_DOCUMENT_NOT_RECOGNIZED', message: 'El PDF fue leído, pero no parece ser un Estado de Cuenta SIMIT reconocible. Sube el Estado de Cuenta oficial descargado directamente desde SIMIT.', extraction: 'ai', textLength: text.length }, { status: 422 });
      return NextResponse.json({ ok: false, code: 'SIMIT_NO_RECORDS_CONFIRMED', message: 'El Estado de Cuenta SIMIT fue leído correctamente, pero la información de comparendos no pudo confirmarse con suficiente evidencia. TrámiteYa no inventará registros. Intenta nuevamente con el PDF oficial.', extraction: 'ai-first', documentNumber, ownerName, confidence: extractionConfidence, evidence: [...(primary.evidence || []), ...(recovery.evidence || [])].slice(0, 5) }, { status: 422 });
    }

    const recordsWithDocument = records.map(record => ({ ...record, ownerName: record.ownerName || ownerName, documentNumber: record.documentNumber || documentNumber || undefined }));
    console.log('[SIMIT AUDIT] statement_upload', JSON.stringify({ documentType: 'CC', documentNumber, ownerName, fileName: file.name, mimeType: file.type, size: file.size, textLength: text.length, records: recordsWithDocument.length, deterministicRecords: deterministicRecords.length, aiPrimaryRecords: primaryRecords.length, aiRecoveryRecords: recoveryRecords.length, confidence: extractionConfidence, documentConfidence, timestamp: new Date().toISOString() }));

    return NextResponse.json({ ok: true, source: 'SIMIT_STATEMENT_UPLOAD', extraction: 'ai-first-hybrid', documentType: 'CC', documentNumber, ownerName, fileName: file.name, records: recordsWithDocument, confidence: extractionConfidence, documentConfidence, evidence: [...(primary.evidence || []), ...(recovery.evidence || [])].slice(0, 5), message: `Estado de Cuenta analizado. Se encontraron ${recordsWithDocument.length} registro(s).` });
  } catch (error) {
    console.error('[SIMIT] statement upload error', error);
    return NextResponse.json({ ok: false, message: 'No fue posible analizar el Estado de Cuenta de SIMIT.' }, { status: 500 });
  }
}
