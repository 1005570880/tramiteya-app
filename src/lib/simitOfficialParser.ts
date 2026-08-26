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
 * pdf-parse can return a row as separate lines or as a single whitespace-
 * separated line, so this parser deliberately does not depend on line breaks.
 */
function parseStructuredText(text: string): ParsedSimitRecord[] {
  const normalized = clean(text.replace(/\r/g, '').replace(/\u00a0/g, ' '));
  if (!normalized) return [];

  const numberPattern = '(?:\\d{11,22}|\\d{4,}-[A-Z0-9]+(?:-[A-Z0-9]+)*|[A-Z]{1,8}-\\d{3,}(?:-[A-Z0-9]+)*)';
  const rowRe = new RegExp(
    `(${numberPattern})\\s+(\\d{2}\\/\\d{2}\\/\\d{4}|\\d{4}[\\/-]\\d{2}[\\/-]\\d{2})\\s+(?:\\d{2}:\\d{2}:\\d{2}\\s+)?(.+?)\\s+([A-Z]\\d{1,3})\\s+(Pendiente de pago|Pendiente|Cobro coactivo|Pagado|Cancelado|Acuerdo de pago|Vigente|En cobro)\\s+\\$?\\s*([\\d.,]+)(?=\\s+${numberPattern}\\s+\\d{2}\\/\\d{2}\\/\\d{4}|\\s+${numberPattern}\\s+\\d{4}[\\/-]\\d{2}[\\/-]\\d{2}|\\s+Total\\s+a\\s+pagar|\\s+La informaci[oó]n|$)`,
    'gi'
  );

  const records: ParsedSimitRecord[] = [];
  for (const match of normalized.matchAll(rowRe)) {
    const number = match[1].replace(/\s+/g, '');
    const date = match[2];
    const authority = clean(match[3]);
    const infractionCode = match[4].toUpperCase();
    const status = clean(match[5]);
    const value = moneyToNumber(match[6]);
    if (!number || !date || !infractionCode || value === undefined) continue;

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
