import { NextRequest, NextResponse } from 'next/server';
import { procedures } from '../../../../data/procedures';
import { generateDocument } from '../../../../lib/generateDocument';
import { getSupabaseServer } from '../../../../lib/supabaseServerClient';
import type { FormAnswers } from '../../../../types/form';

export const runtime = 'nodejs';

type RequestBody = { procedureSlug?: string; answers?: FormAnswers; previousVersion?: number; instanceId?: string };
type DocumentRecord = { id: string; title: string; procedure_id: string; instance_id: string | null; content: string; meta: Record<string, unknown> };

type DbProcedure = { id: string; slug: string };

function isUuid(value?: string | null) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const procedureSlug = body.procedureSlug?.trim();
    if (!procedureSlug) return NextResponse.json({ error: 'procedureSlug es obligatorio' }, { status: 400 });
    const procedure = procedures.find((item) => item.slug === procedureSlug);
    if (!procedure) return NextResponse.json({ error: 'Trámite no encontrado' }, { status: 404 });

    const document = await generateDocument({ procedure, answers: body.answers ?? {}, previousVersion: body.previousVersion ?? 0, instanceId: body.instanceId });
    const supabase = getSupabaseServer();

    // The browser-side procedure catalog uses stable string ids (e.g. "derecho-peticion"),
    // while Supabase stores relational procedure ids as UUIDs. Resolve the DB id by slug
    // before persisting so guest checkout never attempts to insert a string id into a UUID FK.
    const { data: dbProcedure, error: procedureError } = await supabase
      .from('procedures')
      .select('id,slug')
      .eq('slug', procedureSlug)
      .maybeSingle() as { data: DbProcedure | null; error: { message: string } | null };

    if (procedureError || !dbProcedure) {
      console.error('Document persistence procedure lookup failed:', procedureError?.message || 'procedure_not_found');
      return NextResponse.json({ error: 'No fue posible preparar el trámite en la base de datos.' }, { status: 500 });
    }

    const documentRow: DocumentRecord = {
      id: document.id,
      title: document.title,
      procedure_id: dbProcedure.id,
      // Guest instances created locally have ids such as pi_..., not UUIDs.
      // Keep the document independent from that local id until a server instance exists.
      instance_id: isUuid(body.instanceId) ? body.instanceId! : null,
      content: document.content,
      meta: {
        version: document.version,
        generatedAt: document.generatedAt,
        sourceVersion: document.sourceVersion,
        snapshot: document.snapshot,
        procedureSlug,
        clientInstanceId: body.instanceId || null,
      },
    };

    const documentsTable = supabase.from('documents') as unknown as {
      upsert: (values: DocumentRecord, options: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
    };
    const { error: persistError } = await documentsTable.upsert(documentRow, { onConflict: 'id' });
    if (persistError) {
      console.error('Document persistence failed:', persistError.message);
      return NextResponse.json({ error: 'No fue posible guardar el documento.', code: 'DOCUMENT_PERSISTENCE_ERROR' }, { status: 500 });
    }
    return NextResponse.json(document);
  } catch (error) {
    console.error('Document generation failed:', error);
    return NextResponse.json({ error: 'No fue posible generar el documento', code: 'DOCUMENT_GENERATION_ERROR' }, { status: 500 });
  }
}
