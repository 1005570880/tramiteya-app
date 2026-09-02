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
    const generatedAt = strictDocument.generatedAt ?? strictDocument.createdAt ?? new Date().toISOString();

    return {
      ...strictDocument,
      version,
      instanceId,
      generatedAt,
      sourceVersion: `strict-v${version}`,
      snapshot: {
        ...strictDocument.snapshot,
        generatedAt,
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
