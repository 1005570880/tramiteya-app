import { findMatchingAuthority } from './constants/transitAuthorities';

export type ParsedSimitRecord = {
  kind: 'multa' | 'comparendo'; number?: string; date?: string; time?: string; authority?: string; municipality?: string; department?: string; plate?: string; ownerName?: string; documentNumber?: string; infractionCode?: string; description?: string; status?: string; value?: number; resolutionNumber?: string; resolutionDate?: string; notificationDate?: string; paymentDate?: string;
};

const DATE_RE = /\b\d{2}[/-]\d{2}[/-]\d{4}\b/;
const TIME_RE = /\b\d{2}:\d{2}(?::\d{2})?\b/;
const CODE_RE = /(?:^|[^A-Z0-9])([A-D]\d{2})(?=$|[^A-Z0-9])/i;
const STATUS_RE = /\b(Pendiente(?:\s+de\s+pago)?|Cobro\s+coactivo|Pagado|Cancelado|Acuerdo\s+de\s+pago|Vigente|En\s+cobro)\b/i;
const ID_RE = /(?<!\d)(\d{7,22})(?!\d)/g;
const SPECIAL_ID_RE = /\b(?:\d{4}-FAD-\d+|TC-\d{4}-\d+|\d{4}-\d+-SA)\b/i;
const PLATE_RE = /\b([A-Z]{3}[ -]?\d{3})\b/i;

function normalize(v: string) { return String(v ?? '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n').trim(); }
function clean(v: string) { return String(v || '').replace(/\s+/g, ' ').replace(/^\|+|\|+$/g, '').trim(); }
function id(v: string) { return String(v || '').replace(/[\s|]/g, '').trim(); }
function numberValue(v: string) { const n = Number(String(v || '').replace(/[^0-9]/g, '')); return Number.isFinite(n) && n > 0 ? n : undefined; }
function extractMoney(v: string) { const matches = [...String(v || '').matchAll(/\$\s*([0-9][0-9.,\s]{3,})\b/g)]; return matches.length ? numberValue(matches[matches.length - 1][1]) : undefined; }

export function extractSimitDocumentNumber(input: string): string | undefined {
  const text = normalize(input);
  const patterns = [
    /(?:c[eé]dula|cedula)\s*(?:de\s+)?(?:n[uú]mero|no\.?|nro\.?|n[º°])?\s*[:#-]?\s*((?:\d\s*){6,10})(?=\D|$)/i,
    /(?:documento\s+de\s+identidad|n[uú]mero\s+de\s+identificaci[oó]n|identificaci[oó]n)\s*[:#-]?\s*((?:\d\s*){6,10})(?=\D|$)/i,
    /\b(?:CC|C\.C\.)\s*[:#-]?\s*((?:\d\s*){6,10})(?=\D|$)/i,
  ];
  for (const pattern of patterns) { const m = text.match(pattern); const n = String(m?.[1] || '').replace(/\D/g, ''); if (/^\d{6,10}$/.test(n)) return n; }
  const h = text.search(/estado\s+de\s+cuenta/i); if (h >= 0) { const m = text.slice(h, h + 900).match(/\b\d{6,10}\b/); if (m) return m[0]; }
  return undefined;
}

export function extractSimitPlate(input: string): string | undefined {
  const text = normalize(input); const labelled = text.match(/(?:placa|plca)[^A-Z0-9]{0,40}([A-Z]{3}[ -]?\d{3})\b/i); if (labelled?.[1]) return labelled[1].replace(/[\s-]/g, '').toUpperCase(); return text.match(PLATE_RE)?.[1]?.replace(/[\s-]/g, '').toUpperCase();
}

function parseRow(number: string, raw: string): ParsedSimitRecord | undefined {
  const body = clean(raw); const date = body.match(DATE_RE)?.[0]; if (!date) return undefined;
  const code = body.match(CODE_RE)?.[1]?.toUpperCase(); const value = extractMoney(body); const status = clean(body.match(STATUS_RE)?.[1] || 'Pendiente');
  const time = body.match(TIME_RE)?.[0]; const plate = body.match(PLATE_RE)?.[1]?.replace(/[\s-]/g, '').toUpperCase();
  const municipality = (() => { const i = body.indexOf(date); if (i < 0) return undefined; let x = body.slice(i + date.length).replace(/^\s*\d{2}:\d{2}(?::\d{2})?\s*/, ''); if (code) { const ci = x.search(new RegExp(`\\b${code}\\b`, 'i')); if (ci >= 0) x = x.slice(0, ci); } x = clean(x).replace(/^\|+/, '').replace(/(?:pendiente(?:\s+de\s+pago)?|cobro\s+coactivo|pagado|cancelado|vigente|en\s+cobro).*$/i, '').trim(); return x && !/^[0-9$.,\s]+$/.test(x) ? x : undefined; })();
  const authority = municipality ? findMatchingAuthority(municipality) : findMatchingAuthority(body);
  return { kind: /cobro\s+coactivo/i.test(body) ? 'multa' : 'comparendo', number: id(number), date, time, municipality, authority, plate, infractionCode: code, status, value };
}

function rowIdentifier(row: string): string | undefined {
  const special = row.match(SPECIAL_ID_RE)?.[0]; if (special) return id(special);
  const candidates = [...row.matchAll(/(?<!\d)(\d{7,22})(?!\d)/g)].map(m => m[1]);
  // Do not require 15-20 digits: official SIMIT rows also contain shorter identifiers.
  return candidates.sort((a, b) => b.length - a.length)[0];
}

function parseNumberedRows(text: string): ParsedSimitRecord[] {
  const normalized = normalize(text); const starts = [...normalized.matchAll(/(?:^|\n)\s*(\d{1,3})[.)]\s+/g)]; const records: ParsedSimitRecord[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = (starts[i].index ?? 0) + starts[i][0].length; const end = starts[i + 1]?.index ?? normalized.length;
    let row = normalized.slice(start, end); row = row.replace(/\n\s*(?:Total\s+(?:a\s+)?pagar|La\s+informaci[oó]n).*$/is, '').trim();
    const number = rowIdentifier(row); if (!number) continue;
    const record = parseRow(number, row);
    // A numbered official row with an identifier and date is evidence of a real record.
    // Missing fields stay undefined; nothing is fabricated.
    if (record?.number && record.date) records.push(record);
  }
  return records;
}

function parseIdentifierChunks(text: string): ParsedSimitRecord[] {
  const normalized = normalize(text); const ids: Array<{ number: string; index: number }> = [];
  for (const m of normalized.matchAll(/\b(?:\d{7,22}|\d{4}-FAD-\d+|TC-\d{4}-\d+|\d{4}-\d+-SA)\b/gi)) ids.push({ number: id(m[0]), index: m.index ?? 0 });
  const records: ParsedSimitRecord[] = [];
  for (let i = 0; i < ids.length; i++) { const end = ids[i + 1]?.index ?? normalized.length; const record = parseRow(ids[i].number, normalized.slice(ids[i].index, end)); if (record?.number && record.date) records.push(record); }
  return records;
}

function dedupe(records: ParsedSimitRecord[]) {
  const map = new Map<string, ParsedSimitRecord>();
  for (const record of records) { if (!record.number || !record.date) continue; const key = `${record.number}|${record.date}`; const old = map.get(key); if (!old) map.set(key, record); else map.set(key, { ...old, ...record, infractionCode: record.infractionCode || old.infractionCode, authority: record.authority || old.authority, municipality: record.municipality || old.municipality, plate: record.plate || old.plate, value: record.value ?? old.value }); }
  return [...map.values()];
}

export function parseOfficialSimitText(input: string): ParsedSimitRecord[] {
  const text = normalize(input); if (!text) return [];
  return dedupe([...parseNumberedRows(text), ...parseIdentifierChunks(text)]);
}
