import { NextRequest, NextResponse } from 'next/server';
import { getRepositoryFactory } from '../../../../../lib/repositoryFactory';
import { getUserFromAccessToken } from '../../../../../lib/supabaseServerClient';

const factory = getRepositoryFactory();

async function user(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  return getUserFromAccessToken(auth.slice(7));
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = await user(req);
    if (!u) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const instance = await factory.getInstanceRepo().get(params.id);
    if (!instance) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (instance.userId !== u.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const documentRepo = factory.getDocumentRepo();
    const docs = documentRepo ? await documentRepo.listByInstance(params.id) : [];

    return NextResponse.json({ data: docs });
  } catch {
    return NextResponse.json({ error: 'Unable to load document history' }, { status: 500 });
  }
}
