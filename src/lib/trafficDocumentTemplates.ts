import type { FormAnswers } from '../types/form';
import { generateUnifiedLegalDocument, sanitizeValue, type LegalAssessment, type SelectedRecordData } from './legalEngine';

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
  return text && !/^no identificado en el documento aportado$/i.test(text) ? text : '';
}

function buildFirstPersonIntro(applicant: string, cedula: string): string {
  const identity = cedula ? `, identificado(a) con cédula de ciudadanía No. ${sanitizeValue(cedula)}` : '';
  return `Yo, ${sanitizeValue(applicant)}${identity}, actuando en nombre propio, presento respetuosamente este derecho de petición.`;
}

function selectedRecord(a: FormAnswers): SelectedRecordData {
  const source = (a as FormAnswers & { __simitRecord?: any }).__simitRecord || {};
  const pick = (formKey: string, sourceValue?: unknown) => valueOrEmpty(rawValue(a, formKey)) || valueOrEmpty(sourceValue);
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
    actuacionesCobro: rawValue(a, 'actuaciones_cobro') || String(source.collectionActions || '')
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
    case 'REVOCATORIA_DIRECTA': return 'SOLICITUD DE REVOCATORIA DIRECTA';
    default: return 'REVISIÓN INTEGRAL DE LA ACTUACIÓN ADMINISTRATIVA';
  }
}

function configured(a: LegalAssessment) { return a.certainty === 'CONFIGURADO'; }

function mainRelief(route: string | null, a: LegalAssessment, r: SelectedRecordData): string {
  const id = r.comparendo ? ` respecto de la obligación derivada del comparendo No. ${sanitizeValue(r.comparendo)}` : '';
  if (route === 'PRESCRIPCION') {
    return configured(a)
      ? `Solicito que se declare la prescripción de la sanción y/o de la acción de cobro${id}; que se termine la obligación; que se archive cualquier actuación de cobro que corresponda; y que, como consecuencia, se ordene la cancelación, eliminación, actualización o depuración del registro de la multa en el SIMIT y demás sistemas de información en los que figure como obligación vigente o exigible, dentro del ámbito de competencia de la entidad.`
      : `Solicito que se examine integralmente si se configuró la prescripción de la sanción y/o de la acción de cobro${id} y que, si de la cronología documental se establece que el fenómeno prescriptivo ya operó, se declare la prescripción, se termine la obligación y se ordene su cancelación, eliminación, actualización o depuración en el SIMIT y demás sistemas de información en los que figure como obligación vigente o exigible, conforme a las competencias legales de la entidad.`;
  }
  if (route === 'CADUCIDAD') return `Solicito que se establezca si operó la caducidad de la actuación contravencional${id} y, de ser así, se declare, se dejen sin efectos las actuaciones que jurídicamente correspondan y se ordene la cancelación, eliminación, actualización o depuración del registro asociado.`;
  if (route === 'PERDIDA_EJECUTORIEDAD') return `Solicito que se determine si se configuró la pérdida de fuerza ejecutoria${id} y, de ser así, se declare, se termine el cobro y se ordene la cancelación, eliminación, actualización o depuración del registro correspondiente.`;
  if (route === 'FOTODETECCION') return `Solicito que se revise la legalidad de la imputación${id} y, si no se acredita mi responsabilidad personal con las garantías exigibles, se deje sin efectos la sanción y se ordene la cancelación, eliminación, actualización o depuración del registro correspondiente.`;
  if (route === 'NOTIFICACION' || route === 'DEBIDO_PROCESO') return `Solicito que se revise la regularidad de la actuación${id} y, si se acredita una irregularidad sustancial que afecte mi derecho de defensa o impida mantener sus efectos, se adopte la consecuencia jurídica correspondiente y se ordene la cancelación, eliminación, actualización o depuración del registro.`;
  if (route === 'REVOCATORIA_DIRECTA') return `Solicito que se revise la procedencia de la revocatoria directa${id} y, si se configuran sus presupuestos legales, se deje sin efectos la actuación o sanción y se ordene la cancelación, eliminación, actualización o depuración del registro correspondiente.`;
  return `Solicito que se revise integralmente la actuación${id} y que, si se establece una causal legal que impida mantener vigente la obligación, se adopte la decisión correspondiente y se ordene la cancelación, eliminación, actualización o depuración del registro.`;
}

function facts(r: SelectedRecordData, t: any): string {
  const out: string[] = [];
  if (r.comparendo || r.fecha || r.organismo) out.push(`1. En el Estado de Cuenta SIMIT que aporté aparece la actuación${r.comparendo ? ` No. ${sanitizeValue(r.comparendo)}` : ''}${r.organismo ? `, asociada a ${sanitizeValue(r.organismo)}` : ''}${r.fecha ? `, con fecha del hecho ${r.fecha}` : ''}.`);
  if (r.cedula) out.push(`${out.length + 1}. La actuación aparece asociada a mi documento de identidad No. ${sanitizeValue(r.cedula)}.`);
  if (r.placa) out.push(`${out.length + 1}. La placa asociada que aparece en la información disponible es ${sanitizeValue(r.placa)}.`);
  if (r.valor) out.push(`${out.length + 1}. El valor registrado para la obligación es ${sanitizeValue(r.valor)}.`);
  if (r.codigo) out.push(`${out.length + 1}. El registro identifica la infracción con el código ${sanitizeValue(r.codigo)}.`);
  if (r.fechaResolucion) out.push(`${out.length + 1}. Se registra una resolución o acto sancionatorio de fecha ${r.fechaResolucion}, cuya copia y constancia de ejecutoria deben verificarse en el expediente.`);
  else out.push(`${out.length + 1}. El Estado de Cuenta aportado no permite identificar, por sí solo, el número, contenido, fecha de expedición o ejecutoria del acto mediante el cual se habría impuesto la sanción.`);
  if (r.fechaNotificacion) out.push(`${out.length + 1}. Se registra una fecha de notificación (${r.fechaNotificacion}); debe verificarse qué actuación fue notificada y la constancia documental correspondiente.`);
  else out.push(`${out.length + 1}. El Estado de Cuenta aportado no permite establecer la fecha ni el medio mediante el cual se habría notificado el acto sancionatorio.`);
  if (r.fechaMandamientoPago) out.push(`${out.length + 1}. Se registra un mandamiento de pago de fecha ${r.fechaMandamientoPago}; su notificación y efectos deben verificarse documentalmente.`);
  else out.push(`${out.length + 1}. No se encuentra acreditada en la información aportada la existencia o fecha de un mandamiento de pago relacionado con esta obligación.`);
  if (r.fechaNotificacionMandamiento) out.push(`${out.length + 1}. Se registra como fecha de notificación del mandamiento de pago el ${r.fechaNotificacionMandamiento}; solicito la constancia que permita verificarla.`);
  else out.push(`${out.length + 1}. Tampoco se encuentra acreditada una fecha de notificación del mandamiento de pago. Esta ausencia no demuestra que la notificación jamás ocurrió, pero sí identifica una cuestión probatoria decisiva.`);
  if (t?.initialExpiryDate) out.push(`${out.length + 1}. Tomando como referencia la fecha del hecho, ${t.initialDate}, el término inicial de tres años proyecta su vencimiento al ${t.initialExpiryDate}. Este cálculo debe confrontarse con las actuaciones que obren en el expediente.`);
  return out.join('\n\n');
}

function legalGrounds(a: LegalAssessment): string {
  const routes = a.routes || [];
  const parts = ['El artículo 23 de la Constitución Política garantiza el derecho a obtener una respuesta de fondo, clara y congruente. El artículo 29 protege el debido proceso dentro de la actuación administrativa.'];
  if (routes.includes('PRESCRIPCION')) parts.push('El artículo 159 de la Ley 769 de 2002 establece el régimen especial de prescripción de las sanciones de tránsito y contempla la notificación del mandamiento de pago como actuación con incidencia en el término. La cronología de la obligación debe acreditarse documentalmente.');
  if (routes.includes('CADUCIDAD')) parts.push('El artículo 161 de la Ley 769 de 2002 regula la caducidad de la acción por contravención de tránsito. Su aplicación exige verificar la fecha del hecho y la oportunidad de la actuación sancionatoria.');
  if (routes.includes('FOTODETECCION')) parts.push('Cuando la actuación proviene de ayudas tecnológicas, la existencia de una imagen o la identificación del vehículo no sustituye el análisis de responsabilidad personal. La Sentencia C-038 de 2020 exige respetar el principio de imputación personal.');
  if (routes.includes('NOTIFICACION')) parts.push('Las actuaciones administrativas que deban notificarse deben contar con constancias que permitan verificar el acto comunicado, el destinatario, el medio utilizado y la fecha de notificación.');
  if (routes.includes('PERDIDA_EJECUTORIEDAD')) parts.push('La exigibilidad actual de la obligación debe confrontarse con la firmeza del acto, su ejecutoria y las actuaciones posteriores de cobro.');
  return parts.join('\n\n');
}

function requests(r: SelectedRecordData, a: LegalAssessment): string {
  const route = a.primaryRoute;
  const req = [
    `1. Que se me entregue copia íntegra, legible y completa del expediente administrativo relacionado con la actuación No. ${sanitizeValue(r.comparendo)}.`,
    '2. Que se me informe cuál fue la decisión mediante la cual se impuso la sanción, indicando número, fecha, contenido y constancia de ejecutoria, y se me entregue copia íntegra.',
    '3. Que se me entreguen las constancias de notificación de la orden de comparendo, de la decisión sancionatoria, de los recursos que se hubieren presentado y de las demás actuaciones relevantes.'
  ];
  if (route === 'PRESCRIPCION') {
    req.push('4. Que se me informe si existe o existió proceso de cobro coactivo y, en caso afirmativo, se me entregue copia íntegra del mandamiento de pago, de su constancia de notificación y de todas las actuaciones posteriores, con sus respectivas fechas.');
    req.push(configured(a)
      ? '5. Que se declare la prescripción de la sanción y/o de la acción de cobro y, como consecuencia, se termine la obligación, se archive cualquier actuación de cobro y se ordene la cancelación, eliminación, actualización o depuración del registro de la multa en el SIMIT y demás sistemas de información en los que figure como obligación vigente o exigible, dentro de las competencias de la entidad.'
      : '5. Que se determine, con base en el expediente y en la cronología documental, si se configuró la prescripción de la sanción y/o de la acción de cobro y, si se encuentra configurada, se declare, se termine la obligación y se ordene la cancelación, eliminación, actualización o depuración del registro de la multa en el SIMIT y demás sistemas de información en los que figure como obligación vigente o exigible.');
    req.push('6. Si la entidad considera que la prescripción no se ha configurado, solicito que indique expresamente la fecha de inicio y vencimiento que considera aplicables, la actuación que habría interrumpido el término, la fecha exacta de su notificación y el soporte documental de cada circunstancia.');
  } else if (route === 'CADUCIDAD') {
    req.push('4. Que se establezca si operó la caducidad y, de ser así, se declare, se adopten las consecuencias jurídicas correspondientes y se ordene la cancelación, eliminación, actualización o depuración del registro asociado.');
  } else if (route === 'PERDIDA_EJECUTORIEDAD') {
    req.push('4. Que se establezca si se configuró la pérdida de fuerza ejecutoria y, de ser así, se declare, se termine cualquier actuación de cobro que carezca de fundamento vigente y se ordene la cancelación, eliminación, actualización o depuración del registro correspondiente.');
  } else if (route === 'FOTODETECCION') {
    req.push('4. Que se me entregue la evidencia de la detección, la prueba técnica, las comunicaciones efectuadas y los documentos con los cuales se estableció mi responsabilidad personal.');
    req.push('5. Que, si no se acredita legalmente mi responsabilidad personal o se establece una irregularidad que afecte la validez de la sanción, se deje sin efectos la actuación en lo jurídicamente procedente y se ordene la cancelación, eliminación, actualización o depuración del registro.');
  } else {
    req.push('4. Que se determine si existe una irregularidad de notificación, debido proceso, responsabilidad personal, ejecutoria o cualquier otra circunstancia que afecte la validez o exigibilidad de la obligación.');
    req.push('5. Que, si se acredita una causal que impida mantener vigente la sanción o el cobro, se adopte la consecuencia jurídica correspondiente y se ordene la cancelación, eliminación, actualización o depuración del registro en los sistemas de información respectivos.');
  }
  req.push(`${req.length + 1}. Que se me informe qué actuaciones aparecen registradas en los sistemas internos de la entidad y cuáles cuentan con soporte documental dentro del expediente.`);
  req.push(`${req.length + 1}. Que, una vez establecida la situación jurídica de la obligación, se adopten las medidas administrativas necesarias para que los registros de la multa sean coherentes con la decisión adoptada y, cuando legalmente proceda, dejen de figurar como obligación pendiente o exigible en el SIMIT y demás sistemas de información.`);
  req.push(`${req.length + 1}. Que se emita una respuesta de fondo, clara, precisa, congruente y debidamente motivada frente a cada una de las solicitudes anteriores.`);
  return req.join('\n\n');
}

export function buildTrafficDocument(slug: string, a: FormAnswers) {
  const record = selectedRecord(a);
  const draft = generateUnifiedLegalDocument(record);
  const assessment = assessmentFromAnswers(a) || draft.assessment;
  const route = assessment.primaryRoute || (slug.includes('caducidad') ? 'CADUCIDAD' : slug.includes('prescripcion') ? 'PRESCRIPCION' : null);
  const authority = valueOrEmpty(rawValue(a, 'entidad')) || valueOrEmpty(record.organismo) || 'AUTORIDAD DE TRÁNSITO COMPETENTE';
  const applicant = valueOrEmpty(`${rawValue(a, 'nombres')} ${rawValue(a, 'apellidos')}`.trim()) || valueOrEmpty(rawValue(a, 'nombre')) || valueOrEmpty(record.nombre) || '';
  const cedula = valueOrEmpty(rawValue(a, 'documento')) || valueOrEmpty(record.cedula);
  const email = valueOrEmpty(rawValue(a, 'correo')) || valueOrEmpty(record.correo);
  const number = valueOrEmpty(rawValue(a, 'numero_comparendo')) || valueOrEmpty(record.comparendo);
  const date = rawValue(a, 'fecha_comparendo') || record.fecha || '';
  const city = rawValue(a, 'ciudad') || 'Sincelejo';
  const dateDocument = rawValue(a, 'fecha') || new Date().toLocaleDateString('es-CO');
  const title = `DERECHO DE PETICIÓN — ${routeLabel(route)}`;

  const document = [
    city,
    dateDocument,
    '',
    authority.toUpperCase(),
    '',
    title,
    '',
    `ASUNTO: ${title}`,
    `REFERENCIA: Comparendo / acto No. ${number || 'que figura registrado'}${date ? ` — Fecha: ${date}` : ''}`,
    '',
    applicant ? buildFirstPersonIntro(applicant, cedula) : 'Actuando en nombre propio, presento respetuosamente este derecho de petición.',
    email ? `Correo electrónico: ${email}` : '',
    '',
    'Respetados señores:',
    '',
    `En ejercicio del derecho fundamental de petición, solicito que se revise integralmente la situación jurídica de la actuación${number ? ` No. ${number}` : ' que figura registrada a mi nombre'}, con base en los datos acreditados, el expediente administrativo y las actuaciones que la autoridad debe demostrar documentalmente.`,
    '',
    'I. OBJETO',
    '',
    mainRelief(route, assessment, record),
    '',
    'II. HECHOS',
    '',
    facts(record, assessment.temporal),
    '',
    'III. FUNDAMENTOS DE DERECHO',
    '',
    legalGrounds(assessment),
    '',
    'IV. ANÁLISIS DEL CASO CONCRETO',
    '',
    assessment.temporal?.initialExpiryDate
      ? `La fecha del hecho es ${assessment.temporal.initialDate} y el vencimiento inicial calculado del término de tres años es ${assessment.temporal.initialExpiryDate}. ${assessment.temporal.executiveSummary || ''} ${assessment.temporal.mandamientoNotificationDate ? `Se registra como fecha de notificación del mandamiento ${assessment.temporal.mandamientoNotificationDate}; debe verificarse su eficacia.` : 'No se encuentra acreditada en la información aportada una notificación eficaz del mandamiento de pago; por ello, la cronología debe ser demostrada por la autoridad.'}`
      : 'La situación jurídica definitiva debe establecerse con base en las fechas y documentos que integran el expediente administrativo.',
    '',
    'V. PETICIONES',
    '',
    requests(record, assessment),
    '',
    'VI. ANEXOS',
    '',
    'Estado de Cuenta SIMIT aportado por el solicitante.',
    '',
    'VII. NOTIFICACIONES',
    '',
    email ? `Agradezco que la respuesta sea remitida al correo electrónico ${email}.` : 'Agradezco que la respuesta sea remitida por el medio legalmente procedente.',
    '',
    'Atentamente,',
    '',
    applicant || ''
  ].filter((line, i, arr) => !(line === '' && (arr[i - 1] === '' || arr[i + 1] === ''))).join('\n').trim();

  return document;
}
