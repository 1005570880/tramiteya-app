import { NextRequest, NextResponse } from 'next/server';
import { procedures } from '../../../../../data/procedures';
import { generateProcedureText, validateProcedureAnswers } from '../../../../../lib/multitramiteEngine';
import type { FormAnswers } from '../../../../../types/form';

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const procedure = procedures.find((item) => item.slug === params.slug);
  if (!procedure) return NextResponse.json({ error: 'Trámite no encontrado' }, { status: 404 });
  try {
    const body = await request.json();
    const answers = (body?.answers ?? {}) as FormAnswers;
    const issues = validateProcedureAnswers(procedure, answers);
    if (issues.length) return NextResponse.json({ valid: false, issues }, { status: 422 });
    return NextResponse.json({ valid: true, procedure: { id: procedure.id, slug: procedure.slug, title: procedure.title }, content: generateProcedureText(procedure, answers) });
  } catch {
    return NextResponse.json({ error: 'No fue posible procesar la solicitud' }, { status: 400 });
  }
}
