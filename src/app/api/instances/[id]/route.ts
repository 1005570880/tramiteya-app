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
    // Disallow changing ownership fields
    delete body.userId;
    delete body.createdAt;
    const existing = serverInstanceRepo.get(params.id);
    if (!existing) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    if (existing.userId && existing.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const updated = serverInstanceRepo.update(params.id, body || {});
    if (!updated) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    return NextResponse.json({ data: updated });
  } catch (e) {
    return NextResponse.json({ error: 'Unable to update instance' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const existing = serverInstanceRepo.get(params.id);
    if (!existing) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    if (existing.userId && existing.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    serverInstanceRepo.remove(params.id);
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: 'Unable to remove instance' }, { status: 500 });
  }
}
