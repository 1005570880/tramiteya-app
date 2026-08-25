export type Comparendo = {
  number: string;
  violationDate?: string;
  coactiveDate?: string;
  origin?: string;
  infraction?: string;
  totalFine?: number;
  paymentOrderNoticeDate?: string;
};

export type TransitPrescriptionAnalysis = {
  elapsedYears: number | null;
  threeYearDate: string | null;
  meetsThreeYearThreshold: boolean | null;
  basisDate: 'violationDate' | 'none';
  summary: string;
  reason: string;
  initialThreeYearDate: string | null;
  restartThreeYearDate: string | null;
  interruptionStatus: 'not_provided' | 'not_within_initial_term' | 'potentially_interrupted' | 'post_interruption_term_exceeded';
};

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addYears(value: string, years: number) {
  const date = parseDate(value);
  if (!date) return null;
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function formatDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function completeYears(from: Date, to: Date) {
  let years = to.getFullYear() - from.getFullYear();
  const anniversaryPassed =
    to.getMonth() > from.getMonth() ||
    (to.getMonth() === from.getMonth() && to.getDate() >= from.getDate());
  if (!anniversaryPassed) years -= 1;
  return Math.max(0, years);
}

export function analyzeTransitPrescription(item: Comparendo, asOf = new Date()): TransitPrescriptionAnalysis {
  const violation = parseDate(item.violationDate);
  const notice = parseDate(item.paymentOrderNoticeDate);

  if (!violation) {
    return {
      elapsedYears: null,
      threeYearDate: null,
      meetsThreeYearThreshold: null,
      basisDate: 'none',
      summary: 'Información insuficiente para calcular el término legal con seguridad.',
      reason: 'El artículo 159 de la Ley 769 de 2002 toma como referencia la ocurrencia del hecho. La fecha de cobro coactivo no sustituye esa fecha y no se presume como fecha inicial.',
      initialThreeYearDate: null,
      restartThreeYearDate: null,
      interruptionStatus: notice ? 'not_within_initial_term' : 'not_provided',
    };
  }

  const initialThreshold = addYears(item.violationDate!, 3);
  const initialExpired = initialThreshold ? asOf >= initialThreshold : false;

  // A mandamiento only has interruptive relevance here when its notification is
  // established. Its mere issuance or the existence of a coactive process is not
  // treated as equivalent to notification.
  if (!notice) {
    const elapsedYears = completeYears(violation, asOf);
    return {
      elapsedYears,
      threeYearDate: formatDate(initialThreshold),
      meetsThreeYearThreshold: initialExpired,
      basisDate: 'violationDate',
      summary: initialExpired
        ? 'Han transcurrido al menos tres años desde la ocurrencia del hecho y no se aportó una fecha verificable de notificación del mandamiento de pago.'
        : 'Aún no se acreditan tres años desde la ocurrencia del hecho.',
      reason: initialExpired
        ? 'Debe verificarse si existió y fue notificado oportunamente un mandamiento de pago u otra actuación jurídicamente relevante. No se presume interrupción por la sola existencia del cobro coactivo.'
        : 'El término inicial de tres años aún no aparece cumplido con la información disponible.',
      initialThreeYearDate: formatDate(initialThreshold),
      restartThreeYearDate: null,
      interruptionStatus: 'not_provided',
    };
  }

  const noticeBeforeInitialExpiry = !!initialThreshold && notice <= initialThreshold;
  const restartThreshold = noticeBeforeInitialExpiry ? addYears(item.paymentOrderNoticeDate!, 3) : null;
  const restartExpired = !!restartThreshold && asOf >= restartThreshold;

  if (!noticeBeforeInitialExpiry) {
    return {
      elapsedYears: completeYears(violation, asOf),
      threeYearDate: formatDate(initialThreshold),
      meetsThreeYearThreshold: initialExpired,
      basisDate: 'violationDate',
      summary: 'La fecha informada de notificación del mandamiento es posterior al vencimiento preliminar del término inicial de tres años.',
      reason: 'La notificación del mandamiento debe confrontarse con el vencimiento del término inicial. Si el término ya había prescrito, una actuación posterior no debe tratarse automáticamente como interruptiva de una obligación ya prescrita.',
      initialThreeYearDate: formatDate(initialThreshold),
      restartThreeYearDate: null,
      interruptionStatus: 'not_within_initial_term',
    };
  }

  return {
    elapsedYears: completeYears(notice, asOf),
    threeYearDate: formatDate(restartThreshold),
    meetsThreeYearThreshold: restartExpired,
    basisDate: 'violationDate',
    summary: restartExpired
      ? 'La notificación del mandamiento aparece dentro del término inicial y han transcurrido al menos tres años desde dicha notificación.'
      : 'La notificación del mandamiento aparece dentro del término inicial y el nuevo término de tres años aún no aparece cumplido.',
    reason: restartExpired
      ? 'Conforme al artículo 818 del Estatuto Tributario, una vez interrumpida la prescripción por la notificación del mandamiento, el término vuelve a correr desde el día siguiente. Deben revisarse además las demás actuaciones del expediente que puedan tener relevancia jurídica.'
      : 'La notificación acreditada del mandamiento reinicia el análisis temporal. El término posterior aún no aparece vencido con los datos suministrados.',
    initialThreeYearDate: formatDate(initialThreshold),
    restartThreeYearDate: formatDate(restartThreshold),
    interruptionStatus: restartExpired ? 'post_interruption_term_exceeded' : 'potentially_interrupted',
  };
}
