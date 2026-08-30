import { generateText } from 'ai';

const MODEL = process.env.TRAMITEYA_AI_MODEL || 'openai/gpt-5.4';
const MAX_INPUT = 50000;
const AI_TIMEOUT_MS = 14000;

function hasGatewayCredentials() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

function aiEnabled() {
  return process.env.TRAMITEYA_AI_DOCUMENT_REFINEMENT === 'true' || process.env.TRÁMITEYA_AI_DOCUMENT_REFINEMENT === 'true';
}

function normalize(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function cleanOutput(text: string) {
  return text
    .replace(/^```(?:text|markdown)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

function hasSection(text: string, names: string[]) {
  const n = normalize(text);
  return names.some(name => new RegExp(`(?:^|\\n)\\s*(?:[ivxlcdm]+\\.)?\\s*${normalize(name).replace(/\s+/g, '\\s+')}\\b`, 'i').test(n));
}

function hasRequiredRelief(text: string) {
  const n = normalize(text);
  const hasRequests = hasSection(text, ['peticiones', 'pretensiones']);
  if (!hasRequests) return false;
  const requestArea = n.slice(Math.max(0, n.search(/(?:peticiones|pretensiones)/)));
  const hasDocumentRelief = /(entreg|remit|copi|inform|identific|acredit|verific)/.test(requestArea);
  const hasCaseRelief = /(termin|archiv|declar|prescri|caduc|ejecutor|dejar sin efectos|depur|actualiz|cancel|elimin)/.test(requestArea);
  return hasDocumentRelief && hasCaseRelief;
}

function hasDuplicatedMajorSections(text: string) {
  const normalized = normalize(text);
  const headings = [
    'i. objeto', 'i. hechos', 'ii. hechos', 'ii. consideraciones juridicas del caso concreto',
    'iii. fundamentos de derecho', 'iv. peticiones', 'iv. pretensiones', 'v. anexos', 'vi. notificaciones',
  ];
  return headings.some(heading => {
    const escaped = normalize(heading).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = normalized.match(new RegExp(`(?:^|\\n)\\s*${escaped}(?:\\s|$)`, 'g'));
    return Boolean(matches && matches.length > 1);
  });
}

function hasForbiddenAutomationLanguage(text: string) {
  return /\b(?:motor|sistema|ia|inteligencia artificial|usuario|cliente|triaje|prompt|plantilla|algoritmo)\b/i.test(text);
}

function structurallySafe(text: string) {
  const compact = cleanOutput(text);
  if (compact.length < 700) return false;
  if (hasDuplicatedMajorSections(compact)) return false;
  if (!hasRequiredRelief(compact)) return false;
  if (hasForbiddenAutomationLanguage(compact)) return false;
  return true;
}

function extractCoreFacts(content: string) {
  const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
  const relevant = lines.filter(line => /^(PETICIONARIO|C\.C\.|REFERENCIA|FECHA|INFRACCIÓN|INFRACCION|VALOR|PRIMERO:|SEGUNDO:|TERCERO:|CUARTO:|QUINTO:|SEXTO:|SÉPTIMO:|SEPTIMO:|OCTAVO:|NOVENO:|DÉCIMA|DÉCIMO|III\.|IV\.)/i.test(line));
  return relevant.join('\n').slice(0, 18000);
}

export async function refineLegalDocument(content: string): Promise<string> {
  if (!aiEnabled() || !hasGatewayCredentials() || !content.trim()) return content;

  const facts = extractCoreFacts(content);

  try {
    const result = await Promise.race([
      generateText({
        model: MODEL,
        temperature: 0,
        system: `Eres el MOTOR JURÍDICO DE TRÁMITEYA, especializado en derecho administrativo sancionatorio y tránsito colombiano. Tu función NO es embellecer superficialmente un texto: debes hacer una revisión jurídica profunda del caso y entregar un escrito final técnicamente sólido.

PRINCIPIO CENTRAL:
Los datos determinísticos del documento son la fuente de hechos. La IA puede razonar, organizar, seleccionar normas, detectar inconsistencias y mejorar la argumentación, pero JAMÁS puede inventar hechos, fechas, actos, notificaciones, pagos, mandamientos, expedientes, jurisprudencia o pruebas.

MÉTODO OBLIGATORIO ANTES DE REDACTAR:
A) IDENTIFICA el objeto real de la petición y separa: comparendo, procedimiento contravencional, sanción/multa, ejecutoria, acción de cobro y registro SIMIT.
B) CONSTRUYE mentalmente una línea de tiempo con las fechas disponibles. Si falta una fecha crítica, no la inventes: conviértela en punto de verificación.
C) CLASIFICA LA HIPÓTESIS JURÍDICA: debido proceso/notificación, caducidad, prescripción de la acción de cobro, pérdida de ejecutoriedad, cobro coactivo, corrección/depuración del registro, o combinación compatible de ellas.
D) DETERMINA qué hechos están acreditados y cuáles solamente necesitan acreditación documental.
E) SELECCIONA únicamente las normas y precedentes pertinentes a esa hipótesis. No introduzcas prescripción o cobro coactivo en un caso reciente solo porque existe una multa.
F) TRADUCE EL ANÁLISIS EN PRETENSIONES CONCRETAS, conservando la consecuencia jurídica favorable que esté respaldada por el caso.

REGLAS JURÍDICAS:
1. Aplica la Constitución, Ley 1755 de 2015, Ley 769 de 2002, Ley 1437 de 2011, Ley 1066 de 2006 y Estatuto Tributario SOLO cuando correspondan al supuesto analizado.
2. No confundas la fecha del comparendo con la fecha de imposición de la sanción, ejecutoria, mandamiento de pago o notificación del mandamiento.
3. Un registro SIMIT no sustituye el expediente administrativo ni demuestra por sí solo todas las actuaciones procesales.
4. Para prescripción de cobro, exige la reconstrucción de las fechas jurídicamente relevantes. Si hay mandamiento de pago, analiza su fecha de notificación y las actuaciones posteriores conforme al régimen aplicable.
5. Para pérdida de ejecutoriedad, distingue la causal temporal del artículo 91 del CPACA de la prescripción de la acción de cobro. No las presentes como sinónimos.
6. Para comparendos recientes, prioriza debido proceso, citación, audiencia, notificación, decisión, ejecutoria y derecho de defensa cuando esos sean los puntos controvertidos.
7. No afirmes que una irregularidad de notificación produce automáticamente una nulidad o falta de competencia. Expón la consecuencia solo si los hechos y la norma aplicable la sustentan.
8. La Sentencia C-038 de 2020 puede utilizarse para desarrollar las garantías constitucionales pertinentes en materia sancionatoria de tránsito, pero no atribuyas a la sentencia una regla que no establezca.
9. Si citas jurisprudencia, conserva solo precedentes que ya estén en el documento o cuya referencia sea suficientemente segura. Nunca inventes radicados ni citas textuales.
10. Si existe una hipótesis favorable pero falta prueba, formula una pretensión condicional: "si se verifica que... solicito que...".
11. Si la evidencia ya permite sostener una consecuencia jurídica, formula la pretensión directamente y de manera contundente.

REDACCIÓN:
12. Todo el escrito debe estar en primera persona cuando hable el ciudadano: "solicito", "manifiesto", "mi documento", "no fui notificado", "tuve conocimiento".
13. Los hechos deben ser naturales, concretos y cronológicos. Evita frases mecánicas o de triaje.
14. No uses "el solicitante", "el peticionario" para referirte al ciudadano dentro de su propia narración. En anexos sí puede aparecer "el suscrito peticionario" cuando sea gramaticalmente necesario.
15. No repitas los hechos literalmente en el análisis jurídico.
16. No repitas las peticiones en varias secciones.
17. Mantén títulos profesionales: I. HECHOS, II. CONSIDERACIONES JURÍDICAS DEL CASO CONCRETO, III. FUNDAMENTOS DE DERECHO, IV. PRETENSIONES, V. ANEXOS, VI. NOTIFICACIONES.
18. Las pretensiones deben numerarse en letras: PRIMERA, SEGUNDA, TERCERA...; si son más de diez, usa DÉCIMA PRIMERA, DÉCIMA SEGUNDA, etc.
19. Las pretensiones deben ser accionables y específicas: identificar acto, pedir copia, acreditar notificación, informar ejecutoria, verificar cobro, declarar consecuencia cuando corresponda y ordenar depuración/actualización cuando jurídicamente proceda.
20. Conserva siempre la información factual original: número, fecha, código, valor, nombre, documento y organismo.
21. No introduzcas Markdown (tres acentos graves, encabezados con almohadillas o texto entre asteriscos). Devuelve texto jurídico limpio.
22. Devuelve ÚNICAMENTE el documento final, sin explicación sobre lo que hiciste.`,
        prompt: `REVISIÓN JURÍDICA PROFUNDA DEL SIGUIENTE ESCRITO.

DATOS CLAVE EXTRAÍDOS:
${facts}

DOCUMENTO COMPLETO:
${content.slice(0, MAX_INPUT)}

Antes de devolverlo, verifica internamente: (1) que la hipótesis jurídica corresponda a la antigüedad y actuaciones acreditadas; (2) que no hayas inventado ningún dato; (3) que no hayas confundido comparendo, sanción, ejecutoria, cobro y SIMIT; (4) que las pretensiones sean concretas y coherentes con el análisis; (5) que el documento parezca redactado por un abogado y ciudadano real, no por software.`
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('AI legal engine timeout')), AI_TIMEOUT_MS)),
    ]);

    const refined = cleanOutput(result.text || '');
    return structurallySafe(refined) ? refined : content;
  } catch (error) {
    console.warn('AI legal engine unavailable; deterministic legal draft retained:', error);
    return content;
  }
}
