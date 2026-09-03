import { NextRequest, NextResponse } from 'next/server';
import { procedures } from '../../../../data/procedures';
import { generateDocument } from '../../../../lib/generateDocument';
import type { FormAnswers } from '../../../../types/form';

export const runtime = 'nodejs';

type RequestBody = {
  procedureSlug?: string;
  answers?: FormAnswers;
  previousVersion?: number;
  instanceId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const procedureSlug = body.procedureSlug?.trim();

    if (!procedureSlug) {
      return NextResponse.json({ error: 'procedureSlug es obligatorio' }, { status: 400 });
    }

    const procedure = procedures.find((item) => item.slug === procedureSlug);
    if (!procedure) {
      return NextResponse.json({ error: 'Trámite no encontrado' }, { status: 404 });
    }

    const document = await generateDocument({
      procedure,
      answers: body.answers ?? {},
      previousVersion: body.previousVersion ?? 0,
      instanceId: body.instanceId,
    });

    return NextResponse.json(document);
  } catch (error) {
    console.error('CRITICAL_DOC_GEN_ERROR:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No fue posible generar el documento' },
      { status: 500 },
    );
  }
}
