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
  if (!rawText || rawText.trim().length === 0) return { cedula: '', comparendos: [] };

  const cleanText = rawText.replace(/\r/g, '')
    .replace(/Pendiente\s+de\s+pago/gi, 'Pendiente de pago')
    .replace(/Cobro\s+coactivo/gi, 'Cobro coactivo');

  let cedula = '';
  const cedulaMatch = cleanText.match(/Cédula:\s*\|?\s*(\d+)/i) || cleanText.match(/\b(\d{7,10})\b/);
  if (cedulaMatch) cedula = cedulaMatch[1];

  const ID_REGEX = /(?:\b\d{20}\b|\b\d{4}-[A-Z0-9]+-[A-Z0-9]+\b|\b[A-Z]{2}-\d{4}-\d+\b|\b\d{8,12}\b)/g;
  const matches = cleanText.match(ID_REGEX) || [];
  const rawIds = Array.from(new Set(matches)).filter((id) => id !== cedula && !id.startsWith('018000') && !id.startsWith('333602') && !id.startsWith('200000'));

  const comparendos: SimitRecord[] = [];
  for (const id of rawIds) {
    const pos = cleanText.indexOf(id);
    if (pos === -1) continue;
    const chunk = cleanText.substring(Math.max(0, pos - 20), Math.min(cleanText.length, pos + 280));

    const fechaMatch = chunk.match(/(\d{2}\/\d{2}\/\d{4})/);
    const fechaComparendo = fechaMatch ? fechaMatch[1] : 'Fecha no identificada';
    const infraccionMatch = chunk.match(/\b([A-Z]\d{2,3})\b/);
    const codigoInfraccion = infraccionMatch ? infraccionMatch[1] : 'Infracción reportada';

    let organismoTransito = 'Organismo de Tránsito';
    if (fechaMatch && infraccionMatch) {
      const idxFecha = chunk.indexOf(fechaMatch[1]);
      const idxInfraccion = chunk.indexOf(infraccionMatch[1]);
      if (idxFecha !== -1 && idxInfraccion !== -1 && idxInfraccion > idxFecha) {
        let rawOrg = chunk.substring(idxFecha + fechaMatch[1].length, idxInfraccion);
        rawOrg = rawOrg
          .replace(/\d{2}:\d{2}:\d{2}/g, '')
          .replace(/[|#\t\n\r]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (rawOrg.length > 2) organismoTransito = rawOrg;
      }
    }

    const valorMatch = chunk.match(/\$\s*([\d\.,]+)/);
    let estadoComparendo = 'Pendiente';
    if (/cobro\s+coactivo/i.test(chunk)) estadoComparendo = 'Cobro coactivo';
    else if (/pendiente\s+de\s+pago/i.test(chunk)) estadoComparendo = 'Pendiente de pago';

    comparendos.push({
      numComparendo: id,
      fechaComparendo,
      organismoTransito,
      codigoInfraccion,
      estadoComparendo,
      valorComparendo: valorMatch ? valorMatch[1] : '0',
    });
  }

  return { cedula, comparendos };
}

export function extractSimitDocumentNumber(input: string): string | undefined {
  return parseSimitPDF(input).cedula || undefined;
}

export function parseOfficialSimitText(input: string): ParsedSimitRecord[] {
  const parsed = parseSimitPDF(input);
  return parsed.comparendos.map((r) => ({
    ...r,
    kind: /cobro\s+coactivo/i.test(r.estadoComparendo) ? 'multa' : 'comparendo',
    number: r.numComparendo,
    date: r.fechaComparendo,
    authority: r.organismoTransito,
    infractionCode: r.codigoInfraccion,
    status: r.estadoComparendo,
    value: Number(r.valorComparendo.replace(/[^0-9]/g, '')) || undefined,
  }));
}

// Compatibility export used by /api/simit/upload.
export function extractSimitPlate(input: string): string | undefined {
  const normalized = input.replace(/\r/g, '');
  const labeled = normalized.match(/(?:Placa|Veh[ií]culo)\s*[:|]?\s*([A-Z0-9]{5,8})/i);
  if (labeled) return labeled[1].toUpperCase();
  const plate = normalized.match(/\b([A-Z]{3}\s?\d{3})\b/i);
  return plate ? plate[1].replace(/\s+/g, '').toUpperCase() : undefined;
}
