import { selectLegalAuthorities, type LegalAuthority } from "./legalLibrary";
import { analyzeTemporalCase, type CaseLegalAnalysis } from "./legalCaseAnalysis";

export interface SelectedRecordData {
  comparendo: string; fecha: string; organismo: string; estado: string; valor: string;
  placa?: string; cedula?: string; codigo?: string; fechaResolucion?: string;
  fechaNotificacion?: string; fechaMandamientoPago?: string; fechaNotificacionMandamiento?: string;
  fechaEjecutoria?: string; huboAudiencia?: boolean|string; existeResolucion?: boolean|string;
  actuacionesCobro?: string;
}
export type LegalRoute="CADUCIDAD"|"PRESCRIPCION"|"PERDIDA_EJECUTORIEDAD"|"NOTIFICACION"|"DEBIDO_PROCESO"|"FOTODETECCION"|"REVOCATORIA_DIRECTA";
export interface LegalAssessment {
  routes:LegalRoute[]; primaryRoute:LegalRoute|null; priority:"alta"|"media"|"baja";
  missingEvidence:string[]; reasoning:string[]; certainty?:"CONFIGURADO"|"NO_CONFIGURADO"|"HIPOTESIS_OBJETIVA"|"INDETERMINADO";
  temporal?:CaseLegalAnalysis;
}
export interface DynamicLegalQuestion { id:string; label:string; type:"text"|"date"|"select"|"textarea"; required?:boolean; options?:{label:string;value:string}[]; route:LegalRoute; }
export interface LegalDraft { hechos:string; solicitudConcreta:string; fundamentos:string; assessment:LegalAssessment; authorities:LegalAuthority[]; }

function truthy(v:unknown){return v===true||["si","sí","true","1"].includes(String(v??"").trim().toLowerCase());}
function normalized(v:string){return v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
function sanctioned(r:SelectedRecordData){
  const s=normalized(String(r.estado||""));
  const id=String(r.comparendo||"").trim().toUpperCase();
  const sanctionAct=/-SA(?:$|[-_\s])/i.test(id);
  const words=["multa","sancion","sancionado","pendiente de pago","cobro coactivo","cobro","mandamiento","acuerdo de pago","pagada","pagado","cancelada","cancelado"];
  return Boolean(sanctionAct||r.fechaResolucion||truthy(r.existeResolucion)||truthy(r.huboAudiencia))||words.some(w=>s.includes(normalized(w)));
}

export function assessTrafficRecord(r:SelectedRecordData):LegalAssessment{
  const routes:LegalRoute[]=[],missing:string[]=[],reasoning:string[]=[];
  const temporal=analyzeTemporalCase(r);
  const isSanctioned=sanctioned(r), code=normalized(String(r.codigo||""));

  if(isSanctioned){
    reasoning.push("El registro presenta elementos compatibles con una multa o sanción. La revisión se concentra en el acto sancionatorio, su firmeza, notificación, exigibilidad, prescripción, cobro y fuerza ejecutoria; no se trata automáticamente como un comparendo pendiente de decisión.");
  } else {
    routes.push("CADUCIDAD");
    reasoning.push("No se acredita en los datos disponibles una decisión sancionatoria culminada. Por ello debe confrontarse la fecha del hecho con la fecha en que la autoridad decidió sobre la imposición de la sanción.");
    missing.push("Expediente, acta o constancia de audiencia y decisión sancionatoria, si existe.");
  }

  if(temporal.initialExpiryDate){
    routes.push("PRESCRIPCION");
    reasoning.push(temporal.temporalConclusion);
    missing.push(...temporal.evidenceQuestions.filter(x=>/mandamiento|cobro|prescrip/i.test(x)));
  }

  if(r.fechaMandamientoPago){
    missing.push("Constancia de notificación del mandamiento y actuaciones posteriores de cobro.");
    routes.push("PERDIDA_EJECUTORIEDAD");
    reasoning.push("La existencia de un mandamiento de pago obliga a reconstruir el acto ejecutable, su firmeza y las actuaciones posteriores antes de concluir sobre fuerza ejecutoria o prescripción.");
  }

  if(!r.fechaNotificacion || !r.fechaNotificacionMandamiento){
    routes.push("NOTIFICACION");
    missing.push("Constancias de notificación de la orden de comparendo, resolución, recursos y mandamiento de pago, con fecha, medio, destinatario y soporte de entrega o publicación.");
    reasoning.push("La ausencia de una fecha de notificación en la información disponible no prueba que nunca se notificó. Sí exige reconstruir documentalmente qué acto fue comunicado, cuándo, por qué medio y con qué constancia.");
  }

  if(/fotodeteccion|fotomulta|c35|d02|camara/.test(code)){
    routes.push("FOTODETECCION");
    missing.push("Evidencia de detección, prueba técnica, soportes de identificación del infractor y constancias del procedimiento especial de fotodetección.");
    reasoning.push("El código o descripción apunta a una posible detección tecnológica. Debe verificarse la evidencia de la conducta y la forma en que la administración acreditó la imputación personal.");
  }

  routes.push("DEBIDO_PROCESO","REVOCATORIA_DIRECTA");
  const unique=[...new Set(routes)];
  const primary=unique.includes("PERDIDA_EJECUTORIEDAD")?"PERDIDA_EJECUTORIEDAD":unique.includes("PRESCRIPCION")?"PRESCRIPCION":unique.includes("CADUCIDAD")?"CADUCIDAD":unique.includes("FOTODETECCION")?"FOTODETECCION":unique.includes("NOTIFICACION")?"NOTIFICACION":"REVOCATORIA_DIRECTA";
  const priority=unique.includes("PRESCRIPCION")||unique.includes("PERDIDA_EJECUTORIEDAD")?"alta":unique.includes("CADUCIDAD")||unique.includes("FOTODETECCION")||unique.includes("NOTIFICACION")?"media":"baja";
  return {routes:unique,primaryRoute:primary,priority,missingEvidence:[...new Set(missing)],reasoning:[...new Set(reasoning)],certainty:temporal.certainty,temporal};
}

export function getDynamicLegalQuestions(record:SelectedRecordData,assessment:LegalAssessment):DynamicLegalQuestion[]{
  const q:DynamicLegalQuestion[]=[]; const add=(x:DynamicLegalQuestion)=>{if(q.length<4&&!q.some(y=>y.id===x.id))q.push(x);};
  if(assessment.routes.includes("PRESCRIPCION")&&!record.fechaNotificacionMandamiento)add({id:"fecha_notificacion_mandamiento",label:"¿Tienes la fecha en que te notificaron el mandamiento de pago?",type:"date",route:"PRESCRIPCION"});
  if(assessment.routes.includes("PRESCRIPCION")&&!record.fechaMandamientoPago)add({id:"existe_mandamiento_pago",label:"¿Sabes si alguna vez te notificaron un mandamiento de pago por esta multa?",type:"select",route:"PRESCRIPCION",options:[{label:"Sí",value:"si"},{label:"No",value:"no"},{label:"No lo sé",value:"no_se"}]});
  if(assessment.routes.includes("NOTIFICACION"))add({id:"forma_notificacion",label:"¿Recibiste alguna comunicación o notificación relacionada con esta multa?",type:"select",route:"NOTIFICACION",options:[{label:"Sí",value:"si"},{label:"No",value:"no"},{label:"No lo sé",value:"no_se"}]});
  if(assessment.routes.includes("PERDIDA_EJECUTORIEDAD"))add({id:"actuaciones_cobro",label:"¿Conoces alguna actuación de cobro posterior al mandamiento, como embargo, acuerdo de pago o pago?",type:"textarea",route:"PERDIDA_EJECUTORIEDAD"});
  return q;
}

function routeName(r:LegalRoute|null){switch(r){case"CADUCIDAD":return"la eventual caducidad de la actuación contravencional";case"PRESCRIPCION":return"la prescripción de la sanción y/o de la acción de cobro, según la cronología acreditada";case"PERDIDA_EJECUTORIEDAD":return"la eventual pérdida de fuerza ejecutoria del acto administrativo";case"NOTIFICACION":return"la regularidad y eficacia de las notificaciones";case"FOTODETECCION":return"la legalidad de la detección tecnológica y la imputación personal de la infracción";case"DEBIDO_PROCESO":return"la garantía del debido proceso administrativo sancionatorio";default:return"la revocatoria directa o el mecanismo que jurídicamente corresponda";}}
function authorityBlock(a:LegalAuthority){
  const source=`${a.source}${a.provision?`, ${a.provision}`:""}`;
  const parts=[`${source}: ${a.rule.trim()}`];
  if(a.development)parts.push(a.development.trim());
  if(a.application)parts.push(`En el caso concreto, ${a.application.trim().replace(/\.$/,"")}.`);
  if(a.precedent)parts.push(`Jurisprudencia relacionada: ${a.precedent.trim()}`);
  return parts.join("\n\n");
}
function buildTimeline(a:CaseLegalAnalysis){return a.events.map(e=>`${e.label}: ${e.date||"no acreditada"} [${e.status}]. ${e.legalEffect}`).join("\n\n");}

export function generateLegalDraft(r:SelectedRecordData):LegalDraft{
  const authority=r.organismo&&r.organismo!=="—"?r.organismo:"la autoridad de tránsito competente";
  const assessment=assessTrafficRecord(r), temporal=assessment.temporal!;
  const isSanctioned=sanctioned(r);
  const authorities=selectLegalAuthorities(assessment.routes,`${r.estado} ${r.codigo||""}`);
  const hechos=[
    `1. De acuerdo con el Estado de Cuenta del SIMIT aportado, aparece registrado el comparendo o actuación No. ${r.comparendo||"no identificada"}, con fecha ${r.fecha||"no identificada"}.`,
    `2. El registro figura asociado a ${authority} y registra un valor de ${r.valor||"no reportado"}.`,
    isSanctioned?`3. Los datos disponibles contienen elementos que indican que la actuación avanzó a una multa o sanción. Por ello, la controversia debe reconstruir el acto que produjo la obligación, su firmeza, notificación, exigibilidad y cobro.`:`3. La información aportada no permite afirmar que exista una decisión sancionatoria definitiva; esa circunstancia debe confrontarse con el expediente administrativo.`,
    `4. El Estado de Cuenta no acredita por sí solo todas las actuaciones de notificación ni la fecha de notificación del mandamiento de pago.`,
    `5. El análisis temporal identifica como fecha inicial ${temporal.initialDate||"no acreditada"} y, cuando es posible, calcula un vencimiento inicial de ${temporal.initialExpiryDate||"no determinado"}.`
  ].join("\n\n");

  const legalFramework=authorities.length?authorities.map(authorityBlock).join("\n\n"):"No se incorporará una cita normativa no respaldada por la biblioteca jurídica.";
  const application=[
    "4.1. Norma aplicable y presupuesto jurídico",
    temporal.rules.join("\n\n"),
    "4.2. Cómputo aplicado al caso concreto",
    temporal.executiveSummary,
    temporal.inferences.join("\n\n"),
    "4.3. Actuaciones que pueden modificar el cómputo",
    `La actuación decisiva para el análisis de prescripción posterior al inicio del cobro es la notificación del mandamiento de pago. Por ello debe distinguirse entre la fecha de expedición del mandamiento y la fecha en que fue efectivamente notificado. ${temporal.mandamientoNotificationDate?`En este caso se reporta como fecha de notificación ${temporal.mandamientoNotificationDate}, por lo que el análisis debe continuar desde ese hito.`:"En este caso esa fecha no está acreditada, de modo que no puede asumirse una interrupción eficaz."}`,
    "4.4. Hechos acreditados, inferencias y hechos pendientes de prueba",
    `Hechos acreditados:\n${temporal.facts.join("\n")||"No hay hechos temporales suficientes acreditados."}\n\nInferencias calculadas:\n${temporal.inferences.join("\n")||"No hay inferencias temporales confiables."}\n\nPrueba pendiente:\n${temporal.evidenceQuestions.join("\n")||"No se identifican pruebas temporales adicionales."}`,
    "4.5. Escenarios jurídicos",
    temporal.scenarios.map(s=>`${s.title}: ${s.condition}. En ese escenario, ${s.conclusion}`).join("\n\n"),
    "4.6. Conclusión jurídica sobre la información disponible",
    temporal.temporalConclusion,
    isSanctioned?"La existencia de una sanción visible impide tratar la caducidad del artículo 161 como conclusión automática. El expediente debe demostrar cuándo se decidió, cuándo quedó en firme y cómo se hizo exigible.":"La caducidad solo podrá afirmarse si el expediente demuestra que la autoridad no decidió oportunamente sobre la imposición de la sanción.",
    "4.7. Jurisprudencia aplicada",
    authorities.filter(a=>a.precedent).map(a=>`${a.source}, ${a.provision}: ${a.precedent}`).join("\n\n")||"La biblioteca no contiene un precedente específico adicional para esta hipótesis.",
    "4.8. Conclusión probatoria",
    `La ausencia de una constancia en el Estado de Cuenta no se convierte en un hecho negativo absoluto. Su efecto jurídico es distinto: identifica una prueba determinante que debe ser aportada por la autoridad para sostener la versión de la actuación que pretenda hacer valer. Por ello se solicita la trazabilidad documental completa y se dejan planteados los escenarios que deben resolverse según las fechas que resulten acreditadas.`
  ].join("\n\n");

  const requests=[
    `1. Que se remita copia íntegra, legible y completa del expediente administrativo relacionado con el comparendo o actuación No. ${r.comparendo||"no identificada"}.`,
    `2. Que se informe cuál fue el acto administrativo mediante el cual se impuso la sanción, indicando número, fecha y fecha de ejecutoria, y se remita copia íntegra.`,
    `3. Que se remitan las constancias de notificación de la orden de comparendo, acto sancionatorio, recursos y mandamiento de pago, indicando acto notificado, destinatario, medio, fecha y soporte de entrega, publicación o conocimiento.`,
    `4. Que se informe si se adelantó audiencia, su fecha, acta, pruebas practicadas y decisión adoptada, y se remitan las piezas correspondientes.`,
    `5. Que se informe si existe o existió proceso de cobro coactivo y se remitan sus actuaciones completas, incluyendo mandamiento, notificación, medidas cautelares, acuerdos, pagos y demás actuaciones posteriores, con sus respectivas fechas.`,
    `6. Que, con base en la cronología documentalmente acreditada, se determine expresamente si antes del ${temporal.initialExpiryDate||"vencimiento del término calculable"} se produjo una actuación interruptiva jurídicamente eficaz y, de ser así, cuál fue y cuándo fue notificada.`,
    `7. Que, si no se acredita una actuación interruptiva eficaz dentro del término aplicable, se declare y/o adopte la consecuencia jurídica correspondiente respecto de la prescripción, conforme al artículo 159 de la Ley 769 de 2002 y las demás normas aplicables.`,
    `8. Que, si se acredita una actuación interruptiva anterior al vencimiento, se indique el nuevo cómputo y se identifiquen las actuaciones posteriores que sustentan la exigibilidad actual de la obligación.`,
    `9. Que se determine, cuando corresponda, si existe pérdida de fuerza ejecutoria, irregularidad de notificación, vulneración del debido proceso, revocatoria directa u otra consecuencia jurídicamente procedente.`,
    `10. Que la respuesta sea de fondo, clara, congruente, motivada y completa respecto de cada solicitud.`
  ];
  if(/fotodeteccion|fotomulta|c35|d02|camara/.test(normalized(String(r.codigo||""))))requests.splice(8,0,"Que se aporte la evidencia de detección tecnológica, sus soportes técnicos y los documentos que permitan verificar la imputación personal de la infracción.");
  return {hechos,solicitudConcreta:requests.join("\n\n"),fundamentos:`III. PROBLEMA JURÍDICO\n\nDebe determinarse, a partir de los hechos y documentos disponibles, cuál es la situación jurídica actual de la actuación, qué término resulta aplicable, qué fecha inicia y vence el cómputo, qué actuaciones pueden modificarlo y qué consecuencia corresponde según la evidencia acreditada.\n\nIV. FUNDAMENTOS DE DERECHO\n\n${legalFramework}\n\nV. ANÁLISIS DEL CASO CONCRETO\n\n${application}\n\nVI. RECONSTRUCCIÓN CRONOLÓGICA\n\n${buildTimeline(temporal)}\n\nVII. PRUEBA Y DOCUMENTOS NECESARIOS\n\n${assessment.missingEvidence.map(x=>`• ${x}`).join("\n")}\n\nVIII. CONCLUSIÓN JURÍDICA\n\n${temporal.temporalConclusion}`,assessment,authorities};
}
