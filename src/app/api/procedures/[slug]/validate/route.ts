import { NextRequest, NextResponse } from 'next/server';
import { getFormDefinition } from '../../../../../data/forms';
import { procedures } from '../../../../../data/procedures';
import { validateProcedureAnswers } from '../../../../../lib/multitramiteEngine';
import type { FormAnswers } from '../../../../../types/form';

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const procedure = procedures.find((item) => item.slug === params.slug);
  if (!procedure) return NextResponse.json({ error: 'Trámite no encontrado' }, { status: 404 });

  const definition = getFormDefinition(params.slug);
  if (!definition) return NextResponse.json({ error: 'Formulario no configurado para este trámite' }, { status: 404 });

  try {
    const body = await request.json();
    const answers = (body?.answers ?? {}) as FormAnswers;
    const issues = validateProcedureAnswers(procedure, answers);
    return NextResponse.json({ valid: issues.length === 0, issues, procedure: { slug: procedure.slug, title: procedure.title } });
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
  }
}
