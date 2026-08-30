export interface SimitRecord {
  numComparendo: string;
  fechaComparendo: string;
  organismoTransito: string;
  codigoInfraccion: string;
  estadoComparendo: string;
  valorComparendo: string;
}

export type ParsedSimitRecord = SimitRecord & {
  kind: 'multa' | 'comparendo'; number?: string; date?: string; time?: string; authority?: string;
  municipality?: string; department?: string; plate?: string; ownerName?: string; documentNumber?: string;
  infractionCode?: string; description?: string; status?: string; value?: number; resolutionNumber?: string;
  resolutionDate?: string; notificationDate?: string; paymentDate?: string;
};

export function parseSimitPDF(rawText: string): { cedula: string; comparendos: SimitRecord[] } {
  console.log('=== SIMIT RAW TEXT LENGTH ===', rawText ? rawText.length : 0);
  if (!rawText) return { cedula: '', comparendos: [] };

  const cleanText = rawText
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\r/g, '')
    .replace(/Pendiente\s+de\s+pago/gi, 'Pendiente de pago')
    .replace(/Cobro\s+coactivo/gi, 'Cobro coactivo');

  let cedula = '';
  const cedulaMatch = cleanText.match(/Cédula:\s*\|?\s*(\d+)/i) || cleanText.match(/(\d{7,10})/);
  if (cedulaMatch) cedula = cedulaMatch[1];

  const ID_REGEX = /(\d{20}|\d{4}-[A-Z0-9]+-[A-Z0-9]+|[A-Z]{2}-\d{4}-\d+|\d{8,12})/g;
  const matches = cleanText.match(ID_REGEX) || [];
  const rawIds = Array.from(new Set(matches)).filter(id => id !== cedula && !id.startsWith('018000') && !id.startsWith('333602') && id.length >= 8);
  console.log('=== COMPARENDOS DETECTADOS (IDs) ===', rawIds);

  const comparendos: SimitRecord[] = [];
  for (const id of rawIds) {
    const pos = cleanText.indexOf(id);
    if (pos === -1) continue;
    const chunk = cleanText.substring(Math.max(0, pos - 40), Math.min(cleanText.length, pos + 310));
    const fechaMatch = chunk.match(/(\d{2}\/\d{2}\/\d{4})/);
    const fechaComparendo = fechaMatch ? fechaMatch[1] : '';
    const infraccionMatch = chunk.match(/([A-Z]\d{2,3})/);
    const codigoInfraccion = infraccionMatch ? infraccionMatch[1] : '';

    let organismoTransito = 'ORGANISMO DE TRÁNSITO';
    if (fechaMatch && infraccionMatch) {
      const idxFecha = chunk.indexOf(fechaMatch[1]);
      const idxInfraccion = chunk.indexOf(infraccionMatch[1]);
      if (idxFecha !== -1 && idxInfraccion !== -1 && idxInfraccion > idxFecha) {
        let rawOrg = chunk.substring(idxFecha + fechaMatch[1].length, idxInfraccion);
        rawOrg = rawOrg
          .replace(/\d{2}:\d{2}:\d{2}/g, '')
          .replace(/\b\d{1,3}\b/g, '')
          .replace(/[|#\t\n\r]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (rawOrg.length > 2) organismoTransito = rawOrg.toUpperCase();
      }
    }

    const valorMatch = chunk.match(/\$\s*([\d\.,]+)/);
    let estadoComparendo = 'Pendiente';
    if (/cobro\s+coactivo/i.test(chunk)) estadoComparendo = 'Cobro coactivo';
    else if (/pendiente\s+de\s+pago/i.test(chunk)) estadoComparendo = 'Pendiente de pago';

    comparendos.push({ numComparendo: id, fechaComparendo, organismoTransito, codigoInfraccion, estadoComparendo, valorComparendo: valorMatch ? valorMatch[1] : '0' });
  }
  console.log('=== SIMIT PARSED RECORDS ===', comparendos.length);
  return { cedula, comparendos };
}

export function extractSimitDocumentNumber(input: string): string | undefined { return parseSimitPDF(input).cedula || undefined; }
export function parseOfficialSimitText(input: string): ParsedSimitRecord[] { return parseSimitPDF(input).comparendos.map(r => ({ ...r, kind: /cobro\s+coactivo/i.test(r.estadoComparendo) ? 'multa' : 'comparendo', number: r.numComparendo, date: r.fechaComparendo, authority: r.organismoTransito, infractionCode: r.codigoInfraccion, status: r.estadoComparendo, value: Number(r.valorComparendo.replace(/[^0-9]/g, '')) || undefined })); }
export function extractSimitPlate(input: string): string | undefined { const normalized = input.replace(/\r/g, ''); const labeled = normalized.match(/(?:Placa|Veh[ií]culo)\s*[:|]?\s*([A-Z0-9]{5,8})/i); if (labeled) return labeled[1].toUpperCase(); const plate = normalized.match(/\b([A-Z]{3}\s?\d{3})\b/i); return plate ? plate[1].replace(/\s+/g, '').toUpperCase() : undefined; }
