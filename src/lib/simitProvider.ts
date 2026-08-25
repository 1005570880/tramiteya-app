export type SimitRecordKind = 'multa' | 'comparendo';

export class SimitDataIntegrityError extends Error {
  code = 'SIMIT_DATA_INTEGRITY_ERROR';
}

export type SimitComparendo = {
  kind?: SimitRecordKind;
  number?: string;
  date?: string;
  authority?: string;
  department?: string;
  plate?: string;
  ownerName?: string;
  documentNumber?: string;
  infractionCode?: string;
  description?: string;
  status?: string;
  value?: number;
  resolutionNumber?: string;
  resolutionDate?: string;
  notificationDate?: string;
  paymentDate?: string;
  organismId?: string;
  photoDetection?: boolean;
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

function getVerifikToken() {
  return process.env.VERIFIK_API_TOKEN?.trim() || process.env.VERIFIK_TOKEN?.trim() || '';
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

function findRecordCollections(raw: any): RecordCollection[] {
  const direct = unwrapVerifik(raw);
  const candidates: Array<[SimitRecordKind, any]> = [
    ['multa', direct?.multas],
    ['comparendo', direct?.comparendos],
    ['comparendo', direct?.infracciones],
  ];
  return candidates
    .map(([kind, candidate]) => ({ kind, items: toArray(candidate) }))
    .filter((collection) => collection.items.length > 0);
}

function normalizeRecords(
  provider: Exclude<SimitLookupResult['provider'], 'official-manual'>,
  documentType: string,
  documentNumber: string,
  raw: any,
  fallbackKind?: SimitRecordKind,
): { records: SimitComparendo[]; personName?: string; totalDebt?: number; pendingCount?: number } {
  const data = provider === 'verifik' ? unwrapVerifik(raw) : (raw?.data ?? raw?.resultado ?? raw?.result ?? raw);
  const collections = findRecordCollections(raw);
  const effectiveCollections = collections.length ? collections : fallbackKind ? [{ kind: fallbackKind, items: [] }] : [];
  const allItems = effectiveCollections.flatMap((collection) => collection.items.map((item) => ({ item, kind: collection.kind })));

  const personName = String(
    firstDefined(
      data?.nombreCompleto,
      data?.nombre,
      data?.nombres,
      data?.titular,
      data?.propietario,
      data?.persona?.nombreCompleto,
      data?.persona?.nombre,
      allItems[0]?.item?.infractor?.nombre
        ? `${allItems[0].item.infractor.nombre} ${allItems[0].item.infractor.apellido ?? ''}`
        : '',
    ) ?? '',
  ).trim() || undefined;

  const records: SimitComparendo[] = allItems.map(({ item, kind }) => {
    const inf = Array.isArray(item?.infracciones) ? item.infracciones[0] : null;
    const explicitDocument = String(
      firstDefined(
        item?.infractor?.numeroDocumento,
        item?.numeroDocumento,
        item?.documentNumber,
        item?.documento,
        item?.persona?.numeroDocumento,
      ) ?? '',
    )
      .replace(/[^0-9A-Za-z]/g, '')
      .trim() || undefined;

    const number = String(
      firstDefined(
        item?.numeroComparendo,
        item?.NúmeroComparendo,
        item?.comparendoId,
        item?.numero,
        item?.number,
        item?.comparendo,
        item?.numeroMulta,
      ) ?? '',
    ).trim() || undefined;

    return {
      kind,
      number,
      date: String(firstDefined(item?.fechaComparendo, item?.fecha, item?.date) ?? '').trim() || undefined,
      authority: String(
        firstDefined(item?.organismoTransito, item?.organismo, item?.secretariaComparendo, item?.secretaria, item?.autoridad) ?? '',
      ).trim() || undefined,
      department: String(firstDefined(item?.departamento, item?.department) ?? '').trim() || undefined,
      plate: String(firstDefined(item?.placa, item?.Placa, item?.placavehiculo, item?.vehiclePlate, item?.vehiculo?.placa) ?? '').trim() || undefined,
      ownerName: String(
        firstDefined(
          item?.nombrePropietario,
          item?.propietario,
          item?.titular,
          item?.nombreCompleto,
          item?.infractorComparendo,
          item?.infractor?.nombre ? `${item.infractor.nombre} ${item.infractor.apellido ?? ''}` : '',
          personName,
        ) ?? '',
      ).trim() || undefined,
      documentNumber: explicitDocument,
      infractionCode: String(firstDefined(item?.codigoInfraccion, item?.codigo, item?.infraccion, inf?.codigoInfraccion) ?? '').trim() || undefined,
      description: String(firstDefined(item?.descripcionInfraccion, item?.descripcion, inf?.descripcionInfraccion) ?? '').trim() || undefined,
      status: String(firstDefined(item?.estadoComparendo, item?.estado, item?.status) ?? '').trim() || undefined,
      value: Number(firstDefined(item?.valorPagar, item?.valor, item?.valorMulta, item?.monto, item?.total, inf?.valorInfraccion) ?? 0) || undefined,
      resolutionNumber: String(firstDefined(item?.numeroResolucion, item?.resolucion) ?? '').trim() || undefined,
      resolutionDate: String(firstDefined(item?.fechaResolucion) ?? '').trim() || undefined,
      notificationDate: String(firstDefined(item?.fechaNotificacion, item?.notificacion?.fecha) ?? '').trim() || undefined,
      paymentDate: String(firstDefined(item?.fechaPago, item?.pago?.fecha) ?? '').trim() || undefined,
      organismId: String(firstDefined(item?.idOrganismoTransito) ?? '').trim() || undefined,
      photoDetection: item?.fotodeteccion === true,
    };
  });

  // Both Verifik endpoints are already scoped by the supplied document. We only reject
  // an explicit document mismatch; older SIMIT records from /comparendos may omit the
  // document number entirely, so treating an omitted value as a mismatch would discard
  // legitimate records.
  const valid = records.filter((item) => !item.documentNumber || item.documentNumber === documentNumber);
  if (records.length > 0 && valid.length === 0) {
    throw new SimitDataIntegrityError('El proveedor devolvió registros que no pertenecen al documento consultado.');
  }

  const totalDebt = Number(firstDefined(data?.total_deuda, data?.totalDeuda, data?.total_pendiente, data?.totalMultasPagar, data?.total) ?? 0) || undefined;
  const providerCount = Number(firstDefined(data?.totalMultas, data?.cantMultasPagar, data?.pendingCount) ?? 0) || 0;

  return {
    records: valid,
    personName,
    totalDebt,
    pendingCount: providerCount || valid.length || undefined,
  };
}

function mergeRecords(primary: SimitComparendo[], secondary: SimitComparendo[]) {
  const merged = new Map<string, SimitComparendo>();

  for (const record of [...primary, ...secondary]) {
    const number = record.number?.trim();
    const resolution = record.resolutionNumber?.trim();
    const key = number ? `number:${number}` : resolution ? `resolution:${resolution}` : [record.date, record.plate, record.infractionCode, record.authority, record.value].join('|');
    const previous = merged.get(key);

    if (!previous) {
      merged.set(key, record);
      continue;
    }

    merged.set(key, {
      ...previous,
      ...Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined && value !== '')),
      kind: previous.kind === 'multa' || record.kind === 'multa' ? 'multa' : 'comparendo',
    });
  }

  return Array.from(merged.values());
}

async function fetchVerifik(url: string, token: string) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Proveedor SIMIT respondió ${response.status}${body ? `: ${body.slice(0, 300)}` : ''}.`);
  }

  return response.json();
}

export async function lookupSimitByDocument(documentType: string, documentNumber: string): Promise<SimitLookupResult> {
  const normalizedNumber = documentNumber.replace(/[^0-9A-Za-z]/g, '');
  if (!normalizedNumber) throw new Error('El número de documento es obligatorio.');

  const configuredProvider = (process.env.SIMIT_PROVIDER || '').toLowerCase().trim();
  const token = getVerifikToken();
  const provider = token && (!configuredProvider || configuredProvider === 'official-manual' || configuredProvider === 'manual') ? 'verifik' : configuredProvider;
  const officialUrl = 'https://www.fcm.org.co/simit/';

  if (!provider) {
    return {
      provider: 'official-manual',
      source: 'SIMIT',
      documentType,
      documentNumber: normalizedNumber,
      found: false,
      verificationRequired: true,
      officialUrl,
      comparendos: [],
    };
  }

  if (provider === 'verifik') {
    const verifikToken = token || requiredEnv('VERIFIK_API_TOKEN');
    const query = `documentType=${encodeURIComponent(documentType)}&documentNumber=${encodeURIComponent(normalizedNumber)}`;

    // Verifik exposes two complementary SIMIT views for a document:
    // /consultar -> full fines/person summary, and /comparendos -> ticket list.
    // Query both and fuse them so TrámiteYa does not silently lose records when one
    // representation contains data the other does not.
    const [generalRaw, comparendosRaw] = await Promise.all([
      fetchVerifik(`https://api.verifik.co/v2/co/simit/consultar?${query}`, verifikToken),
      fetchVerifik(`https://api.verifik.co/v2/co/simit/comparendos?${query}`, verifikToken),
    ]);

    const general = normalizeRecords('verifik', documentType, normalizedNumber, generalRaw, 'multa');
    const tickets = normalizeRecords('verifik', documentType, normalizedNumber, comparendosRaw, 'comparendo');
    const comparendos = mergeRecords(general.records, tickets.records);

    const generalData = unwrapVerifik(generalRaw);
    const ticketData = unwrapVerifik(comparendosRaw);
    const totalDebt = general.totalDebt ?? tickets.totalDebt ?? Number(firstDefined(generalData?.totalMultasPagar, ticketData?.totalMultasPagar) ?? 0) || undefined;
    const providerCount = Math.max(
      general.pendingCount ?? 0,
      tickets.pendingCount ?? 0,
      comparendos.length,
      Number(firstDefined(generalData?.multas?.length, ticketData?.comparendos?.length) ?? 0),
    );

    return {
      provider: 'verifik',
      source: 'SIMIT',
      documentType,
      documentNumber: normalizedNumber,
      found: comparendos.length > 0 || providerCount > 0 || Boolean(generalData?.tiene_deuda) || Boolean(ticketData?.tiene_deuda),
      totalDebt,
      pendingCount: providerCount,
      personName: general.personName ?? tickets.personName,
      comparendos,
      raw: { general: generalRaw, comparendos: comparendosRaw },
    };
  }

  if (provider === 'placapi') {
    const key = requiredEnv('PLACAPI_API_KEY');
    const response = await fetch('https://placapi.com/api/comparendos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ docType: documentType, docNumber: normalizedNumber }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Proveedor SIMIT respondió ${response.status}.`);
    const raw = await response.json();
    const normalized = normalizeRecords('placapi', documentType, normalizedNumber, raw);
    return { provider, source: 'SIMIT', documentType, documentNumber: normalizedNumber, found: normalized.records.length > 0, totalDebt: normalized.totalDebt, pendingCount: normalized.pendingCount, personName: normalized.personName, comparendos: normalized.records, raw };
  }

  if (provider === 'coresoft') {
    const key = requiredEnv('CORESOFT_API_KEY');
    const response = await fetch(`https://api.coresoft.co/v1/infracciones?documento=${encodeURIComponent(normalizedNumber)}`, {
      headers: { Accept: 'application/json', 'X-API-Key': key },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Proveedor SIMIT respondió ${response.status}.`);
    const raw = await response.json();
    const normalized = normalizeRecords('coresoft', documentType, normalizedNumber, raw);
    return { provider, source: 'SIMIT', documentType, documentNumber: normalizedNumber, found: normalized.records.length > 0, totalDebt: normalized.totalDebt, pendingCount: normalized.pendingCount, personName: normalized.personName, comparendos: normalized.records, raw };
  }

  throw new Error(`SIMIT_PROVIDER no soportado: ${provider}. Usa verifik, placapi o coresoft.`);
}
