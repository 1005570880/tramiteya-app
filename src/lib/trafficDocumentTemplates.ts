import type { FormAnswers } from '../types/form';
import { generateLegalDraft, type LegalAssessment, type SelectedRecordData } from './legalEngine';

const v = (a: FormAnswers, k: string, f = '') => {
  const x = a[k];
  if (Array.isArray(x)) return x.join(', ');
  if (typeof x === 'boolean') return x ? 'Sí' : 'No';
  if (x == null) return f;
  const value = String(x).trim();
  if (!value || /^no especificad[ao] en pdf$/i.test(value)) return f;
  return value;
};
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

function selectedRecord(a: FormAnswers): SelectedRecordData {
  const source = (a as any).__simitRecord || {};
  return {
    comparendo: v(a, 'numero_comparendo', source.number || 'no identificado'),
    fecha: v(a, 'fecha_comparendo', source.date || 'no identificada'),
    organismo: v(a, 'entidad', source.authority || v(a, 'autoridad', 'la Autoridad de Tránsito competente')),
    estado: v(a, 'estado', source.status || v(a, 'estadoComparendo', 'no identificado')),
    valor: v(a, 'valor', source.value != null ? `$${Number(source.value).toLocaleString('es-CO')}` : v(a, 'valorMulta', 'no reportado')),
    placa: v(a, 'placa', source.plate || undefined),
    cedula: v(a, 'documento', source.documentNumber || v(a, 'cedula', undefined)),
    codigo: v(a, 'codigo_infraccion', source.code || v(a, 'codigoInfraccion', undefined)),
    fechaResolucion: v(a, 'fecha_resolucion', source.resolutionDate || undefined),
    fechaNotificacion: v(a, 'fecha_notificacion', source.notificationDate || undefined),
    fechaMandamientoPago: v(a, 'fecha_mandamiento_pago', source.paymentOrderDate || undefined),
    fechaNotificacionMandamiento: v(a, 'fecha_notificacion_mandamiento', source.paymentOrderNotificationDate || undefined),
    fechaEjecutoria: v(a, 'fecha_ejecutoria', source.executedDate || undefined),
    actuacionesCobro: v(a, 'actuaciones_cobro', source.collectionActions || undefined),
    huboAudiencia: (a as any).hubo_audiencia,
    existeResolucion: (a as any).existe_resolucion,
  };
}

function assessmentFromAnswers(a: FormAnswers): LegalAssessment | null {
  const value = a.__legalAssessment;
  return value && typeof value === 'object' ? value as LegalAssessment : null;
}
function routeLabel(route: string | null | undefined) {
  switch (route) {
    case 'CADUCIDAD': return 'caducidad de la actuación contravencional';
    case 'PRESCRIPCION': return 'prescripción de la sanción y/o de la acción de cobro, según corresponda';
    case 'PERDIDA_EJECUTORIEDAD': return 'pérdida de fuerza ejecutoria del acto administrativo';
    case 'NOTIFICACION': return 'regularidad y eficacia de las notificaciones';
    case 'FOTODETECCION': return 'legalidad de la detección tecnológica e imputación personal';
    case 'DEBIDO_PROCESO': return 'garantías del debido proceso administrativo sancionatorio';
    case 'REVOCATORIA_DIRECTA': return 'revocatoria directa, si se configura una causal legal';
    default: return 'revisión integral de la actuación administrativa';
  }
}

function buildRequests(a: FormAnswers, assessment: LegalAssessment) {
  const number = v(a, 'numero_comparendo', 'no identificado');
  const requests: string[] = [];
  if (assessment.routes.includes('PRESCRIPCION')) {
    requests.push(`Que se determine, con base en el expediente y la cronología documental, si se configuró la prescripción respecto de la sanción y/o de la acción de cobro asociada al comparendo No. ${number}, indicando expresamente la fecha del hecho, el vencimiento inicial calculado y, si se alega interrupción, la fecha de notificación del mandamiento de pago que la sustenta.`);
    requests.push(`Que se informe y acredite documentalmente si antes del ${assessment.temporal?.initialExpiryDate || 'vencimiento del término inicial'} se produjo y notificó válidamente un mandamiento de pago. Si no se acredita, que se adopte la consecuencia jurídica que corresponda conforme al régimen de prescripción aplicable.`);
  }
  if (assessment.routes.includes('PERDIDA_EJECUTORIEDAD')) requests.push('Que se determine si el acto administrativo sancionatorio perdió fuerza ejecutoria, verificando su firmeza y las actuaciones efectivamente realizadas para ejecutarlo durante el término legal.');
  if (assessment.routes.includes('NOTIFICACION') || assessment.routes.includes('DEBIDO_PROCESO')) requests.push('Que se aporten las constancias completas de notificación de cada actuación relevante, indicando acto notificado, destinatario, dirección o canal, fecha, medio empleado, constancia de entrega o publicación y recursos procedentes.');
  if (assessment.routes.includes('FOTODETECCION')) requests.push('Que se aporte la totalidad de la evidencia de detección tecnológica y de los documentos que sustentaron la individualización e imputación personal de la conducta.');
  if (assessment.routes.includes('REVOCATORIA_DIRECTA')) requests.push('Que, si del expediente se desprende una causal legal de revocatoria directa o una irregularidad sustancial que afecte la validez o eficacia de la actuación, se adopte la decisión jurídicamente procedente.');
  requests.push('Que se remita copia íntegra, legible y completa del expediente administrativo, incluyendo orden de comparendo, evidencia, actuaciones de comparecencia, audiencia, resolución sancionatoria, recursos, constancia de ejecutoria, actuaciones de cobro, mandamiento de pago y sus constancias de notificación, si existen.');
  requests.push('Que se informe expresamente cuáles actuaciones aparecen registradas en los sistemas internos de la entidad y cuáles cuentan con soporte documental, evitando tener el Estado de Cuenta SIMIT como sustituto del expediente administrativo.');
  requests.push('Que, una vez establecida la situación jurídica mediante los documentos que obran en el expediente, se adopte la consecuencia jurídica correspondiente y se actualicen o depuren los registros administrativos y sistemas de información cuando legalmente proceda.');
  requests.push('Que se emita respuesta de fondo, clara, congruente, motivada y completa frente a cada una de las solicitudes formuladas.');
  return requests.map(clean);
}

function buildTitle(slug: string, assessment: LegalAssessment) {
  switch (assessment.primaryRoute) {
    case 'PRESCRIPCION': return 'DERECHO DE PETICIÓN — SOLICITUD DE PRESCRIPCIÓN DE SANCIÓN Y/O ACCIÓN DE COBRO';
    case 'PERDIDA_EJECUTORIEDAD': return 'DERECHO DE PETICIÓN — SOLICITUD DE DECLARATORIA DE PÉRDIDA DE FUERZA EJECUTORIA';
    case 'NOTIFICACION': return 'DERECHO DE PETICIÓN — REVISIÓN DE NOTIFICACIÓN Y DEBIDO PROCESO';
    case 'FOTODETECCION': return 'DERECHO DE PETICIÓN — REVISIÓN DE ACTUACIÓN DE FOTODETECCIÓN';
    case 'CADUCIDAD': return 'DERECHO DE PETICIÓN — REVISIÓN DE CADUCIDAD DE ACTUACIÓN CONTRAVENCIONAL';
    default:
      if (slug === 'revocatoria-comparendo') return 'SOLICITUD DE REVOCATORIA DIRECTA Y/O CORRECCIÓN DE ACTUACIÓN ADMINISTRATIVA';
      if (slug === 'solicitud-soportes-comparendo') return 'DERECHO DE PETICIÓN — SOLICITUD DE EXPEDIENTE Y SOPORTES DE ACTUACIÓN DE TRÁNSITO';
      return 'DERECHO DE PETICIÓN — REVISIÓN JURÍDICA DE SANCIÓN DE TRÁNSITO';
  }
}

function section(text: string, heading: string) {
  const marker = `${heading}\n`;
  const start = text.indexOf(marker);
  if (start < 0) return '';
  const from = start + marker.length;
  const next = text.indexOf('\n\n', from);
  return text.slice(from, next < 0 ? text.length : next).trim();
}

function extractAfter(text: string, heading: string) {
  const marker = `${heading}\n`;
  const start = text.indexOf(marker);
  return start < 0 ? '' : text.slice(start + marker.length).trim();
}

export function buildTrafficDocument(slug: string, a: FormAnswers) {
  const record = selectedRecord(a);
  const legalDraft = generateLegalDraft(record);
  const assessment = assessmentFromAnswers(a) || legalDraft.assessment;
  const title = buildTitle(slug, assessment);
  const authority = v(a, 'entidad', record.organismo);
  const name = `${v(a, 'nombres')} ${v(a, 'apellidos')}`.trim() || 'Solicitante';
  const number = v(a, 'numero_comparendo', record.comparendo);
  const date = v(a, 'fecha_comparendo', record.fecha);
  const route = routeLabel(assessment.primaryRoute);
  const customFacts = v(a, 'hechos');

  // The legal engine now owns the factual narrative. A user-supplied narrative is
  // respected, but the deterministic case facts are always retained when it is absent.
  const facts = customFacts && !/^no se han incorporado hechos adicionales/i.test(customFacts)
    ? `${customFacts}\n\n${legalDraft.hechos}`
    : legalDraft.hechos;

  const foundations = legalDraft.fundamentos;
  const problem = section(foundations, 'III. PROBLEMA JURÍDICO') || `Debe determinarse la situación jurídica actual de la actuación No. ${number}, estableciendo, a partir de las fechas y documentos disponibles, qué término resulta aplicable, cuál es su fecha de vencimiento, qué actuación podría haberlo interrumpido y qué consecuencia jurídica corresponde.`;
  const legalBody = extractAfter(foundations, 'IV. FUNDAMENTOS DE DERECHO');
  const application = legalBody || 'No existe información suficiente para cerrar el análisis sin inventar actuaciones.';
  const timeline = legalDraft.assessment.temporal?.events?.map((event) => `${event.label}: ${event.date || 'no acreditada'}. Estado probatorio: ${event.status}. Efecto jurídico: ${event.legalEffect}`).join('\n\n') || '';
  const conclusion = legalDraft.assessment.temporal?.temporalConclusion || 'La conclusión debe ajustarse a las actuaciones y fechas que resulten documentalmente acreditadas.';
  const evidence = legalDraft.assessment.missingEvidence.map((item) => `• ${item}`).join('\n');
  const requests = buildRequests(a, assessment);

  return [
    v(a, 'ciudad', 'Sincelejo'), v(a, 'fecha', new Date().toLocaleDateString('es-CO')), '',
    authority.toUpperCase(), 'Dependencia competente', '', title, '',
    `ASUNTO: ${title}`, `REFERENCIA: Comparendo / acto No. ${number} — Fecha: ${date}`, '',
    'SOLICITANTE', name, `C.C. ${v(a, 'documento', record.cedula || 'no identificada')}`,
    v(a, 'correo') ? `Correo electrónico: ${v(a, 'correo')}` : '',
    v(a, 'placa', record.placa) ? `Placa: ${v(a, 'placa', record.placa)}` : '', '',
    'Respetados señores:', '',
    `En ejercicio del derecho fundamental de petición, solicito que se revise integralmente la situación jurídica del comparendo o acto No. ${number}. La petición no parte de una presunción sobre la inexistencia de actuaciones administrativas: parte de los datos actualmente acreditados, realiza el cómputo que sí puede realizarse y solicita que la autoridad aporte los documentos necesarios para confirmar o descartar las hipótesis jurídicas identificadas.`, '',
    'I. OBJETO',
    `Solicito que ${route} sea examinada de manera integral, con especial atención a la cronología del expediente, las actuaciones de notificación, la firmeza del acto, el eventual mandamiento de pago y las actuaciones posteriores de cobro. La autoridad deberá establecer la consecuencia jurídica correspondiente a partir de fechas y documentos verificables.`, '',
    'II. ANTECEDENTES Y HECHOS', facts, '',
    'III. PROBLEMA JURÍDICO', problem, '',
    'IV. FUNDAMENTOS DE DERECHO', application, '',
    'V. ANÁLISIS DEL CASO CONCRETO',
    `La información disponible permite efectuar el siguiente análisis individualizado:\n\n${legalDraft.assessment.temporal?.executiveSummary || 'No existe fecha inicial suficiente para realizar un cómputo temporal confiable.'}\n\n${legalDraft.assessment.temporal?.inferences?.join('\n\n') || ''}\n\n${legalDraft.assessment.temporal?.scenarios?.map((s) => `${s.title}. ${s.condition}. Consecuencia: ${s.conclusion}`).join('\n\n') || ''}`, '',
    'VI. RECONSTRUCCIÓN CRONOLÓGICA Y EFECTOS JURÍDICOS', timeline || 'No se dispone de una cronología suficiente; se solicita su reconstrucción documental.', '',
    'VII. PRUEBA Y DOCUMENTOS NECESARIOS', evidence || 'No se identifican documentos adicionales con la información disponible.', '',
    'VIII. CONCLUSIÓN JURÍDICA', conclusion, '',
    'IX. PETICIONES', requests.map((item, index) => `${index + 1}. ${item}`).join('\n\n'), '',
    'X. ANEXOS', v(a, 'anexos', 'Estado de Cuenta SIMIT aportado por el solicitante.'), '',
    'XI. NOTIFICACIONES', v(a, 'correo', 'En el correo electrónico informado por el solicitante.'), '',
    'Atentamente,', '', name, `C.C. ${v(a, 'documento', record.cedula || 'no identificada')}`,
  ].join('\n');
}
