import type { Procedure } from '../types';
import type { FormAnswers } from '../types/form';
import type { DocumentItem } from '../types/procedure';
import { buildDocumentText } from './documentTemplates';
import { buildTrafficDocument } from './trafficDocumentTemplates';
import { refineLegalDocument } from './aiDocumentRefiner';
import { cleanLegalDocumentOutput, isLegallySafeTrafficDocument } from './legalDocumentGuard';

function generateId(prefix = 'doc') { return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`; }
const trafficSlugs = new Set(['prescripcion-comparendo', 'caducidad-comparendo', 'revocatoria-comparendo', 'solicitud-soportes-comparendo', 'fotomultas', 'derecho-de-peticion-eliminar-multa']);
function normalizeTrafficAnswers(input: FormAnswers): FormAnswers {
  const a = { ...input } as FormAnswers & Record<string, any>;
  const trami = a.tramiAnswers && typeof a.tramiAnswers === 'object' ? a.tramiAnswers : {};
  const simit = a.__simitRecord && typeof a.__simitRecord === 'object' ? { ...a.__simitRecord } : {};
  const first = (...values: unknown[]) => values.find(v => v !== undefined && v !== null && String(v).trim() !== '') as string | undefined;
  const nombre = first(a.nombre, a.nombreCompleto, trami.nombre, simit.name, simit.ownerName);
  const cedula = first(a.documento, a.documentNumber, a.numeroDocumento, a.cedula, trami.cedula, simit.documentNumber);
  const correo = first(a.correo, a.email, trami.correo, simit.email);
  const telefono = first(a.telefono, a.phone, trami.telefono, simit.phone);
  const numero = first(a.numero_comparendo, a.numero_acto, simit.number);
  const fecha = first(a.fecha_comparendo, simit.date);
  const entidad = first(a.entidad, a.autoridad, simit.authority);
  const municipio = first(a.municipio, a.ciudad, simit.municipality);
  const valor = first(a.valor, a.valor_multa, a.valorMulta, simit.value);
  const placa = first(a.placa, simit.plate);
  const codigo = first(a.codigo_infraccion, a.codigoInfraccion, simit.infractionCode, simit.code);
  if (nombre) { a.nombre = nombre; a.nombreCompleto = nombre; }
  if (cedula) { a.documento = cedula; a.documentNumber = cedula; a.cedula = cedula; }
  if (correo) { a.correo = correo; a.email = correo; }
  if (telefono) { a.telefono = telefono; a.phone = telefono; }
  if (numero) a.numero_comparendo = numero;
  if (fecha) a.fecha_comparendo = fecha;
  if (entidad) { a.entidad = entidad; a.autoridad = entidad; }
  if (municipio) a.municipio = municipio;
  if (valor) a.valor = valor;
  if (placa) a.placa = placa;
  if (codigo) a.codigo_infraccion = codigo;
  a.__simitRecord = { ...simit, number: first(simit.number, numero), date: first(simit.date, fecha), authority: first(simit.authority, entidad), municipality: first(simit.municipality, municipio), value: first(simit.value, valor), plate: first(simit.plate, placa), infractionCode: first(simit.infractionCode, codigo), documentNumber: first(simit.documentNumber, cedula), name: first(simit.name, nombre), ownerName: first(simit.ownerName, nombre), email: first(simit.email, correo), phone: first(simit.phone, telefono) };
  return a;
}
function documentContent(procedure: Procedure, answers: FormAnswers): string {
  const normalizedAnswers = trafficSlugs.has(procedure.slug) ? normalizeTrafficAnswers(answers) : answers;
  return trafficSlugs.has(procedure.slug) ? buildTrafficDocument(procedure.slug, normalizedAnswers) : buildDocumentText(procedure, normalizedAnswers);
}
const ROMAN = '(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII)';
function extractPetitions(content: string): string | null {
  const match = content.match(new RegExp(`(?:^|\\n)(${ROMAN})\\. PETICIONES\\n([\\s\\S]*?)(?=\\n${ROMAN}\\. |$)`, 'i'));
  if (!match) return null;
  return `${match[1].toUpperCase()}. PETICIONES\n${match[2].trim()}`.trim();
}
function hasDuplicatedTopLevelSections(content: string): boolean {
  const headings = content.match(new RegExp(`^${ROMAN}\\.\\s+`, 'gim')) || [];
  const counts = new Map<string, number>();
  for (const heading of headings) { const key = heading.trim().toUpperCase(); counts.set(key, (counts.get(key) || 0) + 1); }
  return [...counts.values()].some(count => count > 1);
}
function preserveDeterministicPetitions(deterministic: string, refined: string): string {
  if (hasDuplicatedTopLevelSections(refined)) return deterministic;
  const sourcePetitions = extractPetitions(deterministic);
  if (!sourcePetitions) return deterministic;
  const target = refined.match(new RegExp(`(?:^|\\n)(${ROMAN})\\. PETICIONES\\n([\\s\\S]*?)(?=\\n${ROMAN}\\. |$)`, 'i'));
  if (!target) return deterministic;
  const start = target.index ?? 0; const block = target[0]; const leading = block.startsWith('\n') ? '\n' : '';
  const bodyStart = start + leading.length; const bodyEnd = bodyStart + block.slice(leading.length).length;
  return `${refined.slice(0, bodyStart)}${sourcePetitions}${refined.slice(bodyEnd)}`.replace(/\n{3,}/g, '\n\n').trim();
}
function formatCurrency(value: unknown): string {
  if (value == null || String(value).trim() === '') return '';
  const numeric = Number(String(value).replace(/[^0-9-]/g, ''));
  if (!Number.isFinite(numeric)) return String(value).trim();
  return `$ ${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(numeric)} COP`;
}
const ORDINALS = ['PRIMERO','SEGUNDO','TERCERO','CUARTO','QUINTO','SEXTO','SÉPTIMO','OCTAVO','NOVENO','DÉCIMO'];
function formatPetitionsAsOrdinals(content: string): string {
  return content.replace(new RegExp(`(^|\\n)(${ROMAN})\\. PETICIONES\\n([\\s\\S]*?)(?=\\n${ROMAN}\\. |$)`, 'i'), (_m, lead, section, body) => {
    const lines = body.split(/\n\s*\n/).map((x: string) => x.trim()).filter(Boolean);
    const items: string[] = [];
    for (const line of lines) {
      const stripped = line.replace(/^\d+[.)]\s*/, '').trim();
      if (stripped) items.push(stripped);
    }
    const normalized = items.map((item, i) => {
      const without = item.replace(/^(PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|SÉPTIMO|OCTAVO|NOVENO|DÉCIMO):\s*/i, '');
      return `${ORDINALS[i] || `NUMERAL ${i + 1}`}: ${without}`;
    }).join('\n\n');
    return `${lead}${section.toUpperCase()}. PETICIONES\n${normalized}`;
  });
}
function finalizeTrafficText(content: string): string {
  let output = content;
  // Remove Markdown heading markers before preview/rendering.
  output = output.replace(/^\s*#{1,6}\s+/gm, '');
  // Force the requested human first-person phrasing.
  output = output.replace(/\b(?:El solicitante )?(?:indica que )?conoció por primera vez la actuación:\s*simit\.?/gi, 'Me enteré de la existencia de esta actuación a través de la plataforma SIMIT.');
  output = output.replace(/\bEl solicitante indica que conoció por primera vez la actuación\b[^\n.]*/gi, 'Me enteré de la existencia de esta actuación a través de la plataforma SIMIT');
  output = output.replace(/\bEl solicitante manifiesta:\s*nunca\b/gi, 'Manifiesto que no fui notificado ni asistí a audiencia');
  output = output.replace(/\bManifiesto:\s*nunca\b/gi, 'Manifiesto que no fui notificado ni asistí a audiencia');
  output = output.replace(/(conoció por primera vez la actuación:\s*)simit\.?/gi, '$1a través de la consulta en la plataforma SIMIT.');
  output = output.replace(/(me enteré por primera vez[^\n:]*:\s*)simit\.?/gi, '$1al consultar directamente la plataforma del SIMIT.');
  output = output.replace(/(VALOR REPORTADO:\s*)\$?\s*([0-9][0-9.,]*)\s*(?:COP)?/gi, (_m, prefix, value) => `${prefix}${formatCurrency(value)}`);
  // Header invariant: value line must be followed by a blank line before "Yo,".
  output = output.replace(/(VALOR REPORTADO:[^\n]*)(?:\n\s*)+(?=Yo,)/gi, '$1\n\n');
  output = output.replace(/\.{2,}/g, '.');
  output = output.replace(/\bEl solicitante manifiesta que no recibió\b/gi, 'No recibí')
    .replace(/\bEl solicitante manifiesta que no recuerda\b/gi, 'No recuerdo')
    .replace(/\bEl solicitante manifiesta no recordar\b/gi, 'No recuerdo')
    .replace(/\bEl solicitante manifiesta no haber recibido\b/gi, 'No he recibido')
    .replace(/\bEl solicitante manifiesta no tener conocimiento\b/gi, 'No tengo conocimiento')
    .replace(/\bEl solicitante manifiesta:\s*/gi, 'Manifiesto: ')
    .replace(/\bEl solicitante indica que conoció\b/gi, 'Indico que conocí')
    .replace(/\bEl solicitante indica\b/gi, 'Indico')
    .replace(/\bEl solicitante identificado para el trámite es\b/gi, 'Soy')
    .replace(/\bLa actuación aparece asociada al documento de identidad No\.\s*/gi, 'La actuación está asociada a mi documento de identidad No. ')
    .replace(/\bEl solicitante reporta una actuación de cobro\b/gi, 'Tengo registrado un antecedente de actuación de cobro')
    .replace(/\bEl solicitante\b/gi, 'Yo')
    .replace(/\bEl ciudadano\b/gi, 'Yo')
    .replace(/\bLa persona interesada\b/gi, 'Yo');
  output = output.replace(/aportado por Yo\b/gi, 'aportado por el suscrito peticionario.');
  output = output.replace(/aportado por el suscrito peticionario\.\./gi, 'aportado por el suscrito peticionario.');
  // Final hard normalization of common hearing/notification wording.
  output = output.replace(/\bManifiesto:\s*no\s*recib[ií]\b[^\n.]*/gi, 'Sobre la oportunidad de defensa, manifiesto que no fui notificado ni asistí a audiencia.');
  if (/\. PETICIONES\n/i.test(output)) output = formatPetitionsAsOrdinals(output);
  return output.replace(/\n{3,}/g, '\n\n').trim();
}
function finalizeTrafficDocument(content: string): string {
  const cleaned = finalizeTrafficText(cleanLegalDocumentOutput(content));
  if (isLegallySafeTrafficDocument(cleaned)) return cleaned;
  console.warn('Traffic document safety guard flagged deterministic draft; delivering deterministic draft instead of failing generation.');
  if (cleaned.length >= 500) return cleaned;
  throw new Error('TRAFFIC_DOCUMENT_EMPTY: el documento jurídico generado quedó incompleto.');
}
async function buildFinalContent(procedure: Procedure, answers: FormAnswers): Promise<string> {
  const deterministic = finalizeTrafficDocument(documentContent(procedure, answers));
  if (!trafficSlugs.has(procedure.slug)) return deterministic;
  const refined = await refineLegalDocument(deterministic);
  if (!refined || refined.length < 500) return deterministic;
  const merged = preserveDeterministicPetitions(deterministic, refined);
  const finalContent = finalizeTrafficText(cleanLegalDocumentOutput(merged));
  return isLegallySafeTrafficDocument(finalContent) ? finalContent : deterministic;
}
export async function generateDocument({ procedure, answers, previousVersion = 0, instanceId }: { procedure: Procedure; answers: FormAnswers; previousVersion?: number; instanceId?: string }): Promise<DocumentItem> {
  const generatedAt = new Date().toISOString(); const version = Math.max(1, previousVersion + 1); const content = await buildFinalContent(procedure, answers);
  return { id: generateId('doc'), title: `${procedure.title} - Documento generado`, procedureId: procedure.id, content, createdAt: generatedAt, generatedAt, version, status: 'ready', instanceId, sourceVersion: `v${version}`, snapshot: { answers: JSON.parse(JSON.stringify(normalizeTrafficAnswers(answers))), procedureSlug: procedure.slug, generatedAt, content } };
}
export async function generateDocx({ procedure, answers }: { procedure: Procedure; answers: FormAnswers }): Promise<Uint8Array> { return renderDocx(await buildFinalContent(procedure, answers)); }
export async function generatePdf({ procedure, answers }: { procedure: Procedure; answers: FormAnswers }): Promise<Buffer> { return renderPdf(await buildFinalContent(procedure, answers)); }
export async function generateDocxFromContent(content: string): Promise<Uint8Array> { return renderDocx(content); }
export async function generatePdfFromContent(content: string): Promise<Buffer> { return renderPdf(content); }
function isHeading(line: string) {
  return /^(I\.|II\.|III\.|IV\.|V\.|VI\.|VII\.|VIII\.|IX\.|X\.|XI\.|XII\.|XIII\.|ASUNTO:|REFERENCIA:|SOLICITANTE|DERECHO DE PETICIÓN|SOLICITUD DE|Respetados señores:|Atentamente,)/.test(line.trim());
}
async function renderDocx(content: string): Promise<Uint8Array> {
  const { Document, Packer, Paragraph, TextRun } = await import('docx');
  const paragraphs = content.split('\n').map(line => {
    const heading = isHeading(line);
    return new Paragraph({ alignment: 'both', spacing: { line: 276, after: heading ? 120 : 80 }, children: [new TextRun({ text: line, bold: heading, font: 'Arial Narrow', size: 24 })] });
  });
  return Packer.toBuffer(new Document({ styles: { default: { document: { run: { font: 'Arial Narrow', size: 24 } } } }, sections: [{ properties: {}, children: paragraphs }] }));
}
async function renderPdf(content: string): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'LETTER', margins: { top: 60, bottom: 60, left: 65, right: 65 } });
    const chunks: Buffer[] = [];
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk)); pdf.on('end', () => resolve(Buffer.concat(chunks))); pdf.on('error', reject);
    for (const line of content.split('\n')) {
      if (!line.trim()) { pdf.moveDown(0.6); continue; }
      const heading = isHeading(line);
      pdf.font(heading ? 'Helvetica-Bold' : 'Helvetica').fontSize(12).fillColor('#000000').text(line, { align: 'justify', lineGap: 2, paragraphGap: heading ? 5 : 3 });
    }
    pdf.end();
  });
}
