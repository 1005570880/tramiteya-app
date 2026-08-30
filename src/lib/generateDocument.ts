export async function generateDocument({ procedure, answers, previousVersion = 0, instanceId }: { procedure: Procedure; answers: FormAnswers; previousVersion?: number; instanceId?: string }): Promise<DocumentItem> {
  const generatedAt = new Date().toISOString(); const version = Math.max(1, previousVersion + 1); const content = await buildFinalContent(procedure, answers);
  return { id: generateId('doc'), title: `${procedure.title} - Documento generado`, procedureId: procedure.id, content, createdAt: generatedAt, generatedAt, version, status: 'ready', instanceId, sourceVersion: `v${version}`, snapshot: { answers: JSON.parse(JSON.stringify(normalizeTrafficAnswers(answers))), procedureSlug: procedure.slug, generatedAt, content } };
}
export async function generateDocx({ procedure, answers }: { procedure: Procedure; answers: FormAnswers }): Promise<Uint8Array> { return renderDocx(await buildFinalContent(procedure, answers)); }
export async function generatePdf({ procedure, answers }: { procedure: Procedure; answers: FormAnswers }): Promise<Buffer> { return renderPdf(await buildFinalContent(procedure, answers)); }
export async function generateDocxFromContent(content: string): Promise<Uint8Array> { return renderDocx(content); }
export async function generatePdfFromContent(content: string): Promise<Buffer> { return renderPdf(content); }

function isHeading(line: string) {
  return /^(I\.|II\.|III\.|IV\.|V\.|VI\.|VII\.|VIII\.|IX\.|X\.|XI\.|XII\.|XIII\.|ASUNTO:|REFERENCIA:|SOLICITANTE|DERECHO DE PETICIÓN|SOLICITUD DE|Respetados señores:|Atentamente,)/.test(line.trim());
}
async function renderDocx(content: string): Promise<Uint8Array> {
  const { Document, Packer, Paragraph, TextRun } = await import('docx');
  const paragraphs = content.split('\n').map(line => {
    const heading = isHeading(line);
    return new Paragraph({ alignment: 'both', spacing: { line: 276, after: heading ? 120 : 80 }, children: [new TextRun({ text: line, bold: heading, font: 'Arial Narrow', size: 24 })] });
  });
  return Packer.toBuffer(new Document({ styles: { default: { document: { run: { font: 'Arial Narrow', size: 24 } } } }, sections: [{ properties: {}, children: paragraphs }] }));
}
async function renderPdf(content: string): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'LETTER', margins: { top: 60, bottom: 60, left: 65, right: 65 } });
    const chunks: Buffer[] = [];
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk)); pdf.on('end', () => resolve(Buffer.concat(chunks))); pdf.on('error', reject);
    for (const line of content.split('\n')) {
      if (!line.trim()) { pdf.moveDown(0.6); continue; }
      const heading = isHeading(line);
      pdf.font(heading ? 'Helvetica-Bold' : 'Helvetica').fontSize(12).fillColor('#000000').text(line, { align: 'justify', lineGap: 2, paragraphGap: heading ? 5 : 3 });
    }
    pdf.end();
  });
}
