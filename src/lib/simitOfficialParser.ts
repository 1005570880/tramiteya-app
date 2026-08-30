import { findMatchingAuthority } from './constants/transitAuthorities';

export type ParsedSimitRecord = {
  kind: 'multa' | 'comparendo'; number?: string; date?: string; time?: string;
  authority?: string; municipality?: string; department?: string; plate?: string;
  ownerName?: string; documentNumber?: string; infractionCode?: string; description?: string;
  status?: string; value?: number; resolutionNumber?: string; resolutionDate?: string;
  notificationDate?: string; paymentDate?: string;
};

const DATE_RE = /\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/g;
const TIME_RE = /\b\d{1,2}:\d{2}(?::\d{2})?\b/;
const STATUS_RE = /\b(Pendiente(?:\s+de\s+pago)?|Cobro\s+coactivo|Pagado|Cancelado|Acuerdo\s+de\s+pago|Vigente|En\s+cobro)\b/i;
const CODE_RE = /(?:^|[^A-Z0-9])([A-D]\d{2,3})(?=$|[^A-Z0-9])/i;
const PLATE_RE = /\b([A-Z]{3}[ -]?\d{3})\b/gi;
const ID_RE_20 = /(?<!\d)(?:\d\s*){20}(?!\d)/g;
const ID_RE_LOCAL = /\b\d{8,12}\b/g;
const SPECIAL_ID_RE = /\b(?:\d{4}-[A-Z0-9]+-[A-Z0-9]+|[A-Z]{2}-\d{4}-\d+|\d{4}-\d+-SA)\b/gi;
const LEGACY_ID_RE = /\b\d{9}S\b/gi;

function normalizeWhitespace(value: string) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/Pendiente\s+de\s+pago/gi, 'Pendiente de pago')
    .replace(/Cobro\s+coactivo/gi, 'Cobro coactivo')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n')
    .trim();
}
function compactDigits(value: string) { return String(value ?? '').replace(/\D/g, ''); }
function clean(value: string) { return String(value ?? '').replace(/\s+/g, ' ').replace(/^\|+|\|+$/g, '').trim(); }
function numberValue(value: string) { const n = Number(String(value).replace(/[^0-9]/g, '')); return Number.isFinite(n) ? n : undefined; }
function extractDate(value: string) { DATE_RE.lastIndex = 0; return String(value).match(DATE_RE)?.[0]; }
function extractTime(value: string) { return String(value).match(TIME_RE)?.[0]; }
function extractStatus(value: string) { return String(value).match(STATUS_RE)?.[1]; }
function extractCode(value: string) { return String(value).match(CODE_RE)?.[1]?.toUpperCase(); }

function extractAmount(value: string): number | undefined {
  const matches = [...String(value).matchAll(/(?:\$\s*)?([0-9]{1,3}(?:[.,\s][0-9]{3})+|[0-9]{4,})\b/g)];
  const candidates = matches.map(m => m[1])
    .filter(v => !/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(v))
    .map(v => numberValue(v))
    .filter((v): v is number => v !== undefined && v >= 10000 && v < 100000000);
  return candidates.length ? candidates[candidates.length - 1] : undefined;
}

export function extractSimitDocumentNumber(input: string): string | undefined {
  const text = normalizeWhitespace(input);
  const patterns = [
    /(?:c[eé]dula|cedula)\s*(?:de\s+)?(?:n[uú]mero|no\.?|nro\.?|n[º°])?\s*[:#-]?\s*((?:\d[\s\n]*){6,10})(?=\D|$)/i,
    /(?:documento\s+de\s+identidad|n[uú]mero\s+de\s+identificaci[oó]n|identificaci[oó]n)\s*[:#-]?\s*((?:\d[\s\n]*){6,10})(?=\D|$)/i,
    /\b(?:CC|C\.C\.)\s*[:#-]?\s*((?:\d[\s\n]*){6,10})(?=\D|$)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p); const d = m?.[1] ? compactDigits(m[1]) : '';
    if (/^\d{6,10}$/.test(d)) return d;
  }
  const i = text.search(/estado\s+de\s+cuenta/i);
  if (i >= 0) {
    const m = text.slice(i, i + 500).match(/\b\d{6,10}\b/);
    if (m) return m[0];
  }
  return undefined;
}

export function extractSimitPlate(input: string): string | undefined {
  const text = normalizeWhitespace(input);
  for (const p of [
    /(?:^|[\n|])\s*(?:placa|plca)[^A-Z0-9]{0,30}([A-Z]{3}[ -]?\d{3})\b/im,
    /(?:placa|plca)[^A-Z0-9]{0,20}([A-Z]{3}[ -]?\d{3})\b/i,
  ]) { const m = text.match(p); if (m?.[1]) return m[1].replace(/[ -]/g, '').toUpperCase(); }
  for (const m of text.matchAll(PLATE_RE)) {
    const plate = m[1].replace(/[ -]/g, '').toUpperCase();
    if (/^[A-Z]{3}\d{3}$/.test(plate)) return plate;
  }
  return undefined;
}

/**
 * Extracts the transit authority dynamically from the SIMIT row layout.
 * No municipality/city allow-list is used. The semantic column is the text
 * between the row's date/time and its infraction code.
 */
function extractAuthorityBetweenDateAndCode(body: string, date: string, code?: string): string | undefined {
  if (!date || !code) return undefined;
  const dateIndex = body.indexOf(date);
  if (dateIndex < 0) return undefined;

  const afterDate = body.slice(dateIndex + date.length);
  const codeIndex = afterDate.search(new RegExp(`\\b${code.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i'));
  if (codeIndex < 0) return undefined;

  let authority = afterDate.slice(0, codeIndex)
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(/\b(?:fecha|hora|comparendo|c[oó]digo|infracci[oó]n|organismo(?:\s+de)?\s+tr[aá]nsito)\b/gi, ' ')
    .replace(/[|#\t\n\r]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // The slice can contain a preceding column separator or an item marker.
  authority = authority.replace(/^(?:\d{1,2}\.\s*)+/, '').replace(/^[-–—:]+|[-–—:]+$/g, '').trim();
  if (authority.length < 3) return undefined;

  // Reject obvious non-authority fragments while keeping extraction dynamic.
  if (/^(?:pendiente(?: de pago)?|cobro coactivo|pagado|cancelado)$/i.test(authority)) return undefined;
  return authority;
}

function extractMunicipality(body: string, date: string, code?: string) {
  const i = body.indexOf(date); if (i < 0) return undefined;
  let s = body.slice(i + date.length).replace(/^\s*\d{1,2}:\d{2}(?::\d{2})?\s*/, '');
  if (code) { const j = s.search(new RegExp(`\\b${code}\\b`, 'i')); if (j >= 0) s = s.slice(0, j); }
  s = clean(s).replace(/^(?:\|\s*)+/, '');
  return s && !/^[0-9.,\s$]+$/.test(s) ? s : undefined;
}

function identifiers(text: string, documentNumber?: string) {
  const out: { number: string; index: number }[] = [];
  const seen = new Set<string>();
  const push = (number: string, index: number) => {
    const normalized = number.includes('-') || /S$/i.test(number) ? number.replace(/\s/g, '') : compactDigits(number);
    if (!normalized || seen.has(`${normalized}|${index}`) || normalized === documentNumber) return;
    if (/^018000\d+/.test(normalized) || /^333602\d+/.test(normalized)) return;
    // Avoid treating dates/times/identity numbers as local comparendo IDs.
    if (/^\d{8,12}$/.test(normalized)) {
      if (/^\d{2}[01]\d[0-3]\d\d{4}$/.test(normalized)) return;
      if (/^\d{1,2}0?\d{1,2}\d{4}$/.test(normalized)) return;
    }
    seen.add(`${normalized}|${index}`);
    out.push({ number: normalized, index });
  };
  for (const m of text.matchAll(ID_RE_20)) push(m[0], m.index ?? 0);
  for (const m of text.matchAll(SPECIAL_ID_RE)) push(m[0], m.index ?? 0);
  for (const m of text.matchAll(LEGACY_ID_RE)) push(m[0], m.index ?? 0);
  for (const m of text.matchAll(ID_RE_LOCAL)) push(m[0], m.index ?? 0);
  return out.sort((a, b) => a.index - b.index);
}

function parseChunk(number: string, chunk: string): ParsedSimitRecord | undefined {
  const body = clean(chunk);
  const date = extractDate(body);
  if (!date) return undefined;
  const code = extractCode(body);
  const value = extractAmount(body);
  const dynamicAuthority = code ? extractAuthorityBetweenDateAndCode(body, date, code) : undefined;
  const municipality = dynamicAuthority || extractMunicipality(body, date, code);
  const plate = (() => { const m = body.match(PLATE_RE); return m?.[1]?.replace(/[ -]/g, '').toUpperCase(); })();
  return {
    kind: /cobro\s+coactivo/i.test(body) ? 'multa' : 'comparendo',
    number, date, time: extractTime(body), municipality,
    // Dynamic semantic extraction is authoritative. The legacy authority lookup
    // remains only as a final fallback for older layouts where the semantic column
    // is absent from the extracted text layer.
    authority: dynamicAuthority || authorityFromLegacyText(body, municipality), plate,
    infractionCode: code, status: extractStatus(body) || 'Pendiente', value,
  };
}

function authorityFromLegacyText(text: string, municipality?: string) {
  return (municipality ? findMatchingAuthority(municipality) : undefined) || findMatchingAuthority(text);
}

function dedupe(records: ParsedSimitRecord[]) {
  const map = new Map<string, ParsedSimitRecord>();
  for (const r of records) {
    const key = `${r.number}|${r.date}`;
    const old = map.get(key);
    map.set(key, old ? { ...old, ...r, value: r.value ?? old.value, authority: r.authority || old.authority, municipality: r.municipality || old.municipality, plate: r.plate || old.plate } : r);
  }
  return [...map.values()];
}

export function parseOfficialSimitText(input: string): ParsedSimitRecord[] {
  const raw = String(input ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\u00a0/g, ' ');
  if (!raw.trim()) return [];
  const text = normalizeWhitespace(raw);
  const documentNumber = extractSimitDocumentNumber(text);
  const ids = identifiers(text, documentNumber);
  const records: ParsedSimitRecord[] = [];

  for (let i = 0; i < ids.length; i++) {
    const start = ids[i].index;
    const end = ids[i + 1]?.index ?? text.length;
    // Use context before the identifier as well as after it. This handles SIMIT
    // layouts where the item marker/identifier is printed before the date columns
    // and layouts where the date precedes the identifier in the text layer.
    let chunk = text.slice(Math.max(0, start - 220), Math.min(text.length, Math.max(end, start + 420)));
    const total = chunk.search(/\bTotal\s+(?:a\s+)?pagar\b/i);
    if (total >= 0) chunk = chunk.slice(0, total);
    const record = parseChunk(ids[i].number, chunk);
    if (record) records.push(record);
  }

  return dedupe(records);
}
