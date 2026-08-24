export type Comparendo = {
  number: string;
  coactiveDate: string;
  origin?: string;
  infraction?: string;
  totalFine?: number;
  violationDate?: string;
  paymentOrderNoticeDate?: string;
};

export type PrescriptionAnalysis = {
  elapsedYears: number;
  threeYearDate: string;
  meetsThreeYearThreshold: boolean;
  basisDate: 'coactiveDate' | 'violationDate';
};

/**
 * Calculates elapsed full years from the date used by the procedure.
 * IMPORTANT: under Art. 159 of Law 769/2002 as modified by Art. 206 of
 * Decree 019/2012, the statutory 3-year prescription is counted from the
 * occurrence of the traffic offence and is interrupted by notification of
 * the payment order. The coactive date is therefore an intake signal, not
 * by itself proof that prescription has accrued.
 */
export function analyzeTransitPrescription(
  item: Comparendo,
  asOf = new Date()
): PrescriptionAnalysis | null {
  const basis = item.violationDate || item.coactiveDate;
  if (!basis) return null;

  const start = new Date(`${basis}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;

  const threeYearDate = new Date(start);
  threeYearDate.setFullYear(threeYearDate.getFullYear() + 3);

  let elapsedYears = asOf.getFullYear() - start.getFullYear();
  const anniversaryPassed =
    asOf.getMonth() > start.getMonth() ||
    (asOf.getMonth() === start.getMonth() && asOf.getDate() >= start.getDate());
  if (!anniversaryPassed) elapsedYears -= 1;

  return {
    elapsedYears: Math.max(0, elapsedYears),
    threeYearDate: threeYearDate.toISOString().slice(0, 10),
    meetsThreeYearThreshold: asOf >= threeYearDate,
    basisDate: item.violationDate ? 'violationDate' : 'coactiveDate',
  };
}

export function validateTransitPrescriptionCase(
  items: Comparendo[],
  asOf = new Date()
) {
  const analyses = items.map((item) => ({
    item,
    analysis: analyzeTransitPrescription(item, asOf),
  }));

  const blockers = analyses
    .filter(({ analysis }) => analysis && !analysis.meetsThreeYearThreshold)
    .map(({ item, analysis }) => ({
      code: 'PRESCRIPTION_UNDER_3_YEARS',
      message: `El comparendo ${item.number || 'sin número'} todavía no supera el umbral de 3 años según la fecha disponible (${analysis?.basisDate}). Verifique además la fecha de notificación del mandamiento de pago y cualquier actuación interruptiva antes de afirmar la prescripción.`,
    }));

  return {
    passed: blockers.length === 0,
    blockers,
    analyses,
  };
}
