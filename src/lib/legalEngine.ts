import { ADDITIONAL_TRAFFIC_LEGAL_LIBRARY } from './legalLibraryAdditional';

export interface LegalDocumentData {
  nombreUsuario?: string;
  cedulaUsuario?: string;
  emailUsuario?: string;
  telefonoUsuario?: string;
  direccionUsuario?: string;
  numComparendo: string;
  fechaComparendo: string;
  organismoTransito: string;
  valorComparendo?: string | number;
  codigoInfraccion?: string;
  esFotodetencion?: boolean;
}

export interface SelectedRecordData {
  comparendo?: string;
  fecha?: string;
  organismo?: string;
  estado?: string;
  valor?: string;
  placa?: string;
  cedula?: string;
  codigo?: string;
  nombre?: string;
  correo?: string;
  fechaResolucion?: string;
  fechaNotificacion?: string;
  fechaMandamientoPago?: string;
  fechaNotificacionMandamiento?: string;
  fechaEjecutoria?: string;
  huboAudiencia?: boolean | string;
  existeResolucion?: boolean | string;
  actuacionesCobro?: string;
}

export type LegalRoute =
  | 'PRESCRIPCION'
  | 'CADUCIDAD'
  | 'PERDIDA_EJECUTORIEDAD'
  | 'NOTIFICACION'
  | 'FOTODETECCION'
  | 'DEBIDO_PROCESO'
  | 'REVOCATORIA_DIRECTA';

export interface LegalTemporalAssessment {
  initialDate: string;
  initialExpiryDate?: string;
  ageYears: number;
  mandamientoNotificationDate?: string;
  executiveSummary?: string;
}

export interface LegalAssessment {
  primaryRoute: LegalRoute | null;
  routes: LegalRoute[];
  temporal: LegalTemporalAssessment;
  photoDetection: boolean;
  evidenceQuestions: string[];
  executiveSummary: string;
}

export interface LegalDraft {
  document: string;
  assessment: LegalAssessment;
  authorities: typeof ADDITIONAL_TRAFFIC_LEGAL_LIBRARY;
  evidenceModel: { question: string; reason: string }[];
  hechos: string;
  solicitudConcreta: string;
  fundamentos: string;
}

export interface DynamicLegalQuestion {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'select' | 'radio' | 'email' | 'phone';
  required?: boolean;
  options?: { value: string; label: string }[];
}

export function sanitizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  const normalized = match ? `${match[3]}-${match[2]}-${match[1]}` : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('es-CO');
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date.getTime());
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function yearsBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / (365.2425 * 24 * 60 * 60 * 1000));
}

function isTruthy(value: unknown): boolean {
  return value === true || /^(si|sí|yes|true|1|tengo|tuve)$/i.test(String(value ?? '').trim());
}

function isPhotoRecord(record: SelectedRecordData): boolean {
  return Boolean(
    isTruthy((record as any).esFotodetencion) ||
      /fad|fotomulta|fotodeteccion/i.test(`${record.comparendo ?? ''} ${record.codigo ?? ''}`) ||
      String(record.codigo ?? '').toUpperCase() === 'C35'
  );
}

function selectAuthorities(record: SelectedRecordData, routes: LegalRoute[]) {
  const terms = new Set<string>(['derecho de petición', 'expediente', 'documentos']);
  if (routes.includes('NOTIFICACION')) terms.add('notificación');
  if (routes.includes('FOTODETECCION')) terms.add('fotodetección');
  if (routes.includes('PRESCRIPCION')) terms.add('prescripción');
  if (routes.includes('CADUCIDAD')) terms.add('caducidad');
  if (routes.includes('PERDIDA_EJECUTORIEDAD')) terms.add('ejecutoriedad');
  if (routes.includes('REVOCATORIA_DIRECTA')) terms.add('revocatoria directa');
  return ADDITIONAL_TRAFFIC_LEGAL_LIBRARY.filter((authority) =>
    authority.useWhen.some((term) => terms.has(term.toLowerCase()))
  );
}

export function assessLegalSituation(record: SelectedRecordData): LegalAssessment {
  const date = parseDate(record.fecha);
  const now = new Date();
  const ageYears = date ? yearsBetween(date, now) : 0;
  const photoDetection = isPhotoRecord(record);
  const routes: LegalRoute[] = ['NOTIFICACION'];

  if (photoDetection) routes.push('FOTODETECCION');

  const hasHearing = isTruthy(record.huboAudiencia);
  if (!hasHearing && ageYears < 3) routes.push('CADUCIDAD');
  if (ageYears >= 3) routes.push('PRESCRIPCION');
  if (Boolean(record.actuacionesCobro) || ageYears >= 5 || Boolean(record.fechaMandamientoPago)) {
    routes.push('PERDIDA_EJECUTORIEDAD');
  }

  if (routes.includes('PRESCRIPCION')) {
    routes.push('REVOCATORIA_DIRECTA');
  }

  const priority: LegalRoute[] = [
    'PRESCRIPCION',
    'PERDIDA_EJECUTORIEDAD',
    'CADUCIDAD',
    'FOTODETECCION',
    'NOTIFICACION',
    'REVOCATORIA_DIRECTA',
  ];
  const primaryRoute = priority.find((route) => routes.includes(route)) ?? 'DEBIDO_PROCESO';
  const initialExpiryDate = date ? formatDate(addYears(date, 3)) : undefined;
  const evidenceQuestions = [
    '¿Cuál es el acto administrativo sancionatorio y cuál es su fecha de ejecutoria?',
    '¿Qué constancia acredita la notificación del comparendo y del acto sancionatorio?',
    '¿Existe mandamiento de pago y cuál es la fecha exacta de su notificación?',
  ];
  if (photoDetection) evidenceQuestions.push('¿Qué evidencia acredita la individualización y responsabilidad personal del presunto infractor en la fotodetección?');
  if (ageYears >= 3) evidenceQuestions.push('¿Qué actuaciones con incidencia en el término de prescripción fueron realizadas y notificadas eficazmente?');

  const executiveSummary = date
    ? `La actuación tiene una antigüedad aproximada de ${ageYears.toFixed(2)} años. El vencimiento inicial calculado del término de tres años es ${initialExpiryDate}. Esta referencia temporal no sustituye la reconstrucción documental de la firmeza, notificación y cobro.`
    : 'No fue posible establecer la antigüedad con certeza a partir de la fecha disponible; la cronología debe ser acreditada documentalmente.';

  return {
    primaryRoute,
    routes: Array.from(new Set(routes)),
    temporal: {
      initialDate: record.fecha || '',
      initialExpiryDate,
      ageYears,
      mandamientoNotificationDate: record.fechaNotificacionMandamiento,
      executiveSummary,
    },
    photoDetection,
    evidenceQuestions,
    executiveSummary,
  };
}

function buildFacts(record: SelectedRecordData, assessment: LegalAssessment): string {
  const facts: string[] = [];
  if (record.comparendo || record.fecha || record.organismo) facts.push(`En el Estado de Cuenta SIMIT aportado figura la actuación${record.comparendo ? ` No. ${sanitizeValue(record.comparendo)}` : ''}${record.organismo ? `, asociada a ${sanitizeValue(record.organismo)}` : ''}${record.fecha ? `, con fecha del hecho ${sanitizeValue(record.fecha)}` : ''}.`);
  if (record.cedula) facts.push(`La actuación aparece asociada al documento de identidad No. ${sanitizeValue(record.cedula)}.`);
  if (record.valor) facts.push(`El valor reportado para la obligación es ${sanitizeValue(record.valor)}.`);
  if (record.codigo) facts.push(`El registro identifica la infracción con el código ${sanitizeValue(record.codigo)}.`);
  if (record.fechaResolucion) facts.push(`Se reporta resolución o acto sancionatorio de fecha ${sanitizeValue(record.fechaResolucion)}.`);
  if (record.fechaNotificacion) facts.push(`Se reporta una fecha de notificación (${sanitizeValue(record.fechaNotificacion)}); debe establecerse documentalmente qué actuación fue notificada.`);
  if (record.fechaMandamientoPago) facts.push(`Se reporta mandamiento de pago de fecha ${sanitizeValue(record.fechaMandamientoPago)}; su expedición no se tendrá como equivalente a su notificación.`);
  if (record.fechaNotificacionMandamiento) facts.push(`Se reporta como fecha de notificación del mandamiento de pago el ${sanitizeValue(record.fechaNotificacionMandamiento)}; debe verificarse su eficacia.`);
  if (!record.fechaNotificacion) facts.push('No se encuentra acreditada en la información aportada la fecha ni el medio de notificación del acto sancionatorio.');
  if (!record.fechaNotificacionMandamiento) facts.push('No se encuentra acreditada una fecha de notificación del mandamiento de pago. Esta ausencia no demuestra por sí sola que nunca ocurrió, pero identifica una prueba decisiva que debe aportar la autoridad.');
  if (assessment.temporal.initialExpiryDate) facts.push(`Desde la fecha del hecho (${assessment.temporal.initialDate}) puede efectuarse el cómputo inicial de tres años, cuyo vencimiento calculado corresponde al ${assessment.temporal.initialExpiryDate}.`);
  return facts.map((fact, index) => `${index + 1}. ${fact}`).join('\n\n');
}

function buildGrounds(assessment: LegalAssessment): string {
  const parts = [
    'El artículo 23 de la Constitución Política garantiza el derecho fundamental de petición y el derecho a obtener respuesta de fondo, clara, congruente y oportuna.',
    'El artículo 29 de la Constitución Política garantiza el debido proceso en las actuaciones administrativas y sancionatorias.',
    'La Ley 1755 de 2015 regula el ejercicio del derecho fundamental de petición y sus requisitos y términos.',
  ];
  if (assessment.routes.includes('PRESCRIPCION')) parts.push('El artículo 159 de la Ley 769 de 2002 regula la prescripción de las sanciones de tránsito. La cronología debe reconstruirse con las fechas de firmeza, actuaciones de cobro y notificaciones jurídicamente eficaces que consten en el expediente.');
  if (assessment.routes.includes('CADUCIDAD')) parts.push('El artículo 161 de la Ley 769 de 2002 regula la caducidad de la acción por contravenciones de tránsito; su configuración debe determinarse con las fechas procesales efectivamente acreditadas.');
  if (assessment.routes.includes('PERDIDA_EJECUTORIEDAD')) parts.push('El artículo 91 del CPACA debe confrontarse con la firmeza, ejecutoria y circunstancias posteriores del acto administrativo.');
  if (assessment.routes.includes('REVOCATORIA_DIRECTA')) parts.push('Los artículos 93 y siguientes del CPACA regulan la revocatoria directa y exigen verificar sus presupuestos propios, sin equipararla automáticamente a prescripción o nulidad.');
  if (assessment.routes.includes('FOTODETECCION')) parts.push('La Ley 1843 de 2017 y la jurisprudencia constitucional sobre fotodetección exigen revisar el procedimiento de comunicación, la individualización y la responsabilidad personal, sin presumir automáticamente una nulidad por la sola existencia de una fotodetección.');
  if (assessment.routes.includes('NOTIFICACION')) parts.push('La regularidad de las notificaciones debe acreditarse mediante los soportes que permitan establecer el acto comunicado, destinatario, medio, fecha y constancia de entrega, devolución o publicación, según corresponda.');
  return parts.join('\n\n');
}

function buildRequests(record: SelectedRecordData, assessment: LegalAssessment): string {
  const id = sanitizeValue(record.comparendo) || 'que figura registrado';
  const requests = [
    `Que se determine expresamente la situación jurídica actual de la actuación No. ${id}, indicando por qué continúa vigente, exigible o registrada, si así ocurre.`,
    `Que se entregue copia íntegra, legible y completa del expediente administrativo relacionado con la actuación No. ${id}.`,
    'Que se identifique el acto mediante el cual se impuso la sanción, indicando número, fecha, autoridad que lo expidió y constancia de ejecutoria, y se entregue copia íntegra.',
    'Que se entreguen las constancias de notificación de las actuaciones relevantes, indicando acto, destinatario, medio, fecha y soporte de entrega, publicación, devolución o recepción.',
    'Que se informe si existe o existió proceso de cobro coactivo y, en caso afirmativo, se remita copia del mandamiento de pago, su fecha y forma de notificación, medidas cautelares y demás actuaciones posteriores.',
  ];
  if (assessment.primaryRoute === 'PRESCRIPCION') requests.push('Que, si del expediente se acredita la configuración de la prescripción, se declare expresamente y se adopte la consecuencia jurídica correspondiente, incluida la terminación del cobro y la actualización de los registros cuando legalmente proceda.');
  else if (assessment.primaryRoute === 'CADUCIDAD') requests.push('Que se determine si operó la caducidad y, de acreditarse, se declare y adopten las consecuencias jurídicas correspondientes.');
  else if (assessment.primaryRoute === 'FOTODETECCION') requests.push('Que se aporte la evidencia completa de la fotodetección y de la individualización y responsabilidad personal del presunto infractor.');
  else requests.push('Que, si se acredita una irregularidad que afecte la validez, eficacia o exigibilidad de la actuación, se adopte la consecuencia jurídica procedente.');
  requests.push('Que, si jurídicamente corresponde, se ordene la actualización, depuración o cancelación del registro en el SIMIT y demás sistemas competentes.');
  requests.push('Que se emita respuesta de fondo, clara, precisa, congruente, completa y debidamente motivada frente a cada solicitud.');
  return requests.map((request, index) => `${index + 1}. ${request}`).join('\n\n');
}

export function generateUnifiedLegalDocument(record: SelectedRecordData): LegalDraft {
  const assessment = assessLegalSituation(record);
  const authorities = selectAuthorities(record, assessment.routes);
  const facts = buildFacts(record, assessment);
  const grounds = buildGrounds(assessment);
  const requests = buildRequests(record, assessment);
  const authority = sanitizeValue(record.organismo) || 'AUTORIDAD DE TRÁNSITO COMPETENTE';
  const applicant = sanitizeValue(record.nombre) || 'SOLICITANTE';
  const cedula = sanitizeValue(record.cedula);
  const email = sanitizeValue(record.correo);
  const number = sanitizeValue(record.comparendo) || 'que figura registrado';

  const document = [
    '**SEÑORES**',
    `**${authority.toUpperCase()}**`,
    'E. S. D.',
    '',
    `**ASUNTO:** DERECHO DE PETICIÓN — REVISIÓN INTEGRAL DE LA ACTUACIÓN No. ${number}, DETERMINACIÓN DE LA CONSECUENCIA JURÍDICA QUE CORRESPONDA Y DEPURACIÓN DEL REGISTRO, SI HAY LUGAR.`,
    `**PETICIONARIO:** ${applicant.toUpperCase()} — C.C. No. ${cedula}`,
    `**REFERENCIA:** ACTUACIÓN / COMPARENDO No. ${number}`,
    '',
    `Yo, **${applicant}**, identificado(a) con cédula de ciudadanía No. **${cedula}**, actuando en nombre propio, presento respetuosamente este derecho de petición, en ejercicio del derecho fundamental consagrado en el **artículo 23 de la Constitución Política de Colombia** y desarrollado por la **Ley 1755 de 2015**, mediante la cual se regula el ejercicio del derecho fundamental de petición.`,
    '',
    `En ejercicio del derecho fundamental de petición, solicito que se revise integralmente la situación jurídica de la actuación No. **${number}**, con base en los datos acreditados, el expediente administrativo y las actuaciones que la autoridad debe demostrar documentalmente, particularmente aquellas relacionadas con la notificación de las actuaciones administrativas, la eventual imposición de la sanción, su firmeza, las actuaciones de cobro y los demás elementos que resulten determinantes para establecer su situación jurídica actual.`,
    '',
    '### **I. HECHOS ACREDITADOS**',
    '',
    facts,
    '',
    '### **II. HIPÓTESIS Y ASPECTOS SUJETOS A VERIFICACIÓN**',
    '',
    `1. El Estado de Cuenta SIMIT acredita la existencia del registro descrito, pero no sustituye el expediente administrativo ni demuestra por sí solo la notificación, firmeza, ejecutoria o cobro de la sanción.\n\n2. ${assessment.photoDetection ? 'Por tratarse de una posible actuación de fotodetección, deben verificarse la validación, envío, recepción, vinculación del presunto infractor y elementos de responsabilidad personal.' : 'Debe verificarse el procedimiento contravencional, sus notificaciones, la resolución sancionatoria, su firmeza y las actuaciones posteriores de cobro.'}\n\n3. ${assessment.temporal.ageYears >= 3 ? 'La antigüedad del registro habilita una revisión específica de prescripción y de las demás consecuencias jurídicas temporalmente relevantes; su configuración depende de las fechas documentales del expediente.' : 'La antigüedad registrada no permite afirmar por sí sola la prescripción; las consecuencias temporales deben determinarse con las fechas procesales reales y la normativa aplicable.'}`,
    '',
    '### **III. CONSECUENCIAS JURÍDICAS A DETERMINAR**',
    '',
    `1. Si se acredita el vencimiento del término legal correspondiente sin actuación jurídicamente eficaz, deberá aplicarse la consecuencia legal que proceda.\n\n2. Si se acredita un defecto de notificación, falta de individualización o vulneración sustancial del debido proceso, deberán adoptarse las medidas administrativas jurídicamente procedentes.\n\n3. Ninguna conclusión de prescripción, caducidad, pérdida de ejecutoriedad o revocatoria se presenta como hecho acreditado sin el soporte documental que permita establecer su configuración.`,
    '',
    '### **IV. FUNDAMENTOS DE DERECHO Y JURISPRUDENCIA**',
    '',
    grounds,
    '',
    '### **V. PRETENSIONES**',
    '',
    requests,
    '',
    '### **VI. ANEXOS Y PRUEBAS**',
    '',
    '1. Estado de Cuenta / Reporte SIMIT aportado por el solicitante.',
    '2. Copia del documento de identidad, cuando sea aportada.',
    '',
    '### **VII. NOTIFICACIONES**',
    '',
    email ? `Agradezco que la respuesta sea remitida al correo electrónico **${email}**.` : 'Agradezco que la respuesta sea remitida por el medio legalmente procedente.',
    '',
    'Atentamente,',
    '',
    applicant,
    cedula ? `C.C. No. ${cedula}` : '',
    email ? `Correo electrónico: ${email}` : '',
  ].filter((line, index, arr) => !(line === '' && (arr[index - 1] === '' || arr[index + 1] === ''))).join('\n').trim();

  return {
    document,
    assessment,
    authorities,
    evidenceModel: assessment.evidenceQuestions.map((question) => ({ question, reason: 'Permite acreditar documentalmente el presupuesto jurídico relevante sin convertir una hipótesis en hecho.' })),
    hechos: facts,
    solicitudConcreta: requests,
    fundamentos: grounds,
  };
}

export function generateLegalDraft(record: SelectedRecordData): LegalDraft {
  return generateUnifiedLegalDocument(record);
}

export function getDynamicLegalQuestions(record: SelectedRecordData, assessment: LegalAssessment): DynamicLegalQuestion[] {
  const questions: DynamicLegalQuestion[] = [];
  if (assessment.routes.includes('NOTIFICACION')) {
    questions.push({ id: 'fecha_notificacion', label: '¿Tiene o conoce la fecha de notificación del acto sancionatorio?', type: 'date', required: false });
    questions.push({ id: 'medio_notificacion', label: '¿Cómo fue notificado?', type: 'select', required: false, options: [
      { value: 'personal', label: 'Personal' },
      { value: 'correo', label: 'Correo' },
      { value: 'electronica', label: 'Electrónica' },
      { value: 'no_conozco', label: 'No la conozco / no fui notificado' },
    ] });
  }
  if (assessment.routes.includes('PRESCRIPCION')) {
    questions.push({ id: 'fecha_mandamiento_pago', label: 'Fecha del mandamiento de pago, si existe', type: 'date', required: false });
    questions.push({ id: 'fecha_notificacion_mandamiento', label: 'Fecha de notificación del mandamiento de pago, si existe', type: 'date', required: false });
  }
  if (assessment.routes.includes('CADUCIDAD')) {
    questions.push({ id: 'hubo_audiencia', label: '¿Existe constancia de audiencia o actuación sancionatoria dentro del término legal?', type: 'radio', required: false, options: [
      { value: 'si', label: 'Sí' },
      { value: 'no', label: 'No' },
      { value: 'no_se', label: 'No lo sé' },
    ] });
  }
  if (assessment.routes.includes('FOTODETECCION')) {
    questions.push({ id: 'identificacion_conductor', label: '¿La autoridad ha identificado formalmente al conductor?', type: 'radio', required: false, options: [
      { value: 'si', label: 'Sí' },
      { value: 'no', label: 'No' },
      { value: 'no_se', label: 'No lo sé' },
    ] });
  }
  if (assessment.routes.includes('PERDIDA_EJECUTORIEDAD')) {
    questions.push({ id: 'actuaciones_cobro', label: 'Describa cualquier actuación de cobro que conozca', type: 'textarea', required: false });
  }
  return questions;
}

export function generateLegalDocument(data: LegalDocumentData): string {
  return generateUnifiedLegalDocument({
    comparendo: data.numComparendo,
    fecha: data.fechaComparendo,
    organismo: data.organismoTransito,
    valor: data.valorComparendo == null ? '' : String(data.valorComparendo),
    codigo: data.codigoInfraccion,
    nombre: data.nombreUsuario,
    cedula: data.cedulaUsuario,
    correo: data.emailUsuario,
  }).document;
}
