import type { Procedure } from "../types";

export const procedures: Procedure[] = [
  {
    id: "derecho-peticion",
    slug: "derecho-de-peticion",
    title: "Derecho de petición",
    description:
      "Solicitud escrita dirigida a una entidad pública o privada para pedir información o reclamar derechos.",
    category: "Administrativo",
    estimatedTime: "15 minutos",
    available: true,
  },
  {
    id: "accion-de-tutela",
    slug: "accion-de-tutela",
    title: "Acción de tutela",
    description: "Protección inmediata de derechos constitucionales cuando están siendo vulnerados.",
    category: "Constitucional",
    estimatedTime: "30 minutos",
    available: false,
  },
  {
    id: "reclamacion-laboral",
    slug: "reclamacion-laboral",
    title: "Reclamación laboral",
    description: "Reclamo ante el empleador por incumplimientos laborales.",
    category: "Laboral",
    estimatedTime: "20 minutos",
    available: true,
  },
  {
    id: "contrato-arrendamiento",
    slug: "contrato-de-arrendamiento",
    title: "Contrato de arrendamiento",
    description: "Contrato para formalizar el arrendamiento de un inmueble o local comercial.",
    category: "Civil",
    estimatedTime: "25 minutos",
    available: true,
  },
];
