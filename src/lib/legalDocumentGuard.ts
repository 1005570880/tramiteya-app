const UNSUPPORTED_VALUE_PATTERNS = [
  /no identificado en el documento aportado/gi,
  /no especificad[oa] en pdf/gi,
  /no identificado en pdf/gi,
  /no identificado/gi,
  /no especificad[oa]/gi,
  /no le[ií]da/gi,
  /no disponible/gi,
];

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function removeMarkdownMarkers(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/gs, '$1')
    .replace(/__(.*?)__/gs, '$1')
    .replace(/(?<!\*)\*(?!\s)([^*\n]+?)(?<!\s)\*(?!\*)/g, '$1')
    .replace(/(?<!\w)_(?!\s)([^_\n]+?)(?<!\s)_(?!\w)/g, '$1');
}

function normalizeTemporalLanguage(text: string): string {
  return text.replace(/La actuación tiene una antigüedad aproximada de (\d+(?:\.\d+)?) años\./gi, (_match, rawYears: string) => {
    const years = Number(rawYears);
    if (!Number.isFinite(years)) return _match;
    if (years < 1) return 'La actuación tiene menos de un año de antigüedad.';
    if (years < 2) return 'La actuación tiene más de un año de antigüedad.';
    if (years < 3) return 'Han transcurrido más de dos años desde la fecha del hecho y aún no se completan tres años.';
    if (years < 4) return 'Han transcurrido más de tres años desde la fecha del hecho.';
    return `Han transcurrido aproximadamente ${Math.floor(years)} años desde la fecha del hecho.`;
  });
}

function removeUnsupportedData(text: string): string {
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs.map((paragraph) => {
    let value = paragraph;
    for (const pattern of UNSUPPORTED_VALUE_PATTERNS) value = value.replace(pattern, '');
    value = value
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([,.;:])/g, '$1')
      .replace(/([:;,])\s*\./g, '$1')
      .replace(/\s+([)])/g, '$1')
      .replace(/([(])\s+/g, '$1')
      .trim();
    if (!value || /^(?:[-•]\s*)?(?:placa|valor|documento de identidad|cedula|c[eé]dula|titular|fecha|autoridad|entidad)\s*:?\s*[.\-]*$/i.test(value)) return '';
    return value;
  }).filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

function hasDuplicatedMajorSections(text: string): boolean {
  const headings = text.match(/^(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII)\.\s+[^\n]+/gim) || [];
  const counts = new Map<string, number>();
  for (const heading of headings) {
    const key = normalize(heading).replace(/\s+/g, ' ').trim();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.values()].some((count) => count > 1);
}

function hasRequiredPetitionRelief(text: string): boolean {
  const n = normalize(text);
  const match = n.match(/(?:^|\n)\s*(?:i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii)\.?\s+(?:peticiones|pretensiones)\b/);
  if (!match) return false;
  const petitionText = n.slice((match.index ?? 0) + match[0].length);
  if (petitionText.length < 40) return false;
  return /(solicit|entreg|inform|determin|verific|declar|revis|remit|aportar|cancel|elimin|depur|actualiz|termin|archiv|dejar sin efectos|notific)/i.test(petitionText);
}

export function cleanLegalDocumentOutput(text: string): string {
  return normalizeTemporalLanguage(removeMarkdownMarkers(removeUnsupportedData(text)));
}

export function isLegallySafeTrafficDocument(text: string): boolean {
  const cleaned = cleanLegalDocumentOutput(text);
  if (cleaned.length < 500) return false;
  if (hasDuplicatedMajorSections(cleaned)) return false;
  if (!hasRequiredPetitionRelief(cleaned)) return false;
  return true;
}
