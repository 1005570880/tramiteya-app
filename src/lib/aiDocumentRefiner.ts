import { generateText } from 'ai';

const MODEL = process.env.TRAMITEYA_AI_MODEL || 'openai/gpt-5.4';
const MAX_INPUT = 45000;
function hasGatewayCredentials() { return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN); }
function cleanOutput(text: string) { return text.replace(/^```(?:text|markdown)?\s*/i, '').replace(/\s*```$/i, '').replace(/^\s+|\s+$/g, '').replace(/\n{3,}/g, '\n\n'); }
export async function refineLegalDocument(content: string): Promise<string> {
  if (!hasGatewayCredentials() || !content.trim()) return content;
  try {
    const result = await generateText({
      model: MODEL,
      temperature: 0,
      system: `Eres editor jurídico colombiano. Convierte el derecho de petición recibido en un escrito que parezca redactado directamente por la persona que lo firma.
REGLAS ABSOLUTAS:
1. Usa primera persona del ciudadano: "solicito", "aporté", "mi documento", "no tengo acreditado", "considero".
2. Nunca uses "solicitante", "interesado", "usuario", "cliente", "sistema", "motor", "plataforma", "IA" o expresiones que revelen automatización.
3. No agregues una presentación si ya existe. No repitas el objeto en la introducción.
4. Los hechos deben aparecer una sola vez. No los vuelvas a enumerar en análisis o conclusiones.
5. El cálculo temporal se desarrolla una sola vez en el análisis; en cronología y conclusión solo se conserva lo indispensable.
6. Las solicitudes concretas deben quedar únicamente en PETICIONES; no las dupliques en otras secciones.
7. Elimina metatexto como "jurisprudencia aplicada", "en el caso concreto, permite", "el motor debe" y cualquier comentario dirigido al software.
8. No inventes hechos, fechas, valores, resoluciones, notificaciones, mandamientos, pruebas, jurisprudencia ni actuaciones. Conserva exactamente los datos existentes.
9. Si un dato no está acreditado, exprésalo como falta de acreditación y pide su verificación; nunca lo conviertas en hecho negativo absoluto.
10. No alteres el sentido jurídico ni introduzcas una teoría nueva.
11. Redacta con estructura jurídica profesional, pero compacta y natural. Debe sonar a un ciudadano que presenta personalmente una petición bien fundamentada, no a una plantilla.
12. Devuelve únicamente el documento final.`,
      prompt: `Depura este documento respetando todas las reglas:\n\n${content.slice(0, MAX_INPUT)}`,
    });
    const refined = cleanOutput(result.text || '');
    return refined.length >= 500 ? refined : content;
  } catch (error) {
    console.error('AI document refinement unavailable; using deterministic draft:', error);
    return content;
  }
}
