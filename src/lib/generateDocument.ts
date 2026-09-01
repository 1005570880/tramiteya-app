import type { Procedure } from '../types';
import type { FormAnswers } from '../types/form';
import type { DocumentItem } from '../types/procedure';
import { buildDocumentText } from './documentTemplates';
import { buildTrafficDocument } from './trafficDocumentTemplates';
import { refineLegalDocument } from './aiDocumentRefiner';
import { cleanLegalDocumentOutput, isLegallySafeTrafficDocument } from './legalDocumentGuard';

function generateId(prefix = 'doc') { return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`; }
const trafficSlugs = new Set(['prescripcion-comparendo', 'caducidad-comparendo', 'revocatoria-comparendo', 'solicitud-soportes-comparendo', 'fotomultas', 'derecho-de-peticion-eliminar-multa']);

function normalizeTrafficAnswers(input: FormAnswers): FormAnswers {
  const a = { ...input } as FormAnswers & Record<string, any>;
  const trami = a.tramiAnswers && typeof a.tramiAnswers === 'object' ? a.tramiAnswers : {};
  const simit = a.__simitRecord && typeof a.__simitRecord === 'object' ? { ...a.__simitRecord } : {};
  const first = (...values: unknown[]) => values.find(v => v !== undefined && v !== null && String(v).trim() !== '') as string | undefined;
  const nombre = first(a.nombre, a.nombreCompleto, trami.nombre, simit.name, simit.ownerName);
  const cedula = first(a.documento, a.documentNumber, a.numeroDocumento, a.cedula, trami.cedula, simit.documentNumber);
  const correo = first(a.correo, a.email, trami.correo, simit.email);
  const telefono = first(a.telefono, a.phone, trami.telefono, simit.phone);
  const numero = first(a.numero_comparendo, a.numero_acto, simit.number);
  const fecha = first(a.fecha_comparendo, simit.date);
  const entidad = first(a.entidad, a.autoridad, simit.authority);
  const municipio = first(a.municipio, a.ciudad, simit.municipality);
  const valor = first(a.valor, a.valor_multa, a.valorMulta, simit.value);
  const placa = first(a.placa, simit.plate);
  const codigo = first(a.codigo_infraccion, a.codigoInfraccion, simit.infractionCode, simit.code);
  if (nombre) { a.nombre = nombre; a.nombreCompleto = nombre; }
  if (cedula) { a.documento = cedula; a.documentNumber = cedula; a.cedula = cedula; }
  if (correo) { a.correo = correo; a.email = correo; }
  if (telefono) { a.telefono = telefono; a.phone = telefono; }
  if (numero) a.numero_comparendo = numero;
  if (fecha) a.fecha_comparendo = fecha;
  if (entidad) { a.entidad = entidad; a.autoridad = entidad; }
  if (municipio) a.municipio = municipio;
  if (valor) a.valor = valor;
  if (placa) a.placa = placa;
  if (codigo) a.codigo_infraccion = codigo;
  a.__simitRecord = { ...simit, number: first(simit.number, numero), date: first(simit.date, fecha), authority: first(simit.authority, entidad), municipality: first(simit.municipality, municipio), value: first(simit.value, valor), plate: first(simit.plate, placa), infractionCode: first(simit.infractionCode, codigo), documentNumber: first(simit.documentNumber, cedula), name: first(simit.name, nombre), ownerName: first(simit.ownerName, nombre), email: first(simit.email, correo), phone: first(simit.phone, telefono) };
  return a;
}

function documentContent(procedure: Procedure, answers: FormAnswers): string {
  const normalizedAnswers = trafficSlugs.has(procedure.slug) ? normalizeTrafficAnswers(answers) : answers;
  return trafficSlugs.has(procedure.slug) ? buildTrafficDocument(procedure.slug, normalizedAnswers) : buildDocumentText(procedure, normalizedAnswers);
}

function extractPetitions(content: string): string | null {
  const match = content.match(/(?:^|\n)(V|IX|X|XI|XII)\. PETICIONES\n([\s\S]*?)(?=\n(?:VI|X|XI|XII|XIII)\. |$)/i);
  if (!match) return null;
  return `${match[1].toUpperCase()}. PETICIONES\n${match[2].trim()}`.trim();
}
function hasDuplicatedTopLevelSections(content: string): boolean {
  const headings = content.match(/^(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII)\.\s+/gim) || [];
  const counts = new Map<string, number>();
  for (const heading of headings) { const key = heading.trim().toUpperCase(); counts.set(key, (counts.get(key) || 0) + 1); }
  return [...counts.values()].some(count => count > 1);
}
function preserveDeterministicPetitions(deterministic: string, refined: string): string {
  if (hasDuplicatedTopLevelSections(refined)) return deterministic;
  const sourcePetitions = extractPetitions(deterministic);
  if (!sourcePetitions) return deterministic;
  const target = refined.match(/(?:^|\n)(V|IX|X|XI|XII)\. PETICIONES\n([\s\S]*?)(?=\n(?:VI|X|XI|XII|XIII)\. |$)/i);
  if (!target) return deterministic;
  const start = target.index ?? 0; const block = target[0]; const leading = block.startsWith('\n') ? '\n' : '';
  const bodyStart = start + leading.length; const bodyEnd = bodyStart + block.slice(leading.length).length;
  return `${refined.slice(0, bodyStart)}${sourcePetitions}${refined.slice(bodyEnd)}`.replace(/\n{3,}/g, '\n\n').trim();
}
function finalizeTrafficDocument(content: string): string {
  const cleaned = cleanLegalDocumentOutput(content);
  if (!isLegallySafeTrafficDocument(cleaned)) throw new Error('TRAFFIC_DOCUMENT_SAFETY_REJECTED: el documento jurídico no superó las validaciones de integridad y no será entregado.');
  return cleaned;
}
async function buildFinalContent(procedure: Procedure, answers: FormAnswers): Promise<string> {
  const deterministic = finalizeTrafficDocument(documentContent(procedure, answers));
  if (!trafficSlugs.has(procedure.slug)) return deterministic;
  let refined = '';
  try { refined = await refineLegalDocument(deterministic); } catch (error) { console.error('DOCUMENT_REFINE_ERROR:', error); }
  if (!refined || refined.length < 500) return deterministic;
  const merged = preserveDeterministicPetitions(deterministic, refined);
  const finalContent = cleanLegalDocumentOutput(merged);
  return isLegallySafeTrafficDocument(finalContent) ? finalContent : deterministic;
}

function buildBasicFallbackContent(procedure: Procedure, answers: FormAnswers): string {
  const a = normalizeTrafficAnswers(answers) as FormAnswers & Record<string, any>;
  const simit = (a.__simitRecord || {}) as Record<string, any>;
  const text = (value: unknown) => value == null ? '' : String(value).trim();
  const applicant = text(a.nombre || a.nombreCompleto || simit.ownerName) || 'EL PETICIONARIO';
  const cedula = text(a.documento || a.cedula || simit.documentNumber) || 'NO INFORMADA';
  const authority = text(a.entidad || a.autoridad || simit.authority) || 'AUTORIDAD DE TRÁNSITO COMPETENTE';
  const number = text(a.numero_comparendo || simit.number) || 'NO IDENTIFICADO';
  const date = text(a.fecha_comparendo || simit.date);
  const email = text(a.correo || a.email);
  const phone = text(a.telefono || a.phone);
  return [
    new Date().toLocaleDateString('es-CO'), '', authority.toUpperCase(), '',
    'DERECHO DE PETICIÓN — REVISIÓN INTEGRAL DE LA ACTUACIÓN DE TRÁNSITO', '',
    `ASUNTO: Solicitud de revisión integral del comparendo ${number}${date ? ` — Fecha: ${date}` : ''}`,
    '', `Yo, ${applicant}, identificado con cédula de ciudadanía No. ${cedula}, presento respetuosamente derecho de petición.`, '',
    'I. PETICIONES', '',
    `1. Solicito la revisión integral del expediente administrativo relacionado con el comparendo No. ${number}.`,
    '2. Solicito copia íntegra del expediente, incluyendo comparendo, actos administrativos, constancias de notificación, ejecutoria y actuaciones de cobro que correspondan.',
    '3. Solicito informar de manera clara y verificable las actuaciones surtidas y la situación jurídica actual del comparendo.', '',
    'II. FUNDAMENTOS', '',
    'La presente solicitud se formula con base en la información suministrada por el peticionario y en el Estado de Cuenta SIMIT aportado, solicitando que la autoridad verifique directamente el expediente administrativo antes de adoptar cualquier decisión.', '',
    'Atentamente,', '', applicant, `C.C. No. ${cedula}`, email ? `Correo electrónico: ${email}` : '', phone ? `Teléfono: ${phone}` : ''
  ].filter(Boolean).join('\n').trim();
}

export function renderFallbackTemplate(procedure: Procedure, answers: FormAnswers): DocumentItem {
  const generatedAt = new Date().toISOString();
  const content = buildBasicFallbackContent(procedure, answers);
  const version = 1;
  return { id: generateId('doc'), title: `${procedure.title} - Documento generado`, procedureId: procedure.id, content, createdAt: generatedAt, generatedAt, version, status: 'ready', instanceId: undefined, sourceVersion: 'fallback-v1', snapshot: { answers: JSON.parse(JSON.stringify(normalizeTrafficAnswers(answers))), procedureSlug: procedure.slug, generatedAt, content } };
}

export async function generateDocument({ procedure, answers, previousVersion = 0, instanceId }: { procedure: Procedure; answers: FormAnswers; previousVersion?: number; instanceId?: string }): Promise<DocumentItem> {
  const generatedAt = new Date().toISOString();
  const version = Math.max(1, previousVersion + 1);
  let content: string;
  try {
    content = await buildFinalContent(procedure, answers);
  } catch (error) {
    console.error('CRITICAL_DOC_GEN_ERROR:', error);
    const fallback = renderFallbackTemplate(procedure, answers);
    return { ...fallback, instanceId, version, sourceVersion: `fallback-v${version}`, snapshot: { ...fallback.snapshot, answers: JSON.parse(JSON.stringify(normalizeTrafficAnswers(answers))), procedureSlug: procedure.slug, generatedAt, content: fallback.content } };
  }
  return { id: generateId('doc'), title: `${procedure.title} - Documento generado`, procedureId: procedure.id, content, createdAt: generatedAt, generatedAt, version, status: 'ready', instanceId, sourceVersion: `v${version}`, snapshot: { answers: JSON.parse(JSON.stringify(normalizeTrafficAnswers(answers))), procedureSlug: procedure.slug, generatedAt, content } };
}

export async function generateDocx({ procedure, answers }: { procedure: Procedure; answers: FormAnswers }): Promise<Uint8Array> { return renderDocx(await buildFinalContent(procedure, answers)); }
export async function generatePdf({ procedure, answers }: { procedure: Procedure; answers: FormAnswers }): Promise<Buffer> { return renderPdf(await buildFinalContent(procedure, answers)); }
export async function generateDocxFromContent(content: string): Promise<Uint8Array> { return renderDocx(content); }
export async function generatePdfFromContent(content: string): Promise<Buffer> { return renderPdf(content); }
function isHeading(line: string) { return /^(I\.|II\.|III\.|IV\.|V\.|VI\.|VII\.|VIII\.|IX\.|X\.|XI\.|XII\.|XIII\.|4\.\d+\.|ASUNTO:|REFERENCIA:|SOLICITANTE|DERECHO DE PETICIÓN|SOLICITUD DE|Respetados señores:|Atentamente,)/.test(line.trim()); }
async function renderDocx(content: string): Promise<Uint8Array> { const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx'); const paragraphs = content.split('\n').map(line => isHeading(line) ? new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: line, bold: true })] }) : new Paragraph({ children: [new TextRun(line)] })); return Packer.toBuffer(new Document({ sections: [{ properties: {}, children: paragraphs }] })); }
async function renderPdf(content: string): Promise<Buffer> { const PDFDocument = (await import('pdfkit')).default; return new Promise((resolve, reject) => { const pdf = new PDFDocument({ size: 'LETTER', margins: { top: 60, bottom: 60, left: 65, right: 65 } }); const chunks: Buffer[] = []; pdf.on('data', (chunk: Buffer) => chunks.push(chunk)); pdf.on('end', () => resolve(Buffer.concat(chunks))); pdf.on('error', reject); pdf.font('Helvetica').fontSize(11); for (const line of content.split('\n')) { if (!line.trim()) { pdf.moveDown(0.6); continue; } if (isHeading(line)) pdf.font('Helvetica-Bold').fontSize(11.5).text(line, { paragraphGap: 5 }); else pdf.font('Helvetica').fontSize(11).text(line, { align: 'left', lineGap: 3 }); } pdf.end(); }); }
