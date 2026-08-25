import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import PDFDocument from 'pdfkit';
import type { Procedure } from '../types';
import type { FormAnswers } from '../types/form';
import type { DocumentItem } from '../types/procedure';
import { buildDocumentText } from './documentTemplates';
import { buildTrafficDocument } from './trafficDocumentTemplates';
import { runLegalAiEngine } from './legalAiEngine';

function generateId() { return crypto.randomUUID(); }

const trafficSlugs = new Set(['prescripcion-comparendo', 'caducidad-comparendo', 'revocatoria-comparendo', 'solicitud-soportes-comparendo', 'fotomultas']);

function inferVertical(procedure: Procedure) {
  const value = `${procedure.slug} ${procedure.category} ${procedure.title}`.toLowerCase();
  if (/salud|medic|eps|tutela/.test(value)) return 'salud';
  if (/habeas|datacredito|transunion|credit|reporte/.test(value)) return 'habeas-data';
  if (/contrato|arrendamiento|laboral|prestaci[oó]n|compraventa/.test(value)) return 'contratos';
  if (/transito|tr[aá]nsito|comparendo|multa|fotomulta|embargo/.test(value)) return 'transito';
  if (/petici[oó]n/.test(value)) return 'derecho-de-peticion';
  if (/tutela/.test(value)) return 'tutela';
  return procedure.category || 'general';
}

function documentContent(procedure: Procedure, answers: FormAnswers): string {
  return trafficSlugs.has(procedure.slug) ? buildTrafficDocument(procedure.slug, answers) : buildDocumentText(procedure, answers);
}

function cleanInternalMetadata(content: string) {
  return content
    .replace(/\n?CRITERIO DE SELECCIÓN[\s\S]*$/i, '')
    .replace(/\n?ADVERTENCIA DE REVISIÓN[\s\S]*$/i, '')
    .replace(/\n?FUNDAMENTO NORMATIVO DE REFERENCIA\s*$/i, '')
    .replace(/\n?Fuente:\s*https?:\/\/\S+/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function buildFinalContent(procedure: Procedure, answers: FormAnswers): Promise<string> {
  const baseContent = documentContent(procedure, answers);
  const hasSimitData = Boolean((answers as any).__simitData?.source === 'SIMIT');
  const ai = await runLegalAiEngine({
    vertical: inferVertical(procedure),
    procedure: procedure.slug,
    facts: answers as unknown as Record<string, unknown>,
    documentType: procedure.title,
    draftingInstructions: [
      'Redacta el documento final como un abogado colombiano: hechos, procedencia cuando corresponda, fundamentos constitucionales y legales, jurisprudencia pertinente, aplicación al caso, pretensiones o solicitudes, pruebas/anexos, notificaciones y cierre.',
      'Relaciona cada regla jurídica con los hechos concretos. No agregues hechos que el usuario no suministró.',
      'Usa únicamente las normas y providencias que estén en la biblioteca jurídica versionada recibida por el motor.',
      'No incluyas URLs, fuentes, metadatos, criterios de selección, advertencias del sistema ni texto sobre la IA dentro del documento.',
      hasSimitData
        ? 'DATOS SIMIT: existe información estructurada obtenida mediante la integración de consulta SIMIT. Trátala como información externa verificable del sistema, no como una declaración del usuario. Úsala para reconstruir cronologías y hechos objetivos (número de comparendo, fecha, organismo, infracción, estado, resolución y valores) únicamente cuando el dato exista. Si existe contradicción entre SIMIT y lo manifestado por el usuario, no la resuelvas inventando: formula la discrepancia de manera prudente y solicita/propone verificar el soporte oficial.'
        : 'No existe información SIMIT disponible. No inventes datos de comparendos ni cronologías.',
      'Si SIMIT aporta una fecha o estado, no la conviertas automáticamente en una conclusión jurídica. La consecuencia jurídica debe derivarse de la biblioteca normativa y jurisprudencial vigente y de los hechos acreditados.',
      `DOCUMENTO BASE:\n${baseContent.slice(0, 18000)}`,
    ].join('\n\n'),
  });

  if (ai.verified && ai.draft.trim().length > 100) return cleanInternalMetadata(ai.draft);
  return cleanInternalMetadata(baseContent);
}

export async function generateDocument({ procedure, answers, previousVersion = 0, instanceId }: { procedure: Procedure; answers: FormAnswers; previousVersion?: number; instanceId?: string }): Promise<DocumentItem> {
  const generatedAt = new Date().toISOString();
  const version = Math.max(1, previousVersion + 1);
  const content = await buildFinalContent(procedure, answers);
  return { id: generateId(), title: `${procedure.title} - Documento generado`, procedureId: procedure.id, content, createdAt: generatedAt, generatedAt, version, status: 'ready', instanceId, sourceVersion: `v${version}`, snapshot: { answers: JSON.parse(JSON.stringify(answers)), procedureSlug: procedure.slug, generatedAt, content } };
}

export async function generateDocx({ procedure, answers }: { procedure: Procedure; answers: FormAnswers }): Promise<Uint8Array> {
  return renderDocx(await buildFinalContent(procedure, answers));
}

export async function generatePdf({ procedure, answers }: { procedure: Procedure; answers: FormAnswers }): Promise<Buffer> {
  return renderPdf(await buildFinalContent(procedure, answers));
}

export async function generateDocxFromContent(content: string): Promise<Uint8Array> { return renderDocx(cleanInternalMetadata(content)); }
export async function generatePdfFromContent(content: string): Promise<Buffer> { return renderPdf(cleanInternalMetadata(content)); }

function isHeading(line: string) {
  return /^(HECHOS|PETICIÓN|PRETENSIONES|FUNDAMENTOS DE DERECHO|FUNDAMENTOS JURÍDICOS|DERECHOS FUNDAMENTALES|PRUEBAS|ANEXOS|NOTIFICACIONES|JURAMENTO|MEDIDA PROVISIONAL|PRIMERA\.|SEGUNDA\.|TERCERA\.|CUARTA\.|QUINTA\.|SEXTA\.|SÉPTIMA\.|I\.|II\.|III\.|IV\.|V\.|VI\.|VII\.|VIII\.|IX\.|X\.)/.test(line);
}

function renderDocx(content: string): Uint8Array | Promise<Uint8Array> {
  const paragraphs = content.split('\n').map(line => isHeading(line)
    ? new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: line, bold: true })] })
    : new Paragraph({ children: [new TextRun(line)] }));
  return Packer.toBuffer(new Document({ sections: [{ properties: {}, children: paragraphs }] }));
}

function renderPdf(content: string): Promise<Buffer> {
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
