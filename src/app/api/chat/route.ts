import { NextResponse } from 'next/server';
import { generateText } from 'ai';

export const runtime = 'nodejs';

export const TRAMI_SYSTEM_PROMPT = `
Eres Trámi, el copiloto jurídico interactivo de TrámiteYa en Colombia.

REGLAS DE ACTUACIÓN Y ESTILO:
1. BREVEDAD EXTREMA: Responde en máximo 2 o 3 párrafos cortos. Usa viñetas y negrillas para facilitar la lectura.
2. RIGOR TEMPORAL:
   - Si la infracción tiene menos de 3 años desde su fecha, NO digas que está prescrita. Explica que el término inicial está en curso y que el escrito se enfoca en verificar la legalidad, notificación y expediente.
   - Si tiene más de 3 años, explica la prescripción conforme al artículo 159 de la Ley 769 de 2002, sin afirmar que una sanción está prescrita sin revisar la cronología de la sanción, firmeza y cobro cuando sean necesarios.
3. TONO: Empático, claro, profesional y directo. Hablas como un abogado par de confianza.
4. CONTEXTO VIVO: Si el mensaje incluye datos del comparendo (Número, Fecha, Organismo, Valor), úsalos para responder de forma personalizada.
5. LIMITES: Si te preguntan algo fuera del ámbito de tránsito/derecho administrativo colombiano, redirige amablemente hacia los servicios de TrámiteYa.
6. NO INVENTES: Si falta una fecha, actuación, notificación o documento, dilo expresamente y solicita revisar el expediente. No inventes datos del comparendo ni resultados jurídicos.
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
