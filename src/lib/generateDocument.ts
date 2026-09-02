import type { Procedure } from '../types';
import type { FormAnswers } from '../types/form';
import type { DocumentItem } from '../types/procedure';
import { buildDocumentText } from './documentTemplates';

const TRAFFIC_SLUGS = new Set([
  'prescripcion-comparendo',
  'caducidad-comparendo',
  'revocatoria-comparendo',
  'solicitud-soportes-comparendo',
  'fotomultas',
  'derecho-de-peticion-eliminar-multa',
]);

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const ORDINALS = [
  'PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO', 'SEXTO',
  'SÉPTIMO', 'OCTAVO', 'NOVENO', 'DÉCIMO', 'UNDÉCIMO', 'DUODÉCIMO',
];

type AnswerMap = FormAnswers & Record<string, unknown>;

type TrafficRecord = {
  comparendo: string;
  fecha: string;
  codigo: string;
  autoridad: string;
  valor: string;
  estado: string;
  fechaResolucion: string;
  fechaNotificacion: string;
  fechaMandamiento: string;
  fechaNotificacionMandamiento: string;
  fechaEjecutoria: string;
};

function answersMap(answers: FormAnswers): AnswerMap {
  return answers as AnswerMap;
}

function firstValue(answers: FormAnswers, ...keys: string[]): string {
  const source = answersMap(answers);
  for (const key of keys) {
    const value = source[key];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      const joined = value.map(String).join(', ').trim();
      if (joined) return joined;
      continue;
    }
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function nestedValue(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function displayValue(value: string): string {
  return value.trim() || 'NO REPORTADO EN LA INFORMACIÓN APORTADA';
}

function normalizeMunicipality(answers: FormAnswers): string {
  const source = answersMap(answers);
  const simit = objectValue(source.__simitRecord);
  return displayValue(firstValue(answers, 'ciudad', 'municipio') || nestedValue(simit, 'municipality', 'municipio', 'city'));
}

function resolveAuthorityHeader(municipality: string, authority?: string): string {
  const city = municipality.trim();
  const explicit = authority?.trim() || '';
  if (/SANTA\s*MARTA/i.test(city) || /SANTA\s*MARTA/i.test(explicit)) {
    return 'SECRETARÍA DE TRÁNSITO Y MOVILIDAD DEL DISTRITO DE SANTA MARTA';
  }
  if (/SECRETAR[IÍ]A|INSPECCI[ÓO]N|ORGANISMO DE TR[AÁ]NSITO|TR[AÁ]NSITO Y MOVILIDAD|TR[AÁ]NSITO Y TRANSPORTE/i.test(explicit)) {
    return explicit.toUpperCase();
  }
  if (city && city !== 'NO REPORTADO EN LA INFORMACIÓN APORTADA') {
    return `SECRETARÍA DE TRÁNSITO Y TRANSPORTE MUNICIPAL DE ${city.toUpperCase()}`;
  }
  return 'AUTORIDAD DE TRÁNSITO COMPETENTE';
}

function buildFilingDate(answers: FormAnswers): string {
  const city = normalizeMunicipality(answers);
  const department = firstValue(answers, 'departamento', 'department');
  const now = new Date();
  const date = `${now.getDate()} de ${MONTHS_ES[now.getMonth()]} de ${now.getFullYear()}`;
  return department ? `${city}, ${department.toUpperCase()}, ${date}` : `${city.toUpperCase()}, ${date}`;
}

function formatCop(raw: string): string {
  if (!raw.trim()) return 'NO REPORTADO';
  const numeric = raw.replace(/[^0-9]/g, '');
  if (!numeric) return raw.trim();
  return Number(numeric).toLocaleString('es-CO');
}

function getTrafficRecord(answers: FormAnswers): TrafficRecord {
  const source = answersMap(answers);
  const simit = objectValue(source.__simitRecord);
  const municipality = normalizeMunicipality(answers);
  const authority = firstValue(answers, 'entidad', 'autoridad', 'autoridad_transito')
    || nestedValue(simit, 'authority', 'organismoTransito', 'organismo', 'entidad');

  return {
    comparendo: displayValue(firstValue(answers, 'numero_comparendo', 'numeroComparendo', 'numero_acto') || nestedValue(simit, 'number', 'comparendo', 'numero')),
    fecha: displayValue(firstValue(answers, 'fecha_comparendo', 'fechaComparendo', 'fecha_infraccion') || nestedValue(simit, 'date', 'fecha', 'fechaInfraccion')),
    codigo: displayValue(firstValue(answers, 'codigo_infraccion', 'codigoInfraccion', 'codigo') || nestedValue(simit, 'infractionCode', 'code', 'codigoInfraccion')),
    autoridad: resolveAuthorityHeader(municipality, authority),
    valor: formatCop(firstValue(answers, 'valor_reportado', 'valorReportado', 'valor_multa', 'valor', 'monto') || nestedValue(simit, 'value', 'valor', 'amount')),
    estado: displayValue(firstValue(answers, 'estado_simit', 'estadoSimit', 'estadoComparendo', 'estado') || nestedValue(simit, 'status', 'estado')),
    fechaResolucion: displayValue(firstValue(answers, 'fechaResolucion', 'fecha_resolucion') || nestedValue(simit, 'resolutionDate', 'fechaResolucion')),
    fechaNotificacion: displayValue(firstValue(answers, 'fechaNotificacion', 'fecha_notificacion') || nestedValue(simit, 'notificationDate', 'fechaNotificacion')),
    fechaMandamiento: displayValue(firstValue(answers, 'fechaMandamientoPago', 'fecha_mandamiento_pago') || nestedValue(simit, 'mandamientoDate', 'paymentOrderDate', 'fechaMandamientoPago')),
    fechaNotificacionMandamiento: displayValue(firstValue(answers, 'fechaNotificacionMandamiento', 'fecha_notificacion_mandamiento') || nestedValue(simit, 'paymentOrderNotificationDate', 'fechaNotificacionMandamiento')),
    fechaEjecutoria: displayValue(firstValue(answers, 'fechaEjecutoria', 'fecha_ejecutoria') || nestedValue(simit, 'executedDate', 'fechaEjecutoria')),
  };
}

function parseDate(value: string): Date | null {
  if (!value || value.startsWith('NO REPORTADO')) return null;
  const match = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) return null;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function calculateAgeYears(fecha: string): string {
  const date = parseDate(fecha);
  if (!date) return 'NO DETERMINABLE CON LA INFORMACIÓN APORTADA';
  const now = new Date();
  const millisecondsPerYear = 365.2425 * 24 * 60 * 60 * 1000;
  return Math.max(0, (now.getTime() - date.getTime()) / millisecondsPerYear).toFixed(1);
}

function buildIndividualization(record: TrafficRecord): string {
  return [
    `Comparendo / Actuación No.: ${record.comparendo}`,
    `Fecha de la Infracción: ${record.fecha}`,
    `Código de Infracción: ${record.codigo}`,
    `Autoridad / Municipio: ${record.autoridad}`,
    `Valor Reportado: $${record.valor}${record.valor === 'NO REPORTADO' ? '' : ' COP'}`,
    `Estado en SIMIT: ${record.estado}`,
  ].join('\n');
}

function buildFacts(answers: FormAnswers, record: TrafficRecord): string {
  const cedula = displayValue(firstValue(answers, 'cedula', 'documento', 'documentNumber'));
  const facts = [
    `Me identifico con cédula de ciudadanía No. ${cedula} y actúo en nombre propio.`,
    `En el Estado de Cuenta SIMIT figura registrada la obligación No. ${record.comparendo}.`,
    `Manifiesto que desconozco que se haya surtido una notificación personal, por aviso o por los medios legalmente establecidos conforme al artículo 135 del Código Nacional de Tránsito, razón por la cual solicito que la entidad aporte prueba documental de la misma.`,
    `No tuve conocimiento oportuno ni fui citado a audiencia pública de descargos, por lo que solicito que la autoridad acredite documentalmente la forma en que fui vinculado al procedimiento y las oportunidades efectivas de defensa que me fueron otorgadas.`,
    `Desde la información actualmente disponible no se acredita de manera suficiente la cronología completa de la actuación, por lo que solicito que la autoridad demuestre documentalmente las fechas de la actuación sancionatoria, su notificación, ejecutoria y, si existe, el mandamiento de pago y su respectiva notificación.`,
  ];
  return facts.map((fact, index) => `${ORDINALS[index]}: ${fact}`).join('\n\n');
}

function buildLegalFoundations(): string {
  return [
    `5.1. DERECHO FUNDAMENTAL DE PETICIÓN\nEl artículo 23 de la Constitución Política y la Ley 1755 de 2015 reconocen el derecho a presentar peticiones respetuosas y exigen una respuesta oportuna, clara, precisa, congruente y de fondo. La respuesta deberá pronunciarse sobre cada solicitud formulada y no limitarse a reproducir el estado de cuenta del sistema de información.`,
    `5.2. DEBIDO PROCESO Y DERECHO DE DEFENSA\nEl artículo 29 de la Constitución Política garantiza el debido proceso en las actuaciones administrativas. En materia sancionatoria de tránsito, la autoridad debe acreditar la vinculación formal del ciudadano, las oportunidades de contradicción y defensa y la existencia de las actuaciones que soportan la exigibilidad de la obligación.`,
    `5.3. RÉGIMEN CONTRAVENCIONAL DE TRÁNSITO Y NOTIFICACIÓN\nEl artículo 135 de la Ley 769 de 2002 regula aspectos esenciales del procedimiento contravencional. La jurisprudencia constitucional, entre ella las Sentencias C-038 de 2020, C-530 de 2016 y T-051 de 2016, impone especial rigor frente al debido proceso, la individualización de la responsabilidad y la acreditación de las actuaciones de notificación. Por ello, cuando la autoridad afirme haber notificado una actuación mediante servicio postal, deberá aportar las constancias documentales que permitan verificar el medio utilizado, la guía, el destinatario, la fecha y el resultado de la entrega o la actuación sustitutiva legalmente procedente.`,
    `5.4. PRESCRIPCIÓN Y PÉRDIDA DE FUERZA EJECUTORIA\nLos artículos 159 y 161 de la Ley 769 de 2002 y el artículo 91 de la Ley 1437 de 2011 (CPACA) deben ser analizados según la cronología efectivamente acreditada en cada expediente. La antigüedad de un registro no se equipara por sí sola a la prescripción: corresponde reconstruir los actos administrativos, sus notificaciones, la ejecutoria, las actuaciones de cobro y los demás hechos jurídicamente relevantes para determinar si la obligación conserva exigibilidad.`,
  ].join('\n\n');
}

function buildIndividualAnalysis(record: TrafficRecord): string {
  const age = calculateAgeYears(record.fecha);
  return `De acuerdo con la información registrada (${record.fecha}), la obligación cuenta con una antigüedad aproximada de ${age} años. Corresponde a la autoridad acreditar fehacientemente la cronología de los actos administrativos jurídicamente relevantes, incluyendo la notificación formal, la resolución sancionatoria, su ejecutoria y, cuando exista, el mandamiento de pago y su notificación. De no acreditarse documentalmente la notificación válida y las demás actuaciones exigibles dentro de los términos del régimen aplicable, solicito que se determine la consecuencia jurídica correspondiente sobre la validez, firmeza, ejecutoriedad y exigibilidad de la obligación. La sola permanencia del registro en SIMIT no sustituye la acreditación del expediente administrativo ni de los actos que soportan el cobro.`;
}

function buildRequests(record: TrafficRecord): string {
  const requests = [
    `Que se realice una revisión integral y depuración de la obligación No. ${record.comparendo} y, previa verificación del expediente, se disponga su archivo y/o eliminación del registro cuando se determine la inexistencia de fundamento jurídico exigible.`,
    `Que se informe y acredite documentalmente la forma, fecha, dirección o medio utilizado, empresa de mensajería, número de guía y resultado de entrega mediante los cuales se afirma que fui notificado de cada actuación relacionada con la obligación.`,
    `Que se remita copia íntegra, legible y completa del expediente administrativo correspondiente a la obligación No. ${record.comparendo}, incluyendo comparendo, pruebas, citaciones, actos administrativos, constancias de notificación, constancia de ejecutoria y actuaciones posteriores.`,
    `Que se determine expresamente si la obligación se encuentra prescrita conforme a los artículos 159 y 161 de la Ley 769 de 2002 y, cuando resulte jurídicamente aplicable, el artículo 91 de la Ley 1437 de 2011, indicando las razones de hecho y de derecho de la decisión y procediendo a la actualización del registro en SIMIT si corresponde.`,
    `Que se informe si existe o existió proceso de cobro coactivo respecto de la obligación, indicando número de expediente, fecha de inicio, mandamiento de pago, fecha y forma de su notificación y las actuaciones posteriores que puedan incidir en la exigibilidad de la obligación.`,
    `Que, en caso de no existir soporte probatorio de alguna actuación que la entidad invoque como fundamento de la obligación, se indique expresamente tal circunstancia y se adopte la consecuencia jurídica que corresponda, incluida la exoneración, archivo, terminación o depuración cuando legalmente proceda.`,
    `Que, una vez determinada la inexistencia, prescripción, archivo, terminación o pérdida de exigibilidad de la obligación, se ordene la actualización de las bases de datos de la Secretaría u organismo de tránsito y se realicen las gestiones correspondientes para que el registro en SIMIT refleje la situación jurídica real.`,
  ];
  return requests.map((request, index) => `${ORDINALS[index]}: ${request}`).join('\n\n');
}

function buildEvidenceRequests(): string {
  return [
    'Orden de comparendo y documento que soporte la imposición de la actuación.',
    'Pruebas que fundamentaron la infracción, incluidas fotografías, videos o registros técnicos cuando existan.',
    'Citaciones, comunicaciones y constancias de entrega o devolución.',
    'Guías de correo, empresa de mensajería, dirección utilizada, fecha de envío y resultado de entrega.',
    'Acta o constancia de audiencia y decisión adoptada, cuando corresponda.',
    'Resolución o acto administrativo sancionatorio y constancia de ejecutoria.',
    'Recursos interpuestos y decisiones que los resuelvan, si los hubiere.',
    'Mandamiento de pago, constancia de notificación y actuaciones posteriores de cobro coactivo.',
    'Medidas cautelares, acuerdos de pago, pagos y demás actuaciones que incidan en la exigibilidad de la obligación.',
  ].map((item, index) => `${ORDINALS[index]}: ${item}`).join('\n\n');
}

function buildAnnexes(answers: FormAnswers, record: TrafficRecord): string {
  const annexes = [
    'Copia del documento de identidad.',
    `Estado de Cuenta del SIMIT correspondiente a la obligación No. ${record.comparendo}.`,
    firstValue(answers, 'anexos', 'soportes') || 'Demás soportes aportados para la reconstrucción del expediente administrativo.',
  ];
  return annexes.map((item, index) => `${ORDINALS[index]}: ${item}`).join('\n\n');
}

function buildProfessionalTrafficPetition(answers: FormAnswers): string {
  const record = getTrafficRecord(answers);
  const nombre = displayValue(firstValue(answers, 'nombreCompleto', 'nombre', 'nombres'));
  const cedula = displayValue(firstValue(answers, 'cedula', 'documento', 'documentNumber'));
  const email = displayValue(firstValue(answers, 'email', 'correo'));
  const telefono = displayValue(firstValue(answers, 'telefono', 'phone'));
  const municipality = normalizeMunicipality(answers);
  const date = buildFilingDate(answers);
  const authority = record.autoridad;

  return [
    `${date}`,
    '',
    'SEÑORES',
    authority,
    'E. S. D.',
    '',
    'I. IDENTIFICACIÓN Y ASUNTO',
    '',
    'ASUNTO: DERECHO DE PETICIÓN — SOLICITUD DE REVISIÓN, DEPURACIÓN, ARCHIVO Y/O ELIMINACIÓN DE COMPARENDOS Y OBLIGACIONES DE TRÁNSITO POR FALTA DE NOTIFICACIÓN, PRESCRIPCIÓN, IRREGULARIDADES EN EL PROCEDIMIENTO Y/O INEXISTENCIA DE OBLIGACIÓN EXIGIBLE.',
    '',
    `PETICIONARIO: ${nombre.toUpperCase()} — C.C. No. ${cedula}`,
    '',
    'II. INDIVIDUALIZACIÓN INDIVIDUAL DE LA OBLIGACIÓN',
    '',
    buildIndividualization(record),
    '',
    'III. HECHOS Y ANTECEDENTES',
    '',
    buildFacts(answers, record),
    '',
    'IV. FUNDAMENTOS DE DERECHO',
    '',
    buildLegalFoundations(),
    '',
    'V. ANÁLISIS INDIVIDUAL DE LA OBLIGACIÓN',
    '',
    buildIndividualAnalysis(record),
    '',
    'VI. SOLICITUDES / PRETENSIONES',
    '',
    buildRequests(record),
    '',
    'VII. SOLICITUD DE INFORMACIÓN Y PRUEBAS DEL EXPEDIENTE',
    '',
    buildEvidenceRequests(),
    '',
    'VIII. ANEXOS',
    '',
    buildAnnexes(answers, record),
    '',
    'IX. RESERVA DE VERIFICACIÓN Y DECISIÓN DE FONDO',
    '',
    'La información reportada en el Estado de Cuenta SIMIT permite individualizar la obligación y conocer su estado registrado, pero no sustituye el expediente administrativo ni acredita por sí sola la notificación, ejecutoria, firmeza o exigibilidad de los actos que sustentan la obligación. En consecuencia, solicito que la respuesta se fundamente en los documentos efectivamente obrantes en el expediente y que se pronuncie de manera individual sobre cada una de las solicitudes formuladas.',
    '',
    'X. NOTIFICACIONES Y FIRMA',
    '',
    `Recibiré notificaciones en el correo electrónico: ${email} y teléfono: ${telefono}.`,
    '',
    'Atentamente,',
    '',
    '____________________________________',
    nombre.toUpperCase(),
    `C.C. No. ${cedula}`,
    `Correo electrónico: ${email}`,
    `Teléfono: ${telefono}`,
  ].join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeGeneratedText(content: string): string {
  return content
    .replace(/\r\n?/g, '\n')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function generateDocument({
  procedure,
  answers,
  previousVersion = 0,
  instanceId,
}: {
  procedure: Procedure;
  answers: FormAnswers;
  previousVersion?: number;
  instanceId?: string;
}): Promise<DocumentItem> {
  const version = Math.max(1, previousVersion + 1);
  const generatedAt = new Date().toISOString();
  const content = normalizeGeneratedText(
    TRAFFIC_SLUGS.has(procedure.slug)
      ? buildProfessionalTrafficPetition(answers)
      : buildDocumentText(procedure, answers),
  );

  if (!content || content.length < 200) {
    throw new Error('LEGAL_DOCUMENT_EMPTY: no fue posible construir un documento con contenido suficiente.');
  }

  return {
    id: `doc_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    title: `${procedure.title} - Documento generado`,
    procedureId: procedure.id,
    content,
    createdAt: generatedAt,
    generatedAt,
    version,
    status: 'ready',
    instanceId,
    sourceVersion: TRAFFIC_SLUGS.has(procedure.slug) ? 'legal-architecture-v10' : 'document-template-v1',
    snapshot: {
      answers: JSON.parse(JSON.stringify(answers)),
      procedureSlug: procedure.slug,
      generatedAt,
      content,
    },
  };
}
