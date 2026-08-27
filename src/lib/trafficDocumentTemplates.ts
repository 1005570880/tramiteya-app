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
  const assessment = (a as any).__legalAssessment;
  return assessment && typeof assessment === 'object' ? assessment as LegalAssessment : null;
}

function routeLabel(route: string | null | undefined): string {
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

function explicitDeletionRelief(route: string | null, record: SelectedRecordData, assessment: LegalAssessment): string {
  const id = record.comparendo ? ` del comparendo No. ${sanitizeValue(record.comparendo)}` : '';
  const consequence = `que se deje sin efectos, cancele o termine la obligación y/o el acto sancionatorio, según corresponda; que se archive cualquier actuación de cobro que carezca de fundamento vigente; y que se ordene al organismo competente reportar y materializar la cancelación, eliminación, depuración o actualización del registro en el SIMIT y demás sistemas de información donde figure la multa o comparendo, de manera que no continúe apareciendo como obligación vigente, exigible o pendiente.`;

  switch (route) {
    case 'PRESCRIPCION':
      return assessment.certainty === 'CONFIGURADO'
        ? `SOLICITUD PRINCIPAL — ELIMINACIÓN/CANCELACIÓN DE LA MULTA: Solicito que se declare la prescripción de la sanción y/o de la acción de cobro${id} y, como consecuencia directa, ${consequence}`
        : `SOLICITUD PRINCIPAL — ELIMINACIÓN/CANCELACIÓN DE LA MULTA: Solicito que se determine documentalmente si se configuró la prescripción de la sanción y/o de la acción de cobro${id}; si el término ya venció sin interrupción jurídicamente eficaz, solicito que se declare la prescripción y, como consecuencia directa, ${consequence}`;
    case 'CADUCIDAD':
      return `SOLICITUD PRINCIPAL — ELIMINACIÓN/CANCELACIÓN DE LA MULTA: Solicito que se determine si operó la caducidad de la actuación${id}; si se acredita, solicito que se declare y, como consecuencia directa, ${consequence}`;
    case 'FOTODETECCION':
      return `SOLICITUD PRINCIPAL — ELIMINACIÓN/CANCELACIÓN DE LA MULTA: Solicito que se determine si existe prueba suficiente de responsabilidad personal${id}; si no se acredita legalmente o se configura una irregularidad sustancial, solicito que se deje sin efectos la sanción y, como consecuencia directa, ${consequence}`;
    case 'NOTIFICACION':
      return `SOLICITUD PRINCIPAL — ELIMINACIÓN/CANCELACIÓN DE LA MULTA: Solicito que se revise la regularidad de las notificaciones${id}; si se acredita una irregularidad sustancial con afectación del derecho de defensa, solicito que se adopte la consecuencia jurídica correspondiente, incluyendo dejar sin efectos la sanción cuando proceda, y que, como consecuencia, ${consequence}`;
    case 'PERDIDA_EJECUTORIEDAD':
      return `SOLICITUD PRINCIPAL — ELIMINACIÓN/CANCELACIÓN DE LA MULTA: Solicito que se determine si se configuró la pérdida de fuerza ejecutoria${id}; si se acredita, solicito que se declare, se termine el cobro y que, como consecuencia, ${consequence}`;
    case 'DEBIDO_PROCESO':
      return `SOLICITUD PRINCIPAL — ELIMINACIÓN/CANCELACIÓN DE LA MULTA: Solicito que se determine si existió una vulneración sustancial del debido proceso${id}; si se acredita y afecta la validez o exigibilidad de la actuación, solicito que se adopte la consecuencia jurídica correspondiente, se deje sin efectos la sanción cuando proceda y que, como consecuencia, ${consequence}`;
    case 'REVOCATORIA_DIRECTA':
      return `SOLICITUD PRINCIPAL — ELIMINACIÓN/CANCELACIÓN DE LA MULTA: Solicito que se examine la procedencia de la revocatoria directa${id}; si se configuran sus presupuestos legales, solicito que se deje sin efectos el acto sancionatorio y que, como consecuencia, ${consequence}`;
    default:
      return `SOLICITUD PRINCIPAL — ELIMINACIÓN/CANCELACIÓN DE LA MULTA: Solicito que se revise integralmente la actuación${id} y, si se acredita una causal legal que impida mantener vigente la obligación o sanción, que se adopte la consecuencia jurídica correspondiente y que, como consecuencia, ${consequence}`;
  }
}

function facts(record: SelectedRecordData, temporal: any): string {
  const out: string[] = [];
  if (record.comparendo || record.fecha || record.organismo) out.push(`En el Estado de Cuenta SIMIT aportado aparece la actuación${record.comparendo ? ` No. ${sanitizeValue(record.comparendo)}` : ''}${record.organismo ? `, asociada a ${sanitizeValue(record.organismo)}` : ''}${record.fecha ? `, con fecha del hecho ${record.fecha}` : ''}.`);
  if (record.cedula) out.push(`La actuación aparece asociada al documento de identidad No. ${sanitizeValue(record.cedula)}.`);
  if (record.placa) out.push(`La placa que aparece en la información disponible es ${sanitizeValue(record.placa)}.`);
  if (record.valor) out.push(`El valor reportado para la obligación es ${sanitizeValue(record.valor)}.`);
  if (record.codigo) out.push(`El registro identifica la infracción con el código ${sanitizeValue(record.codigo)}.`);
  if (record.fechaResolucion) out.push(`Se reporta un acto o resolución sancionatoria de fecha ${record.fechaResolucion}; deben verificarse su contenido, notificación y ejecutoria.`);
  else out.push('El Estado de Cuenta aportado no permite identificar por sí solo el acto sancionatorio, su fecha de expedición ni su ejecutoria.');
  if (record.fechaNotificacion) out.push(`Se reporta una fecha de notificación (${record.fechaNotificacion}); debe establecerse qué actuación fue notificada y aportarse la constancia correspondiente.`);
  else out.push('No se encuentra acreditada en la información aportada la fecha ni el medio de notificación del acto sancionatorio.');
  if (record.fechaMandamientoPago) out.push(`Se reporta mandamiento de pago de fecha ${record.fechaMandamientoPago}; su fecha de expedición no se tendrá como equivalente a su notificación.`);
  else out.push('No se encuentra acreditada la existencia o fecha de un mandamiento de pago.');
  if (record.fechaNotificacionMandamiento) out.push(`Se reporta como fecha de notificación del mandamiento de pago el ${record.fechaNotificacionMandamiento}; debe verificarse documentalmente su eficacia.`);
  else out.push('No se encuentra acreditada una fecha de notificación del mandamiento de pago. Esta ausencia no demuestra por sí sola que nunca ocurrió, pero identifica una prueba decisiva que debe aportar la autoridad.');
  if (temporal?.initialExpiryDate) out.push(`Desde la fecha del hecho (${temporal.initialDate}) puede efectuarse el cómputo inicial de tres años, cuyo vencimiento calculado corresponde al ${temporal.initialExpiryDate}.`);
  return out.map((text, index) => `${index + 1}. ${text}`).join('\n\n');
}

function legalGrounds(assessment: LegalAssessment): string {
  const routes = assessment.routes || [];
  const parts = [
    'El artículo 23 de la Constitución Política garantiza el derecho de petición y el derecho a obtener una respuesta de fondo, clara, congruente y motivada.',
    'El artículo 29 de la Constitución Política protege el debido proceso en las actuaciones administrativas, incluida la posibilidad real de conocer, controvertir y probar frente a la imputación.'
  ];
  if (routes.includes('PRESCRIPCION')) parts.push('El artículo 159 de la Ley 769 de 2002 establece el régimen especial de prescripción de las sanciones de tránsito. La cronología debe reconstruirse con especial atención a la notificación del mandamiento de pago y no únicamente a su expedición.');
  if (routes.includes('CADUCIDAD')) parts.push('El artículo 161 de la Ley 769 de 2002 regula la caducidad de la acción por contravención de tránsito; deben verificarse la fecha del hecho, la decisión y la audiencia efectiva dentro del término legal.');
  if (routes.includes('FOTODETECCION')) parts.push('En actuaciones originadas en ayudas tecnológicas debe verificarse la prueba y la imputación de responsabilidad personal, conforme a las garantías desarrolladas por la jurisprudencia constitucional.');
  if (routes.includes('NOTIFICACION')) parts.push('Las actuaciones sujetas a notificación deben contar con soportes que permitan establecer el acto comunicado, destinatario, medio, fecha y constancia de entrega o publicación, según corresponda.');
  if (routes.includes('PERDIDA_EJECUTORIEDAD')) parts.push('La exigibilidad actual debe confrontarse con la firmeza y ejecutoria del acto y con las actuaciones posteriores de cobro.');
  return parts.join('\n\n');
}

function requests(record: SelectedRecordData, assessment: LegalAssessment): string {
  const expiry = assessment.temporal?.initialExpiryDate || 'el vencimiento del término aplicable';
  const req = [
    `1. Que se determine expresamente la situación jurídica de la multa o comparendo No. ${sanitizeValue(record.comparendo)} y, especialmente, si existe una razón legal para que continúe vigente, exigible o registrada como obligación pendiente.`,
    `2. Que se me entregue copia íntegra, legible y completa del expediente administrativo relacionado con la actuación No. ${sanitizeValue(record.comparendo)}.`,
    '3. Que se me informe cuál fue el acto mediante el cual se impuso la sanción, indicando número, fecha, contenido y constancia de ejecutoria, y se entregue copia íntegra.',
    '4. Que se remitan las constancias de notificación de la orden de comparendo, acto sancionatorio, recursos, resolución y mandamiento de pago, indicando acto, destinatario, medio, fecha y soporte documental.',
    '5. Que se informe si existe o existió proceso de cobro coactivo y se remitan sus actuaciones completas, incluyendo mandamiento de pago, constancia de notificación, medidas cautelares, acuerdos de pago, pagos, terminación y demás actuaciones posteriores, con sus fechas.',
    `6. Que se determine, con base en el expediente, si antes de ${expiry} se produjo y notificó válidamente una actuación jurídicamente eficaz para modificar el término de prescripción y, de ser así, se identifique exactamente el acto, fecha de expedición, fecha de notificación y soporte documental.`
  ];

  if (assessment.primaryRoute === 'PRESCRIPCION') {
    req.push('7. Que, si se acredita la configuración de la prescripción, se declare expresamente la prescripción de la sanción y/o de la acción de cobro.');
    req.push('8. Que, como consecuencia de la prescripción o de cualquier otra causal favorable que elimine la exigibilidad de la obligación, se termine y archive la obligación y cualquier actuación de cobro relacionada.');
    req.push('9. Que, como consecuencia directa de la decisión favorable, se deje sin efectos el acto sancionatorio cuando jurídicamente corresponda y se ordene la cancelación o eliminación de la multa/comparendo del registro que la mantenga como obligación vigente, exigible o pendiente.');
    req.push('10. Que se reporte y materialice ante el SIMIT y demás sistemas de información competentes la novedad correspondiente, de forma que el registro quede cancelado, eliminado, depurado o actualizado conforme a la decisión adoptada y no continúe reflejando una obligación que jurídicamente ya no puede exigirse.');
    req.push('11. Si la entidad considera que la prescripción no se ha configurado, que indique la fecha inicial, fecha de vencimiento, norma aplicada, actuación interruptiva, fecha exacta de notificación y prueba documental que sustenta cada una de esas fechas.');
  } else {
    req.push(`7. Que se determine expresamente si se configuró la causal principal (${assessment.primaryRoute || 'revisión integral'}) y se motive la decisión con base en el expediente.`);
    req.push('8. Que, si se acredita una causal que afecte la validez, eficacia o exigibilidad de la sanción, se deje sin efectos el acto sancionatorio en lo jurídicamente procedente, se termine la obligación y se archive el cobro relacionado.');
    req.push('9. Que, como consecuencia de la decisión favorable, se ordene la cancelación o eliminación de la multa/comparendo del registro administrativo correspondiente y se reporte la novedad al SIMIT y demás sistemas de información competentes para que deje de figurar como obligación vigente, exigible o pendiente.');
    req.push('10. Que se analicen de oficio, dentro de las competencias de la autoridad, las demás causales jurídicas evidenciadas por el expediente —prescripción, caducidad, notificación, pérdida de fuerza ejecutoria, debido proceso, responsabilidad personal o revocatoria directa— y se adopte la consecuencia que corresponda.');
  }

  req.push('11. Que se informe cuáles actuaciones aparecen registradas en los sistemas internos y cuáles cuentan con soporte documental dentro del expediente, sin utilizar el Estado de Cuenta SIMIT como sustituto del expediente administrativo.');
  req.push('12. Que se emita respuesta de fondo, clara, precisa, congruente, completa y debidamente motivada frente a cada una de las solicitudes anteriores.');
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
    explicitDeletionRelief(route, record, assessment),
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
