import type { FormAnswers } from '../types/form';
import type { Procedure } from '../types';
import type { DocumentItem } from '../types/procedure';
import { assessLegalSituation, generateUnifiedLegalDocument, sanitizeValue, type SelectedRecordData } from './legalEngine';
import { evaluateTrafficCase } from './legalRules';

const TRAFFIC_SLUGS = new Set([
  'prescripcion-comparendo',
  'caducidad-comparendo',
  'revocatoria-comparendo',
  'solicitud-soportes-comparendo',
  'fotomultas',
  'derecho-de-peticion-eliminar-multa',
]);

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function pick(...values: unknown[]): string | undefined {
  return values.find((value) => value !== undefined && value !== null && sanitizeValue(value) !== '');
}

function toRecord(answers: FormAnswers): SelectedRecordData {
  const a = answers as FormAnswers & Record<string, any>;
  const simit = objectValue(a.__simitRecord);
  const questionnaire = objectValue(a.__tramiQuestionnaire || a.tramiAnswers);
  const record: SelectedRecordData = {
    comparendo: pick(a.numero_comparendo, simit.number),
    fecha: pick(a.fecha_comparendo, simit.date),
    organismo: pick(a.entidad, a.autoridad, simit.authority),
    estado: pick(a.estadoComparendo, a.estado, simit.status),
    valor: pick(a.valor, a.valor_multa, simit.value),
    placa: pick(a.placa, simit.plate),
    cedula: pick(a.documento, a.documentNumber, a.cedula, simit.documentNumber),
    codigo: pick(a.codigo_infraccion, a.codigoInfraccion, simit.infractionCode, simit.code),
    nombre: pick(a.nombre, a.nombreCompleto, simit.ownerName, simit.name),
    correo: pick(a.correo, a.email, simit.email),
    telefono: pick(a.telefono, a.phone, simit.phone),
    fechaResolucion: pick(a.fechaResolucion, a.fecha_resolucion, simit.resolutionDate),
    fechaNotificacion: pick(a.fechaNotificacion, a.fecha_notificacion, simit.notificationDate),
    fechaMandamientoPago: pick(a.fechaMandamientoPago, a.fecha_mandamiento_pago, simit.mandamientoDate, simit.paymentOrderDate),
    fechaNotificacionMandamiento: pick(a.fechaNotificacionMandamiento, a.fecha_notificacion_mandamiento, simit.paymentOrderNotificationDate),
    fechaEjecutoria: pick(a.fechaEjecutoria, a.fecha_ejecutoria, simit.executedDate),
    huboAudiencia: a.huboAudiencia ?? a.hubo_audiencia ?? questionnaire.audiencia,
    existeResolucion: a.existeResolucion ?? a.existe_resolucion ?? questionnaire.resolucion,
    actuacionesCobro: pick(a.actuacionesCobro, questionnaire.cobro, simit.collectionActions),
    esFotodetencion: Boolean(a.esFotodetencion || /foto|fotomult|fotodetecci[oó]n|c[aá]mara/i.test(String(questionnaire.causal || questionnaire.causal_principal || a.causal || '')) || String(a.codigoInfraccion || simit.infractionCode || '').toUpperCase() === 'C35'),
    tramiAnswers: questionnaire,
    tramiConocimiento: sanitizeValue(questionnaire.conocimiento),
    tramiNotificacion: sanitizeValue(questionnaire.notificacion),
    tramiAudiencia: sanitizeValue(questionnaire.audiencia),
    tramiResolucion: sanitizeValue(questionnaire.resolucion),
    tramiCobro: sanitizeValue(questionnaire.cobro),
    tramiPagos: sanitizeValue(questionnaire.pagos),
    tramiEvidencia: sanitizeValue(questionnaire.evidencia),
  };
  return record;
}

function enrich(answers: FormAnswers): FormAnswers {
  const normalized = { ...(answers as any) } as FormAnswers & Record<string, any>;
  const record = toRecord(normalized);
  const assessment = assessLegalSituation(record);
  const decisions = evaluateTrafficCase(normalized);
  normalized.__legalAssessment = assessment;
  normalized.__legalDecisionEngine = {
    version: 4,
    generatedAt: new Date().toISOString(),
    primaryRoute: assessment.primaryRoute,
    routes: assessment.routes,
    certainty: assessment.certainty,
    decisions,
    evidenceQuestions: assessment.evidenceQuestions,
    missingEvidence: assessment.missingEvidence,
    temporal: assessment.temporal,
  };
  return normalized;
}

export async function generateStrictTrafficDocument(procedure: Procedure, answers: FormAnswers, instanceId?: string): Promise<DocumentItem> {
  if (!TRAFFIC_SLUGS.has(procedure.slug)) {
    throw new Error(`STRICT_TRAFFIC_GENERATOR_UNSUPPORTED_SLUG: ${procedure.slug}`);
  }

  const enriched = enrich(answers);
  const record = toRecord(enriched);
  const draft = generateUnifiedLegalDocument(record);
  const content = draft.document?.trim();

  if (!content || content.length < 500) {
    throw new Error('STRICT_LEGAL_ENGINE_EMPTY_DOCUMENT: la biblioteca jurídica no produjo un documento completo.');
  }

  const generatedAt = new Date().toISOString();
  const version = 1;
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
    sourceVersion: 'legal-engine-v4',
    snapshot: {
      answers: JSON.parse(JSON.stringify(enriched)),
      procedureSlug: procedure.slug,
      generatedAt,
      content,
      legalAssessment: draft.assessment,
      authorities: draft.authorities,
    },
  };
}
