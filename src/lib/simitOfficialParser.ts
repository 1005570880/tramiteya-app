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

export type ParsedSimitStatement = {
  isSimitStatement: boolean;
  recordCount: number;
  totalDebt?: number;
  records: ParsedSimitRecord[];
};

function clean(value: string) { return value.replace(/\s+/g, ' ').trim(); }
function moneyToNumber(value: string) { const digits = value.replace(/[^0-9]/g, ''); return digits ? Number(digits) : undefined; }
function normalizeText(text: string) { return text.replace(/\r/g, '\n').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(); }
function extractDate(value: string) { return value.match(/\b(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}[/-]\d{2}[/-]\d{2})\b/)?.[1]; }
function extractStatus(value: string) { const match = value.match(/\b(Pendiente(?:\s+de\s+pago)?|Cobro\s+coactivo|Pagado|Cancelado|Acuerdo\s+de\s+pago|Vigente|En\s+cobro)\b/i); return match ? clean(match[1]) : undefined; }
function extractMoney(value: string) { const matches = [...value.matchAll(/(?:\$\s*)?([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,})\b/g)]; return matches.length ? moneyToNumber(matches[matches.length - 1][1]) : undefined; }
function extractInfractionCode(value: string) { return value.match(/\b([CD]\d{1,3})\b/i)?.[1]?.toUpperCase(); }
function isRecordIdentifier(value: string) {
  const v = clean(value);
  return /^(?:\d{10,24}|\d{4,}-[A-Z0-9]+(?:-[A-Z0-9]+)*|[A-Z]{1,12}-\d{3,}(?:-[A-Z0-9]+)*)$/i.test(v);
}

type RecordStart = { number: string; startIndex: number; remainder: string };

function getRecordStart(lines: string[], index: number): RecordStart | undefined {
  const line = lines[index] || '';
  const numbered = line.match(/^\d{1,4}[.)]\s*(.*)$/);
  const candidate = numbered ? numbered[1].trim() : line.trim();
  const direct = candidate.match(/^((?:\d{10,24}|\d{4,}-[A-Z0-9]+(?:-[A-Z0-9]+)*|[A-Z]{1,12}-\d{3,}(?:-[A-Z0-9]+)*))(?:\s+(.*))?$/i);
  if (direct) return { number: direct[1].replace(/\s+/g, ''), startIndex: index, remainder: direct[2] || '' };

  if (/^\d{1,4}[.)]$/.test(line)) {
    const next = lines[index + 1] || '';
    const nextMatch = next.match(/^((?:\d{10,24}|\d{4,}-[A-Z0-9]+(?:-[A-Z0-9]+)*|[A-Z]{1,12}-\d{3,}(?:-[A-Z0-9]+)*))(?:\s+(.*))?$/i);
    if (nextMatch) return { number: nextMatch[1].replace(/\s+/g, ''), startIndex: index + 1, remainder: nextMatch[2] || '' };
  }
  return undefined;
}

function parseJsonRecords(text: string): ParsedSimitRecord[] | undefined {
  try {
    const parsed: any = JSON.parse(text);
    const source = Array.isArray(parsed) ? parsed : parsed?.comparendos || parsed?.multas || parsed?.data;
    if (!Array.isArray(source)) return undefined;
    return source.map((item: any): ParsedSimitRecord | undefined => {
      const number = String(item?.numeroComparendo ?? item?.numero ?? item?.comparendo ?? item?.number ?? '').trim();
      if (!number) return undefined;
      const rawValue = item?.valorPagar ?? item?.valor ?? item?.valorMulta ?? item?.valorTotal;
      return {
        kind: /multa/i.test(String(item?.kind ?? item?.tipo ?? '')) ? 'multa' : 'comparendo',
        number,
        date: String(item?.fechaComparendo ?? item?.fecha ?? '').trim() || undefined,
        authority: String(item?.organismoTransito ?? item?.organismo ?? item?.autoridad ?? item?.secretaria ?? '').trim() || undefined,
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
      };
    }).filter(Boolean) as ParsedSimitRecord[];
  } catch { return undefined; }
}

function parseRows(text: string): ParsedSimitRecord[] {
  const lines = normalizeText(text).split('\n').map(clean).filter(Boolean);
  const records: ParsedSimitRecord[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const startInfo = getRecordStart(lines, i);
    if (!startInfo || startInfo.startIndex !== i && /^\d{1,4}[.)]$/.test(lines[i])) {
      if (!startInfo) continue;
    }
    if (startInfo.startIndex !== i) i = startInfo.startIndex;

    const parts: string[] = [];
    if (startInfo.remainder) parts.push(startInfo.remainder);

    for (let j = startInfo.startIndex + 1; j < lines.length; j += 1) {
      const nextStart = getRecordStart(lines, j);
      if (nextStart) break;
      if (/^Total\s+(?:a\s+)?pagar/i.test(lines[j]) || /^Estado\s+de\s+cuenta$/i.test(lines[j])) break;
      parts.push(lines[j]);
    }

    const body = clean(parts.join(' '));
    const date = extractDate(body);
    const code = extractInfractionCode(body);
    const value = extractMoney(body);
    if (!date || !code || value === undefined) continue;

    const dateIndex = body.indexOf(date);
    const codeIndex = body.toUpperCase().indexOf(code);
    const afterDate = dateIndex >= 0 ? body.slice(dateIndex + date.length) : body;
    const authorityPart = codeIndex > dateIndex ? body.slice(dateIndex + date.length, codeIndex) : afterDate;
    const authority = clean(authorityPart)
      .replace(/^\d{2}:\d{2}(?::\d{2})?\s*/, '')
      .replace(/\b(Pendiente(?:\s+de\s+pago)?|Cobro\s+coactivo|Pagado|Cancelado|Acuerdo\s+de\s+pago|Vigente|En\s+cobro)\b.*$/i, '')
      .replace(/\$?\s*[0-9][0-9.,]*.*$/, '')
      .trim() || undefined;

    records.push({ kind: /cobro\s+coactivo/i.test(body) ? 'multa' : 'comparendo', number: startInfo.number, date, authority, infractionCode: code, status: extractStatus(body), value });
  }

  const unique = new Map<string, ParsedSimitRecord>();
  for (const record of records) unique.set(record.number || '', { ...(unique.get(record.number || '') || {}), ...record });
  return [...unique.values()];
}

export function parseOfficialSimitText(input: string): ParsedSimitRecord[] {
  const text = normalizeText(input);
  if (!text) return [];
  const json = parseJsonRecords(text);
  return json || parseRows(text);
}

export function parseOfficialSimitStatement(input: string): ParsedSimitStatement {
  const text = normalizeText(input);
  const records = parseOfficialSimitText(text);
  const totalMatch = text.match(/(?:total\s+(?:a\s+)?pagar|total\s+deuda|total\s+pendiente)[^$0-9]{0,30}\$?\s*([0-9.,]{4,})/i);
  const totalDebt = totalMatch ? moneyToNumber(totalMatch[1]) : undefined;
  const isSimitStatement = /estado\s+de\s+cuenta/i.test(text) && /comparendos\s+y\s+multas/i.test(text);
  return { isSimitStatement, recordCount: records.length, totalDebt, records };
}
