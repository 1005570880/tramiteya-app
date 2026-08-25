import { NextResponse } from 'next/server';
import { runLegalAiEngine } from '@/lib/legalAiEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
    }

    const { vertical, procedure, facts, documentType, draftingInstructions } = body as Record<string, unknown>;
    if (typeof vertical !== 'string' || typeof procedure !== 'string' || typeof documentType !== 'string' || !facts || typeof facts !== 'object') {
      return NextResponse.json({ error: 'Faltan vertical, procedimiento, tipo de documento o hechos.' }, { status: 422 });
    }

    const result = await runLegalAiEngine({
      vertical,
      procedure,
      facts: facts as Record<string, unknown>,
      documentType,
      draftingInstructions: typeof draftingInstructions === 'string' ? draftingInstructions : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Legal AI engine failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No fue posible ejecutar el motor jurídico.' }, { status: 500 });
  }
}
