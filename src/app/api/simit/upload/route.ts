import { NextRequest, NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import { extractSimitDocumentNumber, extractSimitPlate, parseOfficialSimitText } from '@/lib/simitOfficialParser';
import { lookupSimitByDocument } from '@/lib/simitProvider';

export const runtime = 'nodejs';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 140000;

type ExtractedRecord = { kind?: 'multa' | 'comparendo'; number?: string; date?: string; authority?: string; department?: string; municipality?: string; plate?: string; ownerName?: string; documentNumber?: string; infractionCode?: string; description?: string; status?: string; value?: number; resolutionNumber?: string; resolutionDate?: string; notificationDate?: string; paymentDate?: string; organismId?: string; photoDetection?: boolean };
type AiAnalysis = { ownerName?: string; documentNumber?: string; records?: ExtractedRecord[]; confidence?: number; evidence?: string[] };

function normalizeRecord(record: ExtractedRecord): ExtractedRecord | undefined { const number = String(record.number ?? '').replace(/\s+/g, '').trim(); if (!number) return undefined; return { ...record, number, kind: String(record.kind ?? '').toLowerCase().includes('multa') ? 'multa' : 'comparendo', value: typeof record.value === 'number' && Number.isFinite(record.value) ? record.value : undefined }; }
function mergeEnrichment(base: ExtractedRecord[], ai: ExtractedRecord[]) { const byNumber = new Map(ai.map(raw => { const r = normalizeRecord(raw); return [r?.number || '', r]; }).filter(([number]) => Boolean(number)) as [string, ExtractedRecord][]); return base.map(raw => { const record = normalizeRecord(raw) || raw; const extra = byNumber.get(record.number || ''); if (!extra) return record; const merged = { ...record }; for (const key of Object.keys(extra) as (keyof ExtractedRecord)[]) if ((merged[key] === undefined || merged[key] === null || merged[key] === '') && extra[key] !== undefined && extra[key] !== null && extra[key] !== '') merged[key] = extra[key] as never; return merged; }); }
function normalizeDocument(value: unknown) { const digits = String(value ?? '').replace(/\D/g, ''); return /^\d{6,10}$/.test(digits) ? digits : ''; }
function inferDocumentNumber(text: string, ai: AiAnalysis) { const deterministic = extractSimitDocumentNumber(text); if (deterministic) return deterministic; const aiNumber = normalizeDocument(ai.documentNumber); if (aiNumber) return aiNumber; const fallback = text.match(/(?:documento|identificaci[oó]n|CC)\s*(?:n[roº°.]?\s*)?[:\-|]*\s*(?:\|\s*)?(?:\n\s*)?(\d{6,10})\b/i); return fallback?.[1] ? normalizeDocument(fallback[1]) : ''; }
function extractTotal(text: string) { const match = text.match(/(?:total\s+(?:a\s+)?pagar|total\s+deuda|total\s+pendiente)[^$0-9]{0,40}\$?\s*([0-9.,]{4,})/i); return match?.[1] ? Number(match[1].replace(/[^0-9]/g, '')) : undefined; }
function looksLikeSimit(text: string) { const n = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ' '); const signals = ['estado de cuenta', 'comparendos y multas', 'simit'].filter(x => n.includes(x)).length; if (signals >= 2) return true; const hasIdentifier = /(?:\d{20}|\d{10}|\d{4}-FAD-\d+|TC-\d{4}-\d+|\d{4}-\d+-SA)/i.test(text); const hasDate = /\b\d{2}[/-]\d{2}[/-]\d{4}\b/.test(text); return hasIdentifier && hasDate; }

async function aiEnrich(text: string, deterministicRecords: ExtractedRecord[]): Promise<AiAnalysis> { const key = process.env.OPENAI_API_KEY; if (!key || !deterministicRecords.length) return {}; const prompt = `Eres un enriquecedor documental. NO puedes crear, eliminar ni cambiar registros. Recibes registros determinísticos ya identificados en un Estado de Cuenta SIMIT. Solo completa campos vacíos cuando el dato esté literalmente presente en el texto. Devuelve JSON {"ownerName":"","documentNumber":"","records":[{"number":"","date":"","authority":"","department":"","plate":"","infractionCode":"","description":"","status":"","value":0,"resolutionNumber":"","resolutionDate":"","notificationDate":"","paymentDate":""}],"confidence":0,"evidence":[]}. Conserva exactamente los números de comparendo existentes.\nREGISTROS:\n${JSON.stringify(deterministicRecords)}\nTEXTO:\n${text.slice(0, MAX_TEXT_CHARS)}`; try { const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: process.env.OPENAI_SIMIT_MODEL || 'gpt-4o-mini', temperature: 0, messages: [{ role: 'system', content: 'Solo enriqueces evidencia existente. Nunca inventes registros.' }, { role: 'user', content: prompt }], response_format: { type: 'json_object' } }) }); if (!response.ok) return {}; const data = await response.json(); const content = data?.choices?.[0]?.message?.content; if (!content) return {}; const parsed = JSON.parse(content); return { ownerName: parsed?.ownerName ? String(parsed.ownerName) : undefined, documentNumber: parsed?.documentNumber ? normalizeDocument(parsed.documentNumber) : undefined, records: Array.isArray(parsed?.records) ? parsed.records : [], confidence: Number(parsed?.confidence || 0), evidence: Array.isArray(parsed?.evidence) ? parsed.evidence.map(String).slice(0, 5) : [] }; } catch { return {}; } }

async function enrichPlatesFromSimit(documentNumber: string, records: ExtractedRecord[]) { if (!documentNumber || records.every(record => record.plate)) return records; try { const result = await lookupSimitByDocument('CC', documentNumber); const byNumber = new Map(result.comparendos.map(record => [String(record.number || '').replace(/\s+/g, ''), record])); return records.map(record => { if (record.plate) return record; const match = byNumber.get(String(record.number || '').replace(/\s+/g, '')); if (!match?.plate) return record; return { ...record, plate: match.plate }; }); } catch (error) { console.warn('[SIMIT AUDIT] plate_provider_enrichment_unavailable', JSON.stringify({ documentNumber, reason: error instanceof Error ? error.message : String(error) })); return records; } }

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ ok: false, success: false, message: 'Selecciona el Estado de Cuenta de SIMIT.' }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ ok: false, success: false, message: 'El archivo supera el límite de 10 MB.' }, { status: 413 });
    if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) return NextResponse.json({ ok: false, success: false, message: 'Sube únicamente el Estado de Cuenta en PDF descargado desde SIMIT.' }, { status: 415 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsedPdf = await pdf(buffer);
    const text = String(parsedPdf.text || '').trim();
    if (!text) return NextResponse.json({ ok: false, success: false, code: 'SIMIT_PDF_NO_TEXT', message: 'El PDF no contiene texto extraíble. Descarga nuevamente el Estado de Cuenta desde SIMIT.' }, { status: 422 });
    if (!looksLikeSimit(text)) return NextResponse.json({ ok: false, success: false, code: 'SIMIT_DOCUMENT_NOT_RECOGNIZED', message: 'El PDF no presenta la estructura esperada de un Estado de Cuenta SIMIT.' }, { status: 422 });

    const deterministicRecords = parseOfficialSimitText(text);
    if (!deterministicRecords.length) return NextResponse.json({ ok: false, success: false, code: 'SIMIT_NO_DETERMINISTIC_RECORDS', rawText: text, records: [], comparendos: [], message: 'El Estado de Cuenta SIMIT fue leído, pero no se identificaron números de comparendo válidos en el texto extraído.' }, { status: 422 });

    const ai = await aiEnrich(text, deterministicRecords);
    const records = mergeEnrichment(deterministicRecords, ai.records || []);
    const documentNumber = inferDocumentNumber(text, ai);
    const globalPlate = extractSimitPlate(text);
    const recordsWithProviderPlate = await enrichPlatesFromSimit(documentNumber, records);
    const finalGlobalPlate = globalPlate || recordsWithProviderPlate.find(record => record.plate)?.plate;
    const hydratedRecords = recordsWithProviderPlate.map(record => ({ ...record, documentNumber: record.documentNumber || documentNumber || undefined, plate: record.plate || finalGlobalPlate || undefined }));
    const totalDebt = extractTotal(text);
    const ownerName = ai.ownerName || hydratedRecords.find(r => r.ownerName)?.ownerName;
    if (ai.documentNumber && documentNumber && ai.documentNumber !== documentNumber) return NextResponse.json({ ok: false, success: false, code: 'SIMIT_DOCUMENT_MISMATCH', rawText: text, records: hydratedRecords, comparendos: hydratedRecords, message: 'La identidad encontrada en el documento no es consistente.' }, { status: 422 });

    console.log('[SIMIT AUDIT] statement_upload', JSON.stringify({ documentType: 'CC', documentNumber, plate: finalGlobalPlate, ownerName, fileName: file.name, size: file.size, textLength: text.length, deterministicRecords: deterministicRecords.length, finalRecords: hydratedRecords.length, totalDebt, aiUsed: Boolean(process.env.OPENAI_API_KEY), providerPlateEnrichment: Boolean(finalGlobalPlate && !globalPlate), timestamp: new Date().toISOString() }));

    // Contracto estable para la UI: nunca obliga al frontend a conocer la implementación interna del parser.
    // `records` y `comparendos` contienen exactamente la misma colección normalizada.
    return NextResponse.json({
      ok: true,
      success: true,
      source: 'SIMIT_STATEMENT_UPLOAD',
      extraction: process.env.OPENAI_API_KEY ? 'deterministic+ai-enrichment' : 'deterministic',
      rawText: text,
      extractionData: { documentNumber: documentNumber || null, plate: finalGlobalPlate || null, recordCount: hydratedRecords.length },
      documentType: 'CC', documentNumber, ownerName, plate: finalGlobalPlate, fileName: file.name,
      recordCount: hydratedRecords.length, totalDebt,
      records: hydratedRecords,
      comparendos: hydratedRecords,
      confidence: ai.confidence || 100,
      evidence: ai.evidence || [],
      message: `Estado de Cuenta SIMIT identificado. ${hydratedRecords.length} comparendos y multas encontrados.`
    });
  } catch (error) {
    console.error('[SIMIT] statement upload error', error);
    return NextResponse.json({ ok: false, success: false, message: 'No fue posible analizar el Estado de Cuenta de SIMIT.' }, { status: 500 });
  }
}
