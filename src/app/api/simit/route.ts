import { NextResponse } from 'next/server';
import { lookupSimitByDocument } from '../../../lib/simitProvider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unwrapVerifik(raw: any): any { return raw?.value?.value?.data ?? raw?.value?.data ?? raw?.data ?? raw?.resultado ?? raw?.result ?? raw; }
function firstDefined(...values: unknown[]) { return values.find((value) => value !== undefined && value !== null && String(value).trim() !== ''); }
function normalizeVerifikRecords(raw: any, kind: 'multa' | 'comparendo') {
  const data = unwrapVerifik(raw); const source = kind === 'multa' ? data?.multas : data?.comparendos; const items = Array.isArray(source) ? source : [];
  return items.map((item: any) => ({ kind,
    number: String(firstDefined(item?.numeroComparendo, item?.NúmeroComparendo, item?.comparendoId, item?.numero, item?.number, item?.comparendo, item?.numeroMulta, item?.notificacion) ?? '').trim() || undefined,
    date: String(firstDefined(item?.fechaComparendo, item?.fecha, item?.date) ?? '').trim() || undefined,
    authority: String(firstDefined(item?.organismoTransito, item?.organismo, item?.secretariaComparendo, item?.secretaria, item?.autoridad) ?? '').trim() || undefined,
    department: String(firstDefined(item?.departamento, item?.department) ?? '').trim() || undefined,
    plate: String(firstDefined(item?.placa, item?.Placa, item?.placavehiculo, item?.vehiclePlate, item?.vehiculo?.placa) ?? '').trim() || undefined,
    ownerName: String(firstDefined(item?.nombrePropietario, item?.propietario, item?.titular, item?.nombreCompleto, item?.infractorComparendo, item?.infractor?.nombre ? `${item.infractor.nombre} ${item.infractor.apellido ?? ''}` : '') ?? '').trim() || undefined,
    infractionCode: String(firstDefined(item?.codigoInfraccion, item?.codigo, item?.infraccion) ?? '').trim() || undefined,
    description: String(firstDefined(item?.descripcionInfraccion, item?.descripcion) ?? '').trim() || undefined,
    status: String(firstDefined(item?.estadoComparendo, item?.estado, item?.status) ?? '').trim() || undefined,
    value: Number(firstDefined(item?.valorPagar, item?.valor, item?.valorMulta, item?.monto, item?.total) ?? 0) || undefined,
    resolutionNumber: String(firstDefined(item?.numeroResolucion, item?.resolucion) ?? '').trim() || undefined,
    resolutionDate: String(firstDefined(item?.fechaResolucion) ?? '').trim() || undefined,
    notificationDate: String(firstDefined(item?.fechaNotificacion, item?.notificacion?.fecha) ?? '').trim() || undefined,
    paymentDate: String(firstDefined(item?.fechaPago, item?.pago?.fecha) ?? '').trim() || undefined,
  }));
}
function mergeRecords(primary: any[], secondary: any[]) {
  const seen = new Set<string>();
  return [...primary, ...secondary].filter((item) => { const key = `${item.kind}|${item.number || `${item.date}|${item.plate}|${item.infractionCode}|${item.value}`}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const documentType = String(body?.documentType || 'CC').trim();
    const documentNumber = String(body?.documentNumber || '').trim().replace(/[^0-9A-Za-z]/g, '');
    if (!documentNumber) return NextResponse.json({ error: 'El número de documento es obligatorio.' }, { status: 422 });

    const token = process.env.VERIFIK_API_TOKEN?.trim() || process.env.VERIFIK_TOKEN?.trim();
    if (!token) return NextResponse.json({ error: 'SIMIT_PROVIDER_UNAVAILABLE', code: 'SIMIT_PROVIDER_UNAVAILABLE', message: 'La integración SIMIT/Verifik no está configurada en el servidor.' }, { status: 502 });

    const configuredProvider = (process.env.SIMIT_PROVIDER || '').trim().toLowerCase();
    if (!configuredProvider || configuredProvider === 'official-manual' || configuredProvider === 'manual') process.env.SIMIT_PROVIDER = 'verifik';

    const result = await lookupSimitByDocument(documentType, documentNumber);
    if (result.provider !== 'verifik') return NextResponse.json({ error: 'SIMIT_PROVIDER_UNAVAILABLE', code: 'SIMIT_PROVIDER_UNAVAILABLE', message: 'El proveedor SIMIT activo no es Verifik.' }, { status: 502 });

    const query = `documentType=${encodeURIComponent(documentType)}&documentNumber=${encodeURIComponent(documentNumber)}`;
    const response = await fetch(`https://api.verifik.co/v2/co/simit/comparendos?${query}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!response.ok) return NextResponse.json({ error: 'SIMIT_PROVIDER_UNAVAILABLE', code: 'SIMIT_PROVIDER_UNAVAILABLE', message: `Verifik respondió HTTP ${response.status} al consultar comparendos.` }, { status: 502 });

    const comparendos = normalizeVerifikRecords(await response.json(), 'comparendo');
    const records = mergeRecords(result.comparendos, comparendos);
    const safeResult: any = { ...result, found: result.found || records.length > 0, pendingCount: Math.max(result.pendingCount ?? 0, records.length), comparendos: records };
    delete safeResult.raw;
    return NextResponse.json(safeResult);
  } catch (error) {
    console.error('SIMIT lookup failed:', error);
    return NextResponse.json({ error: 'SIMIT_PROVIDER_UNAVAILABLE', code: 'SIMIT_PROVIDER_UNAVAILABLE', message: error instanceof Error ? error.message : 'No fue posible consultar SIMIT.' }, { status: 502 });
  }
}
