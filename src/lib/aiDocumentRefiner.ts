import { generateText } from 'ai';

const MODEL = process.env.TRAMITEYA_AI_MODEL || 'openai/gpt-5.4';
const MAX_INPUT = 45000;
const REFINEMENT_TIMEOUT_MS = 7000;
function hasGatewayCredentials() { return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN); }
function refinementEnabled() { return process.env.TRÁMITEYA_AI_DOCUMENT_REFINEMENT === 'true' || process.env.TRAMITEYA_AI_DOCUMENT_REFINEMENT === 'true'; }
function cleanOutput(text: string) { return text.replace(/^```(?:text|markdown)?\s*/i, '').replace(/\s*```$/i, '').replace(/^\s+|\s+$/g, '').replace(/\n{3,}/g, '\n\n'); }

function hasRequiredRelief(text: string): boolean {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const hasPetitions = /(?:^|\n)\s*(?:v|ix|x)\.?\s+peticiones\b/.test(normalized);
  const hasDeletion = /(elimin|cancel|depur|actualiz).{0,180}(multa|comparendo|registro|simit)|(multa|comparendo|registro|simit).{0,180}(elimin|cancel|depur|actualiz)/s.test(normalized);
  const hasTermination = /(termin|archive).{0,180}(obligacion|cobro|sancion)|(obligacion|cobro|sancion).{0,180}(termin|archive)/s.test(normalized);
  return hasPetitions && hasDeletion && hasTermination;
}

function hasDuplicatedMajorSections(text: string): boolean {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const headings = [
    'i. objeto', 'ii. hechos', 'iii. fundamentos de derecho', 'iv. analisis del caso concreto',
    'v. peticiones', 'vi. anexos', 'vii. notificaciones', 'viii. conclusion juridica', 'ix. peticiones'
  ];
  return headings.some((heading) => {
    const matches = normalized.match(new RegExp(`(?:^|\\n)\\s*${heading.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}(?:\\s|$)`, 'g'));
    return Boolean(matches && matches.length > 1);
  });
}

function structurallySafe(text: string): boolean {
  const compact = cleanOutput(text);
  if (compact.length < 500) return false;
  if (hasDuplicatedMajorSections(compact)) return false;
  if (!hasRequiredRelief(compact)) return false;
  return true;
}

export async function refineLegalDocument(content: string): Promise<string> {
  // Document generation must never depend on an external LLM. The deterministic
  // legal engine is the source of truth; AI refinement is an optional enhancement.
  // This prevents the user from being left indefinitely on "Trámi está redactando".
  if (!refinementEnabled() || !hasGatewayCredentials() || !content.trim()) return content;

  try {
    const result = await Promise.race([
      generateText({
        model: MODEL,
        temperature: 0,
        system: `Eres editor jurídico colombiano. Convierte el derecho de petición recibido en un escrito que parezca redactado directamente por la persona que lo firma.
REGLAS ABSOLUTAS:
1. Usa primera persona del ciudadano: "solicito", "aporté", "mi documento", "no tengo acreditado", "considero".
2. Nunca uses "solicitante", "interesado", "usuario", "cliente", "sistema", "motor", "plataforma", "IA" ni expresiones que revelen automatización.
3. No agregues una presentación si ya existe y no repitas el objeto en la introducción.
4. Los hechos deben aparecer una sola vez. No los vuelvas a enumerar en análisis o conclusiones.
5. No dupliques el cálculo temporal: explícalo una sola vez y conserva solo su consecuencia necesaria.
6. Las solicitudes concretas deben quedar en PETICIONES. Puedes mencionarlas en OBJETO únicamente como una pretensión resumida, pero no las repitas como listas.
7. Elimina metatexto como "jurisprudencia aplicada", "en el caso concreto, permite", "el motor debe" y comentarios dirigidos al software.
8. No inventes hechos, fechas, valores, resoluciones, notificaciones, mandamientos, pruebas, jurisprudencia ni actuaciones.
9. Si un dato no está acreditado, exprésalo como falta de acreditación y pide su verificación; nunca lo conviertas en hecho negativo absoluto.
10. NO DEBILITES LA PRETENSIÓN PRINCIPAL. Si el documento solicita declarar prescripción, caducidad, pérdida de fuerza ejecutoria, dejar sin efectos una sanción u otra consecuencia favorable, debes conservar esa solicitud de manera expresa y clara en PETICIONES.
11. Cuando jurídicamente proceda como consecuencia de la causal analizada, conserva expresamente la solicitud de TERMINAR LA OBLIGACIÓN y de ORDENAR LA ELIMINACIÓN, CANCELACIÓN O ACTUALIZACIÓN DEL REGISTRO DE LA MULTA/ACTUACIÓN en SIMIT y demás sistemas de información, dentro de las competencias de la entidad. No sustituyas esa pretensión por una simple solicitud de información.
12. No confundas comparendo, sanción/multa, acción de cobro y registro en SIMIT. La consecuencia debe corresponder a la causal identificada.
13. Si la causal todavía es hipotética porque falta prueba, formula la pretensión de forma condicional: "si se verifica que... solicito que se declare...". No conviertas una hipótesis en hecho probado.
14. Redacta con estructura jurídica profesional, compacta y natural. Debe sonar a una persona que presenta personalmente una petición bien fundamentada, no a una plantilla ni a un informe de auditoría.
15. Devuelve únicamente el documento final.`,
        prompt: `Depura este documento respetando todas las reglas y conserva sus pretensiones favorables:\n\n${content.slice(0, MAX_INPUT)}`,
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('AI refinement timeout')), REFINEMENT_TIMEOUT_MS)),
    ]);

    const refined = cleanOutput(result.text || '');
    return structurallySafe(refined) ? refined : content;
  } catch (error) {
    console.warn('AI document refinement unavailable; using deterministic draft:', error);
    return content;
  }
}