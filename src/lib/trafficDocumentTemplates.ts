import type { FormAnswers } from '../types/form';
import { generateUnifiedLegalDocument, sanitizeValue, type LegalAssessment, type SelectedRecordData } from './legalEngine';

const fallback = 'No identificado en el documento aportado';

function value(a: FormAnswers, key: string, fallbackValue = ''): string {
  const raw = a[key];
  if (Array.isArray(raw)) return raw.join(', ');
  if (typeof raw === 'boolean') return raw ? 'Sí' : 'No';
  if (raw == null) return fallbackValue;
  const text = String(raw).trim();
  return text || fallbackValue;
}

function selectedRecord(a: FormAnswers): SelectedRecordData {
  const source = (a as FormAnswers & { __simitRecord?: any }).__simitRecord || {};
  return {
    comparendo: value(a, 'numero_comparendo', source.number || fallback),
    fecha: value(a, 'fecha_comparendo', source.date || fallback),
    organismo: value(a, 'entidad', source.authority || value(a, 'autoridad', fallback)),
    estado: value(a, 'estado', source.status || value(a, 'estadoComparendo', fallback)),
    valor: value(a, 'valor', source.value != null ? `$${Number(source.value).toLocaleString('es-CO')}` : value(a, 'valorMulta', fallback)),
    placa: value(a, 'placa', source.plate || fallback),
    cedula: value(a, 'documento', source.documentNumber || value(a, 'cedula', fallback)),
    codigo: value(a, 'codigo_infraccion', source.infractionCode || source.code || fallback),
    fechaResolucion: value(a, 'fecha_resolucion', source.resolutionDate || ''),
    fechaNotificacion: value(a, 'fecha_notificacion', source.notificationDate || ''),
    fechaMandamientoPago: value(a, 'fecha_mandamiento_pago', source.mandamientoDate || source.paymentOrderDate || ''),
    fechaNotificacionMandamiento: value(a, 'fecha_notificacion_mandamiento', source.paymentOrderNotificationDate || ''),
    fechaEjecutoria: value(a, 'fecha_ejecutoria', source.executedDate || ''),
    huboAudiencia: (a as any).hubo_audiencia,
    existeResolucion: (a as any).existe_resolucion,
    actuacionesCobro: value(a, 'actuaciones_cobro', source.collectionActions || ''),
  };
}

function assessmentFromAnswers(a: FormAnswers): LegalAssessment | null {
  const assessment = a.__legalAssessment;
  return assessment && typeof assessment === 'object' ? assessment as LegalAssessment : null;
}

function routeLabel(route: string | null | undefined) {
  switch (route) {
    case 'CADUCIDAD': return 'solicitud de revisión de la caducidad de la actuación contravencional';
    case 'PRESCRIPCION': return 'solicitud de prescripción de la sanción y/o acción de cobro';
    case 'PERDIDA_EJECUTORIEDAD': return 'solicitud de revisión de la fuerza ejecutoria del acto administrativo';
    case 'NOTIFICACION': return 'revisión de la regularidad de las notificaciones y del debido proceso';
    case 'FOTODETECCION': return 'revisión de la actuación de detección tecnológica y de la imputación personal';
    case 'DEBIDO_PROCESO': return 'revisión de las garantías del debido proceso administrativo';
    case 'REVOCATORIA_DIRECTA': return 'revisión de la procedencia de la revocatoria directa';
    default: return 'revisión integral de la actuación administrativa';
  }
}

function sectionBody(document: string, heading: string, nextHeading: string): string {
  const start = document.indexOf(heading);
  if (start < 0) return '';
  const from = start + heading.length;
  const end = document.indexOf(nextHeading, from);
  return document.slice(from, end < 0 ? document.length : end).trim();
}

function replaceSection(document: string, heading: string, nextHeading: string, body: string): string {
  const start = document.indexOf(heading);
  if (start < 0 || !body.trim()) return document;
  const from = start + heading.length;
  const end = document.indexOf(nextHeading, from);
  if (end < 0) return document.slice(0, from) + '\n\n' + body.trim() + '\n';
  return document.slice(0, from) + '\n\n' + body.trim() + '\n\n' + document.slice(end);
}

/** Single traffic-document assembler. The legal engine owns I–IX; this layer adds only the administrative header and optional user facts. */
export function buildTrafficDocument(slug: string, a: FormAnswers) {
  const record = selectedRecord(a);
  const draft = generateUnifiedLegalDocument(record);
  const assessment = assessmentFromAnswers(a) || draft.assessment;

  let body = draft.document;
  const userFacts = value(a, 'hechos', '').trim();
  if (userFacts && !/^no identificado|no se han incorporado hechos adicionales/i.test(userFacts)) {
    const automaticFacts = sectionBody(body, 'II. ANTECEDENTES Y HECHOS', 'III. PROBLEMA JURÍDICO');
    body = replaceSection(body, 'II. ANTECEDENTES Y HECHOS', 'III. PROBLEMA JURÍDICO', `${userFacts}\n\n${automaticFacts}`);
  }

  const authority = sanitizeValue(value(a, 'entidad', record.organismo));
  const name = `${value(a, 'nombres', '')} ${value(a, 'apellidos', '')}`.trim();
  const applicant = sanitizeValue(name || value(a, 'nombre', fallback));
  const cedula = sanitizeValue(value(a, 'documento', record.cedula));
  const email = sanitizeValue(value(a, 'correo', record.correo));
  const plate = sanitizeValue(value(a, 'placa', record.placa));
  const number = sanitizeValue(value(a, 'numero_comparendo', record.comparendo));
  const date = value(a, 'fecha_comparendo', record.fecha);
  const city = value(a, 'ciudad', 'Sincelejo');
  const dateDocument = value(a, 'fecha', new Date().toLocaleDateString('es-CO'));
  const title = (() => {
    switch (assessment.primaryRoute) {
      case 'PRESCRIPCION': return 'DERECHO DE PETICIÓN — SOLICITUD DE PRESCRIPCIÓN DE SANCIÓN Y/O ACCIÓN DE COBRO';
      case 'PERDIDA_EJECUTORIEDAD': return 'DERECHO DE PETICIÓN — SOLICITUD DE DECLARATORIA DE PÉRDIDA DE FUERZA EJECUTORIA';
      case 'NOTIFICACION': return 'DERECHO DE PETICIÓN — REVISIÓN DE NOTIFICACIÓN Y DEBIDO PROCESO';
      case 'FOTODETECCION': return 'DERECHO DE PETICIÓN — REVISIÓN DE ACTUACIÓN DE FOTODETECCIÓN';
      case 'CADUCIDAD': return 'DERECHO DE PETICIÓN — REVISIÓN DE CADUCIDAD DE ACTUACIÓN CONTRAVENCIONAL';
      default: return `DERECHO DE PETICIÓN — ${routeLabel(assessment.primaryRoute).toUpperCase()}`;
    }
  })();

  return [
    city, dateDocument, '', authority.toUpperCase(), 'Dependencia competente', '', title, '',
    `ASUNTO: ${title}`, `REFERENCIA: Comparendo / acto No. ${number} — Fecha: ${date}`, '',
    'SOLICITANTE', applicant, `C.C. ${cedula}`, `Correo electrónico: ${email}`, `Placa: ${plate}`, '',
    'Respetados señores:', '',
    `En ejercicio del derecho fundamental de petición, solicito que se revise integralmente la situación jurídica del comparendo o acto No. ${number}. La presente solicitud se construye sobre los datos verificables del Estado de Cuenta aportado y distingue expresamente entre hechos acreditados, cálculos jurídicos y actuaciones que deben ser demostradas mediante el expediente administrativo.`, '',
    body, '', 'X. ANEXOS', 'Estado de Cuenta SIMIT aportado por el solicitante.', '',
    'XI. NOTIFICACIONES', `Al correo electrónico ${email}.`, '', 'Atentamente', '', applicant, `C.C. ${cedula}`,
  ].join('\n');
}
