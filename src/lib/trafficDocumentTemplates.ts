import type { FormAnswers } from '../types/form';
import { generateUnifiedLegalDocument, sanitizeValue, type LegalAssessment, type SelectedRecordData } from './legalEngine';

const fallback = 'No identificado en el documento aportado';

function rawValue(a: FormAnswers, key: string): string {
  const raw = a[key];
  if (Array.isArray(raw)) return raw.join(', ');
  if (typeof raw === 'boolean') return raw ? 'Sí' : 'No';
  if (raw == null) return '';
  return String(raw).replace(/\s+/g, ' ').trim();
}

function cleanOrFallback(value: unknown, fallbackValue = fallback): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return fallbackValue;
  return sanitizeValue(text);
}

function selectedRecord(a: FormAnswers): SelectedRecordData {
  const source = (a as FormAnswers & { __simitRecord?: any }).__simitRecord || {};
  const fromFormOrSource = (formKey: string, sourceValue: unknown) => {
    const form = rawValue(a, formKey);
    const cleanForm = form ? sanitizeValue(form) : fallback;
    if (cleanForm !== fallback) return cleanForm;
    return cleanOrFallback(sourceValue);
  };

  return {
    // El registro SIMIT conserva prioridad cuando el formulario contiene basura OCR.
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

function normalizeForCompare(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function looksLikeGeneratedFacts(text: string): boolean {
  const normalized = normalizeForCompare(text);
  const markers = ['estado de cuenta simit', 'fecha del hecho', 'mandamiento de pago', 'vencimiento calculado'];
  return markers.filter(marker => normalized.includes(marker)).length >= 2;
}

function cleanUserFacts(text: string): string {
  const cleaned = text.trim();
  if (!cleaned || /^no identificado en el documento aportado$/i.test(cleaned)) return '';
  // El formulario puede conservar la versión automática anterior. No la volvemos a insertar.
  if (looksLikeGeneratedFacts(cleaned)) return '';
  return cleaned;
}

function routeLabel(route: string | null | undefined) {
  switch (route) {
    case 'CADUCIDAD': return 'REVISIÓN DE CADUCIDAD DE LA ACTUACIÓN CONTRAVENCIONAL';
    case 'PRESCRIPCION': return 'SOLICITUD DE PRESCRIPCIÓN DE SANCIÓN Y/O ACCIÓN DE COBRO';
    case 'PERDIDA_EJECUTORIEDAD': return 'SOLICITUD DE DECLARATORIA DE PÉRDIDA DE FUERZA EJECUTORIA';
    case 'NOTIFICACION': return 'REVISIÓN DE NOTIFICACIÓN Y DEBIDO PROCESO';
    case 'FOTODETECCION': return 'REVISIÓN DE ACTUACIÓN DE FOTODETECCIÓN';
    case 'DEBIDO_PROCESO': return 'REVISIÓN DE LAS GARANTÍAS DEL DEBIDO PROCESO ADMINISTRATIVO';
    case 'REVOCATORIA_DIRECTA': return 'REVISIÓN DE LA PROCEDENCIA DE LA REVOCATORIA DIRECTA';
    default: return 'REVISIÓN INTEGRAL DE LA ACTUACIÓN ADMINISTRATIVA';
  }
}

function deduplicateTopLevelSections(document: string): string {
  const headingRegex = /^(I|II|III|IV|V|VI|VII|VIII|IX)\.\s+[^\n]+/gm;
  const matches = [...document.matchAll(headingRegex)];
  if (matches.length <= 9) return document.trim();

  const seen = new Set<string>();
  const chunks: string[] = [];
  let previous = 0;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const start = match.index ?? 0;
    const roman = match[1];
    const next = i + 1 < matches.length ? (matches[i + 1].index ?? document.length) : document.length;
    const chunk = document.slice(start, next);

    if (seen.has(roman)) continue;
    seen.add(roman);

    if (chunks.length === 0) chunks.push(document.slice(0, start));
    chunks.push(chunk);
    previous = next;
  }

  return chunks.join('').trim() || document.trim();
}

/**
 * Ensamblador administrativo. legalEngine es el único dueño de la argumentación
 * jurídica I–IX; aquí solo se arma el documento final en nombre propio.
 */
export function buildTrafficDocument(slug: string, a: FormAnswers) {
  const record = selectedRecord(a);
  const draft = generateUnifiedLegalDocument(record);
  const assessment = assessmentFromAnswers(a) || draft.assessment;

  let body = deduplicateTopLevelSections(draft.document);

  // Solo agregamos hechos escritos realmente por la persona. La versión automática
  // que pueda haber quedado guardada en 'hechos' se descarta para evitar duplicados.
  const userFacts = cleanUserFacts(rawValue(a, 'hechos'));
  if (userFacts) {
    const marker = 'III. PROBLEMA JURÍDICO';
    const position = body.indexOf(marker);
    if (position >= 0) body = `${body.slice(0, position)}${userFacts}\n\n${body.slice(position)}`;
  }

  const authority = sanitizeValue(rawValue(a, 'entidad') || record.organismo);
  const nameFromParts = `${rawValue(a, 'nombres')} ${rawValue(a, 'apellidos')}`.trim();
  const applicant = cleanOrFallback(nameFromParts || rawValue(a, 'nombre') || record.nombre);
  const cedula = cleanOrFallback(rawValue(a, 'documento') || record.cedula);
  const email = cleanOrFallback(rawValue(a, 'correo') || record.correo);
  const plate = cleanOrFallback(rawValue(a, 'placa') || record.placa);
  const number = cleanOrFallback(rawValue(a, 'numero_comparendo') || record.comparendo);
  const date = rawValue(a, 'fecha_comparendo') || record.fecha;
  const city = rawValue(a, 'ciudad') || 'Sincelejo';
  const dateDocument = rawValue(a, 'fecha') || new Date().toLocaleDateString('es-CO');
  const title = assessment.primaryRoute ? `DERECHO DE PETICIÓN — ${routeLabel(assessment.primaryRoute)}` : 'DERECHO DE PETICIÓN — REVISIÓN INTEGRAL DE LA ACTUACIÓN ADMINISTRATIVA';

  return [
    city,
    dateDocument,
    '',
    authority.toUpperCase(),
    'Dependencia competente',
    '',
    title,
    '',
    `ASUNTO: ${title}`,
    `REFERENCIA: Comparendo / acto No. ${number} — Fecha: ${date}`,
    '',
    `Yo, ${applicant}, identificado(a) con cédula de ciudadanía No. ${cedula}, actuando en nombre propio, presento respetuosamente este derecho de petición.`,
    `Correo electrónico: ${email}`,
    `Placa: ${plate}`,
    '',
    'Respetados señores:',
    '',
    `En ejercicio del derecho fundamental de petición, solicito que se revise integralmente la situación jurídica de la actuación No. ${number}. Esta solicitud se fundamenta en la información que obra en el Estado de Cuenta aportado y en las circunstancias que conozco directamente. Cuando un aspecto no puede establecerse con ese documento, solicito que sea verificado en el expediente administrativo y que la respuesta indique claramente el soporte documental correspondiente.`,
    '',
    body,
    '',
    'X. ANEXOS',
    'Estado de Cuenta SIMIT aportado.',
    '',
    'XI. NOTIFICACIONES',
    `Agradezco que la respuesta sea remitida al correo electrónico ${email}.`,
    '',
    'Atentamente,',
    '',
    applicant,
    `C.C. ${cedula}`,
  ].join('\n');
}
