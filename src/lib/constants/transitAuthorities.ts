export interface TransitAuthority {
  municipio: string;
  departamento: string;
  nombreOficial: string;
  keywords: string[];
}

function normalize(value: string): string {
  return value
    .replace(/\d{2}:\d{2}:\d{2}/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function findMatchingAuthority(rawText: string): string | undefined {
  if (!rawText) return undefined;

  const cleanText = normalize(rawText);

  // Prefer municipality-specific matches. Department-only keywords are
  // intentionally avoided because they are ambiguous across authorities.
  const candidates = [...TRANSIT_AUTHORITIES].sort(
    (a, b) => Math.max(...b.keywords.map((k) => normalize(k).length)) - Math.max(...a.keywords.map((k) => normalize(k).length)),
  );

  for (const auth of candidates) {
    for (const kw of auth.keywords) {
      const cleanKw = normalize(kw);
      if (cleanKw && cleanText.includes(cleanKw)) {
        return auth.nombreOficial;
      }
    }
  }

  return undefined;
}

/**
 * Master catalogue currently seeded from the authorities relevant to the
 * SIMIT layouts handled by TrámiteYa. Additional verified authorities can be
 * appended without changing the parser contract.
 */
export const TRANSIT_AUTHORITIES: TransitAuthority[] = [
  { municipio: 'Sibaté', departamento: 'Cundinamarca', nombreOficial: 'Secretaría De Transporte Y Movilidad De Cundinamarca Sede Sibaté', keywords: ['sibaté'] },
  { municipio: 'Bogotá', departamento: 'Cundinamarca', nombreOficial: 'Secretaria Distrital De Bogotá - Consorcio Sim', keywords: ['bogotá'] },
  { municipio: 'La Calera', departamento: 'Cundinamarca', nombreOficial: 'Secretaría De Transporte Y Movilidad De Cundinamarca Sede La Calera', keywords: ['la calera'] },
  { municipio: 'Chía', departamento: 'Cundinamarca', nombreOficial: 'Secretaría De Movilidad Municipal De Chía', keywords: ['chía'] },
  { municipio: 'Cajicá', departamento: 'Cundinamarca', nombreOficial: 'Secretaría Transporte Y Movilidad De Cundinamarca Sede Cajicá', keywords: ['cajicá'] },
  { municipio: 'Cota', departamento: 'Cundinamarca', nombreOficial: 'Secretaría De Transporte Y Movilidad De Cundinamarca Sede Cota', keywords: ['cota'] },
  { municipio: 'Facatativá', departamento: 'Cundinamarca', nombreOficial: 'Secretaría De Tránsito Municipal De Facatativá', keywords: ['facatativá'] },
  { municipio: 'Itagüí', departamento: 'Antioquia', nombreOficial: 'Secretaría De Transporte Y Tránsito De Itagüí', keywords: ['itagüí'] },
  { municipio: 'Medellín', departamento: 'Antioquia', nombreOficial: 'Secretaría De Tránsito Y Transporte De Medellín', keywords: ['medellín'] },
  { municipio: 'Envigado', departamento: 'Antioquia', nombreOficial: 'Secretaría De Movilidad Del Municipio De Envigado', keywords: ['envigado'] },
  { municipio: 'Sabaneta', departamento: 'Antioquia', nombreOficial: 'Secretaría De Tránsito Y Transporte De Sabaneta', keywords: ['sabaneta'] },
  { municipio: 'Bello', departamento: 'Antioquia', nombreOficial: 'Secretaría De Tránsito Y Transporte De Bello', keywords: ['bello'] },
  { municipio: 'Rionegro', departamento: 'Antioquia', nombreOficial: 'Subsecretaria De Movilidad Y Tránsito De Rionegro', keywords: ['rionegro'] },
  { municipio: 'Aracataca', departamento: 'Magdalena', nombreOficial: 'Secretaría De Tránsito Y Transporte Municipal De Aracataca', keywords: ['aracataca'] },
  { municipio: 'Fundación', departamento: 'Magdalena', nombreOficial: 'Secretaría De Tránsito Y Transporte Municipal De Fundación', keywords: ['fundación'] },
  { municipio: 'Valledupar', departamento: 'Cesar', nombreOficial: 'Secretaría De Tránsito Y Transporte Municipal De Valledupar', keywords: ['valledupar'] },
  { municipio: 'Agustín Codazzi', departamento: 'Cesar', nombreOficial: 'Secretaría De Tránsito Municipal De Agustín Codazzi', keywords: ['agustín codazzi', 'codazzi'] },
  { municipio: 'Departamental Cesar', departamento: 'Cesar', nombreOficial: 'Instituto Departamental De Tránsito Del Cesar - Idtracesar', keywords: ['idtracesar'] },
  { municipio: 'Sampués', departamento: 'Sucre', nombreOficial: 'Secretaría De Tránsito Y Transporte Dptal Sucre - Sampués', keywords: ['sampués', 'sampues'] },
];
