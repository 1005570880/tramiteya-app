import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { serverInstanceRepo } from '../../../../lib/serverInstanceRepo';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const inst = serverInstanceRepo.get(params.id);
    if (!inst || !inst.document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    return NextResponse.json({ data: inst.document });
  } catch (e) {
    return NextResponse.json({ error: 'Unable to fetch document' }, { status: 500 });
  }
}
