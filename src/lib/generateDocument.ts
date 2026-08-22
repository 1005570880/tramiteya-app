import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import PDFDocument from 'pdfkit';
import type { Procedure } from '../types';
import type { FormAnswers } from '../types/form';
import type { DocumentItem } from '../types/procedure';
import { buildDocumentText } from './documentTemplates';
import { buildTrafficDocument } from './trafficDocumentTemplates';
function generateId(prefix = 'doc') { return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`; }
const trafficSlugs = new Set(['prescripcion-comparendo', 'caducidad-comparendo', 'revocatoria-comparendo', 'solicitud-soportes-comparendo', 'fotomultas']);
function documentContent(procedure: Procedure, answers: FormAnswers): string { return trafficSlugs.has(procedure.slug) ? buildTrafficDocument(procedure.slug, answers) : buildDocumentText(procedure, answers); }
export async function generateDocument({ procedure, answers, previousVersion = 0, instanceId }: { procedure: Procedure; answers: FormAnswers; previousVersion?: number; instanceId?: string }): Promise<DocumentItem> { const generatedAt = new Date().toISOString(); const version = Math.max(1, previousVersion + 1); return { id: generateId('doc'), title: `${procedure.title} - Documento generado`, procedureId: procedure.id, content: documentContent(procedure, answers), createdAt: generatedAt, generatedAt, version, status: 'ready', instanceId, sourceVersion: `v${version}`, snapshot: { answers: JSON.parse(JSON.stringify(answers)), procedureSlug: procedure.slug, generatedAt } }; }
export async function generateDocx({ procedure, answers }: { procedure: Procedure; answers: FormAnswers }): Promise<Uint8Array> { const content = documentContent(procedure, answers); return renderDocx(content); }
export async function generatePdf({ procedure, answers }: { procedure: Procedure; answers: FormAnswers }): Promise<Buffer> { return renderPdf(documentContent(procedure, answers)); }
export async function generateDocxFromContent(content:string):Promise<Uint8Array>{return renderDocx(content);}
export async function generatePdfFromContent(content:string):Promise<Buffer>{return renderPdf(content);}
function isHeading(line: string) { return /^(HECHOS|PETICIÓN|NOTIFICACIONES|ANEXOS|PRIMERA\.|SEGUNDA\.|TERCERA\.|CUARTA\.|QUINTA\.|SEXTA\.|SÉPTIMA\.|I\.|II\.|III\.|IV\.|V\.|VI\.)/.test(line); }
function renderDocx(content:string):Uint8Array|Promise<Uint8Array>{const paragraphs=content.split('\n').map(line=>isHeading(line)?new Paragraph({heading:HeadingLevel.HEADING_2,children:[new TextRun({text:line,bold:true})]}):new Paragraph({children:[new TextRun(line)]}));return Packer.toBuffer(new Document({sections:[{properties:{},children:paragraphs}]}));}
function renderPdf(content:string):Promise<Buffer>{return new Promise((resolve,reject)=>{const pdf=new PDFDocument({size:'LETTER',margins:{top:60,bottom:60,left:65,right:65}});const chunks:Buffer[]=[];pdf.on('data',(chunk:Buffer)=>chunks.push(chunk));pdf.on('end',()=>resolve(Buffer.concat(chunks)));pdf.on('error',reject);pdf.font('Helvetica').fontSize(11);for(const line of content.split('\n')){if(!line.trim()){pdf.moveDown(0.6);continue;}if(isHeading(line))pdf.font('Helvetica-Bold').fontSize(11.5).text(line,{paragraphGap:5});else pdf.font('Helvetica').fontSize(11).text(line,{align:'left',lineGap:3});}pdf.end();});}
