import { selectLegalAuthorities, type LegalAuthority } from "./legalLibrary";
import { analyzeTemporalCase, type CaseLegalAnalysis } from "./legalCaseAnalysis";

export interface SelectedRecordData {
  comparendo: string;
  fecha: string;
  organismo: string;
  estado: string;
  valor: string;
  placa?: string;
  cedula?: string;
  codigo?: string;
  nombre?: string;
  correo?: string;
  telefono?: string;
  ciudad?: string;
  direccion?: string;
  fechaResolucion?: string;
  fechaNotificacion?: string;
  fechaMandamientoPago?: string;
  fechaNotificacionMandamiento?: string;
  fechaEjecutoria?: string;
  huboAudiencia?: boolean | string;
  existeResolucion?: boolean | string;
  actuacionesCobro?: string;
  esFotodetencion?: boolean;
  respuestas?: Record<string, unknown>;
}

export type LegalRoute = "CADUCIDAD" | "PRESCRIPCION" | "PERDIDA_EJECUTORIEDAD" | "NOTIFICACION" | "DEBIDO_PROCESO" | "FOTODETECCION" | "REVOCATORIA_DIRECTA";
export type LegalCertainty = "CONFIGURADO" | "NO_CONFIGURADO" | "HIPOTESIS_OBJETIVA" | "INDETERMINADO";
export interface LegalAssessment { routes: LegalRoute[]; primaryRoute: LegalRoute | null; priority: "alta" | "media" | "baja"; missingEvidence: string[]; reasoning: string[]; certainty?: LegalCertainty; temporal?: CaseLegalAnalysis; }
export interface DynamicLegalQuestion { id: string; label: string; type: "text" | "date" | "select" | "textarea"; required?: boolean; options?: { label: string; value: string }[]; route: LegalRoute; }
export interface LegalDraft { hechos: string; solicitudConcreta: string; fundamentos: string; assessment: LegalAssessment; authorities: LegalAuthority[]; document: string; }

const OCR_FALLBACK = "No identificado en el documento aportado";
const normalized = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const truthy = (v: unknown) => v === true || ["si", "sí", "true", "1"].includes(String(v ?? "").trim().toLowerCase());

export function sanitizeValue(value: string | undefined): string {
  if (value === undefined) return OCR_FALLBACK;
  const v = String(value).replace(/\s+/g, " ").trim();
  return v || OCR_FALLBACK;
}

function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  const x = String(v).trim();
  const m = x.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  const iso = m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : x.slice(0, 10);
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function longDate(v?: string | null): string {
  const d = parseDate(v);
  return d ? new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d) : (v || "fecha no acreditada");
}

function todayUTC() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function elapsedFrom(v?: string): { years: number; months: number } {
  const start = parseDate(v);
  if (!start) return { years: 0, months: 0 };
  const end = todayUTC();
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  let months = end.getUTCMonth() - start.getUTCMonth();
  if (end.getUTCDate() < start.getUTCDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  return { years: Math.max(0, years), months: Math.max(0, months) };
}

function cleanRecord(r: SelectedRecordData): SelectedRecordData {
  return {
    ...r,
    nombre: sanitizeValue(r.nombre),
    cedula: sanitizeValue(r.cedula),
    correo: sanitizeValue(r.correo),
    telefono: sanitizeValue(r.telefono),
    ciudad: sanitizeValue(r.ciudad),
    direccion: sanitizeValue(r.direccion),
    organismo: sanitizeValue(r.organismo),
    placa: sanitizeValue(r.placa),
  };
}

function isPhotoRecord(r: SelectedRecordData) {
  return Boolean(r.esFotodetencion || /fotodeteccion|fotomulta|c35|d02|camara|fad/.test(normalized(`${r.codigo || ""} ${r.estado || ""} ${r.comparendo || ""}`)));
}

function sanctioned(r: SelectedRecordData) {
  const status = normalized(String(r.estado || ""));
  const id = String(r.comparendo || "").trim();
  return Boolean(/-SA(?:$|[-_\s])/i.test(id) || r.fechaResolucion || truthy(r.existeResolucion) || truthy(r.huboAudiencia)) ||
    ["multa", "sancion", "sancionado", "pendiente de pago", "cobro coactivo", "cobro", "mandamiento", "acuerdo de pago", "pagada", "pagado", "cancelada", "cancelado"].some(w => status.includes(normalized(w)));
}

function temporalConclusion(t: CaseLegalAnalysis) {
  if (!t.initialExpiryDate) return "No existe una fecha inicial suficientemente acreditada para realizar un cómputo temporal confiable.";
  const expiry = parseDate(t.initialExpiryDate);
  if (expiry && expiry > todayUTC()) return `El término inicial de tres años se proyecta hasta el ${longDate(t.initialExpiryDate)}. Debe verificarse si antes de esa fecha existió una actuación jurídicamente eficaz y, especialmente, la fecha y eficacia de la notificación de cualquier mandamiento de pago.`;
  return `Existe un vencimiento temporal objetivo al ${longDate(t.initialExpiryDate)} que exige reconstruir documentalmente las actuaciones que pudieron modificar el término aplicable.`;
}

export function assessTrafficRecord(input: SelectedRecordData): LegalAssessment {
  const r = cleanRecord(input);
  const routes: LegalRoute[] = [];
  const missing: string[] = [];
  const reasoning: string[] = [];
  const temporal = analyzeTemporalCase(r);
  const photo = isPhotoRecord(r);
  const elapsed = elapsedFrom(r.fecha);
  const ageMonths = elapsed.years * 12 + elapsed.months;

  if (photo) {
    routes.push("FOTODETECCION", "NOTIFICACION", "DEBIDO_PROCESO", "REVOCATORIA_DIRECTA");
    missing.push("Evidencia de detección, validación, identificación del infractor y constancias de notificación.");
    reasoning.push("El registro presenta características de fotodetección; la estrategia debe priorizar notificación, identificación del conductor y debido proceso antes que prescripción.");
    if (temporal.caducityExpiryDate && ageMonths >= 12) routes.unshift("CADUCIDAD");
    else reasoning.push("La antigüedad del comparendo es inferior a tres años; no se presenta la prescripción como pretensión principal. La caducidad solo se afirma si el expediente permite establecer que venció el término aplicable sin decisión eficaz.");
  } else {
    if (sanctioned(r)) reasoning.push("El registro presenta elementos compatibles con una multa o sanción; se revisan acto sancionatorio, notificación, firmeza, exigibilidad, prescripción, cobro y fuerza ejecutoria.");
    else { routes.push("CADUCIDAD"); missing.push("Expediente, decisión sancionatoria y constancia de ejecutoria, si existen."); reasoning.push("No está acreditada una sanción firme; debe verificarse la cronología de la actuación contravencional."); }
    if (temporal.initialExpiryDate) { routes.push("PRESCRIPCION"); reasoning.push(temporalConclusion(temporal)); missing.push(...temporal.evidenceQuestions.filter(x => /mandamiento|cobro|prescrip/i.test(x))); }
    if (temporal.ejecutoriaStatus === "HIPOTESIS_OBJETIVA" || temporal.ejecutoriaStatus === "CONFIGURADO" || temporal.ejecutoriaDate) routes.push("PERDIDA_EJECUTORIEDAD");
    if (!r.fechaNotificacion || !r.fechaNotificacionMandamiento) routes.push("NOTIFICACION");
    routes.push("DEBIDO_PROCESO", "REVOCATORIA_DIRECTA");
  }

  const unique = [...new Set(routes)];
  let primary: LegalRoute;
  if (photo && ageMonths < 36) {
    primary = unique.includes("CADUCIDAD") ? "CADUCIDAD" : "FOTODETECCION";
  } else {
    primary = unique.includes("PRESCRIPCION") ? "PRESCRIPCION" : unique.includes("CADUCIDAD") ? "CADUCIDAD" : unique.includes("PERDIDA_EJECUTORIEDAD") ? "PERDIDA_EJECUTORIEDAD" : unique.includes("FOTODETECCION") ? "FOTODETECCION" : unique.includes("NOTIFICACION") ? "NOTIFICACION" : "DEBIDO_PROCESO";
  }
  const priority = primary === "PRESCRIPCION" || primary === "PERDIDA_EJECUTORIEDAD" || (photo && unique.includes("CADUCIDAD")) ? "alta" : "media";
  return { routes: unique, primaryRoute: primary, priority, missingEvidence: [...new Set(missing)], reasoning: [...new Set(reasoning)], certainty: temporal.certainty, temporal };
}

export function getDynamicLegalQuestions(record: SelectedRecordData, assessment: LegalAssessment): DynamicLegalQuestion[] {
  const q: DynamicLegalQuestion[] = [];
  const add = (x: DynamicLegalQuestion) => { if (q.length < 5 && !q.some(y => y.id === x.id)) q.push(x); };
  if (!record.nombre || record.nombre === OCR_FALLBACK) add({ id: "nombre", label: "Para dejar el escrito a tu nombre, ¿cuál es tu nombre completo?", type: "text", required: true, route: "DEBIDO_PROCESO" });
  if (!record.correo || record.correo === OCR_FALLBACK) add({ id: "correo", label: "¿A qué correo quieres recibir la respuesta de la entidad?", type: "text", required: true, route: "DEBIDO_PROCESO" });
  if (!record.telefono || record.telefono === OCR_FALLBACK) add({ id: "telefono", label: "¿Cuál es tu número de teléfono?", type: "text", route: "DEBIDO_PROCESO" });
  if (!record.ciudad || record.ciudad === OCR_FALLBACK) add({ id: "ciudad", label: "¿En qué ciudad estás domiciliado(a)?", type: "text", route: "DEBIDO_PROCESO" });
  if (q.length >= 4) return q;

  const photo = isPhotoRecord(record);
  if (photo && !record.fechaNotificacion) add({ id: "notificacion_fotodeteccion", label: "Cuando apareció esta fotomulta, ¿recibiste alguna comunicación oficial en tu dirección o correo?", type: "select", route: "NOTIFICACION", options: [{ label: "❌ Nunca recibí una", value: "no" }, { label: "📩 Sí, recibí una", value: "si" }, { label: "❓ No lo recuerdo", value: "no_se" }] });
  if (q.length >= 5) return q;
  if (photo && !record.respuestas?.conductorIdentificado) add({ id: "conductor_identificado", label: "¿En algún momento la autoridad te identificó expresamente como el conductor que cometió la infracción?", type: "select", route: "FOTODETECCION", options: [{ label: "Sí, fui identificado", value: "si" }, { label: "No, nunca fui identificado", value: "no" }, { label: "No lo sé", value: "no_se" }] });
  if (q.length >= 5) return q;
  if (!photo && assessment.routes.includes("PRESCRIPCION") && !record.fechaMandamientoPago) add({ id: "existe_mandamiento_pago", label: "¿Alguna vez recibiste un documento de cobro o mandamiento de pago por esta multa?", type: "select", route: "PRESCRIPCION", options: [{ label: "Sí", value: "si" }, { label: "No", value: "no" }, { label: "No lo sé", value: "no_se" }] });
  if (q.length >= 5) return q;
  if (!photo && assessment.routes.includes("NOTIFICACION") && !record.fechaNotificacion) add({ id: "forma_notificacion", label: "¿Alguna vez recibiste una notificación oficial relacionada con esta multa?", type: "select", route: "NOTIFICACION", options: [{ label: "Sí, recibí una", value: "si" }, { label: "No, nunca", value: "no" }, { label: "No lo recuerdo", value: "no_se" }] });
  if (q.length >= 5) return q;
  if (assessment.routes.includes("PERDIDA_EJECUTORIEDAD") && !record.fechaEjecutoria) add({ id: "fecha_ejecutoria", label: "¿Conoces la fecha en que quedó en firme la resolución de la multa?", type: "date", route: "PERDIDA_EJECUTORIEDAD" });
  return q;
}

function authorityBlock(a: LegalAuthority) {
  return [`${a.source}, ${a.provision}: ${a.rule.trim()}`, a.development?.trim(), a.application ? `Aplicación al caso: ${a.application.trim()}` : "", a.precedent ? `Jurisprudencia: ${a.precedent.trim()}` : ""].filter(Boolean).join("\n\n");
}

function modularAuthorities(routes: LegalRoute[], code: string, hasNotificationIssue: boolean, isPhoto: boolean, status: string): LegalAuthority[] {
  const selected = selectLegalAuthorities(routes, `${status} ${code}`);
  return selected.filter(a => {
    if (a.id === "C-038-2020" || a.id === "L1843") return isPhoto;
    if (/notific/i.test(a.id) || /notific/i.test(a.provision)) return hasNotificationIssue;
    return true;
  });
}

function factsBlock(r: SelectedRecordData, t: CaseLegalAnalysis, assessment: LegalAssessment) {
  const elapsed = elapsedFrom(r.fecha);
  const photo = isPhotoRecord(r);
  const facts: string[] = [
    `PRIMERO. En la plataforma SIMIT figura a nombre del peticionario el comparendo / orden de comparendo No. ${sanitizeValue(r.comparendo)}, de fecha ${sanitizeValue(r.fecha)}, asociado al organismo ${sanitizeValue(r.organismo)}.`,
    `SEGUNDO. La actuación aparece asociada al documento de identidad No. ${sanitizeValue(r.cedula)}, registra un estado de ${sanitizeValue(r.estado)} y un valor reportado de ${sanitizeValue(r.valor)}.`,
    `TERCERO. A la fecha de elaboración han transcurrido aproximadamente ${elapsed.years} años y ${elapsed.months} meses desde la fecha del hecho.`,
  ];
  if (r.codigo) facts.push(`CUARTO. El registro identifica la infracción con el código ${sanitizeValue(r.codigo)}.`);
  else facts.push("CUARTO. El Estado de Cuenta no identifica de manera suficiente el código de infracción; debe verificarse en el expediente.");
  if (r.placa && r.placa !== OCR_FALLBACK) facts.push(`QUINTO. La placa asociada al registro es ${r.placa}.`);

  if (photo) {
    facts.push("SEXTO. Por tratarse de un registro compatible con fotodetección, la validez de la actuación exige verificar la evidencia técnica, la validación, la identificación del presunto infractor y las constancias de notificación que obren en el expediente.");
    facts.push("SÉPTIMO. A la fecha no se tiene por acreditada una notificación válida únicamente por la existencia del registro en SIMIT; la autoridad deberá aportar el soporte que permita establecer qué acto fue comunicado, a quién, por qué medio y en qué fecha.");
    facts.push("OCTAVO. La responsabilidad personal por la infracción no puede presumirse exclusivamente a partir de la titularidad del vehículo; debe verificarse en el expediente la identificación y vinculación jurídica del conductor, conforme al marco constitucional y jurisprudencial aplicable.");
    if (t.caducityExpiryDate) {
      const cad = parseDate(t.caducityExpiryDate);
      if (cad && cad <= todayUTC()) facts.push(`NOVENO. El término anual calculado para la caducidad se proyectó al ${longDate(t.caducityExpiryDate)}; corresponde determinar con el expediente si dentro de dicho término existió audiencia y decisión sancionatoria jurídicamente eficaces.`);
      else facts.push(`NOVENO. El término anual calculado para la caducidad se proyecta al ${longDate(t.caducityExpiryDate)}; por ello no se afirma su configuración solo por la fecha del comparendo y se solicita a la entidad reconstruir la actuación.`);
    }
  } else {
    if (r.fechaResolucion) facts.push(`SEXTO. Se reporta resolución o acto sancionatorio de fecha ${r.fechaResolucion}; su contenido, notificación y ejecutoria deben verificarse documentalmente.`);
    else facts.push("SEXTO. No se encuentra acreditada en el Estado de Cuenta la fecha de expedición del acto sancionatorio ni su ejecutoria.");
    if (r.fechaNotificacion) facts.push(`SÉPTIMO. Se reporta una fecha de notificación (${r.fechaNotificacion}); debe verificarse qué actuación fue notificada y la constancia correspondiente.`);
    else facts.push("SÉPTIMO. No se encuentra acreditada en la información disponible la fecha ni el medio de notificación del acto sancionatorio.");
    if (r.fechaMandamientoPago) facts.push(`OCTAVO. Se reporta mandamiento de pago de fecha ${r.fechaMandamientoPago}; su notificación debe verificarse separadamente.`);
    else facts.push("OCTAVO. No se encuentra acreditada la existencia o fecha de un mandamiento de pago.");
    if (r.fechaNotificacionMandamiento) facts.push(`NOVENO. Se reporta notificación del mandamiento el ${r.fechaNotificacionMandamiento}; su eficacia debe confrontarse con el expediente.`);
    else facts.push("NOVENO. No se encuentra acreditada una fecha de notificación del mandamiento de pago; esta ausencia identifica una cuestión probatoria decisiva, pero no demuestra por sí sola su inexistencia.");
  }
  if (r.actuacionesCobro) facts.push(`DÉCIMO. El ciudadano reporta las siguientes actuaciones de cobro: ${r.actuacionesCobro}.`);
  if (t.initialExpiryDate) facts.push(`DÉCIMO PRIMERO. El cómputo inicial de tres años proyecta un vencimiento al ${longDate(t.initialExpiryDate)}.`);
  if (t.ejecutoriaDate && t.ejecutoriaExpiryDate) facts.push(`DÉCIMO SEGUNDO. La ejecutoria reportada (${t.ejecutoriaDate}) proyecta el hito de cinco años al ${t.ejecutoriaExpiryDate}.`);
  if (assessment.primaryRoute === "PRESCRIPCION") facts.push("DÉCIMO TERCERO. La estrategia jurídica se orienta principalmente a establecer si se configuró la prescripción de la sanción, sin asumirla por la sola antigüedad del registro y reconstruyendo los hitos legalmente relevantes.");
  return facts.join("\n\n");
}

function strategyConclusion(a: LegalAssessment, r: SelectedRecordData) {
  const photo = isPhotoRecord(r);
  const elapsed = elapsedFrom(r.fecha);
  if (photo && elapsed.years < 3) return "La estrategia principal es atacar cualquier irregularidad de notificación, verificar la identificación y vinculación del conductor y reconstruir la caducidad de la acción contravencional. La prescripción de tres años no se presenta como pretensión principal porque el comparendo aún no ha alcanzado ese horizonte temporal.";
  if (a.primaryRoute === "PRESCRIPCION") return "La estrategia principal es reconstruir el término de prescripción con especial atención a la existencia, fecha y notificación eficaz del mandamiento de pago; las demás vías se mantienen como subsidiarias cuando la evidencia las haga pertinentes.";
  if (a.primaryRoute === "CADUCIDAD") return "La estrategia principal es reconstruir la actuación contravencional para determinar si la autoridad ejerció oportunamente la acción y si existe decisión sancionatoria eficaz.";
  if (a.primaryRoute === "PERDIDA_EJECUTORIEDAD") return "La estrategia principal es verificar la firmeza del acto y los actos de ejecución realizados durante el período relevante para establecer si existe una causal de pérdida de ejecutoriedad.";
  return "La estrategia principal es reconstruir documentalmente la actuación y verificar la regularidad de sus notificaciones, la identificación del infractor, la firmeza y las demás garantías del debido proceso.";
}

function requestsBlock(r: SelectedRecordData, a: LegalAssessment) {
  const t = a.temporal;
  const photo = isPhotoRecord(r);
  if (photo && elapsedFrom(r.fecha).years < 3) {
    const requests = [
      `PRIMERA. Que se determine expresamente la situación jurídica actual del comparendo No. ${sanitizeValue(r.comparendo)} y se informe el acto administrativo que sustenta su permanencia en SIMIT.`,
      "SEGUNDA. Que se remita copia íntegra, legible y completa del expediente administrativo relacionado con la fotodetección.",
      "TERCERA. Que se remitan las constancias de validación y notificación de la orden de comparendo, indicando fecha de validación, fecha de envío, medio utilizado, destinatario y soporte de entrega o devolución.",
      "CUARTA. Que se entregue la evidencia técnica de la detección, incluyendo imágenes, identificación del dispositivo, fecha, hora, lugar, validación y demás elementos que permitan controvertir la imputación.",
      "QUINTA. Que se informe y acredite de manera concreta cómo fue identificado y vinculado el presunto conductor infractor, sin presumir responsabilidad por la sola titularidad del vehículo.",
      `SEXTA. Que se reconstruya la cronología de la actuación contravencional y se determine si se configuró la caducidad prevista en el régimen de tránsito; si el término anual aún no ha vencido, que se informe su fecha calculada${t?.caducityExpiryDate ? ` (${t.caducityExpiryDate})` : ""} y las actuaciones que inciden en su cómputo.`,
      "SÉPTIMA. Que, si se acredita una notificación irregular, ausencia de identificación del infractor, vulneración del debido proceso, caducidad u otra causal jurídicamente procedente, se adopte expresamente la consecuencia correspondiente, incluida la revocatoria o terminación que legalmente corresponda.",
      "OCTAVA. Que, de proceder una decisión favorable, se ordene dentro de las competencias de la entidad la actualización, cancelación, eliminación o depuración de los registros administrativos y se comunique la novedad al sistema correspondiente, incluido SIMIT y, cuando legalmente corresponda, RUNT.",
      "NOVENA. Que se emita respuesta de fondo, clara, precisa, congruente, completa y debidamente motivada frente a cada solicitud."
    ];
    return requests.join("\n\n");
  }

  const requests = [
    `PRIMERA. Que se determine expresamente la situación jurídica actual de la actuación No. ${sanitizeValue(r.comparendo)} y la razón por la cual figura vigente, exigible o registrada, si así ocurre.`,
    `SEGUNDA. Que se remita copia íntegra, legible y completa del expediente administrativo relacionado con el comparendo No. ${sanitizeValue(r.comparendo)}.`,
    "TERCERA. Que se identifique el acto mediante el cual se impuso la sanción, indicando número, fecha, contenido, autoridad que lo expidió y constancia de ejecutoria, y se remita copia íntegra.",
    "CUARTA. Que se remitan las constancias de notificación de la orden de comparendo, acto sancionatorio, recursos, resolución y mandamiento de pago, indicando acto, destinatario, medio, fecha y soporte de entrega, publicación o recepción.",
    "QUINTA. Que se informe si existe o existió proceso de cobro coactivo y, en caso afirmativo, se remita copia íntegra de sus actuaciones, incluyendo mandamiento de pago, notificación, medidas cautelares, acuerdos de pago, pagos y demás actuaciones posteriores."
  ];
  if (a.primaryRoute === "PRESCRIPCION") requests.push(`SEXTA. Que se reconstruya documentalmente el término aplicable y se determine si antes del vencimiento inicial${t?.initialExpiryDate ? ` (${t.initialExpiryDate})` : ""} existió una actuación jurídicamente eficaz con incidencia en su cómputo, identificando fecha de expedición, fecha exacta de notificación y soporte documental.`);
  if (a.primaryRoute === "CADUCIDAD") requests.push("SEXTA. Que se reconstruya la cronología de la actuación contravencional, indicando fecha de audiencia, decisión, recursos y notificaciones, para determinar si se configuró la caducidad legalmente aplicable.");
  if (a.primaryRoute === "PERDIDA_EJECUTORIEDAD") requests.push("SEXTA. Que se determine la fecha de firmeza del acto y se identifiquen uno por uno los actos de ejecución realizados durante los cinco años siguientes, con fecha, naturaleza y soporte documental.");
  requests.push(
    "SÉPTIMA. Que, si de la revisión integral del expediente se acredita prescripción, caducidad, pérdida de ejecutoriedad, irregularidad sustancial de notificación, vulneración del debido proceso u otra causal jurídicamente procedente, se adopte expresamente la consecuencia correspondiente.",
    "OCTAVA. Que, si procede una consecuencia favorable, se termine y archive la obligación o actuación en aquello que legalmente corresponda y se ordene, dentro de las competencias de la entidad, la actualización, cancelación, eliminación o depuración de los registros administrativos y del SIMIT.",
    "NOVENA. Que se informe cuáles actuaciones aparecen registradas en los sistemas internos y cuáles cuentan con soporte documental dentro del expediente, sin utilizar el Estado de Cuenta SIMIT como sustituto del expediente administrativo.",
    "DÉCIMA. Que se emita respuesta de fondo, clara, precisa, congruente, completa y debidamente motivada frente a cada una de las solicitudes anteriores."
  );
  return requests.join("\n\n");
}

function dynamicLegalLibrary(r: SelectedRecordData, a: LegalAssessment, authorities: LegalAuthority[]) {
  const photo = isPhotoRecord(r);
  const hasNotificationIssue = a.routes.includes("NOTIFICACION") || !r.fechaNotificacion || !r.fechaNotificacionMandamiento;
  const blocks = authorities.map(authorityBlock);
  if (photo && elapsedFrom(r.fecha).years < 3) {
    blocks.push("Artículo 29 de la Constitución Política: garantía del debido proceso y del derecho de defensa en la actuación administrativa sancionatoria.");
    blocks.push("Artículo 8 de la Ley 1843 de 2017: reglas especiales de notificación de comparendos detectados por ayudas tecnológicas, cuya aplicación debe confrontarse con las fechas y soportes del expediente.");
    blocks.push("Sentencia C-038 de 2020 de la Corte Constitucional: la responsabilidad por infracciones detectadas mediante ayudas tecnológicas no puede derivarse de manera automática de la sola condición de propietario; debe verificarse la atribución personal de la infracción conforme al precedente constitucional.");
    blocks.push("Sentencia C-530 de 2003 de la Corte Constitucional: el régimen sancionatorio administrativo debe respetar los principios de culpabilidad y debido proceso, evitando formas de responsabilidad objetiva incompatibles con la Constitución.");
    blocks.push("Artículo 161 de la Ley 769 de 2002: se incorpora para reconstruir el término de caducidad de la acción contravencional y verificar la audiencia y decisión dentro del plazo legal, sin afirmar caducidad por la sola fecha del comparendo.");
    blocks.push("La revocatoria directa se examina como vía consecuencial o subsidiaria frente a las irregularidades acreditadas, de acuerdo con los presupuestos legales aplicables al acto concreto.");
  } else {
    if (a.routes.includes("PRESCRIPCION")) blocks.push("Artículo 159 de la Ley 769 de 2002: se aplica al análisis de prescripción de las sanciones de tránsito, reconstruyendo el término a partir de los hitos jurídicamente relevantes y sin confundir la fecha del hecho con la notificación de un eventual mandamiento de pago.");
    if (a.routes.includes("PERDIDA_EJECUTORIEDAD")) blocks.push("Artículo 91 de la Ley 1437 de 2011 (CPACA): se incorpora para examinar, a partir de la firmeza del acto y de sus actos de ejecución, si concurre una causal de pérdida de ejecutoriedad.");
    if (a.routes.includes("CADUCIDAD")) blocks.push("Artículo 161 de la Ley 769 de 2002: se examina la caducidad de la acción contravencional con la cronología efectiva de audiencia y decisión, no únicamente con la fecha del comparendo.");
  }
  if (hasNotificationIssue) blocks.push("Régimen de notificaciones y artículo 29 de la Constitución Política: la autoridad debe aportar los soportes que permitan establecer acto comunicado, destinatario, medio, fecha y constancia de entrega, publicación o recepción.");
  return [...new Set(blocks.filter(Boolean))].join("\n\n");
}

export function generateUnifiedLegalDocument(input: SelectedRecordData): LegalDraft {
  const r = cleanRecord(input);
  const assessment = assessTrafficRecord(r);
  const t = assessment.temporal;
  const photo = isPhotoRecord(r);
  const code = `${r.codigo || ""} ${r.estado || ""}`;
  const authorities = modularAuthorities(assessment.routes, String(r.codigo || ""), assessment.routes.includes("NOTIFICACION"), photo, String(r.estado || ""));
  const elapsed = elapsedFrom(r.fecha);
  const hasPrescriptionExpired = Boolean(t?.initialExpiryDate && parseDate(t.initialExpiryDate) && parseDate(t.initialExpiryDate)! <= todayUTC());
  const facts = factsBlock(r, t!, assessment);
  const requests = requestsBlock(r, assessment);
  const library = dynamicLegalLibrary(r, assessment, authorities);
  const conclusion = strategyConclusion(assessment, r);

  const subject = photo && elapsed.years < 3
    ? "ASUNTO: DERECHO DE PETICIÓN — INDEBIDA NOTIFICACIÓN DE FOTODETECCIÓN, CADUCIDAD DE LA ACCIÓN CONTRAVENCIONAL Y SOLICITUD DE REVOCATORIA / DEPURACIÓN SIMIT."
    : hasPrescriptionExpired || assessment.primaryRoute === "PRESCRIPCION"
      ? "ASUNTO: DERECHO DE PETICIÓN — SOLICITUD DE DECLARATORIA DE PRESCRIPCIÓN DE SANCIÓN DE TRÁNSITO Y/O ACCIÓN DE COBRO Y DEPURACIÓN DE REGISTRO EN SIMIT."
      : "ASUNTO: DERECHO DE PETICIÓN — REVISIÓN DE ACTUACIÓN CONTRAVENCIONAL, NOTIFICACIÓN Y DEPURACIÓN DE REGISTRO EN SIMIT.";

  const document = [
    "SEÑORES",
    sanitizeValue(r.organismo).toUpperCase(),
    "E. S. D.",
    "",
    subject,
    `PETICIONARIO: ${sanitizeValue(r.nombre)}, identificado(a) con C.C. No. ${sanitizeValue(r.cedula)}.`,
    `REFERENCIA: Comparendo / acto No. ${sanitizeValue(r.comparendo)} — Fecha: ${sanitizeValue(r.fecha)}.`,
    "",
    `Yo, ${sanitizeValue(r.nombre)}, mayor de edad, identificado(a) con la cédula de ciudadanía número ${sanitizeValue(r.cedula)}, domiciliado(a) en la ciudad de ${sanitizeValue(r.ciudad)}, actuando en nombre propio y en ejercicio del Derecho Fundamental de Petición consagrado en el artículo 23 de la Constitución Política, concordante con la Ley 1437 de 2011 (CPACA), me dirijo respetuosamente a su Despacho para formular las siguientes peticiones:`,
    "",
    "I. HECHOS",
    facts,
    "",
    "II. PROBLEMA JURÍDICO",
    `Determinar, con base en el expediente administrativo y en la información acreditada, cuál es la consecuencia jurídica procedente respecto del comparendo No. ${sanitizeValue(r.comparendo)}, particularmente frente a ${photo && elapsed.years < 3 ? "la notificación, la identificación del conductor y la caducidad de la acción contravencional" : "la prescripción, la notificación, la ejecutoria y la exigibilidad de la sanción"}.`,
    "",
    "III. FUNDAMENTOS DE DERECHO",
    library || "No se incorporan referencias que no estén respaldadas por la biblioteca jurídica controlada.",
    "",
    "IV. ANÁLISIS DEL CASO CONCRETO",
    conclusion,
    t?.executiveSummary || "La cronología requiere confrontación con el expediente administrativo.",
    ...(t?.inferences || []),
    "",
    "V. RECONSTRUCCIÓN CRONOLÓGICA",
    t?.events?.map(e => `${e.label}: ${e.date || "no acreditada"} [${e.status}]. ${e.legalEffect}`).join("\n\n") || "No existe una cronología suficiente para reconstruir el expediente.",
    "",
    "VI. PRUEBA Y DOCUMENTOS NECESARIOS",
    (t?.evidenceQuestions || []).map(x => `• ${x}`).join("\n") || "• Expediente administrativo completo.",
    "",
    "VII. PETICIONES",
    requests,
    "",
    "VIII. NOTIFICACIONES",
    `Correo electrónico: ${sanitizeValue(r.correo)}\nTeléfono: ${sanitizeValue(r.telefono)}\nDirección: ${sanitizeValue(r.direccion)}`,
    "",
    "IX. ANEXOS",
    "Estado de Cuenta SIMIT aportado por el solicitante.",
    "",
    "Atentamente,",
    "",
    sanitizeValue(r.nombre),
    `C.C. No. ${sanitizeValue(r.cedula)}`,
  ].join("\n\n");

  return { hechos: facts, solicitudConcreta: requests, fundamentos: library, assessment, authorities, document };
}

export function generateLegalDraft(input: SelectedRecordData): LegalDraft {
  return generateUnifiedLegalDocument(input);
}