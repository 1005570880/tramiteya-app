import type { FormAnswers } from '../types/form';
import { evaluateTrafficCase, getApplicableTrafficRules } from './legalRules';
import type { LegalAssessment } from './legalEngine';

const v = (a: FormAnswers, k: string, f = '') => {
  const x = a[k];
  if (Array.isArray(x)) return x.join(', ');
  if (typeof x === 'boolean') return x ? 'Sí' : 'No';
  if (x == null) return f;
  const value = String(x).trim();
  if (/^no especificad[ao] en pdf$/i.test(value)) return f;
  return value;
};

const cleanSentence = (value: string) => value.replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '.');

function getAssessment(a: FormAnswers): LegalAssessment | null {
  const value = a.__legalAssessment;
  return value && typeof value === 'object' ? value as LegalAssessment : null;
}

function routeLabel(route: string | null | undefined) {
  switch (route) {
    case 'CADUCIDAD': return 'caducidad de la actuación contravencional';
    case 'PRESCRIPCION': return 'prescripción de la obligación y/o acción de cobro, según corresponda';
    case 'PERDIDA_EJECUTORIEDAD': return 'pérdida de fuerza ejecutoria del acto administrativo';
    case 'NOTIFICACION': return 'notificación y debido proceso';
    case 'DEBIDO_PROCESO': return 'debido proceso';
    case 'REVOCATORIA_DIRECTA': return 'revocatoria directa, si resulta procedente';
    default: return 'revisión integral de la actuación administrativa';
  }
}

function buildRouteRequests(a: FormAnswers, assessment: LegalAssessment | null) {
  const number = v(a, 'numero_comparendo', 'no identificado');
  const routes = assessment?.routes ?? [];
  const requests: string[] = [];

  if (routes.includes('CADUCIDAD')) {
    requests.push(`Que se determine expresamente, con base en las fechas que obren en el expediente, si operó la caducidad de la actuación contravencional relacionada con el comparendo No. ${number}, verificando audiencia, decisión sancionatoria, recursos y ejecutoria.`);
  }
  if (routes.includes('PRESCRIPCION')) {
    requests.push('Que se establezca la fecha de ejecutoria de la sanción y, de existir cobro coactivo, la fecha de expedición y notificación del mandamiento de pago, así como todas las actuaciones posteriores que puedan incidir en el término de prescripción.');
  }
  if (routes.includes('PERDIDA_EJECUTORIEDAD')) {
    requests.push('Que se determine si se configura la pérdida de fuerza ejecutoria del acto administrativo, verificando la fecha en que quedó en firme y las actuaciones efectivamente realizadas para su ejecución dentro del término legal.');
  }
  if (routes.includes('NOTIFICACION') || routes.includes('DEBIDO_PROCESO')) {
    requests.push('Que se aporten las constancias completas de notificación de la orden de comparendo, resolución sancionatoria y demás actos relevantes, indicando fecha, medio, dirección o canal utilizado y constancia de entrega o conocimiento.');
  }
  if (routes.includes('REVOCATORIA_DIRECTA')) {
    requests.push('Que, subsidiariamente, si se acredita una causal legal de revocatoria directa o una irregularidad que afecte la validez o eficacia de la actuación, se adopte la decisión administrativa jurídicamente procedente.');
  }

  requests.push('Que se remita copia íntegra, legible y completa del expediente administrativo, incluyendo orden de comparendo, evidencia disponible, resolución sancionatoria, constancia de ejecutoria, recursos, actuaciones de cobro, mandamiento de pago y sus constancias de notificación, si existen.');
  requests.push('Que, si se acredita la configuración de la causal jurídica correspondiente, se disponga el archivo o terminación de la actuación y la actualización o depuración de los registros administrativos y sistemas de información que legalmente correspondan.');
  requests.push('Que se emita respuesta de fondo, clara, congruente y completa frente a cada una de las solicitudes anteriores.');

  return requests.map(cleanSentence);
}

function buildTitle(slug: string, assessment: LegalAssessment | null) {
  const primary = assessment?.primaryRoute;
  if (primary === 'PRESCRIPCION') return 'SOLICITUD DE PRESCRIPCIÓN DE OBLIGACIÓN DE TRÁNSITO';
  if (primary === 'PERDIDA_EJECUTORIEDAD') return 'SOLICITUD DE DECLARATORIA DE PÉRDIDA DE FUERZA EJECUTORIA';
  if (primary === 'CADUCIDAD') return 'SOLICITUD DE REVISIÓN DE CADUCIDAD DE ACTUACIÓN DE TRÁNSITO';
  if (primary === 'NOTIFICACION') return 'DERECHO DE PETICIÓN — REVISIÓN DE NOTIFICACIÓN Y DEBIDO PROCESO';
  if (slug === 'fotomultas') return 'DERECHO DE PETICIÓN — SOLICITUD RELACIONADA CON FOTODETECCIÓN / FOTOMULTA';
  if (slug === 'revocatoria-comparendo') return 'SOLICITUD DE REVOCATORIA / CORRECCIÓN DE ACTUACIÓN DE TRÁNSITO';
  if (slug === 'solicitud-soportes-comparendo') return 'DERECHO DE PETICIÓN — SOLICITUD DE INFORMACIÓN Y SOPORTES DE TRÁNSITO';
  return 'DERECHO DE PETICIÓN — SOLICITUD DE REVISIÓN Y ELIMINACIÓN DE MULTA';
}

export function buildTrafficDocument(slug: string, a: FormAnswers) {
  const assessment = getAssessment(a);
  const title = buildTitle(slug, assessment);
  const rules = getApplicableTrafficRules(a);
  const decisions = evaluateTrafficCase(a);
  const ruleLabels = rules.filter((r) => r.id !== 'soportes').map((r) => r.label).join(', ');
  const primary = routeLabel(assessment?.primaryRoute);

  const legalAnalysis = assessment
    ? [
        `Ruta jurídica priorizada: ${primary}.`,
        ...assessment.reasoning.map(cleanSentence),
        assessment.missingEvidence.length
          ? `Información o evidencia pendiente de verificación: ${assessment.missingEvidence.join('; ')}.`
          : 'No se identificaron elementos probatorios adicionales indispensables con la información disponible.',
      ].join('\n')
    : decisions.length
      ? decisions.map((d) => `• ${d.label}: ${d.reason} Siguiente actuación: ${d.nextStep} Fundamento orientador: ${d.legalBasis.join('; ')}.`).join('\n')
      : `Se requiere revisión de ${ruleLabels || 'la actuación administrativa'} con base en el expediente y los soportes oficiales.`;

  const placa = v(a, 'placa');
  const hechos = v(a, 'hechos', 'No se han incorporado hechos adicionales distintos de los datos identificados en el Estado de Cuenta SIMIT.');
  const routeRequests = buildRouteRequests(a, assessment);
  const customPetition = v(a, 'solicitudConcreta') || v(a, 'pretension');

  const header = [
    v(a, 'ciudad', 'Ciudad'),
    v(a, 'fecha', new Date().toLocaleDateString('es-CO')),
    '',
    v(a, 'entidad', v(a, 'autoridad', 'SEÑOR(A) AUTORIDAD DE TRÁNSITO')),
    '',
    title,
    '',
    `Solicitante: ${v(a, 'nombres')} ${v(a, 'apellidos')}`,
    `Documento: ${v(a, 'documento')}`,
    `Correo: ${v(a, 'correo')}`,
    `Comparendo / acto: ${v(a, 'numero_comparendo')}`,
    `Fecha: ${v(a, 'fecha_comparendo')}`,
  ];
  if (placa) header.push(`Placa: ${placa}`);

  const objeto = `Solicito la revisión integral de la actuación administrativa asociada al comparendo No. ${v(a, 'numero_comparendo', 'no identificado')} de fecha ${v(a, 'fecha_comparendo', 'no identificada')}, con especial atención a ${primary}, conforme a las circunstancias y evidencia que obren en el expediente.`;

  const petitionSection = routeRequests.length
    ? routeRequests.map((item, index) => `${index + 1}. ${item}`).join('\n')
    : customPetition || 'Solicito la revisión integral de la actuación y la adopción de la decisión jurídicamente procedente.';

  return [
    ...header,
    '',
    'I. OBJETO',
    objeto,
    '',
    'II. HECHOS',
    hechos,
    '',
    'III. ANÁLISIS JURÍDICO PRELIMINAR',
    legalAnalysis,
    '',
    'IV. PETICIONES',
    petitionSection,
    '',
    'V. INFORMACIÓN Y SOPORTES',
    'Solicito copia íntegra de los soportes que sustentan la actuación, incluyendo los documentos y constancias pertinentes para verificar la ruta jurídica identificada por TrámiteYa.',
    '',
    'VI. ANEXOS',
    v(a, 'anexos', 'Estado de Cuenta SIMIT aportado por el solicitante.'),
    '',
    'Atentamente',
    '',
    `${v(a, 'nombres')} ${v(a, 'apellidos')}`,
    `C.C. ${v(a, 'documento')}`,
  ].join('\n');
}
