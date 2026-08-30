import type { FormAnswers } from '../types/form';
import { generateUnifiedLegalDocument, sanitizeValue, type LegalAssessment, type SelectedRecordData } from './legalEngine';
import { applyTrafficLegalPolicy, routeLabelForPolicy } from './trafficLegalPolicy';

function rawValue(a: FormAnswers, key: string): string {
  const raw = (a as any)[key];
  if (Array.isArray(raw)) return raw.join(', ');
  if (typeof raw === 'boolean') return raw ? 'Sí' : 'No';
  if (raw == null) return '';
  return String(raw).replace(/\s+/g, ' ').trim();
}
function valueOrEmpty(value: unknown): string { if (value == null) return ''; const text = String(value).trim(); return text && !/^no identificado en el documento aportado$/i.test(text) ? text : ''; }
function selectedRecord(a: FormAnswers): SelectedRecordData {
  const source = ((a as any).__simitRecord && typeof (a as any).__simitRecord === 'object') ? (a as any).__simitRecord : {};
  const trami = ((a as any).__tramiQuestionnaire && typeof (a as any).__tramiQuestionnaire === 'object') ? (a as any).__tramiQuestionnaire : {};
  const stored = ((a as any).tramiAnswers && typeof (a as any).tramiAnswers === 'object') ? (a as any).tramiAnswers : {};
  const q = { ...stored, ...trami } as Record<string, any>;
  const pick = (key: string, ...fallbacks: unknown[]) => valueOrEmpty(rawValue(a, key)) || valueOrEmpty(q[key]) || fallbacks.map(valueOrEmpty).find(Boolean) || '';
  return { comparendo: pick('numero_comparendo', source.number), fecha: pick('fecha_comparendo', source.date), organismo: pick('entidad', source.authority, rawValue(a, 'autoridad')), estado: pick('estadoComparendo', source.status), valor: pick('valor', source.value, rawValue(a, 'valor_multa')), placa: pick('placa', source.plate), cedula: pick('documento', q.cedula, source.documentNumber, rawValue(a, 'cedula')), codigo: pick('codigo_infraccion', source.infractionCode, source.code), nombre: pick('nombre', source.name, source.ownerName), correo: pick('correo', source.email), telefono: pick('telefono', source.phone), fechaResolucion: pick('fechaResolucion', source.resolutionDate), fechaNotificacion: pick('fechaNotificacion', source.notificationDate), fechaMandamientoPago: pick('fechaMandamientoPago', source.mandamientoDate, source.paymentOrderDate), fechaNotificacionMandamiento: pick('fechaNotificacionMandamiento', source.paymentOrderNotificationDate), fechaEjecutoria: pick('fechaEjecutoria', source.executedDate), huboAudiencia: (a as any).huboAudiencia ?? (q.audiencia === 'asisti' || q.audiencia === 'no_asisti'), existeResolucion: (a as any).existeResolucion ?? q.resolucion === 'si', actuacionesCobro: pick('actuacionesCobro', q.cobro, source.collectionActions), esFotodetencion: Boolean((a as any).esFotodetencion), tramiAnswers: q, tramiConocimiento: q.conocimiento || '', tramiNotificacion: q.notificacion || '', tramiAudiencia: q.audiencia || '', tramiResolucion: q.resolucion || '', tramiCobro: q.cobro || '', tramiPagos: q.pagos || '', tramiEvidencia: q.evidencia || '' };
}
function assessmentFromAnswers(a: FormAnswers): LegalAssessment | null { const assessment = (a as any).__legalAssessment; return assessment && typeof assessment === 'object' ? assessment as LegalAssessment : null; }
function routeLabel(route: string | null | undefined): string { switch (route) { case 'CADUCIDAD': return 'SOLICITUD DE REVISIÓN DE CADUCIDAD DE LA ACTUACIÓN DE TRÁNSITO'; case 'PRESCRIPCION': return 'SOLICITUD DE PRESCRIPCIÓN DE SANCIÓN Y/O ACCIÓN DE COBRO'; case 'PERDIDA_EJECUTORIEDAD': return 'REVISIÓN DE PÉRDIDA DE FUERZA EJECUTORIA'; case 'FOTODETECCION': return 'REVISIÓN DE ACTUACIÓN DE FOTODETECCIÓN'; case 'NOTIFICACION': return 'REVISIÓN DE NOTIFICACIÓN Y DEBIDO PROCESO'; case 'DEBIDO_PROCESO': return 'DEBIDO PROCESO E INDEBIDA NOTIFICACIÓN DE LA CITACIÓN'; case 'REVOCATORIA_DIRECTA': return 'SOLICITUD DE REVOCATORIA DIRECTA'; default: return 'REVISIÓN INTEGRAL DE LA ACTUACIÓN ADMINISTRATIVA'; } }
function normalizeCitizenValue(value: unknown): string { const text = sanitizeValue(value); const map: Record<string,string> = { no_recuerdo: 'No recuerdo el evento exacto.', no_notificado: 'No he recibido la notificación correspondiente.', no_se: 'No tengo certeza sobre este aspecto.', no_se_resolucion: 'No tengo conocimiento de una resolución.' }; return map[text.toLowerCase()] || text; }
function formatCop(value: unknown): string { if (value == null || String(value).trim() === '') return ''; const numeric = Number(String(value).replace(/[^0-9-]/g, '')); if (!Number.isFinite(numeric)) return String(value).trim(); return `$ ${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(numeric)} COP`; }
function normalizeFirstPerson(output: string): string {
  return output
    .replace(/\bEl solicitante manifiesta que no recibió\b/gi, 'No recibí')
    .replace(/\bEl solicitante manifiesta que no recuerda\b/gi, 'No recuerdo')
    .replace(/\bEl solicitante manifiesta no recordar\b/gi, 'No recuerdo')
    .replace(/\bEl solicitante manifiesta no haber recibido\b/gi, 'No he recibido')
    .replace(/\bEl solicitante manifiesta no tener conocimiento\b/gi, 'No tengo conocimiento')
    .replace(/\bEl solicitante manifiesta:\s*/gi, 'Manifiesto: ')
    .replace(/\bEl solicitante indica que conoció\b/gi, 'Indico que conocí')
    .replace(/\bEl solicitante indica\b/gi, 'Indico')
    .replace(/\bEl solicitante identificado para el trámite es\b/gi, 'Soy')
    .replace(/\bLa actuación aparece asociada al documento de identidad No\.\s*/gi, 'La actuación está asociada a mi documento de identidad No. ')
    .replace(/\bEl solicitante reporta una actuación de cobro\b/gi, 'Tengo registrado un antecedente de actuación de cobro')
    .replace(/\bEl solicitante\b/gi, 'Yo')
    .replace(/\bEl ciudadano\b/gi, 'Yo')
    .replace(/\bLa persona interesada\b/gi, 'Yo');
}
function normalizeTrafficDocument(content: string, record: SelectedRecordData, assessment: LegalAssessment): string {
  let output = content;
  const citizenTokens: Record<string,string> = { no_recuerdo: 'No recuerdo el evento exacto.', no_notificado: 'No he recibido la notificación correspondiente.', no_se: 'No tengo certeza sobre este aspecto.', no_se_resolucion: 'No tengo conocimiento de una resolución.' };
  for (const [token,replacement] of Object.entries(citizenTokens)) output = output.replace(new RegExp(`\\b${token}\\b`,'gi'), replacement);
  if (record.valor) {
    const currency = formatCop(record.valor);
    const escaped = String(record.valor).replace(/[.*+?^${}()|[\\]\\\\]/g,'\\$&');
    output = output.replace(new RegExp(`(valor(?: reportado)?(?: para la obligación)?(?: es|:)\\s*)${escaped}`,'gi'), `$1${currency}`).replace(new RegExp(`\\$\\s*${escaped}`,'g'), currency);
  }
  output = output.replace(/(conocí por primera vez la actuación:\s*)simit\.?/gi, '$1al consultar directamente la plataforma del SIMIT.');
  const policyLabel = routeLabelForPolicy(assessment.primaryRoute);
  if (policyLabel) output = output.replace(/SOLICITUD DE REVISIÓN DE CADUCIDAD DE LA ACTUACIÓN DE TRÁNSITO|SOLICITUD DE PRESCRIPCIÓN DE SANCIÓN Y\/O ACCIÓN DE COBRO|REVISIÓN DE NOTIFICACIÓN Y DEBIDO PROCESO|REVISIÓN INTEGRAL DE LA ACTUACIÓN ADMINISTRATIVA/g, policyLabel);
  if (assessment.primaryRoute === 'DEBIDO_PROCESO') {
    const marker='I. IDENTIFICACIÓN Y CONTACTO';
    const insertion='El término aplicable debe analizarse a partir de las actuaciones administrativas efectivamente acreditadas. Por tratarse de una actuación cuya fecha del hecho es inferior a un año, no planteo caducidad ni prescripción como vía principal. Mi solicitud se concentra en el debido proceso y en la notificación de la citación, incluida mi oportunidad real de ejercer defensa, sin afirmar hechos que deban acreditarse en el expediente.\n\nII. ENFOQUE JURÍDICO — DEBIDO PROCESO Y NOTIFICACIÓN\n\nSolicito que la autoridad acredite documentalmente la citación, sus constancias de notificación y las actuaciones que me permitieron conocer y controvertir la actuación, de conformidad con el régimen de tránsito aplicable.';
    if(!output.includes('II. ENFOQUE JURÍDICO — DEBIDO PROCESO Y NOTIFICACIÓN')) output=output.replace(marker,`${insertion}\n\n${marker}`);
  }
  output = normalizeFirstPerson(output);
  output = output.replace(/(VALOR REPORTADO:\s*\$?\s*[0-9][0-9.,]*\s*(?:COP)?)(\s*)(?=Yo,)/gi, '$1\n\n');
  return output.replace(/\n{3,}/g,'\n\n').replace(/\.{2,}/g,'.').trim();
}
export function buildTrafficDocument(slug: string, a: FormAnswers): string {
  const record=selectedRecord(a); const baseDraft=generateUnifiedLegalDocument(record); const baseAssessment=assessmentFromAnswers(a)||baseDraft.assessment; const assessment=applyTrafficLegalPolicy(record,baseAssessment); const route=assessment.primaryRoute||(slug.includes('caducidad')?'CADUCIDAD':slug.includes('prescripcion')?'PRESCRIPCION':null); const authority=valueOrEmpty(rawValue(a,'entidad'))||record.organismo||'AUTORIDAD DE TRÁNSITO COMPETENTE'; const applicant=valueOrEmpty(rawValue(a,'nombre'))||valueOrEmpty(`${rawValue(a,'nombres')} ${rawValue(a,'apellidos')}`)||record.nombre; const cedula=valueOrEmpty(rawValue(a,'documento'))||record.cedula; const email=valueOrEmpty(rawValue(a,'correo'))||record.correo; const phone=valueOrEmpty(rawValue(a,'telefono'))||record.telefono; const number=valueOrEmpty(rawValue(a,'numero_comparendo'))||record.comparendo; const date=valueOrEmpty(rawValue(a,'fecha_comparendo'))||record.fecha; const dateDocument=valueOrEmpty(rawValue(a,'fecha'))||new Date().toLocaleDateString('es-CO');
  if(baseDraft.document&&baseDraft.document.length>500)return normalizeTrafficDocument(baseDraft.document,record,assessment);
  return normalizeTrafficDocument([dateDocument,'',authority.toUpperCase(),'','DERECHO DE PETICIÓN — '+routeLabel(route),'','ASUNTO: DERECHO DE PETICIÓN — '+routeLabel(route),'',`REFERENCIA: Comparendo / acto No. ${number}${date?` — Fecha: ${date}`:''}`,'',`Yo, ${normalizeCitizenValue(applicant)}, identificado con cédula de ciudadanía No. ${sanitizeValue(cedula)}, actuando en nombre propio, presento respetuosamente este derecho de petición.`,'','Respetados señores:','','Solicito que se revise integralmente la situación jurídica de la actuación que me afecta, con base en el expediente administrativo y las pruebas que deben reposar en él.','','I. IDENTIFICACIÓN Y CONTACTO','','Nombre: '+sanitizeValue(applicant),'Cédula: '+sanitizeValue(cedula),'Correo electrónico: '+sanitizeValue(email),'Teléfono: '+sanitizeValue(phone),'','II. PETICIONES','','PRIMERO: Que se entregue copia íntegra del expediente administrativo y de las constancias de notificación, sanción, ejecutoria y cobro que correspondan.','','Atentamente,','',sanitizeValue(applicant),`C.C. No. ${sanitizeValue(cedula)}`,`Correo electrónico: ${sanitizeValue(email)}`,`Teléfono: ${sanitizeValue(phone)}`].join('\n'),record,assessment);
}
