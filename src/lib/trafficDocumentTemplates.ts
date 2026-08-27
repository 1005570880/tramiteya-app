import type { FormAnswers } from '../types/form';
import { generateUnifiedLegalDocument, sanitizeValue, type LegalAssessment, type SelectedRecordData } from './legalEngine';

const fallback = 'No identificado en el documento aportado';

function rawValue(a: FormAnswers, key: string): string {
  const raw = a[key];
  if (Array.isArray(raw)) return raw.join(', ');
  if (typeof raw === 'boolean') return raw ? 'Sí' : 'No';
  if (raw == null) return '';
  return String(raw).trim();
}

function cleanOrFallback(value: unknown, fallbackValue = fallback): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return fallbackValue;
  const cleaned = sanitizeValue(text);
  return cleaned === fallback ? fallbackValue : cleaned;
}

function selectedRecord(a: FormAnswers): SelectedRecordData {
  const source = (a as FormAnswers & { __simitRecord?: any }).__simitRecord || {};
  const fromFormOrSource = (formKey: string, sourceValue: unknown, fallbackValue = fallback) => {
    const form = rawValue(a, formKey);
    const cleanForm = form ? sanitizeValue(form) : fallback;
    if (cleanForm !== fallback) return cleanForm;
    return cleanOrFallback(sourceValue, fallbackValue);
  };

  return {
    // El registro SIMIT es la fuente de verdad cuando el formulario contiene basura OCR.
    comparendo: fromFormOrSource('numero_comparendo', source.number),
    fecha: rawValue(a, 'fecha_comparendo') || String(source.date || fallback),
    organismo: fromFormOrSource('entidad', source.authority || rawValue(a, 'autoridad')),
    estado: rawValue(a, 'estado') || String(source.status || rawValue(a, 'estadoComparendo') || fallback),
    valor: rawValue(a, 'valor') || (source.value != null ? `$${Number(source.value).toLocaleString('es-CO')}` : (rawValue(a, 'valorMulta') || fallback)),
    placa: fromFormOrSource('placa', source.plate),
    cedula: fromFormOrSource('documento', source.documentNumber || rawValue(a, 'cedula')),
    codigo: fromFormOrSource('codigo_infraccion', source.infractionCode || source.code),
    nombre: fromFormOrSource('nombre', source.name),
    correo: fromFormOrSource('correo', source.email),
    fechaResolucion: rawValue(a, 'fecha_resolucion') || String(source.resolutionDate || ''),
    fechaNotificacion: rawValue(a, 'fecha_notificacion') || String(source.notificationDate || ''),
    fechaMandamientoPago: rawValue(a, 'fecha_mandamiento_pago') || String(source.mandamientoDate || source.paymentOrderDate || ''),
    fechaNotificacionMandamiento: rawValue(a, 'fecha_notificacion_mandamiento') || String(source.paymentOrderNotificationDate || ''),
    fechaEjecutoria: rawValue(a, 'fecha_ejecutoria') || String(source.executedDate || ''),
    huboAudiencia: (a as any).hubo_audiencia,
    existeResolucion: (a as any).existe_resolucion,
    actuacionesCobro: rawValue(a, 'actuaciones_cobro') || String(source.collectionActions || ''),
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

function normalizeForCompare(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Single traffic-document assembler.
 * legalEngine owns the complete legal body I–IX. This layer only adds the
 * administrative header/footer and, when genuinely different, user-authored facts.
 */
export function buildTrafficDocument(slug: string, a: FormAnswers) {
  const record = selectedRecord(a);
  const draft = generateUnifiedLegalDocument(record);
  const assessment = assessmentFromAnswers(a) || draft.assessment;

  let body = draft.document;
  const userFacts = rawValue(a, 'hechos');
  const automaticFacts = sectionBody(body, 'II. ANTECEDENTES Y HECHOS', 'III. PROBLEMA JURÍDICO');

  // Nunca anteponer el bloque automático ya generado por el motor. Solo se
  // incorpora contenido si el usuario realmente lo modificó/agregó.
  if (
    userFacts &&
    !/^no identificado|no se han incorporado hechos adicionales/i.test(userFacts) &&
    normalizeForCompare(userFacts) !== normalizeForCompare(automaticFacts)
  ) {
    body = body.replace(
      automaticFacts,
      `${automaticFacts}\n\nHechos adicionales aportados por el solicitante:\n${userFacts}`
    );
  }

  const authority = sanitizeValue(rawValue(a, 'entidad') || record.organismo);
  const nameFromParts = `${rawValue(a, 'nombres')} ${rawValue(a, 'apellidos')}`.trim();
  const applicant = cleanOrFallback(nameFromParts || rawValue(a, 'nombre'), fallback);
  const cedula = cleanOrFallback(rawValue(a, 'documento') || record.cedula, fallback);
  const email = cleanOrFallback(rawValue(a, 'correo') || record.correo, fallback);
  const plate = cleanOrFallback(rawValue(a, 'placa') || record.placa, fallback);
  const number = cleanOrFallback(rawValue(a, 'numero_comparendo') || record.comparendo, fallback);
  const date = rawValue(a, 'fecha_comparendo') || record.fecha;
  const city = rawValue(a, 'ciudad') || 'Sincelejo';
  const dateDocument = rawValue(a, 'fecha') || new Date().toLocaleDateString('es-CO');
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
