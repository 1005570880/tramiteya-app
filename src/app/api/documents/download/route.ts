import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { getSupabaseServer, getUserFromAccessToken } from '../../../../lib/supabaseServerClient';
import { getGuestAccessToken, hashGuestAccessToken } from '../../../../lib/guestAccess';

export const runtime = 'nodejs';

const PRICE = 4990000;

type Body = {
  format?: 'pdf' | 'docx';
  content?: string;
  title?: string;
  procedureId?: string;
  instanceId?: string;
  documentVersionId?: string;
};

type PaymentRow = { id: string; status: string; amount: number | null; currency: string | null; procedure_id: string; document_version_id: string | null };

function safeFilename(value: string) {
  return (value || 'tramiteya-documento').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'tramiteya-documento';
}

async function hasApprovedPayment(request: Request, procedureId: string, instanceId: string, documentVersionId: string) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  const user = token ? await getUserFromAccessToken(token) : null;
  const guestToken = user ? '' : getGuestAccessToken(request) || instanceId || documentVersionId;
  if (!user && !guestToken) return false;

  const supabase = getSupabaseServer();
  let query = supabase.from('payments')
    .select('id,status,amount,currency,procedure_id,document_version_id')
    .eq('procedure_id', procedureId)
    .eq('status', 'approved')
    .eq('amount', PRICE)
    .eq('currency', 'COP')
    .order('created_at', { ascending: false })
    .limit(1);

  if (documentVersionId) query = query.eq('document_version_id', documentVersionId);
  if (instanceId) query = query.contains('metadata', { instanceId });
  if (user) query = query.eq('user_id', user.id);
  else query = query.contains('metadata', { guestAccessTokenHash: hashGuestAccessToken(guestToken) });

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data as PaymentRow | null);
}

function pdfBuffer(content: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'LETTER', margin: 54 });
    const chunks: Buffer[] = [];
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
    pdf.fontSize(11).font('Helvetica');
    content.split(/\n{2,}/).forEach((paragraph) => {
      pdf.text(paragraph.trim(), { align: 'left', lineGap: 5 });
      pdf.moveDown(0.8);
    });
    pdf.end();
  });
}

async function docxBuffer(content: string) {
  const paragraphs = content.split(/\n{2,}/).map((text) => new Paragraph({
    spacing: { after: 180, line: 276 },
    children: [new TextRun({ text: text.trim(), size: 22 })],
  }));
  return Packer.toBuffer(new Document({ sections: [{ properties: {}, children: paragraphs }] }));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const format = body.format;
    const content = String(body.content || '').trim();
    const procedureId = String(body.procedureId || '').trim();
    const instanceId = String(body.instanceId || '').trim();
    const documentVersionId = String(body.documentVersionId || '').trim();

    if (!format || !['pdf', 'docx'].includes(format)) return NextResponse.json({ error: 'Formato de descarga inválido.' }, { status: 400 });
    if (!content) return NextResponse.json({ error: 'No hay contenido disponible para descargar.' }, { status: 400 });
    if (!procedureId) return NextResponse.json({ error: 'procedureId es requerido.' }, { status: 400 });

    if (!(await hasApprovedPayment(request, procedureId, instanceId, documentVersionId))) {
      return NextResponse.json({ error: 'El documento debe estar desbloqueado mediante un pago aprobado.' }, { status: 403 });
    }

    const filename = safeFilename(body.title || 'documento-tramiteya');
    if (format === 'pdf') {
      const buffer = await pdfBuffer(content);
      return new Response(buffer as BodyInit, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}.pdf"`, 'Cache-Control': 'no-store' } });
    }

    const buffer = await docxBuffer(content);
    return new Response(buffer as BodyInit, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="${filename}.docx"`, 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('DOCUMENT_DOWNLOAD_ERROR:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No fue posible generar la descarga.' }, { status: 500 });
  }
}
