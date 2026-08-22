import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRepositoryFactory } from '../../../lib/repositoryFactory';
import { getUserFromAccessToken } from '../../../lib/supabaseServerClient';
import { createDocumentSchema } from '../../../lib/schemas';

const factory = getRepositoryFactory();

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
    const parsed = createDocumentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', details: parsed.error.errors }, { status: 400 });
    const { procedure, answers, instanceId } = parsed.data;
    const instanceRepo = factory.getInstanceRepo();
    if (instanceId) {
      const existing = await instanceRepo.get(instanceId);
      if (!existing) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
      if (existing.userId && existing.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      // generate document and attach
      // prefer repository-specific implementation if available
      if ((instanceRepo as any).generateDocumentAndAttach) {
        const res = await (instanceRepo as any).generateDocumentAndAttach(instanceId);
        return NextResponse.json({ data: { instance: res.instance, document: res.document } }, { status: 201 });
      }
    }
    // fallback: use serverInstanceRepo generateDocumentServer via services
    const doc = await factory.getDocumentRepo()?.create({ id: `doc_${Date.now()}`, title: `${procedure.title} - Documento`, procedureId: procedure.id, content: `Respuestas: ${JSON.stringify(answers, null, 2)}`, createdAt: new Date().toISOString(), status: 'ready' } as any);
    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Unable to create document' }, { status: 500 });
  }
}
