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

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }
  return undefined;
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

export function parseOfficialSimitText(input: string): ParsedSimitRecord[] {
  const text = input.replace(/\r/g, '').trim();
  if (!text) return [];

  try {
    const parsed: any = JSON.parse(text);
    const source: any = Array.isArray(parsed)
      ? parsed
      : parsed?.comparendos || parsed?.multas || parsed?.data;
    if (Array.isArray(source)) {
      return source
        .map(parseRecord)
        .filter((item: ParsedSimitRecord | undefined): item is ParsedSimitRecord => Boolean(item));
    }
  } catch {
    // Fall through to copied official text parsing.
  }

  const normalized = text.replace(/\u00a0/g, ' ');
  const numberMatches = [...normalized.matchAll(/\b\d{11,22}\b/g)];
  if (!numberMatches.length) return [];

  const records: ParsedSimitRecord[] = [];
  for (let i = 0; i < numberMatches.length; i += 1) {
    const start = numberMatches[i].index ?? 0;
    const end = i + 1 < numberMatches.length ? (numberMatches[i + 1].index ?? normalized.length) : normalized.length;
    const chunk = normalized.slice(start, end);
    const number = numberMatches[i][0];
    const date = firstMatch(chunk, [
      /(?:fecha(?:\s+del)?\s*(?:comparendo|multa)?|fecha)\s*[:\-]?\s*(\d{4}[/-]\d{2}[/-]\d{2})/i,
      /(?:fecha(?:\s+del)?\s*(?:comparendo|multa)?|fecha)\s*[:\-]?\s*(\d{2}[/-]\d{2}[/-]\d{4})/i,
      /\b(\d{4}[/-]\d{2}[/-]\d{2})\b/,
      /\b(\d{2}[/-]\d{2}[/-]\d{4})\b/,
    ]);
    const plate = firstMatch(chunk, [/(?:placa)\s*[:\-]?\s*([A-Z]{3}\s?\d{2,3})/i, /\b([A-Z]{3}\d{3})\b/i]);
    const authority = firstMatch(chunk, [/(?:organismo|secretar[ií]a|autoridad)\s*[:\-]?\s*([^\n|]+)/i]);
    const department = firstMatch(chunk, [/(?:departamento)\s*[:\-]?\s*([^\n|]+)/i]);
    const status = firstMatch(chunk, [/(?:estado)\s*[:\-]?\s*([^\n|]+)/i]);
    const infractionCode = firstMatch(chunk, [/(?:c[oó]digo(?:\s+de)?\s+infracci[oó]n|c[oó]digo)\s*[:\-]?\s*([A-Z]\d{1,3})/i]);
    const valueMatch = chunk.match(/(?:valor|monto|total|pagar)\s*[:\-]?\s*\$?\s*([\d.,]+)/i);
    const description = firstMatch(chunk, [/(?:descripci[oó]n(?:\s+de\s+la\s+infracci[oó]n)?|infracci[oó]n)\s*[:\-]?\s*([^\n]+)/i]);

    records.push({
      kind: /multa/i.test(chunk.slice(0, 80)) ? 'multa' : 'comparendo',
      number,
      date,
      authority,
      department,
      plate: plate?.replace(/\s+/g, '').toUpperCase(),
      infractionCode: infractionCode?.toUpperCase(),
      description,
      status,
      value: valueMatch ? moneyToNumber(valueMatch[1]) : undefined,
    });
  }

  return records.filter((record, index, all) => all.findIndex(other => other.number === record.number) === index);
}
