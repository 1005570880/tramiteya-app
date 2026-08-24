import type { FormAnswers } from '../types/form';

export type QualityLevel = 'green' | 'yellow' | 'red';
export type RuleOperator = 'exists' | 'notExists' | 'equals' | 'notEquals' | 'contains' | 'gte' | 'lte';

export type ProcedureFieldConfig = {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'email' | 'phone' | 'date' | 'select' | 'radio' | 'checkbox' | 'file';
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  condition?: { field: string; operator: RuleOperator; value?: string | number | boolean };
};

export type ProcedureStepConfig = { id: string; title: string; description?: string; fields: ProcedureFieldConfig[] };

export type QualityRule = {
  id: string;
  field?: string;
  operator?: RuleOperator;
  value?: string | number | boolean;
  points: number;
  level?: QualityLevel;
  message: string;
  blocking?: boolean;
};

export type DocumentSection = {
  heading: string;
  lines: Array<{ label: string; field?: string; fallback?: string } | string>;
};

export type ProcedureModuleConfig = {
  id: string;
  vertical: 'transito' | 'salud' | 'habeas-data' | 'contratos' | 'administrativo' | 'laboral' | 'familia' | 'general';
  title: string;
  description: string;
  procedureSlugs: string[];
  priceCop: number;
  steps: ProcedureStepConfig[];
  quality: { baseScore?: number; rules: QualityRule[] };
  document: { title: string; sections: DocumentSection[]; legalBasis?: string[] };
};

export type GenericQualityResult = {
  score: number;
  level: QualityLevel;
  warnings: string[];
  blockingIssues: string[];
  triggeredRules: string[];
};

function readValue(answers: FormAnswers, field?: string): unknown {
  if (!field) return undefined;
  return answers[field];
}

function matches(value: unknown, operator: RuleOperator, expected?: unknown): boolean {
  const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
  if (operator === 'exists') return !empty;
  if (operator === 'notExists') return empty;
  if (operator === 'equals') return value === expected;
  if (operator === 'notEquals') return value !== expected;
  if (operator === 'contains') return Array.isArray(value) ? value.includes(expected as never) : String(value ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
  if (operator === 'gte') return Number(value) >= Number(expected);
  if (operator === 'lte') return Number(value) <= Number(expected);
  return false;
}

export function runGenericLegalQualityGate(config: ProcedureModuleConfig, answers: FormAnswers): GenericQualityResult {
  let score = config.quality.baseScore ?? 0;
  const warnings: string[] = [];
  const blockingIssues: string[] = [];
  const triggeredRules: string[] = [];

  for (const rule of config.quality.rules) {
    const hit = matches(readValue(answers, rule.field), rule.operator ?? 'exists', rule.value);
    if (!hit) continue;
    score += rule.points;
    triggeredRules.push(rule.id);
    if (rule.blocking) blockingIssues.push(rule.message);
    else warnings.push(rule.message);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level: QualityLevel = blockingIssues.length || score < 40 ? 'red' : score < 75 || warnings.length ? 'yellow' : 'green';
  return { score, level, warnings, blockingIssues, triggeredRules };
}

export function renderConfiguredDocument(config: ProcedureModuleConfig, answers: FormAnswers): string {
  const value = (field?: string, fallback = '') => {
    const raw = readValue(answers, field);
    if (Array.isArray(raw)) return raw.join(', ');
    if (typeof raw === 'boolean') return raw ? 'Sí' : 'No';
    return raw === undefined || raw === null || raw === '' ? fallback : String(raw);
  };

  const lines: string[] = [config.document.title, ''];
  for (const section of config.document.sections) {
    lines.push(section.heading, '');
    for (const line of section.lines) {
      if (typeof line === 'string') lines.push(line);
      else lines.push(`${line.label}: ${value(line.field, line.fallback)}`);
    }
    lines.push('');
  }
  if (config.document.legalBasis?.length) {
    lines.push('FUNDAMENTO NORMATIVO DE REFERENCIA', '', ...config.document.legalBasis, '');
  }
  return lines.join('\n');
}

const registry = new Map<string, ProcedureModuleConfig>();

export function registerProcedureModule(config: ProcedureModuleConfig): void {
  for (const slug of config.procedureSlugs) registry.set(slug, config);
}

export function getProcedureModule(slug: string): ProcedureModuleConfig | null { return registry.get(slug) ?? null; }
export function listProcedureModules(): ProcedureModuleConfig[] { return Array.from(new Set(registry.values())); }
