import type { SimitComparendo, SimitLookupResult } from '@/lib/simitProvider';

const BASE = 'https://placapi.com/api';

function apiKey() {
  const key = process.env.PLACAPI_API_KEY?.trim();
  if (!key) throw new Error('Falta PLACAPI_API_KEY en las variables de entorno del servidor.');
  return key;
}

function clean(v: unknown) {
  return String(v ?? '').trim();
}

function normalizeStatus(v: unknown) {
  const value = clean(v).toLowerCase();
  if (value === 'paid' || value === 'pagada' || value === 'pagado') return 'pagada';
  if (value === 'agreement' || value === 'acuerdo') return 'acuerdo';
  if (value === 'pending' || value === 'pendiente') return 'pendiente';
  return clean(v) || undefined;
}

function normalizeRecord(raw: any, documentNumber: string): SimitComparendo {
  return {
    kind: 'comparendo',
    number: clean(raw?.comparendoId || raw?.numeroComparendo || raw?.numero) || undefined,
    date: clean(raw?.fecha) || undefined,
    authority: clean(raw?.organismo) || undefined,
    department: clean(raw?.departamento) || undefined,
    plate: clean(raw?.placa) || undefined,
    ownerName: clean(raw?.nombreCompleto || raw?.nombre) || undefined,
    documentNumber,
    infractionCode: clean(raw?.codigo) || undefined,
    description: clean(raw?.infraccion) || undefined,
    status: normalizeStatus(raw?.estado),
    value: typeof raw?.valor === 'number' ? raw.valor : Number(raw?.valor || 0) || undefined,
    resolutionNumber: clean(raw?.numeroResolucion || raw?.resolucion) || undefined,
    resolutionDate: clean(raw?.fechaResolucion) || undefined,
    notificationDate: clean(raw?.fechaNotificacion) || undefined,
    paymentDate: clean(raw?.fechaPago) || undefined,
    organismId: clean(raw?.organismoId || raw?.idOrganismoTransito) || undefined,
    photoDetection: Boolean(raw?.fotodeteccion),
  };
}

async function post(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'x-api-key': apiKey() },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  console.log('[SIMIT AUDIT] placapiResponse', JSON.stringify({ path, status: response.status, rawResponse: data }));
  if (!response.ok) {
    const message = data?.message || data?.error || `PlacApi respondió ${response.status}.`;
    throw new Error(`PLACAPI_${response.status}: ${message}`);
  }
  return data;
}

export async function lookupSimitByDocumentPlacApi(documentType: string, documentNumber: string): Promise<SimitLookupResult> {
  const dt = clean(documentType || 'CC').toUpperCase() || 'CC';
  const dn = clean(documentNumber).replace(/\D/g, '');
  if (!dn) throw new Error('La cédula es obligatoria.');

  const raw = await post('/comparendos', { docType: dt, docNumber: dn });
  const data = raw?.data ?? raw?.resultado ?? raw?.result ?? {};
  const returnedDocument = clean(data?.documentNumber);
  if (returnedDocument && returnedDocument.replace(/\D/g, '') !== dn) {
    throw new Error('SIMIT_DATA_INTEGRITY_ERROR: PlacApi devolvió información asociada a otro documento.');
  }

  const rows = Array.isArray(data?.comparendos) ? data.comparendos : [];
  const comparendos = rows.map((row: any) => normalizeRecord(row, dn));
  const totalDebt = Number(data?.totalDeuda ?? 0) || undefined;
  const pendingCount = comparendos.filter((r) => /pendiente|acuerdo/i.test(r.status || '')).length;

  return {
    provider: 'placapi',
    source: 'SIMIT',
    documentType: dt,
    documentNumber: dn,
    found: comparendos.length > 0,
    verificationRequired: false,
    officialUrl: 'https://www.fcm.org.co/simit/',
    totalDebt,
    pendingCount,
    personName: clean(data?.nombreCompleto || data?.nombre) || undefined,
    comparendos,
    status: comparendos.length ? 'SUCCESS' : 'NO_RESULTS',
    raw,
  };
}

export async function getSimitComparendoDetailPlacApi(documentType: string, documentNumber: string, numeroComparendo: string) {
  const dt = clean(documentType || 'CC').toUpperCase() || 'CC';
  const dn = clean(documentNumber).replace(/\D/g, '');
  const number = clean(numeroComparendo);
  if (!dn || !number) throw new Error('Cédula y número de comparendo son obligatorios.');

  const raw = await post('/comparendo', { docType: dt, docNumber: dn, numeroComparendo: number });
  const data = raw?.data ?? raw?.resultado ?? raw?.result ?? {};
  const returnedDocument = clean(data?.documentNumber);
  if (returnedDocument && returnedDocument.replace(/\D/g, '') !== dn) {
    throw new Error('SIMIT_DATA_INTEGRITY_ERROR: el detalle pertenece a otro documento.');
  }

  const found = data?.encontrado !== false && !!data?.comparendo;
  return {
    found,
    record: found ? normalizeRecord(data.comparendo, dn) : null,
    raw,
  };
}
