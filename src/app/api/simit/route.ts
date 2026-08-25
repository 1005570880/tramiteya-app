import { NextRequest, NextResponse } from "next/server";
import {
  lookupSimitByDocument,
  SimitDataIntegrityError,
  SimitProviderError,
} from "@/lib/simitProvider";

export async function POST(req: NextRequest) {
  let body: { documentType?: string; documentNumber?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_RESPONSE", message: "Cuerpo de solicitud inválido." },
      { status: 400 }
    );
  }

  const documentNumber = String(body.documentNumber ?? "").trim();
  const documentType = String(body.documentType ?? "CC").trim().toUpperCase() || "CC";
  if (!documentNumber) {
    return NextResponse.json(
      { ok: false, code: "INVALID_RESPONSE", message: "documentNumber es requerido." },
      { status: 400 }
    );
  }

  console.log("[SIMIT AUDIT] request", JSON.stringify({ documentType, documentNumber, timestamp: new Date().toISOString() }));

  try {
    const result = await lookupSimitByDocument(documentType, documentNumber);
    const { raw, ...safeResult } = result;

    // El rawResponse queda únicamente en Runtime Logs; no se expone al navegador.
    if (raw !== undefined) {
      console.log("[SIMIT AUDIT] rawResponse", JSON.stringify({ documentType, documentNumber, raw }));
    }
    console.log("[SIMIT AUDIT] normalized", JSON.stringify({
      documentType,
      documentNumber,
      provider: result.provider,
      found: result.found,
      pendingCount: result.pendingCount,
      recordCount: result.comparendos?.length ?? 0,
      status: result.status,
    }));

    return NextResponse.json({
      ok: true,
      code: result.status ?? (result.found ? "SUCCESS" : "NO_RESULTS"),
      ...safeResult,
    });
  } catch (err) {
    if (err instanceof SimitDataIntegrityError) {
      console.error("[SIMIT AUDIT] integrity_error", JSON.stringify({ documentType, documentNumber, code: err.code, message: err.message }));
      return NextResponse.json(
        { ok: false, code: err.code, message: err.message },
        { status: 409 }
      );
    }

    if (err instanceof SimitProviderError) {
      console.error("[SIMIT AUDIT] provider_error", JSON.stringify({ documentType, documentNumber, code: err.code, message: err.message }));
      const statusByCode: Record<string, number> = {
        AUTH_ERROR: 502,
        CREDITS_ERROR: 502,
        PROVIDER_ERROR: 502,
        NETWORK_ERROR: 504,
        INVALID_RESPONSE: 502,
        SANDBOX_EMPTY: 502,
        CONFIGURATION_ERROR: 500,
      };

      return NextResponse.json(
        { ok: false, code: err.code, message: err.message },
        { status: statusByCode[err.code] ?? 502 }
      );
    }

    console.error("[SIMIT AUDIT] unexpected_error", JSON.stringify({ documentType, documentNumber, message: err instanceof Error ? err.message : String(err) }));
    return NextResponse.json(
      { ok: false, code: "PROVIDER_ERROR", message: "Error inesperado consultando SIMIT." },
      { status: 500 }
    );
  }
}
