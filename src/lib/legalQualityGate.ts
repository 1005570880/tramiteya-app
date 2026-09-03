export type QualityLevel = 'green' | 'yellow' | 'red';

export type QualityIssue = {
  code: string;
  severity: 'blocker' | 'warning' | 'info';
  message: string;
  field?: string;
  comparendoIndex?: number;
};

export type QualityResult = {
  score: number;
  level: QualityLevel;
  canGenerate: boolean;
  issues: QualityIssue[];
};

export function calculateQualityScore(issues: QualityIssue[], completeness = 100): QualityResult {
  const blockers = issues.filter((i) => i.severity === 'blocker').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const score = Math.max(0, Math.min(100, Math.round(completeness - blockers * 25 - warnings * 5)));

  return {
    score,
    level: blockers > 0 ? 'red' : score >= 85 ? 'green' : 'yellow',
    canGenerate: blockers === 0,
    issues,
  };
}
