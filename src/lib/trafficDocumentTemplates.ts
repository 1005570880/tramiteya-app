import type { FormAnswers } from '../types/form';
import { evaluateTrafficCase, getApplicableTrafficRules } from './legalRules';
import { runTransitLegalQualityGate } from './transitLegalQualityGate';

const v=(a:FormAnswers,k:string,f='')=>{const x=a[k];if(Array.isArray(x))return x.join(', ');if(typeof x==='boolean')return x?'Sí':'No';return x==null?f:String(x)};
const fmt=(value?:string)=>value?new Date(`${value}T00:00:00`).toLocaleDateString('es-CO'):'';

export function buildTrafficDocument(slug:string,a:FormAnswers){
 const title: string = {'prescripcion-comparendo':'SOLICITUD DE PRESCRIPCIÓN DE OBLIGACIÓN DE TRÁNSITO','caducidad-comparendo':'SOLICITUD DE REVISIÓN DE CADUCIDAD DE ACTUACIÓN DE TRÁNSITO','revocatoria-comparendo':'SOLICITUD DE REVOCATORIA / CORRECCIÓN DE ACTUACIÓN DE TRÁNSITO','solicitud-soportes-comparendo':'DERECHO DE PETICIÓN — SOLICITUD DE INFORMACIÓN Y SOPORTES DE TRÁNSITO','fotomultas':'DERECHO DE PETICIÓN — SOLICITUD RELACIONADA CON FOTODETECCIÓN / FOTOMULTA'}[slug]??'SOLICITUD ADMINISTRATIVA DE TRÁNSITO';

 const structured=Array.isArray(a.comparendos);
 if(slug==='prescripcion-comparendo' && structured){
   const comparendos=a.comparendos as Array<{number:string;violationDate?:string;coactiveDate?:string;origin?:string;infraction?:string;totalFine?:number;paymentOrderNoticeDate?:string}>;
   const result=runTransitLegalQualityGate({
     applicant:{fullName:v(a,'fullName'),documentType:v(a,'documentType','CC'),documentNumber:v(a,'documentNumber'),email:v(a,'email')},
     authority:{name:v(a,'authorityName'),municipality:v(a,'authorityMunicipality'),department:v(a,'authorityDepartment')},
     comparendos,
   });
   const rows=comparendos.map((c,i)=>`${i+1}. Comparendo ${c.number || 'sin número'}${c.infraction?` — infracción ${c.infraction}`:''}${c.violationDate?` — fecha de infracción ${fmt(c.violationDate)}`:''}${c.coactiveDate?` — fecha de cobro coactivo ${fmt(c.coactiveDate)}`:''}${c.paymentOrderNoticeDate?` — notificación del mandamiento ${fmt(c.paymentOrderNoticeDate)}`:''}${c.origin?` — origen ${c.origin}`:''}${c.totalFine!==undefined?` — valor reportado $${Number(c.totalFine).toLocaleString('es-CO')}`:''}`).join('\n');
   const analyses=result.analyses.map((analysis:any,i:number)=>`• Comparendo ${i+1}: ${analysis.summary || analysis.reason || 'Revisión del término y del expediente requerida.'}`).join('\n');
   const warning=result.issues.filter((i:any)=>i.severity==='warning').map((i:any)=>`• ${i.message}`).join('\n');
   const petitioner=`${v(a,'fullName')}, identificado(a) con ${v(a,'documentType','CC')} No. ${v(a,'documentNumber')}`;
   return [
     v(a,'authorityMunicipality','Ciudad'), new Date().toLocaleDateString('es-CO'), '',
     v(a,'authorityName',`AUTORIDAD DE TRÁNSITO COMPETENTE DE ${v(a,'authorityMunicipality','')}`),
     v(a,'authorityMunicipality',''), v(a,'authorityDepartment',''), '', title, '', petitioner, '',
     'I. OBJETO',
     'Por medio del presente escrito solicito la revisión y, si se encuentran acreditados los presupuestos legales, la declaratoria de prescripción de las obligaciones de tránsito relacionadas, así como el archivo de las actuaciones de cobro y la actualización de los registros que legalmente corresponda.', '',
     'II. INFORMACIÓN DE LAS OBLIGACIONES', rows, '',
     'III. HECHOS Y ANTECEDENTES',
     'El solicitante registra las obligaciones de tránsito anteriormente relacionadas y solicita que la autoridad contraste la información suministrada con los expedientes administrativos correspondientes. La solicitud se formula a partir del transcurso del tiempo y de la necesidad de verificar integralmente las actuaciones de cobro, sus notificaciones y cualquier actuación que pueda incidir en el término aplicable.', '',
     'IV. FUNDAMENTO Y VERIFICACIÓN',
     `TrámiteYa realizó una verificación preliminar con base exclusivamente en los datos disponibles. El resultado de preparación del trámite es ${result.score}%. Esta valoración no sustituye el examen del expediente administrativo ni constituye por sí misma una declaración de prescripción.`,
     analyses || '• Se requiere revisión individual del expediente de cada obligación.',
     warning ? `\nAdvertencias de verificación:\n${warning}` : '', '',
     'V. PETICIONES',
     'PRIMERO. Que se verifique, respecto de cada obligación relacionada, la configuración de la prescripción de la acción de cobro conforme al régimen jurídico aplicable y las actuaciones efectivamente surtidas dentro de cada expediente.',
     'SEGUNDO. Que, de encontrarse configurada la prescripción, se declare la misma y se ordene el archivo definitivo de las actuaciones de cobro correspondientes.',
     'TERCERO. Que se actualicen o depuren los registros administrativos y sistemas de información que correspondan, conforme a la decisión adoptada.',
     'CUARTO. Que, si alguna obligación se considera vigente, se remita copia íntegra y legible del expediente, incluyendo título ejecutivo, mandamiento de pago, constancias de notificación, actuaciones posteriores, acuerdos de pago y medidas cautelares, si existen.',
     'QUINTO. Que la respuesta sea de fondo, clara, congruente y completa respecto de cada obligación individualmente considerada.', '',
     'VI. NOTIFICACIONES', `El solicitante recibirá respuesta en el correo electrónico ${v(a,'email')}.`, '',
     'Atentamente', '', v(a,'fullName'), `${v(a,'documentType','CC')} No. ${v(a,'documentNumber')}`, `Correo: ${v(a,'email')}`,
   ].join('\n');
 }

 const rules=getApplicableTrafficRules(a); const decisions=evaluateTrafficCase(a); const favorable=decisions.filter(d=>d.level==='favorable'); const uncertain=decisions.filter(d=>d.level!=='favorable');
 const ruleLabels=rules.filter(r=>r.id!=='soportes').map(r=>r.label).join(', ');
 const primaryRequest=favorable.length?`Solicito que se declare o reconozca la procedencia de ${favorable.map(d=>d.id==='prescripcion'?'la prescripción':d.id==='caducidad'?'la caducidad':d.label.toLowerCase()).join(' y ')}, previo el análisis integral del expediente.`:`Solicito que se verifique la procedencia de ${ruleLabels||'la actuación solicitada'} y se adopte la decisión jurídicamente correspondiente, sin presumir la existencia de los presupuestos que deban acreditarse.`;
 const evidenceRequest=uncertain.length?`Para resolver lo anterior, solicito especialmente: ${uncertain.map(d=>d.nextStep).join(' ')}.`:'Solicito copia íntegra del expediente y de los soportes pertinentes.';
 const soportes=`Solicito copia íntegra de los soportes que sustentan la actuación, incluyendo comparendo, evidencia, constancias de notificación, mandamiento de pago si existe, actos administrativos, recursos y demás documentos pertinentes.`;
 const legalAnalysis=decisions.length?decisions.map(d=>`• ${d.label}: ${d.reason} Siguiente actuación: ${d.nextStep} Fundamento orientador: ${d.legalBasis.join('; ')}.`).join('\n'):'No se identificó una decisión jurídica automatizada concluyente. Se requiere revisión del expediente y de la información aportada.';
 return [v(a,'ciudad','Ciudad'),v(a,'fecha',new Date().toLocaleDateString('es-CO')),'',v(a,'entidad',v(a,'autoridad','SEÑOR(A) AUTORIDAD DE TRÁNSITO')),'',title,'',`Solicitante: ${v(a,'nombres')} ${v(a,'apellidos')}`,`Documento: ${v(a,'documento')}`,`Correo: ${v(a,'correo')}`,`Comparendo / acto: ${v(a,'numero_comparendo')}`,`Fecha: ${v(a,'fecha_comparendo')}`,`Placa: ${v(a,'placa')}`,'','I. OBJETO',primaryRequest,'','II. HECHOS',v(a,'hechos'),'','III. ANÁLISIS JURÍDICO PRELIMINAR',legalAnalysis,'','IV. PETICIONES',primaryRequest,`Solicito además que ${evidenceRequest.toLowerCase()}`,'Se remita respuesta de fondo, clara, congruente y completa dentro del término legal aplicable.','','V. INFORMACIÓN Y SOPORTES',soportes,'','VI. ANEXOS',v(a,'anexos','No se relacionan anexos.'),'','Atentamente','',`${v(a,'nombres')} ${v(a,'apellidos')}`,`C.C. ${v(a,'documento')}`].join('\n')}
