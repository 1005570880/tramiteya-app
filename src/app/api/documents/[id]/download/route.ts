import { NextRequest, NextResponse } from 'next/server';
import { getRepositoryFactory } from '../../../../../lib/repositoryFactory';
import { getUserFromAccessToken } from '../../../../../lib/supabaseServerClient';
import { generateDocx } from '../../../../../lib/generateDocument';
import { procedures } from '../../../../../data/procedures';

const factory = getRepositoryFactory();

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    const user = token ? await getUserFromAccessToken(token) : null;
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const instance = await factory.getInstanceRepo().get(params.id);
    if (!instance || !instance.document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    if (instance.userId && instance.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const procedure = procedures.find((item) => item.slug === instance.procedureSlug || item.id === instance.procedureId);
    if (!procedure) return NextResponse.json({ error: 'Procedure not found' }, { status: 404 });

    const buffer = await generateDocx({ procedure, answers: instance.answers });
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="tramiteya-${instance.procedureSlug}.docx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Unable to generate document' }, { status: 500 });
  }
}
