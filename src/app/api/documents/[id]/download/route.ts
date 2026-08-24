import { NextRequest, NextResponse } from 'next/server';
import { getRepositoryFactory } from '../../../../../lib/repositoryFactory';
import { getSupabaseServer } from '../../../../../lib/supabaseServerClient';
import { generateDocxFromContent } from '../../../../../lib/generateDocument';
import { procedures } from '../../../../../data/procedures';

const factory = getRepositoryFactory();

async function hasApprovedPayment(documentVersionId: string) {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from('payments').select('id').eq('document_version_id', documentVersionId).eq('status', 'approved').limit(1).maybeSingle();
  return !error && Boolean(data);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const repo = factory.getDocumentRepo();
    const docs = repo?.listByInstance ? await repo.listByInstance(params.id) : [];
    const versionParam = new URL(req.url).searchParams.get('version');
    const requestedVersionId = versionParam && !/^\d+$/.test(versionParam) ? versionParam : null;
    const requestedVersionNumber = versionParam && /^\d+$/.test(versionParam) ? Number(versionParam) : 0;
    const doc = requestedVersionId ? docs.find((d: any) => String(d.id) === requestedVersionId) : requestedVersionNumber ? docs.find((d: any) => Number(d.version) === requestedVersionNumber) : docs[docs.length - 1];
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const procedureSlug = (doc as any).snapshot?.procedureSlug;
    const procedure = procedures.find(item => item.slug === procedureSlug || item.id === (doc as any).procedureId);
    if (!procedure) return NextResponse.json({ error: 'Procedure not found' }, { status: 404 });

    const paid = await hasApprovedPayment(String((doc as any).id));
    if (!paid) return NextResponse.json({ error: 'Payment required', code: 'PAYMENT_REQUIRED' }, { status: 402 });
    const content = (doc as any).snapshot?.content || doc.content;
    if (!content) return NextResponse.json({ error: 'Document snapshot not available' }, { status: 409 });
    const buffer = await generateDocxFromContent(content);
    return new NextResponse(buffer as unknown as BodyInit, { status: 200, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="tramiteya-${procedure.slug}-v${doc.version || 1}.docx"`, 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Unable to generate document' }, { status: 500 }); }
}
