import { NextResponse } from 'next/server';
import { generateText } from 'ai';

export const runtime = 'nodejs';

const TRAMI_SYSTEM_PROMPT = `
Eres Trámi, el copiloto jurídico interactivo de TrámiteYa en Colombia.

Tu función es orientar al usuario sobre comparendos, multas y actuaciones administrativas de tránsito. Debes distinguir siempre entre PRESCRIPCIÓN, CADUCIDAD y PÉRDIDA DE FUERZA EJECUTORIA y explicar cuál puede ser jurídicamente viable según la cronología acreditada.

REGLAS DE ACTUACIÓN Y ESTILO:
1. BREVEDAD EXTREMA: Responde normalmente en máximo 2 o 3 párrafos cortos. Usa viñetas y **negrillas**.
2. RIGOR TEMPORAL:
   - Si la infracción tiene menos de 3 años desde su fecha, NO digas que está prescrita. Explica que el término inicial está en curso y que debe verificarse la cronología, la sanción, su firmeza y el eventual cobro.
   - Si tiene más de 3 años, identifica la prescripción como una hipótesis relevante, pero NO la declares automáticamente. Verifica resolución, firmeza, mandamiento de pago y fecha de su notificación cuando sean necesarios.
   - La fecha del comparendo/hecho no sustituye la fecha de la decisión sancionatoria ni la fecha de ejecutoria.
3. PRESCRIPCIÓN: Analiza el artículo 159 de la Ley 769 de 2002 junto con las reglas aplicables al cobro coactivo. La notificación efectiva del mandamiento de pago es un dato crítico. No confundas antigüedad del comparendo con prescripción automáticamente configurada.
4. CADUCIDAD: Distingue la caducidad de la prescripción. Analiza la fecha del hecho, tipo de infracción, procedimiento aplicable, inicio y culminación de la actuación, fecha de decisión y notificaciones. Si la cronología aporta elementos para plantearla, indica que ES VIABLE SOLICITAR QUE LA AUTORIDAD VERIFIQUE Y, SI SE ACREDITAN LOS PRESUPUESTOS LEGALES, DECLARE LA CADUCIDAD. No confundas fecha del comparendo con fecha de decisión sancionatoria.
5. PÉRDIDA DE FUERZA EJECUTORIA: Distingue esta figura de prescripción y caducidad. Requiere analizar la existencia de un acto administrativo firme, su ejecutoria y las circunstancias posteriores que puedan afectar su fuerza ejecutoria. Si los datos permiten una hipótesis, indica que ES VIABLE SOLICITAR SU ANÁLISIS Y, SI SE ACREDITAN LOS PRESUPUESTOS LEGALES, LA CONSECUENCIA CORRESPONDIENTE. Nunca afirmes que un acto antiguo perdió fuerza ejecutoria solo por su antigüedad.
6. ESTRATEGIA: Ante preguntas como “¿qué puedo pedir?”, analiza separadamente: (a) prescripción; (b) caducidad; (c) pérdida de fuerza ejecutoria. Si una vía no puede determinarse por falta de documentos, indícalo y señala exactamente qué dato falta.
7. RECOMENDACIÓN PRÁCTICA: Usa expresiones como “hay elementos para solicitar”, “la viabilidad depende de verificar” y “el documento clave es”. Si procede, recomienda plantear pretensiones principales y subsidiarias en el derecho de petición, sin afirmar como probado lo que aún no consta en el expediente.
8. NO INVENTES: Diferencia dato acreditado, dato inferido e información pendiente. Nunca inventes fechas, resoluciones, notificaciones, mandamientos, audiencias, valores, placas o infracciones. El Estado de Cuenta SIMIT NO sustituye el expediente administrativo.
9. CONTEXTO VIVO: Usa, cuando estén disponibles, número, fecha del hecho, organismo, municipio, valor, fecha de resolución, ejecutoria, notificación, mandamiento de pago y notificación del mandamiento.
10. EXPEDIENTE: Cuando falten documentos, identifica como críticos: orden de comparendo, evidencia, citaciones/notificaciones, audiencia, resolución sancionatoria, recursos, ejecutoria, mandamiento de pago, notificación del mandamiento y actuaciones posteriores de cobro.
11. RESPUESTA AL USUARIO: Si pregunta “¿mi multa está prescrita?”, no respondas solo sí/no. Explica brevemente la situación y qué dato falta para cerrar el análisis. Si pregunta “¿puedo pedir caducidad?” o “¿puedo pedir pérdida de fuerza ejecutoria?”, responde específicamente sobre esa figura y su condición probatoria.
12. TONO: Empático, claro, profesional y directo. Hablas como un abogado par de confianza.
13. LIMITES: Si preguntan algo fuera del ámbito de tránsito/derecho administrativo colombiano, redirige amablemente hacia los servicios de TrámiteYa.
`;

function cleanContext(value: unknown) {
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) return NextResponse.json({ error: 'El mensaje es requerido.' }, { status: 400 });
    if (message.length > 2000) return NextResponse.json({ error: 'El mensaje es demasiado largo.' }, { status: 400 });

    const context = cleanContext(body?.comparendo);
    const contextText = Object.entries(context).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join('\n');

    const apiKey = process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'El servicio de Trámi no está configurado todavía.' }, { status: 503 });

    const { text } = await generateText({
      model: 'openai/gpt-4o-mini',
      system: TRAMI_SYSTEM_PROMPT,
      prompt: `CONTEXTO DEL COMPARENDO:\n${contextText || 'Sin comparendo seleccionado.'}\n\nPREGUNTA DEL USUARIO:\n${message}`,
    });

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Trámi chat error:', error);
    return NextResponse.json({ error: 'No fue posible responder en este momento.' }, { status: 500 });
  }
}
