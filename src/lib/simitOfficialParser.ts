import { findMatchingAuthority } from './constants/transitAuthorities';

export type ParsedSimitRecord = {
  kind: 'multa' | 'comparendo'; number?: string; date?: string; time?: string; authority?: string; municipality?: string; department?: string; plate?: string; ownerName?: string; documentNumber?: string; infractionCode?: string; description?: string; status?: string; value?: number; resolutionNumber?: string; resolutionDate?: string; notificationDate?: string; paymentDate?: string;
};

const DATE_RE = /\b\d{2}[/-]\d{2}[/-]\d{4}\b/g;
const TIME_RE = /\b\d{2}:\d{2}(?::\d{2})?\b/;
const STATUS_RE = /\b(Pendiente(?:\s+de\s+pago)?|Cobro\s+coactivo|Pagado|Cancelado|Acuerdo\s+de\s+pago|Vigente|En\s+cobro)\b/i;
const CODE_RE = /(?:^|[^A-Z0-9])([A-D]\d{2})(?=$|[^A-Z0-9])/i;
const PLATE_RE = /\b([A-Z]{3}[ -]?\d{3})\b/gi;

// PDF extraction is not column-aware: a 20-digit identifier can be split
// across spaces/newlines and the row index may appear before or after it.
const SPACED_20_DIGIT_ID_RE = /(?<!\d)(?:\d[ \t\n\r]*){20}(?!\d)/g;
const LEGACY_ID_RE = /(?<![A-Z0-9])\d{6,10}S(?![A-Z0-9])/gi;
const FAD_ID_RE = /(?<![A-Z0-9])\d{4}-FAD-\d+(?![A-Z0-9])/gi;
const TC_ID_RE = /(?<![A-Z0-9])TC-\d{4}-\d+(?![A-Z0-9])/gi;
const SA_ID_RE = /(?<![A-Z0-9])\d{4}-\d+-SA(?![A-Z0-9])/gi;
const PLAIN_10_DIGIT_ID_RE = /(?<!\d)\d{10}(?!\d)/g;

function normalizeWhitespace(value: string): string { return String(value ?? '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n').trim(); }
function compactDigits(value: string): string { return String(value || '').replace(/[^0-9]/g, ''); }
function clean(value: string): string { return String(value || '').replace(/\s+/g, ' ').replace(/^\|+|\|+$/g, '').trim(); }
function moneyToNumber(value: string): number | undefined { const digits = String(value || '').replace(/[^0-9]/g, ''); return digits ? Number(digits) : undefined; }
function extractMoney(value: string): number | undefined { const matches = [...String(value || '').matchAll(/\$\s*([0-9]{1,3}(?:[.,\s][0-9]{3})+|[0-9]{4,})\b/g)]; return matches.length ? moneyToNumber(matches[matches.length - 1][1]) : undefined; }
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
  for (const pattern of patterns) { const match = text.match(pattern); const digits = match?.[1] ? compactDigits(match[1]) : ''; if (/^\d{6,10}$/.test(digits)) return digits; }
  const headingIndex = text.search(/estado\s+de\s+cuenta/i);
  if (headingIndex >= 0) { const window = text.slice(headingIndex, headingIndex + 700); const candidates = [...window.matchAll(/\b\d{6,10}\b/g)].map(m => m[0]); const candidate = candidates.find(value => !/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(value)); if (candidate) return candidate; }
  return undefined;
}

export function extractSimitPlate(input: string): string | undefined {
  const text = normalizeWhitespace(input); if (!text) return undefined;
  const labelled = [/(?:^|[\n|])\s*(?:placa|plca)[^\n|:]*[:#=\-]?\s*([A-Z]{3}[ -]?\d{3})\b/im, /(?:placa|plca)[^A-Z0-9]{0,30}([A-Z]{3}[ -]?\d{3})\b/i];
  for (const pattern of labelled) { const match = text.match(pattern); if (match?.[1]) return match[1].replace(/[ -]/g, '').toUpperCase(); }
  for (const match of text.matchAll(PLATE_RE)) { const plate = match[1].replace(/[ -]/g, '').toUpperCase(); const before = text.slice(Math.max(0, (match.index ?? 0) - 60), match.index ?? 0).toLowerCase(); if (!/documento|c[eé]dula|identificaci[oó]n|comparendo|resoluci[oó]n|radicado/.test(before)) return plate; }
  return undefined;
}

function authorityFromMunicipality(municipality: string | undefined, body: string): string | undefined { return (municipality && findMatchingAuthority(municipality)) || findMatchingAuthority(body); }
function extractMunicipality(body: string, date: string | undefined, code?: string): string | undefined {
  if (!date) return undefined; const dateIndex = body.indexOf(date); if (dateIndex < 0) return undefined;
  let after = body.slice(dateIndex + date.length).replace(/^\s*\d{2}:\d{2}(?::\d{2})?\s*/, '');
  if (code) { const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const codeIndex = after.search(new RegExp(`\\b${escaped}\\b`, 'i')); if (codeIndex >= 0) after = after.slice(0, codeIndex); }
  const value = clean(after).replace(/^(?:\|\s*)+/, '').replace(/(?:pendiente(?:\s+de\s+pago)?|cobro\s+coactivo|pagado|cancelado|vigente|en\s+cobro).*$/i, '').trim();
  if (!value || /^(?:\$|[0-9.,\s]+)$/.test(value)) return undefined; return value;
}

function buildRecord(number: string, body: string): ParsedSimitRecord | undefined {
  if (!number) return undefined;
  const date = extractDate(body); const code = extractCode(body); const status = extractStatus(body) || 'Pendiente'; const municipality = extractMunicipality(body, date, code);
  const withoutNumber = body.replace(new RegExp(number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
  const value = extractMoney(withoutNumber);
  return { kind: /cobro\s+coactivo/i.test(body) ? 'multa' : 'comparendo', number, date, time: extractTime(body), municipality, authority: authorityFromMunicipality(municipality, body), plate: extractSimitPlate(body), infractionCode: code, status, value };
}

type IdentifierAnchor = { number: string; index: number; end: number };

function collectIdentifierAnchors(text: string): IdentifierAnchor[] {
  const anchors: IdentifierAnchor[] = [];
  const add = (match: RegExpExecArray, normalize: (value: string) => string) => {
    const number = normalize(match[0]);
    if (number) anchors.push({ number, index: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
  };
  for (const regex of [SPACED_20_DIGIT_ID_RE, FAD_ID_RE, TC_ID_RE, SA_ID_RE, LEGACY_ID_RE]) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) add(match, value => /^(?:\d[ \t\n\r]*){20}$/.test(value) ? compactDigits(value) : value.replace(/\s+/g, ''));
  }

  const sectionStart = text.search(/comparendos\s+y\s+multas/i);
  if (sectionStart >= 0) {
    const sectionEnd = text.search(/\btotal\s+(?:a\s+)?pagar\b/i);
    const section = text.slice(sectionStart, sectionEnd >= 0 ? sectionEnd : text.length);
    PLAIN_10_DIGIT_ID_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = PLAIN_10_DIGIT_ID_RE.exec(section)) !== null) {
      const number = match[0]; const absoluteIndex = sectionStart + (match.index ?? 0);
      const before = section.slice(Math.max(0, (match.index ?? 0) - 30), match.index ?? 0);
      if (!/estado\s+de\s+cuenta|c[eé]dula|documento|identificaci[oó]n/i.test(before)) anchors.push({ number, index: absoluteIndex, end: absoluteIndex + number.length });
    }
  }
  return anchors.sort((a, b) => a.index - b.index).filter((anchor, index, all) => index === 0 || anchor.number !== all[index - 1].number || anchor.index !== all[index - 1].index);
}

function parseIdentifierAnchors(text: string): ParsedSimitRecord[] {
  const anchors = collectIdentifierAnchors(text);
  if (!anchors.length) return [];
  return anchors.map((anchor, i) => {
    const start = anchor.index; const nextStart = anchors[i + 1]?.index ?? text.length;
    const body = text.slice(Math.max(0, start - 80), nextStart);
    return buildRecord(anchor.number, body);
  }).filter((record): record is ParsedSimitRecord => Boolean(record));
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
  return dedupe(parseIdentifierAnchors(text));
}
