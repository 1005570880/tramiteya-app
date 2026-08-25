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

export type DocumentGuardResult = { ok: boolean; errors: string[] };

export function sanitizeFinalDocument(content: string): string {
  return content
    .split(/\r?\n/)
    .filter((line) => {
      const lower = line.toLowerCase();
      return !lower.includes('correo electrónico no informado') &&
        !lower.includes('dirección/correo de la entidad no informado') &&
        !lower.includes('correo no informado') &&
        !lower.includes('teléfono no informado') &&
        !lower.includes('dirección no informada');
    })
    .map((line) => line
      .replace(/La razón indicada para la negativa o barrera corresponde a:\s*la negativa o barrera informada por la entidad\.?/gi, 'La conducta atribuida a la entidad accionada se describe en los hechos de la presente acción.')
      .replace(/El riesgo o afectación informado es:\s*la afectación o riesgo informado por el accionante\.?/gi, 'La afectación alegada corresponde a la situación descrita en los hechos y deberá acreditarse con los soportes aportados.')
      .replace(/La conducta atribuida a la parte accionada consiste en:\s*la conducta descrita por el accionante\.?/gi, 'La conducta atribuida a la parte accionada corresponde a la situación descrita en los hechos de la presente acción.')
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

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
    if (matches?.length) errors.push(`El documento contiene placeholders o datos incompletos: ${matches.slice(0, 3).join(', ')}`);
  }
  return { ok: errors.length === 0, errors };
}

export function assertFinalDocument(content: string): string {
  const sanitized = sanitizeFinalDocument(content);
  const result = validateFinalDocument(sanitized);
  if (!result.ok) throw new Error(`Documento final rechazado por control de calidad: ${result.errors.join(' | ')}`);
  return sanitized;
}
