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

function cleanRecord(input: SelectedRecordData): SelectedRecordData {
  return {
    ...input,
    comparendo: sanitizeValue(input.comparendo),
    fecha: sanitizeValue(input.fecha),
    organismo: sanitizeValue(input.organismo),
    estado: sanitizeValue(input.estado),
    valor: sanitizeValue(input.valor),
    placa: sanitizeValue(input.placa),
    cedula: sanitizeValue(input.cedula),
    codigo: input.codigo ? sanitizeValue(input.codigo) : undefined,
    nombre: sanitizeValue(input.nombre),
    correo: sanitizeValue(input.correo),
    telefono: sanitizeValue(input.telefono),
    ciudad: sanitizeValue(input.ciudad),
    direccion: sanitizeValue(input.direccion),
  };
}

function isPhotoRecord(r: SelectedRecordData): boolean {
  return Boolean(r.esFotodetencion || /fotodeteccion|fotomulta|c35|d02|camara|fad/.test(normalized(`${r.codigo || ""} ${r.estado || ""} ${r.comparendo || ""}`)));
}

function sanctioned(r: SelectedRecordData): boolean {
  const status = normalized(String(r.estado || ""));
  const id = String(r.comparendo || "").trim();
  return Boolean(/-SA(?:$|[-_\s])/i.test(id) || r.fechaResolucion || truthy(r.existeResolucion) || truthy(r.huboAudiencia)) ||
    ["multa", "sancion", "sancionado", "pendiente de pago", "cobro coactivo", "cobro", "mandamiento", "acuerdo de pago", "pagada", "pagado", "cancelada", "cancelado"].some(w => status.includes(normalized(w)));
}

function hasExpired(date?: string): boolean {
  const d = parseDate(date);
  return Boolean(d && d <= todayUTC());
}

function temporalConclusion(t: CaseLegalAnalysis): string {
  if (!t.initialExpiryDate) return "No existe una fecha inicial suficientemente acreditada para realizar un cómputo temporal confiable.";
  if (hasExpired(t.initialExpiryDate)) return `Existe un vencimiento temporal objetivo al ${longDate(t.initialExpiryDate)}. La configuración de la prescripción debe confrontarse con la existencia y notificación del mandamiento de pago y demás hitos jurídicamente relevantes.`;
  return `El término inicial de tres años se proyecta hasta el ${longDate(t.initialExpiryDate)}. Por ahora no se afirma prescripción: debe verificarse si antes de esa fecha existió una actuación jurídicamente eficaz, especialmente un mandamiento de pago debidamente notificado.`;
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
    reasoning.push("El registro es compatible con fotodetección; la estrategia prioriza notificación, identificación personal del infractor y debido proceso.");
    if (temporal.caducityExpiryDate && hasExpired(temporal.caducityExpiryDate)) routes.unshift("CADUCIDAD");
    if (ageMonths < 36) reasoning.push("El comparendo tiene menos de tres años: la prescripción no se formula como pretensión principal. La caducidad solo se afirma si la cronología del expediente demuestra su configuración.");
  } else {
    if (sanctioned(r)) reasoning.push("El registro presenta elementos compatibles con una sanción: se revisan acto sancionatorio, notificación, firmeza, prescripción, cobro y fuerza ejecutoria.");
    else { routes.push("CADUCIDAD"); missing.push("Expediente, decisión sancionatoria y constancia de ejecutoria, si existen."); reasoning.push("No está acreditada una sanción firme; debe reconstruirse la actuación contravencional antes de afirmar una consecuencia jurídica."); }
    if (temporal.initialExpiryDate) { routes.push("PRESCRIPCION"); reasoning.push(temporalConclusion(temporal)); missing.push(...temporal.evidenceQuestions.filter(x => /mandamiento|cobro|prescrip/i.test(x))); }
    if (temporal.ejecutoriaStatus === "HIPOTESIS_OBJETIVA" || temporal.ejecutoriaStatus === "CONFIGURADO" || temporal.ejecutoriaDate) routes.push("PERDIDA_EJECUTORIEDAD");
    if (!r.fechaNotificacion || !r.fechaNotificacionMandamiento) routes.push("NOTIFICACION");
    routes.push("DEBIDO_PROCESO", "REVOCATORIA_DIRECTA");
  }

  const unique = [...new Set(routes)];
  let primary: LegalRoute;
  if (photo && ageMonths < 36) primary = unique.includes("CADUCIDAD") ? "CADUCIDAD" : "FOTODETECCION";
  else primary = unique.includes("PRESCRIPCION") ? "PRESCRIPCION" : unique.includes("CADUCIDAD") ? "CADUCIDAD" : unique.includes("PERDIDA_EJECUTORIEDAD") ? "PERDIDA_EJECUTORIEDAD" : unique.includes("FOTODETECCION") ? "FOTODETECCION" : unique.includes("NOTIFICACION") ? "NOTIFICACION" : "DEBIDO_PROCESO";

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
  if (photo && !record.fechaNotificacion) add({ id: "notificacion_fotodeteccion", label: "¿Recibiste alguna comunicación oficial sobre esta fotomulta en tu dirección o correo?", type: "select", route: "NOTIFICACION", options: [{ label: "❌ Nunca recibí una", value: "no" }, { label: "📩 Sí, recibí una", value: "si" }, { label: "❓ No lo recuerdo", value: "no_se" }] });
  if (q.length >= 5) return q;
  if (photo && !record.respuestas?.conductorIdentificado) add({ id: "conductor_identificado", label: "¿La autoridad te identificó expresamente como el conductor que cometió la infracción?", type: "select", route: "FOTODETECCION", options: [{ label: "Sí, fui identificado", value: "si" }, { label: "No, nunca fui identificado", value: "no" }, { label: "No lo sé", value: "no_se" }] });
  if (q.length >= 5) return q;
  if (!photo && assessment.routes.includes("PRESCRIPCION") && !record.fechaMandamientoPago) add({ id: "existe_mandamiento_pago", label: "¿Alguna vez recibiste un documento de cobro o mandamiento de pago por esta multa?", type: "select", route: "PRESCRIPCION", options: [{ label: "Sí", value: "si" }, { label: "No", value: "no" }, { label: "No lo sé", value: "no_se" }] });
  if (q.length >= 5) return q;
  if (!photo && assessment.routes.includes("NOTIFICACION") && !record.fechaNotificacion) add({ id: "forma_notificacion", label: "¿Alguna vez recibiste una notificación oficial relacionada con esta multa?", type: "select", route: "NOTIFICACION", options: [{ label: "Sí, recibí una", value: "si" }, { label: "No, nunca", value: "no" }, { label: "No lo recuerdo", value: "no_se" }] });
  return q;
}

function authorityBlock(a: LegalAuthority): string {
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

function identityBlock(r: SelectedRecordData): string {
  return `PETICIONARIO: ${sanitizeValue(r.nombre)}, identificado(a) con C.C. No. ${sanitizeValue(r.cedula)}.`;
}

function factsBlock(r: SelectedRecordData, t: CaseLegalAnalysis, assessment: LegalAssessment): string {
  const elapsed = elapsedFrom(r.fecha);
  const photo = isPhotoRecord(r);
  const facts: string[] = [
    `PRIMERO. En la plataforma SIMIT figura a nombre del peticionario la actuación / comparendo No. ${sanitizeValue(r.comparendo)}, de fecha ${sanitizeValue(r.fecha)}, asociado al organismo ${sanitizeValue(r.organismo)}.`,
    `SEGUNDO. El registro reporta un estado de ${sanitizeValue(r.estado)}, un valor de ${sanitizeValue(r.valor)} y${r.codigo ? ` el código de infracción ${sanitizeValue(r.codigo)}` : " una identificación de infracción que deberá ser confrontada con el expediente"}.`,
    `TERCERO. La actuación aparece asociada al documento de identidad No. ${sanitizeValue(r.cedula)} y, a la fecha de elaboración, han transcurrido aproximadamente ${elapsed.years} años y ${elapsed.months} meses desde la fecha del hecho.`,
  ];
  if (r.placa && r.placa !== OCR_FALLBACK) facts.push(`CUARTO. La placa asociada al registro es ${sanitizeValue(r.placa)}.`);
  if (photo) {
    facts.push("QUINTO. Por tratarse de un registro compatible con fotodetección, la actuación debe confrontarse con la evidencia técnica, la validación, la identificación del presunto infractor y las constancias de notificación que obren en el expediente.");
    facts.push("SEXTO. La sola existencia del registro en SIMIT no permite tener por acreditada la notificación de los actos administrativos; corresponde a la autoridad aportar los soportes de comunicación, destinatario, medio, fecha y resultado de entrega.");
    facts.push("SÉPTIMO. La atribución personal de la infracción debe establecerse con las pruebas y garantías del procedimiento sancionatorio, sin derivarla automáticamente de la sola titularidad del vehículo.");
    if (t.caducityExpiryDate) facts.push(`OCTAVO. El hito temporal de caducidad calculado por el motor se proyecta al ${longDate(t.caducityExpiryDate)}; su configuración exige verificar la audiencia y decisión efectivamente realizadas dentro del término legal.`);
  } else {
    facts.push(r.fechaResolucion ? `CUARTO. Se reporta resolución o acto sancionatorio de fecha ${sanitizeValue(r.fechaResolucion)}, cuyo contenido, notificación y ejecutoria deben verificarse documentalmente.` : "CUARTO. El Estado de Cuenta no permite acreditar por sí solo la fecha de expedición, contenido o ejecutoria del eventual acto sancionatorio.");
    facts.push(r.fechaNotificacion ? `QUINTO. Se reporta una fecha de notificación (${sanitizeValue(r.fechaNotificacion)}); debe verificarse qué actuación fue notificada y su respectiva constancia.` : "QUINTO. No se encuentra acreditada en la información disponible la fecha ni el medio de notificación del acto sancionatorio.");
    facts.push(r.fechaMandamientoPago ? `SEXTO. Se reporta mandamiento de pago de fecha ${sanitizeValue(r.fechaMandamientoPago)}; su notificación debe verificarse separadamente.` : "SEXTO. No se encuentra acreditada en la información disponible la existencia o fecha de un mandamiento de pago.");
    facts.push(r.fechaNotificacionMandamiento ? `SÉPTIMO. Se reporta notificación del mandamiento el ${sanitizeValue(r.fechaNotificacionMandamiento)}; su eficacia debe confrontarse con el expediente.` : "SÉPTIMO. No se encuentra acreditada una fecha de notificación del mandamiento de pago; esta ausencia identifica una cuestión probatoria decisiva, pero no demuestra por sí sola su inexistencia.");
  }
  if (r.actuacionesCobro) facts.push(`OCTAVO. El ciudadano reporta las siguientes actuaciones de cobro: ${sanitizeValue(r.actuacionesCobro)}.`);
  if (t.initialExpiryDate) facts.push(`NOVENO. El cómputo inicial de tres años proyecta un vencimiento al ${longDate(t.initialExpiryDate)}; ${hasExpired(t.initialExpiryDate) ? "su eventual prescripción debe contrastarse con los actos interruptivos legalmente relevantes" : "el término inicial aún no se encuentra vencido"}.`);
  if (t.ejecutoriaDate && t.ejecutoriaExpiryDate) facts.push(`DÉCIMO. La ejecutoria reportada (${sanitizeValue(t.ejecutoriaDate)}) proyecta el hito de cinco años al ${sanitizeValue(t.ejecutoriaExpiryDate)} para el análisis de fuerza ejecutoria.`);
  facts.push(`DÉCIMO PRIMERO. La estrategia jurídica del caso se determina por la evidencia disponible y no por una etiqueta predeterminada: ${assessment.reasoning[0] || "se requiere reconstrucción documental de la actuación"}.`);
  return facts.join("\n\n");
}

function strategyConclusion(a: LegalAssessment, r: SelectedRecordData): string {
  const photo = isPhotoRecord(r);
  const elapsed = elapsedFrom(r.fecha);
  if (photo && elapsed.years < 3) return "La estrategia principal se concentra en notificación, identificación y vinculación del conductor, evidencia de la fotodetección, debido proceso y caducidad cuando la cronología permita configurarla. La prescripción de tres años no se presenta como pretensión principal por la sola antigüedad del comparendo.";
  if (a.primaryRoute === "PRESCRIPCION") return "La estrategia principal es reconstruir el término de prescripción de la sanción, verificando el acto sancionatorio, su firmeza, la existencia del mandamiento de pago y, especialmente, su notificación, sin asumir prescripción por la sola antigüedad del registro.";
  if (a.primaryRoute === "CADUCIDAD") return "La estrategia principal es reconstruir la actuación contravencional para determinar si la autoridad decidió dentro del término legal y si existe una decisión sancionatoria eficaz.";
  if (a.primaryRoute === "PERDIDA_EJECUTORIEDAD") return "La estrategia principal es verificar la firmeza del acto y los actos de ejecución relevantes para establecer, si corresponde, una causal de pérdida de ejecutoriedad.";
  return "La estrategia principal es reconstruir documentalmente la actuación, sus notificaciones, la identificación del infractor, la firmeza y las garantías del debido proceso, para solicitar únicamente las consecuencias jurídicamente procedentes.";
}

function legalModules(r: SelectedRecordData, a: LegalAssessment, authorities: LegalAuthority[]): string {
  const photo = isPhotoRecord(r);
  const youngPhoto = photo && elapsedFrom(r.fecha).years < 3;
  const hasNotificationIssue = a.routes.includes("NOTIFICACION") || !r.fechaNotificacion || !r.fechaNotificacionMandamiento;
  const blocks: string[] = [];

  blocks.push("A. MARCO CONSTITUCIONAL Y DEBIDO PROCESO\n\nArtículo 23 de la Constitución Política: derecho fundamental de petición y deber de emitir una respuesta de fondo, clara y congruente.\n\nArtículo 29 de la Constitución Política: debido proceso aplicable a las actuaciones administrativas, derecho de defensa, contradicción y garantías propias del procedimiento sancionatorio.");

  if (youngPhoto) {
    blocks.push("B. AYUDAS TECNOLÓGICAS Y ATRIBUCIÓN PERSONAL\n\nLey 1843 de 2017: régimen especial aplicable a sistemas automáticos, semiautomáticos y otros medios tecnológicos, cuya validación, notificación y demás requisitos deben confrontarse con el expediente y las fechas efectivamente acreditadas.\n\nSentencia C-038 de 2020, Corte Constitucional: la sola condición de propietario no permite trasladar automáticamente la responsabilidad sancionatoria; debe examinarse la atribución personal de la infracción conforme al debido proceso.\n\nSentencia C-530 de 2003, Corte Constitucional: el régimen sancionatorio administrativo debe respetar los principios constitucionales de culpabilidad y debido proceso.");
    blocks.push("C. CADUCIDAD DE LA ACCIÓN CONTRAVENCIONAL\n\nArtículo 161 de la Ley 769 de 2002, modificado por el artículo 11 de la Ley 1843 de 2017: la acción por contravención de las normas de tránsito caduca al año contado desde la ocurrencia de los hechos; durante ese término debe decidirse sobre la imposición de la sanción. La configuración concreta exige reconstruir audiencia, decisión y actuaciones relevantes del expediente.");
  } else {
    if (a.routes.includes("CADUCIDAD")) blocks.push("B. CADUCIDAD DE LA ACCIÓN CONTRAVENCIONAL\n\nArtículo 161 de la Ley 769 de 2002, modificado por el artículo 11 de la Ley 1843 de 2017: la acción por contravención de las normas de tránsito caduca al año contado desde la ocurrencia de los hechos. La audiencia y decisión deben verificarse documentalmente antes de afirmar la configuración de la caducidad.");
    if (a.routes.includes("PRESCRIPCION")) blocks.push("C. PRESCRIPCIÓN DE LA SANCIÓN\n\nArtículo 159 de la Ley 769 de 2002, conforme a la modificación del artículo 206 del Decreto Ley 019 de 2012: las sanciones impuestas por infracciones de tránsito prescriben en tres años contados desde la ocurrencia del hecho y la prescripción se interrumpe con la notificación del mandamiento de pago. Por ello, la fecha de expedición del mandamiento no sustituye la prueba de su notificación.");
    if (a.routes.includes("PERDIDA_EJECUTORIEDAD")) blocks.push("D. PÉRDIDA DE EJECUTORIEDAD\n\nArtículo 91 de la Ley 1437 de 2011 (CPACA): se examina la fuerza ejecutoria del acto administrativo a partir de su firmeza y de las circunstancias de ejecución, sin confundir esta figura con la prescripción de la sanción.");
  }

  if (hasNotificationIssue) blocks.push("E. NOTIFICACIÓN Y PRUEBA\n\nLas constancias de notificación deben permitir identificar el acto comunicado, destinatario, medio empleado, fecha y resultado de entrega, publicación o recepción, según el régimen aplicable. La inexistencia de un dato en el Estado de Cuenta SIMIT no prueba por sí sola la inexistencia de la actuación: por eso se solicita el expediente íntegro.");
  blocks.push("F. JURISPRUDENCIA Y AUTORIDADES SELECCIONADAS POR EL MOTOR\n\n" + (authorities.map(authorityBlock).join("\n\n") || "No se incorporan referencias externas a la biblioteca jurídica controlada."));
  blocks.push("G. REVOCATORIA DIRECTA Y CONSECUENCIAS\n\nLa revocatoria directa se incorpora como vía subsidiaria o consecuencial cuando los hechos y el expediente permitan identificar un acto susceptible de esta figura. Las solicitudes de actualización, cancelación o depuración de SIMIT/RUNT se formulan dentro de las competencias de cada autoridad y como consecuencia de la decisión administrativa que corresponda.");

  return blocks.join("\n\n");
}

function requestsBlock(r: SelectedRecordData, a: LegalAssessment): string {
  const t = a.temporal;
  const photo = isPhotoRecord(r);
  const youngPhoto = photo && elapsedFrom(r.fecha).years < 3;

  if (youngPhoto) return [
    `PRIMERA. Que se determine formalmente la situación jurídica actual del comparendo No. ${sanitizeValue(r.comparendo)} y el acto administrativo que sustenta su permanencia en los sistemas de información.`,
    "SEGUNDA. Que se remita copia íntegra, legible y completa del expediente administrativo y de las actuaciones relacionadas con la fotodetección.",
    "TERCERA. Que se remitan las constancias de validación y notificación, indicando acto, fecha de validación, fecha de envío, medio utilizado, destinatario y soporte de entrega, devolución o publicación, según corresponda.",
    "CUARTA. Que se entregue la evidencia técnica de la detección, incluyendo imágenes, dispositivo, fecha, hora, ubicación, validación y demás elementos que permitan ejercer contradicción y defensa.",
    "QUINTA. Que se informe y acredite cómo fue identificado y vinculado el presunto conductor infractor y cuál es la prueba concreta de su atribución personal.",
    `SEXTA. Que se reconstruya la cronología de la actuación contravencional y se determine si se configuró la caducidad del artículo 161 de la Ley 769 de 2002; si el término aún no ha vencido, que se informe su fecha calculada${t?.caducityExpiryDate ? ` (${longDate(t.caducityExpiryDate)})` : ""}.`,
    "SÉPTIMA. Que, si se acredita una irregularidad sustancial de notificación, falta de atribución personal, vulneración del debido proceso, caducidad u otra causal jurídicamente procedente, se adopte expresamente la consecuencia correspondiente, incluida la revocatoria o terminación cuando legalmente proceda.",
    "OCTAVA. Que, de existir decisión favorable, se ordene dentro de las competencias de la autoridad la actualización, cancelación, eliminación o depuración de los registros y se comunique la novedad a los sistemas competentes, incluido SIMIT y, cuando corresponda, RUNT.",
    "NOVENA. Que se emita respuesta de fondo, clara, precisa, congruente, completa y debidamente motivada frente a cada solicitud."
  ].join("\n\n");

  const requests: string[] = [
    `PRIMERA. Que se determine formalmente la situación jurídica actual de la actuación No. ${sanitizeValue(r.comparendo)} y la razón por la cual figura vigente, exigible o registrada, si así ocurre.`,
    `SEGUNDA. Que se remita copia íntegra, legible y completa del expediente administrativo relacionado con el comparendo No. ${sanitizeValue(r.comparendo)}.`,
    "TERCERA. Que se identifique el acto mediante el cual se impuso la sanción, indicando número, fecha, contenido, autoridad que lo expidió, recursos y constancia de ejecutoria, y se remita copia íntegra.",
    "CUARTA. Que se remitan las constancias de notificación de la orden de comparendo, acto sancionatorio, recursos, resolución y demás actuaciones relevantes, indicando acto, destinatario, medio, fecha y soporte de entrega, publicación o recepción.",
    "QUINTA. Que se informe si existe o existió proceso de cobro coactivo y, en caso afirmativo, se remita copia íntegra de sus actuaciones, incluyendo mandamiento de pago, fecha de expedición, fecha y forma de notificación, medidas cautelares, acuerdos de pago, pagos, excepciones y terminación."
  ];
  if (a.primaryRoute === "PRESCRIPCION") requests.push(`SEXTA. Que se reconstruya documentalmente el término de prescripción y se determine si antes del vencimiento inicial${t?.initialExpiryDate ? ` (${longDate(t.initialExpiryDate)})` : ""} se notificó un mandamiento de pago con eficacia jurídica para interrumpir el término, identificando fecha y soporte documental.`);
  else if (a.primaryRoute === "CADUCIDAD") requests.push("SEXTA. Que se reconstruya la cronología de la actuación contravencional, indicando fecha de audiencia, decisión, recursos y notificaciones, para determinar si se configuró la caducidad legalmente aplicable.");
  else if (a.primaryRoute === "PERDIDA_EJECUTORIEDAD") requests.push("SEXTA. Que se determine la fecha de firmeza del acto y se identifiquen los actos de ejecución realizados durante el período relevante, con fecha, naturaleza y soporte documental.");
  else requests.push("SEXTA. Que se reconstruya la cronología completa de la actuación y se determine cuál es la vía jurídica procedente, con indicación de las actuaciones, fechas y soportes documentales relevantes.");

  requests.push(
    "SÉPTIMA. Que, si de la revisión integral del expediente se acredita prescripción, caducidad, pérdida de ejecutoriedad, irregularidad sustancial de notificación, vulneración del debido proceso u otra causal jurídicamente procedente, se adopte expresamente la consecuencia correspondiente.",
    "OCTAVA. Que, si procede una consecuencia favorable, se termine y archive la obligación o actuación en aquello que legalmente corresponda y se ordene, dentro de las competencias de la entidad, la actualización, cancelación, eliminación o depuración de los registros administrativos y del SIMIT.",
    "NOVENA. Que se informe cuáles actuaciones aparecen registradas en los sistemas internos y cuáles cuentan con soporte documental dentro del expediente, sin utilizar el Estado de Cuenta SIMIT como sustituto del expediente administrativo.",
    "DÉCIMA. Que se emita respuesta de fondo, clara, precisa, congruente, completa y debidamente motivada frente a las solicitudes anteriores."
  );
  return requests.join("\n\n");
}

export function generateUnifiedLegalDocument(input: SelectedRecordData): LegalDraft {
  const r = cleanRecord(input);
  const assessment = assessTrafficRecord(r);
  const t = assessment.temporal;
  const photo = isPhotoRecord(r);
  const elapsed = elapsedFrom(r.fecha);
  const authorities = modularAuthorities(assessment.routes, String(r.codigo || ""), assessment.routes.includes("NOTIFICACION"), photo, String(r.estado || ""));
  const facts = factsBlock(r, t!, assessment);
  const library = legalModules(r, assessment, authorities);
  const requests = requestsBlock(r, assessment);
  const conclusion = strategyConclusion(assessment, r);
  const youngPhoto = photo && elapsed.years < 3;
  const prescriptionExpired = Boolean(t?.initialExpiryDate && hasExpired(t.initialExpiryDate));

  const subject = youngPhoto
    ? "ASUNTO: DERECHO DE PETICIÓN — INDEBIDA NOTIFICACIÓN DE FOTODETECCIÓN, CADUCIDAD DE LA ACCIÓN CONTRAVENCIONAL, ATRIBUCIÓN PERSONAL Y DEPURACIÓN DEL REGISTRO."
    : assessment.primaryRoute === "PRESCRIPCION" || prescriptionExpired
      ? "ASUNTO: DERECHO DE PETICIÓN — SOLICITUD DE DECLARATORIA DE PRESCRIPCIÓN DE SANCIÓN DE TRÁNSITO Y/O ACCIÓN DE COBRO Y DEPURACIÓN DEL REGISTRO."
      : assessment.primaryRoute === "CADUCIDAD"
        ? "ASUNTO: DERECHO DE PETICIÓN — SOLICITUD DE REVISIÓN DE CADUCIDAD DE LA ACTUACIÓN CONTRAVENCIONAL Y DEPURACIÓN DEL REGISTRO."
        : "ASUNTO: DERECHO DE PETICIÓN — REVISIÓN INTEGRAL DE ACTUACIÓN CONTRAVENCIONAL, NOTIFICACIÓN, DEBIDO PROCESO Y DEPURACIÓN DEL REGISTRO.";

  const document = [
    "SEÑORES",
    sanitizeValue(r.organismo).toUpperCase(),
    "E. S. D.",
    "",
    subject,
    identityBlock(r),
    `ACTUACIÓN / COMPARENDO: No. ${sanitizeValue(r.comparendo)}.`,
    "",
    `Yo, ${sanitizeValue(r.nombre)}, mayor de edad, identificado(a) con la cédula de ciudadanía número ${sanitizeValue(r.cedula)}, domiciliado(a) en la ciudad de ${sanitizeValue(r.ciudad)}, actuando en nombre propio y en ejercicio del Derecho Fundamental de Petición consagrado en el artículo 23 de la Constitución Política y desarrollado por la Ley 1437 de 2011 (CPACA), me dirijo respetuosamente a su Despacho para formular la presente solicitud con base en los siguientes:",
    "",
    "I. HECHOS",
    facts,
    "",
    "II. PROBLEMA JURÍDICO",
    `Determinar, a partir del expediente administrativo y de las respuestas suministradas por el peticionario, cuál es la consecuencia jurídica procedente respecto de la actuación No. ${sanitizeValue(r.comparendo)}, especialmente frente a ${youngPhoto ? "la notificación de la fotodetección, la atribución personal del conductor, el debido proceso y la caducidad" : "la existencia de sanción, su notificación, firmeza, prescripción, cobro y fuerza ejecutoria"}.`,
    "",
    "III. FUNDAMENTOS DE DERECHO Y JURISPRUDENCIA",
    library,
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
    "1. Estado de Cuenta SIMIT aportado por el solicitante.",
    "2. Copia del documento de identidad, cuando haya sido aportada o corresponda anexarla.",
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
