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

export async function getLegalContext(input: LegalContextInput) {
  const supabase = getSupabaseServer();
  const facts = { ...input.facts, vertical: input.vertical, procedure: input.procedure };

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

  const applicableRules = typedRules.filter((rule) =>
    rule.topics.some((topic) => topic === input.vertical || topic === input.procedure || input.vertical === 'tutela' && topic === 'tutela') &&
    matchesTrigger(rule.trigger_conditions ?? {}, facts),
  );
  const applicableArguments = typedArguments.filter((item) => matchesTrigger(item.trigger_conditions ?? {}, facts));
  const sourceIds = new Set(applicableRules.map((r) => r.source_id));
  for (const argument of applicableArguments) {
    const links = await supabase.from('legal_argument_sources').select('source_id').eq('argument_id', argument.id);
    for (const link of (links.data ?? []) as Array<{ source_id: string }>) sourceIds.add(link.source_id);
  }
  const applicableSources = typedSources.filter((source) => sourceIds.has(source.id));

  return {
    libraryVersion: versions?.library_version ?? '2026.08.25-v2',
    vertical: input.vertical,
    procedure: input.procedure,
    statutes: applicableSources.filter((s) => ['law', 'decree', 'resolution', 'constitution', 'regulation'].includes(s.source_type)),
    jurisprudence: applicableSources.filter((s) => s.source_type === 'jurisprudence'),
    rules: applicableRules,
    arguments: applicableArguments,
  };
}
