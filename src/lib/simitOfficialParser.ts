import { findMatchingAuthority } from './constants/transitAuthorities';

export type ParsedSimitRecord = {
  kind: 'multa' | 'comparendo'; number?: string; date?: string; time?: string; authority?: string; municipality?: string; department?: string; plate?: string; ownerName?: string; documentNumber?: string; infractionCode?: string; description?: string; status?: string; value?: number; resolutionNumber?: string; resolutionDate?: string; notificationDate?: string; paymentDate?: string;
};

const DATE_RE = /\b\d{2}[/-]\d{2}[/-]\d{4}\b/g;
const TIME_RE = /\b\d{2}:\d{2}(?::\d{2})?\b/;
const STATUS_RE = /\b(Pendiente(?:\s+de\s+pago)?|Cobro\s+coactivo|Pagado|Cancelado|Acuerdo\s+de\s+pago|Vigente|En\s+cobro)\b/i;
const CODE_RE = /(?:^|[^A-Z0-9])([A-D]\d{2})(?=$|[^A-Z0-9])/i;
const PLATE_RE = /\b([A-Z]{3}[ -]?\d{3})\b/gi;
const CONTIGUOUS_ID_RE = /(?<!\d)\d{20}(?!\d)/g;
const SPECIAL_ID_RE = /\b(?:\d{4}-FAD-\d+|TC-\d{4}-\d+|\d{4}-\d+-SA)\b/gi;
const LEGACY_ID_RE = /(?<![A-Z0-9])\d{6,12}S(?![A-Z0-9])/gi;

function normalizeWhitespace(value: string): string { return String(value ?? '').replace(/\r/g, '\n').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n').trim(); }
function normalizeIdentifier(value: string): string { return String(value || '').replace(/\s+/g, '').trim(); }
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
  const labelledPatterns = [
    /(?:c[eé]dula|cedula)\s*(?:de\s+)?(?:n[uú]mero|no\.?|nro\.?|n[º°])?\s*[:#-]?\s*((?:\d[\s\n]*){6,10})(?=\D|$)/i,
    /(?:documento\s+de\s+identidad|n[uú]mero\s+de\s+identificaci[oó]n|identificaci[oó]n)\s*[:#-]?\s*((?:\d[\s\n]*){6,10})(?=\D|$)/i,
    /\b(?:CC|C\.C\.)\s*[:#-]?\s*((?:\d[\s\n]*){6,10})(?=\D|$)/i,
  ];
  for (const pattern of labelledPatterns) { const match = text.match(pattern); if (match?.[1]) { const digits = compactDigits(match[1]); if (/^\d{6,10}$/.test(digits)) return digits; } }
  const headingIndex = text.search(/estado\s+de\s+cuenta/i);
  if (headingIndex >= 0) { const window = text.slice(headingIndex, headingIndex + 500); const candidates = [...window.matchAll(/\b\d{6,10}\b/g)].map(m => m[0]); const candidate = candidates.find(value => !/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(value)); if (candidate) return candidate; }
  return undefined;
}

export function extractSimitPlate(input: string): string | undefined {
  const text = normalizeWhitespace(input); if (!text) return undefined;
  const labelledPatterns = [
    /(?:^|[\n|])\s*(?:placa|plca)\s*(?:del\s+veh[ií]culo|veh[ií]culo)?\s*[:#=\-]?\s*([A-Z]{3}[ -]?\d{3})\b/im,
    /(?:placa|plca)[^A-Z0-9]{0,20}([A-Z]{3}[ -]?\d{3})\b/i,
  ];
  for (const pattern of labelledPatterns) { const match = text.match(pattern); if (match?.[1]) return match[1].replace(/\s+/g, '').replace(/-/g, '').toUpperCase(); }
  const matches = [...text.matchAll(PLATE_RE)].map(m => ({ plate: m[1].replace(/\s+/g, '').replace(/-/g, '').toUpperCase(), index: m.index ?? -1 }));
  for (const { plate, index } of matches) { const before = text.slice(Math.max(0, index - 60), index).toLowerCase(); if (/documento|c[eé]dula|identificaci[oó]n|comparendo|resoluci[oó]n|radicado/.test(before)) continue; if (/^[A-Z]{3}\d{3}$/.test(plate)) return plate; }
  return undefined;
}

function authorityFromMunicipality(municipality: string | undefined, body: string): string | undefined { if (municipality) { const direct = findMatchingAuthority(municipality); if (direct) return direct; } return findMatchingAuthority(body); }
function extractMunicipality(body: string, date: string, code?: string): string | undefined {
  const dateIndex = body.indexOf(date); if (dateIndex < 0) return undefined;
  let after = body.slice(dateIndex + date.length).replace(/^\s*\d{2}:\d{2}(?::\d{2})?\s*/, '');
  if (code) { const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const codeIndex = after.search(new RegExp(`\\b${escapedCode}\\b`, 'i')); if (codeIndex >= 0) after = after.slice(0, codeIndex); }
  const value = clean(after).replace(/^(?:\|\s*)+/, '').replace(/(?:pendiente(?:\s+de\s+pago)?|cobro\s+coactivo|pagado|cancelado|vigente|en\s+cobro).*$/i, '').trim();
  if (!value || /^(?:\$|[0-9.,\s]+)$/.test(value)) return undefined;
  return value;
}

function parseRecord(number: string, chunk: string): ParsedSimitRecord | undefined {
  const body = clean(chunk); const date = extractDate(body); if (!date) return undefined;
  const code = extractCode(body); const status = extractStatus(body) || 'Pendiente'; const municipality = extractMunicipality(body, date, code); const authority = authorityFromMunicipality(municipality, body);
  const withoutNumber = body.replace(new RegExp(number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
  return { kind: /cobro\s+coactivo/i.test(body) ? 'multa' : 'comparendo', number, date, time: extractTime(body), municipality, authority, plate: extractSimitPlate(body), infractionCode: code, status, value: extractMoney(withoutNumber) };
}

function dedupe(records: ParsedSimitRecord[]): ParsedSimitRecord[] {
  const map = new Map<string, ParsedSimitRecord>();
  for (const record of records) {
    const key = `${record.number || ''}|${record.date || ''}`; const previous = map.get(key);
    if (!previous) map.set(key, record); else map.set(key, { ...previous, ...record, authority: record.authority || previous.authority, municipality: record.municipality || previous.municipality, plate: record.plate || previous.plate, value: record.value ?? previous.value, infractionCode: record.infractionCode || previous.infractionCode });
  }
  return [...map.values()];
}

function findRecordIdentifiers(text: string): Array<{ number: string; index: number }> {
  const found: Array<{ number: string; index: number }> = []; const seen = new Set<string>();
  const add = (number: string, index: number) => { const normalized = normalizeIdentifier(number); const key = `${normalized}|${index}`; if (!seen.has(key)) { seen.add(key); found.push({ number: normalized, index }); } };
  for (const match of text.matchAll(CONTIGUOUS_ID_RE)) add(match[0], match.index ?? 0);
  for (const match of text.matchAll(SPECIAL_ID_RE)) add(match[0], match.index ?? 0);
  for (const match of text.matchAll(LEGACY_ID_RE)) add(match[0], match.index ?? 0);
  const splitIdRe = /(?:^|[^0-9])((?:\d[\s|]*){20})(?!\d)/g;
  for (const match of text.matchAll(splitIdRe)) { const number = compactDigits(match[1]); const index = (match.index ?? 0) + (match[0].length - match[1].length); const localWindow = text.slice(index, index + 320); if (/^\d{20}$/.test(number) && extractDate(localWindow)) add(number, index); }
  return found.sort((a, b) => a.index - b.index);
}

/**
 * SIMIT PDFs vary substantially between exports. The official record number
 * is the safest anchor. A record is accepted when that anchor is followed by
 * a date; code and value are optional because some legitimate PDFs omit them
 * from the text layer. This prevents the false negative that used to reject
 * otherwise readable official statements.
 */
function parseTokenAnchoredRows(text: string): ParsedSimitRecord[] {
  const tokens = normalizeWhitespace(text).split(/\s+/).filter(Boolean); const records: ParsedSimitRecord[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = normalizeIdentifier(tokens[i]);
    if (!/^\d{20}$/.test(token) && !/^\d{6,12}S$/i.test(token)) continue;
    const window = tokens.slice(i, Math.min(tokens.length, i + 45)).join(' '); const date = extractDate(window); if (!date) continue;
    const code = extractCode(window); const status = extractStatus(window) || 'Pendiente'; const value = extractMoney(window); const municipality = extractMunicipality(window, date, code);
    records.push({ kind: /cobro\s+coactivo/i.test(window) ? 'multa' : 'comparendo', number: token, date, time: extractTime(window), municipality, authority: authorityFromMunicipality(municipality, window), plate: extractSimitPlate(window), infractionCode: code, status, value });
  }
  return records;
}

function parseSplitTokenAnchoredRows(text: string): ParsedSimitRecord[] {
  const normalized = normalizeWhitespace(text); const records: ParsedSimitRecord[] = [];
  const re = /(?:^|[^0-9])((?:\d[\s|]*){20})(?!\d)/g;
  for (const match of normalized.matchAll(re)) {
    const number = compactDigits(match[1]); if (!/^\d{20}$/.test(number)) continue;
    const start = (match.index ?? 0) + match[0].length - match[1].length; const window = normalized.slice(start, start + 400); const date = extractDate(window); if (!date) continue;
    const code = extractCode(window); const status = extractStatus(window) || 'Pendiente'; const value = extractMoney(window); const municipality = extractMunicipality(window, date, code);
    records.push({ kind: /cobro\s+coactivo/i.test(window) ? 'multa' : 'comparendo', number, date, time: extractTime(window), municipality, authority: authorityFromMunicipality(municipality, window), plate: extractSimitPlate(window), infractionCode: code, status, value });
  }
  return records;
}

function parseTabularRows(text: string): ParsedSimitRecord[] {
  const records: ParsedSimitRecord[] = []; const identifiers = findRecordIdentifiers(text);
  for (let i = 0; i < identifiers.length; i++) {
    const current = identifiers[i]; const end = identifiers[i + 1]?.index ?? text.length; const chunk = text.slice(current.index, end); const record = parseRecord(current.number, chunk); if (record) records.push(record);
  }
  return records;
}

export function parseOfficialSimitText(input: string): ParsedSimitRecord[] {
  const text = normalizeWhitespace(input); if (!text) return [];
  const identifiers = findRecordIdentifiers(text); const records: ParsedSimitRecord[] = [];
  for (let index = 0; index < identifiers.length; index++) {
    const current = identifiers[index]; const end = identifiers[index + 1]?.index ?? text.length; let chunk = text.slice(current.index, end);
    const totalIndex = chunk.search(/\bTotal\s+(?:a\s+)?pagar\b/i); if (totalIndex >= 0) chunk = chunk.slice(0, totalIndex);
    const record = parseRecord(current.number, chunk); if (record) records.push(record);
  }
  return dedupe([...records, ...parseTabularRows(text), ...parseTokenAnchoredRows(text), ...parseSplitTokenAnchoredRows(text)]);
}
