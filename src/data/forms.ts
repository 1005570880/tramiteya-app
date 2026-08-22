import type { FormStep } from "../types/form";

export const petitionForm: FormStep[] = [
  {
    id: "personal",
    title: "Información del solicitante",
    description: "Datos básicos del solicitante",
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
    description: "Datos de la entidad o persona a quien va dirigida la petición",
    fields: [
      { id: "entidad", label: "Entidad o persona", type: "text", required: true },
      { id: "cargo", label: "Cargo (si lo conoce)", type: "text" },
      { id: "ciudad", label: "Ciudad", type: "text" },
      { id: "correo_dest", label: "Correo del destinatario (si lo conoce)", type: "email" },
    ],
  },
  {
    id: "peticion",
    title: "Petición",
    description: "Explique su solicitud en términos sencillos",
    fields: [
      { id: "asunto", label: "Asunto", type: "text", required: true },
      { id: "hechos", label: "Describa los hechos", type: "textarea", required: true },
      { id: "solicitud", label: "Solicitud concreta", type: "textarea", required: true },
    ],
  },
  {
    id: "otros",
    title: "Información adicional",
    description: "Anexos y detalles",
    fields: [
      { id: "anexos", label: "Anexos (describa)", type: "textarea" },
      { id: "fecha", label: "Fecha", type: "date" },
    ],
  },
];
