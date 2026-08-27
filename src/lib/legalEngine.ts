export interface SelectedRecordData {
  comparendo: string;
  fecha: string;
  organismo: string;
  estado: string;
  valor: string;
  placa?: string;
  cedula?: string;
  fechaResolucion?: string;
  fechaNotificacion?: string;
  fechaMandamientoPago?: string;
  huboAudiencia?: boolean | string;
  existeResolucion?: boolean | string;
}

export type LegalRoute =
  | "CADUCIDAD"
  | "PRESCRIPCION"
  | "PERDIDA_EJECUTORIEDAD"
  | "NOTIFICACION"
  | "DEBIDO_PROCESO"
  | "REVOCATORIA_DIRECTA";

export interface LegalAssessment {
  routes: LegalRoute[];
  primaryRoute: LegalRoute | null;
  priority: "alta" | "media" | "baja";
  missingEvidence: string[];
  reasoning: string[];
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
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? normalized
    : normalized.split("/").reverse().join("-");
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function yearsSince(value?: string) {
  const date = parseDate(value);
  if (!date) return null;
  return (Date.now() - date.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
}

function truthy(value: unknown) {
  return value === true || String(value ?? "").toLowerCase() === "si";
}

export function assessTrafficRecord(record: SelectedRecordData): LegalAssessment {
  const routes: LegalRoute[] = [];
  const missingEvidence: string[] = [];
  const reasoning: string[] = [];
  const age = yearsSince(record.fecha);
  const mandAge = yearsSince(record.fechaMandamientoPago);
  const hasResolution = truthy(record.existeResolucion) || Boolean(record.fechaResolucion);
  const hasHearing = truthy(record.huboAudiencia);

  if (age !== null && age >= 1 && !hasResolution && !hasHearing) {
    routes.push("CADUCIDAD");
    reasoning.push("La fecha del hecho supera un año y el Estado de Cuenta no acredita por sí mismo audiencia o decisión sancionatoria.");
    missingEvidence.push("Acta o constancia de audiencia", "Resolución sancionatoria y constancia de ejecutoria");
  } else if (age !== null && age >= 1) {
    routes.push("CADUCIDAD");
    reasoning.push("Por la antigüedad del hecho debe verificarse el trámite contravencional y el término aplicable, sin presumir la caducidad.");
    missingEvidence.push("Acta de audiencia", "Resolución sancionatoria", "Constancia de ejecutoria");
  }

  if (age !== null && age >= 3) {
    routes.push("PRESCRIPCION");
    reasoning.push("La antigüedad del hecho hace necesario verificar el término de prescripción y las actuaciones que pudieron interrumpirlo.");
    if (!record.fechaMandamientoPago) {
      missingEvidence.push("Mandamiento de pago y constancia de notificación, si existe");
    } else {
      reasoning.push("Existe una fecha de mandamiento de pago; debe verificarse su notificación y los efectos sobre el término.");
    }
  }

  if (mandAge !== null && mandAge >= 5) {
    routes.push("PERDIDA_EJECUTORIEDAD");
    reasoning.push("Han transcurrido al menos cinco años desde la fecha reportada del mandamiento de pago; debe verificarse la firmeza del acto y si la autoridad realizó actuaciones de ejecución dentro del término relevante.");
    missingEvidence.push("Constancia de ejecutoria del acto", "Historial completo de actuaciones de cobro posteriores al mandamiento");
  }

  if (!record.fechaNotificacion) {
    routes.push("NOTIFICACION");
    missingEvidence.push("Constancias completas de notificación de la actuación y de la resolución, si existe");
    reasoning.push("El Estado de Cuenta no acredita por sí solo la notificación efectiva ni su trazabilidad.");
  }

  routes.push("DEBIDO_PROCESO");
  if (!hasResolution || !hasHearing) {
    missingEvidence.push("Expediente administrativo íntegro");
  }
  routes.push("REVOCATORIA_DIRECTA");

  const uniqueRoutes = Array.from(new Set(routes));
  const primaryRoute = uniqueRoutes.includes("PERDIDA_EJECUTORIEDAD")
    ? "PERDIDA_EJECUTORIEDAD"
    : uniqueRoutes.includes("PRESCRIPCION")
      ? "PRESCRIPCION"
      : uniqueRoutes.includes("CADUCIDAD")
        ? "CADUCIDAD"
        : "NOTIFICACION";

  return {
    routes: uniqueRoutes,
    primaryRoute,
    priority: uniqueRoutes.includes("PERDIDA_EJECUTORIEDAD") || uniqueRoutes.includes("PRESCRIPCION") ? "alta" : uniqueRoutes.includes("CADUCIDAD") ? "media" : "baja",
    missingEvidence: Array.from(new Set(missingEvidence)),
    reasoning: Array.from(new Set(reasoning)),
  };
}

function routeName(route: LegalRoute | null) {
  switch (route) {
    case "CADUCIDAD": return "caducidad de la actuación contravencional";
    case "PRESCRIPCION": return "prescripción de la obligación/sanción, según corresponda";
    case "PERDIDA_EJECUTORIEDAD": return "pérdida de fuerza ejecutoria del acto administrativo, si se configuran sus presupuestos";
    case "NOTIFICACION": return "irregularidad o ausencia de notificación";
    case "REVOCATORIA_DIRECTA": return "revocatoria directa, si resulta jurídicamente procedente";
    default: return "la situación jurídica de la actuación";
  }
}

export function generateLegalDraft(record: SelectedRecordData): LegalDraft {
  const autoridad = record.organismo && record.organismo !== "—"
    ? record.organismo
    : "la Autoridad de Tránsito competente";
  const comparendo = record.comparendo || "no identificado";
  const fecha = record.fecha || "no identificada";
  const estado = record.estado || "no identificado";
  const valor = record.valor || "no reportado";
  const assessment = assessTrafficRecord(record);
  const primary = routeName(assessment.primaryRoute);
  const evidence = assessment.missingEvidence.map((item, i) => `${i + 1}. ${item}`).join("\n");

  const hechos = [
    `1. En el Estado de Cuenta del SIMIT se encuentra registrado a mi nombre el comparendo/orden de comparendo No. ${comparendo}, de fecha ${fecha}.`,
    `2. El registro aparece asociado a ${autoridad}, con estado "${estado}" y valor reportado de ${valor}.`,
    record.fechaResolucion ? `3. En la información disponible se identifica una fecha de resolución/acto de ${record.fechaResolucion}.` : `3. En la información disponible no se identifica una fecha de resolución sancionatoria, por lo que este aspecto debe ser verificado en el expediente.`,
    record.fechaNotificacion ? `4. En la información disponible se identifica como fecha de notificación ${record.fechaNotificacion}.` : `4. El Estado de Cuenta aportado no permite acreditar por sí solo la fecha, modalidad y efectividad de las notificaciones realizadas.`,
    record.fechaMandamientoPago ? `5. Se reporta como fecha de mandamiento de pago ${record.fechaMandamientoPago}, cuya notificación y actuaciones posteriores deben ser verificadas.` : `5. No se dispone en el Estado de Cuenta de una fecha acreditada de mandamiento de pago, por lo que deberá establecerse si existe actuación de cobro coactivo.`,
  ].join("\n");

  const fundamentos = [
    `La actuación se somete a revisión jurídica preliminar para determinar la procedencia de ${primary}.`,
    "La valoración se realiza con base en la información disponible en el Estado de Cuenta SIMIT y no sustituye la revisión del expediente administrativo.",
    "La verificación deberá comprender, según corresponda, los términos de caducidad y prescripción previstos en la Ley 769 de 2002, las reglas de notificación y debido proceso, y las reglas de ejecutoriedad de los actos administrativos previstas en la Ley 1437 de 2011.",
    "No se afirma la configuración de una causal cuando falta evidencia indispensable para establecerla.",
  ].join("\n\n");

  const solicitudConcreta = [
    `1. PRIMERO: Se revise integralmente el expediente administrativo correspondiente al comparendo/actuación No. ${comparendo}, de fecha ${fecha}.`,
    `2. SEGUNDO: Se determine expresamente la procedencia de ${primary}, efectuando el cómputo de los términos con fundamento en las fechas y actuaciones que obren en el expediente.`,
    "3. TERCERO: Se informe y acredite la fecha de la decisión sancionatoria, su ejecutoria y todas las actuaciones posteriores que incidan en la exigibilidad y cobro de la obligación.",
    "4. CUARTO: Si se acredita la configuración de la causal jurídica correspondiente, se adopte la decisión administrativa procedente y se actualice el registro en los sistemas que correspondan.",
    "5. QUINTO: Se remita copia íntegra del expediente y de las constancias de notificación, cobro coactivo y demás actuaciones necesarias para verificar la situación jurídica.",
    "6. SEXTO: Se emita respuesta de fondo, clara, congruente y completa frente a cada una de las solicitudes anteriores.",
  ].join("\n");

  return {
    hechos,
    solicitudConcreta,
    fundamentos,
    assessment,
  };
}
