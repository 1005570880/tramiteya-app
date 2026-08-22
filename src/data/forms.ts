import type { FormStep } from "../types/form";

export type FormDefinition = { procedureSlug: string; title: string; steps: FormStep[] };

export const petitionForm: FormStep[] = [
  { id: "personal", title: "Información del solicitante", fields: [
    { id: "nombres", label: "Nombres", type: "text", required: true }, { id: "apellidos", label: "Apellidos", type: "text", required: true },
    { id: "documento", label: "Documento de identidad", type: "text", required: true }, { id: "correo", label: "Correo electrónico", type: "email", required: true },
    { id: "telefono", label: "Teléfono", type: "phone" }, { id: "direccion", label: "Dirección", type: "text" },
  ]},
  { id: "destinatario", title: "Destinatario", fields: [
    { id: "entidad", label: "Entidad o persona", type: "text", required: true }, { id: "cargo", label: "Cargo", type: "text" },
    { id: "ciudad", label: "Ciudad", type: "text" }, { id: "correo_dest", label: "Correo del destinatario", type: "email" },
  ]},
  { id: "peticion", title: "Petición", fields: [
    { id: "asunto", label: "Asunto", type: "text", required: true }, { id: "hechos", label: "Describa los hechos", type: "textarea", required: true },
    { id: "solicitud", label: "Solicitud concreta", type: "textarea", required: true },
  ]},
  { id: "otros", title: "Información adicional", fields: [{ id: "anexos", label: "Anexos", type: "textarea" }, { id: "fecha", label: "Fecha", type: "date" }] },
];

export const commercialLeaseForm: FormStep[] = [
  { id: "partes", title: "Partes y representación", fields: [
    { id: "arrendador", label: "Arrendador / razón social", type: "text", required: true }, { id: "arrendador_documento", label: "NIT o documento del arrendador", type: "text", required: true },
    { id: "arrendador_es_persona_juridica", label: "¿El arrendador es persona jurídica?", type: "radio", options: [{ label: "Sí", value: "si" }, { label: "No", value: "no" }] },
    { id: "representante_legal", label: "Representante legal", type: "text", condition: { questionId: "arrendador_es_persona_juridica", operator: "equals", value: "si" } },
    { id: "arrendatario", label: "Arrendatario / razón social", type: "text", required: true }, { id: "arrendatario_documento", label: "NIT o documento del arrendatario", type: "text", required: true },
    { id: "arrendatario_representante", label: "Representante legal del arrendatario", type: "text" },
  ]},
  { id: "inmueble", title: "Inmueble y canon", fields: [
    { id: "inmueble_direccion", label: "Dirección del inmueble", type: "text", required: true }, { id: "inmueble_matricula", label: "Matrícula inmobiliaria", type: "text" },
    { id: "destinacion_comercial", label: "Actividad / destinación comercial", type: "text", required: true }, { id: "canon", label: "Canon mensual (COP)", type: "text", required: true },
    { id: "incremento", label: "Regla de incremento", type: "text" }, { id: "plazo", label: "Plazo", type: "text", required: true }, { id: "fecha_inicio", label: "Fecha de inicio", type: "date", required: true },
  ]},
  { id: "garantias", title: "Garantías y codeudor", fields: [
    { id: "tiene_codeudor", label: "¿Existe codeudor?", type: "radio", options: [{ label: "Sí", value: "si" }, { label: "No", value: "no" }] },
    { id: "codeudor", label: "Nombre del codeudor", type: "text", condition: { questionId: "tiene_codeudor", operator: "equals", value: "si" } },
    { id: "codeudor_documento", label: "Documento del codeudor", type: "text", condition: { questionId: "tiene_codeudor", operator: "equals", value: "si" } },
    { id: "garantia", label: "Garantía / depósito / póliza", type: "textarea" },
  ]},
  { id: "clausulas", title: "Cláusulas condicionales", fields: [
    { id: "servicios", label: "Servicios públicos y gastos", type: "textarea" }, { id: "subarriendo", label: "Condiciones sobre subarriendo", type: "textarea" }, { id: "clausulas_especiales", label: "Cláusulas adicionales", type: "textarea" },
  ]},
];

export const tutelaForm: FormStep[] = [
  { id: "partes", title: "Accionante y accionado", fields: [
    { id: "accionante", label: "Nombre completo del accionante", type: "text", required: true }, { id: "accionante_documento", label: "Documento del accionante", type: "text", required: true },
    { id: "accionado", label: "Entidad o persona accionada", type: "text", required: true }, { id: "accionado_direccion", label: "Dirección / correo del accionado", type: "text" },
  ]},
  { id: "derechos", title: "Derechos fundamentales y hechos", fields: [
    { id: "derechos_vulnerados", label: "Derechos fundamentales vulnerados", type: "textarea", required: true, placeholder: "Ej. vida digna, salud, debido proceso" },
    { id: "hechos", label: "Hechos", type: "textarea", required: true },
  ]},
  { id: "pretensiones", title: "Pretensiones y medida cautelar", fields: [
    { id: "pretensiones", label: "Pretensiones", type: "textarea", required: true },
    { id: "medida_cautelar", label: "¿Solicita medida provisional?", type: "radio", options: [{ label: "Sí", value: "si" }, { label: "No", value: "no" }] },
    { id: "medida_cautelar_detalle", label: "Explique la medida solicitada", type: "textarea", condition: { questionId: "medida_cautelar", operator: "equals", value: "si" } },
  ]},
];

export const comparendoImpugnationForm: FormStep[] = [
  { id: "infractor", title: "Datos del infractor", fields: [
    { id: "infractor_nombre", label: "Nombre completo", type: "text", required: true }, { id: "infractor_documento", label: "Documento", type: "text", required: true },
    { id: "infractor_direccion", label: "Dirección", type: "text" }, { id: "infractor_correo", label: "Correo electrónico", type: "email" },
  ]},
  { id: "comparendo", title: "Comparendo", fields: [
    { id: "numero_comparendo", label: "Número de comparendo", type: "text", required: true }, { id: "fecha_comparendo", label: "Fecha del comparendo", type: "date", required: true },
    { id: "autoridad", label: "Autoridad de tránsito", type: "text", required: true }, { id: "placa", label: "Placa del vehículo", type: "text" },
  ]},
  { id: "fundamento", title: "Fundamento y solicitud", fields: [
    { id: "causal", label: "Causal de prescripción / caducidad", type: "textarea", required: true }, { id: "hechos", label: "Hechos y explicación", type: "textarea", required: true },
    { id: "solicitud_exoneracion", label: "Solicitud de exoneración / archivo", type: "textarea", required: true },
  ]},
];

export const specialPowerForm: FormStep[] = [
  { id: "poderdante", title: "Poderdante", fields: [
    { id: "poderdante_nombre", label: "Nombre / razón social", type: "text", required: true }, { id: "poderdante_documento", label: "Documento / NIT", type: "text", required: true }, { id: "poderdante_direccion", label: "Dirección", type: "text" },
  ]},
  { id: "apoderado", title: "Apoderado", fields: [
    { id: "apoderado_nombre", label: "Nombre completo del abogado", type: "text", required: true }, { id: "apoderado_documento", label: "Documento del abogado", type: "text", required: true }, { id: "apoderado_tarjeta", label: "Tarjeta profesional", type: "text", required: true },
  ]},
  { id: "facultades", title: "Facultades específicas", fields: [
    { id: "facultades_especificas", label: "Facultades específicas conferidas", type: "textarea", required: true }, { id: "proceso", label: "Proceso / asunto", type: "textarea", required: true },
    { id: "facultad_sustituir", label: "¿Puede sustituir el poder?", type: "radio", options: [{ label: "Sí", value: "si" }, { label: "No", value: "no" }] },
    { id: "facultad_recibir", label: "¿Puede recibir notificaciones?", type: "radio", options: [{ label: "Sí", value: "si" }, { label: "No", value: "no" }] },
  ]},
];

export const formDefinitions: Record<string, FormDefinition> = {
  "derecho-de-peticion": { procedureSlug: "derecho-de-peticion", title: "Derecho de petición", steps: petitionForm },
  "contrato-de-arrendamiento": { procedureSlug: "contrato-de-arrendamiento", title: "Contrato de arrendamiento comercial", steps: commercialLeaseForm },
  "accion-de-tutela": { procedureSlug: "accion-de-tutela", title: "Acción de tutela", steps: tutelaForm },
  "impugnacion-comparendos": { procedureSlug: "impugnacion-comparendos", title: "Impugnación de comparendos", steps: comparendoImpugnationForm },
  "poder-especial": { procedureSlug: "poder-especial", title: "Poder especial", steps: specialPowerForm },
};

export function getFormDefinition(slug: string): FormDefinition | undefined { return formDefinitions[slug]; }
