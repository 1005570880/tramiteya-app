export interface SelectedRecordData {
  comparendo: string;
  fecha: string;
  organismo: string;
  estado: string;
  valor: string;
  placa?: string;
  cedula?: string;
}

export interface LegalDraft {
  hechos: string;
  solicitudConcreta: string;
  fundamentos: string;
}

export function generateLegalDraft(record: SelectedRecordData): LegalDraft {
  const autoridad = record.organismo && record.organismo !== '—'
    ? record.organismo
    : 'la Autoridad de Tránsito competente';

  const comparendo = record.comparendo || 'no identificado';
  const fecha = record.fecha || 'no identificada';
  const estado = record.estado || 'no identificado';
  const valor = record.valor || 'no reportado';

  const hechos =
    `1. En el Estado de Cuenta del SIMIT se encuentra registrado a mi nombre el comparendo/orden de comparendo No. ${comparendo}, de fecha ${fecha}.\n` +
    `2. Dicho registro aparece adscrito a ${autoridad}, registrando un estado de "${estado}" y un valor reportado de ${valor}.\n` +
    `3. A la fecha, me encuentro adelantando la verificación de la legalidad de las actuaciones administrativas, la notificación efectiva del acto y la vigencia de los términos de cobro por parte de la autoridad competente.`;

  const solicitudConcreta =
    `1. PRIMERO: Se revise formalmente la actuación administrativa asociada a la orden de comparendo No. ${comparendo} de fecha ${fecha}.\n` +
    `2. SEGUNDO: En caso de existir vicios en la notificación, caducidad de la facultad sancionatoria o prescripción del cobro conforme a los términos de ley, se deje sin efecto la infracción y se proceda con el archivo definitivo del expediente.\n` +
    `3. TERCERO: Se expida y descargue del sistema SIMIT el paz y salvo correspondiente una vez resuelta la presente solicitud.`;

  const fundamentos =
    `Fundamento mi petición en el artículo 23 de la Constitución Política de Colombia, la Ley 1755 de 2015 (Derecho de Petición), los artículos 159 y 161 del Código Nacional de Tránsito (Ley 769 de 2002) relativos a los términos de prescripción y caducidad de las sanciones de tránsito, y las garantías del debido proceso administrativo consagradas en el artículo 29 de la Constitución Política.`;

  return { hechos, solicitudConcreta, fundamentos };
}
