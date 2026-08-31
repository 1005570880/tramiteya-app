import { NextRequest, NextResponse } from 'next/server';
import { procedures } from '../../../../data/procedures';
import { generateDocument } from '../../../../lib/generateDocument';
import { getRepositoryFactory } from '../../../../lib/repositoryFactory';
import type { FormAnswers } from '../../../../types/form';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    // The legal draft itself is the critical result of this endpoint.
    // Persistence is best-effort so a transient Supabase/schema/RLS problem
    // cannot strand the guest after completing the interview.
    const documentRepo = factory.getDocumentRepo();
    if (documentRepo) {
      try {
        const persisted = await documentRepo.create(generated);
        return NextResponse.json(persisted, {
          headers: { 'Cache-Control': 'no-store' },
        });
      } catch (persistenceError) {
        console.error('[TrámiteYa] document persistence failed; returning generated draft:', persistenceError);
      }
    }

    return NextResponse.json(generated, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[TrámiteYa] Document generation failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No fue posible generar el documento' },
      { status: 500 },
    );
  }
}
