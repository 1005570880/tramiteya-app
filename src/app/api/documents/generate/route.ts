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
    if (!procedureSlug) {
      return NextResponse.json({ error: 'procedureSlug es obligatorio' }, { status: 400 });
    }

    const procedure = procedures.find((item) => item.slug === procedureSlug);
    if (!procedure) {
      return NextResponse.json({ error: 'Trámite no encontrado' }, { status: 404 });
    }

    const answers = body.answers ?? {};
    const generated = await generateDocument({
      procedure,
      answers,
      previousVersion: body.previousVersion ?? 0,
      instanceId: body.instanceId,
    });

    // A generated preview is also a commercial document version. Persist it
    // before returning it so checkout can always resolve documentVersionId.
    // This removes the split-brain state where the preview exists in the
    // instance/local state but Wompi cannot find the same version in `documents`.
    const documentRepo = factory.getDocumentRepo();
    if (documentRepo) {
      const persisted = await documentRepo.create(generated);
      return NextResponse.json(persisted);
    }

    // Local/file-backed development fallback: keep the generated document
    // usable even when Supabase persistence is unavailable.
    return NextResponse.json(generated);
  } catch (error) {
    console.error('Document generation failed:', error);
    return NextResponse.json({ error: 'No fue posible generar el documento' }, { status: 500 });
  }
}
