export type ParsedSimitRecord = {
  kind: 'multa' | 'comparendo';
  number?: string;
  date?: string;
  time?: string;
  authority?: string;
  municipality?: string;
  department?: string;
  plate?: string;
  infractionCode?: string;
  description?: string;
  status?: string;
  value?: number;
  resolutionNumber?: string;
  resolutionDate?: string;
  notificationDate?: string;
  paymentDate?: string;
};

function clean(value: string) { return value.replace(/\s+/g, ' ').trim(); }
function moneyToNumber(value: string) { const digits = value.replace(/[^0-9]/g, ''); return digits ? Number(digits) : undefined; }
function normalizeText(text: string) { return text.replace(/\r/g, '\n').replace(/\u00a0/g, ' ').trim(); }
function extractDate(value: string) { return value.match(/\b(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}[/-]\d{2}[/-]\d{2})\b/)?.[1]; }
function extractTime(value: string) { return value.match(/\b(\d{2}:\d{2}(?::\d{2})?)\b/)?.[1]; }
function extractStatus(value: string) { const m = value.match(/\b(Pendiente(?:\s+de\s+pago)?|Cobro\s+coactivo|Pagado|Cancelado|Acuerdo\s+de\s+pago|Vigente|En\s+cobro)\b/i); return m ? clean(m[1]) : undefined; }

// Monetary values are deliberately extracted only after dates/times/identifiers
// have been removed. This prevents values such as the year "2025" from becoming
// a fabricated fine amount.
function extractMoney(value: string) {
  const m = [...value.matchAll(/(?:\$\s*)?([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,})\b/g)];
  return m.length ? moneyToNumber(m[m.length - 1][1]) : undefined;
}

function extractCode(value: string) {
  // SIMIT traffic infractions use the standard letter + two digits form.
  return value.match(/\b([A-D]\d{2})\b/i)?.[1]?.toUpperCase();
}

const IDENTIFIER_RE = /(?:\d{20}|\d{10}|\d{4}-FAD-\d+|TC-\d{4}-\d+|\d{4}-\d+-SA)/i;
const IDENTIFIER_GLOBAL_RE = /(?:\d{20}|\d{10}|\d{4}-FAD-\d+|TC-\d{4}-\d+|\d{4}-\d+-SA)/gi;

function extractIdentifierBeforeDate(prefix: string): string | undefined {
  const matches = [...prefix.matchAll(IDENTIFIER_GLOBAL_RE)];
  return matches.length ? matches[matches.length - 1][0].replace(/\s+/g, '') : undefined;
}

function isIdentifier(value: string) { return IDENTIFIER_RE.test(value.trim()); }

function removeListNoise(value: string) {
  // Remove table indices such as "1." / "21)" without touching decimal or
  // monetary values. This is done before record segmentation.
  return value.replace(/(?:^|\s)\d{1,4}[.)](?=\s|$)/g, ' ');
}

function extractLocation(body: string, date: string, code?: string, status?: string) {
  const dateIndex = body.indexOf(date);
  let tail = dateIndex >= 0 ? body.slice(dateIndex + date.length) : '';
  tail = tail.replace(/^\s*\d{2}:\d{2}(?::\d{2})?\s*/, '');
  if (code) tail = tail.replace(new RegExp(`\\b${code}\\b`, 'i'), ' ');
  if (status) tail = tail.replace(new RegExp(status.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'), 'i'), ' ');
  tail = tail.replace(/\$?\s*[0-9][0-9.,]*.*$/, '');
  return clean(tail).replace(/[|;,]+$/, '').trim() || undefined;
}

function parseRecordChunk(number: string, chunk: string): ParsedSimitRecord | undefined {
  const body = clean(chunk);
  const date = extractDate(body);
  if (!date) return undefined;
  const time = extractTime(body);
  const code = extractCode(body);
  const status = extractStatus(body);

  const moneySource = body
    .replace(/\b\d{2}[/-]\d{2}[/-]\d{4}\b/g, ' ')
    .replace(/\b\d{4}[/-]\d{2}[/-]\d{2}\b/g, ' ')
    .replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(IDENTIFIER_RE, ' ')
    .replace(/\b[A-D]\d{2}\b/gi, ' ');
  const value = extractMoney(moneySource);

  const dateIndex = body.indexOf(date);
  const codeIndex = code ? body.toUpperCase().indexOf(code.toUpperCase()) : -1;
  const authority = codeIndex > dateIndex
    ? clean(body.slice(dateIndex + date.length, codeIndex)).replace(/^\d{2}:\d{2}(?::\d{2})?\s*/, '') || undefined
    : undefined;

  return {
    kind: /cobro\s+coactivo|\bmulta\b/i.test(body) ? 'multa' : 'comparendo',
    number,
    date,
    time,
    authority,
    municipality: extractLocation(body, date, code, status),
    infractionCode: code,
    status,
    value,
  };
}

function parseJson(text: string): ParsedSimitRecord[] | undefined {
  try {
    const parsed: any = JSON.parse(text);
    const source = Array.isArray(parsed) ? parsed : parsed?.comparendos || parsed?.multas || parsed?.data;
    if (!Array.isArray(source)) return undefined;
    return source.map((item: any) => {
      const number = String(item?.numeroComparendo ?? item?.numero ?? item?.comparendo ?? item?.number ?? '').trim();
      if (!number) return undefined;
      const rawValue = item?.valorPagar ?? item?.valor ?? item?.valorMulta ?? item?.valorTotal;
      return {
        kind: /multa/i.test(String(item?.kind ?? item?.tipo ?? '')) ? 'multa' : 'comparendo',
        number,
        date: String(item?.fechaComparendo ?? item?.fecha ?? '').trim() || undefined,
        time: String(item?.horaComparendo ?? item?.hora ?? item?.time ?? '').trim() || undefined,
        authority: String(item?.organismoTransito ?? item?.organismo ?? item?.autoridad ?? item?.secretaria ?? '').trim() || undefined,
        municipality: String(item?.municipio ?? item?.ciudad ?? item?.municipality ?? '').trim() || undefined,
        department: String(item?.departamento ?? '').trim() || undefined,
        plate: String(item?.placa ?? '').replace(/\s+/g, '').toUpperCase() || undefined,
        infractionCode: String(item?.codigoInfraccion ?? item?.codigo ?? item?.infraccion ?? '').trim().toUpperCase() || undefined,
        description: String(item?.descripcionInfraccion ?? item?.descripcion ?? '').trim() || undefined,
        status: String(item?.estadoComparendo ?? item?.estado ?? '').trim() || undefined,
        value: typeof rawValue === 'number' ? rawValue : moneyToNumber(String(rawValue ?? '')),
        resolutionNumber: String(item?.numeroResolucion ?? '').trim() || undefined,
        resolutionDate: String(item?.fechaResolucion ?? '').trim() || undefined,
        notificationDate: String(item?.fechaNotificacion ?? '').trim() || undefined,
        paymentDate: String(item?.fechaPago ?? '').trim() || undefined,
      } as ParsedSimitRecord;
    }).filter(Boolean) as ParsedSimitRecord[];
  } catch { return undefined; }
}

function parseRows(text: string): ParsedSimitRecord[] {
  // The PDF extractor does not preserve table rows reliably. The stable unit is
  // the date+time anchor: every occurrence starts exactly one SIMIT record.
  const normalized = removeListNoise(normalizeText(text));
  const dateTimeRe = /\b(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}[/-]\d{2}[/-]\d{2})\s+(\d{2}:\d{2}:\d{2})\b/g;
  const anchors = [...normalized.matchAll(dateTimeRe)];
  const records: ParsedSimitRecord[] = [];

  for (let i = 0; i < anchors.length; i += 1) {
    const anchor = anchors[i];
    const dateStart = anchor.index ?? 0;
    const nextDateStart = i + 1 < anchors.length ? (anchors[i + 1].index ?? normalized.length) : normalized.length;

    // The identifier can appear immediately before the date, on the previous
    // extracted line, or immediately before an intercalated list index.
    const prefixStart = Math.max(0, dateStart - 160);
    const prefix = normalized.slice(prefixStart, dateStart);
    const number = extractIdentifierBeforeDate(prefix);
    if (!number) continue;

    let chunk = normalized.slice(dateStart, nextDateStart);
    const totalIndex = chunk.search(/\bTotal\s+(?:a\s+)?pagar\b/i);
    if (totalIndex >= 0) chunk = chunk.slice(0, totalIndex);

    const record = parseRecordChunk(number, chunk);
    if (record) records.push(record);
  }

  // Defensive fallback for OCR/text extractors that separate the time from
  // the date. It is intentionally conservative and still requires an ID+date.
  if (!records.length) {
    const lines = normalized.split('\n').map(clean).filter(Boolean);
    for (let i = 0; i < lines.length; i += 1) {
      const date = lines[i].match(/\b\d{2}[/-]\d{2}[/-]\d{4}\b/)?.[0];
      if (!date) continue;
      const number = extractIdentifierBeforeDate(lines.slice(Math.max(0, i - 3), i).join(' '));
      if (!number) continue;
      const parts = lines.slice(i, Math.min(i + 8, lines.length));
      const record = parseRecordChunk(number, parts.join(' '));
      if (record) records.push(record);
    }
  }

  const unique = new Map<string, ParsedSimitRecord>();
  for (const record of records) {
    const key = `${record.number || ''}|${record.date || ''}|${record.time || ''}`;
    const existing = unique.get(key);
    unique.set(key, existing ? { ...existing, ...record } : record);
  }
  return [...unique.values()];
}

export function parseOfficialSimitText(input: string): ParsedSimitRecord[] {
  const text = normalizeText(input);
  if (!text) return [];
  const json = parseJson(text);
  return json || parseRows(text);
}
