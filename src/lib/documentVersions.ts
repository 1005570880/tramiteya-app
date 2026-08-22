import type { DocumentItem, ProcedureInstance } from '../types/procedure';

export type DocumentVersion = DocumentItem & { version: number; generatedAt: string };

export function nextDocumentVersion(instance: ProcedureInstance): number {
  return (instance.document?.version ?? 0) + 1;
}

export function createDocumentVersion(instance: ProcedureInstance, content: string): DocumentVersion {
  const version = nextDocumentVersion(instance);
  const generatedAt = new Date().toISOString();
  return {
    id: `doc_${instance.id}_v${version}`,
    title: instance.document?.title ?? `${instance.procedureSlug} - Documento generado`,
    procedureId: instance.procedureId,
    content,
    createdAt: generatedAt,
    generatedAt,
    version,
    status: 'ready',
  };
}
