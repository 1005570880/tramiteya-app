import type { SimitComparendo, SimitLookupResult } from '@/lib/simitProvider';

const BASE = 'https://api.verifik.co/v2/co/simit';

type AnyRecord = Record<string, any>;

const clean = (v: unknown) => String(v ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
const text = (...v: unknown[]) => {
  for (const x of v) if (x !== undefined && x !== null && String(x).trim() !== '') return String(x).trim();
  return undefined;
};
const unwrap = (raw: any): any => raw?.value?.value?.data ?? raw?.value?.data ?? raw?.data ?? raw?.resultado ?? raw?.result ?? raw;

function documentOf(x: any): string | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const v = text(x.numeroDocumento, x.documentNumber, x.documento, x.cedula, x.identificacion, x.numeroIdentificacion,
    x.numeroIdentificacionPersona, x.documentoIdentidad, x.persona?.numeroDocumento, x.persona?.documentNumber,
    x.persona?.documento, x.titular?.numeroDocumento, x.titular?.documentNumber, x.titular?.documento,
    x.infractor?.numeroDocumento, x.infractor?.documentNumber, x.ciudadano?.numeroDocumento, x.ciudadano?.documentNumber,
    x.datosPersona?.numeroDocumento, x.datosPersona?.documentNumber);
  const n = clean(v); return n || undefined;
}

function findArrays(root: any, keys: string[], out: any[] = [], seen = new Set<any>()): any[] {
  if (!root || typeof root !== 'object' || seen.has(root)) return out;
  seen.add(root);
  if (Array.isArray(root)) { out.push(...root); for (const item of root) findArrays(item, keys, out, seen); return out; }
  for (const [k, v] of Object.entries(root as AnyRecord)) {
    if (keys.some(key => k.toLowerCase() === key.toLowerCase()) && Array.isArray(v)) out.push(...v);
    if (v && typeof v === 'object') findArrays(v, keys, out, seen);
  }
  return out;
}

function findValue(root: any, names: string[], seen = new Set<any>()): unknown {
  if (!root || typeof root !== 'object' || seen.has(root)) return undefined;
  seen.add(root);
  if (Array.isArray(root)) { for (const x of root) { const f = findValue(x, names, seen); if (f !== undefined) return f; } return undefined; }
  for (const [k, v] of Object.entries(root as AnyRecord)) {
    if (names.some(n => k.toLowerCase() === n.toLowerCase()) && v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  for (const v of Object.values(root as AnyRecord)) { if (v && typeof v === 'object') { const f = findValue(v, names, seen); if (f !== undefined) return f; } }
  return undefined;
}

function normalizeItem(item: any, kind: 'multa' | 'comparendo', fallbackName?: string): SimitComparendo {
  const inf = Array.isArray(item?.infracciones) ? item.infracciones[0] : item?.infraccion;
  const infractor = item?.infractor ?? item?.infractorComparendo;
  return {
    kind,
    number: text(item?.numeroComparendo, item?.NúmeroComparendo, item?.comparendoId, item?.numero, item?.number, item?.comparendo, item?.numeroMulta),
    date: text(item?.fechaComparendo, item?.fecha, item?.date, item?.fechaCurso),
    authority: text(item?.organismoTransito, item?.organismo, item?.secretariaComparendo, item?.secretaria, item?.autoridad),
    department: text(item?.departamento, item?.department),
    plate: text(item?.placa, item?.Placa, item?.placavehiculo, item?.vehiclePlate, item?.vehiculo?.placa),
    ownerName: text(item?.nombrePropietario, item?.propietario?.nombreCompleto, item?.propietario, item?.titular?.nombreCompleto,
      item?.titular, item?.nombreCompleto, item?.infractorComparendo, infractor?.nombreCompleto,
      infractor?.nombre ? `${infractor.nombre} ${infractor.apellido ?? ''}` : undefined, fallbackName),
    documentNumber: documentOf(item),
    infractionCode: text(item?.codigoInfraccion, item?.codigo, item?.infraccion, inf?.codigoInfraccion),
    description: text(item?.descripcionInfraccion, item?.descripcion, inf?.descripcionInfraccion),
    status: text(item?.estadoComparendo, item?.estado, item?.status),
    value: Number(text(item?.valorPagar, item?.valor, item?.valorMulta, item?.monto, item?.total, inf?.valorInfraccion) ?? 0) || undefined,
    resolutionNumber: text(item?.numeroResolucion, item?.resolucion),
    resolutionDate: text(item?.fechaResolucion),
    notificationDate: text(item?.fechaNotificacion, item?.notificacion?.fecha),
    paymentDate: text(item?.fechaPago, item?.pago?.fecha),
    organismId: text(item?.idOrganismoTransito, item?.organismoTransitoId, item?.organismId, item?.organismo?.id, item?.secretaria?.id),
    photoDetection: item?.fotodeteccion === true,
  };
}

async function verifik(url: string, token: string, audit: string) {
  const response = await fetch(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, cache: 'no-store' });
  const body = await response.text();
  let raw: any = null;
  try { raw = body ? JSON.parse(body) : null; } catch { raw = body; }
  console.log('[SIMIT AUDIT] direct', JSON.stringify({ audit, url, status: response.status, ok: response.ok, rawResponse: raw }));
  if (!response.ok) throw new Error(`Verifik ${response.status}`);
  if (!raw || typeof raw === 'string') throw new Error('Verifik no devolvió JSON');
  return raw;
}

async function verifyDetail(documentType: string, documentNumber: string, r: SimitComparendo, token: string) {
  if (!r.number || !r.organismId) return null;
  const q = new URLSearchParams({ documentType, documentNumber, numeroComparendo: r.number, idOrganismoTransito: r.organismId });
  try {
    const raw = await verifik(`${BASE}/comparendo?${q}`, token, 'comparendo-detail');
    const data = unwrap(raw);
    const returnedDoc = documentOf(data);
    if (returnedDoc && returnedDoc !== clean(documentNumber)) return null;
    const returnedNumber = clean(text(findValue(data, ['numeroComparendo', 'NúmeroComparendo']), r.number));
    const returnedOrganism = clean(text(findValue(data, ['idOrganismoTransito']), r.organismId));
    if (returnedNumber !== clean(r.number) || returnedOrganism !== clean(r.organismId)) return null;
    return { ...r, documentNumber: clean(documentNumber),
      ownerName: text(findValue(data, ['infractorComparendo', 'nombreCompleto']), r.ownerName),
      plate: text(findValue(data, ['placaVehiculo', 'placa']), r.plate),
      authority: text(findValue(data, ['secretariaComparendo', 'organismoTransito']), r.authority),
    } as SimitComparendo;
  } catch { return null; }
}

export async function lookupSimitByDocumentDirect(documentType: string, documentNumber: string): Promise<SimitLookupResult> {
  const token = process.env.VERIFIK_API_TOKEN?.trim() || process.env.VERIFIK_TOKEN?.trim();
  if (!token) throw new Error('Falta VERIFIK_API_TOKEN/VERIFIK_TOKEN.');
  const dt = (documentType || 'CC').trim().toUpperCase();
  const dn = clean(documentNumber);
  const query = `documentType=${encodeURIComponent(dt)}&documentNumber=${encodeURIComponent(dn)}`;
  const [consultarRaw, comparendosRaw] = await Promise.all([
    verifik(`${BASE}/consultar?${query}`, token, 'consultar'),
    verifik(`${BASE}/comparendos?${query}`, token, 'comparendos'),
  ]);

  const generalData = unwrap(consultarRaw);
  const ticketsData = unwrap(comparendosRaw);
  const generalItems = findArrays(generalData, ['multas', 'comparendos', 'infracciones']).map(x => x).filter(x => x && typeof x === 'object');
  const ticketItems = findArrays(ticketsData, ['comparendos', 'infracciones', 'multas']).map(x => x).filter(x => x && typeof x === 'object');
  const general = generalItems.map(x => normalizeItem(x, 'multa')).filter(x => !x.documentNumber || x.documentNumber === dn);
  const tickets = ticketItems.map(x => normalizeItem(x, 'comparendo')).filter(x => !x.documentNumber || x.documentNumber === dn);

  const validated: SimitComparendo[] = [];
  for (const r of tickets) {
    if (r.documentNumber === dn) { validated.push(r); continue; }
    const detail = await verifyDetail(dt, dn, r, token);
    if (detail) validated.push(detail);
  }

  const map = new Map<string, SimitComparendo>();
  for (const r of [...general, ...validated]) {
    const key = r.number ? `n:${r.number}` : `${r.date}|${r.plate}|${r.authority}|${r.value}`;
    const old = map.get(key);
    map.set(key, old ? { ...old, ...Object.fromEntries(Object.entries(r).filter(([,v]) => v !== undefined && v !== '')) } : r);
  }
  const comparendos = [...map.values()].filter(r => r.documentNumber === dn);
  const personName = text(findValue(generalData, ['nombreCompleto', 'nombre', 'nombres']), comparendos[0]?.ownerName);
  const totalDebt = Number(text(findValue(generalData, ['totalMultasPagar', 'total_deuda', 'totalDeuda', 'total_pendiente'])) ?? 0) || undefined;
  console.log('[SIMIT AUDIT] direct-normalized', JSON.stringify({ documentType: dt, documentNumber: dn, generalCandidates: generalItems.length, ticketCandidates: ticketItems.length, validated: comparendos.length }));
  return {
    provider: 'verifik', source: 'SIMIT', documentType: dt, documentNumber: dn,
    found: comparendos.length > 0, verificationRequired: false, officialUrl: 'https://www.fcm.org.co/simit/',
    totalDebt, pendingCount: comparendos.length, personName, comparendos,
    status: comparendos.length ? 'SUCCESS' : 'NO_RESULTS',
    raw: { consultar: consultarRaw, comparendos: comparendosRaw },
  };
}
