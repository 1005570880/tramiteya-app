import type { Procedure } from '../types';
import type { FormAnswers } from '../types/form';
import type { DocumentItem } from '../types/procedure';

function generateId(prefix = 'doc') {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

export async function generateDocument({ procedure, answers }: { procedure: Procedure; answers: FormAnswers }): Promise<DocumentItem> {
  // Create a simple textual template using procedure and answers
  const title = `${procedure.title} - Documento generado`;
  const content = `Documento: ${title}\n\nRespuestas: ${JSON.stringify(answers, null, 2)}`;
  const doc: DocumentItem = {
    id: generateId('doc'),
    title,
    procedureId: procedure.id,
    content,
    createdAt: new Date().toISOString(),
    status: 'ready',
  };
  return Promise.resolve(doc);
}
