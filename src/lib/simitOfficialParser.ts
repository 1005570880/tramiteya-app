import { findMatchingAuthority } from './constants/transitAuthorities';

export type ParsedSimitRecord = {
  kind: 'multa' | 'comparendo';
  number?: string;
  date?: string;
  time?: string;
  authority?: string;
  municipality?: string;
  department?: string;
  plate?: string;
  ownerName?: string;
  documentNumber?: string;
  infractionCode?: string;
  description?: string;
  status?: string;
  value?: number;
  resolutionNumber?: string;
  resolutionDate?: string;
  notificationDate?: string;
  paymentDate?: string;
};

const DATE_RE = /\b\d{2}[/-]\d{2}[/-]\d{4}\b/g;
const TIME_RE = /\b\d{2}:\d{2}(?::\d{2})?\b/;
const STATUS_RE = /\b(Pendiente(?:\s+de\s+pago)?|Cobro\s+coactivo|Pagado|Cancelado|Acuerdo\s+de\s+pago|Vigente|En\s+cobro)\b/i;
const CODE_RE = /(?:^|[^A-Z0-9])([A-D]\d{2})(?=$|[^A-Z0-9])/i;
const PLATE_RE = /\b([A-Z]{3}[ -]?\d{3})\b/gi;
const CONTIGUOUS_ID_RE = /(?<!\d)\d{20}(?!\d)/g;

function normalizeWhitespace(value: string): string {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n')
    .trim();
}

function compactDigits(value: string): string { return String(value || '').replace(/[^0-9]/g, ''); }
function clean(value: string): string { return String(value || '').replace(/\s+/g, ' ').replace(/^\|+|\|+$/g, '').trim(); }
function moneyToNumber(value: string): number | undefined { const digits = String(value || '').replace(/[^0-9]/g, ''); return digits ? Number(digits) : undefined; }
function extractMoney(value: string): number | undefined {
  const matches = [...String(value || '').matchAll(/\$\s*([0-9]{1,3}(?:[.,\s][0-9]{3})+|[0-9]{4,})\b/g)];
  return matches.length ? moneyToNumber(matches[matches.length - 1][1]) : undefined;
}
function extractDate(value: string): string | undefined { DATE_RE.lastIndex = 0; return String(value || '').match(DATE_RE)?.[0]; }
function extractTime(value: string): string | undefined { return String(value || '').match(TIME_RE)?.[0]; }
function extractStatus(value: string): string | undefined { const match = String(value || '').match(STATUS_RE); return match?.[1] ? clean(match[1]) : undefined; }
function extractCode(value: string): string | undefined { return String(value || '').match(CODE_RE)?.[1]?.toUpperCase(); }

export function extractSimitDocumentNumber(input: string): string | undefined {
  const text = normalizeWhitespace(input); if (!text) return undefined;
  const patterns = [
    /(?:c[eé]dula|cedula)\s*(?:de\s+)?(?:n[uú]mero|no\.?|nro\.?|n[º°])?\s*[:#-]?\s*((?:\d[\s\n]*){6,10})(?=\D|$)/i,
    /(?:documento\s+de\s+identidad|n[uú]mero\s+de\s+identificaci[oó]n|identificaci[oó]n)\s*[:#-]?\s*((?:\d[\s\n]*){6,10})(?=\D|$)/i,
    /\b(?:CC|C\.C\.)\s*[:#-]?\s*((?:\d[\s\n]*){6,10})(?=\D|$)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern); const digits = match?.[1] ? compactDigits(match[1]) : '';
    if (/^\d{6,10}$/.test(digits)) return digits;
  }
  const headingIndex = text.search(/estado\s+de\s+cuenta/i);
  if (headingIndex >= 0) {
    const window = text.slice(headingIndex, headingIndex + 700);
    const candidates = [...window.matchAll(/\b\d{6,10}\b/g)].map(m => m[0]);
    const candidate = candidates.find(value => !/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(value));
    if (candidate) return candidate;
  }
  return undefined;
}

export function extractSimitPlate(input: string): string | undefined {
  const text = normalizeWhitespace(input); if (!text) return undefined;
  const labelled = [
    /(?:^|[\n|])\s*(?:placa|plca)[^\n|:]*[:#=\-]?\s*([A-Z]{3}[ -]?\d{3})\b/im,
    /(?:placa|plca)[^A-Z0-9]{0,30}([A-Z]{3}[ -]?\d{3})\b/i,
  ];
  for (const pattern of labelled) { const match = text.match(pattern); if (match?.[1]) return match[1].replace(/[ -]/g, '').toUpperCase(); }
  for (const match of text.matchAll(PLATE_RE)) {
    const plate = match[1].replace(/[ -]/g, '').toUpperCase();
    const before = text.slice(Math.max(0, (match.index ?? 0) - 60), match.index ?? 0).toLowerCase();
    if (!/documento|c[eé]dula|identificaci[oó]n|comparendo|resoluci[oó]n|radicado/.test(before)) return plate;
  }
  return undefined;
}

function authorityFromMunicipality(municipality: string | undefined, body: string): string | undefined { return (municipality && findMatchingAuthority(municipality)) || findMatchingAuthority(body); }

function extractMunicipality(body: string, date: string | undefined, code?: string): string | undefined {
  if (!date) return undefined;
  const dateIndex = body.indexOf(date); if (dateIndex < 0) return undefined;
  let after = body.slice(dateIndex + date.length).replace(/^\s*\d{2}:\d{2}(?::\d{2})?\s*/, '');
  if (code) {
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const codeIndex = after.search(new RegExp(`\\b${escaped}\\b`, 'i')); if (codeIndex >= 0) after = after.slice(0, codeIndex);
  }
  const value = clean(after).replace(/^(?:\|\s*)+/, '').replace(/(?:pendiente(?:\s+de\s+pago)?|cobro\s+coactivo|pagado|cancelado|vigente|en\s+cobro).*$/i, '').trim();
  if (!value || /^(?:\$|[0-9.,\s]+)$/.test(value)) return undefined;
  return value;
}

function buildRecord(number: string, body: string): ParsedSimitRecord | undefined {
  const date = extractDate(body); const code = extractCode(body); const status = extractStatus(body) || 'Pendiente';
  const municipality = extractMunicipality(body, date, code);
  const withoutNumber = body.replace(new RegExp(number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
  const value = extractMoney(withoutNumber);
  if (!/^\d{20}$/.test(number) || !date || !code || value === undefined) return undefined;
  return { kind: /cobro\s+coactivo/i.test(body) ? 'multa' : 'comparendo', number, date, time: extractTime(body), municipality, authority: authorityFromMunicipality(municipality, body), plate: extractSimitPlate(body), infractionCode: code, status, value };
}

/** Parse the numbered record layout used by official SIMIT statements. */
function parseNumberedStatementRecords(text: string): ParsedSimitRecord[] {
  const sectionMatch = text.match(/comparendos\s+y\s+multas([\s\S]*?)(?=\btotal\s+(?:a\s+)?pagar\b|$)/i);
  if (!sectionMatch?.[1]) return [];
  const section = sectionMatch[1];
  const anchors = [...section.matchAll(/(?:^|\n)\s*\d+\.\s*(\d{20})\b/g)];
  if (!anchors.length) return [];
  const records: ParsedSimitRecord[] = [];
  for (let i = 0; i < anchors.length; i += 1) {
    const match = anchors[i]; const number = match[1]; const start = match.index ?? 0; const nextStart = anchors[i + 1]?.index ?? section.length;
    let body = section.slice(start, nextStart).replace(/^\s*\d+\.\s*\d{20}\b/, number);
    const record = buildRecord(number, body); if (record) records.push(record);
  }
  return records;
}

function parseFallbackRecords(text: string): ParsedSimitRecord[] {
  const ids = [...text.matchAll(CONTIGUOUS_ID_RE)].map(match => ({ number: match[0], index: match.index ?? 0 }));
  const records: ParsedSimitRecord[] = [];
  for (let i = 0; i < ids.length; i += 1) {
    const current = ids[i]; const end = ids[i + 1]?.index ?? text.length; let chunk = text.slice(current.index, end);
    const totalIndex = chunk.search(/\bTotal\s+(?:a\s+)?pagar\b/i); if (totalIndex >= 0) chunk = chunk.slice(0, totalIndex);
    const record = buildRecord(current.number, chunk); if (record) records.push(record);
  }
  return records;
}

function dedupe(records: ParsedSimitRecord[]): ParsedSimitRecord[] {
  const map = new Map<string, ParsedSimitRecord>();
  for (const record of records) {
    if (!record.number) continue;
    const previous = map.get(record.number);
    map.set(record.number, previous ? { ...previous, ...record, date: record.date || previous.date, time: record.time || previous.time, authority: record.authority || previous.authority, municipality: record.municipality || previous.municipality, plate: record.plate || previous.plate, value: record.value ?? previous.value, infractionCode: record.infractionCode || previous.infractionCode, status: record.status || previous.status } : record);
  }
  return [...map.values()];
}

export function parseOfficialSimitText(input: string): ParsedSimitRecord[] {
  const text = normalizeWhitespace(input); if (!text) return [];
  const numbered = parseNumberedStatementRecords(text);
  return dedupe(numbered.length ? numbered : parseFallbackRecords(text));
}
