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

const ORDINALES = [
  'PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO', 'SEXTO', 'SÉPTIMO', 'OCTAVO',
];

function generateId(prefix = 'doc') {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function answerValue(answers: FormAnswers, ...keys: string[]): string {
  const source = answers as FormAnswers & Record<string, unknown>;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function buildHeader(municipality: string) {
  const cleanCity = (municipality || '').toUpperCase().trim();
  let authority = `SECRETARÍA DE TRÁNSITO Y TRANSPORTE MUNICIPAL DE ${cleanCity}`;

  if (cleanCity.includes('SANTA MARTA')) {
    authority = 'SECRETARÍA DE TRÁNSITO Y MOVILIDAD DEL DISTRITO DE SANTA MARTA';
  } else if (cleanCity.includes('SAMPUES') || cleanCity.includes('SAMPUÉS')) {
    authority = 'SECRETARÍA DE TRÁNSITO Y TRANSPORTE MUNICIPAL DE SAMPUÉS - SUCRE';
  }

  return `SEÑORES\n${authority}\nE. S. D.`;
}

function buildCleanTrafficContent(content: string, answers: FormAnswers): string {
  const municipality = answerValue(answers, 'ciudad', 'municipio');
  const cedula = answerValue(answers, 'cedula', 'documento', 'documentNumber');
  const numeroComparendo = answerValue(answers, 'numero_comparendo', 'numeroComparendo');
  const fechaComparendo = answerValue(answers, 'fecha_comparendo', 'fechaComparendo');

  const hechosLista = [
    `Me identifico con la cédula de ciudadanía No. ${cedula || '________________'} y actúo en nombre propio.`,
    `En el Estado de Cuenta SIMIT figura el comparendo/actuación No. ${numeroComparendo || '________________'} con fecha ${fechaComparendo || '________________'}.`,
    `Manifiesto bajo la gravedad del juramento que no he sido notificado formalmente en mi domicilio de acuerdo con el debido proceso.`,
    `No fui citado a audiencia pública de descargos ni existe resolución sancionatoria en firme notificada en debida forma.`,
    `Aporto como único soporte el Estado de Cuenta SIMIT, al no contar con copia del expediente administrativo.`,
  ];

  const hechosSeccion = hechosLista
    .map((hecho, i) => `${ORDINALES[i]}: ${hecho}`)
    .join('\n\n');

  let clean = normalizeDocumentContent(content)
    .replace(/La estrategia jurídica se determina a partir de la cronología y de las respuestas suministradas durante el \./gi, '')
    .replace(/La estrategia jur[ií]dica se determina[^.]*durante el\s*\./gi, '')
    .replace(/Tr[aá]mi no presenta esa fecha como prescripci[oó]n configurada:?[^.]*\./gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // The legal engine may produce its own HECHOS block. Replace it entirely
  // so facts are generated once, in first person, with word-based ordinals.
  const factsHeading = /(^|\n)(?:[IVXLCDM]+\.\s*)?HECHOS\s*:?/im;
  const match = factsHeading.exec(clean);
  if (match && match.index >= 0) {
    const start = match.index + (match[1] ? match[1].length : 0);
    const afterHeading = clean.slice(start);
    const nextSection = /\n(?:[IVXLCDM]+\.\s+)?(?:FUNDAMENTOS(?: DE DERECHO)?|PRETENSIONES|PETICIONES|SOLICITUDES|PRUEBAS|ANEXOS|NOTIFICACIONES|ATENTAMENTE)\b/i.exec(afterHeading.slice(afterHeading.indexOf('\n') + 1));
    if (nextSection) {
      const relativeStart = afterHeading.indexOf('\n') + 1 + nextSection.index;
      clean = `${clean.slice(0, start)}HECHOS\n\n${hechosSeccion}\n\n${afterHeading.slice(relativeStart).replace(/^\s+/, '')}`.trim();
    } else {
      clean = `${clean.slice(0, start)}HECHOS\n\n${hechosSeccion}`.trim();
    }
  } else {
    clean = `${clean}\n\nHECHOS\n\n${hechosSeccion}`.trim();
  }

  // Remove every previously assembled recipient/header line, then prepend one canonical header.
  clean = clean
    .split('\n')
    .filter((line) => {
      const value = line.trim();
      return !/^SEÑORES:?$/i.test(value) && !/^E\.\s*S\.\s*D\.?$/i.test(value) &&
        !/^SECRETAR[IÍ]A DE TR[AÁ]NSITO/i.test(value);
    })
    .join('\n')
    .replace(/^\s*\n+/, '')
    .trim();

  return `${buildHeader(municipality)}\n\n${clean}`
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

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
    const generated = await generateStrictTrafficDocument(procedure, answers, instanceId);
    const generatedAt = generated.generatedAt ?? generated.createdAt ?? new Date().toISOString();
    const content = buildCleanTrafficContent(generated.content, answers);

    return {
      ...generated,
      content,
      version,
      instanceId,
      generatedAt,
      sourceVersion: `clean-legal-v${version}`,
      snapshot: {
        answers: JSON.parse(JSON.stringify(answers)),
        procedureSlug: procedure.slug,
        generatedAt,
        content,
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
