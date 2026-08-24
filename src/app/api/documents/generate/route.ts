import { NextRequest, NextResponse } from 'next/server';
import { procedures } from '../../../../data/procedures';
import { generateDocument } from '../../../../lib/generateDocument';
import { evaluateLegalQuality } from '../../../../lib/legalQualityGate';
import { getSupabaseServer } from '../../../../lib/supabaseServerClient';
import type { FormAnswers } from '../../../../types/form';

export const runtime = 'nodejs';

type RequestBody = { procedureSlug?: string; answers?: FormAnswers; previousVersion?: number; instanceId?: string };
type DocumentRecord = { id: string; title: string; procedure_id: string; instance_id: string | null; content: string; meta: Record<string, unknown> };
type DbProcedure = { id: string; slug: string };
type DocumentVersionRecord = { id: string; document_id: string; version: number; content: string; meta?: Record<string, unknown> };
type PersistedVersion = { id: string };

function isUuid(value?: string | null) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeVersionNumber(version: unknown): number {
  if (typeof version === 'number' && Number.isFinite(version)) return Math.max(1, Math.trunc(version));
  if (typeof version === 'string') {
    const parsed = Number(version.replace(/^v/i, ''));
    if (Number.isFinite(parsed)) return Math.max(1, Math.trunc(parsed));
  }
  return 1;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const procedureSlug = body.procedureSlug?.trim();
    if (!procedureSlug) return NextResponse.json({ error: 'procedureSlug es obligatorio' }, { status: 400 });
    const procedure = procedures.find((item) => item.slug === procedureSlug);
    if (!procedure) return NextResponse.json({ error: 'Trámite no encontrado' }, { status: 404 });

    const answers = body.answers ?? {};
    const legalQuality = evaluateLegalQuality(procedureSlug, answers);
    if (!legalQuality.passed) {
      return NextResponse.json({
        error: 'El caso requiere información adicional antes de generar el documento.',
        code: 'LEGAL_QUALITY_GATE_FAILED',
        legalQuality,
      }, { status: 422 });
    }

    const document = await generateDocument({ procedure, answers, previousVersion: body.previousVersion ?? 0, instanceId: body.instanceId });
    const supabase = getSupabaseServer();

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
      instance_id: isUuid(body.instanceId) ? body.instanceId! : null,
      content: document.content,
      meta: { version: document.version, generatedAt: document.generatedAt, sourceVersion: document.sourceVersion, snapshot: document.snapshot, procedureSlug, clientInstanceId: body.instanceId || null },
    };

    const documentsTable = supabase.from('documents') as unknown as {
      upsert: (values: DocumentRecord, options: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
    };
    const { error: persistError } = await documentsTable.upsert(documentRow, { onConflict: 'id' });
    if (persistError) {
      console.error('Document persistence failed:', persistError.message);
      return NextResponse.json({ error: 'No fue posible guardar el documento.', code: 'DOCUMENT_PERSISTENCE_ERROR' }, { status: 500 });
    }

    const versionNumber = normalizeVersionNumber(document.version ?? document.sourceVersion);
    const versionId = crypto.randomUUID();
    const versionRow: DocumentVersionRecord = { id: versionId, document_id: document.id, version: versionNumber, content: document.content, meta: { sourceVersion: document.sourceVersion, generatedAt: document.generatedAt } };
    const versionsTable = supabase.from('document_versions') as unknown as {
      upsert: (values: DocumentVersionRecord, options: { onConflict: string }) => Promise<{ data: PersistedVersion[] | null; error: { message: string } | null }>;
    };
    const { data: persistedVersions, error: versionPersistError } = await versionsTable.upsert(versionRow, { onConflict: 'document_id,version' });
    if (versionPersistError) {
      console.error('Document version persistence failed:', versionPersistError.message);
      return NextResponse.json({ error: 'No fue posible preparar la versión del documento.', code: 'DOCUMENT_VERSION_PERSISTENCE_ERROR' }, { status: 500 });
    }

    const persistedVersionId = persistedVersions?.[0]?.id || versionId;
    return NextResponse.json({ ...document, documentVersionId: persistedVersionId, legalQuality });
  } catch (error) {
    console.error('Document generation failed:', error);
    return NextResponse.json({ error: 'No fue posible generar el documento', code: 'DOCUMENT_GENERATION_ERROR' }, { status: 500 });
  }
}