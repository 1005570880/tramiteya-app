export type SimitRecordKind = 'multa' | 'comparendo';

export type SimitComparendo = {
  kind?: SimitRecordKind;
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
    const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };
    const query = `documentType=${encodeURIComponent(documentType)}&documentNumber=${encodeURIComponent(normalizedNumber)}`;

    const generalResponse = await fetch(`https://api.verifik.co/v2/co/simit/consultar?${query}`, { headers, cache: 'no-store' });
    if (!generalResponse.ok) throw new Error(`Proveedor SIMIT respondió ${generalResponse.status}.`);
    const generalRaw = await generalResponse.json();
    let result = normalizeProviderResult('verifik', documentType, normalizedNumber, generalRaw);

    if (result.comparendos.length === 0) {
      const listResponse = await fetch(`https://api.verifik.co/v2/co/simit/comparendos?${query}`, { headers, cache: 'no-store' });
      if (listResponse.ok) result = mergeResults(result, normalizeProviderResult('verifik', documentType, normalizedNumber, await listResponse.json()));
    }

    return result;
  }

  if (provider === 'placapi') {
    const token = requiredEnv('PLACAPI_API_KEY');
    const response = await fetch('https://placapi.com/api/comparendos', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': token },
      body: JSON.stringify({ docType: documentType, docNumber: normalizedNumber }), cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Proveedor SIMIT respondió ${response.status}.`);
    return normalizeProviderResult('placapi', documentType, normalizedNumber, await response.json());
  }

  if (provider === 'coresoft') {
    const token = requiredEnv('CORESOFT_API_KEY');
    const response = await fetch(`https://api.coresoft.co/v1/infracciones?documento=${encodeURIComponent(normalizedNumber)}`, {
      headers: { Accept: 'application/json', 'X-API-Key': token }, cache: 'no-store',
    });
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

function toArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

type RecordCollection = { kind: SimitRecordKind; items: any[] };

function findRecordCollection(raw: any): RecordCollection {
  const direct = unwrapVerifik(raw);
  const directCandidates: Array<[SimitRecordKind, any]> = [
    ['multa', direct?.multas],
    ['comparendo', direct?.comparendos],
    ['comparendo', direct?.infracciones],
    ['comparendo', direct?.results],
    ['comparendo', direct?.items],
  ];
  for (const [kind, candidate] of directCandidates) {
    const items = toArray(candidate);
    if (items.length) return { kind, items };
  }

  const visited = new Set<object>();
  function walk(value: any, depth: number): RecordCollection | null {
    if (!value || typeof value !== 'object' || depth > 8 || visited.has(value)) return null;
    visited.add(value);
    if (Array.isArray(value)) return value.length && value.some((item) => item && typeof item === 'object') ? { kind: 'comparendo', items: value } : null;

    if (toArray(value.multas).length) return { kind: 'multa', items: toArray(value.multas) };
    if (toArray(value.comparendos).length) return { kind: 'comparendo', items: toArray(value.comparendos) };
    if (toArray(value.infracciones).length) return { kind: 'comparendo', items: toArray(value.infracciones) };
    if (toArray(value.results).length) return { kind: 'comparendo', items: toArray(value.results) };
    if (toArray(value.items).length) return { kind: 'comparendo', items: toArray(value.items) };

    for (const child of Object.values(value)) {
      const found = walk(child, depth + 1);
      if (found) return found;
    }
    return null;
  }

  return walk(raw, 0) ?? { kind: 'comparendo', items: [] };
}

function normalizeProviderResult(provider: Exclude<SimitLookupResult['provider'], 'official-manual'>, documentType: string, documentNumber: string, raw: any): SimitLookupResult {
  const data = provider === 'verifik' ? unwrapVerifik(raw) : (raw?.data ?? raw?.resultado ?? raw?.result ?? raw);
  const collection = findRecordCollection(raw);
  const items = collection.items;
  const personName = String(firstDefined(
    data?.nombreCompleto, data?.nombre, data?.nombres, data?.titular, data?.propietario,
    data?.persona?.nombreCompleto, data?.persona?.nombre,
    items[0]?.infractor?.nombre ? `${items[0].infractor.nombre} ${items[0].infractor.apellido ?? ''}` : '',
  ) ?? '').trim() || undefined;

  const comparendos: SimitComparendo[] = items.map((item: any) => {
    const firstInfraction = Array.isArray(item?.infracciones) ? item.infracciones[0] : null;
    const kind = collection.kind;
    return {
      kind,
      number: String(firstDefined(item?.numeroComparendo, item?.NúmeroComparendo, item?.comparendoId, item?.numero, item?.number, item?.comparendo, item?.numeroMulta, item?.notificacion) ?? '').trim() || undefined,
      date: String(firstDefined(item?.fechaComparendo, item?.fecha, item?.date) ?? '').trim() || undefined,
      authority: String(firstDefined(item?.organismoTransito, item?.organismo, item?.secretaria, item?.autoridad) ?? '').trim() || undefined,
      department: String(firstDefined(item?.departamento, item?.department) ?? '').trim() || undefined,
      plate: String(firstDefined(item?.placa, item?.Placa, item?.placavehiculo, item?.vehiclePlate, item?.vehiculo?.placa) ?? '').trim() || undefined,
      ownerName: String(firstDefined(item?.nombrePropietario, item?.propietario, item?.titular, item?.nombreCompleto, item?.infractor?.nombre ? `${item.infractor.nombre} ${item.infractor.apellido ?? ''}` : '', personName) ?? '').trim() || undefined,
      infractionCode: String(firstDefined(item?.codigoInfraccion, item?.codigo, item?.infraccion, firstInfraction?.codigoInfraccion) ?? '').trim() || undefined,
      description: String(firstDefined(item?.descripcionInfraccion, item?.descripcion, firstInfraction?.descripcionInfraccion) ?? '').trim() || undefined,
      status: String(firstDefined(item?.estadoComparendo, item?.estado, item?.status) ?? '').trim() || undefined,
      value: Number(firstDefined(item?.valorPagar, item?.valor, item?.valorMulta, item?.monto, item?.total, firstInfraction?.valorInfraccion) ?? 0) || undefined,
      resolutionNumber: String(firstDefined(item?.numeroResolucion, item?.resolucion) ?? '').trim() || undefined,
      resolutionDate: String(firstDefined(item?.fechaResolucion) ?? '').trim() || undefined,
      notificationDate: String(firstDefined(item?.fechaNotificacion, item?.notificacion?.fecha) ?? '').trim() || undefined,
      paymentDate: String(firstDefined(item?.fechaPago, item?.pago?.fecha) ?? '').trim() || undefined,
    };
  });

  const totalDebt = Number(firstDefined(data?.total_deuda, data?.totalDeuda, data?.total_pendiente, data?.totalMultasPagar, data?.total) ?? 0) || undefined;
  const providerCount = Number(firstDefined(data?.totalMultas, data?.cantMultasPagar, data?.pendingCount) ?? 0) || 0;
  const pendingCount = providerCount || comparendos.length;

  return {
    provider, source: 'SIMIT', documentType, documentNumber,
    found: comparendos.length > 0 || Boolean(data?.tiene_deuda) || pendingCount > 0,
    totalDebt, pendingCount, personName, comparendos, raw,
  };
}

function mergeResults(primary: SimitLookupResult, secondary: SimitLookupResult): SimitLookupResult {
  const seen = new Set<string>();
  const comparendos = [...primary.comparendos, ...secondary.comparendos].filter((item) => {
    const key = `${item.kind ?? 'comparendo'}|${item.number || `${item.date}|${item.plate}|${item.infractionCode}|${item.value}`}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    ...primary,
    found: primary.found || secondary.found || comparendos.length > 0,
    totalDebt: primary.totalDebt ?? secondary.totalDebt,
    pendingCount: Math.max(primary.pendingCount ?? 0, secondary.pendingCount ?? 0, comparendos.length),
    personName: primary.personName ?? secondary.personName,
    comparendos,
    raw: { primary: primary.raw, secondary: secondary.raw },
  };
}
