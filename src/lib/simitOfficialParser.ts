import { findMatchingAuthority } from './constants/transitAuthorities';

export type ParsedSimitRecord = { kind: 'multa' | 'comparendo'; number?: string; date?: string; time?: string; authority?: string; municipality?: string; department?: string; plate?: string; ownerName?: string; documentNumber?: string; infractionCode?: string; description?: string; status?: string; value?: number; resolutionNumber?: string; resolutionDate?: string; notificationDate?: string; paymentDate?: string; };

const IDENTIFIER_RE = /(?:\d{20}|\d{10}|\d{4}-FAD-\d+|TC-\d{4}-\d+|\d{4}-\d+-SA)/i;
const IDENTIFIER_GLOBAL_RE = /(?:\d{20}|\d{10}|\d{4}-FAD-\d+|TC-\d{4}-\d+|\d{4}-\d+-SA)/gi;
const DATE_RE = /\b\d{2}[/-]\d{2}[/-]\d{4}\b/g;
const TIME_RE = /\b\d{2}:\d{2}(?::\d{2})?\b/;
const STATUS_RE = /\b(Pendiente(?:\s+de\s+pago)?|Cobro\s+coactivo|Pagado|Cancelado|Acuerdo\s+de\s+pago|Vigente|En\s+cobro)\b/i;
const CODE_RE = /\b([A-D]\d{2})\b/i;
const PLATE_RE = /\b([A-Z]{3}[ -]?\d{3})\b/gi;
const KNOWN_AUTHORITIES = ['Dptal Cesar - IDTRACESAR','Agustin Codazzi','Agustín Codazzi','Valledupar','Aracataca','Fundación','Fundacion','Sampues','Sampués','Sampues - Dptal Sucre','Sampués - Dptal Sucre'];

function clean(value: string) { return value.replace(/\s+/g, ' ').trim(); }
function moneyToNumber(value: string) { const digits = value.replace(/[^0-9]/g, ''); return digits ? Number(digits) : undefined; }
function normalizeText(input: string) { let text = String(input ?? '').replace(/\r/g, '\n').replace(/\u00a0/g, ' '); text = text.replace(/(\d(?:[\s\n]+\d){19})(?=\s|\.|$)/g, m => m.replace(/\s+/g, '')); text = text.replace(/(\d{20}|\d{10}|\d{4}-FAD-\d+|TC-\d{4}-\d+|\d{4}-\d+-SA)\s*(?:\.\s*)+\d{1,4}\s*(?=\d{2}[/-]\d{2}[/-]\d{4}\b)/gi, '$1 '); return text; }
function extractDate(value: string) { return value.match(DATE_RE)?.[0]; }
function extractTime(value: string) { return value.match(TIME_RE)?.[0]; }
function extractStatus(value: string) { const match = value.match(STATUS_RE); return match?.[1] ? clean(match[1]) : undefined; }
function extractCode(value: string) { return value.match(CODE_RE)?.[1]?.toUpperCase(); }
function extractMoney(value: string) { const currency = [...value.matchAll(/\$\s*([0-9]{1,3}(?:[.,\s][0-9]{3})+|[0-9]{4,})\b/g)]; if (currency.length) return moneyToNumber(currency[currency.length - 1][1]); const candidates = [...value.matchAll(/(?<![A-Za-z0-9_-])([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,})(?![A-Za-z0-9_-])/g)].map(m => m[1]).filter(n => !/^20\d{2}$/.test(n) && !/^\d{10}$/.test(n) && !/^\d{20}$/.test(n)); return candidates.length ? moneyToNumber(candidates[candidates.length - 1]) : undefined; }

function compactDigits(value: string) { return String(value || '').replace(/[^0-9]/g, ''); }

/** Extracts a Colombian cédula only when contextual evidence labels it as an identity number. */
export function extractSimitDocumentNumber(input: string): string | undefined {
  const text = String(input ?? '').replace(/\u00a0/g, ' ');
  const patterns = [
    /(?:c[eé]dula|cedula|documento\s+de\s+identidad|n[uú]mero\s+de\s+identificaci[oó]n|identificaci[oó]n)\s*(?:de\s+)?(?:n[uú]mero|no\.?|nro\.?|n[º°])?\s*[:\-#]?\s*((?:\d[\s\n]*){6,10})(?=\D|$)/i,
    /\b(?:CC|C\.C\.)\s*[:\-#]?\s*((?:\d[\s\n]*){6,10})(?=\D|$)/i,
    /estado\s+de\s+cuenta[\s\n|]*(?:CC\s*)?((?:\d[\s\n]*){6,10})[\s\n|]*fecha\s+de\s+expedici[oó]n/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const digits = compactDigits(match[1]);
    if (/^\d{6,10}$/.test(digits)) return digits;
  }
  return undefined;
}

/** Extracts a vehicle plate only from explicit plate-labelled context or a strong Colombian plate token. */
export function extractSimitPlate(input: string): string | undefined {
  const text = String(input ?? '').replace(/\u00a0/g, ' ');
  const labelled = text.match(/(?:placa|plca)\s*(?:del\s+veh[ií]culo)?\s*[:\-#]?\s*([A-Z]{3}[ -]?\d{3})\b/i);
  if (labelled?.[1]) return labelled[1].replace(/\s+/g, '').toUpperCase();
  const matches = [...text.matchAll(PLATE_RE)].map(m => m[1].replace(/\s+/g, '').toUpperCase());
  return matches.find(p => /^[A-Z]{3}\d{3}$/.test(p));
}

function sanitizeAuthority(value: string, code?: string) {
  let authority = clean(value).replace(/^\|+|\|+$/g, '').trim();
  authority = authority.replace(/^\|?\s*\d{2}:\d{2}(?::\d{2})?\s*\|?\s*/i, '').replace(/\d{2}:\d{2}:\d{2}/g, '').trim();
  const knownPattern = KNOWN_AUTHORITIES.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const knownAnywhere = authority.match(new RegExp(`(${knownPattern})`, 'i'));
  if (knownAnywhere?.[1]) return clean(knownAnywhere[1]);
  const stops: RegExp[] = [/\d{2}:\d{2}(?::\d{2})?/i, /[A-D]\d{2}/i, /Pendiente(?:\s+de\s+pago)?/i, /Cobro\s+coactivo/i, /\$/i];
  if (code) stops.unshift(new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  const matches = stops.map(r => r.exec(authority)).filter(Boolean) as RegExpExecArray[];
  const end = matches.reduce((min, m) => Math.min(min, m.index), authority.length);
  authority = clean(authority.slice(0, end)).replace(/^\|+|\|+$/g, '').trim();
  return authority || undefined;
}
function extractDelimitedFields(raw: string, date: string, code?: string, fallbackStatus?: string) { const idx = raw.indexOf(date); const after = raw.slice(idx >= 0 ? idx + date.length : 0); const cells = after.split('|').map(clean).filter(Boolean); let authority: string | undefined; let status: string | undefined; for (const cell of cells) { const s = extractStatus(cell); if (s && !status) status = s; if (!authority && cell && !TIME_RE.test(cell) && !/^\$?\s*[0-9.,\s]+$/.test(cell) && !(code && new RegExp(`^${code}$`, 'i').test(cell))) authority = sanitizeAuthority(cell, code); } if (!authority && code) { const codeIndex = after.toUpperCase().indexOf(code.toUpperCase()); if (codeIndex > 0) authority = sanitizeAuthority(after.slice(0, codeIndex), code); } return { authority, status: status || fallbackStatus || 'Pendiente' }; }
function parseRecord(number: string, chunk: string, globalText?: string): ParsedSimitRecord | undefined { const body = clean(chunk); const date = extractDate(body); if (!date) return undefined; const code = extractCode(body); const detectedStatus = extractStatus(body); const fields = extractDelimitedFields(chunk, date, code, detectedStatus); const catalogAuthority = findMatchingAuthority(body); const authority = catalogAuthority || fields.authority; const moneySource = body.replace(DATE_RE, ' ').replace(TIME_RE, ' ').replace(IDENTIFIER_RE, ' ').replace(/\b[A-D]\d{2}\b/gi, ' '); const plate = extractSimitPlate(body) || (globalText ? extractSimitPlate(globalText) : undefined); return { kind: /cobro\s+coactivo|\bmulta\b/i.test(body) ? 'multa' : 'comparendo', number, date, time: extractTime(body), authority, municipality: authority, infractionCode: code, status: fields.status, value: extractMoney(moneySource), plate: plate || 'No especificada en PDF' }; }
function parseRows(text: string) { const normalized = normalizeText(text); const records: ParsedSimitRecord[] = []; const anchors = [...normalized.matchAll(/\b\d{2}[/-]\d{2}[/-]\d{4}\s+\d{2}:\d{2}:\d{2}\b/g)]; for (let i = 0; i < anchors.length; i++) { const start = anchors[i].index ?? 0; const end = i + 1 < anchors.length ? (anchors[i + 1].index ?? normalized.length) : normalized.length; const prefix = normalized.slice(Math.max(0, start - 800), start); const ids = [...prefix.matchAll(IDENTIFIER_GLOBAL_RE)]; const number = ids.at(-1)?.[0]?.replace(/\s+/g, ''); if (!number) continue; let chunk = normalized.slice(start, end); const total = chunk.search(/\bTotal\s+(?:a\s+)?pagar\b/i); if (total >= 0) chunk = chunk.slice(0, total); const record = parseRecord(number, chunk, normalized); if (record) records.push(record); } return dedupe(records); }
function enforceMinimumStructure(text: string) { const normalized = normalizeText(text); const identifiers = [...normalized.matchAll(IDENTIFIER_GLOBAL_RE)]; const dates = [...normalized.matchAll(DATE_RE)]; if (!identifiers.length || !dates.length) return [] as ParsedSimitRecord[]; const records: ParsedSimitRecord[] = []; identifiers.forEach((idMatch, index) => { const id = idMatch[0].replace(/\s+/g, ''); const idPos = idMatch.index ?? 0; const nextId = identifiers[index + 1]?.index ?? normalized.length; const dateMatch = dates.find(d => (d.index ?? -1) > idPos && (d.index ?? normalized.length) < nextId) || dates.find(d => (d.index ?? -1) > idPos) || dates.find(d => (d.index ?? -1) < idPos); if (!dateMatch) return; const datePos = dateMatch.index ?? 0; const windowStart = Math.min(idPos, datePos); let chunk = normalized.slice(windowStart, Math.min(normalized.length, Math.max(idPos, datePos) + 2200)); const total = chunk.search(/\bTotal\s+(?:a\s+)?pagar\b/i); if (total >= 0) chunk = chunk.slice(0, total); const record = parseRecord(id, chunk, normalized); if (record) records.push(record); }); if (!records.length && identifiers[0] && dates[0]) { const id = identifiers[0][0].replace(/\s+/g, ''); const datePos = dates[0].index ?? 0; let chunk = normalized.slice(Math.max(0, datePos - 200), Math.min(normalized.length, datePos + 2200)); const total = chunk.search(/\bTotal\s+(?:a\s+)?pagar\b/i); if (total >= 0) chunk = chunk.slice(0, total); const record = parseRecord(id, chunk, normalized); if (record) records.push(record); if (!records.length) records.push({ kind: 'comparendo', number: id, date: dates[0][0], time: extractTime(chunk), status: extractStatus(chunk) || 'Pendiente', plate: extractSimitPlate(normalized) || 'No especificada en PDF', infractionCode: extractCode(chunk), authority: findMatchingAuthority(chunk) || sanitizeAuthority(chunk, extractCode(chunk)) }); } return dedupe(records); }
function dedupe(records: ParsedSimitRecord[]) { const map = new Map<string, ParsedSimitRecord>(); for (const r of records) { const key = `${r.number || ''}|${r.date || ''}`; const old = map.get(key); map.set(key, old ? { ...old, ...r, authority: r.authority || old.authority, value: r.value ?? old.value, plate: r.plate && r.plate !== 'No especificada en PDF' ? r.plate : old.plate } : r); } return [...map.values()]; }
export function parseOfficialSimitText(input: string): ParsedSimitRecord[] { const text = normalizeText(input); if (!text) return []; const parsed = parseRows(text); if (parsed.length) return parsed; return enforceMinimumStructure(text); }
