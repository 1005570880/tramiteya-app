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
const ID_RE_LOCAL = /\b\d{9,12}\b/g;
const SPECIAL_ID_RE = /\b(?:\d{4}-[A-Z0-9]+-[A-Z0-9]+|[A-Z]{2}-\d{4}-\d+|\d{4}-\d+-SA)\b/gi;
const LEGACY_ID_RE = /\b\d{9}S\b/gi;

function normalizeWhitespace(value: string) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/Pendiente\s+de\s+pago/gi, 'Pendiente de pago')
    .replace(/Cobro\s+coactivo/gi, 'Cobro coactivo')
    .replace(/Agustin\s*\n\s*Codazzi/gi, 'Agustin Codazzi')
    .replace(/Dptal\s+Cesar\s*-\s*\n\s*IDTRACESAR/gi, 'Dptal Cesar - IDTRACESAR')
    .replace(/Sampues\s*-\s*\n\s*Dptal\s+Sucre/gi, 'Sampues - Dptal Sucre')
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

function authorityFromText(text: string, municipality?: string) {
  return (municipality ? findMatchingAuthority(municipality) : undefined) || findMatchingAuthority(text);
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
  const push = (number: string, index: number) => {
    const normalized = number.includes('-') || /S$/i.test(number) ? number.replace(/\s/g, '') : compactDigits(number);
    if (!normalized || normalized === documentNumber) return;
    if (/^\d{6,10}$/.test(normalized) && normalized === documentNumber) return;
    if (/^\d{9,12}$/.test(normalized)) {
      // Local 9–12 digit IDs are valid comparendo numbers, but never treat dates,
      // times, or the holder's identity number as a record identifier.
      if (/^\d{8,12}$/.test(normalized) && (normalized === documentNumber || normalized.length === 10 && /^20\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(normalized))) return;
    }
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
  const municipality = extractMunicipality(body, date, code);
  const plate = (() => { const m = body.match(PLATE_RE); return m?.[1]?.replace(/[ -]/g, '').toUpperCase(); })();
  return {
    kind: /cobro\s+coactivo/i.test(body) ? 'multa' : 'comparendo',
    number, date, time: extractTime(body), municipality,
    authority: authorityFromText(body, municipality), plate,
    infractionCode: code, status: extractStatus(body) || 'Pendiente', value,
  };
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

  // Handles both SIMIT layouts: identifier before the row marker and row marker
  // before the identifier. Each candidate is evaluated by the presence of a real
  // date, so incidental 9–12 digit values do not become fabricated comparendos.
  for (let i = 0; i < ids.length; i++) {
    const start = ids[i].index;
    const previous = ids[i - 1];
    const end = ids[i + 1]?.index ?? text.length;
    let chunk = text.slice(start, end);
    // In the layout where "1." precedes the 20-digit identifier, retain a little
    // context before the identifier for columns that PDF text extraction reverses.
    if (previous && /^\d{1,2}$/.test(previous.number)) chunk = text.slice(Math.max(0, start - 120), end);
    const total = chunk.search(/\bTotal\s+(?:a\s+)?pagar\b/i);
    if (total >= 0) chunk = chunk.slice(0, total);
    const record = parseChunk(ids[i].number, chunk);
    if (record) records.push(record);
  }

  return dedupe(records);
}
