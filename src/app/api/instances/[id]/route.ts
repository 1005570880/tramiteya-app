import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRepositoryFactory } from '../../../../lib/repositoryFactory';
import { getUserFromAccessToken } from '../../../../lib/supabaseServerClient';
import { patchInstanceSchema } from '../../../../lib/schemas';

const factory = getRepositoryFactory();

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
    const repo = factory.getInstanceRepo();
    const inst = await repo.get(params.id);
    if (!inst) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    if (inst.userId && inst.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ data: inst });
  } catch (e) {
    return NextResponse.json({ error: 'Unable to fetch instance' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const body = await req.json();
    const parsed = patchInstanceSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', details: parsed.error.errors }, { status: 400 });
    const repo = factory.getInstanceRepo();
    const existing = await repo.get(params.id);
    if (!existing) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    if (existing.userId && existing.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const updated = await repo.update(params.id, parsed.data as any);
    if (!updated) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    return NextResponse.json({ data: updated });
  } catch (e) {
    return NextResponse.json({ error: 'Unable to update instance' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const repo = factory.getInstanceRepo();
    const existing = await repo.get(params.id);
    if (!existing) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    if (existing.userId && existing.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const ok = await repo.remove(params.id);
    if (!ok) return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: 'Unable to remove instance' }, { status: 500 });
  }
}
