export async function generateDocument(procedureId: string, answers: unknown) {
  // Placeholder for document generation pipeline.
  // Later this will use templates, rules and AI services.
  return `Documento para ${procedureId} — datos: ${JSON.stringify(answers).slice(0, 200)}`;
}
