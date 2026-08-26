export type ParsedSimitRecord = {
  kind: 'multa' | 'comparendo'; number?: string; date?: string; time?: string;
  authority?: string; municipality?: string; department?: string; plate?: string;
  infractionCode?: string; description?: string; status?: string; value?: number;
  resolutionNumber?: string; resolutionDate?: string; notificationDate?: string; paymentDate?: string;
};
function clean(value: string) { return value.replace(/\s+/g, ' ').trim(); }
function moneyToNumber(value: string) { const digits = value.replace(/[^0-9]/g, ''); return digits ? Number(digits) : undefined; }
function normalizeText(text: string) {
  return text.replace(/\r/g, '\n').replace(/\u00a0/g, ' ').replace(/(\d{20}|\d{10}|\d{4}-FAD-\d+|TC-\d{4}-\d+|\d{4}-\d+-SA)\s*(?:\.\s*)+\d{1,4}\s*(?=\d{2}[/-]\d{2}[/-]\d{4}\b)/gi, '$1 ').trim();
}
function extractDate(value: string) { return value.match(/\b(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}[/-]\d{2}[/-]\d{2})\b/)?.[1]; }
function extractTime(value: string) { return value.match(/\b(\d{2}:\d{2}(?::\d{2})?)\b/)?.[1]; }
function extractStatus(value: string) { const m = value.match(/\b(Pendiente(?:\s+de\s+pago)?|Cobro\s+coactivo|Pagado|Cancelado|Acuerdo\s+de\s+pago|Vigente|En\s+cobro)\b/i); return m ? clean(m[1]) : undefined; }
function extractMoney(value: string) {
  const currency = [...value.matchAll(/\$\s*([0-9]{1,3}(?:[.,\s][0-9]{3})+|[0-9]{4,})\b/g)];
  if (currency.length) return moneyToNumber(currency[currency.length - 1][1]);
  const candidates = [...value.matchAll(/(?<![A-Za-z0-9_-])([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,})(?![A-Za-z0-9_-])/g)].map(m => m[1]).filter(n => !/^20\d{2}$/.test(n) && !/^\d{10}$/.test(n) && !/^\d{20}$/.test(n));
  return candidates.length ? moneyToNumber(candidates[candidates.length - 1]) : undefined;
}
function extractCode(value: string) { return value.match(/([A-D]\d{2})/i)?.[1]?.toUpperCase(); }
const IDENTIFIER_RE = /(?:\d{20}|\d{10}|\d{4}-FAD-\d+|TC-\d{4}-\d+|\d{4}-\d+-SA)/i;
const IDENTIFIER_GLOBAL_RE = /(?:\d{20}|\d{10}|\d{4}-FAD-\d+|TC-\d{4}-\d+|\d{4}-\d+-SA)/gi;
function extractIdentifierBeforeDate(prefix: string) { const matches = [...prefix.matchAll(IDENTIFIER_GLOBAL_RE)]; return matches.length ? matches[matches.length - 1][0].replace(/\s+/g, '') : undefined; }
function removeListNoise(value: string) { return value.replace(/(?:^|\s)\d{1,4}[.)](?=\s|$)/g, ' '); }
const KNOWN_AUTHORITIES = ['Dptal Cesar - IDTRACESAR', 'Agustin Codazzi', 'Agustín Codazzi', 'Valledupar', 'Aracataca', 'Fundación', 'Fundacion', 'Sampues', 'Sampués'];
function sanitizeAuthority(value: string, code?: string) {
  let authority = clean(value).replace(/^\|+|\|+$/g, '').trim(); authority = authority.replace(/^\|?\s*\d{2}:\d{2}(?::\d{2})?\s*\|?\s*/i, '');
  const known = KNOWN_AUTHORITIES.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const knownMatch = authority.match(new RegExp(`(?:^|\\|)\\s*(${known})\\s*(?=(?:[A-D]\\d{2}|Pendiente|Cobro|\\$|$))`, 'i')); if (knownMatch?.[1]) return clean(knownMatch[1]);
  const stops: RegExp[] = [/\d{2}:\d{2}(?::\d{2})?/i, /[A-D]\d{2}/i, /Pendiente(?:\s+de\s+pago)?/i, /Cobro\s+coactivo/i, /Pagado/i, /Cancelado/i, /Acuerdo\s+de\s+pago/i, /Vigente/i, /En\s+cobro/i, /\$/i]; if (code) stops.unshift(new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  const matches = stops.map(re => re.exec(authority)).filter(Boolean) as RegExpExecArray[]; const end = matches.reduce((min, match) => Math.min(min, match.index), authority.length); authority = clean(authority.slice(0, end)).replace(/^\|+|\|+$/g, '').trim(); return authority || undefined;
}
function extractDelimitedFields(raw: string, date: string, code?: string, fallbackStatus?: string) {
  const dateIndex = raw.indexOf(date); const afterDate = raw.slice(Math.max(0, dateIndex + date.length)); const cells = afterDate.split('|').map(clean).filter(Boolean); let authority: string | undefined; let status: string | undefined;
  for (const cell of cells) { const cellStatus = extractStatus(cell); if (cellStatus && !status) status = cellStatus; if (!authority && cell && !/^\d{2}:\d{2}(?::\d{2})?$/.test(cell) && !/^\$?\s*[0-9.,\s]+$/.test(cell) && !(code && new RegExp(`^${code}$`, 'i').test(cell))) authority = sanitizeAuthority(cell, code); }
  if (!authority && code) { const idx = afterDate.toUpperCase().indexOf(code.toUpperCase()); if (idx > 0) authority = sanitizeAuthority(afterDate.slice(0, idx), code); }
  return { authority, status: status || fallbackStatus || 'Pendiente' };
}
function extractLocation(body: string, date: string, code?: string, status?: string) {
  const dateIndex = body.indexOf(date); let tail = dateIndex >= 0 ? body.slice(dateIndex + date.length) : ''; tail = tail.replace(/^\s*\d{2}:\d{2}(?::\d{2})?\s*/, ''); if (code) tail = tail.replace(new RegExp(`\\b${code}\\b`, 'i'), ' '); if (status) tail = tail.replace(new RegExp(status.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'), 'i'), ' '); tail = tail.replace(/\$\s*[0-9][0-9.,\s]*/, ' '); return clean(tail).replace(/[|;,]+$/, '').trim() || undefined;
}
function parseRecordChunk(number: string, chunk: string): ParsedSimitRecord | undefined {
  const rawBody = chunk; const body = clean(chunk); const date = extractDate(body); if (!date) return undefined; const time = extractTime(body); const code = extractCode(body); const detectedStatus = extractStatus(body); const delimited = extractDelimitedFields(rawBody, date, code, detectedStatus); const status = delimited.status || detectedStatus || 'Pendiente';
  const moneySource = body.replace(/\b\d{2}[/-]\d{2}[/-]\d{4}\b/g, ' ').replace(/\b\d{4}[/-]\d{2}[/-]\d{2}\b/g, ' ').replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, ' ').replace(IDENTIFIER_RE, ' ').replace(/\b[A-D]\d{2}\b/gi, ' '); const value = extractMoney(moneySource);
  return { kind: /cobro\s+coactivo|\bmulta\b/i.test(body) ? 'multa' : 'comparendo', number, date, time, authority: delimited.authority, municipality: delimited.authority || extractLocation(body, date, code, status), infractionCode: code, status, value, plate: 'No especificada en PDF' };
}
function parseJson(text: string): ParsedSimitRecord[] | undefined {
  try { const parsed: any = JSON.parse(text); const source = Array.isArray(parsed) ? parsed : parsed?.comparendos || parsed?.multas || parsed?.data; if (!Array.isArray(source)) return undefined; return source.map((item: any) => { const number = String(item?.numeroComparendo ?? item?.numero ?? item?.comparendo ?? item?.number ?? '').trim(); if (!number) return undefined; const rawValue = item?.valorPagar ?? item?.valor ?? item?.valorMulta ?? item?.valorTotal; return { kind: /multa/i.test(String(item?.kind ?? item?.tipo ?? '')) ? 'multa' : 'comparendo', number, date: String(item?.fechaComparendo ?? item?.fecha ?? '').trim() || undefined, time: String(item?.horaComparendo ?? item?.hora ?? item?.time ?? '').trim() || undefined, authority: String(item?.organismoTransito ?? item?.organismo ?? item?.autoridad ?? item?.secretaria ?? '').trim() || undefined, municipality: String(item?.municipio ?? item?.ciudad ?? item?.municipality ?? '').trim() || undefined, department: String(item?.departamento ?? '').trim() || undefined, plate: String(item?.placa ?? '').replace(/\s+/g, '').toUpperCase() || 'No especificada en PDF', infractionCode: String(item?.codigoInfraccion ?? item?.codigo ?? item?.infraccion ?? '').trim().toUpperCase() || undefined, description: String(item?.descripcionInfraccion ?? item?.descripcion ?? '').trim() || undefined, status: String(item?.estadoComparendo ?? item?.estado ?? '').trim() || 'Pendiente', value: typeof rawValue === 'number' ? rawValue : moneyToNumber(String(rawValue ?? '')), resolutionNumber: String(item?.numeroResolucion ?? '').trim() || undefined, resolutionDate: String(item?.fechaResolucion ?? '').trim() || undefined, notificationDate: String(item?.fechaNotificacion ?? '').trim() || undefined, paymentDate: String(item?.fechaPago ?? '').trim() || undefined } as ParsedSimitRecord; }).filter(Boolean) as ParsedSimitRecord[];
  } catch { return undefined; }
}
function parseRows(text: string): ParsedSimitRecord[] {
  const normalized = removeListNoise(normalizeText(text)); const records: ParsedSimitRecord[] = []; const dateTimeRe = /\b(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}[/-]\d{2}[/-]\d{2})\s+(\d{2}:\d{2}:\d{2})\b/g; const dateAnchors = [...normalized.matchAll(dateTimeRe)];
  for (let i = 0; i < dateAnchors.length; i += 1) { const dateStart = dateAnchors[i].index ?? 0; const nextDateStart = i + 1 < dateAnchors.length ? (dateAnchors[i + 1].index ?? normalized.length) : normalized.length; const number = extractIdentifierBeforeDate(normalized.slice(Math.max(0, dateStart - 500), dateStart)); if (!number) continue; let chunk = normalized.slice(dateStart, nextDateStart); const totalIndex = chunk.search(/\bTotal\s+(?:a\s+)?pagar\b/i); if (totalIndex >= 0) chunk = chunk.slice(0, totalIndex); const record = parseRecordChunk(number, chunk); if (record) records.push(record); }
  const dateOnlyRe = /\b(\d{2}[/-]\d{2}[/-]\d{4})\b/g; const dateOnlyAnchors = [...normalized.matchAll(dateOnlyRe)];
  for (let i = 0; i < dateOnlyAnchors.length; i += 1) { const dateStart = dateOnlyAnchors[i].index ?? 0; const nextDateStart = i + 1 < dateOnlyAnchors.length ? (dateOnlyAnchors[i + 1].index ?? normalized.length) : normalized.length; const number = extractIdentifierBeforeDate(normalized.slice(Math.max(0, dateStart - 500), dateStart)); if (!number) continue; let chunk = normalized.slice(dateStart, nextDateStart); if (/\bTotal\s+(?:a\s+)?pagar\b/i.test(chunk)) continue; const record = parseRecordChunk(number, chunk); if (record) records.push(record); }
  if (!records.length) {
    const identifiers = [...normalized.matchAll(IDENTIFIER_GLOBAL_RE)]; const dates = [...normalized.matchAll(/\b\d{2}[/-]\d{2}[/-]\d{4}\b/g)];
    for (const idMatch of identifiers) { const idIndex = idMatch.index ?? 0; const dateMatch = dates.find(m => (m.index ?? -1) > idIndex); if (!dateMatch) continue; const dateIndex = dateMatch.index ?? 0; let chunk = normalized.slice(dateIndex, Math.min(normalized.length, dateIndex + 2000)); const totalIndex = chunk.search(/\bTotal\s+(?:a\s+)?pagar\b/i); if (totalIndex >= 0) chunk = chunk.slice(0, totalIndex); const record = parseRecordChunk(idMatch[0].replace(/\s+/g, ''), chunk); if (record) records.push(record); }
  }
  if (!records.length) { const lines = normalized.split('\n').map(clean).filter(Boolean); for (let i = 0; i < lines.length; i += 1) { const date = lines[i].match(/\b\d{2}[/-]\d{2}[/-]\d{4}\b/)?.[0]; if (!date) continue; const number = extractIdentifierBeforeDate(lines.slice(Math.max(0, i - 5), i).join(' ')); if (!number) continue; const record = parseRecordChunk(number, lines.slice(i, Math.min(i + 8, lines.length)).join(' ')); if (record) records.push(record); } }
  const unique = new Map<string, ParsedSimitRecord>(); for (const record of records) { const key = `${record.number || ''}|${record.date || ''}`; const existing = unique.get(key); if (!existing) unique.set(key, record); else unique.set(key, { ...existing, ...record, time: record.time || existing.time, value: record.value ?? existing.value, authority: record.authority || existing.authority, municipality: record.municipality || existing.municipality, status: record.status || existing.status, plate: record.plate || existing.plate }); } return [...unique.values()];
}
function enforceMinimumStructure(text: string): ParsedSimitRecord[] {
  const normalized = removeListNoise(normalizeText(text)); const identifiers = [...normalized.matchAll(IDENTIFIER_GLOBAL_RE)]; const dates = [...normalized.matchAll(/\b\d{2}[/-]\d{2}[/-]\d{4}\b/g)]; if (!identifiers.length || !dates.length) return [];
  return identifiers.map((idMatch, index) => {
    const id = idMatch[0].replace(/\s+/g, ''); const idIndex = idMatch.index ?? 0; const nextIdIndex = identifiers[index + 1]?.index ?? normalized.length; const dateMatch = dates.find(d => (d.index ?? -1) > idIndex && (d.index ?? normalized.length) < nextIdIndex) || dates.find(d => (d.index ?? -1) > idIndex) || dates[0]; if (!dateMatch) return undefined;
    const dateIndex = dateMatch.index ?? 0; let chunk = normalized.slice(dateIndex, Math.min(normalized.length, dateIndex + 2000)); const totalIndex = chunk.search(/\bTotal\s+(?:a\s+)?pagar\b/i); if (totalIndex >= 0) chunk = chunk.slice(0, totalIndex); return parseRecordChunk(id, chunk);
  }).filter(Boolean) as ParsedSimitRecord[];
}
export function parseOfficialSimitText(input: string): ParsedSimitRecord[] {
  const text = normalizeText(input); if (!text) return []; const json = parseJson(text); if (json?.length) return json;
  const parsed = parseRows(text); if (parsed.length) return parsed;
  // Invariante: un ID de comparendo/multa válido + una fecha válida confirma como mínimo un registro.
  return enforceMinimumStructure(text);
}
