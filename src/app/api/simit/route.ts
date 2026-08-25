import { NextResponse } from 'next/server';
import { lookupSimitByDocument } from '../../../lib/simitProvider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unwrapVerifik(raw: any): any {
  return raw?.value?.value?.data ?? raw?.value?.data ?? raw?.data ?? raw?.resultado ?? raw?.result ?? raw;
}

function firstDefined(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
}

function normalizeVerifikRecords(raw: any, kind: 'multa' | 'comparendo') {
  const data = unwrapVerifik(raw);
  const source = kind === 'multa' ? data?.multas : data?.comparendos;
  const items = Array.isArray(source) ? source : [];

  return items.map((item: any) => ({
    kind,
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
  return [...primary, ...secondary].filter((item) => {
    const key = `${item.kind}|${item.number || `${item.date}|${item.plate}|${item.infractionCode}|${item.value}`}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const documentType = String(body?.documentType || 'CC').trim();
    const documentNumber = String(body?.documentNumber || '').trim().replace(/[^0-9A-Za-z]/g, '');

    if (!documentNumber) {
      return NextResponse.json({ error: 'El número de documento es obligatorio.' }, { status: 422 });
    }

    // If a manual/fail-safe provider was left configured, but Verifik credentials
    // exist, the real provider must take precedence. This prevents the UI from
    // reporting a successful empty SIMIT lookup while credentials are available.
    const configuredProvider = (process.env.SIMIT_PROVIDER || '').trim().toLowerCase();
    if (process.env.VERIFIK_API_TOKEN?.trim() && (!configuredProvider || configuredProvider === 'official-manual' || configuredProvider === 'manual')) {
      process.env.SIMIT_PROVIDER = 'verifik';
    }

    let result = await lookupSimitByDocument(documentType, documentNumber);

    // Verifik's general endpoint exposes multas, while the dedicated endpoint
    // exposes comparendos. Query both so TrámiteYa reflects SIMIT's real state.
    if (result.provider === 'verifik' && process.env.VERIFIK_API_TOKEN?.trim()) {
      const query = `documentType=${encodeURIComponent(documentType)}&documentNumber=${encodeURIComponent(documentNumber)}`;
      const headers = { Accept: 'application/json', Authorization: `Bearer ${process.env.VERIFIK_API_TOKEN}` };
      const response = await fetch(`https://api.verifik.co/v2/co/simit/comparendos?${query}`, { headers, cache: 'no-store' });

      if (response.ok) {
        const raw = await response.json();
        const comparendos = normalizeVerifikRecords(raw, 'comparendo');
        const existing = Array.isArray(result.comparendos) ? result.comparendos : [];
        const records = mergeRecords(existing, comparendos);
        result = {
          ...result,
          found: result.found || records.length > 0,
          pendingCount: Math.max(result.pendingCount ?? 0, records.length),
          comparendos: records,
        };
      }
    }

    const { raw: _raw, ...safeResult } = result;
    return NextResponse.json(safeResult);
  } catch (error) {
    console.error('SIMIT lookup failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No fue posible consultar SIMIT.' },
      { status: 502 },
    );
  }
}
