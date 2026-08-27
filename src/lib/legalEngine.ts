import { selectLegalAuthorities, type LegalAuthority } from "./legalLibrary";

export interface SelectedRecordData {
  comparendo:string;
  fecha:string;
  organismo:string;
  estado:string;
  valor:string;
  placa?:string;
  cedula?:string;
  codigo?:string;
  fechaResolucion?:string;
  fechaNotificacion?:string;
  fechaMandamientoPago?:string;
  huboAudiencia?:boolean|string;
  existeResolucion?:boolean|string;
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

/**
 * SIMIT es una fuente de identificación/estado, no el expediente.
 * Un registro que ya aparece como multa, sanción, cobro o con identificador
 * sancionatorio no se trata como una actuación contravencional todavía abierta.
 */
function sanctioned(r:SelectedRecordData){
  const s=normalized(String(r.estado||""));
  const id=String(r.comparendo||"").trim().toUpperCase();
  const sanctionAct=/-SA(?:$|[-_\s])/i.test(id);
  const sanctionWords=["multa","sancion","sancionado","pendiente de pago","cobro coactivo","cobro","mandamiento","acuerdo de pago","pagada","pagado","cancelada","cancelado"];
  return Boolean(sanctionAct||r.fechaResolucion||truthy(r.existeResolucion)||truthy(r.huboAudiencia))||sanctionWords.some(w=>s.includes(normalized(w)));
}

export function assessTrafficRecord(r:SelectedRecordData):LegalAssessment{
  const routes:LegalRoute[]=[],missing:string[]=[],reasoning:string[]=[];
  const age=yearsSince(r.fecha),mandAge=yearsSince(r.fechaMandamientoPago),isSanctioned=sanctioned(r),code=normalized(String(r.codigo||""));

  if(isSanctioned){
    reasoning.push("El registro contiene indicadores de que la actuación avanzó a una multa, sanción o acto sancionatorio (por ejemplo, estado de multa/cobro, resolución, audiencia o identificador sancionatorio). Por esa razón, TrámiteYa no plantea la caducidad como conclusión ni como ruta automática: primero debe reconstruirse el acto que produjo la sanción, su firmeza, notificación y eventual cobro.");
    if(!r.fechaResolucion&&!truthy(r.existeResolucion))missing.push("Resolución o acto administrativo sancionatorio y constancia de ejecutoria");
  } else if(age!==null&&age>=1){
    routes.push("CADUCIDAD");
    reasoning.push("La fuente disponible no evidencia una decisión sancionatoria culminada y ha transcurrido al menos un año desde la fecha reportada del hecho. La caducidad debe verificarse confrontando la fecha del hecho con la fecha real de la decisión sobre la imposición de la sanción.");
    missing.push("Expediente, acta o constancia de audiencia y decisión sancionatoria, si existe");
  } else if(!isSanctioned){
    reasoning.push("No existe información suficiente para afirmar que la actuación contravencional haya culminado o que haya transcurrido el término legal de caducidad; el expediente es necesario para fijar la ruta definitiva.");
  }

  if(age!==null&&age>=3){
    routes.push("PRESCRIPCION");
    reasoning.push("Han transcurrido al menos tres años desde la fecha reportada del hecho. Esto activa una revisión de la prescripción prevista para las sanciones de tránsito, pero el resultado depende de la existencia y notificación del mandamiento de pago y de las actuaciones posteriores de cobro.");
    if(!r.fechaMandamientoPago)missing.push("Mandamiento de pago, fecha de notificación y actuaciones posteriores de cobro, si existen");
  } else if(age!==null&&age>=2){
    reasoning.push("La antigüedad se aproxima al término de tres años previsto para la prescripción de las sanciones de tránsito, por lo que conviene reconstruir desde ahora la existencia y notificación de cualquier mandamiento de pago.");
    if(!r.fechaMandamientoPago)missing.push("Información sobre existencia y notificación de mandamiento de pago");
  }

  if(r.fechaMandamientoPago){
    missing.push("Actuaciones de cobro posteriores al mandamiento y fecha de firmeza del acto ejecutado");
    if(mandAge!==null&&mandAge>=5){
      routes.push("PERDIDA_EJECUTORIEDAD");
      reasoning.push("La fecha reportada del mandamiento tiene cinco o más años. Esto justifica revisar la fuerza ejecutoria del acto administrativo, pero el cómputo jurídico exige identificar el acto ejecutable, su firmeza y las actuaciones realizadas para ejecutarlo.");
    }
  }

  if(!r.fechaNotificacion){
    routes.push("NOTIFICACION");
    missing.push("Constancias de notificación de la orden de comparendo, resolución, recursos, mandamiento y demás actos relevantes");
    reasoning.push("El Estado de Cuenta SIMIT no demuestra por sí solo la fecha, modalidad, destinatario, contenido remitido ni efectividad de las notificaciones. Esa trazabilidad debe reconstruirse con las constancias que reposen en el expediente.");
  }

  if(/fotodeteccion|fotomulta|c35|d02|camara|camara/.test(code)){
    routes.push("FOTODETECCION");
    missing.push("Evidencia de detección, prueba técnica, soportes de identificación del infractor y constancias del procedimiento especial de fotodetección");
    reasoning.push("El código o descripción disponible sugiere una infracción susceptible de haber sido detectada por medios tecnológicos; por ello debe verificarse la evidencia técnica y la imputación personal de la conducta.");
  }

  routes.push("DEBIDO_PROCESO","REVOCATORIA_DIRECTA");
  const unique=[...new Set(routes)];
  const primary=unique.includes("PERDIDA_EJECUTORIEDAD")?"PERDIDA_EJECUTORIEDAD":unique.includes("PRESCRIPCION")?"PRESCRIPCION":unique.includes("CADUCIDAD")?"CADUCIDAD":unique.includes("FOTODETECCION")?"FOTODETECCION":unique.includes("NOTIFICACION")?"NOTIFICACION":"REVOCATORIA_DIRECTA";
  const priority=unique.includes("PERDIDA_EJECUTORIEDAD")||unique.includes("PRESCRIPCION")?"alta":unique.includes("CADUCIDAD")||unique.includes("FOTODETECCION")||unique.includes("NOTIFICACION")?"media":"baja";
  return{routes:unique,primaryRoute:primary,priority,missingEvidence:[...new Set(missing)],reasoning:[...new Set(reasoning)]};
}

export function getDynamicLegalQuestions(record:SelectedRecordData,assessment:LegalAssessment):DynamicLegalQuestion[]{
  const q:DynamicLegalQuestion[]=[];
  const add=(x:DynamicLegalQuestion)=>{if(q.length<2&&!q.some(y=>y.id===x.id))q.push(x);};
  if(assessment.routes.includes("PRESCRIPCION")&&!record.fechaMandamientoPago)add({id:"existe_mandamiento_pago",label:"¿Sabes si alguna vez te notificaron un mandamiento de pago por esta multa?",type:"select",route:"PRESCRIPCION",options:[{label:"Sí",value:"si"},{label:"No",value:"no"},{label:"No lo sé",value:"no_se"}]});
  if(assessment.routes.includes("NOTIFICACION"))add({id:"forma_notificacion",label:"¿Recibiste alguna notificación relacionada con esta multa?",type:"select",route:"NOTIFICACION",options:[{label:"Sí",value:"si"},{label:"No",value:"no"},{label:"No lo sé",value:"no_se"}]});
  if(assessment.routes.includes("PERDIDA_EJECUTORIEDAD")&&q.length<2)add({id:"actuaciones_cobro",label:"¿Conoces alguna actuación de cobro posterior al mandamiento (embargo, acuerdo o pago)?",type:"textarea",route:"PERDIDA_EJECUTORIEDAD"});
  return q;
}

function routeName(r:LegalRoute|null){
  switch(r){
    case"CADUCIDAD":return"caducidad de la actuación contravencional";
    case"PRESCRIPCION":return"prescripción de la sanción/obligación y de la acción de cobro, según las fechas y actuaciones acreditadas";
    case"PERDIDA_EJECUTORIEDAD":return"pérdida de fuerza ejecutoria del acto administrativo, si se configuran sus presupuestos";
    case"NOTIFICACION":return"regularidad, eficacia y trazabilidad de las notificaciones";
    case"FOTODETECCION":return"legalidad de la detección tecnológica, vinculación al procedimiento e imputación personal";
    case"DEBIDO_PROCESO":return"debido proceso administrativo sancionatorio";
    default:return"revocatoria directa u otro mecanismo jurídicamente procedente";
  }
}

function authorityBlock(a:LegalAuthority){
  const lines=[`• ${a.source}, ${a.provision}`,`Regla: ${a.rule}`,`Desarrollo: ${a.development}`,`Aplicación al caso: ${a.application}`];
  if(a.precedent)lines.push(`Precedente/criterio: ${a.precedent}`);
  return lines.join("\n");
}

function buildTimeline(r:SelectedRecordData){
  return [
    `Hecho/registro: ${r.fecha||"no acreditado en la fuente disponible"}`,
    `Resolución/acto sancionatorio: ${r.fechaResolucion||"no acreditado en SIMIT"}`,
    `Notificación: ${r.fechaNotificacion||"no acreditada en SIMIT"}`,
    `Mandamiento de pago: ${r.fechaMandamientoPago||"no acreditado en SIMIT"}`,
  ].join("\n");
}

export function generateLegalDraft(r:SelectedRecordData):LegalDraft{
  const authority=r.organismo&&r.organismo!=="—"?r.organismo:"la Autoridad de Tránsito competente";
  const assessment=assessTrafficRecord(r);
  const primary=routeName(assessment.primaryRoute);
  const isSanctioned=sanctioned(r);
  const authorities=selectLegalAuthorities(assessment.routes,`${r.estado} ${r.codigo||""}`);

  const hechos=[
    `1. En el Estado de Cuenta del SIMIT se encuentra registrado a mi nombre el comparendo/actuación No. ${r.comparendo||"no identificado"}, de fecha ${r.fecha||"no identificada"}.`,
    `2. El registro aparece asociado a ${authority}, con estado "${r.estado||"no identificado"}" y valor reportado de ${r.valor||"no reportado"}.`,
    isSanctioned
      ? `3. La información disponible contiene indicadores de que la actuación avanzó a una multa, sanción o acto sancionatorio. En consecuencia, la revisión no parte de considerar que el proceso contravencional permanezca abierto, sino de reconstruir el acto que produjo la sanción, su ejecutoria, notificación, exigibilidad y eventual cobro.`
      : `3. La información disponible no permite acreditar por sí sola que exista una decisión sancionatoria definitiva; este extremo debe verificarse directamente en el expediente.`,
    `4. ${r.fechaNotificacion?`Se reporta como fecha de notificación ${r.fechaNotificacion}.` : `El Estado de Cuenta no acredita por sí solo la fecha, modalidad, destinatario, contenido remitido ni efectividad de las notificaciones.`}`,
    `5. ${r.fechaMandamientoPago?`Se reporta mandamiento de pago de fecha ${r.fechaMandamientoPago}; deben verificarse su notificación, el acto ejecutado, su firmeza y las actuaciones posteriores de cobro.` : `No se identifica fecha acreditada de mandamiento de pago; corresponde solicitar expresamente si existe, cuándo fue expedido y cómo fue notificado.`}`,
  ].join("\n");

  const problema=isSanctioned
    ? `Determinar si la multa/acto sancionatorio asociado al registro No. ${r.comparendo||"no identificado"} conserva validez, ejecutoriedad y exigibilidad, y si las actuaciones de notificación y cobro se ajustaron al ordenamiento jurídico; así como establecer, si las fechas lo permiten, si existe prescripción, pérdida de fuerza ejecutoria, irregularidad procedimental o causal de revocatoria.`
    : `Determinar si la actuación contravencional asociada al registro No. ${r.comparendo||"no identificado"} fue decidida dentro del término legal y, de existir sanción, si su notificación, firmeza, ejecutoriedad y eventual cobro se ajustan al ordenamiento jurídico.`;

  const marco=authorities.length
    ? authorities.map(authorityBlock).join("\n\n")
    : "No se identificó una fuente específica en la biblioteca para la ruta detectada; debe efectuarse revisión jurídica adicional antes de presentar el documento.";

  const applicationParts:string[]=[];
  if(isSanctioned){
    applicationParts.push(`La primera consecuencia metodológica es descartar una petición de caducidad formulada como si el comparendo siguiera sin decisión. La existencia de indicadores de multa/sanción impide convertir el simple transcurso del tiempo desde el comparendo en una conclusión de caducidad. El artículo 161 de la Ley 769 de 2002 dirige la caducidad a la decisión sobre la imposición de la sanción; por ello la actuación debe reconstruirse a partir del acto sancionatorio y su expediente.`);
  } else if(assessment.routes.includes("CADUCIDAD")){
    applicationParts.push(`La hipótesis de caducidad sí merece verificación porque la fuente no muestra una culminación sancionatoria y ha transcurrido el término anual. Sin embargo, la conclusión solo puede formularse después de conocer la fecha real de la decisión que impuso o negó la sanción.`);
  }
  if(assessment.routes.includes("PRESCRIPCION")){
    applicationParts.push(`En materia de prescripción, el artículo 159 de la Ley 769 de 2002 establece un término de tres años desde la ocurrencia del hecho y prevé la interrupción por la notificación del mandamiento de pago. El precedente del Consejo de Estado exige integrar esta regla con el régimen de cobro coactivo y, por ello, resulta indispensable conocer la fecha y constancia de notificación del mandamiento y las actuaciones posteriores. La antigüedad del registro no permite, por sí sola, declarar prescrita la obligación.`);
  } else if(yearsSince(r.fecha)!==null){
    applicationParts.push(`Con la fecha actualmente disponible no se configura todavía, por simple transcurso del tiempo, el supuesto temporal de tres años del artículo 159 de la Ley 769 de 2002; aun así, la autoridad debe informar si existe mandamiento de pago y cuál fue su fecha de notificación para conservar una cronología verificable.`);
  }
  if(assessment.routes.includes("NOTIFICACION")){
    applicationParts.push(`La ausencia de una fecha de notificación en SIMIT no prueba una notificación defectuosa. Lo jurídicamente exigible es que la autoridad aporte las constancias que permitan verificar el medio empleado, destinatario, fecha, acto remitido, entrega o publicación y recursos disponibles. El régimen de notificaciones del CPACA opera de manera complementaria en lo no regulado especialmente por tránsito.`);
  }
  if(assessment.routes.includes("FOTODETECCION")){
    applicationParts.push(`Si el registro corresponde a detección tecnológica, la autoridad debe demostrar no solo la ocurrencia del hecho sino la forma en que vinculó al ciudadano al procedimiento y determinó la responsabilidad personal. Las sentencias C-530 de 2003 y C-038 de 2020 impiden tratar la mera titularidad del vehículo como sustituto de la imputación personal cuando la sanción es de naturaleza sancionatoria.`);
  }
  applicationParts.push(`La petición se estructura deliberadamente como una solicitud de reconstrucción probatoria y decisión jurídica: primero exige los documentos que permiten fijar la línea temporal; después pide a la autoridad aplicar las consecuencias que correspondan. Así se evita afirmar como hecho probado una resolución, audiencia, notificación o actuación de cobro que el Estado de Cuenta no demuestra.`);

  const fundamentos=[
    "III. PROBLEMA JURÍDICO",
    problema,
    "",
    "IV. MARCO NORMATIVO Y JURISPRUDENCIAL DESARROLLADO",
    marco,
    "",
    "V. APLICACIÓN DEL MARCO JURÍDICO AL CASO CONCRETO",
    applicationParts.join("\n\n"),
    "",
    "VI. CRONOLOGÍA QUE DEBE SER ACREDITADA",
    buildTimeline(r),
    "",
    "VII. EVIDENCIA QUE DEBE OBRAR EN EL EXPEDIENTE",
    assessment.missingEvidence.length?assessment.missingEvidence.map(x=>`• ${x}`).join("\n"):"• Expediente administrativo íntegro y constancias de las actuaciones relevantes.",
    "",
    "VIII. CONCLUSIÓN JURÍDICA PRELIMINAR",
    isSanctioned
      ? `Con la información disponible no existe base suficiente para afirmar la caducidad de la actuación contravencional. Por el contrario, los datos sugieren que la actuación avanzó a una sanción/multa, por lo que las líneas jurídicamente relevantes son la reconstrucción del acto sancionatorio, su notificación y ejecutoria, la eventual prescripción conforme al artículo 159 de la Ley 769 de 2002, la fuerza ejecutoria y las irregularidades que efectivamente resulten acreditadas.`
      : `La caducidad solo podrá afirmarse si el expediente demuestra que no se decidió sobre la imposición de la sanción dentro del término del artículo 161 de la Ley 769 de 2002. Mientras no exista esa prueba, la petición debe conservar carácter de verificación y no de conclusión anticipada.`,
  ].join("\n");

  const requests=[
    `1. Que se remita copia íntegra, legible y completa del expediente administrativo relacionado con la actuación No. ${r.comparendo||"no identificada"}.`,
    `2. Que se informe la naturaleza exacta del registro y, si existe sanción, se indique el número, fecha, contenido esencial y fecha de ejecutoria del acto administrativo que la impuso.`,
    `3. Que se remitan las constancias completas de notificación de la orden de comparendo, decisión sancionatoria, recursos, mandamiento de pago y demás actos relevantes, indicando fecha, medio, destinatario, documento remitido y constancia de entrega, publicación o conocimiento.`,
    `4. Que se informe si se adelantó audiencia, indicando fecha, autoridad que la realizó, acta o constancia correspondiente, pruebas practicadas y decisión adoptada; y que se remitan copias de tales actuaciones.`,
    `5. Que se informe si existe o existió cobro coactivo y se remita la totalidad de las actuaciones posteriores, incluido mandamiento de pago, su notificación, medidas cautelares, acuerdos, pagos, facilidades, actuaciones de ejecución y demás actuaciones con incidencia en la prescripción.`,
    `6. Que, con base en las fechas y documentos efectivamente acreditados, se determine expresamente si se configura prescripción, pérdida de fuerza ejecutoria, irregularidad de notificación, vulneración del debido proceso, revocatoria directa u otra consecuencia jurídica procedente.`,
    `7. Que, si se acredita una causal que afecte la validez, ejecutoriedad o exigibilidad de la actuación, se adopte la decisión administrativa correspondiente y se actualicen o depuren los registros administrativos y sistemas de información que legalmente procedan.`,
    `8. Que se emita respuesta de fondo, clara, congruente, motivada y completa frente a cada una de las solicitudes anteriores.`
  ];
  if(assessment.routes.includes("FOTODETECCION"))requests.splice(5,0,`Que se aporte la evidencia de detección tecnológica, soportes técnicos, validación, identificación del vehículo/conductor, comunicaciones remitidas y documentos que permitan verificar la imputación personal de la infracción.`);

  return{hechos,solicitudConcreta:requests.join("\n"),fundamentos,assessment,authorities};
}
