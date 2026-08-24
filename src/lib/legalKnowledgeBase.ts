import { getSupabaseServer } from './supabaseServer';

export type LegalContextInput = {
  vertical: 'salud' | 'transito' | 'habeas-data' | 'contratos' | string;
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
  const topic = input.vertical;

  const [{ data: sources, error: sourceError }, { data: rules, error: ruleError }, { data: argumentsData, error: argumentError }] = await Promise.all([
    supabase.from('legal_sources').select('id,source_type,title,citation,status,official_source,version').eq('status', 'vigente'),
    supabase.from('legal_rules').select('id,source_id,article,rule_text,topics,trigger_conditions,argument_strength').eq('active', true).contains('topics', [topic]),
    supabase.from('legal_arguments').select('id,title,argument_text,trigger_conditions,required_evidence,risk_level').eq('active', true),
  ]);

  if (sourceError) throw sourceError;
  if (ruleError) throw ruleError;
  if (argumentError) throw argumentError;

  const applicableRules = (rules ?? []).filter((rule) => matchesTrigger(rule.trigger_conditions ?? {}, input.facts));
  const applicableArguments = (argumentsData ?? []).filter((item) => matchesTrigger(item.trigger_conditions ?? {}, input.facts));
  const sourceIds = new Set(applicableRules.map((r) => r.source_id));
  const applicableSources = (sources ?? []).filter((source) => sourceIds.has(source.id));

  return {
    libraryVersion: '2026.08.24-v1',
    vertical: input.vertical,
    procedure: input.procedure,
    statutes: applicableSources.filter((s) => ['law', 'decree', 'resolution', 'constitution', 'regulation'].includes(s.source_type)),
    jurisprudence: applicableSources.filter((s) => s.source_type === 'jurisprudence'),
    rules: applicableRules,
    arguments: applicableArguments,
  };
}
