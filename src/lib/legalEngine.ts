import { selectLegalAuthorities, type LegalAuthority } from "./legalLibrary";

export interface SelectedRecordData {
  comparendo: string; fecha: string; organismo: string; estado: string; valor: string;
  placa?: string; cedula?: string; codigo?: string; fechaResolucion?: string;
  fechaNotificacion?: string; fechaMandamientoPago?: string; huboAudiencia?: boolean|string;
  existeResolucion?: boolean|string;
}
export type LegalRoute="CADUCIDAD"|"PRESCRIPCION"|"PERDIDA_EJECUTORIEDAD"|"NOTIFICACION"|"DEBIDO_PROCESO"|"FOTODETECCION"|"REVOCATORIA_DIRECTA";
export interface LegalAssessment { routes:LegalRoute[]; primaryRoute:LegalRoute|null; priority:"alta"|"media"|"baja"; missingEvidence:string[]; reasoning:string[]; }
export interface DynamicLegalQuestion { id:string; label:string; type:"text"|"date"|"select"|"textarea"; required?:boolean; options?:{label:string;value:string}[]; route:LegalRoute; }
export interface LegalDraft { hechos:string; solicitudConcreta:string; fundamentos:string; assessment:LegalAssessment; authorities:LegalAuthority[]; }

function parseDate(v?:string){
  if(!v)return null;
  const r=String(v).trim();
  const m=r.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  const d=new Date(`${m?`${m[3]}-${m[2]}-${m[1]}`:r}T00:00:00`);
  return Number.isNaN(d.getTime())?null:d;
}
function yearsSince(v?:string){const d=parseDate(v);return d?(Date.now()-d.getTime())/(365.2425*86400000):null;}
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
  const age=yearsSince(r.fecha),mandAge=yearsSince(r.fechaMandamientoPago),isSanctioned=sanctioned(r),code=normalized(String(r.codigo||""));
  if(isSanctioned){
    reasoning.push("El registro consultado ya presenta elementos compatibles con una multa o sanción. Por ello, el análisis no parte de una actuación contravencional todavía abierta: primero debe establecerse qué decisión produjo la obligación, cuándo quedó en firme, cómo fue notificada y qué ocurrió después.");
    if(!r.fechaResolucion&&!truthy(r.existeResolucion))missing.push("Resolución o acto administrativo sancionatorio y constancia de ejecutoria");
  } else if(age!==null&&age>=1){
    routes.push("CADUCIDAD");
    reasoning.push("La información disponible no muestra una decisión sancionatoria culminada y ha transcurrido al menos un año desde la fecha reportada. Esta circunstancia justifica verificar, directamente en el expediente, cuándo se decidió sobre la imposición de la sanción.");
    missing.push("Expediente, acta o constancia de audiencia y decisión sancionatoria, si existe");
  } else {
    reasoning.push("Con la información disponible no es posible concluir que la actuación haya caducado. La fecha y el estado del registro deben confrontarse con el expediente administrativo.");
  }
  if(age!==null&&age>=3){
    routes.push("PRESCRIPCION");
    reasoning.push("Por la antigüedad del registro corresponde revisar la prescripción de la obligación y, especialmente, establecer si existió mandamiento de pago, cuándo fue notificado y qué actuaciones de cobro se realizaron posteriormente.");
    if(!r.fechaMandamientoPago)missing.push("Mandamiento de pago, fecha de notificación y actuaciones posteriores de cobro, si existen");
  } else if(age!==null&&age>=2){
    reasoning.push("La fecha del hecho se aproxima al término de tres años relevante para la prescripción de las sanciones de tránsito. Conviene establecer desde ahora si existe mandamiento de pago y cuándo fue notificado.");
    if(!r.fechaMandamientoPago)missing.push("Información sobre existencia y notificación de mandamiento de pago");
  }
  if(r.fechaMandamientoPago){
    missing.push("Actuaciones de cobro posteriores al mandamiento y fecha de firmeza del acto ejecutado");
    if(mandAge!==null&&mandAge>=5){
      routes.push("PERDIDA_EJECUTORIEDAD");
      reasoning.push("Han transcurrido al menos cinco años desde la fecha reportada del mandamiento de pago. Esto hace necesario examinar si el acto que sirve de fundamento al cobro conserva fuerza ejecutoria y, para ello, reconstruir su firmeza y las actuaciones de ejecución realizadas dentro del término legal.");
    }
  }
  if(!r.fechaNotificacion){
    routes.push("NOTIFICACION");
    missing.push("Constancias de notificación de la orden de comparendo, resolución, recursos, mandamiento y demás actos relevantes");
    reasoning.push("El Estado de Cuenta SIMIT permite identificar el registro, pero no demuestra por sí mismo cómo se notificó cada actuación. Por eso deben solicitarse las constancias que permitan establecer destinatario, medio, fecha, contenido remitido y constancia de entrega o publicación.");
  }
  if(/fotodeteccion|fotomulta|c35|d02|camara/.test(code)){
    routes.push("FOTODETECCION");
    missing.push("Evidencia de detección, prueba técnica, soportes de identificación del infractor y constancias del procedimiento especial de fotodetección");
    reasoning.push("El código o la información disponible permite considerar una posible detección mediante medios tecnológicos. Si así ocurrió, debe verificarse tanto la prueba de la infracción como la forma en que la administración estableció la responsabilidad personal del sancionado.");
  }
  routes.push("DEBIDO_PROCESO","REVOCATORIA_DIRECTA");
  const unique=[...new Set(routes)];
  const primary=unique.includes("PERDIDA_EJECUTORIEDAD")?"PERDIDA_EJECUTORIEDAD":unique.includes("PRESCRIPCION")?"PRESCRIPCION":unique.includes("CADUCIDAD")?"CADUCIDAD":unique.includes("FOTODETECCION")?"FOTODETECCION":unique.includes("NOTIFICACION")?"NOTIFICACION":"REVOCATORIA_DIRECTA";
  const priority=unique.includes("PERDIDA_EJECUTORIEDAD")||unique.includes("PRESCRIPCION")?"alta":unique.includes("CADUCIDAD")||unique.includes("FOTODETECCION")||unique.includes("NOTIFICACION")?"media":"baja";
  return{routes:unique,primaryRoute:primary,priority,missingEvidence:[...new Set(missing)],reasoning:[...new Set(reasoning)]};
}

export function getDynamicLegalQuestions(record:SelectedRecordData,assessment:LegalAssessment):DynamicLegalQuestion[]{
  const q:DynamicLegalQuestion[]=[]; const add=(x:DynamicLegalQuestion)=>{if(q.length<2&&!q.some(y=>y.id===x.id))q.push(x);};
  if(assessment.routes.includes("PRESCRIPCION")&&!record.fechaMandamientoPago)add({id:"existe_mandamiento_pago",label:"¿Sabes si alguna vez te notificaron un mandamiento de pago por esta multa?",type:"select",route:"PRESCRIPCION",options:[{label:"Sí",value:"si"},{label:"No",value:"no"},{label:"No lo sé",value:"no_se"}]});
  if(assessment.routes.includes("NOTIFICACION"))add({id:"forma_notificacion",label:"¿Recibiste alguna comunicación o notificación relacionada con esta multa?",type:"select",route:"NOTIFICACION",options:[{label:"Sí",value:"si"},{label:"No",value:"no"},{label:"No lo sé",value:"no_se"}]});
  if(assessment.routes.includes("PERDIDA_EJECUTORIEDAD")&&q.length<2)add({id:"actuaciones_cobro",label:"¿Conoces alguna actuación de cobro posterior al mandamiento, como embargo, acuerdo de pago o pago?",type:"textarea",route:"PERDIDA_EJECUTORIEDAD"});
  return q;
}

function routeName(r:LegalRoute|null){switch(r){case"CADUCIDAD":return"la eventual caducidad de la actuación contravencional";case"PRESCRIPCION":return"la prescripción de la obligación y de la acción de cobro, según las fechas acreditadas";case"PERDIDA_EJECUTORIEDAD":return"la eventual pérdida de fuerza ejecutoria del acto administrativo";case"NOTIFICACION":return"la regularidad y eficacia de las notificaciones";case"FOTODETECCION":return"la legalidad de la detección tecnológica y la imputación personal de la infracción";case"DEBIDO_PROCESO":return"la garantía del debido proceso administrativo sancionatorio";default:return"la revocatoria directa o el mecanismo que jurídicamente corresponda";}}

function authorityBlock(a:LegalAuthority){
  const source=`${a.source}${a.provision?`, ${a.provision}`:""}`;
  const parts=[`En cuanto a ${source}, esta disposición resulta relevante porque ${a.rule.trim().replace(/\.$/,"")}.`];
  if(a.development)parts.push(a.development.trim());
  if(a.application)parts.push(`Llevado al caso concreto, ${a.application.trim().replace(/^Aplicación al caso:\s*/i,"").replace(/\.$/,"")}.`);
  if(a.precedent)parts.push(`Este entendimiento encuentra respaldo en el criterio señalado por la fuente: ${a.precedent.trim()}`);
  return parts.join("\n\n");
}

function buildTimeline(r:SelectedRecordData){return[
  `La fecha que actualmente puede tenerse por identificada es la del ${r.fecha||"hecho no determinada"}.`,
  r.fechaResolucion?`Respecto de la decisión sancionatoria, se reporta la fecha ${r.fechaResolucion}.`:`En el Estado de Cuenta no aparece acreditada la fecha de la resolución o acto sancionatorio.`,
  r.fechaNotificacion?`Se reporta como fecha de notificación ${r.fechaNotificacion}.`:`Tampoco aparece acreditada en la fuente aportada la fecha y forma de notificación.`,
  r.fechaMandamientoPago?`En relación con el cobro, se reporta mandamiento de pago de fecha ${r.fechaMandamientoPago}.`:`No se identifica en la fuente aportada la fecha de un mandamiento de pago.`
].join("\n\n");}

export function generateLegalDraft(r:SelectedRecordData):LegalDraft{
  const authority=r.organismo&&r.organismo!=="—"?r.organismo:"la autoridad de tránsito competente";
  const assessment=assessTrafficRecord(r); const primary=routeName(assessment.primaryRoute); const isSanctioned=sanctioned(r);
  const authorities=selectLegalAuthorities(assessment.routes,`${r.estado} ${r.codigo||""}`);
  const hechos=[
    `1. De acuerdo con el Estado de Cuenta del SIMIT aportado para esta revisión, aparece registrado el comparendo o actuación No. ${r.comparendo||"no identificada"}, con fecha ${r.fecha||"no identificada"}.`,
    `2. El registro figura asociado a ${authority} y registra un valor de ${r.valor||"no reportado"}, según la información contenida en el documento consultado.`,
    isSanctioned
      ? `3. La forma en que aparece actualmente identificado el registro permite advertir que la actuación habría avanzado hasta una multa o sanción. Por esa razón, esta solicitud no parte de la idea de que el procedimiento siga abierto; lo que interesa establecer es qué acto produjo la sanción, cuándo quedó en firme, cómo fue comunicado al interesado y cuál ha sido su situación posterior.`
      : `3. El Estado de Cuenta, por sí solo, no permite reconstruir todas las etapas del procedimiento ni establecer si hubo una decisión sancionatoria definitiva. Esa información debe confrontarse con el expediente que conserva la autoridad.`,
    r.fechaNotificacion?`4. En la información disponible se reporta una fecha de notificación (${r.fechaNotificacion}); sin embargo, para establecer sus efectos jurídicos es necesario conocer el acto notificado y la constancia correspondiente.`:`4. No aparece en el Estado de Cuenta una constancia que permita establecer, por sí sola, la fecha, modalidad, destinatario y efectividad de las notificaciones practicadas dentro de la actuación.`,
    r.fechaMandamientoPago?`5. Se reporta un mandamiento de pago de fecha ${r.fechaMandamientoPago}. Será necesario establecer cuándo fue notificado y qué actuaciones de cobro se produjeron después.`:`5. No aparece identificada en el Estado de Cuenta la fecha de un mandamiento de pago. Por ello resulta necesario que la autoridad informe si existe y remita las constancias correspondientes.`
  ].join("\n\n");
  const problema=isSanctioned
    ? `La cuestión que debe resolverse no consiste simplemente en establecer cuánto tiempo ha pasado desde el comparendo. Tratándose de un registro que ya aparece asociado a una multa o sanción, es necesario determinar si el acto administrativo que la impuso conserva validez, firmeza, fuerza ejecutoria y exigibilidad; si fue debidamente notificado; si la obligación llegó a cobro coactivo y, a partir de esa cronología, si existe alguna consecuencia jurídica como prescripción, pérdida de fuerza ejecutoria, irregularidad sustancial o causal de revocatoria.`
    : `Debe establecerse si la actuación fue decidida dentro del término legal y, en caso de existir sanción, si el acto correspondiente fue debidamente notificado, quedó en firme y conserva actualmente fuerza ejecutoria y exigibilidad.`;
  const marco=authorities.length?authorities.map(authorityBlock).join("\n\n"):"La biblioteca jurídica no devolvió una fuente específica para esta ruta. No se incorporará una cita automática sin respaldo suficiente.";
  const applicationParts:string[]=[];
  if(isSanctioned)applicationParts.push(`Hay una precisión inicial que resulta determinante: no sería jurídicamente consistente solicitar la caducidad como si el comparendo permaneciera pendiente de decisión cuando el propio registro contiene elementos que apuntan a una multa o sanción. La discusión debe trasladarse al acto que impuso la sanción, a su firmeza y a las actuaciones posteriores. El artículo 161 de la Ley 769 de 2002 debe leerse en función del momento en que la autoridad decide sobre la imposición de la sanción, no como una herramienta para desconocer automáticamente una multa que ya fue impuesta.`);
  else if(assessment.routes.includes("CADUCIDAD"))applicationParts.push(`En este escenario sí existe una razón objetiva para revisar la caducidad, pero no para afirmarla anticipadamente. Lo determinante será comparar la fecha del hecho con la fecha real en que la autoridad decidió sobre la imposición de la sanción y verificar las actuaciones que obren en el expediente.`);
  if(assessment.routes.includes("PRESCRIPCION"))applicationParts.push(`La antigüedad del registro hace especialmente relevante la prescripción. El artículo 159 de la Ley 769 de 2002 establece el término aplicable y contempla la incidencia del mandamiento de pago. Por eso no basta con contar tres años desde la fecha visible en SIMIT: hay que identificar el acto que sirve de título, su firmeza, el mandamiento, la fecha en que fue notificado y las actuaciones posteriores de cobro. Solo con esa secuencia puede determinarse si la obligación continúa siendo exigible o si se configuró la prescripción.`);
  if(assessment.routes.includes("PERDIDA_EJECUTORIEDAD"))applicationParts.push(`La fecha del mandamiento también obliga a examinar la fuerza ejecutoria del acto que sirve de fundamento al cobro. Si han transcurrido cinco años o más, la cuestión no se resuelve mirando únicamente la fecha del mandamiento: debe establecerse cuál es el acto ejecutable, cuándo quedó en firme y si durante ese período existieron actuaciones de ejecución que jurídicamente impidan o alteren el cómputo. Esa verificación debe hacerse con el expediente de cobro.`);
  if(assessment.routes.includes("NOTIFICACION"))applicationParts.push(`En materia de notificación, la ausencia de una fecha en el Estado de Cuenta no permite concluir por sí misma que nunca se notificó o que la notificación fue irregular. Lo que sí justifica es exigir la trazabilidad documental de cada actuación relevante: qué acto se notificó, a quién, por qué medio, en qué fecha, qué documento fue remitido y qué constancia demuestra su entrega, publicación o conocimiento. Esa información es indispensable para establecer desde cuándo produjo efectos el acto y para ejercer adecuadamente la defensa.`);
  if(assessment.routes.includes("FOTODETECCION"))applicationParts.push(`Si la infracción fue detectada mediante medios tecnológicos, el expediente debe permitir verificar la evidencia de la conducta y, además, la forma en que la administración vinculó personalmente al ciudadano con la infracción. La titularidad del vehículo y la responsabilidad administrativa sancionatoria no son conceptos intercambiables; la autoridad debe mostrar cómo se satisfizo la garantía de imputación personal exigida por la jurisprudencia constitucional.`);
  applicationParts.push(`En consecuencia, la solicitud no formula como hechos probados aquellos aspectos que el Estado de Cuenta no acredita. Se pide a la autoridad reconstruir la actuación con documentos verificables y, una vez establecida esa cronología, adoptar la consecuencia jurídica que corresponda. Esto permite que la discusión se concentre en el expediente y no en presunciones derivadas de un simple registro informativo.`);
  const fundamentos=[
    "III. PROBLEMA JURÍDICO",problema,"",
    "IV. FUNDAMENTOS JURÍDICOS",marco,"",
    "V. APLICACIÓN DE LAS NORMAS AL CASO CONCRETO",applicationParts.join("\n\n"),"",
    "VI. RECONSTRUCCIÓN CRONOLÓGICA DE LA ACTUACIÓN",buildTimeline(r),"",
    "VII. DOCUMENTOS CUYA INCORPORACIÓN RESULTA NECESARIA",assessment.missingEvidence.length?assessment.missingEvidence.map(x=>`• ${x}`).join("\n"):"• Expediente administrativo íntegro y constancias de las actuaciones relevantes.","",
    "VIII. CONCLUSIÓN JURÍDICA",`Con la información actualmente disponible, la ruta principal corresponde a ${primary}. Esta conclusión es preliminar y está condicionada a la verificación del expediente. ${isSanctioned?"La existencia de indicadores de sanción impide tratar la caducidad como conclusión automática; el análisis debe concentrarse en la legalidad, firmeza, notificación, exigibilidad y cobro de la sanción.":"La caducidad solo podrá afirmarse si la documentación demuestra que la autoridad no decidió oportunamente sobre la imposición de la sanción."}`
  ].join("\n");
  const requests=[
    `1. Que se remita copia íntegra, legible y completa del expediente administrativo relacionado con el comparendo o actuación No. ${r.comparendo||"no identificada"}, incluyendo todas las actuaciones que permitan reconstruir su trámite desde el origen hasta su estado actual.`,
    `2. Que se informe de manera precisa cuál fue el acto administrativo mediante el cual, de ser el caso, se impuso la multa, indicando su número, fecha, contenido esencial y fecha de ejecutoria, y que se remita copia íntegra del mismo.`,
    `3. Que se remitan las constancias de notificación de la orden de comparendo, del acto sancionatorio, de los recursos que se hubieren presentado y del mandamiento de pago, si existe, indicando medio empleado, destinatario, fecha, documento remitido y constancia de entrega, publicación o conocimiento.`,
    `4. Que se informe si se adelantó audiencia dentro de la actuación, indicando fecha, autoridad que la realizó, acta correspondiente, pruebas practicadas y decisión adoptada, y que se remitan las piezas respectivas.`,
    `5. Que se informe si existe o existió proceso de cobro coactivo y se remita la totalidad de las actuaciones posteriores al acto sancionatorio, particularmente el mandamiento de pago, su notificación, medidas cautelares, acuerdos, pagos y demás actuaciones con incidencia en la exigibilidad o prescripción de la obligación.`,
    `6. Que, una vez establecidas documentalmente las fechas relevantes, se determine expresamente si se configura alguna causal de prescripción, pérdida de fuerza ejecutoria, irregularidad de notificación, vulneración del debido proceso, revocatoria directa u otra consecuencia jurídica procedente.`,
    `7. Que, si se acredita una circunstancia que afecte la validez, ejecutoriedad o exigibilidad de la actuación, se adopte la decisión administrativa que legalmente corresponda y se actualicen los registros administrativos y sistemas de información a que haya lugar.`,
    `8. Que la respuesta sea de fondo, clara, congruente, motivada y completa respecto de cada una de las solicitudes formuladas.`
  ];
  if(assessment.routes.includes("FOTODETECCION"))requests.splice(5,0,"Que se aporte la evidencia de detección tecnológica, sus soportes técnicos, validaciones, identificación del vehículo y/o conductor, comunicaciones remitidas y demás documentos que permitan verificar la imputación personal de la infracción.");
  return{hechos,solicitudConcreta:requests.join("\n\n"),fundamentos,assessment,authorities};
}
