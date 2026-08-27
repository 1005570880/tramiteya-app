const UNSUPPORTED_VALUE_PATTERNS = [
  /no identificado en el documento aportado/gi,
  /no especificad[oa] en pdf/gi,
  /no identificado en pdf/gi,
];

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function removeUnsupportedData(text: string): string {
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs
    .map((paragraph) => {
      let value = paragraph;
      for (const pattern of UNSUPPORTED_VALUE_PATTERNS) {
        value = value.replace(pattern, '');
      }
      value = value
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([,.;:])/g, '$1')
        .replace(/([:;,])\s*\./g, '$1')
        .trim();
      // A paragraph that existed only to print an unavailable OCR value should disappear.
      if (!value || /^(?:[-•]\s*)?(?:placa|valor|documento de identidad|cedula|c[eé]dula)\s*:?\s*[.\-]*$/i.test(value)) {
        return '';
      }
      return value;
    })
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hasDuplicatedMajorSections(text: string): boolean {
  const headings = text.match(/^(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s+[^\n]+/gim) || [];
  const counts = new Map<string, number>();
  for (const heading of headings) {
    const key = normalize(heading).replace(/\s+/g, ' ').trim();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.values()].some((count) => count > 1);
}

function hasRequiredDeletionRelief(text: string): boolean {
  const n = normalize(text);
  const petitions = /(?:^|\n)\s*(?:v|ix|x)\.?\s+peticiones\b/.test(n);
  const deletion = /(elimin|cancel|depur|actualiz).{0,220}(multa|comparendo|registro|simit)|(multa|comparendo|registro|simit).{0,220}(elimin|cancel|depur|actualiz)/s.test(n);
  const termination = /(termin|archive|finalice).{0,220}(obligacion|cobro|sancion)|(obligacion|cobro|sancion).{0,220}(termin|archive|finalice)/s.test(n);
  return petitions && deletion && termination;
}

export function cleanLegalDocumentOutput(text: string): string {
  return removeUnsupportedData(text);
}

export function isLegallySafeTrafficDocument(text: string): boolean {
  const cleaned = cleanLegalDocumentOutput(text);
  if (cleaned.length < 500) return false;
  if (UNSUPPORTED_VALUE_PATTERNS.some((pattern) => pattern.test(cleaned))) return false;
  if (hasDuplicatedMajorSections(cleaned)) return false;
  if (!hasRequiredDeletionRelief(cleaned)) return false;
  return true;
}
