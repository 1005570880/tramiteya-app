import { NextResponse } from 'next/server';
import { generateText } from 'ai';

export const runtime = 'nodejs';

const TRAMI_SYSTEM_PROMPT = `
Eres Trámi, el copiloto jurídico de TrámiteYa en Colombia.

NO preguntes al usuario qué figura jurídica quiere usar. Debes determinarla automáticamente a partir de la cronología, el expediente y sus respuestas.

REGLAS:
1. Máximo 2 o 3 párrafos cortos; usa viñetas y negrillas.
2. Distingue dato acreditado, manifestación del usuario e información pendiente de prueba.
3. PRESCRIPCIÓN: artículo 159 de la Ley 769 de 2002. No confundas fecha del comparendo con notificación del mandamiento de pago.
4. CADUCIDAD: artículo 161 de la Ley 769 de 2002. Analiza la actuación contravencional y su cronología específica.
5. PÉRDIDA DE EJECUTORIEDAD: artículo 91 del CPACA. Requiere acto en firme y análisis de las actuaciones de ejecución; no se presume por antigüedad.
6. Si una vía no es viable, descártala. Si varias son posibles, determina una principal y subsidiarias según la evidencia.
7. Nunca inventes fechas, notificaciones, actos, pagos o actuaciones.
8. Si faltan pruebas decisivas, identifica exactamente qué documento debe aportar la autoridad.
9. El Estado de Cuenta SIMIT individualiza registros, pero no sustituye el expediente administrativo.
10. Si el hecho tiene menos de tres años, NO afirmes que la sanción está prescrita.
11. Tono empático, claro, profesional y directo.
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
  const fact = parseDate(context.fecha); const resolution = parseDate(context.fechaResolucion); const executory = parseDate(context.fechaEjecutoria); const mandNotice = parseDate(context.fechaNotificacionMandamiento);
  const normalized = message.toLowerCase();
  if (normalized.includes('caduc')) {
    if (!fact) return 'Necesito la **fecha de los hechos** y la actuación que decidió el caso para cerrar el análisis de caducidad. El documento clave es la resolución y su constancia de notificación.';
    if (!resolution || yearsBetween(fact, resolution) > 1) return `La cronología del comparendo **${context.numero || ''}** permite plantear una **revisión de caducidad**, porque ${resolution ? 'la decisión reportada aparece posterior al año contado desde los hechos' : 'no está acreditada la fecha de la decisión sancionatoria'}. Debemos contrastarlo con el expediente.`;
    return 'Con los datos disponibles, la decisión aparece dentro del primer año desde los hechos, así que **no hay base suficiente para afirmar caducidad**. Conviene verificar audiencia, resolución, recursos y notificaciones.';
  }
  if (normalized.includes('ejecut')) {
    if (!executory) return 'La **pérdida de ejecutoriedad** requiere conocer cuándo quedó en firme el acto y qué actuaciones de ejecución realizó la autoridad. Si falta esa fecha, Trámi la solicitará dentro del expediente.';
    const age = yearsBetween(executory);
    return age >= 5 ? `Hay una **hipótesis relevante de pérdida de ejecutoriedad**: la firmeza se ubica en ${context.fechaEjecutoria} y han transcurrido aproximadamente ${age.toFixed(1)} años. Falta verificar las actuaciones de ejecución.` : `La resolución quedó en firme el **${context.fechaEjecutoria}**, pero aún no han transcurrido cinco años. Por ahora no es suficiente para afirmar pérdida de ejecutoriedad por ese supuesto.`;
  }
  if (normalized.includes('prescrit')) {
    if (!fact) return 'Para analizar **prescripción** necesito la fecha del hecho y, especialmente, la notificación del eventual mandamiento de pago.';
    const age = yearsBetween(fact);
    if (age < 3) return `El hecho es del **${context.fecha}** y todavía no han transcurrido tres años. **No puedo afirmar prescripción**. Debemos revisar la actuación sancionatoria y el eventual mandamiento de pago.`;
    if (mandNotice && yearsBetween(fact, mandNotice) < 3) return 'Por antigüedad el caso merece revisión, pero aparece una notificación de mandamiento dentro del término. **No sería responsable afirmar prescripción** sin revisar su eficacia y el expediente.';
    return `Por la fecha **${context.fecha}**, ya transcurrieron más de tres años desde el hecho. Existe una **hipótesis relevante de prescripción**, especialmente si no hubo notificación válida de mandamiento de pago dentro del término.`;
  }
  return `Estoy analizando el expediente del comparendo **${context.numero || ''}**. No necesitas escoger entre prescripción, caducidad o pérdida de ejecutoriedad: **Trámi lo determina con la cronología y tus respuestas**.`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) return NextResponse.json({ error: 'El mensaje es requerido.' }, { status: 400 });
    if (message.length > 4000) return NextResponse.json({ error: 'El mensaje es demasiado largo.' }, { status: 400 });
    const context = cleanContext(body?.comparendo);
    const answers = body?.answers && typeof body.answers === 'object' ? body.answers as Record<string, unknown> : {};
    const contextText = Object.entries(context).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
    const answersText = Object.entries(answers).filter(([, v]) => v).map(([k, v]) => `${k}: ${String(v).slice(0, 1000)}`).join('\n');
    const prompt = `CONTEXTO DEL EXPEDIENTE:\n${contextText || 'Sin comparendo seleccionado.'}\n\nRESPUESTAS:\n${answersText || 'Ninguna.'}\n\nMENSAJE:\n${message}`;
    const hasAiCredentials = Boolean(process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
    if (!hasAiCredentials) return NextResponse.json({ text: fallbackLegalReply(message, context), mode: 'fallback' });
    try {
      const { text } = await generateText({ model: 'openai/gpt-4o-mini', system: TRAMI_SYSTEM_PROMPT, prompt });
      return NextResponse.json({ text, mode: 'ai' });
    } catch (providerError) {
      console.error('Trámi provider error; using fallback:', providerError);
      return NextResponse.json({ text: fallbackLegalReply(message, context), mode: 'fallback' });
    }
  } catch (error) {
    console.error('Trámi chat error:', error);
    return NextResponse.json({ error: 'No fue posible responder en este momento.' }, { status: 500 });
  }
}
