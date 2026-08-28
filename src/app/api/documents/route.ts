import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Procedure } from '../../../types';
import { getRepositoryFactory } from '../../../lib/repositoryFactory';
import { getUserFromAccessToken } from '../../../lib/supabaseServerClient';
import { createDocumentSchema } from '../../../lib/schemas';
import { generateDocument } from '../../../lib/generateDocument';
import { createGuestAccessToken, hashGuestAccessToken } from '../../../lib/guestAccess';

const factory = getRepositoryFactory();

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  return getUserFromAccessToken(token);
}

function normalizeProcedure(input: { id: string; slug: string; title: string }): Procedure {
  return {
    id: input.id,
    slug: input.slug,
    title: input.title,
    description: '',
    category: 'general',
    estimatedTime: '5 minutos',
    available: true,
  };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    const body = await req.json();
    const parsed = createDocumentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', details: parsed.error.errors }, { status: 400 });

    const { procedure: procedureInput, answers, instanceId } = parsed.data;
    const procedure = normalizeProcedure(procedureInput);
    const instanceRepo = factory.getInstanceRepo();

    if (instanceId) {
      if (!user) return NextResponse.json({ error: 'Autenticación requerida para una instancia guardada.' }, { status: 401 });
      const existing = await instanceRepo.get(instanceId);
      if (!existing) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
      if (existing.userId && existing.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if ((instanceRepo as any).generateDocumentAndAttach) {
        const res = await (instanceRepo as any).generateDocumentAndAttach(instanceId);
        return NextResponse.json({ data: { instance: res.instance, document: res.document } }, { status: 201 });
      }
    }

    const guestToken = user ? null : createGuestAccessToken();
    const generated = await generateDocument({ procedure, answers: answers || {}, previousVersion: 0, instanceId: undefined });
    const docRepo = factory.getDocumentRepo();
    if (!docRepo) return NextResponse.json({ error: 'Document persistence is not configured.' }, { status: 503 });

    const persisted = await docRepo.create({
      ...generated,
      meta: guestToken ? { guestAccessTokenHash: hashGuestAccessToken(guestToken) } : undefined,
    } as any);

    const response = NextResponse.json({ data: persisted, accessToken: guestToken || undefined, guest: Boolean(guestToken) }, { status: 201 });
    if (guestToken) {
      response.cookies.set('tramiteya_guest_access', guestToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
    }
    return response;
  } catch (e) {
    console.error('Unable to create document', e);
    return NextResponse.json({ error: 'Unable to create document' }, { status: 500 });
  }
}
