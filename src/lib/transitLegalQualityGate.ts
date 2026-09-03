import { analyzeTransitPrescription, type Comparendo } from './transitPrescription';
import { calculateQualityScore, type QualityIssue, type QualityResult } from './legalQualityGate';

export type TransitPrescriptionCase = {
  applicant: {
    fullName: string;
    documentType: string;
    documentNumber: string;
    email: string;
  };
  authority: {
    name: string;
    municipality: string;
    department: string;
  };
  comparendos: Comparendo[];
  asOf?: string;
};

function isValidDate(value?: string) {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

function yearsBetween(from: string, to: Date) {
  const start = new Date(`${from}T00:00:00`);
  let years = to.getFullYear() - start.getFullYear();
  const anniversaryPassed =
    to.getMonth() > start.getMonth() ||
    (to.getMonth() === start.getMonth() && to.getDate() >= start.getDate());
  if (!anniversaryPassed) years -= 1;
  return Math.max(0, years);
}

export function runTransitLegalQualityGate(input: TransitPrescriptionCase): QualityResult & {
  analyses: Array<ReturnType<typeof analyzeTransitPrescription>>;
} {
  const issues: QualityIssue[] = [];
  const asOf = input.asOf ? new Date(`${input.asOf}T00:00:00`) : new Date();

  if (!input.applicant.fullName.trim()) issues.push({ code: 'APPLICANT_NAME_REQUIRED', severity: 'blocker', message: 'Falta el nombre completo del solicitante.', field: 'fullName' });
  if (!input.applicant.documentNumber.trim()) issues.push({ code: 'APPLICANT_DOCUMENT_REQUIRED', severity: 'blocker', message: 'Falta el número de identificación.', field: 'documentNumber' });
  if (!input.applicant.email.trim()) issues.push({ code: 'APPLICANT_EMAIL_REQUIRED', severity: 'blocker', message: 'Falta el correo para notificaciones.', field: 'email' });
  if (!input.authority.name.trim()) issues.push({ code: 'AUTHORITY_REQUIRED', severity: 'blocker', message: 'Falta identificar la autoridad de tránsito.', field: 'authority.name' });
  if (input.comparendos.length === 0) issues.push({ code: 'COMPARANDOS_REQUIRED', severity: 'blocker', message: 'Debe existir al menos un comparendo.', field: 'comparendos' });

  const analyses = input.comparendos.map((item, index) => {
    if (!item.number.trim()) issues.push({ code: 'COMPARANDO_NUMBER_REQUIRED', severity: 'blocker', message: `Falta el número del comparendo ${index + 1}.`, comparendoIndex: index });
    if (!isValidDate(item.coactiveDate)) issues.push({ code: 'COACTIVE_DATE_REQUIRED', severity: 'blocker', message: `Falta una fecha válida de cobro coactivo para el comparendo ${index + 1}.`, comparendoIndex: index });
    if (item.violationDate && !isValidDate(item.violationDate)) issues.push({ code: 'VIOLATION_DATE_INVALID', severity: 'blocker', message: `La fecha de la infracción del comparendo ${index + 1} no es válida.`, comparendoIndex: index });

    if (isValidDate(item.coactiveDate)) {
      const coactiveYears = yearsBetween(item.coactiveDate, asOf);
      if (coactiveYears < 3) {
        issues.push({
          code: 'COACTIVE_UNDER_3_YEARS',
          severity: 'blocker',
          message: `El coactivo del comparendo ${item.number || index + 1} tiene menos de 3 años. TrámiteYa bloquea la generación de la solicitud de prescripción hasta verificar el término y las actuaciones del expediente.`,
          field: 'coactiveDate',
          comparendoIndex: index,
        });
      }
    }

    if (item.paymentOrderNoticeDate && !isValidDate(item.paymentOrderNoticeDate)) {
      issues.push({ code: 'PAYMENT_ORDER_NOTICE_DATE_INVALID', severity: 'blocker', message: `La fecha de notificación del mandamiento de pago del comparendo ${index + 1} no es válida.`, comparendoIndex: index });
    }

    if (!item.violationDate) {
      issues.push({ code: 'VIOLATION_DATE_MISSING', severity: 'warning', message: `No se indicó la fecha de la infracción del comparendo ${item.number || index + 1}. Se utilizará la fecha de coactivo solo como referencia de cálculo y no como conclusión jurídica.`, comparendoIndex: index });
    }

    if (!item.paymentOrderNoticeDate) {
      issues.push({ code: 'PAYMENT_ORDER_NOTICE_DATE_MISSING', severity: 'warning', message: `No se indicó la fecha de notificación del mandamiento de pago del comparendo ${item.number || index + 1}. Verifique el expediente antes de sostener que no hubo interrupción del término.`, comparendoIndex: index });
    }

    return analyzeTransitPrescription(item, asOf);
  });

  const completeness = Math.max(0, Math.round(100 - (issues.filter((i) => i.severity === 'warning').length * 6)));
  const result = calculateQualityScore(issues, completeness);
  return { ...result, analyses };
}
