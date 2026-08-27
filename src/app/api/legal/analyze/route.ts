import { NextResponse } from "next/server";
import { z } from "zod";
import { selectLegalAuthorities } from "../../../../lib/legalLibrary";
import { assessTrafficRecord, generateLegalDraft, type SelectedRecordData } from "../../../../lib/legalEngine";

const RecordSchema = z.object({
  comparendo: z.string().optional().default(""),
  fecha: z.string().optional().default(""),
  organismo: z.string().optional().default(""),
  estado: z.string().optional().default(""),
  valor: z.string().optional().default(""),
  placa: z.string().optional(),
  cedula: z.string().optional(),
  codigo: z.string().optional(),
  fechaResolucion: z.string().optional(),
  fechaNotificacion: z.string().optional(),
  fechaMandamientoPago: z.string().optional(),
  huboAudiencia: z.union([z.boolean(), z.string()]).optional(),
  existeResolucion: z.union([z.boolean(), z.string()]).optional(),
});

function deterministic(record: SelectedRecordData) {
  const draft = generateLegalDraft(record);
  const authorities = selectLegalAuthorities(draft.assessment.routes, `${draft.fundamentos} ${record.estado}`);
  return {
    ...draft,
    legalAnalysis: {
      conclusion: `Ruta principal: ${draft.assessment.primaryRoute || "REVISIÓN INTEGRAL"}.`,
      confidence: draft.assessment.missingEvidence.length ? "media" : "alta",
      authorities,
      caveat: "Las conclusiones que dependan de fechas o actuaciones no visibles en SIMIT quedan condicionadas a la verificación del expediente administrativo.",
    },
  };
}

export async function POST(request: Request) {
  try {
    const parsed = RecordSchema.parse(await request.json());
    const record = parsed as SelectedRecordData;
    const base = deterministic(record);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ ...base, ai: { enabled: false, reason: "OPENAI_API_KEY no configurada" } });

    const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";
    const authorities = base.legalAnalysis.authorities.map((a) => `${a.source} | ${a.provision} | ${a.rule}`).join("\n");
    const prompt = `Actúa como motor jurídico de apoyo para un abogado colombiano. Analiza exclusivamente los datos suministrados y la biblioteca normativa entregada. No inventes hechos, fechas, notificaciones, resoluciones ni actuaciones. Distingue hechos acreditados, inferencias y datos que deben ser solicitados a la autoridad. Si el registro ya evidencia una sanción/multa o identificador sancionatorio, NO declares caducidad de la actuación contravencional como hecho ni como ruta automática. La pérdida de fuerza ejecutoria exige verificar acto en firme, fecha de firmeza y actuaciones de ejecución durante cinco años. La prescripción debe analizarse con las reglas específicas de tránsito y las actuaciones acreditadas, sin afirmar que el simple paso del tiempo basta. Produce un fundamento jurídico sustancial, organizado y apto para incorporarse a un derecho de petición: problema jurídico, hechos relevantes, marco normativo, aplicación al caso, solicitudes probatorias y pretensiones.\n\nDATOS DEL CASO:\n${JSON.stringify(record)}\n\nDIAGNÓSTICO DETERMINÍSTICO:\n${JSON.stringify(base.assessment)}\n\nBIBLIOTECA JURÍDICA:\n${authorities}`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "legal_analysis",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                problem: { type: "string" },
                facts: { type: "string" },
                legalFramework: { type: "string" },
                application: { type: "string" },
                requests: { type: "string" },
                warnings: { type: "string" },
              },
              required: ["title", "problem", "facts", "legalFramework", "application", "requests", "warnings"],
            },
          },
        },
      }),
    });
    if (!response.ok) return NextResponse.json({ ...base, ai: { enabled: false, reason: `OpenAI ${response.status}` } });
    const data = await response.json();
    const outputText = data.output_text || data.output?.flatMap((item: any) => item.content || []).map((part: any) => part.text || "").join("") || "";
    let legalAnalysis: unknown = null;
    try { legalAnalysis = JSON.parse(outputText); } catch { legalAnalysis = null; }
    return NextResponse.json({ ...base, legalAnalysis: legalAnalysis || base.legalAnalysis, ai: { enabled: Boolean(legalAnalysis), model } });
  } catch (error) {
    return NextResponse.json({ error: "No fue posible analizar jurídicamente el caso", detail: error instanceof Error ? error.message : "unknown" }, { status: 400 });
  }
}
