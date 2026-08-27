import { NextResponse } from 'next/server';
import { getUserFromAccessToken } from '../../../../lib/supabaseServerClient';
import { hasPaidDocumentVersion, hasPaidGuestDocument } from '../../../../lib/paymentAccess';
import { getGuestAccessToken } from '../../../../lib/guestAccess';

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get('authorization') || '';
    const token = authorization.replace(/^Bearer\s+/i, '').trim();
    const user = token ? await getUserFromAccessToken(token) : null;
    const url = new URL(request.url);
    const documentVersionId = String(url.searchParams.get('documentVersionId') || '');
    if (!documentVersionId) return NextResponse.json({ error: 'documentVersionId es requerido.' }, { status: 400 });

    if (user) {
      const paid = await hasPaidDocumentVersion(user.id, documentVersionId);
      return NextResponse.json({ documentVersionId, paid, downloadAllowed: paid, guest: false });
    }

    const guestToken = getGuestAccessToken(request);
    if (!guestToken) return NextResponse.json({ error: 'Token de acceso requerido.', code: 'ACCESS_TOKEN_REQUIRED' }, { status: 401 });
    const paid = await hasPaidGuestDocument(guestToken, documentVersionId);
    return NextResponse.json({ documentVersionId, paid, downloadAllowed: paid, guest: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No fue posible verificar el acceso.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
