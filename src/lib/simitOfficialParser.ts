import { findMatchingAuthority } from './constants/transitAuthorities';

export type ParsedSimitRecord = {
  kind: 'multa' | 'comparendo'; number?: string; date?: string; time?: string; authority?: string; municipality?: string; department?: string; plate?: string; ownerName?: string; documentNumber?: string; infractionCode?: string; description?: string; status?: string; value?: number; resolutionNumber?: string; resolutionDate?: string; notificationDate?: string; paymentDate?: string;
};

// Official SIMIT layouts include 20-digit records, 10-digit records, FAD/TC
// identifiers and legacy 9-10 digit identifiers ending in S. Do not broaden
// this to arbitrary 8-10 digit numbers because the PDF header contains the
// citizen's cédula and must never become a false comparendo.
const IDENTIFIER_RE = /(?:\d{20}|\d{9,10}S|\d{10}|\d{4}-FAD-\d+|TC-\d{4}-\d+|\d{4}-\d+-SA)/gi;
const DATE_RE = /\b\d{2}[/-]\d{2}[/-]\d{4}\b/g;
const TIME_RE = /\b\d{2}:\d{2}(?::\d{2})?\b/;
const STATUS_RE = /\b(Pendiente(?:\s+de\s+pago)?|Cobro\s+coactivo|Pagado|Cancelado|Acuerdo\s+de\s+pago|Vigente|En\s+cobro)\b/i;
const CODE_RE = /\b([A-D]\d{2})\b/i;
const PLATE_RE = /\b([A-Z]{3}[ -]?\d{3})\b/gi;

function normalizeWhitespace(value: string): string { return String(value ?? '').replace(/\r/g, '\n').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n').trim(); }
function compactDigits(value: string): string { return String(value || '').replace(/[^0-9]/g, ''); }
function clean(value: string): string { return String(value || '').replace(/\s+/g, ' ').replace(/^\|+|\|+$/g, '').trim(); }
function moneyToNumber(value: string): number | undefined { const digits = String(value || '').replace(/[^0-9]/g, ''); return digits ? Number(digits) : undefined; }
function extractMoney(value: string): number | undefined { const matches = [...String(value || '').matchAll(/\$\s*([0-9]{1,3}(?:[.,\s][0-9]{3})+|[0-9]{4,})\b/g)]; return matches.length ? moneyToNumber(matches[matches.length - 1][1]) : undefined; }
function extractDate(value: string): string | undefined { return String(value || '').match(DATE_RE)?.[0]; }
function extractTime(value: string): string | undefined { return String(value || '').match(TIME_RE)?.[0]; }
function extractStatus(value: string): string | undefined { const match = String(value || '').match(STATUS_RE); return match?.[1] ? clean(match[1]) : undefined; }
function extractCode(value: string): string | undefined { return String(value || '').match(CODE_RE)?.[1]?.toUpperCase(); }

export function extractSimitDocumentNumber(input: string): string | undefined {
  const text = normalizeWhitespace(input);
  if (!text) return undefined;
  const header = text.match(/estado\s+de\s+cuenta([\s\S]{0,300}?)(?:fecha\s+de\s+expedici[oó]n|c[eé]dula\s*:)/i)?.[1];
  if (header) {
    const candidate = header.match(/(?:^|\n|\|)\s*(\d{6,10})\s*(?=\n|\||$)/)?.[1] || header.match(/\b\d{6,10}\b/)?.[0];
    if (candidate) return candidate;
  }
  const headingIndex = text.search(/estado\s+de\s+cuenta/i);
  if (headingIndex >= 0) {
    const window = text.slice(headingIndex, headingIndex + 500);
    const candidates = [...window.matchAll(/\b\d{6,10}\b/g)].map(m => m[0]);
    const candidate = candidates.find(value => !/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(value));
    if (candidate) return candidate;
  }
  const labelledPatterns = [
    /(?:c[eé]dula|cedula)\s*(?:de\s+)?(?:n[uú]mero|no\.?|nro\.?|n[º°])?\s*[:#-]?\s*((?:\d[\s\n]*){6,10})(?=\D|$)/i,
    /(?:documento\s+de\s+identidad|n[uú]mero\s+de\s+identificaci[oó]n|identificaci[oó]n)\s*[:#-]?\s*((?:\d[\s\n]*){6,10})(?=\D|$)/i,
    /\b(?:CC|C\.C\.)\s*[:#-]?\s*((?:\d[\s\n]*){6,10})(?=\D|$)/i,
  ];
  for (const pattern of labelledPatterns) {
    const match = text.match(pattern); if (!match?.[1]) continue;
    const digits = compactDigits(match[1]); if (/^\d{6,10}$/.test(digits)) return digits;
  }
  return undefined;
}

/** Extract a Colombian plate from the actual plate field or nearby OCR/text. */
export function extractSimitPlate(input: string): string | undefined {
  const text = normalizeWhitespace(input);
  if (!text) return undefined;
  const labelledPatterns = [
    /(?:^|[\n|])\s*(?:placa|plca)\s*(?:del\s+veh[ií]culo|veh[ií]culo)?\s*[:#=\-]?\s*([A-Z]{3}[ -]?\d{3})\b/im,
    /(?:placa|plca)[^A-Z0-9]{0,20}([A-Z]{3}[ -]?\d{3})\b/i,
  ];
  for (const pattern of labelledPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
  }
  const matches = [...text.matchAll(PLATE_RE)].map(m => ({ plate: m[1].replace(/\s+/g, '').replace(/-/g, '').toUpperCase(), index: m.index ?? -1 }));
  for (const { plate, index } of matches) {
    const before = text.slice(Math.max(0, index - 60), index).toLowerCase();
    if (/documento|c[eé]dula|identificaci[oó]n|comparendo|resoluci[oó]n|radicado/.test(before)) continue;
    if (/^[A-Z]{3}\d{3}$/.test(plate)) return plate;
  }
  return undefined;
}

function authorityFromMunicipality(municipality: string | undefined, body: string): string | undefined { if (municipality) { const direct = findMatchingAuthority(municipality); if (direct) return direct; } return findMatchingAuthority(body); }
function extractMunicipality(body: string, date: string, code?: string): string | undefined {
  const dateIndex = body.indexOf(date); if (dateIndex < 0) return undefined;
  let after = body.slice(dateIndex + date.length).replace(/^\s*\d{2}:\d{2}(?::\d{2})?\s*/, '');
  if (code) { const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const codeIndex = after.search(new RegExp(`\\b${escapedCode}\\b`, 'i')); if (codeIndex >= 0) after = after.slice(0, codeIndex); }
  const value = clean(after).replace(/^(?:\|\s*)+/, '').replace(/(?:pendiente(?:\s+de\s+pago)?|cobro\s+coactivo|pagado|cancelado|vigente|en\s+cobro).*$/i, '').trim();
  if (!value || /^(?:\$|[0-9.,\s]+)$/.test(value)) return undefined; return value;
}
function parseRecord(number: string, chunk: string): ParsedSimitRecord | undefined {
  const body = clean(chunk); const date = extractDate(body); if (!date) return undefined;
  const code = extractCode(body); const status = extractStatus(body) || 'Pendiente'; const municipality = extractMunicipality(body, date, code); const authority = authorityFromMunicipality(municipality, body);
  return { kind: /cobro\s+coactivo/i.test(body) ? 'multa' : 'comparendo', number, date, time: extractTime(body), municipality, authority, plate: extractSimitPlate(body), infractionCode: code, status, value: extractMoney(body.replace(new RegExp(number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '')) };
}
function dedupe(records: ParsedSimitRecord[]): ParsedSimitRecord[] { const map = new Map<string, ParsedSimitRecord>(); for (const record of records) { const key = `${record.number || ''}|${record.date || ''}`; const previous = map.get(key); if (!previous) map.set(key, record); else map.set(key, { ...previous, ...record, authority: record.authority || previous.authority, municipality: record.municipality || previous.municipality, plate: record.plate || previous.plate, value: record.value ?? previous.value }); } return [...map.values()]; }

export function parseOfficialSimitText(input: string): ParsedSimitRecord[] {
  const text = normalizeWhitespace(input); if (!text) return [];
  const identifiers = [...text.matchAll(IDENTIFIER_RE)]; if (!identifiers.length) return [];
  const records: ParsedSimitRecord[] = [];
  for (let index = 0; index < identifiers.length; index++) { const match = identifiers[index]; const number = match[0].replace(/\s+/g, ''); const start = match.index ?? 0; const end = identifiers[index + 1]?.index ?? text.length; let chunk = text.slice(start, end); const totalIndex = chunk.search(/\bTotal\s+(?:a\s+)?pagar\b/i); if (totalIndex >= 0) chunk = chunk.slice(0, totalIndex); const record = parseRecord(number, chunk); if (record) records.push(record); }
  return dedupe(records);
}
