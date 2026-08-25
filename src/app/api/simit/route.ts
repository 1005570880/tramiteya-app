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
  if (!documentNumber) {
    return NextResponse.json(
      { ok: false, code: "INVALID_RESPONSE", message: "documentNumber es requerido." },
      { status: 400 }
    );
  }

  try {
    const result = await lookupSimitByDocument(
      body.documentType || "CC",
      documentNumber
    );

    return NextResponse.json({
      ok: true,
      code: result.status ?? (result.found ? "SUCCESS" : "NO_RESULTS"),
      ...result,
    });
  } catch (err) {
    if (err instanceof SimitDataIntegrityError) {
      return NextResponse.json(
        { ok: false, code: err.code, message: err.message },
        { status: 409 }
      );
    }

    if (err instanceof SimitProviderError) {
      const statusByCode: Record<string, number> = {
        AUTH_ERROR: 502,
        CREDITS_ERROR: 502,
        PROVIDER_ERROR: 502,
        NETWORK_ERROR: 504,
        INVALID_RESPONSE: 502,
        SANDBOX_EMPTY: 502,
      };

      return NextResponse.json(
        { ok: false, code: err.code, message: err.message },
        { status: statusByCode[err.code] ?? 502 }
      );
    }

    console.error("[SIMIT ROUTE] error inesperado", err);
    return NextResponse.json(
      { ok: false, code: "PROVIDER_ERROR", message: "Error inesperado consultando SIMIT." },
      { status: 500 }
    );
  }
}
