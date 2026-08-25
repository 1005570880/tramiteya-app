import { NextRequest, NextResponse } from "next/server";
import { lookupSimitByDocument, SimitDataIntegrityError, SimitProviderError } from "@/lib/simitProvider";

export async function POST(req: NextRequest) {
  let body: { documentType?: string; documentNumber?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, code: "INVALID_RESPONSE", message: "Cuerpo de solicitud inválido." }, { status: 400 }); }
  const documentNumber = String(body.documentNumber ?? "").trim();
  const documentType = String(body.documentType ?? "CC").trim().toUpperCase() || "CC";
  if (!documentNumber) return NextResponse.json({ ok: false, code: "INVALID_RESPONSE", message: "documentNumber es requerido." }, { status: 400 });
  console.log("[SIMIT AUDIT] request", JSON.stringify({ documentType, documentNumber, timestamp: new Date().toISOString() }));
  try {
    const result = await lookupSimitByDocument(documentType, documentNumber);
    const { raw, ...safeResult } = result;
    if (raw !== undefined) console.log("[SIMIT AUDIT] rawResponse", JSON.stringify({ documentType, documentNumber, raw }));
    console.log("[SIMIT AUDIT] normalized", JSON.stringify({ documentType, documentNumber, provider: result.provider, found: result.found, pendingCount: result.pendingCount, recordCount: result.comparendos?.length ?? 0, status: result.status }));

    // Regla de seguridad: un comparendo/multa solo puede asociarse automáticamente
    // a la cédula si EL PROPIO REGISTRO trae evidencia documental de esa identidad.
    // La identidad del objeto general /consultar no se hereda a /comparendos.
    if (result.comparendos?.length) {
      const requested = documentNumber.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
      const invalidIdentity = result.comparendos.some((record: any) => {
        const recordDocument = String(record?.documentNumber ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
        return !recordDocument || recordDocument !== requested;
      });
      if (invalidIdentity) {
        console.error("[SIMIT AUDIT] integrity_error", JSON.stringify({ documentType, documentNumber, code: "SIMIT_DATA_INTEGRITY_ERROR", reason: "record_without_matching_document", recordCount: result.comparendos.length }));
        return NextResponse.json({ ok: false, code: "SIMIT_DATA_INTEGRITY_ERROR", message: "Verifik devolvió registros de tránsito sin una identificación documental coincidente con la cédula consultada. TrámiteYa bloqueó esos registros para evitar mostrar información de otra persona." }, { status: 409 });
      }
    }

    return NextResponse.json({ ok: true, code: result.status ?? (result.found ? "SUCCESS" : "NO_RESULTS"), ...safeResult });
  } catch (err) {
    if (err instanceof SimitDataIntegrityError) {
      console.error("[SIMIT AUDIT] integrity_error", JSON.stringify({ documentType, documentNumber, code: err.code, message: err.message }));
      return NextResponse.json({ ok: false, code: err.code, message: err.message }, { status: 409 });
    }
    if (err instanceof SimitProviderError) {
      console.error("[SIMIT AUDIT] provider_error", JSON.stringify({ documentType, documentNumber, code: err.code, message: err.message }));
      const statusByCode: Record<string, number> = { AUTH_ERROR: 502, CREDITS_ERROR: 502, PROVIDER_ERROR: 502, NETWORK_ERROR: 504, INVALID_RESPONSE: 502, SANDBOX_EMPTY: 502, CONFIGURATION_ERROR: 500 };
      return NextResponse.json({ ok: false, code: err.code, message: err.message }, { status: statusByCode[err.code] ?? 502 });
    }
    console.error("[SIMIT AUDIT] unexpected_error", JSON.stringify({ documentType, documentNumber, message: err instanceof Error ? err.message : String(err) }));
    return NextResponse.json({ ok: false, code: "PROVIDER_ERROR", message: "Error inesperado consultando SIMIT." }, { status: 500 });
  }
}
