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
  basisDate: 'violationDate' | 'coactiveDate' | 'none';
  summary: string;
  reason: string;
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
  const basis = parseDate(item.violationDate) ? 'violationDate' : parseDate(item.coactiveDate) ? 'coactiveDate' : 'none';
  const basisValue = basis === 'violationDate' ? item.violationDate : basis === 'coactiveDate' ? item.coactiveDate : undefined;

  if (!basisValue) {
    return {
      elapsedYears: null,
      threeYearDate: null,
      meetsThreeYearThreshold: null,
      basisDate: 'none',
      summary: 'Información insuficiente para calcular un término con seguridad.',
      reason: 'Falta una fecha verificable del expediente. No se debe presumir la fecha de inicio ni la interrupción del término.',
    };
  }

  const start = parseDate(basisValue)!;
  const threshold = addYears(basisValue, 3);
  const elapsedYears = completeYears(start, asOf);
  const meets = threshold ? asOf >= threshold : null;

  return {
    elapsedYears,
    threeYearDate: formatDate(threshold),
    meetsThreeYearThreshold: meets,
    basisDate: basis,
    summary: meets ? `Han transcurrido al menos tres años desde la fecha base (${basis === 'violationDate' ? 'infracción' : 'coactivo'}).` : `Aún no se acreditan tres años desde la fecha base (${basis === 'violationDate' ? 'infracción' : 'coactivo'}).`,
    reason: meets
      ? 'El umbral temporal preliminar se encuentra cumplido, pero debe verificarse el expediente y las actuaciones que puedan afectar el término.'
      : 'El umbral temporal preliminar no aparece cumplido con la fecha actualmente disponible.',
  };
}
