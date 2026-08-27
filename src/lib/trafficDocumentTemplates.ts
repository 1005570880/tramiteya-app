import type { FormAnswers } from '../types/form';
import {
  generateUnifiedLegalDocument,
  sanitizeValue,
  type LegalAssessment,
  type SelectedRecordData,
} from './legalEngine';

const UNKNOWN = 'No identificado en el documento aportado';

function rawValue(a: FormAnswers, key: string): string {
  const raw = a[key];
  if (Array.isArray(raw)) return raw.join(', ');
  if (typeof raw === 'boolean') return raw ? 'Sí' : 'No';
  if (raw == null) return '';
  return String(raw).replace(/\s+/g, ' ').trim();
}

function valueOrEmpty(value: unknown): string {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!text || /^no identificado en el documento aportado$/i.test(text)) return '';
  return sanitizeValue(text) === UNKNOWN ? '' : sanitizeValue(text);
}

function selectedRecord(a: FormAnswers): SelectedRecordData {
  const source = (a as FormAnswers & { __simitRecord?: any }).__simitRecord || {};
  const pick = (formKey: string, sourceValue?: unknown) =>
    valueOrEmpty(rawValue(a, formKey)) || valueOrEmpty(sourceValue);

  return {
    comparendo: pick('numero_comparendo', source.number),
    fecha: rawValue(a, 'fecha_comparendo') || String(source.date || ''),
    organismo: pick('entidad', source.authority || rawValue(a, 'autoridad')),
    estado: rawValue(a, 'estado') || String(source.status || rawValue(a, 'estadoComparendo') || ''),
    valor: rawValue(a, 'valor') || (source.value != null ? `$${Number(source.value).toLocaleString('es-CO')}` : rawValue(a, 'valorMulta')),
    placa: pick('placa', source.plate),
    cedula: pick('documento', source.documentNumber || rawValue(a, 'cedula')),
    codigo: pick('codigo_infraccion', source.infractionCode || source.code),
    nombre: pick('nombre', source.name),
    correo: pick('correo', source.email),
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
    case 'CADUCIDAD': return 'SOLICITUD DE REVISIÓN DE CADUCIDAD DE LA ACTUACIÓN DE TRÁNSITO';
    case 'PRESCRIPCION': return 'SOLICITUD DE PRESCRIPCIÓN DE SANCIÓN Y/O ACCIÓN DE COBRO';
    case 'PERDIDA_EJECUTORIEDAD': return 'SOLICITUD DE DECLARATORIA DE PÉRDIDA DE FUERZA EJECUTORIA';
    case 'NOTIFICACION': return 'REVISIÓN DE NOTIFICACIÓN Y DEBIDO PROCESO';
    case 'FOTODETECCION': return 'REVISIÓN DE ACTUACIÓN DE FOTODETECCIÓN';
    case 'DEBIDO_PROCESO': return 'REVISIÓN DE LAS GARANTÍAS DEL DEBIDO PROCESO ADMINISTRATIVO';
    case 'REVOCATORIA_DIRECTA': return 'REVISIÓN DE LA PROCEDENCIA DE LA REVOCATORIA DIRECTA';
    default: return 'REVISIÓN INTEGRAL DE LA ACTUACIÓN ADMINISTRATIVA';
  }
}

function cleanUserFacts(text: string): string {
  const cleaned = text.trim();
  if (!cleaned || /^no identificado en el documento aportado$/i.test(cleaned)) return '';
  const generatedMarkers = ['estado de cuenta simit', 'vencimiento calculado', 'mandamiento de pago', 'hechos acreditados'];
  const hits = generatedMarkers.filter(marker => cleaned.toLowerCase().includes(marker)).length;
  return hits >= 2 ? '' : cleaned;
}

/**
 * Convierte el borrador jurídico del motor en un escrito que realmente parece
 * presentado por la persona interesada: primera persona, una sola narración
 * de hechos, una sola línea argumentativa y peticiones sin duplicaciones.
 */
function humanize(text: string): string {
  return text
    .replace(/El Estado de Cuenta SIMIT aportado por el solicitante/gi, 'El Estado de Cuenta SIMIT que aporté')
    .replace(/el Estado de Cuenta aportado por el solicitante/gi, 'el Estado de Cuenta que aporté')
    .replace(/Estado de Cuenta aportado por el solicitante/gi, 'Estado de Cuenta que aporté')
    .replace(/El registro aportado identifica/gi, 'El registro que aporté identifica')
    .replace(/La actuación aparece asociada al documento de identidad/gi, 'La actuación aparece asociada a mi documento de identidad')
    .replace(/La información disponible sobre la placa es/gi, 'La información que pude verificar sobre la placa es')
    .replace(/El valor reportado para la obligación es/gi, 'El valor que aparece registrado para la obligación es')
    .replace(/No se encuentra acreditada en la información aportada/gi, 'En la información que aporté no encuentro acreditada')
    .replace(/Tampoco se encuentra acreditada una fecha/gi, 'Tampoco encuentro acreditada una fecha')
    .replace(/por el solicitante/gi, 'por mí')
    .replace(/del solicitante/gi, 'mío')
    .replace(/al solicitante/gi, 'a mí');
}

function removeDuplicateSections(document: string): string {
  const matches = [...document.matchAll(/^((?:I|II|III|IV|V|VI|VII|VIII|IX)\.)\s+[^\n]+$/gm)];
  if (!matches.length) return document.trim();

  const blocks: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < matches.length; i++) {
    const heading = matches[i][1];
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? document.length) : document.length;
    if (seen.has(heading)) continue;
    seen.add(heading);
    blocks.push(document.slice(start, end));
  }
  const prefix = document.slice(0, matches[0].index ?? 0).trim();
  return [prefix, ...blocks].filter(Boolean).join('\n\n').trim();
}

function removeMechanicalSentences(text: string): string {
  return text
    .replace(/La jurisprudencia pertinente se utiliza para resolver las cuestiones identificadas en este expediente y no como una lista bibliográfica aislada\.\s*/gi, '')
    .replace(/El motor no debe declarar prescripción sin esa cronología\.\s*/gi, '')
    .replace(/Esta solicitud se fundamenta en la información que obra en el Estado de Cuenta que aporté y en las circunstancias que conozco directamente\.\s*/gi, '')
    .replace(/Cuando un aspecto no puede establecerse con ese documento, solicito que sea verificado en el expediente administrativo y que la respuesta indique claramente el soporte documental correspondiente\.\s*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function numberedParagraphs(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let counter = 0;
  for (const line of lines) {
    const clean = line.trim();
    if (!clean) { result.push(''); continue; }
    if (/^\d+\.\s+/.test(clean)) {
      counter += 1;
      result.push(`${counter}. ${clean.replace(/^\d+\.\s+/, '')}`);
    } else {
      result.push(clean);
    }
  }
  return result.join('\n');
}

export function buildTrafficDocument(slug: string, a: FormAnswers) {
  const record = selectedRecord(a);
  const draft = generateUnifiedLegalDocument(record);
  const assessment = assessmentFromAnswers(a) || draft.assessment;

  let body = humanize(draft.document);
  body = removeDuplicateSections(body);
  body = removeMechanicalSentences(body);

  const userFacts = cleanUserFacts(rawValue(a, 'hechos'));
  if (userFacts) {
    const marker = 'III. PROBLEMA JURÍDICO';
    const position = body.indexOf(marker);
    if (position >= 0) body = `${body.slice(0, position)}\n\n${userFacts}\n\n${body.slice(position)}`;
  }

  const authority = valueOrEmpty(rawValue(a, 'entidad')) || valueOrEmpty(record.organismo) || 'AUTORIDAD DE TRÁNSITO COMPETENTE';
  const applicant = valueOrEmpty(`${rawValue(a, 'nombres')} ${rawValue(a, 'apellidos')}`.trim()) || valueOrEmpty(rawValue(a, 'nombre')) || valueOrEmpty(record.nombre) || 'la persona interesada';
  const cedula = valueOrEmpty(rawValue(a, 'documento')) || valueOrEmpty(record.cedula);
  const email = valueOrEmpty(rawValue(a, 'correo')) || valueOrEmpty(record.correo);
  const plate = valueOrEmpty(rawValue(a, 'placa')) || valueOrEmpty(record.placa);
  const number = valueOrEmpty(rawValue(a, 'numero_comparendo')) || valueOrEmpty(record.comparendo);
  const date = rawValue(a, 'fecha_comparendo') || record.fecha || '';
  const city = rawValue(a, 'ciudad') || 'Sincelejo';
  const dateDocument = rawValue(a, 'fecha') || new Date().toLocaleDateString('es-CO');
  const title = assessment.primaryRoute
    ? `DERECHO DE PETICIÓN — ${routeLabel(assessment.primaryRoute)}`
    : 'DERECHO DE PETICIÓN — REVISIÓN INTEGRAL DE LA ACTUACIÓN ADMINISTRATIVA';

  const identity = [
    `Yo, ${applicant}`,
    cedula ? `identificado(a) con cédula de ciudadanía No. ${cedula}` : '',
    'actuando en nombre propio, presento respetuosamente este derecho de petición.'
  ].filter(Boolean).join(' ');

  const metadata = [
    email ? `Correo electrónico: ${email}` : '',
    plate ? `Placa: ${plate}` : '',
  ].filter(Boolean);

  const reference = `REFERENCIA: Comparendo / acto No. ${number || 'que se identifica en el Estado de Cuenta'}${date ? ` — Fecha: ${date}` : ''}`;

  const notification = email
    ? `Agradezco que la respuesta sea remitida al correo electrónico ${email}.`
    : 'Agradezco que la respuesta sea remitida por el medio legalmente procedente.';

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
    reference,
    '',
    identity,
    ...metadata,
    '',
    'Respetados señores:',
    '',
    `En ejercicio del derecho fundamental de petición, solicito que se revise la situación jurídica de la actuación ${number ? `No. ${number}` : 'registrada a mi nombre'}, con fundamento en la información que aporté y en los documentos que reposan en el expediente administrativo.`,
    '',
    body,
    '',
    'ANEXOS',
    'Estado de Cuenta SIMIT aportado.',
    '',
    'NOTIFICACIONES',
    notification,
    '',
    'Atentamente,',
    '',
    applicant,
    cedula ? `C.C. ${cedula}` : '',
  ].filter((line, index, arr) => !(line === '' && arr[index - 1] === '')).join('\n').trim();
}
