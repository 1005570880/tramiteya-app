import type { FormAnswers } from '../types/form';
import type { Procedure } from '../types';
import type { DocumentItem } from '../types/procedure';
import { assessLegalSituation, generateUnifiedLegalDocument, sanitizeValue, type SelectedRecordData } from './legalEngine';
import { evaluateTrafficCase } from './legalRules';

const TRAFFIC_SLUGS = new Set(['prescripcion-comparendo','caducidad-comparendo','revocatoria-comparendo','solicitud-soportes-comparendo','fotomultas','derecho-de-peticion-eliminar-multa']);
function objectValue(value: unknown): Record<string, any> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}; }
function pick(...values: unknown[]): string | undefined { const value = values.find((candidate) => candidate !== undefined && candidate !== null && sanitizeValue(candidate) !== ''); return value === undefined || value === null ? undefined : sanitizeValue(value); }
function normalizeAuthority(value: unknown, municipality: unknown): string | undefined { const authority = sanitizeValue(value); const city = sanitizeValue(municipality); if (/SANTA\s*MARTA/i.test(city)) return 'SECRETARÍA DE TRÁNSITO Y MOVILIDAD DEL DISTRITO DE SANTA MARTA'; if (!authority) return city ? `SECRETARÍA DE TRÁNSITO Y TRANSPORTE MUNICIPAL DE ${city.toUpperCase()}` : undefined; const upper = authority.toUpperCase(); if (/SECRETAR[IÍ]A|INSPECCI[ÓO]N|ORGANISMO DE TR[AÁ]NSITO|TR[AÁ]NSITO Y MOVILIDAD|TR[AÁ]NSITO Y TRANSPORTE/.test(upper)) return authority.toUpperCase(); return city ? `SECRETARÍA DE TRÁNSITO Y TRANSPORTE MUNICIPAL DE ${city.toUpperCase()}` : authority.toUpperCase(); }
function toRecord(answers: FormAnswers): SelectedRecordData { const a = answers as FormAnswers & Record<string, any>; const simit = objectValue(a.__simitRecord); const questionnaire = objectValue(a.__tramiQuestionnaire || a.tramiAnswers); const municipality = pick(a.ciudad, a.municipio, simit.municipality); return { comparendo: pick(a.numero_comparendo, simit.number), fecha: pick(a.fecha_comparendo, simit.date), organismo: normalizeAuthority(pick(a.entidad, a.autoridad, simit.authority), municipality), estado: pick(a.estadoComparendo, a.estado, simit.status), valor: pick(a.valor, a.valor_multa, simit.value), placa: pick(a.placa, simit.plate), cedula: pick(a.documento, a.documentNumber, a.cedula, simit.documentNumber), codigo: pick(a.codigo_infraccion, a.codigoInfraccion, simit.infractionCode, simit.code), nombre: pick(a.nombre, a.nombreCompleto, simit.ownerName, simit.name), correo: pick(a.correo, a.email, simit.email), telefono: pick(a.telefono, a.phone, simit.phone), fechaResolucion: pick(a.fechaResolucion, a.fecha_resolucion, simit.resolutionDate), fechaNotificacion: pick(a.fechaNotificacion, a.fecha_notificacion, simit.notificationDate), fechaMandamientoPago: pick(a.fechaMandamientoPago, a.fecha_mandamiento_pago, simit.mandamientoDate, simit.paymentOrderDate), fechaNotificacionMandamiento: pick(a.fechaNotificacionMandamiento, a.fecha_notificacion_mandamiento, simit.paymentOrderNotificationDate), fechaEjecutoria: pick(a.fechaEjecutoria, a.fecha_ejecutoria, simit.executedDate), huboAudiencia: a.huboAudiencia ?? a.hubo_audiencia ?? questionnaire.audiencia, existeResolucion: a.existeResolucion ?? a.existe_resolucion ?? questionnaire.resolucion, actuacionesCobro: pick(a.actuacionesCobro, questionnaire.cobro, simit.collectionActions), esFotodetencion: Boolean(a.esFotodetencion || /foto|fotomult|fotodetecci[oó]n|c[aá]mara/i.test(String(questionnaire.causal || questionnaire.causal_principal || a.causal || '')) || String(a.codigoInfraccion || simit.infractionCode || '').toUpperCase() === 'C35'), tramiAnswers: questionnaire, tramiConocimiento: sanitizeValue(questionnaire.conocimiento), tramiNotificacion: sanitizeValue(questionnaire.notificacion), tramiAudiencia: sanitizeValue(questionnaire.audiencia), tramiResolucion: sanitizeValue(questionnaire.resolucion), tramiCobro: sanitizeValue(questionnaire.cobro), tramiPagos: sanitizeValue(questionnaire.pagos), tramiEvidencia: sanitizeValue(questionnaire.evidencia) }; }

const ORDINALS = ['PRIMERO','SEGUNDO','TERCERO','CUARTO','QUINTO','SEXTO','SÉPTIMO','OCTAVO','NOVENO','DÉCIMO','UNDÉCIMO','DUODÉCIMO','DECIMOTERCERO','DECIMOCUARTO','DECIMOQUINTO','DECIMOSEXTO','DECIMOSÉPTIMO','DECIMOCTAVO','DECIMONOVENO','VIGÉSIMO'];
function cleanCitizenLanguage(content: string): string {
  return content
    .replace(/La v[ií]a principal identificada por Tr[aá]mi es\s*/gi, '')
    .replace(/Tr[aá]mi no presenta esa fecha como prescripci[oó]n configurada:?/gi, 'La configuración de la prescripción depende de la cronología y de las actuaciones jurídicamente eficaces acreditadas.')
    .replace(/Tr[aá]mi(?:\s+determinar[aá]|\s+identific[aó]|\s+eval[uú]a|\s+consider[aó])[^.]*\.?/gi, '')
    .replace(/\bTr[aá]mi\b/gi, '')
    .replace(/triaje(?:\s+conversacional)?/gi, '')
    .replace(/\bno_recuerdo\b/gi, 'no fui notificado formalmente por la autoridad')
    .replace(/\bsolo_simit\b/gi, 'el único documento disponible al momento de esta petición es el Estado de Cuenta del SIMIT')
    .replace(/El solicitante identificado para el tr[aá]mite es ([^.]+)\./gi, 'Me identifico como $1.')
    .replace(/El solicitante manifiesta que no recibió/gi, 'Manifiesto que no recibí')
    .replace(/El solicitante indica que conoci[oó] por primera vez la actuaci[oó]n:/gi, 'Indico que conocí por primera vez la actuación:')
    .replace(/El solicitante reporta una actuaci[oó]n de cobro/gi, 'Manifiesto que he identificado una actuación de cobro')
    .replace(/El solicitante manifiesta:/gi, 'Manifiesto:')
    .replace(/El solicitante se[nñ]ala:/gi, 'Señalo:')
    .replace(/El solicitante indica:/gi, 'Indico:')
    .replace(/El solicitante reporta:/gi, 'Manifiesto:')
    .replace(/El solicitante/gi, 'Yo')
    .replace(/\n{3,}/g, '\n\n').trim();
}
function isListLine(line: string): boolean { return /^\s*(?:\d{1,2}[.)]|[A-ZÁÉÍÓÚÑ][.)])\s+/.test(line); }
function ordinalizeSections(content: string): string {
  const lines = content.split('\n'); let section: 'facts'|'requests'|null = null; let index = 0;
  return lines.map((line) => {
    const normalized = line.trim().toUpperCase().replace(/\s+/g,' ');
    if (/^(?:I{0,3}|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII)\.\s*(?:HECHOS|PRETENSIONES|PETICIONES)\b/.test(normalized) || /^(?:HECHOS|PRETENSIONES|PETICIONES)\b/.test(normalized)) { section = /HECHOS/.test(normalized) ? 'facts' : 'requests'; index = 0; return line; }
    if (/^[IVXLCDM]+\.\s+/.test(normalized) && !/^(?:HECHOS|PRETENSIONES|PETICIONES)\b/.test(normalized)) section = null;
    if (section && isListLine(line)) { const body = line.trim().replace(/^\s*(?:\d{1,2}[.)]|[A-ZÁÉÍÓÚÑ][.)])\s+/, ''); const ordinal = ORDINALS[index] || `NÚMERO ${index + 1}`; index += 1; return `${ordinal}: ${body}`; }
    return line;
  }).join('\n');
}
function sanitizeQuestionnaireNarrative(content: string, record: SelectedRecordData): string {
  const comparendo = sanitizeValue(record.comparendo) || 'la actuación de tránsito';
  return content
    .replace(/Frente a la oportunidad de defensa,\s*(?:el solicitante\s*)?manifiesta:\s*(.+?)(?=\.|\n|$)/gi, (_m, value) => {
      const v = String(value).trim();
      if (/^(nunca|no)$/i.test(v)) return `Manifiesto que no se me garantizó el derecho a la defensa ni fui citado a audiencia pública antes de la imposición del comparendo No. ${comparendo}.`;
      if (/^si$/i.test(v)) return `Manifiesto que tuve oportunidad de ejercer mi derecho de defensa frente al comparendo No. ${comparendo}.`;
      return `Manifiesto, en relación con mi derecho de defensa frente al comparendo No. ${comparendo}, que ${v.charAt(0).toLowerCase()}${v.slice(1)}.`;
    })
    .replace(/Respecto de pagos(?:\s+o acuerdos)?,\s*(?:el solicitante\s*)?manifiesta:\s*(.+?)(?=\.|\n|$)/gi, (_m, value) => {
      const v = String(value).trim();
      if (/^completo$/i.test(v)) return 'Indico que no he realizado acuerdos de pago que impliquen renuncia a los términos normativos de notificación o prescripción.';
      if (/^(nunca|no)$/i.test(v)) return 'Manifiesto que no he realizado pagos ni acuerdos de pago relacionados con la obligación discutida.';
      return `Indico que, respecto de pagos o acuerdos relacionados con la obligación, ${v.charAt(0).toLowerCase()}${v.slice(1)}.`;
    })
    .replace(/(?:El solicitante|La solicitante)\s+(?:indica|manifiesta|señala)\s+que\s+/gi, 'Manifiesto que ')
    .replace(/(?:El solicitante|La solicitante)\s+reporta\s+/gi, 'Manifiesto que ')
    .replace(/\bEl peticionario\b/gi, 'Yo')
    .replace(/\bLa persona solicitante\b/gi, 'Yo')
    .replace(/\bEl solicitante\b/gi, 'Yo')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
function canonicalHeader(authority: string | undefined, municipality: string | undefined): string[] {
  const city = sanitizeValue(municipality).toUpperCase();
  let target = normalizeAuthority(authority, city) || 'AUTORIDAD DE TRÁNSITO COMPETENTE';
  if (/SANTA\s*MARTA/i.test(city)) target = 'SECRETARÍA DE TRÁNSITO Y MOVILIDAD DEL DISTRITO DE SANTA MARTA';
  return ['SEÑORES', target, 'E. S. D.'];
}
function stripAllExistingHeaders(content: string, authority: string | undefined, municipality: string | undefined): string {
  const city = sanitizeValue(municipality).toUpperCase(); const rawAuthority = sanitizeValue(authority).toUpperCase();
  const lines = content.split('\n');
  return lines.filter(line => {
    const t = line.trim();
    if (/^SEÑORES:?$/i.test(t) || /^E\.\s*S\.\s*D\.?$/i.test(t)) return false;
    if (rawAuthority && t.toUpperCase() === rawAuthority) return false;
    if (city && new RegExp(`^${city.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}(?:\\s*,.*)?$`,'i').test(t)) return false;
    if (/^(SECRETAR[IÍ]A|INSPECCI[ÓO]N|ORGANISMO DE TR[AÁ]NSITO|DIRECCI[ÓO]N DE TR[AÁ]NSITO)/i.test(t)) return false;
    return true;
  }).join('\n').replace(/^\s*\n+/, '').trim();
}
function enforceFirstPerson(content: string): string { return content.replace(/\bSe reporta\b/gi,'Manifiesto que se reporta').replace(/\bEl registro identifica\b/gi,'Identifico en el registro').replace(/\bLa actuación aparece asociada\b/gi,'La actuación aparece asociada a mi documento').replace(/\bEl valor reportado\b/gi,'El valor que figura reportado').replace(/\bdebe verificarse\b/gi,'solicito que se verifique').replace(/\bdeben verificarse\b/gi,'solicito que se verifiquen').replace(/\bdebe establecerse documentalmente\b/gi,'solicito que se establezca documentalmente').replace(/\bdebe confrontarse\b/gi,'solicito que se confronte').replace(/\bdeben ser verificadas\b/gi,'solicito que sean verificadas').replace(/\bEl solicitante\b/gi,'Yo'); }
function applyStrictLegalStyle(content: string, record: SelectedRecordData, authority: string | undefined, municipality: string | undefined): string {
  let styled = cleanCitizenLanguage(content);
  styled = sanitizeQuestionnaireNarrative(styled, record);
  styled = enforceFirstPerson(styled);
  styled = ordinalizeSections(styled);
  styled = stripAllExistingHeaders(styled, authority, municipality);
  const body = styled.replace(/^\s*(?:\d{1,2}[\/-])\d{1,2}[\/-]\d{4}\s*\n?/, '').trim();
  return `${canonicalHeader(authority, municipality).join('\n')}\n\n${body}`.replace(/\n{3,}/g,'\n\n').trim();
}
function enrich(answers: FormAnswers): FormAnswers { const normalized = { ...(answers as any) } as FormAnswers & Record<string, any>; const record = toRecord(normalized); const assessment = assessLegalSituation(record); const decisions = evaluateTrafficCase(normalized); normalized.__legalAssessment = assessment; normalized.__legalDecisionEngine = { version: 6, generatedAt: new Date().toISOString(), primaryRoute: assessment.primaryRoute, routes: assessment.routes, certainty: assessment.certainty, decisions, evidenceQuestions: assessment.evidenceQuestions, missingEvidence: assessment.missingEvidence, temporal: assessment.temporal }; return normalized; }
export async function generateStrictTrafficDocument(procedure: Procedure, answers: FormAnswers, instanceId?: string): Promise<DocumentItem> { if (!TRAFFIC_SLUGS.has(procedure.slug)) throw new Error(`STRICT_TRAFFIC_GENERATOR_UNSUPPORTED_SLUG: ${procedure.slug}`); const enriched = enrich(answers); const record = toRecord(enriched); const draft = generateUnifiedLegalDocument(record); const authority = pick((enriched as any).entidad, (enriched as any).autoridad, objectValue((enriched as any).__simitRecord).authority, record.organismo); const municipality = pick((enriched as any).municipio, (enriched as any).ciudad, objectValue((enriched as any).__simitRecord).municipality); const content = applyStrictLegalStyle(draft.document?.trim() || '', record, authority, municipality); if (!content || content.length < 500) throw new Error('STRICT_LEGAL_ENGINE_EMPTY_DOCUMENT: la biblioteca jurídica no produjo un documento completo.'); const generatedAt = new Date().toISOString(); return { id: `doc_${Date.now()}_${Math.floor(Math.random() * 10000)}`, title: `${procedure.title} - Documento generado`, procedureId: procedure.id, content, createdAt: generatedAt, generatedAt, version: 1, status: 'ready', instanceId, sourceVersion: 'legal-engine-v7-style', snapshot: { answers: JSON.parse(JSON.stringify(enriched)), procedureSlug: procedure.slug, generatedAt, content } }; }
