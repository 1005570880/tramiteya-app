export type ProcedureModule = {
  slug: string;
  vertical: 'tutelas' | 'peticiones' | 'transito' | 'habeas-data' | 'contratos';
  title: string;
  description: string;
  engine: 'fundamental-rights' | 'traffic' | 'habeas-data' | 'contract';
};

export const PROCEDURE_MODULES: ProcedureModule[] = [
  { slug: 'tutela', vertical: 'tutelas', title: 'Acción de tutela', description: 'Protección inmediata de derechos fundamentales.', engine: 'fundamental-rights' },
  { slug: 'derecho-peticion', vertical: 'peticiones', title: 'Derecho de petición', description: 'Solicitud de respuesta, información o actuación.', engine: 'fundamental-rights' },
  { slug: 'prescripcion-comparendo', vertical: 'transito', title: 'Prescripción de comparendos', description: 'Análisis y solicitud administrativa de prescripción.', engine: 'traffic' },
  { slug: 'habeas-data-reporte', vertical: 'habeas-data', title: 'Hábeas data / reporte crediticio', description: 'Rectificación, actualización o eliminación de información.', engine: 'habeas-data' },
  { slug: 'contrato', vertical: 'contratos', title: 'Generación de contrato', description: 'Construcción de contratos a partir de variables y cláusulas.', engine: 'contract' },
];

export function getProcedureModule(slug: string) {
  return PROCEDURE_MODULES.find((module) => module.slug === slug) ?? null;
}
