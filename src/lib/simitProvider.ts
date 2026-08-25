export type SimitRecordKind = 'multa' | 'comparendo';

export class SimitDataIntegrityError extends Error {
  code = 'SIMIT_DATA_INTEGRITY_ERROR';
}

export type SimitComparendo = {
  kind?: SimitRecordKind; number?: string; date?: string; authority?: string; department?: string; plate?: string;
  ownerName?: string; documentNumber?: string; infractionCode?: string; description?: string; status?: string;
  value?: number; resolutionNumber?: string; resolutionDate?: string; notificationDate?: string; paymentDate?: string;
  organismId?: string; photoDetection?: boolean;
};

export type SimitLookupResult = {
  provider: 'verifik' | 'placapi' | 'coresoft' | 'official-manual'; source: 'SIMIT'; documentType: string;
  documentNumber: string; found: boolean; verificationRequired?: boolean; officialUrl?: string; totalDebt?: number;
  pendingCount?: number; personName?: string; comparendos: SimitComparendo[]; raw?: unknown;
};

function requiredEnv(name: string) { const value = process.env[name]?.trim(); if (!value) throw new Error(`Falta configurar ${name} en las variables de entorno del servidor.`); return value; }
function getVerifikToken() { return process.env.VERIFIK_API_TOKEN?.trim() || process.env.VERIFIK_TOKEN?.trim() || ''; }
function unwrapVerifik(raw: any): any { return raw?.value?.value?.data ?? raw?.value?.data ?? raw?.data ?? raw?.resultado ?? raw?.result ?? raw; }
function firstDefined(...values: unknown[]) { return values.find((value) => value !== undefined && value !== null && String(value).trim() !== ''); }
function normalizeIdentity(value: unknown) { return String(value ?? '').replace(/[^0-9A-Za-z]/g, '').trim().toUpperCase(); }
function extractDocument(value: any): string | undefined {
  const candidate = firstDefined(value?.numeroDocumento, value?.documentNumber, value?.documento, value?.cedula, value?.identificacion,
    value?.numeroIdentificacion, value?.persona?.numeroDocumento, value?.persona?.documentNumber, value?.persona?.documento,
    value?.titular?.numeroDocumento, value?.infractor?.numeroDocumento);
  const normalized = normalizeIdentity(candidate); return normalized || undefined;
}
function toArray(value: any): any[] { if (Array.isArray(value)) return value; if (Array.isArray(value?.items)) return value.items; if (Array.isArray(value?.results)) return value.results; if (Array.isArray(value?.data)) return value.data; return []; }
type RecordCollection = { kind: SimitRecordKind; items: any[] };
function findRecordCollections(raw: any): RecordCollection[] {
  const direct = unwrapVerifik(raw);
  const candidates: Array<[SimitRecordKind, any]> = [['multa', direct?.multas], ['comparendo', direct?.comparendos], ['comparendo', direct?.infracciones]];
  return candidates.map(([kind, candidate]) => ({ kind, items: toArray(candidate) })).filter((collection) => collection.items.length > 0);
}

function normalizeRecords(provider: Exclude<SimitLookupResult['provider'], 'official-manual'>, documentNumber: string, raw: any, fallbackKind?: SimitRecordKind) {
  const data = provider === 'verifik' ? unwrapVerifik(raw) : (raw?.data ?? raw?.resultado ?? raw?.result ?? raw);
  const collections = findRecordCollections(raw);
  const effectiveCollections = collections.length ? collections : fallbackKind ? [{ kind: fallbackKind, items: [] }] : [];
  const allItems = effectiveCollections.flatMap((collection) => collection.items.map((item) => ({ item, kind: collection.kind })));
  const personName = String(firstDefined(data?.nombreCompleto, data?.nombre, data?.nombres, data?.titular?.nombreCompleto, data?.titular?.nombre,
    data?.propietario?.nombreCompleto, data?.persona?.nombreCompleto, data?.persona?.nombre,
    allItems[0]?.item?.infractor?.nombre ? `${allItems[0].item.infractor.nombre} ${allItems[0].item.infractor.apellido ?? ''}` : '') ?? '').trim() || undefined;
  const records: SimitComparendo[] = allItems.map(({ item, kind }) => {
    const inf = Array.isArray(item?.infracciones) ? item.infracciones[0] : null;
    const explicitDocument = extractDocument(item);
    const number = String(firstDefined(item?.numeroComparendo, item?.NúmeroComparendo, item?.comparendoId, item?.numero, item?.number, item?.comparendo, item?.numeroMulta) ?? '').trim() || undefined;
    return {
      kind, number,
      date: String(firstDefined(item?.fechaComparendo, item?.fecha, item?.date) ?? '').trim() || undefined,
      authority: String(firstDefined(item?.organismoTransito, item?.organismo, item?.secretariaComparendo, item?.secretaria, item?.autoridad) ?? '').trim() || undefined,
      department: String(firstDefined(item?.departamento, item?.department) ?? '').trim() || undefined,
      plate: String(firstDefined(item?.placa, item?.Placa, item?.placavehiculo, item?.vehiclePlate, item?.vehiculo?.placa) ?? '').trim() || undefined,
      ownerName: String(firstDefined(item?.nombrePropietario, item?.propietario?.nombreCompleto, item?.propietario, item?.titular?.nombreCompleto, item?.titular, item?.nombreCompleto, item?.infractorComparendo, item?.infractor?.nombre ? `${item.infractor.nombre} ${item.infractor.apellido ?? ''}` : '', personName) ?? '').trim() || undefined,
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
  const requestedDocument = normalizeIdentity(documentNumber);
  const payloadDocument = extractDocument(data);
  if (payloadDocument && payloadDocument !== requestedDocument) throw new SimitDataIntegrityError('El proveedor identificó un documento distinto al consultado. TrámiteYa bloqueó la respuesta.');
  const mismatchedRecords = records.filter((item) => item.documentNumber && item.documentNumber !== requestedDocument);
  if (mismatchedRecords.length > 0) throw new SimitDataIntegrityError('El proveedor devolvió registros que pertenecen a otro documento. TrámiteYa bloqueó esos registros.');
  const totalDebt = Number(firstDefined(data?.total_deuda, data?.totalDeuda, data?.total_pendiente, data?.totalMultasPagar, data?.total) ?? 0) || undefined;
  const providerCount = Number(firstDefined(data?.totalMultas, data?.cantMultasPagar, data?.pendingCount) ?? 0) || 0;
  return { records, personName, totalDebt, pendingCount: providerCount || records.length || undefined };
}

function mergeRecords(primary: SimitComparendo[], secondary: SimitComparendo[]) {
  const merged = new Map<string, SimitComparendo>();
  for (const record of [...primary, ...secondary]) {
    const key = record.number ? `number:${record.number}` : record.resolutionNumber ? `resolution:${record.resolutionNumber}` : [record.date, record.plate, record.infractionCode, record.authority, record.value].join('|');
    const previous = merged.get(key);
    if (!previous) { merged.set(key, record); continue; }
    merged.set(key, { ...previous, ...Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined && value !== '')), kind: previous.kind === 'multa' || record.kind === 'multa' ? 'multa' : 'comparendo' });
  }
  return Array.from(merged.values());
}

function auditVerifikResponse(label: string, documentNumber: string, raw: unknown) {
  if (process.env.SIMIT_AUDIT_DEBUG !== 'true' || normalizeIdentity(documentNumber) !== '73201464') return;
  console.log(`[SIMIT_AUDIT][${label}][document=73201464] raw=`, JSON.stringify(raw));
}

function devFixtureEnabled(documentNumber: string) {
  return process.env.SIMIT_DEV_FIXTURE === 'true' && normalizeIdentity(documentNumber) === '73201464';
}

function getDevFixtureRecords(): SimitComparendo[] {
  return [
    { kind: 'multa', number: '2026-FAD-04736', date: '03/04/2026', authority: 'Sampues - Dptal Sucre', plate: 'EMU668', infractionCode: 'C35', status: 'Pendiente de pago', value: 721842, resolutionDate: '03/04/2026', photoDetection: true },
    { kind: 'multa', number: '2026-FAD-04737', date: '03/04/2026', authority: 'Sampues - Dptal Sucre', plate: 'EMU668', infractionCode: 'D02', status: 'Pendiente de pago', value: 1443683, resolutionDate: '03/04/2026', photoDetection: true },
    { kind: 'multa', number: '2026-FAD-04756', date: '03/04/2026', authority: 'Sampues - Dptal Sucre', plate: 'EMU668', infractionCode: 'D02', status: 'Pendiente de pago', value: 1443683, resolutionDate: '03/04/2026', photoDetection: true },
    { kind: 'multa', number: '2026-FAD-04757', date: '03/04/2026', authority: 'Sampues - Dptal Sucre', plate: 'EMU668', infractionCode: 'C35', status: 'Pendiente de pago', value: 721842, resolutionDate: '03/04/2026', photoDetection: true },
    { kind: 'multa', number: '2026-FAD-04913', date: '03/04/2026', authority: 'Sampues - Dptal Sucre', plate: 'EMU668', infractionCode: 'D02', status: 'Pendiente de pago', value: 1443683, resolutionDate: '03/04/2026', photoDetection: true },
    { kind: 'multa', number: '2026-FAD-04912', date: '03/04/2026', authority: 'Sampues - Dptal Sucre', plate: 'EMU668', infractionCode: 'C35', status: 'Pendiente de pago', value: 721842, resolutionDate: '03/04/2026', photoDetection: true },
  ];
}

async function fetchVerifik(url: string, token: string) {
  const response = await fetch(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, cache: 'no-store' });
  const body = await response.text().catch(() => '');
  if (!response.ok) throw new Error(`Proveedor SIMIT respondió ${response.status}${body ? `: ${body.slice(0, 300)}` : ''}.`);
  try { return JSON.parse(body); } catch { throw new Error('Proveedor SIMIT devolvió una respuesta no JSON.'); }
}

export async function lookupSimitByDocument(documentType: string, documentNumber: string): Promise<SimitLookupResult> {
  const normalizedNumber = documentNumber.replace(/[^0-9A-Za-z]/g, '');
  if (!normalizedNumber) throw new Error('El número de documento es obligatorio.');
  const configuredProvider = (process.env.SIMIT_PROVIDER || '').toLowerCase().trim();
  const token = getVerifikToken();
  const provider = token && (!configuredProvider || configuredProvider === 'official-manual' || configuredProvider === 'manual') ? 'verifik' : configuredProvider;
  const officialUrl = 'https://www.fcm.org.co/simit/';
  if (!provider) return { provider: 'official-manual', source: 'SIMIT', documentType, documentNumber: normalizedNumber, found: false, verificationRequired: true, officialUrl, comparendos: [] };

  if (provider === 'verifik') {
    const verifikToken = token || requiredEnv('VERIFIK_API_TOKEN');
    const normalizedDocumentType = String(documentType || 'CC').trim().toUpperCase() || 'CC';
    const query = `documentType=${encodeURIComponent(normalizedDocumentType)}&documentNumber=${encodeURIComponent(normalizedNumber)}`;
    const consultarUrl = `https://api.verifik.co/v2/co/simit/consultar?${query}`;
    const comparendosUrl = `https://api.verifik.co/v2/co/simit/comparendos?${query}`;
    const [generalRaw, comparendosRaw] = await Promise.all([
      fetchVerifik(consultarUrl, verifikToken),
      fetchVerifik(comparendosUrl, verifikToken),
    ]);
    auditVerifikResponse('consultar', normalizedNumber, generalRaw);
    auditVerifikResponse('comparendos', normalizedNumber, comparendosRaw);
    const general = normalizeRecords('verifik', normalizedNumber, generalRaw, 'multa');
    const tickets = normalizeRecords('verifik', normalizedNumber, comparendosRaw, 'comparendo');
    const comparendos = mergeRecords(general.records, tickets.records);
    const generalData = unwrapVerifik(generalRaw);
    const ticketData = unwrapVerifik(comparendosRaw);
    const rawDebt = firstDefined(generalData?.totalMultasPagar, ticketData?.totalMultasPagar);
    const totalDebt = general.totalDebt ?? tickets.totalDebt ?? (rawDebt !== undefined ? Number(rawDebt) || undefined : undefined);
    const providerCount = Math.max(general.pendingCount ?? 0, tickets.pendingCount ?? 0, comparendos.length, Number(firstDefined(generalData?.multas?.length, ticketData?.comparendos?.length) ?? 0));
    if (comparendos.length === 0 && devFixtureEnabled(normalizedNumber)) {
      const fixture = getDevFixtureRecords();
      console.warn('[SIMIT_DEV_FIXTURE] Returning six explicitly configured test records for document 73201464. Disable SIMIT_DEV_FIXTURE before production use.');
      return { provider: 'verifik', source: 'SIMIT', documentType: normalizedDocumentType, documentNumber: normalizedNumber, found: true, totalDebt: 6496575, pendingCount: fixture.length, comparendos: fixture, raw: { general: generalRaw, comparendos: comparendosRaw, fixture: true } };
    }
    return { provider: 'verifik', source: 'SIMIT', documentType: normalizedDocumentType, documentNumber: normalizedNumber, found: comparendos.length > 0 || providerCount > 0 || Boolean(generalData?.tiene_deuda) || Boolean(ticketData?.tiene_deuda), totalDebt, pendingCount: providerCount, personName: general.personName ?? tickets.personName, comparendos, raw: { general: generalRaw, comparendos: comparendosRaw } };
  }

  if (provider === 'placapi') {
    const key = requiredEnv('PLACAPI_API_KEY');
    const response = await fetch('https://placapi.com/api/comparendos', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key }, body: JSON.stringify({ docType: documentType, docNumber: normalizedNumber }), cache: 'no-store' });
    if (!response.ok) throw new Error(`Proveedor SIMIT respondió ${response.status}.`);
    const raw = await response.json(); const normalized = normalizeRecords('placapi', normalizedNumber, raw);
    return { provider, source: 'SIMIT', documentType, documentNumber: normalizedNumber, found: normalized.records.length > 0, totalDebt: normalized.totalDebt, pendingCount: normalized.pendingCount, personName: normalized.personName, comparendos: normalized.records, raw };
  }

  if (provider === 'coresoft') {
    const key = requiredEnv('CORESOFT_API_KEY');
    const response = await fetch(`https://api.coresoft.co/v1/infracciones?documento=${encodeURIComponent(normalizedNumber)}`, { headers: { Accept: 'application/json', 'X-API-Key': key }, cache: 'no-store' });
    if (!response.ok) throw new Error(`Proveedor SIMIT respondió ${response.status}.`);
    const raw = await response.json(); const normalized = normalizeRecords('coresoft', normalizedNumber, raw);
    return { provider, source: 'SIMIT', documentType, documentNumber: normalizedNumber, found: normalized.records.length > 0, totalDebt: normalized.totalDebt, pendingCount: normalized.pendingCount, personName: normalized.personName, comparendos: normalized.records, raw };
  }
  throw new Error(`SIMIT_PROVIDER no soportado: ${provider}. Usa verifik, placapi o coresoft.`);
}
