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
    kind, number,
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

function parseStructuredText(text: string): ParsedSimitRecord[] {
  const lines = text.replace(/\r/g, '').replace(/\u00a0/g, ' ').split('\n').map(clean).filter(Boolean);
  const dateRe = /^(\d{2}\/\d{2}\/\d{4}|\d{4}[/-]\d{2}[/-]\d{2})$/;
  const timeRe = /^\d{2}:\d{2}:\d{2}$/;
  const numberRe = /^(?:\d{11,22}|\d{4,}-[A-Z0-9]+(?:-[A-Z0-9]+)*|[A-Z]{1,6}-\d{3,}(?:-[A-Z0-9]+)*)$/i;
  const codeRe = /^[A-Z]\d{1,3}$/i;
  const moneyRe = /^\$?\s*[\d.,]+$/;
  const statusWords = /^(pendiente|pendiente de pago|cobro coactivo|pagado|cancelado|acuerdo de pago|vigente|en cobro)$/i;
  const records: ParsedSimitRecord[] = [];

  for (let i = 0; i < lines.length;) {
    const number = lines[i].replace(/\s+/g, '');
    if (!numberRe.test(number) || dateRe.test(number) || moneyRe.test(number)) { i += 1; continue; }

    let j = i + 1;
    const date = dateRe.test(lines[j] || '') ? lines[j++] : undefined;
    if (!date) { i += 1; continue; }
    if (timeRe.test(lines[j] || '')) j += 1;

    // Skip column/page headers accidentally captured between records.
    while (j < lines.length && /^(#?\s*n[uú]mero multa|fecha|secretar[ií]a|infracci[oó]n|estado|valor total|estado de cuenta)$/i.test(lines[j])) j += 1;

    const authorityParts: string[] = [];
    while (j < lines.length && !codeRe.test(lines[j]) && !statusWords.test(lines[j]) && !moneyRe.test(lines[j]) && !numberRe.test(lines[j])) {
      if (dateRe.test(lines[j]) || timeRe.test(lines[j])) break;
      authorityParts.push(lines[j++]);
      if (authorityParts.length >= 3) break;
    }
    const authority = authorityParts.join(' ') || undefined;
    const infractionCode = codeRe.test(lines[j] || '') ? lines[j++].toUpperCase() : undefined;
    const status = statusWords.test(lines[j] || '') ? lines[j++] : undefined;
    const value = moneyRe.test(lines[j] || '') ? moneyToNumber(lines[j++]) : undefined;

    records.push({
      kind: status?.toLowerCase() === 'cobro coactivo' ? 'multa' : 'comparendo',
      number,
      date,
      authority,
      infractionCode,
      status,
      value,
    });
    i = Math.max(j, i + 1);
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
