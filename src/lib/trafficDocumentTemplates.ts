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

function selectedRecord(a: FormAnswers): SelectedRecordData {
  const source = (a as FormAnswers & { __simitRecord?: any }).__simitRecord || {};
  const pick = (formKey: string, sourceValue?: unknown) => valueOrEmpty(rawValue(a, formKey)) || valueOrEmpty(sourceValue);
  return {
    comparendo: pick('numero_comparendo', source.number), fecha: rawValue(a, 'fecha_comparendo') || String(source.date || ''),
    organismo: pick('entidad', source.authority || rawValue(a, 'autoridad')), estado: rawValue(a, 'estado') || String(source.status || rawValue(a, 'estadoComparendo') || ''),
    valor: rawValue(a, 'valor') || (source.value != null ? `$${Number(source.value).toLocaleString('es-CO')}` : rawValue(a, 'valorMulta')),
    placa: pick('placa', source.plate), cedula: pick('documento', source.documentNumber || rawValue(a, 'cedula')),
    codigo: pick('codigo_infraccion', source.infractionCode || source.code), nombre: pick('nombre', source.name), correo: pick('correo', source.email),
    fechaResolucion: rawValue(a, 'fecha_resolucion') || String(source.resolutionDate || ''), fechaNotificacion: rawValue(a, 'fecha_notificacion') || String(source.notificationDate || ''),
    fechaMandamientoPago: rawValue(a, 'fecha_mandamiento_pago') || String(source.mandamientoDate || source.paymentOrderDate || ''),
    fechaNotificacionMandamiento: rawValue(a, 'fecha_notificacion_mandamiento') || String(source.paymentOrderNotificationDate || ''),
    fechaEjecutoria: rawValue(a, 'fecha_ejecutoria') || String(source.executedDate || ''), huboAudiencia: (a as any).hubo_audiencia,
    existeResolucion: (a as any).existe_resolucion, actuacionesCobro: rawValue(a, 'actuaciones_cobro') || String(source.collectionActions || '')
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

function deletionConsequence(record: SelectedRecordData): string {
  const id = record.comparendo ? ` del comparendo No. ${sanitizeValue(record.comparendo)}` : '';
  return `que, como consecuencia de la decisión favorable, se deje sin efectos la sanción o actuación cuando jurídicamente corresponda; se termine y archive la obligación y cualquier actuación de cobro derivada de ella; y se ordene al organismo competente cancelar, eliminar, depurar o actualizar el registro${id} en el SIMIT y demás sistemas de información donde figure, para que no continúe apareciendo como obligación vigente, exigible, pendiente o susceptible de cobro.`;
}

function explicitDeletionRelief(route: string | null, record: SelectedRecordData): string {
  const id = record.comparendo ? ` del comparendo No. ${sanitizeValue(record.comparendo)}` : '';
  const consequence = deletionConsequence(record);
  switch (route) {
    case 'PRESCRIPCION': return `Solicito como pretensión principal que se determine y, si se encuentra configurada, se declare la prescripción de la sanción y/o de la acción de cobro${id}. Si el término se encuentra vencido sin una actuación interruptiva jurídicamente eficaz, solicito que se adopte inmediatamente la consecuencia legal correspondiente: ${consequence}`;
    case 'CADUCIDAD': return `Solicito como pretensión principal que se determine si operó la caducidad de la actuación${id} y, de acreditarse, se declare. Como consecuencia, solicito: ${consequence}`;
    case 'PERDIDA_EJECUTORIEDAD': return `Solicito como pretensión principal que se determine si se configuró la pérdida de fuerza ejecutoria${id} y, de acreditarse, se declare. Como consecuencia, solicito: ${consequence}`;
    case 'FOTODETECCION': return `Solicito como pretensión principal que se verifique la legalidad de la fotodetección y la existencia de prueba suficiente de responsabilidad personal${id}. Si la responsabilidad no está legalmente acreditada o existe una irregularidad sustancial, solicito que se deje sin efectos la sanción. Como consecuencia, solicito: ${consequence}`;
    case 'NOTIFICACION': return `Solicito como pretensión principal que se verifique la regularidad de las notificaciones${id}. Si se acredita una irregularidad sustancial con afectación del derecho de defensa, solicito que se adopte la consecuencia jurídica correspondiente y, cuando proceda, se deje sin efectos la sanción. Como consecuencia, solicito: ${consequence}`;
    case 'DEBIDO_PROCESO': return `Solicito como pretensión principal que se determine si la actuación${id} respetó integralmente el debido proceso. Si se acredita una vulneración sustancial que afecte su validez o exigibilidad, solicito que se adopte la consecuencia jurídica correspondiente y se deje sin efectos la sanción cuando proceda. Como consecuencia, solicito: ${consequence}`;
    case 'REVOCATORIA_DIRECTA': return `Solicito como pretensión principal que se examine la procedencia de la revocatoria directa${id}. Si se configuran sus presupuestos legales, solicito que se revoque o deje sin efectos el acto sancionatorio. Como consecuencia, solicito: ${consequence}`;
    default: return `Solicito como pretensión principal que se revise integralmente la actuación${id} y que, si se acredita una causal legal que impida mantener vigente, exigible o registrada la obligación, se adopte la consecuencia jurídica correspondiente. Como consecuencia, solicito: ${consequence}`;
  }
}

function facts(record: SelectedRecordData, temporal: any): string {
  const out: string[] = [];
  if (record.comparendo || record.fecha || record.organismo) out.push(`En el Estado de Cuenta SIMIT aportado aparece la actuación${record.comparendo ? ` No. ${sanitizeValue(record.comparendo)}` : ''}${record.organismo ? `, asociada a ${sanitizeValue(record.organismo)}` : ''}${record.fecha ? `, con fecha del hecho ${record.fecha}` : ''}.`);
  if (record.cedula) out.push(`La actuación aparece asociada al documento de identidad No. ${sanitizeValue(record.cedula)}.`);
  if (record.placa) out.push(`La placa que aparece en la información disponible es ${sanitizeValue(record.placa)}.`);
  if (record.valor) out.push(`El valor reportado para la obligación es ${sanitizeValue(record.valor)}.`);
  if (record.codigo) out.push(`El registro identifica la infracción con el código ${sanitizeValue(record.codigo)}.`);
  if (record.fechaResolucion) out.push(`Se reporta un acto o resolución sancionatoria de fecha ${record.fechaResolucion}; deben verificarse su contenido, notificación y ejecutoria.`); else out.push('El Estado de Cuenta aportado no permite identificar por sí solo el acto sancionatorio, su fecha de expedición ni su ejecutoria.');
  if (record.fechaNotificacion) out.push(`Se reporta una fecha de notificación (${record.fechaNotificacion}); debe establecerse qué actuación fue notificada y aportarse la constancia correspondiente.`); else out.push('No se encuentra acreditada en la información aportada la fecha ni el medio de notificación del acto sancionatorio.');
  if (record.fechaMandamientoPago) out.push(`Se reporta mandamiento de pago de fecha ${record.fechaMandamientoPago}; su fecha de expedición no se tendrá como equivalente a su notificación.`); else out.push('No se encuentra acreditada la existencia o fecha de un mandamiento de pago.');
  if (record.fechaNotificacionMandamiento) out.push(`Se reporta como fecha de notificación del mandamiento de pago el ${record.fechaNotificacionMandamiento}; debe verificarse documentalmente su eficacia.`); else out.push('No se encuentra acreditada una fecha de notificación del mandamiento de pago. Esta ausencia no demuestra por sí sola que nunca ocurrió, pero identifica una prueba decisiva que debe aportar la autoridad.');
  if (temporal?.initialExpiryDate) out.push(`Desde la fecha del hecho (${temporal.initialDate}) puede efectuarse el cómputo inicial de tres años, cuyo vencimiento calculado corresponde al ${temporal.initialExpiryDate}.`);
  return out.map((text, index) => `${index + 1}. ${text}`).join('\n\n');
}

function legalGrounds(assessment: LegalAssessment): string {
  const routes = assessment.routes || [];
  const parts = ['El artículo 23 de la Constitución Política garantiza el derecho de petición y el derecho a obtener una respuesta de fondo, clara, congruente y motivada.', 'El artículo 29 de la Constitución Política protege el debido proceso en las actuaciones administrativas, incluida la posibilidad real de conocer, controvertir y probar frente a la imputación.'];
  if (routes.includes('PRESCRIPCION')) parts.push('El artículo 159 de la Ley 769 de 2002 establece el régimen especial de prescripción de las sanciones de tránsito. La cronología debe reconstruirse con atención a la notificación del mandamiento de pago y no únicamente a su expedición.');
  if (routes.includes('CADUCIDAD')) parts.push('El artículo 161 de la Ley 769 de 2002 regula la caducidad de la acción por contravención de tránsito; deben verificarse la fecha del hecho y las actuaciones exigidas dentro del término legal.');
  if (routes.includes('FOTODETECCION')) parts.push('En actuaciones originadas en ayudas tecnológicas debe verificarse la prueba de la infracción y la imputación de responsabilidad personal, conforme a las garantías constitucionales aplicables.');
  if (routes.includes('NOTIFICACION')) parts.push('Las actuaciones sujetas a notificación deben contar con soportes que permitan establecer el acto comunicado, destinatario, medio, fecha y constancia de entrega o publicación, según corresponda.');
  if (routes.includes('PERDIDA_EJECUTORIEDAD')) parts.push('La exigibilidad actual debe confrontarse con la firmeza y ejecutoria del acto y con las actuaciones posteriores de cobro.');
  if (routes.includes('REVOCATORIA_DIRECTA')) parts.push('La revocatoria directa deberá analizarse frente a los presupuestos legales aplicables al acto administrativo concreto y a la situación acreditada en el expediente.');
  return parts.join('\n\n');
}

function requests(record: SelectedRecordData, assessment: LegalAssessment): string {
  const number = record.comparendo ? sanitizeValue(record.comparendo) : 'que figura registrado';
  const expiry = assessment.temporal?.initialExpiryDate || 'el vencimiento del término aplicable';
  const req: string[] = [
    `Que se determine expresamente la situación jurídica actual de la multa o comparendo No. ${number}, indicando por qué razón continúa vigente, exigible o registrado, si así ocurre.`,
    `Que se me entregue copia íntegra, legible y completa del expediente administrativo relacionado con la actuación No. ${number}.`,
    'Que se identifique el acto mediante el cual se impuso la sanción, indicando número, fecha, contenido, autoridad que lo expidió y constancia de ejecutoria, y se entregue copia íntegra.',
    'Que se entreguen las constancias de notificación de la orden de comparendo, acto sancionatorio, recursos, resolución y demás actuaciones relevantes, indicando acto, destinatario, dirección o canal, medio utilizado, fecha y soporte de entrega, publicación o recepción.',
    'Que se informe si existe o existió proceso de cobro coactivo y, en caso afirmativo, se remita copia íntegra de sus actuaciones, incluyendo mandamiento de pago, fecha de expedición, fecha y forma de notificación, medidas cautelares, acuerdos de pago, pagos, excepciones, terminación y demás actuaciones posteriores.',
    `Que se reconstruya documentalmente la cronología de la obligación y se determine si antes de ${expiry} se produjo y notificó una actuación jurídicamente eficaz para modificar el término aplicable; de ser así, que se identifique la norma, actuación, fecha de expedición, fecha exacta de notificación y soporte documental.`
  ];
  switch (assessment.primaryRoute) {
    case 'PRESCRIPCION': req.push('Que, si del expediente se acredita la configuración de la prescripción de la sanción y/o de la acción de cobro, se declare expresamente dicha prescripción.','Que, declarada la prescripción, se termine y archive la obligación y cualquier actuación de cobro relacionada, y se deje sin efectos el acto o actuación en aquello que jurídicamente corresponda.','Que, como consecuencia directa de la decisión favorable, se ordene la cancelación, eliminación, depuración o actualización del registro de la multa o comparendo en el SIMIT y demás sistemas de información competentes, para que deje de figurar como obligación vigente, exigible o pendiente.','Que la entidad materialice y, cuando corresponda, comunique al organismo administrador del sistema la novedad derivada de la decisión, verificando que el registro quede efectivamente actualizado.','Si la entidad sostiene que la prescripción no se configuró, que explique de manera concreta el término aplicado, su fecha inicial, cada actuación con incidencia en el cómputo, la fecha y forma de notificación de cada una y la prueba documental que sustenta esas fechas.'); break;
    case 'CADUCIDAD': req.push('Que, si se acredita la caducidad de la actuación, se declare expresamente, se deje sin efectos la consecuencia sancionatoria cuando corresponda y se termine la obligación.','Que, como consecuencia de la decisión favorable, se ordene la cancelación, eliminación, depuración o actualización del registro en el SIMIT y demás sistemas competentes para que la multa o comparendo deje de figurar como obligación vigente o exigible.'); break;
    case 'PERDIDA_EJECUTORIEDAD': req.push('Que, si se acredita la pérdida de fuerza ejecutoria, se declare expresamente y se termine la exigibilidad de la obligación en los términos jurídicamente procedentes.','Que, como consecuencia, se archive el cobro y se ordene la cancelación, eliminación, depuración o actualización del registro en el SIMIT y demás sistemas competentes cuando legalmente corresponda.'); break;
    case 'FOTODETECCION': req.push('Que se aporte la evidencia completa de la fotodetección, identificación del vehículo, trazabilidad de la prueba, comunicación al interesado y actuaciones destinadas a garantizar comparecencia y defensa.','Que, si no se acredita legalmente la responsabilidad personal o existe una irregularidad sustancial que afecte la actuación, se deje sin efectos la sanción y se termine la obligación.','Que, como consecuencia de la decisión favorable, se ordene la cancelación, eliminación, depuración o actualización del registro correspondiente en el SIMIT y demás sistemas competentes.'); break;
    case 'NOTIFICACION':
    case 'DEBIDO_PROCESO': req.push('Que se determine si las garantías de notificación, defensa, contradicción, prueba y recursos fueron efectivamente respetadas y se aporten las constancias documentales correspondientes.','Que, si se acredita una irregularidad sustancial que afecte la validez, eficacia o exigibilidad de la actuación, se adopte la consecuencia jurídica procedente y, cuando corresponda, se deje sin efectos la sanción.','Que, como consecuencia de una decisión favorable, se ordene la cancelación, eliminación, depuración o actualización del registro en el SIMIT y demás sistemas competentes.'); break;
    case 'REVOCATORIA_DIRECTA': req.push('Que se determine la procedencia de la revocatoria directa frente al acto sancionatorio y, si se configuran sus presupuestos, se revoque o deje sin efectos.','Que, como consecuencia de la revocatoria, se termine la obligación y se ordene la cancelación, eliminación, depuración o actualización del registro en el SIMIT y demás sistemas competentes.'); break;
    default: req.push('Que se determinen las causales jurídicas que resulten acreditadas en el expediente y se adopte respecto de ellas la consecuencia legal correspondiente.','Que, si una causal favorable impide mantener vigente o exigible la obligación, se deje sin efectos la actuación cuando corresponda, se termine el cobro y se ordene la cancelación, eliminación, depuración o actualización del registro en el SIMIT y demás sistemas competentes.');
  }
  req.push('Que se informe cuáles actuaciones aparecen registradas en los sistemas internos de la entidad y cuáles cuentan con soporte documental dentro del expediente, sin utilizar el Estado de Cuenta SIMIT como sustituto del expediente administrativo.','Que se emita una respuesta de fondo, clara, precisa, congruente, completa y debidamente motivada frente a cada una de las solicitudes anteriores.');
  return req.map((text, index) => `${index + 1}. ${text}`).join('\n\n');
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
  const formalIntro = applicant
    ? `Yo, **${sanitizeValue(applicant)}**, identificado con cédula de ciudadanía No. **${sanitizeValue(cedula)}**, actuando en nombre propio, presento respetuosamente este derecho de petición, en ejercicio del derecho fundamental consagrado en el **artículo 23 de la Constitución Política de Colombia** y desarrollado por la **Ley 1755 de 2015**, mediante la cual se regula el ejercicio del derecho fundamental de petición.`
    : 'Actuando en nombre propio, presento respetuosamente este derecho de petición, en ejercicio del derecho fundamental consagrado en el **artículo 23 de la Constitución Política de Colombia** y desarrollado por la **Ley 1755 de 2015**, mediante la cual se regula el ejercicio del derecho fundamental de petición.';
  const secondIntro = `En ejercicio del derecho fundamental de petición, solicito que se revise integralmente la situación jurídica de la actuación No. **${sanitizeValue(number) || 'que figura registrada a mi nombre'}**, con base en los datos acreditados, el expediente administrativo y las actuaciones que la autoridad debe demostrar documentalmente, particularmente aquellas relacionadas con la notificación de las actuaciones administrativas, la eventual imposición de la sanción, su firmeza, las actuaciones de cobro y los demás elementos que resulten determinantes para establecer su situación jurídica actual.`;

  return [city, dateDocument, '', authority.toUpperCase(), '', title, '', `ASUNTO: ${title}`, `REFERENCIA: Comparendo / acto No. ${number || 'que figura registrado'}${date ? ` — Fecha: ${date}` : ''}`, '', formalIntro, '', secondIntro, '', 'I. OBJETO', '', explicitDeletionRelief(route, record), '', 'II. HECHOS', '', facts(record, assessment.temporal), '', 'III. FUNDAMENTOS DE DERECHO', '', legalGrounds(assessment), '', 'IV. ANÁLISIS DEL CASO CONCRETO', '', assessment.temporal?.initialExpiryDate ? `La fecha del hecho es ${assessment.temporal.initialDate} y el vencimiento inicial calculado del término de tres años es ${assessment.temporal.initialExpiryDate}. ${assessment.temporal.executiveSummary || ''} ${assessment.temporal.mandamientoNotificationDate ? `Se registra como fecha de notificación del mandamiento ${assessment.temporal.mandamientoNotificationDate}; debe verificarse su eficacia.` : 'No se encuentra acreditada en la información aportada una notificación eficaz del mandamiento de pago; por ello, la cronología debe ser demostrada por la autoridad.'}` : 'La situación jurídica definitiva debe establecerse con base en las fechas y documentos que integran el expediente administrativo.', '', 'V. PETICIONES', '', requests(record, assessment), '', 'VI. ANEXOS', '', 'Estado de Cuenta SIMIT aportado por el solicitante.', '', 'VII. NOTIFICACIONES', '', 'La respuesta deberá ser remitida al medio de notificación que corresponda conforme a la información suministrada por el peticionario.', '', 'Atentamente', '', applicant || '', cedula ? `C.C. No. ${cedula}` : '', email ? `Correo electrónico: ${email}` : ''].filter((line, i, arr) => !(line === '' && (arr[i - 1] === '' || arr[i + 1] === ''))).join('\n').trim();
}
