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

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const list = serverInstanceRepo.list().filter((i) => i.userId === user.id);
    return NextResponse.json({ data: list });
  } catch (e) {
    return NextResponse.json({ error: 'Unable to list instances' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const body = await req.json();
    const { procedureId, procedureSlug, answers } = body;
    if (!procedureSlug) return NextResponse.json({ error: 'procedureSlug required' }, { status: 400 });
    const inst = serverInstanceRepo.create(procedureId || procedureSlug, procedureSlug, answers || {}, user.id);
    return NextResponse.json({ data: inst }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Unable to create instance' }, { status: 500 });
  }
}
