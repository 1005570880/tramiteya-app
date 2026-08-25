export type ProcedurePricing = {
  price: number;
  currency: 'COP';
};

export const DEFAULT_PROCEDURE_PRICING: ProcedurePricing = { price: 49900, currency: 'COP' };

/**
 * Precio vigente de venta por trámite.
 * El checkout consulta este catálogo en servidor y nunca confía
 * en un monto enviado por el navegador.
 */
export const PRICING_CATALOG: Record<string, ProcedurePricing> = {
  'derecho-peticion-simple': { price: 49900, currency: 'COP' },
  'derecho-peticion-entidad': { price: 69900, currency: 'COP' },
  'eliminacion-comparendo': { price: 79900, currency: 'COP' },
  'eliminacion-reporte-negativo': { price: 79900, currency: 'COP' },
  'reclamacion-administrativa': { price: 79900, currency: 'COP' },
  'recurso-administrativo': { price: 89900, currency: 'COP' },
  'tutela-derecho-peticion': { price: 89900, currency: 'COP' },
  'tutela-salud-vital-proceso': { price: 99900, currency: 'COP' },
  'contrato-arrendamiento-comercial': { price: 129900, currency: 'COP' },
  'derecho-peticion': { price: 49900, currency: 'COP' },
  'derecho-eliminar-multa': { price: 79900, currency: 'COP' },
  'derecho-eliminar-comparendo': { price: 79900, currency: 'COP' },
  'prescripcion-comparendo': { price: 79900, currency: 'COP' },
  'caducidad-comparendo': { price: 79900, currency: 'COP' },
  'revocatoria-comparendo': { price: 79900, currency: 'COP' },
  'solicitud-soportes-comparendo': { price: 79900, currency: 'COP' },
  'fotomultas': { price: 79900, currency: 'COP' },
  'impugnacion-comparendos': { price: 79900, currency: 'COP' },
  'accion-de-tutela': { price: 89900, currency: 'COP' },
  'reclamacion-laboral': { price: 79900, currency: 'COP' },
  'contrato-arrendamiento': { price: 129900, currency: 'COP' },
  'poder-especial': { price: 49900, currency: 'COP' },
};

export function getProcedurePrice(procedureId: string): ProcedurePricing {
  return PRICING_CATALOG[procedureId] ?? DEFAULT_PROCEDURE_PRICING;
}
