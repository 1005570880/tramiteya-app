import { findMatchingAuthority } from './constants/transitAuthorities';

export type ParsedSimitRecord = {
  kind: 'multa' | 'comparendo';
  number?: string;
  date?: string;
  time?: string;
  authority?: string;
  municipality?: string;
  department?: string;
  plate?: string;
  ownerName?: string;
  documentNumber?: string;
  infractionCode?: string;
  description?: string;
  status?: string;
  value?: number;
  resolutionNumber?: string;
  resolutionDate?: string;
  notificationDate?: string;
  paymentDate?: string;
};

const DATE_RE = /\b\d{2}[/-]\d{2}[/-]\d{4}\b/g;
const TIME_RE = /\b\d{2}:\d{2}(?::\d{2})?\b/;
const STATUS_RE = /\b(Pendiente(?:\s+de\s+pago)?|Cobro\s+coactivo|Pagado|Cancelado|Acuerdo\s+de\s+pago|Vigente|En\s+cobro)\b/i;
const CODE_RE = /(?:^|[^A-Z0-9])([A-D]\d{2})(?=$|[^A-Z0-9])/i;
const PLATE_RE = /\b([A-Z]{3}[ -]?\d{3})\b/gi;
const TWENTY_DIGIT_RE = /(?<!\d)\d{20}(?!\d)/g;
const SPACED_TWENTY_DIGIT_RE = /(?<!\d)(?:\d[ \t\n\r]+){19}\d(?!\d)/g;
const FAD_ID_RE = /(?<![A-Z0-9])\d{4}\s*-\s*FAD\s*-\s*\d+(?![A-Z0-9])/gi;
const TC_ID_RE = /(?<![A-Z0-9])TC\s*-\s*\d{4}\s*-\s*\d+(?![A-Z0-9])/gi;
const SA_ID_RE = /(?<![A-Z0-9])\d{4}\s*-\s*\d+\s*-\s*SA(?![A-Z0-9])/gi;
const LEGACY_ID_RE = /(?<![A-Z0-9])\d{6,10}\s*S(?![A-Z0-9])/gi;
const PLAIN_10_DIGIT_ID_RE = /(?<!\d)\d{10}(?!\d)/g;
const GENERIC_HYPHEN_ID_RE = /(?<![A-Z0-9])[A-Z0-9]+(?:\s*-\s*[A-Z0-9]+)+(?![A-Z0-9])/gi;

function normalizeWhitespace(value: string): string {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n')
    .trim();
}

function compactDigits(value: string): string { return String(value || '').replace(/\D/g, ''); }
function clean(value: string): string { return String(value || '').replace(/\s+/g, ' ').trim(); }
function moneyToNumber(value: string): number | undefined { const digits = String(value || '').replace(/\D/g, ''); return digits ? Number(digits) : undefined; }
function extractMoney(value: string): number | undefined {
  const matches = [...String(value || '').matchAll(/\$\s*([0-9]{1,3}(?:[.,\s][0-9]{3})+|[0-9]{4,})\b/g)];
  return matches.length ? moneyToNumber(matches[matches.length - 1][1]) : undefined;
}
function extractDate(value: string): string | undefined { DATE_RE.lastIndex = 0; return String(value || '').match(DATE_RE)?.[0]; }
function extractTime(value: string): string | undefined { return String(value || '').match(TIME_RE)?.[0]; }
function extractStatus(value: string): string | undefined { return clean(String(value || '').match(STATUS_RE)?.[1] || '') || undefined; }
function extractCode(value: string): string | undefined { return String(value || '').match(CODE_RE)?.[1]?.toUpperCase(); }

export function extractSimitDocumentNumber(input: string): string | undefined {
  const text = normalizeWhitespace(input);
  if (!text) return undefined;
  const patterns = [
    /(?:c[eé]dula|cedula)\s*(?:de\s+)?(?:n[uú]mero|no\.?|nro\.?|n[º°])?\s*[:#-]?\s*((?:\d[\s\n]*){6,10})(?=\D|$)/i,
    /(?:documento\s+de\s+identidad|n[uú]mero\s+de\s+identificaci[oó]n|identificaci[oó]n)\s*[:#-]?\s*((?:\d[\s\n]*){6,10})(?=\D|$)/i,
    /\b(?:CC|C\.C\.)\s*[:#-]?\s*((?:\d[\s\n]*){6,10})(?=\D|$)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const digits = match?.[1] ? compactDigits(match[1]) : '';
    if (/^\d{6,10}$/.test(digits)) return digits;
  }
  const headingIndex = text.search(/estado\s+de\s+cuenta/i);
  if (headingIndex >= 0) {
    const window = text.slice(headingIndex, headingIndex + 700);
    const candidates = [...window.matchAll(/\b\d{6,10}\b/g)].map(m => m[0]);
    const candidate = candidates.find(value => !/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(value));
    if (candidate) return candidate;
  }
  return undefined;
}

export function extractSimitPlate(input: string): string | undefined {
  const text = normalizeWhitespace(input);
  if (!text) return undefined;
  const labelled = [
    /(?:^|[\n|])\s*(?:placa|plca)[^\n|:]*[:#=\-]?\s*([A-Z]{3}[ -]?\d{3})\b/im,
    /(?:placa|plca)[^A-Z0-9]{0,30}([A-Z]{3}[ -]?\d{3})\b/i,
  ];
  for (const pattern of labelled) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].replace(/[ -]/g, '').toUpperCase();
  }
  for (const match of text.matchAll(PLATE_RE)) {
    const plate = match[1].replace(/[ -]/g, '').toUpperCase();
    const before = text.slice(Math.max(0, (match.index ?? 0) - 60), match.index ?? 0).toLowerCase();
    if (!/documento|c[eé]dula|identificaci[oó]n|comparendo|resoluci[oó]n|radicado/.test(before)) return plate;
  }
  return undefined;
}

function authorityFromMunicipality(municipality: string | undefined, body: string): string | undefined {
  return (municipality && findMatchingAuthority(municipality)) || findMatchingAuthority(body);
}

function extractMunicipality(body: string, date: string | undefined, code?: string): string | undefined {
  if (!date) return undefined;
  const dateIndex = body.indexOf(date);
  if (dateIndex < 0) return undefined;
  let after = body.slice(dateIndex + date.length).replace(/^\s*\d{2}:\d{2}(?::\d{2})?\s*/, '');
  if (code) {
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const codeIndex = after.search(new RegExp(`\\b${escaped}\\b`, 'i'));
    if (codeIndex >= 0) after = after.slice(0, codeIndex);
  }
  const value = clean(after)
    .replace(/^(?:\|\s*)+/, '')
    .replace(/(?:pendiente(?:\s+de\s+pago)?|cobro\s+coactivo|pagado|cancelado|vigente|en\s+cobro).*$/i, '')
    .trim();
  if (!value || /^(?:\$|[0-9.,\s]+)$/.test(value)) return undefined;
  return value;
}

function buildRecord(number: string, body: string): ParsedSimitRecord {
  const date = extractDate(body);
  const code = extractCode(body);
  const municipality = extractMunicipality(body, date, code);
  const withoutNumber = body.replace(new RegExp(number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
  return {
    kind: /cobro\s+coactivo/i.test(body) ? 'multa' : 'comparendo',
    number,
    date,
    time: extractTime(body),
    municipality,
    authority: authorityFromMunicipality(municipality, body),
    plate: extractSimitPlate(body),
    infractionCode: code,
    status: extractStatus(body) || 'Pendiente',
    value: extractMoney(withoutNumber),
  };
}

type IdentifierAnchor = { number: string; index: number };

function addAnchor(anchors: IdentifierAnchor[], number: string, index: number): void {
  const normalized = String(number || '').replace(/\s+/g, '').trim();
  if (!normalized) return;
  if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(normalized)) return;
  if (/^\d{1,9}$/.test(normalized)) return;
  if (!/^\d{10,20}$/.test(normalized) && !/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/i.test(normalized)) return;
  anchors.push({ number: normalized, index });
}

function collectRowAnchors(text: string): IdentifierAnchor[] {
  const anchors: IdentifierAnchor[] = [];
  const rows = [...text.matchAll(/^\s*\d{1,3}[.)]\s*/gm)];
  for (let i = 0; i < rows.length; i += 1) {
    const rowStart = (rows[i].index ?? 0) + rows[i][0].length;
    const rowEnd = rows[i + 1]?.index ?? text.length;
    const row = text.slice(rowStart, rowEnd).trim();
    if (!row) continue;

    const firstToken = row.match(/^(\d{10,20}|[A-Z0-9]+(?:\s*-\s*[A-Z0-9]+)+)(?=\s|$|[$])/i);
    if (firstToken?.[1]) {
      addAnchor(anchors, firstToken[1], rowStart + (firstToken.index ?? 0));
      continue;
    }

    const beforeDate = row.search(/\b\d{2}[/-]\d{2}[/-]\d{4}\b/);
    const prefix = beforeDate >= 0 ? row.slice(0, beforeDate) : row.slice(0, 100);
    const candidate = prefix.match(/(?:^|\s)(\d{10,20}|[A-Z0-9]+(?:\s*-\s*[A-Z0-9]+)+)(?=\s|$|[$])/i);
    if (candidate?.[1]) addAnchor(anchors, candidate[1], rowStart + (candidate.index ?? 0));
  }
  return anchors;
}

function collectIdentifierAnchors(text: string): IdentifierAnchor[] {
  const anchors: IdentifierAnchor[] = [];
  const pushMatches = (regex: RegExp, normalize: (value: string) => string) => {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      addAnchor(anchors, normalize(match[0]), match.index ?? 0);
    }
  };

  // Row-first extraction is resilient to pdf-parse changing column order or
  // splitting cells across lines. It recovers the identifier that starts each
  // numbered statement row, which is the stable unit we need.
  anchors.push(...collectRowAnchors(text));

  pushMatches(TWENTY_DIGIT_RE, value => value);
  pushMatches(SPACED_TWENTY_DIGIT_RE, value => compactDigits(value));
  pushMatches(FAD_ID_RE, value => value.replace(/\s+/g, ''));
  pushMatches(TC_ID_RE, value => value.replace(/\s+/g, ''));
  pushMatches(SA_ID_RE, value => value.replace(/\s+/g, ''));
  pushMatches(LEGACY_ID_RE, value => value.replace(/\s+/g, ''));
  pushMatches(GENERIC_HYPHEN_ID_RE, value => value.replace(/\s+/g, ''));

  if (!anchors.length) {
    const sectionStart = text.search(/comparendos\s+y\s+multas/i);
    if (sectionStart >= 0) {
      const sectionEnd = text.search(/\btotal\s+(?:a\s+)?pagar\b/i);
      const section = text.slice(sectionStart, sectionEnd >= 0 ? sectionEnd : text.length);
      PLAIN_10_DIGIT_ID_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = PLAIN_10_DIGIT_ID_RE.exec(section)) !== null) {
        addAnchor(anchors, match[0], sectionStart + (match.index ?? 0));
      }
    }
  }

  return anchors
    .sort((a, b) => a.index - b.index)
    .filter((anchor, index, all) => index === 0 || anchor.number !== all[index - 1].number || anchor.index !== all[index - 1].index);
}

function dedupe(records: ParsedSimitRecord[]): ParsedSimitRecord[] {
  const map = new Map<string, ParsedSimitRecord>();
  for (const record of records) {
    if (!record.number) continue;
    const previous = map.get(record.number);
    map.set(record.number, previous ? {
      ...previous,
      ...record,
      date: record.date || previous.date,
      time: record.time || previous.time,
      authority: record.authority || previous.authority,
      municipality: record.municipality || previous.municipality,
      plate: record.plate || previous.plate,
      value: record.value ?? previous.value,
      infractionCode: record.infractionCode || previous.infractionCode,
      status: record.status || previous.status,
    } : record);
  }
  return [...map.values()];
}

export function parseOfficialSimitText(input: string): ParsedSimitRecord[] {
  const text = normalizeWhitespace(input);
  if (!text) return [];

  // Parse only the real "Comparendos y multas" section. This is also the hard
  // boundary that prevents "Total a pagar" from becoming a fake last record.
  const sectionStart = text.search(/comparendos\s+y\s+multas/i);
  const sectionEnd = sectionStart >= 0
    ? text.slice(sectionStart).search(/\btotal\s+(?:a\s+)?pagar\b/i)
    : -1;
  const statementText = sectionStart >= 0
    ? text.slice(sectionStart, sectionEnd >= 0 ? sectionStart + sectionEnd : text.length)
    : text;

  const anchors = collectIdentifierAnchors(statementText);
  if (!anchors.length) return [];

  const records = anchors.map((anchor, index) => {
    const start = anchor.index;
    const end = anchors[index + 1]?.index ?? statementText.length;
    return buildRecord(anchor.number, statementText.slice(start, end));
  });

  return dedupe(records);
}
