import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateDocumentServer } from '../../../services/documentService';
import { serverInstanceRepo } from '../../../lib/serverInstanceRepo';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { procedure, answers, instanceId } = body;
    if (!procedure || !answers) return NextResponse.json({ error: 'procedure and answers required' }, { status: 400 });

    // If instanceId provided, attach to instance
    if (instanceId) {
      const res = await serverInstanceRepo.generateDocumentAndAttach(instanceId);
      return NextResponse.json({ data: { instance: res.instance, document: res.document } }, { status: 201 });
    }

    const doc = await generateDocumentServer({ procedure, answers });
    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Unable to create document' }, { status: 500 });
  }
}
