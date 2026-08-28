export type EvidenceStatus = "ACREDITADO" | "NO_ACREDITADO" | "INFERIDO";
export type LegalCertainty = "CONFIGURADO" | "NO_CONFIGURADO" | "HIPOTESIS_OBJETIVA" | "INDETERMINADO";

export interface CaseEvent { id:string; label:string; date:string|null; status:EvidenceStatus; source:string; legalEffect:string; }
export interface TemporalScenario { id:string; title:string; condition:string; conclusion:string; }
export interface CaseLegalAnalysis {
  initialDate:string|null; initialExpiryDate:string|null; yearsTerm:number|null;
  caducityExpiryDate:string|null; caducityStatus:LegalCertainty;
  mandamientoDate:string|null; mandamientoNotificationDate:string|null; postMandamientoExpiryDate:string|null;
  ejecutoriaDate:string|null; ejecutoriaExpiryDate:string|null; ejecutoriaStatus:LegalCertainty;
  events:CaseEvent[]; scenarios:TemporalScenario[]; certainty:LegalCertainty;
  executiveSummary:string; temporalConclusion:string; evidenceQuestions:string[]; facts:string[]; inferences:string[]; rules:string[];
}

function parseDate(value?:string|null):Date|null {
  if(!value)return null;
  const raw=String(value).trim();
  const dmy=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  const iso=dmy?`${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`:raw;
  const date=new Date(`${iso.slice(0,10)}T00:00:00Z`);
  return Number.isNaN(date.getTime())?null:date;
}
export function formatDate(value:Date|null):string|null { return value?new Intl.DateTimeFormat("es-CO",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"}).format(value):null; }
export function addYears(value:string|undefined|null,years:number):string|null { const date=parseDate(value); if(!date)return null; const result=new Date(date.getTime()); result.setUTCFullYear(result.getUTCFullYear()+years); return formatDate(result); }
function hasValue(value?:string|boolean|null){return value!==undefined&&value!==null&&String(value).trim()!=="";}
function affirmative(value?:string|boolean|null){return value===true||["si","sí","true","1"].includes(String(value??"").trim().toLowerCase());}

export interface TemporalRecordInput { comparendo:string; fecha:string; organismo:string; estado:string; fechaResolucion?:string; fechaNotificacion?:string; fechaMandamientoPago?:string; fechaNotificacionMandamiento?:string; fechaEjecutoria?:string; huboAudiencia?:boolean|string; existeResolucion?:boolean|string; actuacionesCobro?:string; }

export function analyzeTemporalCase(record:TemporalRecordInput):CaseLegalAnalysis {
  const initialExpiryDate=addYears(record.fecha,3);
  const caducityExpiryDate=addYears(record.fecha,1);
  const mandamientoNotificationDate=record.fechaNotificacionMandamiento||null;
  const postMandamientoExpiryDate=addYears(mandamientoNotificationDate,3);
  const ejecutoriaDate=record.fechaEjecutoria||null;
  const ejecutoriaExpiryDate=addYears(ejecutoriaDate,5);
  const facts:string[]=[],inferences:string[]=[],rules:string[]=[],evidenceQuestions:string[]=[],events:CaseEvent[]=[],scenarios:TemporalScenario[]=[];

  if(hasValue(record.fecha)) {
    facts.push(`El registro aportado identifica como fecha del hecho ${record.fecha}.`);
    events.push({id:"hecho",label:"Hecho/infracción",date:record.fecha,status:"ACREDITADO",source:"Estado de Cuenta SIMIT / dato aportado",legalEffect:"Punto de partida para los cómputos temporales especiales de caducidad y prescripción."});
  } else evidenceQuestions.push("Fecha exacta del hecho o infracción.");

  if(caducityExpiryDate) {
    inferences.push(`Para la caducidad de la acción contravencional, el término legal de un año proyecta su vencimiento al ${caducityExpiryDate}.`);
    events.push({id:"vencimiento-caducidad",label:"Vencimiento de caducidad calculado",date:caducityExpiryDate,status:"INFERIDO",source:"Cálculo jurídico sobre fecha del hecho",legalEffect:"Punto crítico para verificar si dentro del año se decidió sobre la imposición de la sanción y se produjo la actuación legalmente relevante."});
    rules.push("El artículo 161 de la Ley 769 de 2002 regula la caducidad de la acción por contravención de tránsito; debe verificarse la decisión y audiencia efectiva dentro del término legal.");
  }

  if(initialExpiryDate) {
    inferences.push(`Para la prescripción de las sanciones de tránsito, el término especial de tres años proyecta su vencimiento inicial al ${initialExpiryDate}.`);
    events.push({id:"vencimiento-inicial",label:"Vencimiento inicial de prescripción calculado",date:initialExpiryDate,status:"INFERIDO",source:"Cálculo jurídico sobre fecha acreditada",legalEffect:"Punto crítico para determinar si existió una actuación interruptiva eficaz antes del vencimiento."});
    rules.push("El artículo 159 de la Ley 769 de 2002 establece un término de tres años para la prescripción de las sanciones de tránsito y prevé la interrupción con la notificación del mandamiento de pago.");
  }

  let caducityStatus:LegalCertainty="INDETERMINADO";
  if(caducityExpiryDate) {
    const expiry=parseDate(caducityExpiryDate), decision=parseDate(record.fechaResolucion);
    if(decision&&expiry) {
      if(decision.getTime()<=expiry.getTime()) {
        caducityStatus="HIPOTESIS_OBJETIVA";
        facts.push(`Se reporta una decisión sancionatoria de fecha ${record.fechaResolucion}, situada dentro del término anual calculado para la caducidad; debe verificarse la audiencia efectiva y el expediente.`);
        scenarios.push({id:"caducidad-oportuna",title:"Decisión dentro del año",condition:`Si la decisión sancionatoria y la audiencia efectiva se produjeron a más tardar el ${caducityExpiryDate}`,conclusion:"la caducidad, en principio, habría sido interrumpida dentro del término; deben revisarse la regularidad de la actuación y las demás garantías."});
      } else {
        caducityStatus="CONFIGURADO";
        facts.push(`Se reporta una decisión sancionatoria de fecha ${record.fechaResolucion}, posterior al vencimiento anual calculado (${caducityExpiryDate}).`);
        scenarios.push({id:"caducidad-tardia",title:"Decisión posterior al año",condition:`Si la fecha real de decisión/audiencia efectiva es ${record.fechaResolucion} y es posterior al ${caducityExpiryDate}`,conclusion:"existe una hipótesis fuerte de caducidad que debe confrontarse con el expediente y la fecha de audiencia efectiva antes de declararla."});
      }
    } else {
      caducityStatus="HIPOTESIS_OBJETIVA";
      evidenceQuestions.push("Fecha de la audiencia efectiva o decisión mediante la cual se impuso la sanción, para establecer si ocurrió dentro del año previsto por el artículo 161 de la Ley 769 de 2002.");
      scenarios.push({id:"caducidad-no-probada",title:"Caducidad pendiente de prueba",condition:`Si no se acredita una decisión/audiencia efectiva dentro del año contado desde ${record.fecha||"la fecha del hecho"}`,conclusion:"debe analizarse la configuración de la caducidad y la consecuencia jurídica correspondiente."});
    }
  }

  if(hasValue(record.fechaResolucion)||affirmative(record.existeResolucion)) {
    if(!record.fechaResolucion)facts.push("El registro indica la existencia de una resolución o acto sancionatorio, aunque su fecha no está acreditada.");
    events.push({id:"resolucion",label:"Acto sancionatorio",date:record.fechaResolucion||null,status:record.fechaResolucion?"ACREDITADO":"NO_ACREDITADO",source:"Dato del registro",legalEffect:"Permite trasladar el análisis a la sanción impuesta, su firmeza, notificación y exigibilidad."});
  } else evidenceQuestions.push("Resolución o acto sancionatorio, fecha de expedición y constancia de ejecutoria.");

  if(hasValue(record.fechaNotificacion)) {
    facts.push(`Se reporta una fecha de notificación general: ${record.fechaNotificacion}.`);
    events.push({id:"notificacion",label:"Notificación reportada",date:record.fechaNotificacion ?? null,status:"ACREDITADO",source:"Dato del registro",legalEffect:"Debe verificarse qué acto fue notificado y si la constancia satisface las exigencias legales."});
  } else evidenceQuestions.push("Constancias de notificación de la orden de comparendo, acto sancionatorio y demás actuaciones relevantes.");

  if(hasValue(record.fechaMandamientoPago)) {
    facts.push(`Se reporta mandamiento de pago de fecha ${record.fechaMandamientoPago}.`);
    events.push({id:"mandamiento",label:"Mandamiento de pago",date:record.fechaMandamientoPago,status:"ACREDITADO",source:"Dato del registro",legalEffect:"La fecha de expedición no equivale a su notificación y, por sí sola, no acredita interrupción del término de prescripción."});
  } else evidenceQuestions.push("Existencia, fecha de expedición y copia íntegra del mandamiento de pago, si existe.");

  if(mandamientoNotificationDate) {
    facts.push(`Se reporta notificación del mandamiento de pago el ${mandamientoNotificationDate}.`);
    events.push({id:"notificacion-mandamiento",label:"Notificación del mandamiento",date:mandamientoNotificationDate,status:"ACREDITADO",source:"Dato del caso",legalEffect:"Interrumpe el término de prescripción, sujeto a la validez y eficacia de la notificación."});
    if(postMandamientoExpiryDate) {
      inferences.push(`Desde la notificación del mandamiento (${mandamientoNotificationDate}), el nuevo vencimiento calculado del término de tres años sería ${postMandamientoExpiryDate}, sin perjuicio de las actuaciones posteriores que deban examinarse.`);
      events.push({id:"vencimiento-post-mandamiento",label:"Nuevo vencimiento de prescripción calculado",date:postMandamientoExpiryDate,status:"INFERIDO",source:"Cálculo jurídico sobre notificación acreditada",legalEffect:"Punto de referencia para examinar la prescripción posterior al mandamiento."});
    }
  } else evidenceQuestions.push("Fecha y constancia de notificación del mandamiento de pago. Esta fecha es determinante para establecer si hubo interrupción eficaz del término.");

  let ejecutoriaStatus:LegalCertainty="INDETERMINADO";
  if(ejecutoriaDate) {
    facts.push(`Se reporta ejecutoria del acto en fecha ${ejecutoriaDate}.`);
    events.push({id:"ejecutoria",label:"Ejecutoria",date:ejecutoriaDate,status:"ACREDITADO",source:"Dato del caso",legalEffect:"Permite determinar desde cuándo el acto puede ser ejecutado y valorar su fuerza ejecutoria."});
    rules.push("El artículo 91 de la Ley 1437 de 2011 establece, entre otras causales, la pérdida de ejecutoriedad cuando al cabo de cinco años de estar en firme la autoridad no ha realizado los actos que le correspondan para ejecutarlo.");
    if(ejecutoriaExpiryDate) {
      inferences.push(`El plazo de cinco años para revisar la pérdida de ejecutoriedad se proyecta hasta el ${ejecutoriaExpiryDate}.`);
      events.push({id:"vencimiento-ejecutoriedad",label:"Vencimiento de cinco años para pérdida de ejecutoriedad",date:ejecutoriaExpiryDate,status:"INFERIDO",source:"Cálculo jurídico sobre fecha de ejecutoria",legalEffect:"Punto crítico para verificar si durante los cinco años la autoridad realizó los actos que legalmente correspondían para ejecutar el acto."});
      const expiry=parseDate(ejecutoriaExpiryDate);
      if(expiry && expiry.getTime()<=Date.now()) {
        if(!hasValue(record.fechaMandamientoPago) && !hasValue(record.actuacionesCobro)) {
          ejecutoriaStatus="HIPOTESIS_OBJETIVA";
          inferences.push("Han transcurrido cinco años desde la ejecutoria reportada sin que se aporte evidencia de actos de ejecución; existe una hipótesis objetiva de pérdida de ejecutoriedad que debe verificarse con el expediente.");
          scenarios.push({id:"ejecutoriedad-sin-ejecucion",title:"Cinco años sin actos de ejecución acreditados",condition:`Si desde la ejecutoria (${ejecutoriaDate}) y hasta ${ejecutoriaExpiryDate} la autoridad no realizó los actos que legalmente le correspondían para ejecutar el acto`,conclusion:"es viable solicitar el reconocimiento de la pérdida de ejecutoriedad y oponerse a la ejecución, conforme a los artículos 91 y 92 del CPACA."});
        } else {
          scenarios.push({id:"ejecutoriedad-con-actuaciones",title:"Existen actuaciones de ejecución",condition:`Si el expediente acredita actos de ejecución dentro de los cinco años siguientes a ${ejecutoriaDate}`,conclusion:"la pérdida de ejecutoriedad del numeral 3 del artículo 91 no puede darse por configurada solo por el transcurso del tiempo; debe identificarse cada actuación y su efecto jurídico."});
        }
      } else {
        scenarios.push({id:"ejecutoriedad-en-curso",title:"Cinco años aún no cumplidos",condition:`Si aún no han transcurrido cinco años desde ${ejecutoriaDate}`,conclusion:"no procede afirmar actualmente la causal temporal del numeral 3 del artículo 91; sí procede conservar la cuestión para revisión si aparecen otras causales de pérdida de ejecutoriedad."});
      }
    }
  } else evidenceQuestions.push("Fecha exacta de ejecutoria o firmeza del acto sancionatorio; es indispensable para evaluar la causal de cinco años del artículo 91 del CPACA.");

  if(hasValue(record.actuacionesCobro)) {
    facts.push(`El caso aporta información sobre actuaciones posteriores de cobro: ${record.actuacionesCobro}.`);
    events.push({id:"cobro",label:"Actuaciones posteriores de cobro",date:null,status:"ACREDITADO",source:"Dato aportado",legalEffect:"Debe determinarse si cada actuación tiene incidencia jurídica sobre la exigibilidad o el cómputo aplicable."});
  } else evidenceQuestions.push("Actuaciones de cobro posteriores al mandamiento: medidas cautelares, acuerdos de pago, pagos, remisiones, terminación u otras actuaciones y sus fechas.");

  if(initialExpiryDate) {
    scenarios.push({id:"sin-interrupcion",title:"Sin actuación interruptiva acreditada",condition:`Si no existe una notificación válida del mandamiento de pago anterior al ${initialExpiryDate}`,conclusion:"debe establecerse la consecuencia jurídica correspondiente al vencimiento del término de prescripción; la mera expedición del mandamiento no sustituye su notificación."});
    scenarios.push({id:"interrupcion-oportuna",title:"Mandamiento notificado antes del vencimiento",condition:`Si se acredita que el mandamiento fue notificado válidamente antes del ${initialExpiryDate}`,conclusion:"el término inicial debe tenerse por interrumpido y el análisis debe continuar desde la fecha de notificación del mandamiento, reconstruyendo las actuaciones posteriores."});
    scenarios.push({id:"interrupcion-tardia",title:"Mandamiento notificado después del vencimiento",condition:`Si la primera notificación eficaz del mandamiento ocurrió después del ${initialExpiryDate}`,conclusion:"debe analizarse si para ese momento ya había operado la prescripción, pues una actuación posterior al vencimiento no puede tratarse automáticamente como una interrupción ocurrida dentro del término."});
  }

  let certainty:LegalCertainty="INDETERMINADO";
  let temporalConclusion="La cronología no puede cerrarse definitivamente con la información disponible.";
  if(initialExpiryDate&&!mandamientoNotificationDate) {
    certainty="HIPOTESIS_OBJETIVA";
    temporalConclusion=`La fecha del hecho permite calcular un vencimiento inicial el ${initialExpiryDate}. Como no está acreditada la notificación de un mandamiento de pago anterior a esa fecha, existe una hipótesis objetiva de prescripción que debe confrontarse con el expediente. No se afirma como hecho probado mientras no se verifique la actuación interruptiva y su notificación.`;
  } else if(initialExpiryDate&&mandamientoNotificationDate) {
    const initial=parseDate(initialExpiryDate),notification=parseDate(mandamientoNotificationDate);
    if(initial&&notification&&notification.getTime()<=initial.getTime()) { certainty="HIPOTESIS_OBJETIVA"; temporalConclusion=`La notificación del mandamiento aparece situada el ${mandamientoNotificationDate}, antes del vencimiento inicial calculado (${initialExpiryDate}). La prescripción inicial no puede declararse solo por la antigüedad del hecho; debe analizarse el nuevo cómputo desde la notificación y las actuaciones posteriores.`; }
    else if(initial&&notification&&notification.getTime()>initial.getTime()) { certainty="CONFIGURADO"; temporalConclusion=`La notificación del mandamiento aparece situada el ${mandamientoNotificationDate}, después del vencimiento inicial calculado (${initialExpiryDate}). Existe una hipótesis configurada de prescripción previa a esa actuación, sujeta a la verificación de la fecha y validez de la notificación y del expediente completo.`; }
  }

  const executiveSummary=initialExpiryDate?`El análisis temporal parte de un hecho fechado ${record.fecha}, con tres ventanas independientes: un año para la caducidad de la acción contravencional, tres años para la prescripción especial de la sanción y, si existe acto firme, cinco años para revisar la pérdida de ejecutoriedad del artículo 91 del CPACA. Vencimientos calculados: caducidad ${caducityExpiryDate}; prescripción inicial ${initialExpiryDate}; pérdida de ejecutoriedad ${ejecutoriaExpiryDate||"no calculable sin ejecutoria"}.`:`No existe una fecha inicial suficientemente acreditada para realizar un cómputo temporal confiable.`;
  return {initialDate:record.fecha||null,initialExpiryDate,yearsTerm:initialExpiryDate?3:null,caducityExpiryDate,caducityStatus,mandamientoDate:record.fechaMandamientoPago||null,mandamientoNotificationDate,postMandamientoExpiryDate,ejecutoriaDate,ejecutoriaExpiryDate,ejecutoriaStatus,events,scenarios:[...new Map(scenarios.map(s=>[s.id,s])).values()],certainty,executiveSummary,temporalConclusion,evidenceQuestions:[...new Set(evidenceQuestions)],facts:[...new Set(facts)],inferences:[...new Set(inferences)],rules:[...new Set(rules)]};
}
