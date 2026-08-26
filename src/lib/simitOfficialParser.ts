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
function extractMoney(value: string) { const m = [...value.matchAll(/(?:\$\s*)?([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,})\b/g)]; return m.length ? moneyToNumber(m[m.length - 1][1]) : undefined; }
function extractCode(value: string) { return value.match(/\b([CD]\d{1,3})\b/i)?.[1]?.toUpperCase(); }
function isIdentifier(value: string) { return /^(?:\d{10,24}|\d{4,}-[A-Z0-9]+(?:-[A-Z0-9]+)*|[A-Z]{1,12}-\d{3,}(?:-[A-Z0-9]+)*)$/i.test(value.trim()); }

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
  const value = extractMoney(body);
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
  const normalized = normalizeText(text);
  const records: ParsedSimitRecord[] = [];
  const rowAnchor = /(?:^|\n|\s)(?:\d{1,4}[.)]\s+)(\d{10,24}|\d{4,}-[A-Z0-9]+(?:-[A-Z0-9]+)*|[A-Z]{1,12}-\d{3,}(?:-[A-Z0-9]+)*)(?=\s|$)/gi;
  const anchors = [...normalized.matchAll(rowAnchor)];
  for (let i = 0; i < anchors.length; i += 1) {
    const number = anchors[i][1].replace(/\s+/g, '');
    const start = (anchors[i].index ?? 0) + anchors[i][0].length;
    const nextAnchor = i + 1 < anchors.length ? (anchors[i + 1].index ?? normalized.length) : normalized.length;
    const totalIndex = normalized.search(/\bTotal\s+(?:a\s+)?pagar\b/i);
    const end = Math.min(nextAnchor, totalIndex >= start ? totalIndex : normalized.length);
    const record = parseRecordChunk(number, normalized.slice(start, end));
    if (record) records.push(record);
  }
  if (!records.length) {
    const lines = normalized.split('\n').map(clean).filter(Boolean);
    for (let i = 0; i < lines.length; i += 1) {
      if (!isIdentifier(lines[i])) continue;
      const parts: string[] = [];
      for (let j = i + 1; j < lines.length; j += 1) {
        if (isIdentifier(lines[j]) || /^\d{1,4}[.)]$/.test(lines[j])) break;
        if (/^Total\s+(?:a\s+)?pagar/i.test(lines[j])) break;
        parts.push(lines[j]);
      }
      const record = parseRecordChunk(lines[i].replace(/\s+/g, ''), parts.join(' '));
      if (record) records.push(record);
    }
  }
  const unique = new Map<string, ParsedSimitRecord>();
  for (const record of records) unique.set(record.number || '', { ...(unique.get(record.number || '') || {}), ...record });
  return [...unique.values()];
}

export function parseOfficialSimitText(input: string): ParsedSimitRecord[] {
  const text = normalizeText(input);
  if (!text) return [];
  const json = parseJson(text);
  return json || parseRows(text);
}
