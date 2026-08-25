export type SimitRecordKind = 'multa' | 'comparendo';
export class SimitDataIntegrityError extends Error { code = 'SIMIT_DATA_INTEGRITY_ERROR'; }
export type SimitComparendo = { kind?: SimitRecordKind; number?: string; date?: string; authority?: string; department?: string; plate?: string; ownerName?: string; documentNumber?: string; infractionCode?: string; description?: string; status?: string; value?: number; resolutionNumber?: string; resolutionDate?: string; notificationDate?: string; paymentDate?: string; };
export type SimitLookupResult = { provider: 'verifik' | 'placapi' | 'coresoft' | 'official-manual'; source: 'SIMIT'; documentType: string; documentNumber: string; found: boolean; verificationRequired?: boolean; officialUrl?: string; totalDebt?: number; pendingCount?: number; personName?: string; comparendos: SimitComparendo[]; raw?: unknown };
function requiredEnv(name: string) { const value = process.env[name]?.trim(); if (!value) throw new Error(`Falta configurar ${name} en las variables de entorno del servidor.`); return value; }
function getVerifikToken() { return process.env.VERIFIK_API_TOKEN?.trim() || process.env.VERIFIK_TOKEN?.trim() || ''; }
function unwrapVerifik(raw: any): any { return raw?.value?.value?.data ?? raw?.value?.data ?? raw?.data ?? raw?.resultado ?? raw?.result ?? raw; }
function firstDefined(...values: unknown[]) { return values.find((value) => value !== undefined && value !== null && String(value).trim() !== ''); }
function toArray(value: any): any[] { if (Array.isArray(value)) return value; if (Array.isArray(value?.items)) return value.items; if (Array.isArray(value?.results)) return value.results; if (Array.isArray(value?.data)) return value.data; return []; }
type RecordCollection = { kind: SimitRecordKind; items: any[] };
function findRecordCollection(raw: any): RecordCollection { const direct = unwrapVerifik(raw); for (const [kind, candidate] of [['multa', direct?.multas], ['comparendo', direct?.comparendos], ['comparendo', direct?.infracciones]] as Array<[SimitRecordKind, any]>) { const items = toArray(candidate); if (items.length) return { kind, items }; } return { kind: 'comparendo', items: [] }; }
function normalizeProviderResult(provider: Exclude<SimitLookupResult['provider'], 'official-manual'>, documentType: string, documentNumber: string, raw: any): SimitLookupResult {
  const data = provider === 'verifik' ? unwrapVerifik(raw) : (raw?.data ?? raw?.resultado ?? raw?.result ?? raw); const collection = findRecordCollection(raw); const items = collection.items;
  const personName = String(firstDefined(data?.nombreCompleto, data?.nombre, data?.nombres, data?.titular, data?.propietario, data?.persona?.nombreCompleto, data?.persona?.nombre, items[0]?.infractor?.nombre ? `${items[0].infractor.nombre} ${items[0].infractor.apellido ?? ''}` : '') ?? '').trim() || undefined;
  const records: SimitComparendo[] = items.map((item: any) => { const inf = Array.isArray(item?.infracciones) ? item.infracciones[0] : null; const recordDocumentNumber = String(firstDefined(item?.infractor?.numeroDocumento, item?.numeroDocumento, item?.documentNumber, item?.documento, item?.persona?.numeroDocumento) ?? '').replace(/[^0-9A-Za-z]/g, '').trim() || undefined; return {
    kind: collection.kind,
    number: String(firstDefined(item?.numeroComparendo, item?.NúmeroComparendo, item?.comparendoId, item?.numero, item?.number, item?.comparendo, item?.numeroMulta) ?? '').trim() || undefined,
    date: String(firstDefined(item?.fechaComparendo, item?.fecha, item?.date) ?? '').trim() || undefined,
    authority: String(firstDefined(item?.organismoTransito, item?.organismo, item?.secretariaComparendo, item?.secretaria, item?.autoridad) ?? '').trim() || undefined,
    department: String(firstDefined(item?.departamento, item?.department) ?? '').trim() || undefined,
    plate: String(firstDefined(item?.placa, item?.Placa, item?.placavehiculo, item?.vehiclePlate, item?.vehiculo?.placa) ?? '').trim() || undefined,
    ownerName: String(firstDefined(item?.nombrePropietario, item?.propietario, item?.titular, item?.nombreCompleto, item?.infractorComparendo, item?.infractor?.nombre ? `${item.infractor.nombre} ${item.infractor.apellido ?? ''}` : '', personName) ?? '').trim() || undefined,
    documentNumber: recordDocumentNumber,
    infractionCode: String(firstDefined(item?.codigoInfraccion, item?.codigo, item?.infraccion, inf?.codigoInfraccion) ?? '').trim() || undefined,
    description: String(firstDefined(item?.descripcionInfraccion, item?.descripcion, inf?.descripcionInfraccion) ?? '').trim() || undefined,
    status: String(firstDefined(item?.estadoComparendo, item?.estado, item?.status) ?? '').trim() || undefined,
    value: Number(firstDefined(item?.valorPagar, item?.valor, item?.valorMulta, item?.monto, item?.total, inf?.valorInfraccion) ?? 0) || undefined,
    resolutionNumber: String(firstDefined(item?.numeroResolucion, item?.resolucion) ?? '').trim() || undefined,
    resolutionDate: String(firstDefined(item?.fechaResolucion) ?? '').trim() || undefined,
    notificationDate: String(firstDefined(item?.fechaNotificacion, item?.notificacion?.fecha) ?? '').trim() || undefined,
    paymentDate: String(firstDefined(item?.fechaPago, item?.pago?.fecha) ?? '').trim() || undefined,
  }; });
  const valid = records.filter((item) => item.documentNumber === documentNumber);
  if (records.length > 0 && valid.length === 0) throw new SimitDataIntegrityError('El proveedor devolvió registros que no pertenecen al documento consultado.');
  const totalDebt = Number(firstDefined(data?.total_deuda, data?.totalDeuda, data?.total_pendiente, data?.totalMultasPagar, data?.total) ?? 0) || undefined;
  const providerCount = Number(firstDefined(data?.totalMultas, data?.cantMultasPagar, data?.pendingCount) ?? 0) || 0;
  return { provider, source: 'SIMIT', documentType, documentNumber, found: valid.length > 0 || Boolean(data?.tiene_deuda) || providerCount > 0, totalDebt, pendingCount: providerCount || valid.length, personName, comparendos: valid, raw };
}
export async function lookupSimitByDocument(documentType: string, documentNumber: string): Promise<SimitLookupResult> {
  const normalizedNumber = documentNumber.replace(/[^0-9A-Za-z]/g, ''); if (!normalizedNumber) throw new Error('El número de documento es obligatorio.');
  const configuredProvider = (process.env.SIMIT_PROVIDER || '').toLowerCase().trim(); const token = getVerifikToken(); const provider = token && (!configuredProvider || configuredProvider === 'official-manual' || configuredProvider === 'manual') ? 'verifik' : configuredProvider; const officialUrl = 'https://www.fcm.org.co/simit/';
  if (!provider) return { provider: 'official-manual', source: 'SIMIT', documentType, documentNumber: normalizedNumber, found: false, verificationRequired: true, officialUrl, comparendos: [] };
  if (provider === 'verifik') { const headers = { Accept: 'application/json', Authorization: `Bearer ${token || requiredEnv('VERIFIK_API_TOKEN')}` }; const query = `documentType=${encodeURIComponent(documentType)}&documentNumber=${encodeURIComponent(normalizedNumber)}`; const response = await fetch(`https://api.verifik.co/v2/co/simit/consultar?${query}`, { headers, cache: 'no-store' }); if (response.status === 404) return { provider: 'verifik', source: 'SIMIT', documentType, documentNumber: normalizedNumber, found: false, pendingCount: 0, comparendos: [] }; if (!response.ok) throw new Error(`Proveedor SIMIT respondió ${response.status}.`); return normalizeProviderResult('verifik', documentType, normalizedNumber, await response.json()); }
  if (provider === 'placapi') { const key = requiredEnv('PLACAPI_API_KEY'); const response = await fetch('https://placapi.com/api/comparendos', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key }, body: JSON.stringify({ docType: documentType, docNumber: normalizedNumber }), cache: 'no-store' }); if (!response.ok) throw new Error(`Proveedor SIMIT respondió ${response.status}.`); return normalizeProviderResult('placapi', documentType, normalizedNumber, await response.json()); }
  if (provider === 'coresoft') { const key = requiredEnv('CORESOFT_API_KEY'); const response = await fetch(`https://api.coresoft.co/v1/infracciones?documento=${encodeURIComponent(normalizedNumber)}`, { headers: { Accept: 'application/json', 'X-API-Key': key }, cache: 'no-store' }); if (!response.ok) throw new Error(`Proveedor SIMIT respondió ${response.status}.`); return normalizeProviderResult('coresoft', documentType, normalizedNumber, await response.json()); }
  throw new Error(`SIMIT_PROVIDER no soportado: ${provider}. Usa verifik, placapi o coresoft.`);
}
