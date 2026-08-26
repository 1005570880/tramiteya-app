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
  const rawValue = item.valorPagar ?? item.valor ?? item.valorMulta ?? item.valorTotal;
  const value = typeof rawValue === 'number' ? rawValue : moneyToNumber(String(rawValue ?? ''));
  return {
    kind,
    number,
    date: String(item.fechaComparendo ?? item.fecha ?? '').trim() || undefined,
    authority: String(item.organismoTransito ?? item.organismo ?? item.autoridad ?? item.secretaria ?? '').trim() || undefined,
    department: String(item.departamento ?? '').trim() || undefined,
    plate: String(item.placa ?? '').trim() || undefined,
    infractionCode: String(item.codigoInfraccion ?? item.codigo ?? item.infraccion ?? '').trim() || undefined,
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
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractDate(value: string) {
  const match = value.match(/\b(\d{2}[\/-]\d{2}[\/-]\d{4}|\d{4}[\/-]\d{2}[\/-]\d{2})\b/);
  return match?.[1];
}

function extractStatus(value: string) {
  const match = value.match(/\b(Pendiente(?:\s+de\s+pago)?|Cobro\s+coactivo|Pagado|Cancelado|Acuerdo\s+de\s+pago|Vigente|En\s+cobro)\b/i);
  return match ? clean(match[1]) : undefined;
}

function extractMoney(value: string) {
  const matches = [...value.matchAll(/\$?\s*([\d]{1,3}(?:[.,][\d]{3})+|\d{4,})\b/g)];
  if (!matches.length) return undefined;
  // In a SIMIT row the monetary amount is normally the last numeric token.
  return moneyToNumber(matches[matches.length - 1][1]);
}

function extractInfractionCode(value: string) {
  // SIMIT traffic codes used in the statement: C02, C35, C29, C06, D02, etc.
  const match = value.match(/\b([A-Z][0-9]{1,3})\b/i);
  return match?.[1]?.toUpperCase();
}

function parseRows(text: string): ParsedSimitRecord[] {
  const normalized = normalizeText(text);
  const lines = normalized.split('\n').map(clean).filter(Boolean);
  const identifier = /^(?:\d{10,24}|\d{4,}-[A-Z0-9]+(?:-[A-Z0-9]+)*|[A-Z]{1,12}-\d{3,}(?:-[A-Z0-9]+)*)$/i;
  const numbered = /^(\d{1,4})[.)]\s*$/;
  const records: ParsedSimitRecord[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    let number = '';
    let start = i;

    // Layout A: "1." on one line, identifier on the next.
    if (numbered.test(lines[i]) && identifier.test(lines[i + 1] || '')) {
      number = lines[i + 1].replace(/\s+/g, '');
      start = i + 1;
    // Layout B: "1. 2024-FAD-02337" on one line.
    } else {
      const inline = lines[i].match(/^\d{1,4}[.)]\s+(.+)$/);
      if (inline && identifier.test(inline[1].trim())) {
        number = inline[1].trim().replace(/\s+/g, '');
        start = i;
      // Layout C: identifier alone on a line.
      } else if (identifier.test(lines[i])) {
        number = lines[i].replace(/\s+/g, '');
        start = i;
      }
    }

    if (!number) continue;

    // Consume until the next identifier/numbered record. This handles PDF table
    // extraction that places date, time, authority, code, status and amount on
    // separate lines and also handles "Pendiente de / pago".
    const parts: string[] = [];
    for (let j = start + 1; j < lines.length; j += 1) {
      if (identifier.test(lines[j])) break;
      if (numbered.test(lines[j]) && identifier.test(lines[j + 1] || '')) break;
      const inline = lines[j].match(/^\d{1,4}[.)]\s+(.+)$/);
      if (inline && identifier.test(inline[1].trim())) break;
      if (/^#\s*N[úu]mero\s+multa/i.test(lines[j])) break;
      if (/^Total\s+a\s+pagar/i.test(lines[j])) break;
      parts.push(lines[j]);
    }

    const body = clean(parts.join(' '));
    const date = extractDate(body);
    const infractionCode = extractInfractionCode(body);
    const value = extractMoney(body);
    const status = extractStatus(body);

    // Require the three strongest signals of a SIMIT row. This deliberately
    // accepts rows with missing optional columns, while rejecting headings/totals.
    if (!date || !infractionCode || value === undefined) continue;

    const dateIndex = body.indexOf(date);
    const codeIndex = body.toUpperCase().indexOf(infractionCode);
    let authority: string | undefined;
    if (dateIndex >= 0 && codeIndex > dateIndex) {
      authority = clean(body.slice(dateIndex + date.length, codeIndex))
        .replace(/^\d{2}:\d{2}(?::\d{2})?\s*/, '')
        .trim();
    }
    if (!authority && codeIndex > 0) {
      authority = clean(body.slice(0, codeIndex))
        .replace(/^\d{2}:\d{2}(?::\d{2})?\s*/, '')
        .trim();
    }
    authority = authority
      ?.replace(/\b(Pendiente(?:\s+de\s+pago)?|Cobro\s+coactivo|Pagado|Cancelado|Acuerdo\s+de\s+pago|Vigente|En\s+cobro)\b.*$/i, '')
      .replace(/\$?\s*[\d.,]+.*$/, '')
      .trim() || undefined;

    records.push({
      kind: /\bcobro\s+coactivo\b|\bmulta\b/i.test(body) ? 'multa' : 'comparendo',
      number,
      date,
      authority,
      infractionCode,
      status,
      value,
    });
  }

  const merged = new Map<string, ParsedSimitRecord>();
  for (const record of records) {
    const key = record.number || '';
    const previous = merged.get(key);
    merged.set(key, {
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
    // Continue with text parsing.
  }

  return parseRows(text);
}
