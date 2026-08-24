import type { FormAnswers } from '../types/form';

export type LegalIssueSeverity = 'blocker' | 'warning';

export type LegalIssue = {
  code: string;
  severity: LegalIssueSeverity;
  field?: string;
  message: string;
};

export type LegalQualityResult = {
  passed: boolean;
  score: number;
  errors: LegalIssue[];
  warnings: LegalIssue[];
  missingFields: string[];
  detectedCausals: string[];
  recommendedQuestions: string[];
};

const text = (answers: FormAnswers, key: string) => {
  const value = answers[key];
  if (Array.isArray(value)) return value.join(', ').trim();
  if (typeof value === 'string') return value.trim();
  return '';
};

const wordCount = (value: string) => value ? value.split(/\s+/).filter(Boolean).length : 0;
const hasDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

function scoreText(value: string, minimumWords: number) {
  if (!value) return 0;
  const words = wordCount(value);
  if (words >= minimumWords) return 100;
  return Math.round((words / minimumWords) * 100);
}

export function evaluatePetitionLegalQuality(answers: FormAnswers): LegalQualityResult {
  const errors: LegalIssue[] = [];
  const warnings: LegalIssue[] = [];
  const missingFields: string[] = [];
  const recommendedQuestions: string[] = [];
  const detectedCausals: string[] = [];

  const hechos = text(answers, 'hechos');
  const solicitud = text(answers, 'solicitud');
  const asunto = text(answers, 'asunto');
  const entidad = text(answers, 'entidad');
  const fecha = text(answers, 'fecha');
  const radicado = text(answers, 'radicado');
  const fechaPeticion = text(answers, 'fecha_peticion');
  const respuesta = text(answers, 'respuesta_entidad');
  const tipo = text(answers, 'tipo_situacion');

  if (wordCount(hechos) < 25) {
    errors.push({ code: 'HECHOS_INSUFICIENTES', severity: 'blocker', field: 'hechos', message: 'Describe los hechos con mayor precisión: qué ocurrió, cuándo ocurrió, qué entidad intervino y cuál fue la afectación o situación concreta.' });
    missingFields.push('hechos_suficientes');
  } else if (wordCount(hechos) < 60) {
    warnings.push({ code: 'HECHOS_BREVES', severity: 'warning', field: 'hechos', message: 'El relato es breve. Verifica que incluya fechas, actuaciones de la entidad y circunstancias relevantes.' });
  }

  if (wordCount(solicitud) < 8) {
    errors.push({ code: 'SOLICITUD_INDETERMINADA', severity: 'blocker', field: 'solicitud', message: 'La solicitud debe indicar de forma concreta qué actuación, información, documento o respuesta espera obtener.' });
    missingFields.push('solicitud_concreta');
  }

  if (!entidad) {
    errors.push({ code: 'DESTINATARIO_AUSENTE', severity: 'blocker', field: 'entidad', message: 'Identifica la entidad, autoridad o persona destinataria.' });
    missingFields.push('entidad');
  }

  if (!asunto || wordCount(asunto) < 3) {
    warnings.push({ code: 'ASUNTO_POCO_ESPECIFICO', severity: 'warning', field: 'asunto', message: 'Conviene formular un asunto que identifique claramente el objeto de la petición.' });
  }

  const lower = `${hechos} ${solicitud} ${tipo}`.toLowerCase();
  const priorPetition = /petici[oó]n anterior|ya present[eé]|radicad[oa]|no me han respondido|sin respuesta/.test(lower);
  const documents = /documentos?|copias?|expediente|soportes?|certificad[oa]s?/.test(lower);
  const information = /informaci[oó]n|datos|respuesta/.test(lower);
  const complaint = /reclamo|queja|inconformidad|irregularidad/.test(lower);

  if (priorPetition) {
    detectedCausals.push('FALTA_O_DEFICIENCIA_DE_RESPUESTA');
    if (!radicado) {
      errors.push({ code: 'RADICADO_FALTANTE', severity: 'blocker', field: 'radicado', message: 'Indica el número de radicado de la petición anterior cuando exista.' });
      missingFields.push('radicado');
      recommendedQuestions.push('¿Cuál fue el número de radicado de la petición anterior?');
    }
    if (!fechaPeticion || !hasDate(fechaPeticion)) {
      errors.push({ code: 'FECHA_PETICION_FALTANTE', severity: 'blocker', field: 'fecha_peticion', message: 'Indica la fecha en que fue presentada la petición anterior.' });
      missingFields.push('fecha_peticion');
      recommendedQuestions.push('¿En qué fecha presentaste la petición anterior?');
    }
    if (!respuesta) {
      warnings.push({ code: 'RESPUESTA_NO_DESCRITA', severity: 'warning', field: 'respuesta_entidad', message: 'Aclara si la entidad nunca respondió, respondió tarde o respondió de manera incompleta/evasiva.' });
      recommendedQuestions.push('¿La entidad respondió? Si respondió, ¿qué contestó y cuándo?');
    }
  }

  if (documents) detectedCausals.push('SOLICITUD_DE_DOCUMENTOS_O_SOPORTES');
  else if (information) detectedCausals.push('SOLICITUD_DE_INFORMACION');
  if (complaint) detectedCausals.push('RECLAMACION_O_INCONFORMIDAD');
  if (!detectedCausals.length) detectedCausals.push('PETICION_GENERAL');

  if (!fecha) {
    warnings.push({ code: 'FECHA_DOCUMENTO_AUSENTE', severity: 'warning', field: 'fecha', message: 'La fecha del documento se completará al generar si no se suministra.' });
  }

  const coherenceDateWords = /(ayer|hoy|mañana|la semana pasada|hace unos meses)/i.test(hechos);
  if (coherenceDateWords && !/\d{4}|\d{1,2}[/-]\d{1,2}/.test(hechos)) {
    warnings.push({ code: 'TEMPORALIDAD_IMPRECISA', severity: 'warning', field: 'hechos', message: 'El relato usa referencias temporales imprecisas. Siempre que sea posible, incorpora fechas concretas.' });
  }

  const scores = [
    scoreText(hechos, 25),
    scoreText(solicitud, 8),
    entidad ? 100 : 0,
    asunto && wordCount(asunto) >= 3 ? 100 : 60,
    radicado || fechaPeticion || documents ? 100 : 70,
  ];
  const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  return {
    passed: errors.length === 0,
    score,
    errors,
    warnings,
    missingFields: [...new Set(missingFields)],
    detectedCausals: [...new Set(detectedCausals)],
    recommendedQuestions: [...new Set(recommendedQuestions)],
  };
}

export function evaluateLegalQuality(procedureSlug: string, answers: FormAnswers): LegalQualityResult {
  if (procedureSlug === 'derecho-de-peticion') return evaluatePetitionLegalQuality(answers);
  return { passed: true, score: 100, errors: [], warnings: [], missingFields: [], detectedCausals: [], recommendedQuestions: [] };
}
