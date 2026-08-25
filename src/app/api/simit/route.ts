import { NextResponse } from 'next/server';
import { lookupSimitByDocument } from '../../../lib/simitProvider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const documentType = String(body?.documentType || 'CC').trim();
    const documentNumber = String(body?.documentNumber || '').trim();

    if (!documentNumber) {
      return NextResponse.json({ error: 'El número de documento es obligatorio.' }, { status: 422 });
    }

    if (!process.env.SIMIT_PROVIDER?.trim() && process.env.VERIFIK_API_TOKEN?.trim()) {
      process.env.SIMIT_PROVIDER = 'verifik';
    }

    let result = await lookupSimitByDocument(documentType, documentNumber);

    // Verifik's dedicated SIMIT fines endpoint returns data.comparendos.
    // Use it as a deterministic fallback when the general endpoint returns
    // summary data but no selectable records.
    if (result.provider === 'verifik' && result.comparendos.length === 0 && process.env.VERIFIK_API_TOKEN?.trim()) {
      const query = `documentType=${encodeURIComponent(documentType)}&documentNumber=${encodeURIComponent(documentNumber.replace(/[^0-9A-Za-z]/g, ''))}`;
      const response = await fetch(`https://api.verifik.co/v2/co/simit/comparendos?${query}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${process.env.VERIFIK_API_TOKEN}` },
        cache: 'no-store',
      });

      if (response.ok) {
        const raw = await response.json();
        const data = raw?.data ?? raw?.value?.value?.data ?? raw?.value?.data ?? {};
        const items = Array.isArray(data?.comparendos) ? data.comparendos : [];
        const comparendos = items.map((item: any) => ({
          number: String(item?.NúmeroComparendo ?? item?.numeroComparendo ?? item?.numero ?? '').trim() || undefined,
          date: String(item?.fechaComparendo ?? item?.fecha ?? '').trim() || undefined,
          authority: String(item?.secretariaComparendo ?? item?.organismoTransito ?? item?.secretaria ?? '').trim() || undefined,
          department: String(item?.departamento ?? '').trim() || undefined,
          plate: String(item?.placavehiculo ?? item?.placa ?? item?.vehiclePlate ?? '').trim() || undefined,
          ownerName: String(item?.infractorComparendo ?? item?.nombrePropietario ?? '').trim() || undefined,
          infractionCode: String(item?.codigoInfraccion ?? item?.infraccion ?? '').trim() || undefined,
          description: String(item?.descripcionInfraccion ?? item?.descripcion ?? '').trim() || undefined,
          status: String(item?.estadoComparendo ?? item?.estado ?? '').trim() || undefined,
          value: Number(item?.total ?? item?.valorPagar ?? item?.valor ?? 0) || undefined,
          resolutionNumber: String(item?.numeroResolucion ?? item?.resolucion ?? '').trim() || undefined,
          resolutionDate: String(item?.fechaResolucion ?? '').trim() || undefined,
          notificationDate: String(item?.fechaNotificacion ?? '').trim() || undefined,
          paymentDate: String(item?.fechaPago ?? '').trim() || undefined,
        }));

        result = {
          ...result,
          found: result.found || comparendos.length > 0,
          pendingCount: Math.max(result.pendingCount ?? 0, comparendos.length),
          comparendos,
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
