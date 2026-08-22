import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import PDFDocument from 'pdfkit';
import type { Procedure } from '../types';
import type { FormAnswers } from '../types/form';
import type { DocumentItem } from '../types/procedure';
import { buildDocumentText } from './documentTemplates';

function generateId(prefix = 'doc') { return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`; }

export async function generateDocument({ procedure, answers }: { procedure: Procedure; answers: FormAnswers }): Promise<DocumentItem> {
  return { id: generateId('doc'), title: `${procedure.title} - Documento generado`, procedureId: procedure.id, content: buildDocumentText(procedure, answers), createdAt: new Date().toISOString(), status: 'ready' };
}

function isHeading(line: string) { return /^(HECHOS|PETICIÓN|NOTIFICACIONES|ANEXOS|PRIMERA\.|SEGUNDA\.|TERCERA\.|CUARTA\.|QUINTA\.|SEXTA\.|SÉPTIMA\.|I\.|II\.|III\.|IV\.|V\.)/.test(line); }

export async function generateDocx({ procedure, answers }: { procedure: Procedure; answers: FormAnswers }): Promise<Uint8Array> {
  const paragraphs = buildDocumentText(procedure, answers).split('\n').map((line) => isHeading(line) ? new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: line, bold: true })] }) : new Paragraph({ children: [new TextRun(line)] }));
  return Packer.toBuffer(new Document({ sections: [{ properties: {}, children: paragraphs }] }));
}

export async function generatePdf({ procedure, answers }: { procedure: Procedure; answers: FormAnswers }): Promise<Buffer> {
  const content = buildDocumentText(procedure, answers);
  return await new Promise<Buffer>((resolve, reject) => {
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
