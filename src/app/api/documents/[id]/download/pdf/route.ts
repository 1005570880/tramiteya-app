import { NextRequest, NextResponse } from 'next/server';
import { getRepositoryFactory } from '../../../../../../lib/repositoryFactory';
import { getUserFromAccessToken, getSupabaseServer } from '../../../../../../lib/supabaseServerClient';
import { generatePdfFromContent } from '../../../../../../lib/generateDocument';
import { procedures } from '../../../../../../data/procedures';
import { getGuestAccessToken, hashGuestAccessToken } from '../../../../../../lib/guestAccess';

const factory = getRepositoryFactory();

type DocumentRow = {
  id: string;
  instance_id: string | null;
  procedure_id: string;
  content?: unknown;
  meta?: {
    guestAccessTokenHash?: string;
    snapshot?: { content?: unknown };
    version?: number;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authToken = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const user = authToken ? await getUserFromAccessToken(authToken) : null;
    const guestToken = user ? '' : getGuestAccessToken(req);
    const supabase = getSupabaseServer();

    const { data: rawDocument, error: documentError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();
    const document = rawDocument as DocumentRow | null;

    if (documentError || !document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const instanceId = document.instance_id;
    if (user && instanceId) {
      const instance = await factory.getInstanceRepo().get(instanceId);
      if (!instance) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
      if (instance.userId && instance.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    } else if (!user) {
      const storedHash = String(document.meta?.guestAccessTokenHash || '');
      if (!guestToken || !storedHash || storedHash !== hashGuestAccessToken(guestToken)) return NextResponse.json({ error: 'Acceso no autorizado.' }, { status: 401 });
    }

    const procedure = procedures.find(item => item.id === document.procedure_id);
    if (!procedure) return NextResponse.json({ error: 'Procedure not found' }, { status: 404 });

    let paymentQuery = supabase.from('payments').select('id,status').eq('provider', 'wompi').eq('procedure_id', document.procedure_id).eq('document_version_id', params.id).eq('status', 'approved').limit(1);
    if (user) paymentQuery = paymentQuery.eq('user_id', user.id);
    else paymentQuery = paymentQuery.contains('metadata', { guestAccessTokenHash: hashGuestAccessToken(guestToken) });
    const { data: payment, error: paymentError } = await paymentQuery.maybeSingle();
    if (paymentError || !payment) return NextResponse.json({ error: 'Payment required', code: 'PAYMENT_REQUIRED' }, { status: 402 });

    const content = document.meta?.snapshot?.content || document.content;
    if (!content) return NextResponse.json({ error: 'Document content not available' }, { status: 409 });
    const buffer = await generatePdfFromContent(content);
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="tramiteya-${procedure.slug}-v${document.meta?.version || 1}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Unable to generate PDF download', error);
    return NextResponse.json({ error: 'Unable to generate PDF' }, { status: 500 });
  }
}
