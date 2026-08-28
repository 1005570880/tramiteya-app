import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export const runtime = 'nodejs';

const TRAMI_SYSTEM_PROMPT = `
Eres Trámi, el abogado virtual y copiloto jurídico de TrámiteYa en Colombia.

MISIÓN:
Con el expediente del comparendo y las respuestas del ciudadano, debes determinar automáticamente la vía jurídica más sólida. El ciudadano NO debe escoger entre caducidad, prescripción, pérdida de fuerza ejecutoria, notificación, debido proceso, revocatoria u otra vía. Esa decisión corresponde a Trámi.

REGLAS DE ACTUACIÓN:
1. BREVEDAD: máximo 2 o 3 párrafos cortos. Usa viñetas y negrillas.
2. DIAGNÓSTICO PRIMERO: demuestra que entendiste el expediente antes de pedir información. Explica brevemente qué dato jurídico hace relevante el caso.
3. PREGUNTAS MÍNIMAS: nunca preguntes algo que ya esté en el Estado de Cuenta, el expediente o las respuestas anteriores. Pregunta solo aquello que pueda cambiar la estrategia o sea indispensable para completar el documento.
4. IDENTIDAD: el documento debe contener nombre completo, cédula, correo electrónico y teléfono cuando el ciudadano los suministre. No dejes campos de identidad vacíos si ya fueron aportados.
5. PRESCRIPCIÓN: artículo 159 de la Ley 769 de 2002. No confundas fecha del hecho/comparendo con la notificación del mandamiento de pago. Si han transcurrido menos de tres años desde el hecho, NO afirmes que la sanción está prescrita.
6. CADUCIDAD: artículo 161 de la Ley 769 de 2002. Analiza la actuación contravencional y su cronología específica. No confundas caducidad de la acción con prescripción de la sanción.
7. PÉRDIDA DE FUERZA EJECUTORIA: artículo 91 del CPACA. Exige acto administrativo en firme y analiza la ejecución efectiva; la antigüedad del comparendo por sí sola no basta.
8. NOTIFICACIÓN: distingue notificación de la orden de comparendo, acto sancionatorio y mandamiento de pago. La sola afirmación del ciudadano no sustituye la constancia documental.
9. COBRO: embargo, cobro coactivo o mandamiento de pago son datos jurídicamente relevantes. Pregunta por ellos de forma sencilla, sin jerga innecesaria.
10. EVIDENCIA: distingue dato acreditado, manifestación del ciudadano e información pendiente de prueba. Nunca inventes fechas, resoluciones, notificaciones, pagos, embargos ni actuaciones.
11. SIMIT: el Estado de Cuenta individualiza registros, pero no sustituye el expediente administrativo.
12. ESTRATEGIA: si una vía no es viable, descártala. Si varias son plausibles, determina una principal y subsidiarias según la evidencia.
13. FUERA DE ÁMBITO: si preguntan algo ajeno al tránsito o derecho administrativo colombiano, redirige brevemente a TrámiteYa.
14. TONO: empático, seguro, pedagógico, profesional y directo. Habla como un abogado de confianza, no como un formulario.
15. NO PROMETAS RESULTADOS: puedes hablar de viabilidad, hipótesis o fortaleza jurídica, pero no garantizar una decisión favorable.
`;

type TrafficContext = {
  numero?: string; fecha?: string; organismo?: string; municipio?: string; valor?: string;
  fechaResolucion?: string; fechaEjecutoria?: string; fechaMandamiento?: string;
  fechaNotificacionMandamiento?: string; documentNumber?: string; placa?: string;
  codigoInfraccion?: string; estado?: string;
};

function cleanContext(value: unknown): TrafficContext {
  if (!value || typeof value !== 'object') return {};
  const input = value as Record<string, unknown>;
  const text = (v: unknown, max = 200) => v == null ? undefined : String(v).trim().slice(0, max) || undefined;
  return {
    numero: text(input.numero, 100), fecha: text(input.fecha, 50), organismo: text(input.organismo), municipio: text(input.municipio, 100),
    valor: text(input.valor, 50), fechaResolucion: text(input.fechaResolucion, 50), fechaEjecutoria: text(input.fechaEjecutoria, 50),
    fechaMandamiento: text(input.fechaMandamiento, 50), fechaNotificacionMandamiento: text(input.fechaNotificacionMandamiento, 50),
    documentNumber: text(input.documentNumber, 30), placa: text(input.placa, 30), codigoInfraccion: text(input.codigoInfraccion, 30), estado: text(input.estado, 100),
  };
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const m = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d;
}
function yearsBetween(from: Date, to = new Date()) { return (to.getTime() - from.getTime()) / (365.2425 * 86400000); }

function fallbackLegalReply(message: string, context: TrafficContext) {
  const fact = parseDate(context.fecha); const executory = parseDate(context.fechaEjecutoria); const mandNotice = parseDate(context.fechaNotificacionMandamiento);
  const normalized = message.toLowerCase();
  if (normalized.includes('caduc')) {
    if (!fact) return 'Necesito la **fecha de los hechos** y la actuación que decidió el caso para cerrar el análisis de caducidad. El documento clave es la resolución y su constancia de notificación.';
    const resolution = parseDate(context.fechaResolucion);
    if (!resolution || yearsBetween(fact, resolution) > 1) return `La cronología del comparendo **${context.numero || ''}** permite plantear una **revisión de caducidad**, porque ${resolution ? 'la decisión reportada aparece posterior al año contado desde los hechos' : 'no está acreditada la fecha de la decisión sancionatoria'}. Debemos contrastarlo con el expediente.`;
    return 'Con los datos disponibles, la decisión aparece dentro del primer año desde los hechos, así que **no hay base suficiente para afirmar caducidad**. Conviene verificar audiencia, resolución, recursos y notificaciones.';
  }
  if (normalized.includes('ejecut')) {
    if (!executory) return 'La **pérdida de fuerza ejecutoria** requiere conocer cuándo quedó en firme el acto y qué actuaciones de ejecución realizó la autoridad. Si falta esa fecha, Trámi la solicitará dentro del expediente.';
    const age = yearsBetween(executory);
    return age >= 5 ? `Hay una **hipótesis relevante de pérdida de fuerza ejecutoria**: la firmeza se ubica en ${context.fechaEjecutoria} y han transcurrido aproximadamente ${age.toFixed(1)} años. Falta verificar las actuaciones de ejecución.` : `La resolución quedó en firme el **${context.fechaEjecutoria}**, pero aún no han transcurrido cinco años. Por ahora no es suficiente para afirmar pérdida de fuerza ejecutoria por ese supuesto.`;
  }
  if (normalized.includes('prescrit')) {
    if (!fact) return 'Para analizar **prescripción** necesito la fecha del hecho y, especialmente, la notificación del eventual mandamiento de pago.';
    const age = yearsBetween(fact);
    if (age < 3) return `El hecho es del **${context.fecha}** y todavía no han transcurrido tres años. **No puedo afirmar prescripción**. Debemos revisar la actuación sancionatoria y el eventual mandamiento de pago.`;
    if (mandNotice && yearsBetween(fact, mandNotice) < 3) return 'Por antigüedad el caso merece revisión, pero aparece una notificación de mandamiento dentro del término. **No sería responsable afirmar prescripción** sin revisar su eficacia y el expediente.';
    return `Por la fecha **${context.fecha}**, ya transcurrieron más de tres años desde el hecho. Existe una **hipótesis relevante de prescripción**, especialmente si no hubo notificación válida de mandamiento de pago.`;
  }
  return `Estoy analizando el expediente del comparendo **${context.numero || ''}**. No necesitas escoger entre prescripción, caducidad o pérdida de fuerza ejecutoria: **Trámi lo determina con la cronología y tus respuestas**.`;
}

const apiKey = process.env.GROQ_API_KEY || '';
const isOpenRouter = apiKey.startsWith('sk-or-v1-');
const client = apiKey ? new Groq({ apiKey, ...(isOpenRouter ? { baseURL: 'https://openrouter.ai/api/v1' } : {}) }) : null;
const modelName = isOpenRouter ? 'meta-llama/llama-3.3-70b-instruct:free' : 'llama-3.3-70b-versatile';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((m): m is Record<string, unknown> => Boolean(m) && typeof m === 'object')
    .map((m): ChatMessage => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: typeof m.content === 'string' ? m.content.slice(0, 4000) : '',
    }))
    .filter((m): m is ChatMessage => Boolean(m.content));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const legacyMessages = normalizeMessages(body?.messages);
    const currentMessage = message || legacyMessages.filter(m => m.role === 'user').at(-1)?.content || '';
    if (!currentMessage) return NextResponse.json({ error: 'El mensaje es requerido.' }, { status: 400 });
    if (currentMessage.length > 4000) return NextResponse.json({ error: 'El mensaje es demasiado largo.' }, { status: 400 });

    const context = cleanContext(body?.comparendo || body?.recordContext);
    const answers = body?.answers && typeof body.answers === 'object' ? body.answers as Record<string, unknown> : {};
    const contextText = Object.entries(context).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
    const answersText = Object.entries(answers).filter(([, v]) => v).map(([k, v]) => `${k}: ${String(v).slice(0, 1000)}`).join('\n');
    const prompt = `CONTEXTO DEL EXPEDIENTE:\n${contextText || 'Sin comparendo seleccionado.'}\n\nRESPUESTAS DEL CIUDADANO:\n${answersText || 'Ninguna.'}`;

    if (!client) return NextResponse.json({ text: fallbackLegalReply(currentMessage, context), mode: 'fallback' });

    const conversation: ChatMessage[] = legacyMessages.length ? legacyMessages : [{ role: 'user', content: currentMessage }];
    const last = conversation[conversation.length - 1];
    if (!last || last.role !== 'user' || last.content !== currentMessage) conversation.push({ role: 'user', content: currentMessage });

    try {
      const completion = await client.chat.completions.create({
        model: modelName,
        messages: [{ role: 'system', content: `${TRAMI_SYSTEM_PROMPT}\n\n${prompt}` }, ...conversation],
        temperature: 0.3,
        max_tokens: 400,
      });
      const text = completion.choices[0]?.message?.content?.trim() || fallbackLegalReply(currentMessage, context);
      return NextResponse.json({ text, mode: 'ai' });
    } catch (providerError) {
      console.error('Trámi provider error; using fallback:', providerError);
      return NextResponse.json({ text: fallbackLegalReply(currentMessage, context), mode: 'fallback' });
    }
  } catch (error) {
    console.error('Trámi API error:', error);
    return NextResponse.json({ text: 'En este momento tengo un inconveniente de conexión. Puedes continuar y Trámi retomará el expediente.', mode: 'fallback' }, { status: 200 });
  }
}
