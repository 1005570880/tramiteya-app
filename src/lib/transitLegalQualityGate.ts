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
    name?: string;
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

export function runTransitLegalQualityGate(input: TransitPrescriptionCase): QualityResult & {
  analyses: Array<ReturnType<typeof analyzeTransitPrescription>>;
} {
  const issues: QualityIssue[] = [];
  const asOf = input.asOf ? new Date(`${input.asOf}T00:00:00`) : new Date();

  if (!input.applicant.fullName.trim()) issues.push({ code: 'APPLICANT_NAME_REQUIRED', severity: 'blocker', message: 'Falta el nombre completo del solicitante.', field: 'fullName' });
  if (!input.applicant.documentNumber.trim()) issues.push({ code: 'APPLICANT_DOCUMENT_REQUIRED', severity: 'blocker', message: 'Falta el número de identificación.', field: 'documentNumber' });
  if (!input.applicant.email.trim()) issues.push({ code: 'APPLICANT_EMAIL_REQUIRED', severity: 'blocker', message: 'Falta el correo para notificaciones.', field: 'email' });
  if (!input.authority.municipality.trim()) issues.push({ code: 'AUTHORITY_MUNICIPALITY_REQUIRED', severity: 'blocker', message: 'Falta el municipio donde ocurrió el comparendo.', field: 'authority.municipality' });
  if (!input.authority.department.trim()) issues.push({ code: 'AUTHORITY_DEPARTMENT_REQUIRED', severity: 'blocker', message: 'Falta el departamento donde ocurrió el comparendo.', field: 'authority.department' });
  if (!input.authority.name?.trim()) issues.push({ code: 'AUTHORITY_PENDING_RESOLUTION', severity: 'warning', message: 'La autoridad exacta se resolverá a partir del municipio y del expediente; no se le pide al usuario que la adivine.', field: 'authority.name' });
  if (input.comparendos.length === 0) issues.push({ code: 'COMPARANDOS_REQUIRED', severity: 'blocker', message: 'Debe existir al menos un comparendo.', field: 'comparendos' });

  const analyses = input.comparendos.map((item, index) => {
    if (!item.number.trim()) issues.push({ code: 'COMPARANDO_NUMBER_REQUIRED', severity: 'blocker', message: `Falta el número del comparendo ${index + 1}.`, comparendoIndex: index });

    if (item.coactiveDate && !isValidDate(item.coactiveDate)) {
      issues.push({ code: 'COACTIVE_DATE_INVALID', severity: 'blocker', message: `La fecha de cobro coactivo del comparendo ${index + 1} no es válida.`, comparendoIndex: index });
    }
    if (item.violationDate && !isValidDate(item.violationDate)) {
      issues.push({ code: 'VIOLATION_DATE_INVALID', severity: 'blocker', message: `La fecha de la infracción del comparendo ${index + 1} no es válida.`, comparendoIndex: index });
    }
    if (item.paymentOrderNoticeDate && !isValidDate(item.paymentOrderNoticeDate)) {
      issues.push({ code: 'PAYMENT_ORDER_NOTICE_DATE_INVALID', severity: 'blocker', message: `La fecha de notificación del mandamiento del comparendo ${index + 1} no es válida.`, comparendoIndex: index });
    }

    if (!item.violationDate || !item.coactiveDate || !item.paymentOrderNoticeDate) {
      issues.push({
        code: 'EXPEDIENTE_DATA_PENDING',
        severity: 'warning',
        message: `El comparendo ${item.number || index + 1} requiere verificación documental de fechas y actuaciones. TrámiteYa no presume estos datos ni le pide al usuario que los recuerde.`,
        comparendoIndex: index,
      });
    }

    return analyzeTransitPrescription(item, asOf);
  });

  const completeness = Math.max(0, Math.round(100 - (issues.filter((i) => i.severity === 'warning').length * 6)));
  const result = calculateQualityScore(issues, completeness);

  // En tránsito, una advertencia documental impide presentar el escrito como jurídicamente listo.
  // El usuario puede avanzar, pero la generación final solo se habilita cuando el expediente esté verificado.
  return { ...result, canGenerate: result.level === 'green', analyses };
}
