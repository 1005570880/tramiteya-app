import type { Procedure } from '../types';
import type { FormAnswers } from '../types/form';
import type { DocumentItem } from '../types/procedure';
import { buildDocumentText } from './documentTemplates';
import { buildTrafficDocument } from './trafficDocumentTemplates';
import { refineLegalDocument } from './aiDocumentRefiner';

function generateId(prefix = 'doc') { return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`; }
const trafficSlugs = new Set(['prescripcion-comparendo', 'caducidad-comparendo', 'revocatoria-comparendo', 'solicitud-soportes-comparendo', 'fotomultas', 'derecho-de-peticion-eliminar-multa']);
function documentContent(procedure: Procedure, answers: FormAnswers): string {
  return trafficSlugs.has(procedure.slug) ? buildTrafficDocument(procedure.slug, answers) : buildDocumentText(procedure, answers);
}

function extractPetitions(content: string): string | null {
  const match = content.match(/(?:^|\n)(V|IX)\. PETICIONES\n([\s\S]*?)(?=\n(?:VI|X)\. |$)/i);
  if (!match) return null;
  return `${match[1].toUpperCase()}. PETICIONES\n${match[2].trim()}`.trim();
}

function preserveDeterministicPetitions(deterministic: string, refined: string): string {
  const sourcePetitions = extractPetitions(deterministic);
  if (!sourcePetitions) return refined;
  const target = refined.match(/(?:^|\n)(V|IX)\. PETICIONES\n([\s\S]*?)(?=\n(?:VI|X)\. |$)/i);
  if (!target) return deterministic;
  const replacement = `\n${sourcePetitions}\n`;
  const start = target.index ?? 0;
  const block = target[0];
  const leading = block.startsWith('\n') ? '\n' : '';
  const body = block.slice(leading.length);
  const bodyStart = start + leading.length;
  const bodyEnd = bodyStart + body.length;
  return `${refined.slice(0, bodyStart)}${sourcePetitions}${refined.slice(bodyEnd)}`.replace(/\n{3,}/g, '\n\n').trim();
}

async function buildFinalContent(procedure: Procedure, answers: FormAnswers): Promise<string> {
  const deterministic = documentContent(procedure, answers);
  if (!trafficSlugs.has(procedure.slug)) return deterministic;

  const refined = await refineLegalDocument(deterministic);
  if (!refined || refined.length < 500) return deterministic;

  // La IA solo puede mejorar estilo. Las PETICIONES determinísticas son la fuente de verdad
  // para evitar que una reescritura elimine la pretensión principal o la solicitud de depuración.
  return preserveDeterministicPetitions(deterministic, refined);
}

export async function generateDocument({ procedure, answers, previousVersion = 0, instanceId }: { procedure: Procedure; answers: FormAnswers; previousVersion?: number; instanceId?: string }): Promise<DocumentItem> {
  const generatedAt = new Date().toISOString();
  const version = Math.max(1, previousVersion + 1);
  const content = await buildFinalContent(procedure, answers);
  return { id: generateId('doc'), title: `${procedure.title} - Documento generado`, procedureId: procedure.id, content, createdAt: generatedAt, generatedAt, version, status: 'ready', instanceId, sourceVersion: `v${version}`, snapshot: { answers: JSON.parse(JSON.stringify(answers)), procedureSlug: procedure.slug, generatedAt, content } };
}

export async function generateDocx({ procedure, answers }: { procedure: Procedure; answers: FormAnswers }): Promise<Uint8Array> { return renderDocx(await buildFinalContent(procedure, answers)); }
export async function generatePdf({ procedure, answers }: { procedure: Procedure; answers: FormAnswers }): Promise<Buffer> { return renderPdf(await buildFinalContent(procedure, answers)); }
export async function generateDocxFromContent(content: string): Promise<Uint8Array> { return renderDocx(content); }
export async function generatePdfFromContent(content: string): Promise<Buffer> { return renderPdf(content); }

function isHeading(line: string) {
  return /^(I\.|II\.|III\.|IV\.|V\.|VI\.|VII\.|VIII\.|IX\.|X\.|4\.\d+\.|ASUNTO:|REFERENCIA:|SOLICITANTE|DERECHO DE PETICIÓN|SOLICITUD DE|Respetados señores:|Atentamente,)/.test(line.trim());
}
async function renderDocx(content: string): Promise<Uint8Array> {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx');
  const paragraphs = content.split('\n').map(line => isHeading(line) ? new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: line, bold: true })] }) : new Paragraph({ children: [new TextRun(line)] }));
  return Packer.toBuffer(new Document({ sections: [{ properties: {}, children: paragraphs }] }));
}
async function renderPdf(content: string): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'LETTER', margins: { top: 60, bottom: 60, left: 65, right: 65 } });
    const chunks: Buffer[] = [];
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
    pdf.font('Helvetica').fontSize(11);
    for (const line of content.split('\n')) {
      if (!line.trim()) { pdf.moveDown(0.6); continue; }
      if (isHeading(line)) pdf.font('Helvetica-Bold').fontSize(11.5).text(line, { paragraphGap: 5 });
      else pdf.font('Helvetica').fontSize(11).text(line, { align: 'left', lineGap: 3 });
    }
    pdf.end();
  });
}
