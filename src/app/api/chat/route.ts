import { NextResponse } from 'next/server';
import { generateText } from 'ai';

export const runtime = 'nodejs';

const TRAMI_SYSTEM_PROMPT = `
Eres Trámi, el copiloto jurídico interactivo de TrámiteYa en Colombia.

OBJETIVO:
Orientar de forma práctica sobre comparendos, multas y actuaciones administrativas de tránsito. Debes distinguir PRESCRIPCIÓN, CADUCIDAD y PÉRDIDA DE EJECUTORIEDAD (también llamada pérdida de fuerza ejecutoria) y explicar cuál tiene elementos de viabilidad según la cronología acreditada.

REGLAS:
1. BREVEDAD: máximo 2 o 3 párrafos cortos, preferiblemente con viñetas y **negrillas**.
2. PRESCRIPCIÓN: el artículo 159 de la Ley 769 de 2002 establece un término de tres (3) años para las sanciones de tránsito y la interrupción por la notificación del mandamiento de pago. No confundas la fecha del comparendo con la fecha de notificación del mandamiento. Si faltan esos datos, dilo expresamente.
3. CADUCIDAD: el artículo 161 de la Ley 769 de 2002 regula la caducidad de la acción contravencional. Analiza la fecha de los hechos, la actuación sancionatoria, la decisión y, si hubo recursos, su oportunidad y decisión. Si la cronología muestra que la actuación pudo exceder el término legal, di que **hay elementos para solicitar la verificación y eventual declaración de caducidad**, sin presentarla como hecho probado.
4. PÉRDIDA DE EJECUTORIEDAD: el artículo 91 de la Ley 1437 de 2011 contempla, entre otros supuestos, que un acto en firme pierda obligatoriedad cuando transcurran cinco (5) años sin que la autoridad realice los actos que correspondan para ejecutarlo. También existen otras causales. Para analizarla necesitas un acto administrativo firme, su fecha de ejecutoria y evidencia de qué actuaciones de ejecución realizó o no realizó la autoridad. No la declares solo porque una multa sea antigua.
5. ESTRATEGIA: cuando el usuario pregunte qué puede pedir, analiza por separado: (a) prescripción; (b) caducidad; (c) pérdida de ejecutoriedad. Puedes recomendar pretensiones principales y subsidiarias cuando jurídicamente tenga sentido.
6. RIGOR TEMPORAL: si el hecho tiene menos de 3 años, no digas que la sanción está prescrita. Si tiene más de 3 años, trátalo como una hipótesis relevante y revisa mandamiento/notificación. Para caducidad, no uses el plazo de 3 años: analiza la regla específica de la actuación contravencional. Para pérdida de ejecutoriedad, usa la fecha de firmeza del acto, no la fecha del comparendo.
7. NO INVENTES: diferencia dato acreditado, inferencia e información pendiente. El Estado de Cuenta SIMIT individualiza registros, pero no reemplaza el expediente administrativo.
8. CONTEXTO VIVO: usa número, fecha del hecho, organismo, municipio, valor, resolución, ejecutoria, notificación, mandamiento y notificación del mandamiento cuando estén disponibles.
9. DATOS FALTANTES: identifica exactamente el documento que falta: comparendo, citación, audiencia, resolución sancionatoria, recursos, constancia de ejecutoria, mandamiento de pago, constancia de notificación y actuaciones posteriores de cobro.
10. FUERA DE ÁMBITO: si preguntan algo ajeno a tránsito/derecho administrativo colombiano, redirige amablemente hacia TrámiteYa.
11. TONO: empático, profesional, directo y como abogado par de confianza. No sustituyas la decisión de la autoridad ni prometas resultados.
`;

type TrafficContext = {
  numero?: string;
  fecha?: string;
  organismo?: string;
  municipio?: string;
  valor?: string;
  fechaResolucion?: string;
  fechaEjecutoria?: string;
  fechaMandamiento?: string;
  fechaNotificacionMandamiento?: string;
};

function cleanContext(value: unknown): TrafficContext {
  if (!value || typeof value !== 'object') return {};
  const input = value as Record<string, unknown>;
  return {
    numero: typeof input.numero === 'string' ? input.numero.slice(0, 100) : undefined,
    fecha: typeof input.fecha === 'string' ? input.fecha.slice(0, 50) : undefined,
    organismo: typeof input.organismo === 'string' ? input.organismo.slice(0, 200) : undefined,
    municipio: typeof input.municipio === 'string' ? input.municipio.slice(0, 100) : undefined,
    valor: typeof input.valor === 'string' || typeof input.valor === 'number' ? String(input.valor).slice(0, 50) : undefined,
    fechaResolucion: typeof input.fechaResolucion === 'string' ? input.fechaResolucion.slice(0, 50) : undefined,
    fechaEjecutoria: typeof input.fechaEjecutoria === 'string' ? input.fechaEjecutoria.slice(0, 50) : undefined,
    fechaMandamiento: typeof input.fechaMandamiento === 'string' ? input.fechaMandamiento.slice(0, 50) : undefined,
    fechaNotificacionMandamiento: typeof input.fechaNotificacionMandamiento === 'string' ? input.fechaNotificacionMandamiento.slice(0, 50) : undefined,
  };
}

function parseDate(value?: string) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  const iso = new Date(value);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function yearsBetween(from: Date, to = new Date()) {
  return (to.getTime() - from.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
}

function fallbackLegalReply(message: string, context: TrafficContext) {
  const factDate = parseDate(context.fecha);
  const resolutionDate = parseDate(context.fechaResolucion);
  const executoryDate = parseDate(context.fechaEjecutoria);
  const paymentOrderNotice = parseDate(context.fechaNotificacionMandamiento);
  const age = factDate ? yearsBetween(factDate) : null;
  const normalized = message.toLowerCase();
  const asksCaducidad = normalized.includes('caduc') || normalized.includes('caducidad');
  const asksExecutory = normalized.includes('ejecut') || normalized.includes('fuerza ejecutoria') || normalized.includes('fuerza ejecutoria');

  if (asksCaducidad) {
    if (!factDate) return 'Hay una **hipótesis que vale la pena revisar**, pero para hablar de caducidad necesito la fecha exacta de los hechos y, sobre todo, saber cuándo se decidió la actuación. El documento clave es la **resolución o actuación que decidió la sanción**, junto con sus constancias de notificación.\n\nSi la decisión no se produjo dentro del término legal aplicable, hay elementos para **solicitar la verificación y eventual declaración de caducidad**; no conviene afirmar la caducidad solo por la antigüedad del comparendo.';
    if (!resolutionDate || yearsBetween(factDate, resolutionDate) > 1) return `El comparendo **${context.numero || ''}** tiene fecha ${context.fecha}. La cronología permite plantear **caducidad como una vía de revisión** porque ${resolutionDate ? 'la decisión reportada aparece posterior al año contado desde los hechos' : 'no aparece acreditada la fecha de la decisión sancionatoria'}. El documento clave es la **resolución y su constancia de notificación**.\n\nEsto debe contrastarse con el expediente y con la forma en que se desarrolló la actuación; no es lo mismo la fecha del comparendo que la fecha en que quedó decidida la actuación.';
    return 'Con los datos disponibles, la decisión aparece dentro del primer año desde los hechos, por lo que **no veo una base suficiente para afirmar caducidad**. Aun así, conviene verificar audiencia, resolución, recursos y notificaciones para cerrar el análisis.';
  }

  if (asksExecutory) {
    if (!executoryDate) return 'La **pérdida de ejecutoriedad** no se determina por la edad del comparendo. Necesitamos la fecha en que quedó **en firme la resolución** y las actuaciones posteriores realizadas para ejecutarla. Si transcurrieron cinco años desde la firmeza sin actuaciones de ejecución que correspondieran, existe una hipótesis relevante bajo el artículo 91 del CPACA.\n\nEl documento clave es la **constancia de ejecutoria y el expediente de cobro/ejecución**.';
    const executoryAge = yearsBetween(executoryDate);
    if (executoryAge >= 5) return `Aquí sí hay un punto importante: el acto reporta ejecutoria desde **${context.fechaEjecutoria}**, por lo que han transcurrido aproximadamente **${executoryAge.toFixed(1)} años**. Eso permite plantear la **pérdida de ejecutoriedad** si la autoridad no realizó los actos que correspondían para ejecutarlo durante ese período.\n\nLa clave es acreditar qué actuaciones de ejecución o cobro existieron; por eso conviene pedir el expediente y el historial completo de actuaciones.`;
    return `La resolución quedó en firme el **${context.fechaEjecutoria}**, pero todavía no se observa el transcurso de cinco años desde esa fecha. Por ahora **no hay base suficiente para afirmar pérdida de ejecutoriedad por el numeral 3 del artículo 91 del CPACA**; sí conviene revisar las demás causales y las actuaciones de ejecución.`;
  }

  if (normalized.includes('prescrit')) {
    if (!factDate) return 'Para analizar **prescripción** necesito la fecha del hecho y, especialmente, saber si existe **mandamiento de pago y cuándo fue notificado**. El Estado de Cuenta SIMIT por sí solo no permite cerrar ese análisis.';
    if (age !== null && age < 3) return `El hecho corresponde al **${context.fecha}**, por lo que todavía no han transcurrido tres años. **No puedo afirmar prescripción**. Hay que revisar la actuación sancionatoria y, si existe, el mandamiento de pago y su notificación.`;
    if (paymentOrderNotice && yearsBetween(factDate, paymentOrderNotice) < 3) return `Por antigüedad, el caso merece revisión de **prescripción**, pero aparece una notificación de mandamiento de pago dentro del término. Eso puede afectar el cómputo, así que no sería responsable afirmar que ya prescribió sin revisar el expediente y la forma de notificación.`;
    return `Por la fecha **${context.fecha}**, ya transcurrieron más de tres años desde el hecho. Hay **elementos para solicitar un análisis de prescripción**, especialmente si no existe una notificación válida de mandamiento de pago dentro del término. El documento clave es el **mandamiento de pago y su constancia de notificación**.`;
  }

  return `Puedo analizar las tres vías principales: **prescripción, caducidad y pérdida de ejecutoriedad**. Con los datos del comparendo ${context.numero ? `**${context.numero}**` : ''}, primero separaría la cronología del hecho, la decisión sancionatoria, su ejecutoria y el eventual cobro.\n\nSi me preguntas **“¿qué puedo pedir?”**, puedo decirte cuál de las tres vías tiene mejores elementos y qué documento falta para sostenerla.`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) return NextResponse.json({ error: 'El mensaje es requerido.' }, { status: 400 });
    if (message.length > 2000) return NextResponse.json({ error: 'El mensaje es demasiado largo.' }, { status: 400 });

    const context = cleanContext(body?.comparendo);
    const contextText = Object.entries(context).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join('\n');

    // En Vercel, AI Gateway puede autenticarse mediante la configuración del proyecto.
    // Si no hay credenciales disponibles, mantenemos un fallback jurídico determinista
    // para que Trámi nunca aparezca roto al usuario.
    const hasAiCredentials = Boolean(process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
    if (!hasAiCredentials) return NextResponse.json({ text: fallbackLegalReply(message, context), mode: 'fallback' });

    try {
      const { text } = await generateText({
        model: 'openai/gpt-4o-mini',
        system: TRAMI_SYSTEM_PROMPT,
        prompt: `CONTEXTO DEL COMPARENDO:\n${contextText || 'Sin comparendo seleccionado.'}\n\nPREGUNTA DEL USUARIO:\n${message}`,
      });
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
