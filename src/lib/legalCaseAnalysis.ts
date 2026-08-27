export type EvidenceStatus = "ACREDITADO" | "NO_ACREDITADO" | "INFERIDO";
export type LegalCertainty = "CONFIGURADO" | "NO_CONFIGURADO" | "HIPOTESIS_OBJETIVA" | "INDETERMINADO";

export interface CaseEvent {
  id: string;
  label: string;
  date: string | null;
  status: EvidenceStatus;
  source: string;
  legalEffect: string;
}

export interface TemporalScenario {
  id: string;
  title: string;
  condition: string;
  conclusion: string;
}

export interface CaseLegalAnalysis {
  initialDate: string | null;
  initialExpiryDate: string | null;
  yearsTerm: number | null;
  caducityExpiryDate: string | null;
  caducityStatus: LegalCertainty;
  mandamientoDate: string | null;
  mandamientoNotificationDate: string | null;
  postMandamientoExpiryDate: string | null;
  events: CaseEvent[];
  scenarios: TemporalScenario[];
  certainty: LegalCertainty;
  executiveSummary: string;
  temporalConclusion: string;
  evidenceQuestions: string[];
  facts: string[];
  inferences: string[];
  rules: string[];
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  const dmy = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  const iso = dmy ? `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}` : raw;
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: Date | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(value);
}

export function addYears(value: string | undefined | null, years: number): string | null {
  const date = parseDate(value);
  if (!date) return null;
  const result = new Date(date.getTime());
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return formatDate(result);
}

function hasValue(value?: string | boolean | null): boolean {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function affirmative(value?: string | boolean | null): boolean {
  return value === true || ["si", "sí", "true", "1"].includes(String(value ?? "").trim().toLowerCase());
}

export interface TemporalRecordInput {
  comparendo: string;
  fecha: string;
  organismo: string;
  estado: string;
  fechaResolucion?: string;
  fechaNotificacion?: string;
  fechaMandamientoPago?: string;
  fechaNotificacionMandamiento?: string;
  fechaEjecutoria?: string;
  huboAudiencia?: boolean | string;
  existeResolucion?: boolean | string;
  actuacionesCobro?: string;
}

export function analyzeTemporalCase(record: TemporalRecordInput): CaseLegalAnalysis {
  const initialExpiryDate = addYears(record.fecha, 3);
  const caducityExpiryDate = addYears(record.fecha, 1);
  const mandamientoNotificationDate = record.fechaNotificacionMandamiento || null;
  const postMandamientoExpiryDate = addYears(mandamientoNotificationDate, 3);
  const facts: string[] = [];
  const inferences: string[] = [];
  const rules: string[] = [];
  const evidenceQuestions: string[] = [];
  const events: CaseEvent[] = [];
  const scenarios: TemporalScenario[] = [];

  if (hasValue(record.fecha)) {
    facts.push(`El registro aportado identifica como fecha del hecho ${record.fecha}.`);
    events.push({ id: "hecho", label: "Hecho/infracción", date: record.fecha, status: "ACREDITADO", source: "Estado de Cuenta SIMIT / dato aportado", legalEffect: "Punto de partida para los cómputos temporales especiales de caducidad y prescripción." });
  } else {
    evidenceQuestions.push("Fecha exacta del hecho o infracción.");
  }

  if (caducityExpiryDate) {
    inferences.push(`Para la caducidad de la acción contravencional, el término legal de un año proyecta su vencimiento al ${caducityExpiryDate}.`);
    events.push({ id: "vencimiento-caducidad", label: "Vencimiento de caducidad calculado", date: caducityExpiryDate, status: "INFERIDO", source: "Cálculo jurídico sobre fecha del hecho", legalEffect: "Punto crítico para verificar si dentro del año se decidió la imposición de la sanción y se produjo la actuación que interrumpe la caducidad." });
    rules.push("El artículo 161 de la Ley 769 de 2002 establece que la acción por contravención de las normas de tránsito caduca al año contado desde la ocurrencia de los hechos; durante ese término debe decidirse sobre la imposición de la sanción y, en ese momento, se entiende realizada efectivamente la audiencia e interrumpida la caducidad.");
  }

  if (initialExpiryDate) {
    inferences.push(`Para la prescripción de las sanciones de tránsito, el término especial de tres años proyecta su vencimiento inicial al ${initialExpiryDate}.`);
    events.push({ id: "vencimiento-inicial", label: "Vencimiento inicial de prescripción calculado", date: initialExpiryDate, status: "INFERIDO", source: "Cálculo jurídico sobre fecha acreditada", legalEffect: "Punto crítico para determinar si existió una actuación interruptiva eficaz antes del vencimiento." });
    rules.push("El artículo 159 de la Ley 769 de 2002 establece un término de tres años para la prescripción de las sanciones de tránsito, contado desde la ocurrencia del hecho, y prevé la interrupción con la notificación del mandamiento de pago.");
  }

  let caducityStatus: LegalCertainty = "INDETERMINADO";
  if (caducityExpiryDate) {
    const expiry = parseDate(caducityExpiryDate);
    const decision = parseDate(record.fechaResolucion);
    if (decision && expiry) {
      if (decision.getTime() <= expiry.getTime()) {
        caducityStatus = "HIPOTESIS_OBJETIVA";
        facts.push(`Se reporta una decisión sancionatoria de fecha ${record.fechaResolucion}, situada dentro del término anual calculado para la caducidad; debe verificarse el expediente y la audiencia efectiva.`);
        scenarios.push({ id: "caducidad-oportuna", title: "Decisión dentro del año", condition: `Si la decisión sancionatoria y la audiencia efectiva se produjeron a más tardar el ${caducityExpiryDate}`, conclusion: "la caducidad, en principio, habría sido interrumpida dentro del término y debe revisarse la regularidad de la actuación, no declararse caducidad únicamente por la antigüedad del comparendo." });
      } else {
        caducityStatus = "CONFIGURADO";
        facts.push(`Se reporta una decisión sancionatoria de fecha ${record.fechaResolucion}, posterior al vencimiento anual calculado (${caducityExpiryDate}).`);
        scenarios.push({ id: "caducidad-tardia", title: "Decisión posterior al año", condition: `Si la fecha real de decisión/audiencia efectiva es ${record.fechaResolucion} y es posterior al ${caducityExpiryDate}`, conclusion: "existe una hipótesis fuerte de caducidad que debe ser confrontada con el expediente, la fecha de audiencia efectiva y las reglas aplicables al caso." });
      }
    } else {
      caducityStatus = "HIPOTESIS_OBJETIVA";
      evidenceQuestions.push("Fecha de la audiencia efectiva o decisión mediante la cual se impuso la sanción, para establecer si ocurrió dentro del año previsto por el artículo 161 de la Ley 769 de 2002.");
      scenarios.push({ id: "caducidad-no-probada", title: "Caducidad pendiente de prueba", condition: `Si no se acredita una decisión/audiencia efectiva dentro del año contado desde ${record.fecha || "la fecha del hecho"}`, conclusion: "debe analizarse la configuración de la caducidad y la consecuencia jurídica correspondiente." });
    }
  }

  if (hasValue(record.fechaResolucion) || affirmative(record.existeResolucion)) {
    if (!record.fechaResolucion) facts.push("El registro indica la existencia de una resolución o acto sancionatorio, aunque su fecha no está acreditada.");
    events.push({ id: "resolucion", label: "Acto sancionatorio", date: record.fechaResolucion || null, status: record.fechaResolucion ? "ACREDITADO" : "NO_ACREDITADO", source: "Dato del registro", legalEffect: "Permite trasladar el análisis a la sanción impuesta, su firmeza, notificación y exigibilidad." });
  } else {
    evidenceQuestions.push("Resolución o acto sancionatorio, fecha de expedición y constancia de ejecutoria.");
  }

  if (hasValue(record.fechaNotificacion)) {
    facts.push(`Se reporta una fecha de notificación general: ${record.fechaNotificacion}.`);
    events.push({ id: "notificacion", label: "Notificación reportada", date: record.fechaNotificacion || null, status: "ACREDITADO", source: "Dato del registro", legalEffect: "Debe verificarse qué acto fue notificado y si la constancia satisface las exigencias legales." });
  } else {
    evidenceQuestions.push("Constancias de notificación de la orden de comparendo, acto sancionatorio y demás actuaciones relevantes.");
  }

  if (hasValue(record.fechaMandamientoPago)) {
    facts.push(`Se reporta mandamiento de pago de fecha ${record.fechaMandamientoPago}.`);
    events.push({ id: "mandamiento", label: "Mandamiento de pago", date: record.fechaMandamientoPago || null, status: "ACREDITADO", source: "Dato del registro", legalEffect: "La fecha de expedición no equivale a su notificación y, por sí sola, no acredita interrupción del término de prescripción." });
  } else {
    evidenceQuestions.push("Existencia, fecha de expedición y copia íntegra del mandamiento de pago, si existe.");
  }

  if (mandamientoNotificationDate) {
    facts.push(`Se reporta notificación del mandamiento de pago el ${mandamientoNotificationDate}.`);
    events.push({ id: "notificacion-mandamiento", label: "Notificación del mandamiento", date: mandamientoNotificationDate, status: "ACREDITADO", source: "Dato del caso", legalEffect: "Interrumpe el término de prescripción y da lugar al nuevo cómputo previsto por el régimen de cobro coactivo, sujeto a la validez de la notificación." });
    if (postMandamientoExpiryDate) {
      inferences.push(`Desde la notificación del mandamiento (${mandamientoNotificationDate}), el nuevo vencimiento calculado del término de tres años sería ${postMandamientoExpiryDate}, sin perjuicio de las actuaciones posteriores que deban examinarse.`);
      events.push({ id: "vencimiento-post-mandamiento", label: "Nuevo vencimiento de prescripción calculado", date: postMandamientoExpiryDate, status: "INFERIDO", source: "Cálculo jurídico sobre notificación acreditada", legalEffect: "Punto de referencia para examinar la prescripción posterior al mandamiento." });
    }
  } else {
    evidenceQuestions.push("Fecha y constancia de notificación del mandamiento de pago. Esta fecha es determinante para establecer si hubo interrupción eficaz del término.");
  }

  if (hasValue(record.fechaEjecutoria)) {
    facts.push(`Se reporta ejecutoria del acto en fecha ${record.fechaEjecutoria}.`);
    events.push({ id: "ejecutoria", label: "Ejecutoria", date: record.fechaEjecutoria || null, status: "ACREDITADO", source: "Dato del caso", legalEffect: "Permite determinar desde cuándo el acto puede ser ejecutado y valorar su fuerza ejecutoria." });
  } else {
    evidenceQuestions.push("Fecha de firmeza o ejecutoria del acto que sirve de fundamento al cobro.");
  }

  if (hasValue(record.actuacionesCobro)) {
    facts.push(`El caso aporta información sobre actuaciones posteriores de cobro: ${record.actuacionesCobro}.`);
    events.push({ id: "cobro", label: "Actuaciones posteriores de cobro", date: null, status: "ACREDITADO", source: "Dato aportado", legalEffect: "Debe determinarse si cada actuación tiene incidencia jurídica sobre la exigibilidad o el cómputo aplicable." });
  } else {
    evidenceQuestions.push("Actuaciones de cobro posteriores al mandamiento: medidas cautelares, acuerdos de pago, pagos, remisiones, terminación u otras actuaciones y sus fechas.");
  }

  if (initialExpiryDate) {
    scenarios.push({ id: "sin-interrupcion", title: "Sin actuación interruptiva acreditada", condition: `Si no existe una notificación válida del mandamiento de pago anterior al ${initialExpiryDate}`, conclusion: `debe establecerse la consecuencia jurídica correspondiente al vencimiento del término de prescripción, pues la mera expedición del mandamiento no sustituye su notificación.` });
    scenarios.push({ id: "interrupcion-oportuna", title: "Mandamiento notificado antes del vencimiento", condition: `Si se acredita que el mandamiento fue notificado válidamente antes del ${initialExpiryDate}`, conclusion: "el término inicial debe tenerse por interrumpido y el análisis debe continuar desde la fecha de notificación del mandamiento, reconstruyendo las actuaciones posteriores." });
    scenarios.push({ id: "interrupcion-tardia", title: "Mandamiento notificado después del vencimiento", condition: `Si la primera notificación eficaz del mandamiento ocurrió después del ${initialExpiryDate}`, conclusion: "debe analizarse si para ese momento ya había operado la prescripción, pues una actuación posterior al vencimiento no puede ser tratada automáticamente como una interrupción ocurrida dentro del término." });
  }

  let certainty: LegalCertainty = "INDETERMINADO";
  let temporalConclusion = "La cronología no puede cerrarse definitivamente con la información disponible.";
  if (initialExpiryDate && !mandamientoNotificationDate) {
    certainty = "HIPOTESIS_OBJETIVA";
    temporalConclusion = `La fecha del hecho permite calcular un vencimiento inicial el ${initialExpiryDate}. Como no está acreditada la notificación de un mandamiento de pago anterior a esa fecha, existe una hipótesis objetiva de prescripción que debe ser confrontada con el expediente. No se afirma como hecho probado mientras no se verifique la actuación interruptiva y su notificación.`;
  } else if (initialExpiryDate && mandamientoNotificationDate) {
    const initial = parseDate(initialExpiryDate);
    const notification = parseDate(mandamientoNotificationDate);
    if (initial && notification && notification.getTime() <= initial.getTime()) {
      certainty = "HIPOTESIS_OBJETIVA";
      temporalConclusion = `La notificación del mandamiento aparece situada el ${mandamientoNotificationDate}, antes del vencimiento inicial calculado (${initialExpiryDate}). Por ello, la prescripción inicial no puede declararse con base únicamente en la antigüedad del hecho; debe analizarse el nuevo cómputo desde la notificación y las actuaciones posteriores de cobro.`;
    } else if (initial && notification && notification.getTime() > initial.getTime()) {
      certainty = "CONFIGURADO";
      temporalConclusion = `La notificación del mandamiento aparece situada el ${mandamientoNotificationDate}, después del vencimiento inicial calculado (${initialExpiryDate}). Existe una hipótesis configurada de prescripción previa a esa actuación, sujeta a la verificación de la fecha y validez de la notificación y del expediente completo.`;
    }
  }

  const executiveSummary = initialExpiryDate
    ? `El análisis temporal parte de un hecho fechado ${record.fecha}, al que se aplican dos hitos independientes: un año para la caducidad de la acción contravencional y tres años para la prescripción de la sanción conforme al artículo 159 de la Ley 769 de 2002. El vencimiento calculado de caducidad es ${caducityExpiryDate}; el vencimiento inicial de prescripción es ${initialExpiryDate}. La audiencia/decisión sancionatoria y la notificación del mandamiento de pago deben verificarse como hechos distintos.`
    : "No existe una fecha inicial suficientemente acreditada para realizar un cómputo temporal confiable.";

  return {
    initialDate: record.fecha || null,
    initialExpiryDate,
    yearsTerm: initialExpiryDate ? 3 : null,
    caducityExpiryDate,
    caducityStatus,
    mandamientoDate: record.fechaMandamientoPago || null,
    mandamientoNotificationDate,
    postMandamientoExpiryDate,
    events,
    scenarios: [...new Map(scenarios.map((s) => [s.id, s])).values()],
    certainty,
    executiveSummary,
    temporalConclusion,
    evidenceQuestions: [...new Set(evidenceQuestions)],
    facts: [...new Set(facts)],
    inferences: [...new Set(inferences)],
    rules: [...new Set(rules)],
  };
}
