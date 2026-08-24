import type { FormStep } from "../types/form";

/**
 * Adaptive intake for Derecho de Petición.
 * The form asks the minimum common data first and branches according to the
 * factual/legal situation. LegalQualityGate remains authoritative server-side.
 */
export const petitionAdaptiveForm: FormStep[] = [
  {
    id: "personal",
    title: "Información del solicitante",
    fields: [
      { id: "nombres", label: "Nombres", type: "text", required: true },
      { id: "apellidos", label: "Apellidos", type: "text", required: true },
      { id: "documento", label: "Documento de identidad", type: "text", required: true },
      { id: "correo", label: "Correo electrónico", type: "email", required: true },
      { id: "telefono", label: "Teléfono", type: "phone" },
      { id: "direccion", label: "Dirección", type: "text" },
    ],
  },
  {
    id: "destinatario",
    title: "Destinatario",
    fields: [
      { id: "entidad", label: "Entidad o persona a quien se dirige", type: "text", required: true },
      { id: "cargo", label: "Cargo o dependencia", type: "text" },
      { id: "ciudad", label: "Ciudad", type: "text" },
      { id: "correo_dest", label: "Correo del destinatario", type: "email" },
    ],
  },
  {
    id: "ruta",
    title: "Identificación de la situación",
    description: "Estas respuestas determinan las preguntas jurídicas que TrámiteYa debe realizar.",
    fields: [
      {
        id: "tipo_peticion",
        label: "¿Qué necesitas principalmente?",
        type: "radio",
        required: true,
        options: [
          { label: "Presentar una petición nueva", value: "nueva" },
          { label: "Solicitar información", value: "informacion" },
          { label: "Solicitar documentos", value: "documentos" },
          { label: "Solicitar el reconocimiento o protección de un derecho", value: "derecho" },
          { label: "Reclamar o inconformarme frente a una actuación", value: "reclamacion" },
          { label: "Ya presenté una petición y no me respondieron", value: "sin_respuesta" },
          { label: "Me respondieron, pero la respuesta fue incompleta o evasiva", value: "respuesta_deficiente" },
        ],
      },
      {
        id: "tiene_peticion_anterior",
        label: "¿Existe una petición anterior relacionada con este caso?",
        type: "radio",
        required: true,
        options: [{ label: "Sí", value: "si" }, { label: "No", value: "no" }],
      },
    ],
  },
  {
    id: "peticion_anterior",
    title: "Petición anterior",
    fields: [
      { id: "fecha_peticion_anterior", label: "Fecha de presentación de la petición anterior", type: "date", condition: { questionId: "tiene_peticion_anterior", operator: "equals", value: "si" } },
      { id: "radicado_peticion_anterior", label: "Número de radicado", type: "text", condition: { questionId: "tiene_peticion_anterior", operator: "equals", value: "si" } },
      { id: "medio_peticion_anterior", label: "Medio de presentación", type: "select", options: [{ label: "Portal / formulario web", value: "web" }, { label: "Correo electrónico", value: "correo" }, { label: "Presencial", value: "presencial" }, { label: "Correo físico", value: "fisico" }, { label: "Otro", value: "otro" }], condition: { questionId: "tiene_peticion_anterior", operator: "equals", value: "si" } },
      { id: "fecha_respuesta", label: "Fecha de respuesta, si la hubo", type: "date", condition: { questionId: "tiene_peticion_anterior", operator: "equals", value: "si" } },
      { id: "hubo_respuesta", label: "¿Recibiste respuesta?", type: "radio", options: [{ label: "Sí", value: "si" }, { label: "No", value: "no" }], condition: { questionId: "tiene_peticion_anterior", operator: "equals", value: "si" } },
      { id: "respuesta_contenido", label: "¿Qué respondió la entidad?", type: "textarea", placeholder: "Resume o transcribe los puntos relevantes de la respuesta.", condition: { questionId: "hubo_respuesta", operator: "equals", value: "si" } },
      { id: "puntos_sin_resolver", label: "¿Qué puntos quedaron sin resolver o fueron respondidos de forma insuficiente?", type: "textarea", condition: { questionId: "hubo_respuesta", operator: "equals", value: "si" } },
    ],
  },
  {
    id: "objeto",
    title: "Objeto y hechos",
    fields: [
      { id: "asunto", label: "Asunto", type: "text", required: true, placeholder: "Resume en una frase concreta qué solicitas." },
      { id: "hechos", label: "Relato de los hechos", type: "textarea", required: true, placeholder: "Describe qué ocurrió, en orden cronológico, indicando fechas, actuaciones de la entidad y cualquier dato verificable." },
      { id: "solicitud", label: "Solicitud concreta", type: "textarea", required: true, placeholder: "Indica exactamente qué quieres que haga, informe, entregue, reconozca o corrija la entidad." },
    ],
  },
  {
    id: "documentos",
    title: "Solicitud de documentos o información",
    fields: [
      { id: "documentos_solicitados", label: "¿Qué documentos o información solicitas exactamente?", type: "textarea", condition: { questionId: "tipo_peticion", operator: "contains", value: "documentos" } },
      { id: "periodo_documentos", label: "Período al que corresponden", type: "text", condition: { questionId: "tipo_peticion", operator: "contains", value: "documentos" } },
      { id: "relacion_documentos", label: "Relación de los documentos con tu caso", type: "textarea", condition: { questionId: "tipo_peticion", operator: "contains", value: "documentos" } },
    ],
  },
  {
    id: "urgencia",
    title: "Circunstancias especiales",
    fields: [
      { id: "hay_urgencia", label: "¿Existe una situación que requiera atención inmediata?", type: "radio", required: true, options: [{ label: "Sí", value: "si" }, { label: "No", value: "no" }] },
      { id: "urgencia_detalle", label: "Explica la urgencia y el riesgo actual", type: "textarea", condition: { questionId: "hay_urgencia", operator: "equals", value: "si" } },
    ],
  },
  {
    id: "soportes",
    title: "Soportes y cierre",
    fields: [
      { id: "anexos", label: "Relación de documentos que anexarás", type: "textarea", placeholder: "Ej. copia de la petición anterior, radicado, respuesta de la entidad, facturas, órdenes, fotografías." },
      { id: "fecha", label: "Fecha del documento", type: "date" },
    ],
  },
];
