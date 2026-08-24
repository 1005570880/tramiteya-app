import { NextRequest, NextResponse } from 'next/server';
import { getRepositoryFactory } from '../../../../../../lib/repositoryFactory';
import { getUserFromAccessToken, getSupabaseServer } from '../../../../../../lib/supabaseServerClient';
import { generatePdfFromContent } from '../../../../../../lib/generateDocument';
import { procedures } from '../../../../../../data/procedures';

const factory = getRepositoryFactory();

async function hasApprovedPayment(userId: string, procedureId: string, documentVersionId?: string | null) {
  const supabase = getSupabaseServer();
  let query = supabase.from('payments').select('id,status').eq('user_id', userId).eq('procedure_id', procedureId).eq('status', 'approved').order('created_at', { ascending: false }).limit(1);
  if (documentVersionId) query = query.eq('document_version_id', documentVersionId);
  const { data, error } = await query.maybeSingle();
  return !error && Boolean(data);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const user = token ? await getUserFromAccessToken(token) : null;
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const instance = await factory.getInstanceRepo().get(params.id);
    if (!instance) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    if (instance.userId && instance.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const repo = factory.getDocumentRepo();
    const docs = repo?.listByInstance ? await repo.listByInstance(params.id) : [];
    const versionParam = new URL(req.url).searchParams.get('version');
    const requestedVersionId = versionParam && !/^\d+$/.test(versionParam) ? versionParam : null;
    const requestedVersionNumber = versionParam && /^\d+$/.test(versionParam) ? Number(versionParam) : 0;
    const doc = requestedVersionId ? docs.find((d: any) => String(d.id) === requestedVersionId) : requestedVersionNumber ? docs.find((d: any) => Number(d.version) === requestedVersionNumber) : docs[docs.length - 1] || instance.document;
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const procedureSlug = String(instance.procedureSlug || '');
    const procedureId = String(instance.procedureId || '');
    const procedure = procedures.find(item => item.slug === procedureSlug || item.id === procedureId);
    if (!procedure) return NextResponse.json({ error: 'Procedure not found' }, { status: 404 });

    const documentVersionId = (doc as any).id ? String((doc as any).id) : null;
    const paid = await hasApprovedPayment(user.id, procedureId || procedureSlug, documentVersionId);
    if (!paid) return NextResponse.json({ error: 'Payment required', code: 'PAYMENT_REQUIRED' }, { status: 402 });
    const snapshot = (doc as any).snapshot;
    const content = snapshot?.content || doc.content;
    if (!content) return NextResponse.json({ error: 'Document snapshot not available' }, { status: 409 });
    const buffer = await generatePdfFromContent(content);
    const version = Number(doc.version || 1);
    return new NextResponse(buffer as unknown as BodyInit, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="tramiteya-${procedureSlug}-v${version}.pdf"`, 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to generate PDF' }, { status: 500 });
  }
}
