import type { Procedure } from '../types';
import type { FormAnswers } from '../types/form';
import type { DocumentItem } from '../types/procedure';
import { buildDocumentText } from './documentTemplates';
import { generateStrictTrafficDocument } from './strictTrafficDocumentGenerator';

const TRAFFIC_SLUGS = new Set([
  'prescripcion-comparendo',
  'caducidad-comparendo',
  'revocatoria-comparendo',
  'solicitud-soportes-comparendo',
  'fotomultas',
  'derecho-de-peticion-eliminar-multa',
]);

function generateId(prefix = 'doc') {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

/**
 * Single document assembly entry point.
 * Traffic documents use the strict legal generator so that header resolution,
 * ordinal numbering, first-person narrative and paragraph boundaries happen
 * exactly once instead of being rebuilt by the API and generic assembler.
 */
export async function generateDocument({
  procedure,
  answers,
  previousVersion = 0,
  instanceId,
}: {
  procedure: Procedure;
  answers: FormAnswers;
  previousVersion?: number;
  instanceId?: string;
}): Promise<DocumentItem> {
  const version = Math.max(1, previousVersion + 1);

  if (TRAFFIC_SLUGS.has(procedure.slug)) {
    const strictDocument = await generateStrictTrafficDocument(procedure, answers, instanceId);
    return {
      ...strictDocument,
      version,
      instanceId,
      sourceVersion: `strict-v${version}`,
      snapshot: {
        ...strictDocument.snapshot,
        generatedAt: strictDocument.generatedAt,
      },
    };
  }

  const generatedAt = new Date().toISOString();
  const content = normalizeDocumentContent(buildDocumentText(procedure, answers));

  if (!content || content.length < 100) {
    throw new Error('DOCUMENT_EMPTY: la plantilla no produjo contenido suficiente.');
  }

  return {
    id: generateId('doc'),
    title: `${procedure.title} - Documento generado`,
    procedureId: procedure.id,
    content,
    createdAt: generatedAt,
    generatedAt,
    version,
    status: 'ready',
    instanceId,
    sourceVersion: `v${version}`,
    snapshot: {
      answers: JSON.parse(JSON.stringify(answers)),
      procedureSlug: procedure.slug,
      generatedAt,
      content,
    },
  };
}

/**
 * Preserve real paragraph boundaries. Never collapse document blocks with
 * join('') or whitespace-only concatenation.
 */
function normalizeDocumentContent(content: string): string {
  return String(content || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function generateDocx({
  procedure,
  answers,
}: {
  procedure: Procedure;
  answers: FormAnswers;
}): Promise<Uint8Array> {
  const document = await generateDocument({ procedure, answers });
  return renderDocx(document.content);
}

export async function generatePdf({
  procedure,
  answers,
}: {
  procedure: Procedure;
  answers: FormAnswers;
}): Promise<Buffer> {
  const document = await generateDocument({ procedure, answers });
  return renderPdf(document.content);
}

export async function generateDocxFromContent(content: string): Promise<Uint8Array> {
  return renderDocx(content);
}

export async function generatePdfFromContent(content: string): Promise<Buffer> {
  return renderPdf(content);
}

function isHeading(line: string) {
  return /^(?:I\.|II\.|III\.|IV\.|V\.|VI\.|VII\.|VIII\.|IX\.|X\.|XI\.|XII\.|XIII\.|ASUNTO:|REFERENCIA:|SOLICITANTE|DERECHO DE PETICIÓN|SOLICITUD DE|Respetados señores:|Atentamente,)/i.test(line.trim());
}

async function renderDocx(content: string): Promise<Uint8Array> {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx');
  const normalized = normalizeDocumentContent(content);
  const paragraphs = normalized.split('\n\n').filter(Boolean).map((block) => {
    const lines = block.split('\n');
    return new Paragraph({
      heading: isHeading(lines[0]) ? HeadingLevel.HEADING_2 : undefined,
      spacing: { after: 180, line: 276 },
      children: lines.map((line, index) => new TextRun({ text: line, break: index === 0 ? 0 : 1 })),
    });
  });

  return Packer.toBuffer(new Document({
    sections: [{ properties: {}, children: paragraphs }],
  }));
}

async function renderPdf(content: string): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  const normalized = normalizeDocumentContent(content);

  return new Promise<Buffer>((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'LETTER', margins: { top: 60, bottom: 60, left: 65, right: 65 } });
    const chunks: Buffer[] = [];
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    pdf.font('Helvetica').fontSize(11);
    for (const block of normalized.split('\n\n').filter(Boolean)) {
      for (const line of block.split('\n')) {
        if (!line.trim()) continue;
        if (isHeading(line)) {
          pdf.font('Helvetica-Bold').fontSize(11.5).text(line, { paragraphGap: 5 });
        } else {
          pdf.font('Helvetica').fontSize(11).text(line, { align: 'left', lineGap: 3 });
        }
      }
      pdf.moveDown(0.6);
    }
    pdf.end();
  });
}
