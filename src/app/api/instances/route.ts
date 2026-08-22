import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRepositoryFactory } from '../../../../lib/repositoryFactory';
import { getUserFromAccessToken } from '../../../../lib/supabaseServerClient';
import { createInstanceSchema } from '../../../../lib/schemas';

const factory = getRepositoryFactory();

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
    const repo = factory.getInstanceRepo();
    const list = await repo.list();
    const filtered = list.filter((i: any) => i.userId === user.id);
    return NextResponse.json({ data: filtered });
  } catch (e) {
    return NextResponse.json({ error: 'Unable to list instances' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const body = await req.json();
    const parsed = createInstanceSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', details: parsed.error.errors }, { status: 400 });
    const { procedureId, procedureSlug, answers } = parsed.data;
    const repo = factory.getInstanceRepo();
    const inst = await repo.create(procedureId || procedureSlug, procedureSlug, answers || {}, user.id);
    return NextResponse.json({ data: inst }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Unable to create instance' }, { status: 500 });
  }
}
