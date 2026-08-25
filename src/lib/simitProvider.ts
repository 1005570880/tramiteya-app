export type SimitComparendo = {
  number?: string;
  date?: string;
  authority?: string;
  department?: string;
  plate?: string;
  ownerName?: string;
  infractionCode?: string;
  description?: string;
  status?: string;
  value?: number;
  resolutionNumber?: string;
  resolutionDate?: string;
  notificationDate?: string;
  paymentDate?: string;
};

export type SimitLookupResult = {
  provider: 'verifik' | 'placapi' | 'coresoft' | 'official-manual';
  source: 'SIMIT';
  documentType: string;
  documentNumber: string;
  found: boolean;
  verificationRequired?: boolean;
  officialUrl?: string;
  totalDebt?: number;
  pendingCount?: number;
  personName?: string;
  comparendos: SimitComparendo[];
  raw?: unknown;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta configurar ${name} en las variables de entorno del servidor.`);
  return value;
}

/**
 * The public SIMIT citizen portal is not an unauthenticated server-to-server API.
 * Automatic lookup therefore goes through an authorized provider. We never
 * scrape, invent or silently substitute traffic data when no provider is configured.
 */
export async function lookupSimitByDocument(documentType: string, documentNumber: string): Promise<SimitLookupResult> {
  const normalizedNumber = documentNumber.replace(/[^0-9A-Za-z]/g, '');
  if (!normalizedNumber) throw new Error('El número de documento es obligatorio.');

  const provider = (process.env.SIMIT_PROVIDER || '').toLowerCase();
  const officialUrl = 'https://www.fcm.org.co/simit/';

  if (!provider) {
    return { provider: 'official-manual', source: 'SIMIT', documentType, documentNumber: normalizedNumber, found: false, verificationRequired: true, officialUrl, comparendos: [] };
  }

  if (provider === 'verifik') {
    const token = requiredEnv('VERIFIK_API_TOKEN');
    const response = await fetch(`https://api.verifik.co/v2/co/simit/consultar?documentType=${encodeURIComponent(documentType)}&documentNumber=${encodeURIComponent(normalizedNumber)}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!response.ok) throw new Error(`Proveedor SIMIT respondió ${response.status}.`);
    return normalizeProviderResult('verifik', documentType, normalizedNumber, await response.json());
  }

  if (provider === 'placapi') {
    const token = requiredEnv('PLACAPI_API_KEY');
    const response = await fetch('https://placapi.com/api/comparendos', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': token }, body: JSON.stringify({ docType: documentType, docNumber: normalizedNumber }), cache: 'no-store' });
    if (!response.ok) throw new Error(`Proveedor SIMIT respondió ${response.status}.`);
    return normalizeProviderResult('placapi', documentType, normalizedNumber, await response.json());
  }

  if (provider === 'coresoft') {
    const token = requiredEnv('CORESOFT_API_KEY');
    const response = await fetch(`https://api.coresoft.co/v1/infracciones?documento=${encodeURIComponent(normalizedNumber)}`, { headers: { Accept: 'application/json', 'X-API-Key': token }, cache: 'no-store' });
    if (!response.ok) throw new Error(`Proveedor SIMIT respondió ${response.status}.`);
    return normalizeProviderResult('coresoft', documentType, normalizedNumber, await response.json());
  }

  throw new Error(`SIMIT_PROVIDER no soportado: ${provider}. Usa verifik, placapi o coresoft.`);
}

function unwrapVerifik(raw: any): any {
  return raw?.value?.value?.data ?? raw?.value?.data ?? raw?.data ?? raw?.resultado ?? raw?.result ?? raw;
}

function firstDefined(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
}

function normalizeProviderResult(provider: Exclude<SimitLookupResult['provider'], 'official-manual'>, documentType: string, documentNumber: string, raw: any): SimitLookupResult {
  const data = provider === 'verifik' ? unwrapVerifik(raw) : (raw?.data ?? raw?.resultado ?? raw?.result ?? raw);
  const items = data?.comparendos ?? data?.multas ?? data?.infracciones ?? data?.results ?? [];
  const personName = String(firstDefined(data?.nombreCompleto, data?.nombre, data?.nombres, data?.titular, data?.propietario, data?.persona?.nombreCompleto, data?.persona?.nombre) ?? '').trim() || undefined;

  const comparendos: SimitComparendo[] = Array.isArray(items) ? items.map((item: any) => {
    const firstInfraction = Array.isArray(item?.infracciones) ? item.infracciones[0] : null;
    return {
      number: String(firstDefined(item?.numeroComparendo, item?.NúmeroComparendo, item?.numero, item?.number, item?.comparendo) ?? '').trim() || undefined,
      date: String(firstDefined(item?.fecha, item?.fechaComparendo, item?.date) ?? '').trim() || undefined,
      authority: String(firstDefined(item?.organismoTransito, item?.organismo, item?.secretaria, item?.autoridad) ?? '').trim() || undefined,
      department: String(firstDefined(item?.departamento, item?.department) ?? '').trim() || undefined,
      plate: String(firstDefined(item?.placa, item?.Placa, item?.vehiclePlate, item?.vehiculo?.placa) ?? '').trim() || undefined,
      ownerName: String(firstDefined(item?.nombrePropietario, item?.propietario, item?.titular, item?.nombreCompleto, personName) ?? '').trim() || undefined,
      infractionCode: String(firstDefined(item?.codigo, item?.infraccion, item?.codigoInfraccion, firstInfraction?.codigoInfraccion) ?? '').trim() || undefined,
      description: String(firstDefined(item?.descripcion, item?.descripcionInfraccion, firstInfraction?.descripcionInfraccion) ?? '').trim() || undefined,
      status: String(firstDefined(item?.estadoComparendo, item?.estado, item?.status) ?? '').trim() || undefined,
      value: Number(firstDefined(item?.valorPagar, item?.valor, item?.valorMulta, item?.monto, firstInfraction?.valorInfraccion) ?? 0) || undefined,
      resolutionNumber: String(firstDefined(item?.numeroResolucion, item?.resolucion) ?? '').trim() || undefined,
      resolutionDate: String(firstDefined(item?.fechaResolucion) ?? '').trim() || undefined,
      notificationDate: String(firstDefined(item?.fechaNotificacion, item?.notificacion?.fecha) ?? '').trim() || undefined,
      paymentDate: String(firstDefined(item?.fechaPago, item?.pago?.fecha) ?? '').trim() || undefined,
    };
  }) : [];

  const totalDebt = Number(firstDefined(data?.total_deuda, data?.totalDeuda, data?.total_pendiente, data?.totalMultasPagar, data?.total) ?? 0) || undefined;
  const pendingCount = Number(firstDefined(data?.multas_pendientes, data?.cantMultasPagar, data?.pendingCount, comparendos.length) ?? 0) || 0;

  return { provider, source: 'SIMIT', documentType, documentNumber, found: comparendos.length > 0 || Boolean(data?.tiene_deuda) || pendingCount > 0, totalDebt, pendingCount, personName, comparendos, raw };
}
