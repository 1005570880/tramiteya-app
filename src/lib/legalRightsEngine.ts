export type FundamentalRightKey =
  | 'vida'
  | 'integridad'
  | 'dignidad'
  | 'salud'
  | 'peticion'
  | 'debido_proceso'
  | 'trabajo'
  | 'seguridad_social'
  | 'intimidad'
  | 'honra'
  | 'buen_nombre'
  | 'habeas_data'
  | 'libre_desarrollo'
  | 'igualdad'
  | 'educacion'
  | 'libertad_personal'
  | 'familia'
  | 'ambiente_sano';

export type RightsAnalysisInput = {
  facts: Record<string, unknown>;
  requestedRights?: FundamentalRightKey[];
};

export type RightMatch = {
  right: FundamentalRightKey;
  confidence: number;
  reasons: string[];
};

const RULES: Array<{ right: FundamentalRightKey; facts: string[] }> = [
  { right: 'vida', facts: ['lifeRisk', 'imminentDeath', 'vitalRisk'] },
  { right: 'integridad', facts: ['physicalRisk', 'mentalRisk', 'violence', 'torture'] },
  { right: 'dignidad', facts: ['dignityAffected', 'inhumanTreatment', 'minimumLivingConditions'] },
  { right: 'salud', facts: ['health', 'medicationDenied', 'procedureDenied', 'treatmentDenied'] },
  { right: 'peticion', facts: ['petitionFiled', 'noResponse', 'lateResponse', 'evasiveResponse'] },
  { right: 'debido_proceso', facts: ['noDefense', 'noHearing', 'badNotification', 'administrativeSanction', 'judicialProcess'] },
  { right: 'trabajo', facts: ['employment', 'dismissal', 'salaryDebt', 'minimumVital'] },
  { right: 'seguridad_social', facts: ['pension', 'socialSecurity', 'benefitDenied'] },
  { right: 'intimidad', facts: ['privateInformation', 'privacy', 'unauthorizedPublication'] },
  { right: 'honra', facts: ['honorAffected', 'defamatoryContent'] },
  { right: 'buen_nombre', facts: ['reputationAffected', 'falseInformation', 'creditReport'] },
  { right: 'habeas_data', facts: ['creditReport', 'dataCorrection', 'negativeReport', 'personalData'] },
  { right: 'libre_desarrollo', facts: ['autonomy', 'personalChoice', 'identity'] },
  { right: 'igualdad', facts: ['discrimination', 'unequalTreatment', 'protectedGroup'] },
  { right: 'educacion', facts: ['education', 'schoolAccess', 'universityAccess'] },
  { right: 'libertad_personal', facts: ['detention', 'unlawfulDetention'] },
  { right: 'familia', facts: ['familyUnity', 'childRights', 'familyProtection'] },
  { right: 'ambiente_sano', facts: ['environmentalDamage', 'pollution', 'environmentalRisk'] },
];

export function detectFundamentalRights(input: RightsAnalysisInput): RightMatch[] {
  if (input.requestedRights?.length) {
    return input.requestedRights.map((right) => ({ right, confidence: 1, reasons: ['Derecho seleccionado por el usuario.'] }));
  }

  return RULES.map((rule) => {
    const matched = rule.facts.filter((key) => Boolean(input.facts[key]));
    return matched.length
      ? { right: rule.right, confidence: Math.min(1, 0.55 + matched.length * 0.12), reasons: matched.map((key) => `Hecho compatible: ${key}`) }
      : null;
  }).filter(Boolean) as RightMatch[];
}

export function buildRightsContext(input: RightsAnalysisInput) {
  const rights = detectFundamentalRights(input);
  return {
    rights,
    primaryRight: rights[0]?.right ?? null,
    multipleRights: rights.length > 1,
  };
}
