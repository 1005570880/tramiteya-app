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

/**
 * Parses the text layout produced by the official SIMIT statement PDF.
 * The PDF is a table and pdf-parse may place each cell on its own line.
 * We therefore detect each row from its number + date, then parse the
 * complete row independently. This also handles multi-word/multi-line
 * authorities such as "Agustin Codazzi" and the continuation page header.
 */
function parseStructuredText(text: string): ParsedSimitRecord[] {
  const normalized = text
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
  if (!normalized) return [];

  // Official SIMIT numbers appear both as long numeric identifiers and
  // alphanumeric identifiers such as 2025-FAD-01635 or TC-2024-34172.
  const numberPattern = '(?:\\d{11,24}|\\d{4,}-[A-Z0-9]+(?:-[A-Z0-9]+)*|[A-Z]{1,12}-\\d{3,}(?:-[A-Z0-9]+)*)';
  const datePattern = '\\d{2}\\/\\d{2}\\/\\d{4}|\\d{4}[\\/-]\\d{2}[\\/-]\\d{2}';
  const rowStartRe = new RegExp(`(${numberPattern})\\s+(${datePattern})\\s+(?:\\d{2}:\\d{2}:\\d{2}\\s+)?`, 'gi');
  const starts = [...normalized.matchAll(rowStartRe)];
  const records: ParsedSimitRecord[] = [];

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i].index ?? 0;
    const nextStart = starts[i + 1]?.index ?? normalized.length;
    let row = normalized.slice(start, nextStart).trim();
    row = row.split(/\s+#?\s*N[uú]mero\s+multa\s+Fecha\s+Secretar[ií]a/i)[0];
    row = row.split(/\s+Total\s+a\s+pagar\b/i)[0];
    row = row.split(/\s+La\s+informaci[oó]n\s+contenida\s+en\s+el\s+sistema/i)[0];

    const head = row.match(new RegExp(`^(${numberPattern})\\s+(${datePattern})\\s+(.*)$`, 'i'));
    if (!head) continue;

    const number = head[1].replace(/\s+/g, '');
    const date = head[2];
    let body = clean(head[3]);

    // The final fields of a SIMIT row are always infraction code, status and
    // amount. Everything before them belongs to the authority/organism.
    const tail = body.match(/^(.*?)\s+([A-Z]\\d{1,3})\s+(Pendiente(?: de pago)?|Cobro coactivo|Pagado|Cancelado|Acuerdo de pago|Vigente|En cobro)\s+\\$?\s*([\\d.,]+)\s*$/i);
    if (!tail) continue;

    const authority = clean(tail[1]);
    const infractionCode = tail[2].toUpperCase();
    const status = clean(tail[3]);
    const value = moneyToNumber(tail[4]);
    if (!number || !date || !authority || !infractionCode || value === undefined) continue;

    records.push({
      kind: status.toLowerCase() === 'cobro coactivo' ? 'multa' : 'comparendo',
      number,
      date,
      authority,
      infractionCode,
      status,
      value,
    });
  }

  return records.filter((record, index, all) => all.findIndex(other => other.number === record.number) === index);
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
