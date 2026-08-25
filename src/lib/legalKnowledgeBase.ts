import { getSupabaseServer } from './supabaseServerClient';

export type LegalContextInput = {
  vertical: string;
  procedure: string;
  facts: Record<string, unknown>;
};

export type LegalSource = {
  id: string;
  source_type: string;
  title: string;
  citation: string;
  status: string;
  official_source: string;
  version: number;
};

export type LegalRule = {
  id: string;
  source_id: string;
  article: string | null;
  rule_text: string;
  topics: string[];
  trigger_conditions: Record<string, unknown>;
  argument_strength: string;
};

export type LegalArgument = {
  id: string;
  title: string;
  argument_text: string;
  trigger_conditions: Record<string, unknown>;
  required_evidence: string[];
  risk_level: string;
};

function matchesTrigger(conditions: Record<string, unknown>, facts: Record<string, unknown>) {
  return Object.entries(conditions).every(([key, expected]) => facts[key] === expected);
}

const canonicalTrafficSources: LegalSource[] = [
  {
    id: 'canonical_ley_769_2002',
    source_type: 'law',
    title: 'Código Nacional de Tránsito Terrestre',
    citation: 'Ley 769 de 2002',
    status: 'vigente',
    official_source: 'https://www.secretariasenado.gov.co/senado/basedoc/ley_0769_2002.html',
    version: 2026,
  },
  {
    id: 'canonical_decreto_19_2012',
    source_type: 'decree',
    title: 'Decreto Ley 19 de 2012',
    citation: 'Decreto Ley 19 de 2012, artículo 206',
    status: 'vigente',
    official_source: 'https://www.secretariasenado.gov.co/senado/basedoc/decreto_0019_2012.html',
    version: 2026,
  },
  {
    id: 'canonical_estatuto_tributario_818',
    source_type: 'law',
    title: 'Estatuto Tributario',
    citation: 'Estatuto Tributario, artículo 818',
    status: 'vigente',
    official_source: 'https://www.secretariasenado.gov.co/senado/basedoc/estatuto_tributario_pr033.html',
    version: 2026,
  },
  {
    id: 'canonical_ley_1437_2011',
    source_type: 'law',
    title: 'Código de Procedimiento Administrativo y de lo Contencioso Administrativo',
    citation: 'Ley 1437 de 2011 (CPACA)',
    status: 'vigente',
    official_source: 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=41249',
    version: 2026,
  },
  {
    id: 'canonical_ce_boletin_185_2016',
    source_type: 'jurisprudence',
    title: 'Consejo de Estado — doctrina sobre prescripción de sanciones de tránsito',
    citation: 'Consejo de Estado, Boletín 185, 6 de mayo de 2016',
    status: 'vigente',
    official_source: 'https://www.consejodeestado.gov.co/documentos/boletines/185.pdf',
    version: 2016,
  },
];

const canonicalTrafficRules: LegalRule[] = [
  {
    id: 'canonical_transito_art159',
    source_id: 'canonical_ley_769_2002',
    article: 'Artículo 159',
    rule_text: 'Las sanciones impuestas por infracciones a las normas de tránsito prescriben en tres (3) años contados a partir de la ocurrencia del hecho; la prescripción debe ser declarada de oficio y se interrumpe con la notificación del mandamiento de pago. La autoridad de tránsito no puede iniciar cobro coactivo cuando ya se hayan configurado los supuestos para declarar la prescripción.',
    topics: ['transito', 'prescripcion-comparendo'],
    trigger_conditions: {},
    argument_strength: 'high',
  },
  {
    id: 'canonical_transito_art818',
    source_id: 'canonical_estatuto_tributario_818',
    article: 'Artículo 818',
    rule_text: 'En lo pertinente al cobro coactivo de sanciones de tránsito, el término de prescripción de la acción de cobro se interrumpe, entre otros eventos, por la notificación del mandamiento de pago; interrumpida la prescripción, el término vuelve a correr desde el día siguiente a la notificación del mandamiento, conforme al régimen aplicable.',
    topics: ['transito', 'prescripcion-comparendo'],
    trigger_conditions: {},
    argument_strength: 'high',
  },
  {
    id: 'canonical_transito_cpaca_91_3',
    source_id: 'canonical_ley_1437_2011',
    article: 'Artículo 91 numeral 3',
    rule_text: 'Un acto administrativo en firme pierde obligatoriedad y no puede ser ejecutado cuando, al cabo de cinco (5) años de estar en firme, la autoridad no ha realizado los actos que le correspondan para ejecutarlo.',
    topics: ['transito', 'prescripcion-comparendo', 'perdida-ejecutoriedad'],
    trigger_conditions: {},
    argument_strength: 'high',
  },
  {
    id: 'canonical_transito_cpaca_91_5',
    source_id: 'canonical_ley_1437_2011',
    article: 'Artículo 91 numeral 5',
    rule_text: 'La pérdida de ejecutoriedad también opera cuando el acto administrativo pierde vigencia. Esta causal no es la regla de los cinco años; los cinco años corresponden al numeral 3 del artículo 91.',
    topics: ['transito', 'perdida-ejecutoriedad'],
    trigger_conditions: {},
    argument_strength: 'high',
  },
  {
    id: 'canonical_transito_art161',
    source_id: 'canonical_ley_769_2002',
    article: 'Artículo 161',
    rule_text: 'La acción por contravención de las normas de tránsito caduca al año contado desde la ocurrencia de los hechos; dentro de ese término debe decidirse sobre la imposición de la sanción, con las reglas adicionales sobre recursos previstas en la norma.',
    topics: ['transito', 'caducidad-comparendo'],
    trigger_conditions: {},
    argument_strength: 'high',
  },
  {
    id: 'canonical_transito_ce_2016',
    source_id: 'canonical_ce_boletin_185_2016',
    article: null,
    rule_text: 'El Consejo de Estado ha relacionado el artículo 159 de la Ley 769 de 2002 con el artículo 818 del Estatuto Tributario para el análisis de la prescripción del cobro de sanciones de tránsito, destacando la relevancia probatoria de verificar la fecha y notificación del mandamiento de pago y las actuaciones posteriores de cobro.',
    topics: ['transito', 'prescripcion-comparendo'],
    trigger_conditions: {},
    argument_strength: 'high',
  },
];

function isTrafficCoreRule(rule: LegalRule) {
  const article = String(rule.article ?? '').toLowerCase().replace(/\s+/g, ' ');
  return ['159', '818', '91 numeral 3', '91 numeral 5', '161'].some((needle) => article.includes(needle)) ||
    /art(?:ículo|iculo)?\.?\s*(159|818|91|161)/i.test(rule.rule_text);
}

export async function getLegalContext(input: LegalContextInput) {
  const supabase = getSupabaseServer();
  const facts = { ...input.facts, vertical: input.vertical, procedure: input.procedure };
  const isTraffic = input.vertical === 'transito' || /tr[aá]nsito|comparendo|multa|fotomulta|prescripci[oó]n-comparendo|caducidad-comparendo/i.test(`${input.vertical} ${input.procedure}`);

  const [{ data: sources, error: sourceError }, { data: rules, error: ruleError }, { data: argumentsData, error: argumentError }, { data: versions, error: versionError }] = await Promise.all([
    supabase.from('legal_sources').select('id,source_type,title,citation,status,official_source,version').eq('status', 'vigente'),
    supabase.from('legal_rules').select('id,source_id,article,rule_text,topics,trigger_conditions,argument_strength').eq('active', true),
    supabase.from('legal_arguments').select('id,title,argument_text,trigger_conditions,required_evidence,risk_level').eq('active', true),
    supabase.from('legal_versions').select('library_version').order('id', { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (sourceError) throw sourceError;
  if (ruleError) throw ruleError;
  if (argumentError) throw argumentError;
  if (versionError) throw versionError;

  const typedSources = (sources ?? []) as unknown as LegalSource[];
  const typedRules = (rules ?? []) as unknown as LegalRule[];
  const typedArguments = (argumentsData ?? []) as unknown as LegalArgument[];

  let candidateRules = typedRules;
  let sourcePool = typedSources;
  if (isTraffic) {
    // The traffic core is canonicalized in code so stale database rows cannot
    // silently reintroduce obsolete or misnumbered citations into a document.
    candidateRules = typedRules.filter((rule) => !isTrafficCoreRule(rule));
    sourcePool = typedSources.filter((source) => !/art(?:ículo|iculo)?\.?\s*(159|818|91|161)/i.test(`${source.citation} ${source.title}`));
    candidateRules = [...candidateRules, ...canonicalTrafficRules];
    sourcePool = [...sourcePool, ...canonicalTrafficSources];
  }

  const applicableRules = candidateRules.filter((rule) =>
    rule.topics.some((topic) => topic === input.vertical || topic === input.procedure || input.vertical === 'tutela' && topic === 'tutela') &&
    matchesTrigger(rule.trigger_conditions ?? {}, facts),
  );
  const applicableArguments = typedArguments.filter((item) => matchesTrigger(item.trigger_conditions ?? {}, facts));
  const sourceIds = new Set(applicableRules.map((r) => r.source_id));
  for (const argument of applicableArguments) {
    const links = await supabase.from('legal_argument_sources').select('source_id').eq('argument_id', argument.id);
    for (const link of (links.data ?? []) as Array<{ source_id: string }>) sourceIds.add(link.source_id);
  }
  const applicableSources = sourcePool.filter((source) => sourceIds.has(source.id));

  return {
    libraryVersion: isTraffic ? '2026.08.25-traffic-canonical-v1' : (versions?.library_version ?? '2026.08.25-v2'),
    vertical: input.vertical,
    procedure: input.procedure,
    statutes: applicableSources.filter((s) => ['law', 'decree', 'resolution', 'constitution', 'regulation'].includes(s.source_type)),
    jurisprudence: applicableSources.filter((s) => s.source_type === 'jurisprudence'),
    rules: applicableRules,
    arguments: applicableArguments,
  };
}
