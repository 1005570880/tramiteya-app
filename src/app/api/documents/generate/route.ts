import { NextRequest, NextResponse } from 'next/server';
import { procedures } from '../../../../data/procedures';
import { generateDocument } from '../../../../lib/generateDocument';
import { getRepositoryFactory } from '../../../../lib/repositoryFactory';
import type { FormAnswers } from '../../../../types/form';

export const runtime = 'nodejs';
const factory = getRepositoryFactory();

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
    if (!procedureSlug) return NextResponse.json({ error: 'procedureSlug es obligatorio' }, { status: 400 });

    const procedure = procedures.find((item) => item.slug === procedureSlug);
    if (!procedure) return NextResponse.json({ error: 'Trámite no encontrado' }, { status: 404 });

    const answers = body.answers ?? {};
    const document = await generateDocument({
      procedure,
      answers,
      previousVersion: body.previousVersion ?? 0,
      instanceId: body.instanceId,
    });

    const repo = factory.getDocumentRepo();
    if (repo?.create) await repo.create(document);

    return NextResponse.json(document);
  } catch (error) {
    console.error('Document generation failed:', error);
    return NextResponse.json({ error: 'No fue posible generar el documento' }, { status: 500 });
  }
}
