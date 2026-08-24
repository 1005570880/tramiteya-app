import { NextRequest, NextResponse } from 'next/server';
import { getRepositoryFactory } from '../../../../../../lib/repositoryFactory';
import { getSupabaseServer } from '../../../../../../lib/supabaseServerClient';
import { generatePdfFromContent } from '../../../../../../lib/generateDocument';
import { procedures } from '../../../../../../data/procedures';

const factory = getRepositoryFactory();

async function hasApprovedPayment(documentVersionId: string) {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from('payments').select('id').eq('document_version_id', documentVersionId).eq('status', 'approved').limit(1).maybeSingle();
  return !error && Boolean(data);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const instance = await factory.getInstanceRepo().get(params.id);
    if (!instance) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });

    const repo = factory.getDocumentRepo();
    const docs = repo?.listByInstance ? await repo.listByInstance(params.id) : [];
    const versionParam = new URL(req.url).searchParams.get('version');
    const requestedVersionId = versionParam && !/^\d+$/.test(versionParam) ? versionParam : null;
    const requestedVersionNumber = versionParam && /^\d+$/.test(versionParam) ? Number(versionParam) : 0;
    const doc = requestedVersionId ? docs.find((d: any) => String(d.id) === requestedVersionId) : requestedVersionNumber ? docs.find((d: any) => Number(d.version) === requestedVersionNumber) : docs[docs.length - 1] || instance.document;
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const procedure = procedures.find(item => item.slug === instance.procedureSlug || item.id === instance.procedureId);
    if (!procedure) return NextResponse.json({ error: 'Procedure not found' }, { status: 404 });

    const paid = await hasApprovedPayment(String((doc as any).id));
    if (!paid) return NextResponse.json({ error: 'Payment required', code: 'PAYMENT_REQUIRED' }, { status: 402 });

    const snapshot = (doc as any).snapshot;
    const content = snapshot?.content || doc.content;
    if (!content) return NextResponse.json({ error: 'Document snapshot not available' }, { status: 409 });
    const buffer = await generatePdfFromContent(content);
    return new NextResponse(buffer as unknown as BodyInit, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="tramiteya-${instance.procedureSlug}-v${doc.version || 1}.pdf"`, 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to generate PDF' }, { status: 500 });
  }
}
