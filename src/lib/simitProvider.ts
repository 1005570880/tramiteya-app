export type SimitComparendo = {
  number?: string;
  date?: string;
  authority?: string;
  department?: string;
  infractionCode?: string;
  description?: string;
  status?: string;
  value?: number;
  resolutionNumber?: string;
  resolutionDate?: string;
};

export type SimitLookupResult = {
  provider: 'verifik' | 'placapi' | 'coresoft';
  source: 'SIMIT';
  documentType: string;
  documentNumber: string;
  found: boolean;
  totalDebt?: number;
  pendingCount?: number;
  comparendos: SimitComparendo[];
  raw?: unknown;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta configurar ${name} en las variables de entorno del servidor.`);
  return value;
}

export async function lookupSimitByDocument(documentType: string, documentNumber: string): Promise<SimitLookupResult> {
  const normalizedNumber = documentNumber.replace(/[^0-9A-Za-z]/g, '');
  if (!normalizedNumber) throw new Error('El número de documento es obligatorio.');

  const provider = (process.env.SIMIT_PROVIDER || 'verifik').toLowerCase();

  if (provider === 'verifik') {
    const token = requiredEnv('VERIFIK_API_TOKEN');
    const response = await fetch(
      `https://api.verifik.co/v2/co/simit/consultar?documentType=${encodeURIComponent(documentType)}&documentNumber=${encodeURIComponent(normalizedNumber)}`,
      { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, cache: 'no-store' },
    );
    if (!response.ok) throw new Error(`Proveedor SIMIT respondió ${response.status}.`);
    const raw = await response.json();
    return normalizeProviderResult('verifik', documentType, normalizedNumber, raw);
  }

  if (provider === 'placapi') {
    const token = requiredEnv('PLACAPI_API_KEY');
    const response = await fetch('https://placapi.com/api/comparendos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': token },
      body: JSON.stringify({ docType: documentType, docNumber: normalizedNumber }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Proveedor SIMIT respondió ${response.status}.`);
    const raw = await response.json();
    return normalizeProviderResult('placapi', documentType, normalizedNumber, raw);
  }

  if (provider === 'coresoft') {
    const token = requiredEnv('CORESOFT_API_KEY');
    const response = await fetch(`https://api.coresoft.co/v1/infracciones?documento=${encodeURIComponent(normalizedNumber)}`, {
      headers: { Accept: 'application/json', 'X-API-Key': token },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Proveedor SIMIT respondió ${response.status}.`);
    const raw = await response.json();
    return normalizeProviderResult('coresoft', documentType, normalizedNumber, raw);
  }

  throw new Error(`SIMIT_PROVIDER no soportado: ${provider}. Usa verifik, placapi o coresoft.`);
}

function unwrapVerifik(raw: any): any {
  return raw?.value?.value?.data ?? raw?.value?.data ?? raw?.data ?? raw?.resultado ?? raw?.result ?? raw;
}

function normalizeProviderResult(
  provider: SimitLookupResult['provider'],
  documentType: string,
  documentNumber: string,
  raw: any,
): SimitLookupResult {
  const data = provider === 'verifik' ? unwrapVerifik(raw) : (raw?.data ?? raw?.resultado ?? raw?.result ?? raw);
  const items = data?.comparendos ?? data?.multas ?? data?.infracciones ?? [];
  const comparendos: SimitComparendo[] = Array.isArray(items)
    ? items.map((item: any) => {
        const firstInfraction = Array.isArray(item?.infracciones) ? item.infracciones[0] : null;
        return {
          number: item?.numeroComparendo ?? item?.NúmeroComparendo ?? item?.numero ?? item?.number ?? item?.comparendo,
          date: item?.fecha ?? item?.fechaComparendo ?? item?.date,
          authority: item?.organismoTransito ?? item?.organismo ?? item?.secretaria ?? item?.autoridad,
          department: item?.departamento,
          infractionCode: item?.codigo ?? item?.infraccion ?? item?.codigoInfraccion ?? firstInfraction?.codigoInfraccion,
          description: item?.descripcion ?? item?.descripcionInfraccion ?? firstInfraction?.descripcionInfraccion,
          status: item?.estadoComparendo ?? item?.estado ?? item?.status,
          value: Number(item?.valorPagar ?? item?.valor ?? item?.valorMulta ?? item?.monto ?? firstInfraction?.valorInfraccion ?? 0) || undefined,
          resolutionNumber: item?.numeroResolucion ?? item?.resolucion,
          resolutionDate: item?.fechaResolucion,
        };
      })
    : [];

  const totalDebt = Number(data?.total_deuda ?? data?.totalDeuda ?? data?.total_pendiente ?? data?.totalMultasPagar ?? data?.total ?? 0) || undefined;
  const pendingCount = Number(data?.multas_pendientes ?? data?.cantMultasPagar ?? data?.pendingCount ?? comparendos.length) || 0;

  return {
    provider,
    source: 'SIMIT',
    documentType,
    documentNumber,
    found: comparendos.length > 0 || Boolean(data?.tiene_deuda) || pendingCount > 0,
    totalDebt,
    pendingCount,
    comparendos,
    raw,
  };
}
