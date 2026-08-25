import { NextRequest, NextResponse } from 'next/server';
import { getProcedureModule, runGenericLegalQualityGate } from '../../../../lib/genericProcedureEngine';
import '../../../../data/procedureModules';
import type { FormAnswers } from '../../../../types/form';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const module = getProcedureModule(params.slug);
    if (!module) return NextResponse.json({ error: 'No existe un módulo jurídico configurado para este trámite.' }, { status: 404 });
    const body = (await request.json()) as { answers?: FormAnswers };
    const result = runGenericLegalQualityGate(module, body.answers ?? {});
    return NextResponse.json({ procedureSlug: params.slug, module: module.id, ...result });
  } catch (error) {
    console.error('Generic legal quality failed:', error);
    return NextResponse.json({ error: 'No fue posible analizar el trámite.' }, { status: 500 });
  }
}
