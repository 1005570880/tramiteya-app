import { NextResponse } from 'next/server';
import { runTransitLegalQualityGate } from '@/lib/transitLegalQualityGate';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = runTransitLegalQualityGate(body);
    return NextResponse.json(result, { status: result.canGenerate ? 200 : 422 });
  } catch {
    return NextResponse.json(
      { error: 'No fue posible validar la información del trámite.' },
      { status: 400 },
    );
  }
}
