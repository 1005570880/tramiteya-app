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
  const code = normalized(String(r.codigo || ""));

  if (sanctioned(r)) reasoning.push("El registro presenta elementos compatibles con una multa o sanción; se revisan acto sancionatorio, notificación, firmeza, exigibilidad, prescripción, cobro y fuerza ejecutoria.");
  else { routes.push("CADUCIDAD"); missing.push("Expediente, decisión sancionatoria y constancia de ejecutoria, si existen."); reasoning.push("No está acreditada una sanción firme; debe verificarse la cronología de la actuación contravencional."); }
  if (temporal.initialExpiryDate) { routes.push("PRESCRIPCION"); reasoning.push(temporalConclusion(temporal)); missing.push(...temporal.evidenceQuestions.filter(x => /mandamiento|cobro|prescrip/i.test(x))); }
  if (temporal.ejecutoriaStatus === "HIPOTESIS_OBJETIVA" || temporal.ejecutoriaStatus === "CONFIGURADO" || temporal.ejecutoriaDate) { routes.push("PERDIDA_EJECUTORIEDAD"); missing.push("Fecha y constancia de ejecutoria y relación de actos de ejecución posteriores."); }
  if (!r.fechaNotificacion || !r.fechaNotificacionMandamiento) { routes.push("NOTIFICACION"); missing.push("Constancias de notificación de comparendo, resolución y mandamiento de pago, con acto, destinatario, medio, fecha y soporte."); }
  if (r.esFotodetencion || /fotodeteccion|fotomulta|c35|d02|camara/.test(code)) { routes.push("FOTODETECCION"); missing.push("Evidencia de detección y soportes de identificación del infractor."); }
  routes.push("DEBIDO_PROCESO", "REVOCATORIA_DIRECTA");
  const unique = [...new Set(routes)];
  const primary: LegalRoute = unique.includes("PRESCRIPCION") ? "PRESCRIPCION" : unique.includes("CADUCIDAD") ? "CADUCIDAD" : unique.includes("PERDIDA_EJECUTORIEDAD") ? "PERDIDA_EJECUTORIEDAD" : unique.includes("FOTODETECCION") ? "FOTODETECCION" : unique.includes("NOTIFICACION") ? "NOTIFICACION" : "DEBIDO_PROCESO";
  const priority = unique.includes("PRESCRIPCION") || unique.includes("PERDIDA_EJECUTORIEDAD") ? "alta" : unique.includes("CADUCIDAD") || unique.includes("FOTODETECCION") || unique.includes("NOTIFICACION") ? "media" : "baja";
  return { routes: unique, primaryRoute: primary, priority, missingEvidence: [...new Set(missing)], reasoning: [...new Set(reasoning)], certainty: temporal.certainty, temporal };
}

export function getDynamicLegalQuestions(record: SelectedRecordData, assessment: LegalAssessment): DynamicLegalQuestion[] {
  const q: DynamicLegalQuestion[] = [];
  const add = (x: DynamicLegalQuestion) => { if (q.length < 4 && !q.some(y => y.id === x.id)) q.push(x); };
  if (!record.nombre || record.nombre === OCR_FALLBACK) add({ id: "nombre", label: "Para empezar, ¿cuál es tu nombre completo?", type: "text", required: true, route: "DEBIDO_PROCESO" });
  if (!record.correo || record.correo === OCR_FALLBACK) add({ id: "correo", label: "¿A qué correo quieres recibir la respuesta?", type: "text", required: true, route: "DEBIDO_PROCESO" });
  if (!record.telefono || record.telefono === OCR_FALLBACK) add({ id: "telefono", label: "¿Cuál es tu número de teléfono?", type: "text", route: "DEBIDO_PROCESO" });
  if (!record.ciudad || record.ciudad === OCR_FALLBACK) add({ id: "ciudad", label: "¿En qué ciudad estás domiciliado(a)?", type: "text", route: "DEBIDO_PROCESO" });
  if (q.length >= 4) return q;
  if (assessment.routes.includes("PRESCRIPCION") && !record.fechaMandamientoPago) add({ id: "existe_mandamiento_pago", label: "¿Alguna vez recibiste un documento de cobro o mandamiento de pago por esta multa?", type: "select", route: "PRESCRIPCION", options: [{ label: "Sí", value: "si" }, { label: "No", value: "no" }, { label: "No lo sé", value: "no_se" }] });
  if (q.length >= 4) return q;
  if (assessment.routes.includes("NOTIFICACION") && !record.fechaNotificacion) add({ id: "forma_notificacion", label: "¿Alguna vez recibiste una notificación oficial relacionada con esta multa?", type: "select", route: "NOTIFICACION", options: [{ label: "Sí, recibí una", value: "si" }, { label: "No, nunca", value: "no" }, { label: "No lo recuerdo", value: "no_se" }] });
  if (q.length >= 4) return q;
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

function factsBlock(r: SelectedRecordData, t: CaseLegalAnalysis) {
  const elapsed = elapsedFrom(r.fecha);
  const facts = [
    `En la plataforma SIMIT figura a nombre del peticionario el comparendo / orden de comparendo No. ${sanitizeValue(r.comparendo)}, de fecha ${r.fecha || "no identificada"}, asociado al organismo ${sanitizeValue(r.organismo)}.`,
    `La actuación aparece asociada al documento de identidad No. ${sanitizeValue(r.cedula)} y registra un estado de ${sanitizeValue(r.estado)}, por un valor reportado de ${sanitizeValue(r.valor)}.`,
    `A la fecha de elaboración han transcurrido aproximadamente ${elapsed.years} años y ${elapsed.months} meses desde la fecha del hecho.`,
  ];
  if (r.codigo) facts.push(`El registro identifica la infracción con el código ${r.codigo}.`);
  if (r.placa && r.placa !== OCR_FALLBACK) facts.push(`La placa asociada al registro es ${r.placa}.`);
  if (r.fechaResolucion) facts.push(`Se reporta resolución o acto sancionatorio de fecha ${r.fechaResolucion}; su contenido y ejecutoria deben verificarse documentalmente.`);
  else facts.push("No se encuentra acreditada en el Estado de Cuenta la fecha de expedición del acto sancionatorio ni su ejecutoria.");
  if (r.fechaNotificacion) facts.push(`Se reporta una fecha de notificación (${r.fechaNotificacion}); debe verificarse qué actuación fue notificada y la constancia correspondiente.`);
  else facts.push("No se encuentra acreditada en la información disponible la fecha ni el medio de notificación del acto sancionatorio.");
  if (r.fechaMandamientoPago) facts.push(`Se reporta mandamiento de pago de fecha ${r.fechaMandamientoPago}; su notificación debe verificarse separadamente.`);
  else facts.push("No se encuentra acreditada la existencia o fecha de un mandamiento de pago.");
  if (r.fechaNotificacionMandamiento) facts.push(`Se reporta notificación del mandamiento el ${r.fechaNotificacionMandamiento}; su eficacia debe confrontarse con el expediente.`);
  else facts.push("No se encuentra acreditada una fecha de notificación del mandamiento de pago; esta ausencia identifica una cuestión probatoria decisiva, pero no demuestra por sí sola su inexistencia.");
  if (r.actuacionesCobro) facts.push(`El ciudadano reporta las siguientes actuaciones de cobro: ${r.actuacionesCobro}.`);
  if (t.initialExpiryDate) facts.push(`El cómputo inicial de tres años proyecta un vencimiento al ${t.initialExpiryDate}.`);
  if (t.ejecutoriaDate && t.ejecutoriaExpiryDate) facts.push(`La ejecutoria reportada (${t.ejecutoriaDate}) proyecta el hito de cinco años al ${t.ejecutoriaExpiryDate}.`);
  return facts.map((x, i) => `${i + 1}. ${x}`).join("\n\n");
}

function strategyConclusion(a: LegalAssessment) {
  const route = a.primaryRoute;
  if (route === "PRESCRIPCION") return "La estrategia principal es reconstruir el término de prescripción con especial atención a la existencia, fecha y notificación eficaz del mandamiento de pago; las demás vías se mantienen como subsidiarias cuando la evidencia las haga pertinentes.";
  if (route === "CADUCIDAD") return "La estrategia principal es reconstruir la actuación contravencional para determinar si la autoridad ejerció oportunamente la acción y si existe decisión sancionatoria eficaz.";
  if (route === "PERDIDA_EJECUTORIEDAD") return "La estrategia principal es verificar la firmeza del acto y los actos de ejecución realizados durante el período relevante para establecer si existe una causal de pérdida de ejecutoriedad.";
  if (route === "FOTODETECCION") return "La estrategia principal es verificar la identificación del infractor, la evidencia técnica y las garantías de notificación y defensa propias de la detección electrónica.";
  return "La estrategia principal es reconstruir documentalmente la actuación y verificar la regularidad de sus notificaciones, firmeza, ejecución y demás garantías del debido proceso.";
}

function requestsBlock(r: SelectedRecordData, a: LegalAssessment) {
  const t = a.temporal;
  const requests = [
    `PRIMERA. Que se determine expresamente la situación jurídica actual de la actuación No. ${sanitizeValue(r.comparendo)} y la razón por la cual figura vigente, exigible o registrada, si así ocurre.`,
    `SEGUNDA. Que se remita copia íntegra, legible y completa del expediente administrativo relacionado con el comparendo No. ${sanitizeValue(r.comparendo)}.`,
    "TERCERA. Que se identifique el acto mediante el cual se impuso la sanción, indicando número, fecha, contenido, autoridad que lo expidió y constancia de ejecutoria, y se remita copia íntegra.",
    "CUARTA. Que se remitan las constancias de notificación de la orden de comparendo, acto sancionatorio, recursos, resolución y mandamiento de pago, indicando acto, destinatario, medio, fecha y soporte de entrega, publicación o recepción.",
    "QUINTA. Que se informe si existe o existió proceso de cobro coactivo y, en caso afirmativo, se remita copia íntegra de sus actuaciones, incluyendo mandamiento de pago, notificación, medidas cautelares, acuerdos de pago, pagos y demás actuaciones posteriores.",
  ];
  if (a.primaryRoute === "PRESCRIPCION") requests.push(`SEXTA. Que se reconstruya documentalmente el término aplicable y se determine si antes del vencimiento inicial${t?.initialExpiryDate ? ` (${t.initialExpiryDate})` : ""} existió una actuación jurídicamente eficaz con incidencia en su cómputo, identificando fecha de expedición, fecha exacta de notificación y soporte documental.`);
  if (a.primaryRoute === "CADUCIDAD") requests.push("SEXTA. Que se reconstruya la cronología de la actuación contravencional, indicando fecha de audiencia, decisión, recursos y notificaciones, para determinar si se configuró la caducidad legalmente aplicable.");
  if (a.primaryRoute === "PERDIDA_EJECUTORIEDAD") requests.push("SEXTA. Que se determine la fecha de firmeza del acto y se identifiquen uno por uno los actos de ejecución realizados durante los cinco años siguientes, con fecha, naturaleza y soporte documental.");
  if (a.primaryRoute === "FOTODETECCION") requests.push("SEXTA. Que se entregue la evidencia técnica de la detección, los soportes de identificación del presunto infractor y las constancias de validación y notificación correspondientes.");
  requests.push(
    "SÉPTIMA. Que, si de la revisión integral del expediente se acredita prescripción, caducidad, pérdida de ejecutoriedad, irregularidad sustancial de notificación, vulneración del debido proceso u otra causal jurídicamente procedente, se adopte expresamente la consecuencia correspondiente.",
    "OCTAVA. Que, si procede una consecuencia favorable, se termine y archive la obligación o actuación en aquello que legalmente corresponda y se ordene, dentro de las competencias de la entidad, la actualización, cancelación, eliminación o depuración de los registros administrativos y del SIMIT.",
    "NOVENA. Que se informe cuáles actuaciones aparecen registradas en los sistemas internos y cuáles cuentan con soporte documental dentro del expediente, sin utilizar el Estado de Cuenta SIMIT como sustituto del expediente administrativo.",
    "DÉCIMA. Que se emita respuesta de fondo, clara, precisa, congruente, completa y debidamente motivada frente a cada una de las solicitudes anteriores."
  );
  return requests.join("\n\n");
}

function dynamicLegalLibrary(r: SelectedRecordData, a: LegalAssessment, authorities: LegalAuthority[]) {
  const isPhoto = Boolean(r.esFotodetencion || /fotodeteccion|fotomulta|c35|d02|camara/.test(normalized(`${r.codigo || ""} ${r.estado || ""}`)));
  const hasNotificationIssue = a.routes.includes("NOTIFICACION") || !r.fechaNotificacion || !r.fechaNotificacionMandamiento;
  const blocks = authorities.map(authorityBlock);
  if (a.routes.includes("PRESCRIPCION")) blocks.push("Artículo 159 de la Ley 769 de 2002: se aplica al análisis de prescripción de las sanciones de tránsito, reconstruyendo el término a partir de los hitos jurídicamente relevantes y sin confundir la fecha del hecho con la notificación de un eventual mandamiento de pago.");
  if (a.routes.includes("PERDIDA_EJECUTORIEDAD")) blocks.push("Artículo 91 de la Ley 1437 de 2011 (CPACA): se incorpora para examinar, a partir de la firmeza del acto y de sus actos de ejecución, si concurre una causal de pérdida de ejecutoriedad.");
  if (a.routes.includes("CADUCIDAD")) blocks.push("Régimen de caducidad de la acción contravencional de tránsito: se examina con la cronología efectiva de la actuación, audiencia y decisión, no únicamente con la fecha del comparendo.");
  if (hasNotificationIssue) blocks.push("Artículo 29 de la Constitución Política y régimen de notificaciones aplicable: la autoridad debe aportar los soportes que permitan establecer acto comunicado, destinatario, medio, fecha y constancia de entrega, publicación o recepción.");
  if (isPhoto) blocks.push("Módulo de fotodetección: se incorporan únicamente cuando el expediente permita tratar el caso como detección electrónica, las reglas y precedentes pertinentes sobre identificación del infractor, evidencia técnica y garantías de defensa.");
  return [...new Set(blocks)].join("\n\n");
}

export function generateUnifiedLegalDocument(input: SelectedRecordData): LegalDraft {
  const r = cleanRecord(input);
  const assessment = assessTrafficRecord(r);
  const t = assessment.temporal;
  const code = `${r.codigo || ""} ${r.estado || ""}`;
  const isPhoto = Boolean(r.esFotodetencion || /fotodeteccion|fotomulta|c35|d02|camara/.test(normalized(code)));
  const authorities = modularAuthorities(assessment.routes, String(r.codigo || ""), assessment.routes.includes("NOTIFICACION"), isPhoto, String(r.estado || ""));
  const elapsed = elapsedFrom(r.fecha);
  const hasPrescriptionExpired = Boolean(t?.initialExpiryDate && parseDate(t.initialExpiryDate) && parseDate(t.initialExpiryDate)! <= todayUTC());
  const legalStatus = hasPrescriptionExpired ? "Existe un vencimiento temporal objetivo que debe ser confrontado con las actuaciones interruptivas jurídicamente eficaces." : "El término inicial de prescripción aún no aparece vencido; el escrito debe concentrarse en reconstruir el expediente, las notificaciones y las actuaciones que puedan incidir en el cómputo.";
  const hechos = factsBlock(r, t!);
  const requests = requestsBlock(r, assessment);
  const library = dynamicLegalLibrary(r, assessment, authorities);
  const conclusion = `${strategyConclusion(assessment)} ${legalStatus}`;

  const document = [
    "SEÑORES",
    sanitizeValue(r.organismo).toUpperCase(),
    "E. S. D.",
    "",
    "ASUNTO: DERECHO DE PETICIÓN — SOLICITUD DE DECLARATORIA DE PRESCRIPCIÓN Y/O CADUCIDAD DE SANCIÓN DE TRÁNSITO Y DEPURACIÓN DE REGISTRO EN SIMIT.",
    `PETICIONARIO: ${sanitizeValue(r.nombre)}, identificado(a) con C.C. No. ${sanitizeValue(r.cedula)}.`,
    "",
    `Yo, ${sanitizeValue(r.nombre)}, mayor de edad, identificado(a) con la cédula de ciudadanía número ${sanitizeValue(r.cedula)}, domiciliado(a) en la ciudad de ${sanitizeValue(r.ciudad)}, actuando en nombre propio y en ejercicio del Derecho Fundamental de Petición consagrado en el artículo 23 de la Constitución Política, concordante con la Ley 1437 de 2011 (CPACA), me dirijo respetuosamente a su Despacho para formular las siguientes peticiones:`,
    "",
    "I. HECHOS",
    hechos,
    "",
    "II. PROBLEMA JURÍDICO",
    `Determinar, con base en el expediente y en la información aportada, cuál es la vía jurídica más sólida respecto del comparendo No. ${sanitizeValue(r.comparendo)}, cuál es el término aplicable, cuáles son sus hitos de inicio y vencimiento, qué actuaciones pudieron modificarlo y qué consecuencia corresponde según la prueba disponible.`,
    "",
    "III. FUNDAMENTOS DE DERECHO — BIBLIOTECA JURÍDICA DINÁMICA",
    library || "No se incorporan referencias que no estén respaldadas por la biblioteca jurídica controlada.",
    "",
    "IV. ANÁLISIS DEL CASO CONCRETO",
    `La fecha del hecho es ${r.fecha || "no identificada"}; han transcurrido aproximadamente ${elapsed.years} años y ${elapsed.months} meses. ${conclusion}`,
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

  return { hechos, solicitudConcreta: requests, fundamentos: library, assessment, authorities, document };
}

export function generateLegalDraft(input: SelectedRecordData): LegalDraft {
  return generateUnifiedLegalDocument(input);
}
