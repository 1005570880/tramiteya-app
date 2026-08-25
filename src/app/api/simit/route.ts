import { NextRequest, NextResponse } from "next/server";
import { lookupSimitByDocumentDirect } from "@/lib/simitVerifikDirect";

export async function POST(req: NextRequest) {
  let body: { documentType?: string; documentNumber?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, code: "INVALID_RESPONSE", message: "Cuerpo de solicitud inválido." }, { status: 400 }); }
  const documentNumber = String(body.documentNumber ?? "").trim();
  const documentType = String(body.documentType ?? "CC").trim().toUpperCase() || "CC";
  if (!documentNumber) return NextResponse.json({ ok: false, code: "INVALID_RESPONSE", message: "documentNumber es requerido." }, { status: 400 });
  console.log("[SIMIT AUDIT] request", JSON.stringify({ documentType, documentNumber, timestamp: new Date().toISOString() }));
  try {
    const result = await lookupSimitByDocumentDirect(documentType, documentNumber);
    const { raw, ...safeResult } = result;
    if (raw !== undefined) console.log("[SIMIT AUDIT] rawResponse", JSON.stringify({ documentType, documentNumber, raw }));
    console.log("[SIMIT AUDIT] normalized", JSON.stringify({ documentType, documentNumber, provider: result.provider, found: result.found, pendingCount: result.pendingCount, recordCount: result.comparendos?.length ?? 0, status: result.status }));
    return NextResponse.json({ ok: true, code: result.status ?? (result.found ? "SUCCESS" : "NO_RESULTS"), ...safeResult });
  } catch (err) {
    console.error("[SIMIT AUDIT] provider_error", JSON.stringify({ documentType, documentNumber, message: err instanceof Error ? err.message : String(err) }));
    return NextResponse.json({ ok: false, code: "PROVIDER_ERROR", message: err instanceof Error ? err.message : "Error inesperado consultando SIMIT." }, { status: 502 });
  }
}
