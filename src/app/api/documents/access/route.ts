import { NextResponse } from 'next/server';
import { getUserFromAccessToken } from '../../../../lib/supabaseServerClient';
import { hasPaidDocumentVersion } from '../../../../lib/paymentAccess';

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get('authorization') || '';
    const token = authorization.replace(/^Bearer\s+/i, '').trim();
    const user = token ? await getUserFromAccessToken(token) : null;
    if (!user) return NextResponse.json({ error: 'Autenticación requerida.' }, { status: 401 });

    const url = new URL(request.url);
    const documentVersionId = String(url.searchParams.get('documentVersionId') || '');
    if (!documentVersionId) return NextResponse.json({ error: 'documentVersionId es requerido.' }, { status: 400 });

    const paid = await hasPaidDocumentVersion(user.id, documentVersionId);
    return NextResponse.json({ documentVersionId, paid, downloadAllowed: paid });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No fue posible verificar el acceso.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
