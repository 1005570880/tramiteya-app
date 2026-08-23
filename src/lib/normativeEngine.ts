import type { FormAnswers } from '../types/form';

export type NormativeSource = {
  id: string;
  title: string;
  article?: string;
  description: string;
  topics: string[];
  sourceUrl: string;
  authority: string;
  status: 'active' | 'review_required';
};

export type LegalAnalysis = {
  procedureSlug: string;
  norms: NormativeSource[];
  alerts: string[];
  rationale: string[];
};

/** Base normative sources used to structure generated legal documents. */
export const normativeSources: NormativeSource[] = [
  { id: 'cp-1991-art-23', title: 'Constitución Política de Colombia', article: 'Artículo 23', description: 'Reconoce el derecho de toda persona a presentar peticiones respetuosas y obtener pronta resolución.', topics: ['petition'], sourceUrl: 'https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?224=&i=4125', authority: 'Asamblea Nacional Constituyente', status: 'active' },
  { id: 'ley-1755-2015-art-13', title: 'Ley 1755 de 2015', article: 'Artículo 13', description: 'Regula el derecho fundamental de petición y sus modalidades ante autoridades y organizaciones privadas.', topics: ['petition'], sourceUrl: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=65334', authority: 'Congreso de la República', status: 'active' },
  { id: 'ley-1755-2015-art-14', title: 'Ley 1755 de 2015', article: 'Artículo 14', description: 'Establece términos generales y especiales para resolver peticiones, salvo norma especial.', topics: ['petition'], sourceUrl: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=65334', authority: 'Congreso de la República', status: 'active' },
  { id: 'ley-1437-2011', title: 'Ley 1437 de 2011 — CPACA', article: 'Parte Primera', description: 'Contiene reglas generales de las actuaciones y procedimientos administrativos, aplicables según la naturaleza del trámite.', topics: ['petition', 'administrative', 'traffic'], sourceUrl: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=41249', authority: 'Congreso de la República', status: 'active' },
  { id: 'cp-1991-art-86', title: 'Constitución Política de Colombia', article: 'Artículo 86', description: 'Consagra la acción de tutela para la protección inmediata de derechos constitucionales fundamentales.', topics: ['tutela'], sourceUrl: 'https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?224=&i=4125', authority: 'Asamblea Nacional Constituyente', status: 'active' },
  { id: 'decreto-2591-1991', title: 'Decreto 2591 de 1991', article: 'Régimen de la acción de tutela', description: 'Reglamenta la acción de tutela y establece sus reglas procesales básicas.', topics: ['tutela'], sourceUrl: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=5304', authority: 'Presidencia de la República', status: 'active' },
  { id: 'ley-1751-2015', title: 'Ley Estatutaria 1751 de 2015', article: 'Artículos 1 y 2', description: 'Regula el derecho fundamental a la salud y establece su naturaleza autónoma e irrenunciable.', topics: ['health', 'tutela'], sourceUrl: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=60733', authority: 'Congreso de la República', status: 'active' },
  { id: 'ley-769-2002', title: 'Ley 769 de 2002 — Código Nacional de Tránsito Terrestre', article: 'Régimen sancionatorio y actuaciones de tránsito', description: 'Contiene el régimen legal aplicable a las infracciones y actuaciones administrativas de tránsito, según el caso concreto.', topics: ['traffic'], sourceUrl: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=5557', authority: 'Congreso de la República', status: 'active' },
  { id: 'ley-1562-2012', title: 'Ley 1562 de 2012', article: 'Sistema General de Riesgos Laborales', description: 'Modifica el Sistema General de Riesgos Laborales y establece reglas relevantes para la protección frente a riesgos derivados del trabajo.', topics: ['labor'], sourceUrl: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=48365', authority: 'Congreso de la República', status: 'active' },
  { id: 'codigo-sustantivo-trabajo', title: 'Código Sustantivo del Trabajo', article: 'Normas sobre obligaciones laborales', description: 'Conjunto de reglas sustantivas aplicables a las relaciones laborales, según los hechos y pretensiones del reclamo.', topics: ['labor'], sourceUrl: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=33104', authority: 'Congreso de la República', status: 'active' },
  { id: 'codigo-comercio-arrendamiento', title: 'Código de Comercio', article: 'Artículos 518 y siguientes', description: 'Regula aspectos especiales del arrendamiento de locales comerciales y la protección del establecimiento de comercio, cuando resulte aplicable.', topics: ['commercial-lease'], sourceUrl: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=41102', authority: 'Congreso de la República', status: 'active' },
  { id: 'codigo-civil-arrendamiento', title: 'Código Civil', article: 'Régimen del contrato de arrendamiento', description: 'Contiene las reglas civiles generales del contrato de arrendamiento, aplicables en lo pertinente y sin perjuicio de las reglas comerciales especiales.', topics: ['commercial-lease'], sourceUrl: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=39535', authority: 'Congreso de la República', status: 'active' },
  { id: 'cgpc-art-74', title: 'Código General del Proceso', article: 'Artículo 74', description: 'Regula requisitos generales del poder para actuar judicialmente, según corresponda al asunto.', topics: ['power'], sourceUrl: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=48425', authority: 'Congreso de la República', status: 'active' },
];

function text(answers: FormAnswers): string {
  return Object.values(answers).flatMap((value) => Array.isArray(value) ? value : [value]).filter((value): value is string => typeof value === 'string').join(' ').toLowerCase();
}

function classifyProcedure(procedureSlug: string, answers: FormAnswers): Set<string> {
  const slug = procedureSlug.toLowerCase();
  const answerText = text(answers);
  const topics = new Set<string>();
  if (/peticion|petición|reclamacion|reclamación|recurso/.test(slug)) topics.add('petition');
  if (/tutela/.test(slug)) topics.add('tutela');
  if (/salud/.test(slug) || /eps|ips|medic|tratamiento|cirug|salud/.test(answerText)) topics.add('health');
  if (/comparendo|multa|fotomulta|fotodeteccion|fotodetección|transito|tránsito|impugnacion/.test(slug)) topics.add('traffic');
  if (/laboral/.test(slug)) topics.add('labor');
  if (/arrendamiento/.test(slug)) topics.add('commercial-lease');
  if (/poder/.test(slug)) topics.add('power');
  if (topics.has('petition') || topics.has('traffic')) topics.add('administrative');
  return topics;
}

export function analyzeLegalBasis(procedureSlug: string, answers: FormAnswers = {}): LegalAnalysis {
  const topics = classifyProcedure(procedureSlug, answers);
  const norms = normativeSources.filter((norm) => norm.topics.some((topic) => topics.has(topic)));
  const rationale: string[] = [];
  if (topics.has('petition')) rationale.push('El trámite contiene una actuación de petición, reclamación o recurso; se incorporan fuentes constitucionales, legales y administrativas generales pertinentes.');
  if (topics.has('traffic')) rationale.push('El trámite se relaciona con tránsito; se incorpora el Código Nacional de Tránsito como fuente sectorial y el CPACA para las reglas administrativas que correspondan.');
  if (topics.has('tutela')) rationale.push('El documento corresponde a una acción de tutela; se incorporan la Constitución y el Decreto 2591 de 1991 como fuentes básicas.');
  if (topics.has('health')) rationale.push('La materia identificada se relaciona con salud; se incorpora la Ley Estatutaria 1751 de 2015.');
  if (topics.has('labor')) rationale.push('El trámite corresponde a una reclamación laboral; se incorporan el Código Sustantivo del Trabajo y el régimen de riesgos laborales cuando corresponda.');
  if (topics.has('commercial-lease')) rationale.push('El trámite corresponde a un arrendamiento comercial; se incorporan las reglas comerciales especiales y las reglas civiles generales del arrendamiento.');
  if (topics.has('power')) rationale.push('El documento corresponde a un poder; se incorpora el régimen general del poder judicial como referencia cuando el asunto tenga naturaleza judicial.');
  const alerts = [
    'La selección automática de normas es una ayuda de estructuración y no sustituye la revisión jurídica del caso concreto.',
    'Antes de presentar el documento debe verificarse la vigencia, modificaciones, reglamentación sectorial y jurisprudencia aplicable a la fecha de radicación.',
  ];
  return { procedureSlug, norms, alerts, rationale };
}
