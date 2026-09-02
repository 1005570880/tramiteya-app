import type { Procedure } from '../types';
import type { FormAnswers } from '../types/form';
import type { DocumentItem } from '../types/procedure';
import { buildDocumentText } from './documentTemplates';
import { generateStrictTrafficDocument } from './strictTrafficDocumentGenerator';

const TRAFFIC_SLUGS = new Set(['prescripcion-comparendo','caducidad-comparendo','revocatoria-comparendo','solicitud-soportes-comparendo','fotomultas','derecho-de-peticion-eliminar-multa']);
const ORDINALES = ['PRIMERO','SEGUNDO','TERCERO','CUARTO','QUINTO','SEXTO','SÉPTIMO','OCTAVO','NOVENO','DÉCIMO'];

function generateId(prefix = 'doc') { return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`; }
function answerValue(answers: FormAnswers, ...keys: string[]): string { const source = answers as FormAnswers & Record<string, unknown>; for (const key of keys) { const value = source[key]; if (value !== undefined && value !== null && String(value).trim()) return String(value).trim(); } return ''; }
function cleanMarkdown(value: string): string {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function buildHeader(municipality: string): string {
  const cleanCity = String(municipality || 'SANTA MARTA').toUpperCase().trim();
  if (cleanCity.includes('SANTA MARTA')) return 'SEÑORES\nSECRETARÍA DE TRÁNSITO Y MOVILIDAD DEL DISTRITO DE SANTA MARTA\nE. S. D.';
  if (cleanCity.includes('SAMPUES') || cleanCity.includes('SAMPUÉS')) return 'SEÑORES\nSECRETARÍA DE TRÁNSITO Y TRANSPORTE MUNICIPAL DE SAMPUÉS - SUCRE\nE. S. D.';
  return `SEÑORES\nSECRETARÍA DE TRÁNSITO Y TRANSPORTE MUNICIPAL DE ${cleanCity}\nE. S. D.`;
}
function removeHeaders(content: string, municipality: string): string {
  const city = String(municipality || '').toUpperCase().trim();
  return content.split('\n').filter((line) => {
    const t = line.trim();
    if (/^SEÑORES:?$/i.test(t) || /^E\.\s*S\.\s*D\.?$/i.test(t)) return false;
    if (/^SECRETAR[IÍ]A DE TR[AÁ]NSITO/i.test(t)) return false;
    if (city && t.toUpperCase() === city) return false;
    return true;
  }).join('\n').replace(/^\s*\n+/, '').trim();
}
function buildFacts(answers: FormAnswers): string {
  const cedula = answerValue(answers, 'cedula', 'documento', 'documentNumber') || '________________';
  const numero = answerValue(answers, 'numero_comparendo', 'numeroComparendo') || '________________';
  const fecha = answerValue(answers, 'fecha_comparendo', 'fechaComparendo') || '________________';
  const facts = [
    `Me identifico con la cédula de ciudadanía No. ${cedula} y actúo en nombre propio.`,
    `En el Estado de Cuenta SIMIT figura la infracción o actuación No. ${numero} con fecha ${fecha}.`,
    'Manifiesto bajo la gravedad del juramento que no he sido notificado formalmente en mi domicilio de acuerdo con el debido proceso constitucional.',
    'No fui citado a audiencia pública de descargos ni se me garantizó el derecho a la defensa antes de la imposición de la sanción.',
    'Aporto como único soporte disponible el Estado de Cuenta del SIMIT, al no contar con copia íntegra del expediente administrativo.',
  ];
  return facts.map((fact, index) => `${ORDINALES[index]}: ${fact}`).join('\n\n');
}
function replaceFacts(content: string, facts: string): string {
  const heading = /(^|\n)(?:[IVXLCDM]+\.\s*)?(?:\*\*)?HECHOS(?: Y ANTECEDENTES)?\s*:?(?:\*\*)?/im;
  const match = heading.exec(content);
  if (!match) return `${content}\n\nI. HECHOS Y ANTECEDENTES\n\n${facts}`.trim();
  const start = match.index + (match[1] ? match[1].length : 0);
  const remainder = content.slice(start);
  const headingEnd = remainder.indexOf('\n');
  const afterHeading = headingEnd >= 0 ? remainder.slice(headingEnd + 1) : '';
  const next = /(^|\n)(?:[IVXLCDM]+\.\s*)?(?:FUNDAMENTOS(?: DE DERECHO)?|PRETENSIONES|PETICIONES|SOLICITUDES|PRUEBAS|ANEXOS|NOTIFICACIONES|ATENTAMENTE)\b/im.exec(afterHeading);
  if (!next) return `${content.slice(0, start)}I. HECHOS Y ANTECEDENTES\n\n${facts}`.trim();
  const nextStart = next.index + (next[1] ? next[1].length : 0);
  return `${content.slice(0, start)}I. HECHOS Y ANTECEDENTES\n\n${facts}\n\n${afterHeading.slice(nextStart).replace(/^\s+/, '')}`.trim();
}
function buildCleanTrafficContent(content: string, answers: FormAnswers): string {
  const source = answers as FormAnswers & Record<string, any>;
  const simit = source.__simitRecord && typeof source.__simitRecord === 'object' ? source.__simitRecord : {};
  const municipality = answerValue(answers, 'ciudad', 'municipio') || String(simit.municipality || 'SANTA MARTA').trim();
  const cleaned = cleanMarkdown(content)
    .replace(/La estrategia jurídica se determina[^.]*durante el\s*\./gi, '')
    .replace(/Tr[aá]mi no presenta esa fecha como prescripci[oó]n configurada:?[^.]*\./gi, '')
    .replace(/Frente a la oportunidad de defensa,\s*(?:el solicitante\s*)?manifiesta:\s*nunca\.?/gi, 'Manifiesto que no se me garantizó el derecho a la defensa ni fui citado a audiencia pública antes de la imposición de la sanción.')
    .replace(/Respecto de pagos(?:\s+o acuerdos)?,\s*(?:el solicitante\s*)?manifiesta:\s*completo\.?/gi, 'Indico que no he realizado acuerdos de pago que impliquen renuncia a los términos normativos de notificación o prescripción.')
    .replace(/\n{3,}/g, '\n\n').trim();
  const body = replaceFacts(removeHeaders(cleaned, municipality), buildFacts(answers));
  return `${buildHeader(municipality)}\n\n${body}`.replace(/\n{3,}/g, '\n\n').trim();
}

export async function generateDocument({ procedure, answers, previousVersion = 0, instanceId }: { procedure: Procedure; answers: FormAnswers; previousVersion?: number; instanceId?: string; }): Promise<DocumentItem> {
  const version = Math.max(1, previousVersion + 1);
  if (TRAFFIC_SLUGS.has(procedure.slug)) {
    const generated = await generateStrictTrafficDocument(procedure, answers, instanceId);
    const generatedAt = generated.generatedAt ?? generated.createdAt ?? new Date().toISOString();
    const content = buildCleanTrafficContent(generated.content, answers);
    return { ...generated, content, version, instanceId, generatedAt, sourceVersion: `clean-legal-v${version}`, snapshot: { answers: JSON.parse(JSON.stringify(answers)), procedureSlug: procedure.slug, generatedAt, content } };
  }
  const generatedAt = new Date().toISOString();
  const content = normalizeDocumentContent(buildDocumentText(procedure, answers));
  if (!content || content.length < 100) throw new Error('DOCUMENT_EMPTY: la plantilla no produjo contenido suficiente.');
  return { id: generateId('doc'), title: `${procedure.title} - Documento generado`, procedureId: procedure.id, content, createdAt: generatedAt, generatedAt, version, status: 'ready', instanceId, sourceVersion: `v${version}`, snapshot: { answers: JSON.parse(JSON.stringify(answers)), procedureSlug: procedure.slug, generatedAt, content } };
}
function normalizeDocumentContent(content: string): string { return String(content || '').replace(/\r\n?/g, '\n').split('\n').map((line) => line.trimEnd()).join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(); }
export async function generateDocx({ procedure, answers }: { procedure: Procedure; answers: FormAnswers }): Promise<Uint8Array> { return renderDocx((await generateDocument({ procedure, answers })).content); }
export async function generatePdf({ procedure, answers }: { procedure: Procedure; answers: FormAnswers }): Promise<Buffer> { return renderPdf((await generateDocument({ procedure, answers })).content); }
export async function generateDocxFromContent(content: string): Promise<Uint8Array> { return renderDocx(content); }
export async function generatePdfFromContent(content: string): Promise<Buffer> { return renderPdf(content); }
function isHeading(line: string) { return /^(?:I\.|II\.|III\.|IV\.|V\.|VI\.|VII\.|VIII\.|IX\.|X\.|XI\.|XII\.|XIII\.|ASUNTO:|REFERENCIA:|SOLICITANTE|DERECHO DE PETICIÓN|SOLICITUD DE|Respetados señores:|Atentamente,)/i.test(line.trim()); }
async function renderDocx(content: string): Promise<Uint8Array> { const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx'); const normalized = normalizeDocumentContent(content); const paragraphs = normalized.split('\n\n').filter(Boolean).map((block) => { const lines = block.split('\n'); return new Paragraph({ heading: isHeading(lines[0]) ? HeadingLevel.HEADING_2 : undefined, spacing: { after: 180, line: 276 }, children: lines.map((line, index) => new TextRun({ text: line, break: index === 0 ? 0 : 1 })) }); }); return Packer.toBuffer(new Document({ sections: [{ properties: {}, children: paragraphs }] })); }
async function renderPdf(content: string): Promise<Buffer> { const PDFDocument = (await import('pdfkit')).default; const normalized = normalizeDocumentContent(content); return new Promise<Buffer>((resolve, reject) => { const pdf = new PDFDocument({ size: 'LETTER', margins: { top: 60, bottom: 60, left: 65, right: 65 } }); const chunks: Buffer[] = []; pdf.on('data', (chunk: Buffer) => chunks.push(chunk)); pdf.on('end', () => resolve(Buffer.concat(chunks))); pdf.on('error', reject); pdf.font('Helvetica').fontSize(11); for (const block of normalized.split('\n\n').filter(Boolean)) { for (const line of block.split('\n')) { if (!line.trim()) continue; if (isHeading(line)) pdf.font('Helvetica-Bold').fontSize(11.5).text(line, { paragraphGap: 5 }); else pdf.font('Helvetica').fontSize(11).text(line, { align: 'left', lineGap: 3 }); } pdf.moveDown(0.6); } pdf.end(); }); }
