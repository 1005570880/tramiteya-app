const FORBIDDEN_INTERNAL_MARKERS = [
  'FUNDAMENTO NORMATIVO DE REFERENCIA',
  'CRITERIO DE SELECCIÓN',
  'ADVERTENCIA DE REVISIÓN',
  'ADVERTENCIA DE CALIDAD',
  'LEGAL_CONTEXT',
  'Criterio de selección',
  'Fuente:',
  'Fuente jurisprudencial disponible',
  'La selección automática de normas',
  'La automatización no garantiza el resultado del trámite',
];

const UNRESOLVED_PLACEHOLDER_PATTERNS = [
  /\{\{[^}]+\}\}/g,
  /\[\[[^\]]+\]\]/g,
  /\[●\]/g,
  /\b(?:información|dato|correo|dirección|teléfono)\s+(?:no informado|no suministrad[oa])\b/gi,
  /\b(?:la razón indicada|el riesgo informado|la negativa o barrera informada)\b/gi,
];

export type DocumentGuardResult = {
  ok: boolean;
  errors: string[];
};

export function validateFinalDocument(content: string): DocumentGuardResult {
  const errors: string[] = [];
  const normalized = content.normalize('NFKC');

  for (const marker of FORBIDDEN_INTERNAL_MARKERS) {
    if (normalized.toLowerCase().includes(marker.toLowerCase())) {
      errors.push(`El documento contiene metadatos internos no publicables: ${marker}`);
    }
  }

  for (const pattern of UNRESOLVED_PLACEHOLDER_PATTERNS) {
    const matches = normalized.match(pattern);
    if (matches?.length) {
      errors.push(`El documento contiene placeholders o datos incompletos: ${matches.slice(0, 3).join(', ')}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function assertFinalDocument(content: string): string {
  const result = validateFinalDocument(content);
  if (!result.ok) {
    throw new Error(`Documento final rechazado por control de calidad: ${result.errors.join(' | ')}`);
  }
  return content;
}
