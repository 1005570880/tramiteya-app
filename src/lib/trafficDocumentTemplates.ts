import type { FormAnswers } from '../types/form';
import { generateUnifiedLegalDocument, sanitizeValue, type LegalAssessment, type SelectedRecordData } from './legalEngine';

function rawValue(a: FormAnswers, key: string): string {
  const raw = (a as any)[key];
  if (Array.isArray(raw)) return raw.join(', ');
  if (typeof raw === 'boolean') return raw ? 'Sí' : 'No';
  if (raw == null) return '';
  return String(raw).replace(/\s+/g, ' ').trim();
}

function valueOrEmpty(value: unknown): string {
  if (value == null) return '';
  const text = String(value).trim();
  return text && !/^no identificado en el documento aportado$/i.test(text) ? text : '';
}

function selectedRecord(a: FormAnswers): SelectedRecordData {
  const source = ((a as any).__simitRecord && typeof (a as any).__simitRecord === 'object') ? (a as any).__simitRecord : {};
  const trami = ((a as any).__tramiQuestionnaire && typeof (a as any).__tramiQuestionnaire === 'object') ? (a as any).__tramiQuestionnaire : {};
  const stored = ((a as any).tramiAnswers && typeof (a as any).tramiAnswers === 'object') ? (a as any).tramiAnswers : {};
  const q = { ...stored, ...trami } as Record<string, any>;
  const pick = (key: string, ...fallbacks: unknown[]) => valueOrEmpty(rawValue(a, key)) || valueOrEmpty(q[key]) || fallbacks.map(valueOrEmpty).find(Boolean) || '';
  const nombre = pick('nombre', source.name, source.ownerName);
  const cedula = pick('documento', q.cedula, source.documentNumber, rawValue(a, 'cedula'));
  const correo = pick('correo', source.email);
  const telefono = pick('telefono', source.phone);
  const comparendo = pick('numero_comparendo', source.number);
  const fecha = pick('fecha_comparendo', source.date);
  const organismo = pick('entidad', source.authority, rawValue(a, 'autoridad'));
  const valor = pick('valor', source.value, rawValue(a, 'valor_multa'));
  const codigo = pick('codigo_infraccion', source.infractionCode, source.code);
  return {
    comparendo, fecha, organismo, estado: pick('estadoComparendo', source.status), valor,
    placa: pick('placa', source.plate), cedula, codigo, nombre, correo, telefono,
    fechaResolucion: pick('fechaResolucion', source.resolutionDate),
    fechaNotificacion: pick('fechaNotificacion', source.notificationDate),
    fechaMandamientoPago: pick('fechaMandamientoPago', source.mandamientoDate, source.paymentOrderDate),
    fechaNotificacionMandamiento: pick('fechaNotificacionMandamiento', source.paymentOrderNotificationDate),
    fechaEjecutoria: pick('fechaEjecutoria', source.executedDate),
    huboAudiencia: (a as any).huboAudiencia ?? (q.audiencia === 'asisti' || q.audiencia === 'no_asisti'),
    existeResolucion: (a as any).existeResolucion ?? q.resolucion === 'si',
    actuacionesCobro: pick('actuacionesCobro', q.cobro, source.collectionActions),
    esFotodetencion: Boolean((a as any).esFotodetencion),
    tramiAnswers: q,
    tramiConocimiento: q.conocimiento || '',
    tramiNotificacion: q.notificacion || '',
    tramiAudiencia: q.audiencia || '',
    tramiResolucion: q.resolucion || '',
    tramiCobro: q.cobro || '',
    tramiPagos: q.pagos || '',
    tramiEvidencia: q.evidencia || '',
  };
}

function assessmentFromAnswers(a: FormAnswers): LegalAssessment | null {
  const assessment = (a as any).__legalAssessment;
  return assessment && typeof assessment === 'object' ? assessment as LegalAssessment : null;
}

function routeLabel(route: string | null | undefined): string {
  switch (route) {
    case 'CADUCIDAD': return 'SOLICITUD DE REVISIÓN DE CADUCIDAD DE LA ACTUACIÓN DE TRÁNSITO';
    case 'PRESCRIPCION': return 'SOLICITUD DE PRESCRIPCIÓN DE SANCIÓN Y/O ACCIÓN DE COBRO';
    case 'PERDIDA_EJECUTORIEDAD': return 'REVISIÓN DE PÉRDIDA DE FUERZA EJECUTORIA';
    case 'FOTODETECCION': return 'REVISIÓN DE ACTUACIÓN DE FOTODETECCIÓN';
    case 'NOTIFICACION': return 'REVISIÓN DE NOTIFICACIÓN Y DEBIDO PROCESO';
    case 'REVOCATORIA_DIRECTA': return 'SOLICITUD DE REVOCATORIA DIRECTA';
    default: return 'REVISIÓN INTEGRAL DE LA ACTUACIÓN ADMINISTRATIVA';
  }
}

export function buildTrafficDocument(slug: string, a: FormAnswers): string {
  const record = selectedRecord(a);
  const draft = generateUnifiedLegalDocument(record);
  const assessment = assessmentFromAnswers(a) || draft.assessment;
  const route = assessment.primaryRoute || (slug.includes('caducidad') ? 'CADUCIDAD' : slug.includes('prescripcion') ? 'PRESCRIPCION' : null);
  const authority = valueOrEmpty(rawValue(a, 'entidad')) || record.organismo || 'AUTORIDAD DE TRÁNSITO COMPETENTE';
  const applicant = valueOrEmpty(rawValue(a, 'nombre')) || valueOrEmpty(`${rawValue(a, 'nombres')} ${rawValue(a, 'apellidos')}`) || record.nombre;
  const cedula = valueOrEmpty(rawValue(a, 'documento')) || record.cedula;
  const email = valueOrEmpty(rawValue(a, 'correo')) || record.correo;
  const phone = valueOrEmpty(rawValue(a, 'telefono')) || record.telefono;
  const number = valueOrEmpty(rawValue(a, 'numero_comparendo')) || record.comparendo;
  const date = valueOrEmpty(rawValue(a, 'fecha_comparendo')) || record.fecha;
  const dateDocument = valueOrEmpty(rawValue(a, 'fecha')) || new Date().toLocaleDateString('es-CO');

  // generateUnifiedLegalDocument is the authoritative legal builder. It now
  // receives the full conversational identity and questionnaire, including
  // phone, so the document guard cannot reject a valid Trami session.
  if (draft.document && draft.document.length > 500) return draft.document;

  return [
    dateDocument,
    '',
    authority.toUpperCase(),
    '',
    `DERECHO DE PETICIÓN — ${routeLabel(route)}`,
    '',
    `ASUNTO: DERECHO DE PETICIÓN — ${routeLabel(route)}`,
    `REFERENCIA: Comparendo / acto No. ${number}${date ? ` — Fecha: ${date}` : ''}`,
    '',
    `Yo, ${sanitizeValue(applicant)}, identificado con cédula de ciudadanía No. ${sanitizeValue(cedula)}, actuando en nombre propio, presento respetuosamente este derecho de petición.`,
    '',
    'Respetados señores:',
    '',
    `Solicito que se revise integralmente la situación jurídica de la actuación No. ${sanitizeValue(number)}, con base en el expediente administrativo y las pruebas que deben reposar en él.`,
    '',
    'I. IDENTIFICACIÓN Y CONTACTO',
    '',
    `Nombre: ${sanitizeValue(applicant)}`,
    `Cédula: ${sanitizeValue(cedula)}`,
    `Correo electrónico: ${sanitizeValue(email)}`,
    `Teléfono: ${sanitizeValue(phone)}`,
    '',
    'II. PETICIONES',
    '',
    'Que se entregue copia íntegra del expediente administrativo y de las constancias de notificación, sanción, ejecutoria y cobro que correspondan.',
    '',
    'Atentamente,',
    '',
    sanitizeValue(applicant),
    `C.C. No. ${sanitizeValue(cedula)}`,
    `Correo electrónico: ${sanitizeValue(email)}`,
    `Teléfono: ${sanitizeValue(phone)}`,
  ].join('\n').trim();
}
