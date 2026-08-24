import { NextRequest, NextResponse } from 'next/server';
import { procedures } from '../../../../data/procedures';
import { generateDocument } from '../../../../lib/generateDocument';
import { getSupabaseServer } from '../../../../lib/supabaseServerClient';
import type { FormAnswers } from '../../../../types/form';

export const runtime = 'nodejs';

type RequestBody = { procedureSlug?: string; answers?: FormAnswers; previousVersion?: number; instanceId?: string };
type DocumentRecord = { id: string; title: string; procedure_id: string; instance_id: string | null; content: string; meta: Record<string, unknown> };

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const procedureSlug = body.procedureSlug?.trim();
    if (!procedureSlug) return NextResponse.json({ error: 'procedureSlug es obligatorio' }, { status: 400 });
    const procedure = procedures.find((item) => item.slug === procedureSlug);
    if (!procedure) return NextResponse.json({ error: 'Trámite no encontrado' }, { status: 404 });

    const document = await generateDocument({ procedure, answers: body.answers ?? {}, previousVersion: body.previousVersion ?? 0, instanceId: body.instanceId });
    const supabase = getSupabaseServer();
    const documentRow: DocumentRecord = {
      id: document.id,
      title: document.title,
      procedure_id: document.procedureId,
      instance_id: document.instanceId || null,
      content: document.content,
      meta: { version: document.version, generatedAt: document.generatedAt, sourceVersion: document.sourceVersion, snapshot: document.snapshot, procedureSlug },
    };
    const documentsTable = supabase.from('documents') as unknown as {
      upsert: (values: DocumentRecord, options: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
    };
    const { error: persistError } = await documentsTable.upsert(documentRow, { onConflict: 'id' });
    if (persistError) return NextResponse.json({ error: 'No fue posible guardar el documento.' }, { status: 500 });
    return NextResponse.json(document);
  } catch (error) {
    console.error('Document generation failed:', error);
    return NextResponse.json({ error: 'No fue posible generar el documento' }, { status: 500 });
  }
}
