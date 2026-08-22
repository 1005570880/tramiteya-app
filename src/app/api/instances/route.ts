import { NextResponse } from 'next/server';
import { serverInstanceRepo } from '../../../../lib/serverInstanceRepo';
import type { NextRequest } from 'next/server';

export async function GET() {
  try {
    const list = serverInstanceRepo.list();
    return NextResponse.json({ data: list });
  } catch (e) {
    return NextResponse.json({ error: 'Unable to list instances' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { procedureId, procedureSlug, answers } = body;
    if (!procedureSlug) return NextResponse.json({ error: 'procedureSlug required' }, { status: 400 });
    const inst = serverInstanceRepo.create(procedureId || procedureSlug, procedureSlug, answers || {});
    return NextResponse.json({ data: inst }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Unable to create instance' }, { status: 500 });
  }
}
