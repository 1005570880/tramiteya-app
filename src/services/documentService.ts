import type { FormAnswers } from '../types/form';
import type { Procedure } from '../types';
import type { DocumentItem } from '../types/procedure';

// Server-side generator endpoint helper

export async function generateDocumentServer({ procedure, answers }: { procedure: Procedure; answers: FormAnswers }): Promise<DocumentItem> {
  // Keep simple textual template
  const id = `doc_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const title = `${procedure.title} - Documento generado`;
  const content = `Documento: ${title}\n\nRespuestas: ${JSON.stringify(answers, null, 2)}`;
  return { id, title, procedureId: procedure.id, content, createdAt: new Date().toISOString(), status: 'ready' };
}
