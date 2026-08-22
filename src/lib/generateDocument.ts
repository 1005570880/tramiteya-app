import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import type { Procedure } from '../types';
import type { FormAnswers } from '../types/form';
import type { DocumentItem } from '../types/procedure';
import { buildDocumentText } from './documentTemplates';

function generateId(prefix = 'doc') {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

export async function generateDocument({ procedure, answers }: { procedure: Procedure; answers: FormAnswers }): Promise<DocumentItem> {
  const title = `${procedure.title} - Documento generado`;
  const content = buildDocumentText(procedure, answers);
  return {
    id: generateId('doc'),
    title,
    procedureId: procedure.id,
    content,
    createdAt: new Date().toISOString(),
    status: 'ready',
  };
}

export async function generateDocx({ procedure, answers }: { procedure: Procedure; answers: FormAnswers }): Promise<Uint8Array> {
  const content = buildDocumentText(procedure, answers);
  const paragraphs = content.split('\n').map((line) => {
    if (line === 'HECHOS' || line === 'PETICIÓN' || line === 'NOTIFICACIONES' || line === 'ANEXOS') {
      return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: line, bold: true })] });
    }
    return new Paragraph({ children: [new TextRun(line)] });
  });

  const document = new Document({ sections: [{ properties: {}, children: paragraphs }] });
  return Packer.toBuffer(document);
}
