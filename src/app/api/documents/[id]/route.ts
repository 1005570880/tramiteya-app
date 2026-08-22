import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { serverInstanceRepo } from '../../../../lib/serverInstanceRepo';
import { getUserFromAccessToken } from '../../../../lib/supabaseServerClient';

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return null;
  const user = await getUserFromAccessToken(token);
  return user;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const inst = serverInstanceRepo.get(params.id);
    if (!inst || !inst.document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    if (inst.userId && inst.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ data: inst.document });
  } catch (e) {
    return NextResponse.json({ error: 'Unable to fetch document' }, { status: 500 });
  }
}
