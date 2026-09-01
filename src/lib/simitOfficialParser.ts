import { findMatchingAuthority } from './constants/transitAuthorities';

export type ParsedSimitRecord = { kind: 'multa' | 'comparendo'; number?: string; date?: string; time?: string; authority?: string; municipality?: string; department?: string; plate?: string; ownerName?: string; documentNumber?: string; infractionCode?: string; description?: string; status?: string; value?: number; resolutionNumber?: string; resolutionDate?: string; notificationDate?: string; paymentDate?: string };

const DATE_RE = /\b\d{2}[/-]\d{2}[/-]\d{4}\b/g;
const TIME_RE = /\b\d{2}:\d{2}(?::\d{2})?\b/;
const STATUS_RE = /\b(Pendiente(?:\s+de\s+pago)?|Cobro\s+coactivo|Pagado|Cancelado|Acuerdo\s+de\s+pago|Vigente|En\s+cobro)\b/i;
const CODE_RE = /(?:^|[^A-Z0-9])([A-D]\d{2})(?=$|[^A-Z0-9])/i;
const PLATE_RE = /\b([A-Z]{3}[ -]?\d{3})\b/gi;
const CONTIGUOUS_ID_RE = /(?<!\d)\d{7,22}(?!\d)/g;
const SPECIAL_ID_RE = /\b(?:\d{4}-FAD-\d+|TC-\d{4}-\d+|\d{4}-\d+-SA)\b/gi;

function normalizeWhitespace(v: string) { return String(v ?? '').replace(/\r/g, '\n').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n').trim(); }
function normalizeIdentifier(v: string) { return String(v || '').replace(/\s+/g, '').trim(); }
function compactDigits(v: string) { return String(v || '').replace(/[^0-9]/g, ''); }
function clean(v: string) { return String(v || '').replace(/\s+/g, ' ').replace(/^\|+|\|+$/g, '').trim(); }
function moneyToNumber(v: string): number | undefined { const digits = String(v || '').replace(/[^0-9]/g, ''); return digits ? Number(digits) : undefined; }
function extractMoney(v: string): number | undefined { const m = [...String(v || '').matchAll(/\$\s*([0-9]{1,3}(?:[.,\s][0-9]{3})+|[0-9]{4,})\b/g)]; return m.length ? moneyToNumber(m[m.length - 1][1]) : undefined; }
function extractDate(v: string) { DATE_RE.lastIndex = 0; return String(v || '').match(DATE_RE)?.[0]; }
function extractTime(v: string) { return String(v || '').match(TIME_RE)?.[0]; }
function extractStatus(v: string) { return String(v || '').match(STATUS_RE)?.[1]; }
function extractCode(v: string) { return String(v || '').match(CODE_RE)?.[1]?.toUpperCase(); }

export function extractSimitDocumentNumber(input: string): string | undefined { const text = normalizeWhitespace(input); if (!text) return undefined; const patterns = [/(?:c[eé]dula|cedula)\s*(?:de\s+)?(?:n[uú]mero|no\.?|nro\.?|n[º°])?\s*[:#-]?\s*((?:\d[\s\n]*){6,10})(?=\D|$)/i, /(?:documento\s+de\s+identidad|n[uú]mero\s+de\s+identificaci[oó]n|identificaci[oó]n)\s*[:#-]?\s*((?:\d[\s\n]*){6,10})(?=\D|$)/i, /\b(?:CC|C\.C\.)\s*[:#-]?\s*((?:\d[\s\n]*){6,10})(?=\D|$)/i]; for (const p of patterns) { const m = text.match(p); if (m?.[1]) { const d = compactDigits(m[1]); if (/^\d{6,10}$/.test(d)) return d; } } const h = text.search(/estado\s+de\s+cuenta/i); if (h >= 0) { const w = text.slice(h, h + 700); const c = [...w.matchAll(/\b\d{6,10}\b/g)].map(m => m[0]).find(x => !/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(x)); if (c) return c; } return undefined; }
export function extractSimitPlate(input: string): string | undefined { const text = normalizeWhitespace(input); if (!text) return undefined; const patterns = [/(?:^|[\n|])\s*(?:placa|plca)[^\n|]{0,40}?[:#=\-]?\s*([A-Z]{3}[ -]?\d{3})\b/im, /(?:placa|plca)[^A-Z0-9]{0,20}([A-Z]{3}[ -]?\d{3})\b/i]; for (const p of patterns) { const m = text.match(p); if (m?.[1]) return m[1].replace(/[\s-]/g, '').toUpperCase(); } for (const m of text.matchAll(PLATE_RE)) { const plate = m[1].replace(/[\s-]/g, '').toUpperCase(); const before = text.slice(Math.max(0, (m.index ?? 0) - 60), m.index ?? 0).toLowerCase(); if (!/documento|c[eé]dula|identificaci[oó]n|comparendo|resoluci[oó]n|radicado/.test(before) && /^[A-Z]{3}\d{3}$/.test(plate)) return plate; } return undefined; }
function authorityFromMunicipality(municipality: string | undefined, body: string) { return (municipality && findMatchingAuthority(municipality)) || findMatchingAuthority(body); }
function extractMunicipality(body: string, date: string, code?: string) { const i = body.indexOf(date); if (i < 0) return undefined; let after = body.slice(i + date.length).replace(/^\s*\d{2}:\d{2}(?::\d{2})?\s*/, ''); if (code) { const e = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const ci = after.search(new RegExp(`\\b${e}\\b`, 'i')); if (ci >= 0) after = after.slice(0, ci); } const value = clean(after).replace(/^\|+/, '').replace(/(?:pendiente(?:\s+de\s+pago)?|cobro\s+coactivo|pagado|cancelado|vigente|en\s+cobro).*$/i, '').trim(); return value && !/^(?:\$|[0-9.,\s]+)$/.test(value) ? value : undefined; }
function parseRecord(number: string, chunk: string): ParsedSimitRecord | undefined { const body = clean(chunk); const date = extractDate(body); if (!date) return undefined; const code = extractCode(body); const status = clean(extractStatus(body) || 'Pendiente'); const municipality = extractMunicipality(body, date, code); const withoutNumber = body.replace(new RegExp(number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ''); return { kind: /cobro\s+coactivo/i.test(body) ? 'multa' : 'comparendo', number, date, time: extractTime(body), municipality, authority: authorityFromMunicipality(municipality, body), plate: extractSimitPlate(body), infractionCode: code, status, value: extractMoney(withoutNumber) }; }
function dedupe(records: ParsedSimitRecord[]) { const map = new Map<string, ParsedSimitRecord>(); for (const r of records) { if (!r.number) continue; const key = `${r.number}|${r.date || ''}`; const old = map.get(key); map.set(key, old ? { ...old, ...r, authority: r.authority || old.authority, municipality: r.municipality || old.municipality, plate: r.plate || old.plate, value: r.value ?? old.value } : r); } return [...map.values()]; }
function findRecordIdentifiers(text: string) { const found: Array<{ number: string; index: number }> = []; const seen = new Set<string>(); const add = (number: string, index: number) => { const n = normalizeIdentifier(number); const key = `${n}|${index}`; if (!seen.has(key)) { seen.add(key); found.push({ number: n, index }); } }; for (const m of text.matchAll(CONTIGUOUS_ID_RE)) add(m[0], m.index ?? 0); for (const m of text.matchAll(SPECIAL_ID_RE)) add(m[0], m.index ?? 0); return found.sort((a, b) => a.index - b.index); }

function parseNumberedRows(text: string): ParsedSimitRecord[] {
  const normalized = normalizeWhitespace(text); const records: ParsedSimitRecord[] = [];
  const starts = [...normalized.matchAll(/(?:^|\n)\s*(\d{1,3})\.\s+/g)].map(m => ({ ordinal: Number(m[1]), index: (m.index ?? 0) + m[0].length - m[0].trimStart().length }));
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i].index; const end = starts[i + 1]?.index ?? normalized.length; let row = normalized.slice(start, end);
    if (starts[i].ordinal < 1 || starts[i].ordinal > 999) continue;
    row = row.replace(/^\d{1,3}\.\s+/, '').replace(/\n\s*(?:Total\s+(?:a\s+)?pagar|La\s+informaci[oó]n).*$/is, '').trim();
    const id = row.match(/^(\d{7,22}|\d{4}-FAD-\d+|TC-\d{4}-\d+|\d{4}-\d+-SA)/i)?.[1];
    if (!id) continue;
    const record = parseRecord(normalizeIdentifier(id), row);
    if (record?.date && record.infractionCode && record.value !== undefined) records.push(record);
  }
  return records;
}
function parseIdentifierChunks(text: string): ParsedSimitRecord[] { const ids = findRecordIdentifiers(text); const records: ParsedSimitRecord[] = []; for (let i = 0; i < ids.length; i++) { const cur = ids[i]; const end = ids[i + 1]?.index ?? text.length; let chunk = text.slice(cur.index, end); const total = chunk.search(/\bTotal\s+(?:a\s+)?pagar\b/i); if (total >= 0) chunk = chunk.slice(0, total); const r = parseRecord(cur.number, chunk); if (r?.date && r.infractionCode && r.value !== undefined) records.push(r); } return records; }
function parseTokenRows(text: string): ParsedSimitRecord[] { const normalized = normalizeWhitespace(text); const tokens = normalized.split(/\s+/); const records: ParsedSimitRecord[] = []; for (let i = 0; i < tokens.length; i++) { const n = compactDigits(tokens[i]); if (!/^\d{7,22}$/.test(n)) continue; const window = tokens.slice(i, i + 45).join(' '); const date = extractDate(window); const code = extractCode(window); const money = extractMoney(window); if (!date || !code || money === undefined) continue; const municipality = extractMunicipality(window, date, code); records.push({ kind: /cobro\s+coactivo/i.test(window) ? 'multa' : 'comparendo', number: n, date, time: extractTime(window), municipality, authority: authorityFromMunicipality(municipality, window), infractionCode: code, status: clean(extractStatus(window) || 'Pendiente'), value: money }); } return records; }
function parseSpecialRows(text: string): ParsedSimitRecord[] { const normalized = normalizeWhitespace(text); const records: ParsedSimitRecord[] = []; for (const m of normalized.matchAll(SPECIAL_ID_RE)) { const number = normalizeIdentifier(m[0]); const window = normalized.slice(m.index ?? 0, (m.index ?? 0) + 500); const date = extractDate(window); const code = extractCode(window); const value = extractMoney(window); if (!date || !code || value === undefined) continue; const municipality = extractMunicipality(window, date, code); records.push({ kind: /cobro\s+coactivo/i.test(window) ? 'multa' : 'comparendo', number, date, time: extractTime(window), municipality, authority: authorityFromMunicipality(municipality, window), infractionCode: code, status: clean(extractStatus(window) || 'Pendiente'), value }); } return records; }

export function parseOfficialSimitText(input: string): ParsedSimitRecord[] { const text = normalizeWhitespace(input); if (!text) return []; return dedupe([...parseNumberedRows(text), ...parseIdentifierChunks(text), ...parseTokenRows(text), ...parseSpecialRows(text)]); }
