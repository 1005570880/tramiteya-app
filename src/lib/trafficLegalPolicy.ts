import type { LegalAssessment, LegalRoute, SelectedRecordData } from './legalEngine';

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const m = String(value).trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  const iso = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : String(value).slice(0, 10);
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function answer(record: SelectedRecordData, key: string): string {
  const answers = record.tramiAnswers || {};
  return String(answers[key] ?? (record as any)[`trami${key.charAt(0).toUpperCase()}${key.slice(1)}`] ?? '').trim();
}

function isTrue(value: unknown): boolean {
  return value === true || /^(true|sí|si|yes)$/i.test(String(value ?? '').trim());
}

export function hasPaymentAgreement(record: SelectedRecordData): boolean {
  const answers = record.tramiAnswers || {};
  return isTrue((answers as any).acuerdo_pago) || isTrue((answers as any).acuerdoPago) || /acuerdo\s+de\s+pago/i.test(answer(record, 'pagos'));
}

export function applyTrafficLegalPolicy(record: SelectedRecordData, assessment: LegalAssessment): LegalAssessment {
  const date = parseDate(record.fecha);
  const now = new Date();
  const ageMs = date ? now.getTime() - date.getTime() : Number.POSITIVE_INFINITY;
  const lessThanOneYear = Boolean(date && ageMs >= 0 && ageMs < 365.2425 * 86400000);
  const agreement = hasPaymentAgreement(record);

  const routes = [...assessment.routes];
  if (lessThanOneYear) {
    const filtered = routes.filter(route => route !== 'CADUCIDAD' && route !== 'PRESCRIPCION');
    if (!filtered.includes('DEBIDO_PROCESO')) filtered.push('DEBIDO_PROCESO');
    if (!filtered.includes('NOTIFICACION')) filtered.push('NOTIFICACION');
    return {
      ...assessment,
      primaryRoute: 'DEBIDO_PROCESO',
      routes: Array.from(new Set(filtered)),
      executiveSummary: `La fecha del hecho (${record.fecha}) es inferior a un año respecto de la fecha actual. La vía principal se orienta al debido proceso y a la verificación de la notificación de la citación, no a caducidad ni prescripción. Debe confrontarse el expediente y las constancias de notificación.`
    };
  }

  if (agreement) {
    const filtered = routes.filter(route => route !== 'CADUCIDAD');
    if (!filtered.includes('NOTIFICACION')) filtered.push('NOTIFICACION');
    return {
      ...assessment,
      primaryRoute: 'NOTIFICACION',
      routes: Array.from(new Set(filtered)),
      executiveSummary: `Se reporta un acuerdo de pago. Trámi no formula una alegación de caducidad simple; prioriza la verificación de la notificación del cobro coactivo, el mandamiento de pago, su ejecutoria y el cumplimiento del debido proceso.`
    };
  }

  return assessment;
}

export function routeLabelForPolicy(route: LegalRoute | null): string {
  switch (route) {
    case 'DEBIDO_PROCESO': return 'DEBIDO PROCESO E INDEBIDA NOTIFICACIÓN DE LA CITACIÓN';
    case 'NOTIFICACION': return 'REVISIÓN DE NOTIFICACIÓN Y DEBIDO PROCESO';
    default: return '';
  }
}
