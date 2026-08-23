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

export const normativeSources: NormativeSource[] = [
  {
    id: 'cp-1991-art-23',
    title: 'Constitución Política de Colombia',
    article: 'Artículo 23',
    description: 'Reconoce el derecho de toda persona a presentar peticiones respetuosas y obtener pronta resolución.',
    topics: ['derecho-peticion', 'peticiones', 'autoridades'],
    sourceUrl: 'https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?224=&i=4125',
    authority: 'Asamblea Nacional Constituyente',
    status: 'active',
  },
  {
    id: 'ley-1755-2015',
    title: 'Ley 1755 de 2015',
    article: 'Artículo 13',
    description: 'Regula el derecho fundamental de petición y sus modalidades ante autoridades y organizaciones privadas.',
    topics: ['derecho-peticion', 'informacion', 'copias', 'quejas', 'reclamos', 'recursos'],
    sourceUrl: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=65334',
    authority: 'Congreso de la República',
    status: 'active',
  },
  {
    id: 'ley-1755-2015-terminos',
    title: 'Ley 1755 de 2015',
    article: 'Artículo 14',
    description: 'Establece términos generales y especiales para resolver peticiones, salvo norma especial.',
    topics: ['derecho-peticion', 'terminos', 'informacion', 'documentos'],
    sourceUrl: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=65334',
    authority: 'Congreso de la República',
    status: 'active',
  },
  {
    id: 'ley-1751-2015',
    title: 'Ley Estatutaria 1751 de 2015',
    article: 'Artículos 1 y 2',
    description: 'Regula el derecho fundamental a la salud y establece su naturaleza autónoma e irrenunciable.',
    topics: ['salud', 'derecho-fundamental', 'tutela'],
    sourceUrl: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=60733',
    authority: 'Congreso de la República',
    status: 'active',
  },
];

function text(answers: FormAnswers): string {
  return Object.values(answers)
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

export function analyzeLegalBasis(procedureSlug: string, answers: FormAnswers = {}): LegalAnalysis {
  const normalizedSlug = procedureSlug.toLowerCase();
  const answerText = text(answers);
  const isPetition = normalizedSlug.includes('derecho-peticion') || normalizedSlug.includes('reclamacion') || normalizedSlug.includes('recurso');
  const isHealth = normalizedSlug.includes('salud') || /eps|ips|medic|tratamiento|cirug|salud/.test(answerText);

  const norms = normativeSources.filter((norm) => {
    if (norm.topics.includes('derecho-peticion')) return isPetition;
    if (norm.topics.includes('salud')) return isHealth;
    return false;
  });

  const rationale: string[] = [];
  if (isPetition) rationale.push('El trámite corresponde a una actuación que puede estructurarse como derecho de petición; se incorporan fuentes constitucionales y legales generales aplicables.');
  if (isHealth) rationale.push('Las respuestas contienen una materia relacionada con salud; se incorpora la Ley Estatutaria 1751 de 2015 como fuente normativa de referencia.');

  const alerts: string[] = [
    'La selección automática de normas es una ayuda de estructuración y no sustituye la revisión jurídica del caso concreto.',
    'Antes de presentar el documento, debe verificarse la vigencia de normas especiales, reglamentación sectorial y jurisprudencia aplicable.',
  ];

  return { procedureSlug, norms, alerts, rationale };
}
