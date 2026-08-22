import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { serverInstanceRepo } from '../../../../lib/serverInstanceRepo';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const inst = serverInstanceRepo.get(params.id);
    if (!inst) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    return NextResponse.json({ data: inst });
  } catch (e) {
    return NextResponse.json({ error: 'Unable to fetch instance' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const updated = serverInstanceRepo.update(params.id, body || {});
    if (!updated) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    return NextResponse.json({ data: updated });
  } catch (e) {
    return NextResponse.json({ error: 'Unable to update instance' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    serverInstanceRepo.remove(params.id);
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: 'Unable to remove instance' }, { status: 500 });
  }
}
