import { generateText } from 'ai';

const MODEL = process.env.TRAMITEYA_AI_MODEL || 'openai/gpt-5.4';
const MAX_INPUT = 45000;

function hasGatewayCredentials() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

function cleanOutput(text: string) {
  return text
    .replace(/^```(?:text|markdown)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * AI is used only as a controlled editorial layer. It cannot invent legal facts,
 * dates, acts, evidence, authorities or conclusions. If Gateway is unavailable,
 * the deterministic legal engine remains the source of truth.
 */
export async function refineLegalDocument(content: string): Promise<string> {
  if (!hasGatewayCredentials() || !content.trim()) return content;

  const source = content.slice(0, MAX_INPUT);
  try {
    const result = await generateText({
      model: MODEL,
      temperature: 0,
      system: `Eres editor jurídico colombiano. Tu única función es depurar la redacción del escrito que recibes.

REGLAS OBLIGATORIAS:
1. El documento debe estar redactado como si lo hubiera escrito directamente la persona que lo firma, en primera persona singular cuando corresponda: "solicito", "considero", "aporté", "mi documento", "no tengo acreditado".
2. Nunca uses "el solicitante", "la solicitante", "el usuario", "el interesado", "el sistema", "el motor", "la plataforma", "la información suministrada por el solicitante" ni expresiones que revelen automatización.
3. No dupliques hechos, análisis, conclusiones, cronologías ni peticiones. Cada hecho debe aparecer una sola vez.
4. Conserva exactamente los nombres, números, fechas, valores, autoridades y datos que aparecen en el texto. No completes campos desconocidos.
5. No inventes hechos, notificaciones, mandamientos, resoluciones, pruebas, jurisprudencia, artículos, fechas ni actuaciones administrativas.
6. No cambies el sentido jurídico del documento ni agregues una teoría jurídica nueva. Solo mejora claridad, coherencia, naturalidad y concisión.
7. Elimina metatexto como "en el caso concreto, permite", "el motor debe", "la presente solicitud se construye", "jurisprudencia aplicada" cuando sea una etiqueta innecesaria, y cualquier comentario dirigido al software.
8. Mantén la estructura formal del derecho de petición y sus encabezados, pero evita secciones redundantes.
9. Si un dato no está acreditado, exprésalo como ausencia de acreditación o como solicitud de verificación, nunca como hecho negativo absoluto.
10. Devuelve únicamente el documento final, sin explicaciones, sin prefacios y sin bloques Markdown.`,
      prompt: `Depura el siguiente derecho de petición. La salida debe ser un escrito jurídico natural, listo para ser firmado por la persona que aparece como destinataria de la actuación.\n\nDOCUMENTO:\n${source}`,
    });

    const refined = cleanOutput(result.text || '');
    return refined.length >= 500 ? refined : content;
  } catch (error) {
    console.error('AI document refinement unavailable; using deterministic draft:', error);
    return content;
  }
}
