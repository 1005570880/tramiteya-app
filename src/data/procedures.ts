import type { Procedure } from "../types";

export const procedures: Procedure[] = [
  { id: "derecho-peticion", slug: "derecho-de-peticion", title: "Derecho de petición", description: "Solicitud escrita dirigida a una entidad pública o privada para pedir información o reclamar derechos.", category: "Administrativo", estimatedTime: "15 minutos", available: true },
  { id: "accion-de-tutela", slug: "accion-de-tutela", title: "Acción de tutela", description: "Protección inmediata de derechos fundamentales vulnerados o amenazados.", category: "Constitucional", estimatedTime: "30 minutos", available: true },
  { id: "reclamacion-laboral", slug: "reclamacion-laboral", title: "Reclamación laboral", description: "Reclamo formal frente a incumplimientos de obligaciones laborales.", category: "Laboral", estimatedTime: "20 minutos", available: true },
  { id: "contrato-arrendamiento", slug: "contrato-de-arrendamiento", title: "Contrato de arrendamiento comercial", description: "Contrato para formalizar el arrendamiento de un inmueble destinado a actividad comercial.", category: "Civil / Comercial", estimatedTime: "25 minutos", available: true },
  { id: "impugnacion-comparendos", slug: "impugnacion-comparendos", title: "Impugnación de comparendos", description: "Documento para controvertir un comparendo y solicitar archivo o exoneración con fundamento en los hechos y causales aplicables.", category: "Tránsito", estimatedTime: "20 minutos", available: true },
  { id: "poder-especial", slug: "poder-especial", title: "Poder especial", description: "Otorgamiento de facultades específicas a un apoderado para actuar en un asunto determinado.", category: "Procesal", estimatedTime: "10 minutos", available: true },
];
