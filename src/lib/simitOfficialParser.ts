export type ParsedSimitRecord = {
  kind: 'multa' | 'comparendo';
  number?: string;
  date?: string;
  authority?: string;
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

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function moneyToNumber(value: string) {
  const digits = value.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : undefined;
}

function parseRecord(item: any): ParsedSimitRecord | undefined {
  if (!item || typeof item !== 'object') return undefined;
  const rawKind = String(item.kind ?? item.tipo ?? '').toLowerCase();
  const kind: ParsedSimitRecord['kind'] = rawKind.includes('multa') ? 'multa' : 'comparendo';
  const number = String(item.numeroComparendo ?? item.numero ?? item.comparendo ?? '').trim() || undefined;
  if (!number) return undefined;
  const rawValue = item.valorPagar ?? item.valor ?? item.valorMulta;
  const value = typeof rawValue === 'number' ? rawValue : moneyToNumber(String(rawValue ?? ''));
  return {
    kind,
    number,
    date: String(item.fechaComparendo ?? item.fecha ?? '').trim() || undefined,
    authority: String(item.organismoTransito ?? item.organismo ?? item.autoridad ?? '').trim() || undefined,
    department: String(item.departamento ?? '').trim() || undefined,
    plate: String(item.placa ?? '').trim() || undefined,
    infractionCode: String(item.codigoInfraccion ?? item.codigo ?? '').trim() || undefined,
    description: String(item.descripcionInfraccion ?? item.descripcion ?? '').trim() || undefined,
    status: String(item.estadoComparendo ?? item.estado ?? '').trim() || undefined,
    value,
    resolutionNumber: String(item.numeroResolucion ?? '').trim() || undefined,
    resolutionDate: String(item.fechaResolucion ?? '').trim() || undefined,
    notificationDate: String(item.fechaNotificacion ?? '').trim() || undefined,
    paymentDate: String(item.fechaPago ?? '').trim() || undefined,
  };
}

function normalizeText(text: string) {
  return text
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

function extractDate(value: string) {
  const match = value.match(/\b(\d{2}\/\d{2}\/\d{4}|\d{2}[-\/]\d{2}[-\/]\d{4}|\d{4}[-\/]\d{2}[-\/]\d{2})\b/);
  return match?.[1];
}

function extractStatus(value: string) {
  const match = value.match(/\b(Pendiente(?:\s+de\s+pago)?|Cobro\s+coactivo|Pagado|Cancelado|Acuerdo\s+de\s+pago|Vigente|En\s+cobro)\b/i);
  return match ? clean(match[1]) : undefined;
}

function extractMoney(value: string) {
  const match = value.match(/\$?\s*([\d]{1,3}(?:[.,][\d]{3})+|\d{4,})\b/);
  return match ? moneyToNumber(match[1]) : undefined;
}

/**
 * Parses the two SIMIT layouts currently encountered in downloaded statements.
 * pdf-parse may reorder table cells, split dates/times and preserve row numbers
 * such as "1. 0000837837...". Therefore parsing cannot require a rigid column order.
 */
function parseStructuredText(text: string): ParsedSimitRecord[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  // A SIMIT record normally has a 10-24 digit comparendo/multa identifier.
  // Some historical records can use an alphanumeric identifier.
  const identifier = '(?:\\d{10,24}|\\d{4,}-[A-Z0-9]+(?:-[A-Z0-9]+)*|[A-Z]{1,12}-\\d{3,}(?:-[A-Z0-9]+)*)';
  const rowStartRe = new RegExp(`(?:^|\\n)\\s*(?:\\d+[.)]\\s*)?(${identifier})(?=\\s|$)`, 'gi');
  const starts = Array.from(normalized.matchAll(rowStartRe));
  const records: ParsedSimitRecord[] = [];

  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i].index ?? 0;
    const end = starts[i + 1]?.index ?? normalized.length;
    const rawRow = normalized.slice(start, end).trim();
    const numberMatch = rawRow.match(new RegExp(`^(?:\\d+[.)]\\s*)?(${identifier})\\b`, 'i'));
    if (!numberMatch) continue;

    const number = numberMatch[1].replace(/\\s+/g, '');
    const body = clean(rawRow.slice(numberMatch[0].length));
    if (!number || !body) continue;

    const date = extractDate(body);
    const infractionMatch = body.match(/\b([A-Z][0-9]{1,3})\b/i);
    const infractionCode = infractionMatch?.[1]?.toUpperCase();
    const status = extractStatus(body);
    const value = extractMoney(body);

    // Avoid treating document headings, totals and course rows as infractions.
    // A real SIMIT infraction row has at least a date plus an infraction code and value.
    if (!date || !infractionCode || value === undefined) continue;
    if (/^(total|estado de cuenta|cédula|fecha de expedición|número multa)/i.test(body)) continue;

    // Authority is normally between the date/time and the infraction code.
    // Fall back to the text before the code when pdf-parse changes column order.
    const dateIndex = body.indexOf(date);
    const codeIndex = body.toUpperCase().indexOf(infractionCode);
    let authority = '';
    if (dateIndex >= 0 && codeIndex > dateIndex) {
      authority = clean(body.slice(dateIndex + date.length, codeIndex))
        .replace(/^\d{2}:\d{2}:\d{2}\s*/, '')
        .replace(/^\d{2}:\d{2}\s*/, '');
    }
    if (!authority && codeIndex > 0) authority = clean(body.slice(0, codeIndex));

    // Remove status/value/timestamps from the authority fallback.
    authority = authority
      .replace(/\b(Pendiente(?: de pago)?|Cobro coactivo|Pagado|Cancelado|Acuerdo de pago|Vigente|En cobro)\b.*$/i, '')
      .replace(/\$?\s*[\d.,]+.*$/, '')
      .trim();

    const kind: ParsedSimitRecord['kind'] = /\bcobro\s+coactivo\b|\bmulta\b/i.test(body) ? 'multa' : 'comparendo';
    records.push({ kind, number, date, authority: authority || undefined, infractionCode, status, value });
  }

  // Deduplicate by identifier while retaining the richest parsed row.
  const merged = new Map<string, ParsedSimitRecord>();
  for (const record of records) {
    const previous = merged.get(record.number || '');
    merged.set(record.number || '', {
      ...(previous || {}),
      ...record,
      authority: record.authority || previous?.authority,
      status: record.status || previous?.status,
      value: record.value ?? previous?.value,
    });
  }
  return [...merged.values()];
}

export function parseOfficialSimitText(input: string): ParsedSimitRecord[] {
  const text = input.replace(/\r/g, '').trim();
  if (!text) return [];

  try {
    const parsed: any = JSON.parse(text);
    const source: any = Array.isArray(parsed) ? parsed : parsed?.comparendos || parsed?.multas || parsed?.data;
    if (Array.isArray(source)) {
      return source.map(parseRecord).filter((item: ParsedSimitRecord | undefined): item is ParsedSimitRecord => Boolean(item));
    }
  } catch {
    // Fall through to official copied-text parsing.
  }

  return parseStructuredText(text);
}
