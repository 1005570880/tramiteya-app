import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { getSupabaseServer } from '../../../../lib/supabaseServerClient';
import { getGuestAccessToken, hashGuestAccessToken } from '../../../../lib/guestAccess';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRICE = 4990000;

type Body = { procedureId?: string; instanceId?: string; documentVersionId?: string; content?: string; email?: string };
type PaymentRow = { id: string; status: string; amount: number | null; currency: string | null; procedure_id: string; document_version_id: string | null; metadata?: Record<string, any> | null };

function pdfBuffer(content: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'LETTER', margin: 54 });
    const chunks: Buffer[] = [];
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
    pdf.fontSize(11).font('Helvetica');
    content.split(/\n{2,}/).forEach((paragraph) => { pdf.text(paragraph.trim(), { align: 'left', lineGap: 5 }); pdf.moveDown(0.8); });
    pdf.end();
  });
}

async function docxBuffer(content: string) {
  const paragraphs = content.split(/\n{2,}/).map((text) => new Paragraph({ spacing: { after: 180, line: 276 }, children: [new TextRun({ text: text.trim(), size: 22 })] }));
  return Packer.toBuffer(new Document({ sections: [{ properties: {}, children: paragraphs }] }));
}

function validEmail(value: unknown) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

async function getInstanceEmail(instanceId: string) {
  if (!instanceId) return '';
  const supabase = getSupabaseServer();
  const { data } = await supabase.from('procedure_instances').select('answers').eq('id', instanceId).maybeSingle();
  const answers = (data as any)?.answers || {};
  return validEmail(answers.email || answers.correo || answers.correoElectronico || answers.correo_electronico || answers.emailAddress);
}

async function verifyPayment(procedureId: string, instanceId: string, documentVersionId: string) {
  const supabase = getSupabaseServer();
  const guestToken = instanceId || documentVersionId || '';
  let query = supabase.from('payments').select('id,status,amount,currency,procedure_id,document_version_id,metadata').eq('provider', 'wompi').eq('status', 'approved').eq('amount', PRICE).eq('currency', 'COP').eq('procedure_id', procedureId).order('created_at', { ascending: false }).limit(1);
  if (documentVersionId) query = query.eq('document_version_id', documentVersionId);
  if (instanceId) query = query.contains('metadata', { instanceId });
  if (guestToken) query = query.contains('metadata', { guestAccessTokenHash: hashGuestAccessToken(guestToken) });
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data as PaymentRow | null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const procedureId = String(body.procedureId || '').trim();
    const instanceId = String(body.instanceId || '').trim();
    const documentVersionId = String(body.documentVersionId || '').trim();
    const content = String(body.content || '').trim();
    const requestedEmail = validEmail(body.email);
    if (!procedureId || !content) return NextResponse.json({ error: 'Faltan datos del documento.' }, { status: 400 });

    const payment = await verifyPayment(procedureId, instanceId, documentVersionId);
    if (!payment) return NextResponse.json({ error: 'El pago todavía no figura como aprobado.' }, { status: 403 });

    const email = requestedEmail || await getInstanceEmail(instanceId);
    if (!email) return NextResponse.json({ error: 'No encontramos un correo electrónico válido suministrado para este trámite.' }, { status: 422 });

    const metadata = payment.metadata || {};
    if (metadata.documentsEmailSentTo === email) return NextResponse.json({ sent: true, alreadySent: true, email });

    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL || 'TrámiteYa <onboarding@resend.dev>';
    if (!resendKey) return NextResponse.json({ error: 'El servicio de correo no está configurado en el servidor.' }, { status: 503 });

    const [pdf, docx] = await Promise.all([pdfBuffer(content), docxBuffer(content)]);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email], subject: 'Tu documento jurídico está listo — TrámiteYa', html: '<p>Hola,</p><p>Tu pago fue aprobado y adjuntamos tu documento jurídico completo en los formatos <strong>PDF</strong> y <strong>Word (.DOCX)</strong>.</p><p>Gracias por utilizar TrámiteYa.</p>', attachments: [
        { filename: 'TramiteYa-Derecho-de-Peticion.pdf', content: pdf.toString('base64') },
        { filename: 'TramiteYa-Derecho-de-Peticion.docx', content: docx.toString('base64') },
      ] },
    });
    if (!response.ok) { const detail = await response.text(); throw new Error(`Resend: ${detail.slice(0, 500)}`); }

    await (getSupabaseServer().from('payments') as any).update({ metadata: { ...metadata, documentsEmailSentTo: email, documentsEmailSentAt: new Date().toISOString() } }).eq('id', payment.id);
    return NextResponse.json({ sent: true, email });
  } catch (error) {
    console.error('PAID_DOCUMENT_EMAIL_ERROR:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No fue posible enviar el documento por correo.' }, { status: 500 });
  }
}
