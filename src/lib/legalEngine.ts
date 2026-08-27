export interface SelectedRecordData {
  comparendo: string;
  fecha: string;
  organismo: string;
  estado: string;
  valor: string;
  placa?: string;
  cedula?: string;
  codigo?: string;
  fechaResolucion?: string;
  fechaNotificacion?: string;
  fechaMandamientoPago?: string;
  huboAudiencia?: boolean | string;
  existeResolucion?: boolean | string;
}

export type LegalRoute = "CADUCIDAD" | "PRESCRIPCION" | "PERDIDA_EJECUTORIEDAD" | "NOTIFICACION" | "DEBIDO_PROCESO" | "FOTODETECCION" | "REVOCATORIA_DIRECTA";

export interface LegalAssessment {
  routes: LegalRoute[];
  primaryRoute: LegalRoute | null;
  priority: "alta" | "media" | "baja";
  missingEvidence: string[];
  reasoning: string[];
}

export interface DynamicLegalQuestion {
  id: string;
  label: string;
  type: "text" | "date" | "select" | "textarea";
  required?: boolean;
  options?: { label: string; value: string }[];
  route: LegalRoute;
}

export interface LegalDraft {
  hechos: string;
  solicitudConcreta: string;
  fundamentos: string;
  assessment: LegalAssessment;
}

function parseDate(value?: string) {
  if (!value) return null;
  const normalized = String(value).trim();
  const dmy = normalized.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  const iso = dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : normalized;
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function yearsSince(value?: string) {
  const date = parseDate(value);
  if (!date) return null;
  return (Date.now() - date.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
}

function truthy(value: unknown) {
  return value === true || ["si", "sí", "true", "1"].includes(String(value ?? "").trim().toLowerCase());
}

/**
 * A SIMIT record that has already become a multa/sanción/cobro is not treated
 * as an open contravencional proceeding. Caducity is therefore not proposed
 * merely because the underlying date is old. It remains available only when
 * the available evidence does NOT indicate that the proceeding culminated.
 */
function indicatesSanctionedStatus(record: SelectedRecordData) {
  const status = String(record.estado || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const sanctionWords = [
    "multa", "sancion", "sancionado", "pendiente de pago", "cobro coactivo",
    "cobro", "mandamiento", "acuerdo de pago", "pagada", "pagado", "cancelada", "cancelado",
  ];
  return Boolean(record.fechaResolucion || truthy(record.existeResolucion) || truthy(record.huboAudiencia)) || sanctionWords.some((word) => status.includes(word));
}

export function assessTrafficRecord(record: SelectedRecordData): LegalAssessment {
  const routes: LegalRoute[] = [];
  const missingEvidence: string[] = [];
  const reasoning: string[] = [];
  const age = yearsSince(record.fecha);
  const mandAge = yearsSince(record.fechaMandamientoPago);
  const hasResolution = truthy(record.existeResolucion) || Boolean(record.fechaResolucion);
  const hasHearing = truthy(record.huboAudiencia);
  const sanctioned = indicatesSanctionedStatus(record);
  const code = String(record.codigo || "").toUpperCase();

  // Do not propose caducity after the available record indicates that the
  // contravencional proceeding culminated in a sanction/multa.
  if (!sanctioned && age !== null && age >= 1) {
    routes.push("CADUCIDAD");
    reasoning.push("La información disponible no evidencia que la actuación contravencional haya culminado; debe verificarse el término de caducidad con el expediente.");
    missingEvidence.push("Acta o constancia de audiencia", "Resolución sancionatoria y constancia de ejecutoria");
  } else if (sanctioned) {
    reasoning.push("El registro disponible evidencia que la actuación ya aparece como multa/sanción o con actuación posterior; por ello no se propone caducidad como ruta principal. Deben analizarse los términos posteriores y la ejecutoriedad.");
  }

  if (age !== null && age >= 3) {
    routes.push("PRESCRIPCION");
    reasoning.push("La antigüedad del registro amerita verificar la prescripción y las actuaciones que pudieron interrumpirla.");
    if (!record.fechaMandamientoPago) missingEvidence.push("Mandamiento de pago y constancia de notificación, si existe");
  }

  if (record.fechaMandamientoPago) {
    missingEvidence.push("Historial de actuaciones de cobro posteriores al mandamiento de pago");
    if (mandAge !== null && mandAge >= 5) {
      routes.push("PERDIDA_EJECUTORIEDAD");
      reasoning.push("La fecha reportada del mandamiento tiene cinco o más años; debe verificarse la ejecutoriedad del acto, la continuidad del cobro y las actuaciones posteriores antes de afirmar la configuración de esta causal.");
      missingEvidence.push("Constancia de ejecutoria del acto", "Actuaciones posteriores de ejecución");
    }
  }

  if (!record.fechaNotificacion) {
    routes.push("NOTIFICACION");
    missingEvidence.push("Constancias completas de notificación de la actuación, resolución y mandamiento, si existen");
    reasoning.push("El Estado de Cuenta no acredita por sí solo la fecha, modalidad y efectividad de las notificaciones.");
  }

  if (/fotodeteccion|fotomulta|c35|d02|camara/.test(code.toLowerCase())) {
    routes.push("FOTODETECCION");
    missingEvidence.push("Evidencia de detección, identificación del dispositivo, autorización, señalización y soportes técnicos que correspondan");
    reasoning.push("El código o descripción disponible presenta indicios que justifican revisar la evidencia y la atribución de responsabilidad.");
  }

  routes.push("DEBIDO_PROCESO", "REVOCATORIA_DIRECTA");
  if (!hasResolution || !hasHearing) missingEvidence.push("Expediente administrativo íntegro");

  const uniqueRoutes = Array.from(new Set(routes));
  const primaryRoute = uniqueRoutes.includes("PERDIDA_EJECUTORIEDAD")
    ? "PERDIDA_EJECUTORIEDAD"
    : uniqueRoutes.includes("PRESCRIPCION")
      ? "PRESCRIPCION"
      : uniqueRoutes.includes("CADUCIDAD")
        ? "CADUCIDAD"
        : uniqueRoutes.includes("FOTODETECCION")
          ? "FOTODETECCION"
          : uniqueRoutes.includes("NOTIFICACION")
            ? "NOTIFICACION"
            : "REVOCATORIA_DIRECTA";

  return {
    routes: uniqueRoutes,
    primaryRoute,
    priority: uniqueRoutes.includes("PERDIDA_EJECUTORIEDAD") || uniqueRoutes.includes("PRESCRIPCION") ? "alta" : uniqueRoutes.includes("CADUCIDAD") ? "media" : "baja",
    missingEvidence: Array.from(new Set(missingEvidence)),
    reasoning: Array.from(new Set(reasoning)),
  };
}

export function getDynamicLegalQuestions(record: SelectedRecordData, assessment: LegalAssessment): DynamicLegalQuestion[] {
  const q: DynamicLegalQuestion[] = [];
  const add = (item: DynamicLegalQuestion) => { if (!q.some((x) => x.id === item.id)) q.push(item); };

  if (assessment.routes.includes("CADUCIDAD")) {
    add({ id: "fecha_audiencia", label: "Fecha de la audiencia o actuación contravencional, si la conoce", type: "date", route: "CADUCIDAD" });
    add({ id: "fecha_resolucion", label: "Fecha de la resolución sancionatoria, si existe", type: "date", route: "CADUCIDAD" });
    add({ id: "fecha_ejecutoria", label: "Fecha de ejecutoria de la resolución, si la conoce", type: "date", route: "CADUCIDAD" });
  }

  if (assessment.routes.includes("PRESCRIPCION")) {
    add({ id: "existe_mandamiento_pago", label: "¿Le notificaron un mandamiento de pago por esta multa?", type: "select", required: true, route: "PRESCRIPCION", options: [{ label: "Sí", value: "si" }, { label: "No", value: "no" }, { label: "No lo sé", value: "no_se" }] });
    if (!record.fechaMandamientoPago) add({ id: "fecha_mandamiento_pago", label: "Fecha del mandamiento de pago, si existe", type: "date", route: "PRESCRIPCION" });
    add({ id: "fecha_notificacion_mandamiento", label: "Fecha de notificación del mandamiento de pago, si la conoce", type: "date", route: "PRESCRIPCION" });
  }

  if (assessment.routes.includes("PERDIDA_EJECUTORIEDAD")) add({ id: "actuaciones_cobro", label: "¿Qué actuaciones de cobro posteriores al mandamiento conoce? (embargo, acuerdo de pago, pago, secuestro u otra)", type: "textarea", route: "PERDIDA_EJECUTORIEDAD" });
  if (assessment.routes.includes("NOTIFICACION")) add({ id: "forma_notificacion", label: "¿Cómo recibió la notificación de la actuación o resolución?", type: "select", route: "NOTIFICACION", options: [{ label: "Correo", value: "correo" }, { label: "Dirección física", value: "fisica" }, { label: "Aviso", value: "aviso" }, { label: "Nunca fui notificado", value: "nunca" }, { label: "No lo sé", value: "no_se" }] });
  if (assessment.routes.includes("FOTODETECCION")) add({ id: "conductor_identificado", label: "¿La autoridad identificó expresamente al conductor responsable?", type: "select", route: "FOTODETECCION", options: [{ label: "Sí", value: "si" }, { label: "No", value: "no" }, { label: "No lo sé", value: "no_se" }] });
  return q;
}

function routeName(route: LegalRoute | null) {
  switch (route) {
    case "CADUCIDAD": return "caducidad de la actuación contravencional";
    case "PRESCRIPCION": return "prescripción de la obligación o sanción, según corresponda";
    case "PERDIDA_EJECUTORIEDAD": return "pérdida de fuerza ejecutoria del acto administrativo, si se configuran sus presupuestos";
    case "NOTIFICACION": return "irregularidad o ausencia de notificación";
    case "FOTODETECCION": return "las condiciones de la fotodetección y la atribución de responsabilidad";
    case "REVOCATORIA_DIRECTA": return "revocatoria directa, si resulta jurídicamente procedente";
    default: return "la situación jurídica de la actuación";
  }
}

export function generateLegalDraft(record: SelectedRecordData): LegalDraft {
  const autoridad = record.organismo && record.organismo !== "—" ? record.organismo : "la Autoridad de Tránsito competente";
  const comparendo = record.comparendo || "no identificado";
  const fecha = record.fecha || "no identificada";
  const assessment = assessTrafficRecord(record);
  const primary = routeName(assessment.primaryRoute);
  const sanctioned = indicatesSanctionedStatus(record);

  const hechos = [
    `1. En el Estado de Cuenta del SIMIT se encuentra registrado a mi nombre el comparendo/orden de comparendo No. ${comparendo}, de fecha ${fecha}.`,
    `2. El registro aparece asociado a ${autoridad}, con estado "${record.estado || "no identificado"}" y valor reportado de ${record.valor || "no reportado"}.`,
    sanctioned
      ? `3. La información disponible evidencia que el registro ya figura como multa/sanción o actuación posterior al comparendo; por tanto, la revisión debe concentrarse en la legalidad de la sanción, sus términos de exigibilidad, notificación y cobro, sin presumir que la actuación contravencional permanezca abierta.`
      : record.fechaResolucion
        ? `3. En la información disponible se identifica la resolución/acto de fecha ${record.fechaResolucion}.`
        : `3. En la información disponible no se identifica fecha de resolución sancionatoria, por lo que este aspecto debe verificarse en el expediente.`,
    record.fechaNotificacion ? `4. Se identifica como fecha de notificación ${record.fechaNotificacion}.` : `4. El Estado de Cuenta no acredita por sí solo la fecha, modalidad y efectividad de las notificaciones.`,
    record.fechaMandamientoPago ? `5. Se reporta como fecha de mandamiento de pago ${record.fechaMandamientoPago}; deben verificarse su notificación y las actuaciones posteriores.` : `5. No se identifica en el Estado de Cuenta una fecha acreditada de mandamiento de pago; deberá establecerse si existe actuación de cobro coactivo.`,
  ].join("\n");

  const fundamentos = `La actuación se somete a revisión para determinar la procedencia de ${primary}. La valoración se realiza con base en la información disponible y no sustituye la revisión del expediente administrativo. Cuando el registro ya evidencia una multa o sanción, no se formula caducidad de la actuación contravencional como causal automática; se analizan, según corresponda, prescripción, ejecutoriedad, notificación, debido proceso y demás mecanismos jurídicos procedentes. No se afirma una causal como hecho cierto cuando falta evidencia indispensable para establecerla.`;

  const requests = [
    `1. PRIMERO: Se revise integralmente el expediente administrativo correspondiente al comparendo/actuación No. ${comparendo}, de fecha ${fecha}.`,
    `2. SEGUNDO: Se determine expresamente la procedencia de ${primary}, efectuando el cómputo de los términos con fundamento en las fechas y actuaciones acreditadas.`,
    "3. TERCERO: Se informe y acredite la fecha de la decisión sancionatoria, su ejecutoria y todas las actuaciones posteriores que incidan en la exigibilidad y cobro.",
    "4. CUARTO: Se remita copia íntegra del expediente y de las constancias de notificación, cobro coactivo y demás actuaciones necesarias para verificar la situación jurídica.",
    "5. QUINTO: Si se acredita la configuración de la causal correspondiente, se adopte la decisión administrativa procedente y se actualicen los registros que legalmente deban ser depurados.",
    "6. SEXTO: Se emita respuesta de fondo, clara, congruente y completa frente a cada solicitud.",
  ];
  if (assessment.routes.includes("FOTODETECCION")) requests.splice(4, 0, "Se aporte la evidencia de detección y la documentación técnica y administrativa que sustente la actuación y la atribución de responsabilidad, cuando corresponda.");
  return { hechos, solicitudConcreta: requests.join("\n"), fundamentos, assessment };
}
