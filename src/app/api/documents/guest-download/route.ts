import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../../lib/supabaseServerClient';
import { generateDocxFromContent, generatePdfFromContent } from '../../../../lib/generateDocument';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type GuestPayment = { id: string; status: string; procedure_id: string | null; document_version_id: string | null };
type DocumentRecord = { id: string; content: string | null; meta: Record<string, unknown> | null; procedure_id: string | null };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const documentId = String(body?.documentId || '').trim();
    const guestAccessToken = String(body?.guestAccessToken || '').trim();
    const format = body?.format === 'pdf' ? 'pdf' : 'docx';
    if (!documentId || !guestAccessToken) return NextResponse.json({ error: 'Datos de acceso incompletos.' }, { status: 400 });

    const supabase = getSupabaseServer();
    const paymentsTable = supabase.from('payments') as unknown as {
      select: (columns: string) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: GuestPayment | null; error: { message: string } | null }> } } } };
    };
    const { data: payment, error: paymentError } = await paymentsTable.select('id,status,procedure_id,document_version_id')
      .eq('guest_access_token', guestAccessToken)
      .eq('document_version_id', documentId)
      .eq('status', 'approved')
      .maybeSingle();
    if (paymentError || !payment) return NextResponse.json({ error: 'El pago no está confirmado.' }, { status: 402 });

    const documentsTable = supabase.from('documents') as unknown as {
      select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: DocumentRecord | null; error: { message: string } | null }> } };
    };
    const { data: document, error: documentError } = await documentsTable.select('id,content,meta,procedure_id').eq('id', documentId).maybeSingle();
    if (documentError || !document) return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 });
    if (document.procedure_id && document.procedure_id !== payment.procedure_id) return NextResponse.json({ error: 'El documento no corresponde al pago.' }, { status: 409 });

    const content = String(document.content || (document.meta as any)?.snapshot?.content || '');
    if (!content) return NextResponse.json({ error: 'Contenido del documento no disponible.' }, { status: 409 });
    const slug = String((document.meta as any)?.procedureSlug || payment.procedure_id || 'documento');
    const version = Number((document.meta as any)?.version || 1);

    if (format === 'pdf') {
      const buffer = await generatePdfFromContent(content);
      return new NextResponse(buffer as unknown as BodyInit, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="tramiteya-${slug}-v${version}.pdf"`, 'Cache-Control': 'no-store' } });
    }
    const buffer = await generateDocxFromContent(content);
    return new NextResponse(buffer as unknown as BodyInit, { status: 200, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="tramiteya-${slug}-v${version}.docx"`, 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'No fue posible generar la descarga.' }, { status: 500 });
  }
}
