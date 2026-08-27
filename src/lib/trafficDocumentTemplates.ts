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
    organismo: v(a, 'entidad', source.authority || 'la Autoridad de Tránsito competente'),
    estado: v(a, 'estado', source.status || 'no identificado'),
    valor: v(a, 'valor', source.value != null ? `$${Number(source.value).toLocaleString('es-CO')}` : 'no reportado'),
    placa: v(a, 'placa', source.plate || undefined),
    cedula: v(a, 'documento', source.documentNumber || undefined),
    codigo: v(a, 'codigo_infraccion', source.code || undefined),
    fechaResolucion: v(a, 'fecha_resolucion', source.resolutionDate || undefined),
    fechaNotificacion: v(a, 'fecha_notificacion', source.notificationDate || undefined),
    fechaMandamientoPago: v(a, 'fecha_mandamiento_pago', source.paymentOrderDate || undefined),
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
  const routes = assessment.routes;
  const requests: string[] = [];
  if (routes.includes('PRESCRIPCION')) requests.push(`Que se determine, con base en el expediente y la cronología documental, si se configuró la prescripción respecto de la sanción y/o de la acción de cobro asociada al comparendo No. ${number}, indicando expresamente las fechas utilizadas para el cómputo.`);
  if (routes.includes('PERDIDA_EJECUTORIEDAD')) requests.push('Que se determine si el acto administrativo sancionatorio perdió fuerza ejecutoria, verificando su firmeza y las actuaciones efectivamente realizadas para ejecutarlo durante el término legal.');
  if (routes.includes('NOTIFICACION') || routes.includes('DEBIDO_PROCESO')) requests.push('Que se aporten las constancias completas de notificación de cada actuación relevante, indicando acto notificado, destinatario, dirección o canal, fecha, medio empleado, constancia de entrega o publicación y recursos procedentes.');
  if (routes.includes('FOTODETECCION')) requests.push('Que se aporte la totalidad de la evidencia de detección tecnológica y de los documentos que sustentaron la individualización e imputación personal de la conducta.');
  if (routes.includes('REVOCATORIA_DIRECTA')) requests.push('Que, si del expediente se desprende una causal legal de revocatoria directa o una irregularidad sustancial que afecte la validez o eficacia de la actuación, se adopte la decisión jurídicamente procedente.');
  requests.push('Que se remita copia íntegra, legible y completa del expediente administrativo, incluyendo orden de comparendo, evidencia, actuaciones de comparecencia, audiencia, resolución sancionatoria, recursos, constancia de ejecutoria, actuaciones de cobro, mandamiento de pago y sus constancias de notificación, si existen.');
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
  const facts = customFacts && !/^no se han incorporado hechos adicionales/i.test(customFacts) ? customFacts : legalDraft.hechos;
  const requests = buildRequests(a, assessment);
  const foundations = legalDraft.fundamentos;
  const problem = foundations.match(/III\. PROBLEMA JURÍDICO\n([\s\S]*?)\n\nIV\. MARCO NORMATIVO/)?.[1] || `Determinar la situación jurídica actual de la actuación No. ${number}, estableciendo la validez, firmeza, ejecutoriedad y exigibilidad de la sanción y, según las fechas acreditadas, la configuración de las causales jurídicas que correspondan.`;
  const framework = foundations.match(/IV\. MARCO NORMATIVO Y JURISPRUDENCIAL DESARROLLADO\n([\s\S]*?)\n\nV\. APLICACIÓN DEL MARCO/)?.[1] || 'El análisis se integra con las disposiciones y precedentes pertinentes identificados por la biblioteca jurídica de TrámiteYa.';
  const application = foundations.match(/V\. APLICACIÓN DEL MARCO JURÍDICO AL CASO CONCRETO\n([\s\S]*?)\n\nVI\. CRONOLOGÍA/)?.[1] || 'La aplicación concreta deberá efectuarse con base en las fechas y documentos que obren en el expediente.';
  const timeline = foundations.match(/VI\. CRONOLOGÍA QUE DEBE SER ACREDITADA\n([\s\S]*?)\n\nVII\. EVIDENCIA/)?.[1] || 'Deberán acreditarse las fechas del hecho, decisión sancionatoria, notificación, firmeza y cobro.';
  const conclusion = foundations.match(/VIII\. CONCLUSIÓN JURÍDICA PRELIMINAR\n([\s\S]*)$/)?.[1] || 'La consecuencia jurídica definitiva dependerá de las actuaciones y fechas acreditadas por la autoridad.';

  return [
    v(a, 'ciudad', 'Sincelejo'), v(a, 'fecha', new Date().toLocaleDateString('es-CO')), '',
    authority.toUpperCase(), 'Dependencia competente', '', title, '',
    `ASUNTO: ${title}`, `REFERENCIA: Comparendo / acto No. ${number} — Fecha: ${date}`, '',
    'SOLICITANTE', name, `C.C. ${v(a, 'documento', record.cedula || 'no identificada')}`,
    v(a, 'correo') ? `Correo electrónico: ${v(a, 'correo')}` : '',
    v(a, 'placa', record.placa) ? `Placa: ${v(a, 'placa', record.placa)}` : '', '',
    'Respetados señores:', '',
    'En ejercicio del derecho fundamental de petición, y con fundamento en las garantías constitucionales y legales aplicables a las actuaciones administrativas sancionatorias, presento la siguiente solicitud de revisión. Su finalidad es que la situación jurídica de la actuación sea determinada a partir del expediente y no mediante presunciones derivadas exclusivamente del Estado de Cuenta SIMIT.', '',
    'I. OBJETO',
    `Solicito que ${route} sea examinada de manera integral, teniendo en cuenta la totalidad de las actuaciones que dieron origen a la sanción y/o a su cobro, y que se adopte la consecuencia jurídica que corresponda conforme a las fechas, actos administrativos y constancias efectivamente acreditados.`, '',
    'II. ANTECEDENTES Y HECHOS', facts, '',
    'III. PROBLEMA JURÍDICO', problem, '',
    'IV. FUNDAMENTOS JURÍDICOS',
    '4.1. Marco normativo y jurisprudencial aplicable', framework, '',
    '4.2. Aplicación de las normas y precedentes al caso concreto', application, '',
    '4.3. Cronología jurídica que debe ser acreditada', timeline, '',
    '4.4. Conclusión jurídica preliminar', conclusion, '',
    'V. PETICIONES', requests.map((item, index) => `${index + 1}. ${item}`).join('\n'), '',
    'VI. PRUEBAS Y DOCUMENTOS',
    'Solicito que se incorporen y remitan los documentos indicados en las peticiones, de manera que pueda reconstruirse la cadena de actuación: hecho → comparendo → comparecencia/audiencia → decisión → notificación → ejecutoria → mandamiento de pago → actuaciones de cobro.', '',
    'VII. ANEXOS', v(a, 'anexos', 'Estado de Cuenta SIMIT aportado por el solicitante.'), '',
    'VIII. NOTIFICACIONES', v(a, 'correo', 'En el correo electrónico informado por el solicitante.'), '',
    'Atentamente,', '', name, `C.C. ${v(a, 'documento', record.cedula || 'no identificada')}`,
  ].join('\n');
}
