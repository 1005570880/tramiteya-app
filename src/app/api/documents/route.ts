import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { serverInstanceRepo } from '../../../lib/serverInstanceRepo';
import { getUserFromAccessToken } from '../../../lib/supabaseServerClient';

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return null;
  const user = await getUserFromAccessToken(token);
  return user;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const body = await req.json();
    const { procedure, answers, instanceId } = body;
    if (!procedure || !answers) return NextResponse.json({ error: 'procedure and answers required' }, { status: 400 });

    // If instanceId provided, verify ownership
    if (instanceId) {
      const existing = serverInstanceRepo.get(instanceId);
      if (!existing) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
      if (existing.userId && existing.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const res = await serverInstanceRepo.generateDocumentAndAttach(instanceId);
      return NextResponse.json({ data: { instance: res.instance, document: res.document } }, { status: 201 });
    }

    const doc = await serverInstanceRepo.generateDocumentAndAttach(instanceId);
    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Unable to create document' }, { status: 500 });
  }
}
