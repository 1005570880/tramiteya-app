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

function developedLibrary(authorities: ReturnType<typeof selectLegalAuthorities>) {
  return authorities.map((a) => [
    `${a.source} — ${a.provision}`,
    `REGLA: ${a.rule}`,
    `DESARROLLO: ${a.development}`,
    `APLICACIÓN: ${a.application}`,
    a.precedent ? `PRECEDENTE/CRITERIO: ${a.precedent}` : "",
  ].filter(Boolean).join("\n")).join("\n\n");
}

export async function POST(request: Request) {
  try {
    const parsed = RecordSchema.parse(await request.json());
    const record = parsed as SelectedRecordData;
    const base = deterministic(record);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ ...base, ai: { enabled: false, reason: "OPENAI_API_KEY no configurada" } });

    const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";
    const library = developedLibrary(base.legalAnalysis.authorities);
    const prompt = `Actúa como motor jurídico de apoyo para un abogado colombiano. Analiza exclusivamente los datos suministrados y la biblioteca jurídica controlada. No inventes hechos, fechas, notificaciones, resoluciones ni actuaciones. Distingue hechos acreditados, inferencias y datos que deben ser solicitados a la autoridad.

REGLA CRÍTICA DE CLASIFICACIÓN: si el registro ya evidencia una sanción/multa, estado de cobro, resolución, audiencia o identificador sancionatorio, NO declares caducidad de la actuación contravencional como hecho ni como ruta automática. La caducidad del artículo 161 se refiere a la acción contravencional y al término para decidir sobre la imposición de la sanción. En un registro ya sancionado, concentra el análisis en el acto sancionatorio, ejecutoria, notificación, prescripción, cobro, fuerza ejecutoria y eventuales vicios.

La prescripción del artículo 159 de la Ley 769 de 2002 debe analizarse con la fecha del hecho, la existencia y notificación del mandamiento de pago y las actuaciones posteriores. No afirmes prescripción por el simple paso del tiempo. La pérdida de fuerza ejecutoria exige identificar el acto en firme, su fecha de firmeza y las actuaciones de ejecución durante el periodo legal. La revocatoria directa debe plantearse con causal concreta y de forma subsidiaria cuando corresponda.

REQUISITO DE PROFUNDIDAD: no te limites a enumerar normas. Para cada norma o precedente materialmente pertinente explica: (1) qué regla contiene, (2) qué significa jurídicamente, (3) qué requisito probatorio activa su aplicación y (4) cómo se conecta con los hechos disponibles. No conviertas la biblioteca en una lista de citas.

REQUISITO DE SEGURIDAD: SIMIT sirve para individualizar y conocer el estado reportado, pero no reemplaza el expediente administrativo. No presumas que hubo o no hubo audiencia, notificación, ejecutoria o cobro cuando el dato no esté acreditado.

Produce un fundamento jurídico sustancial, organizado y apto para incorporarse a un derecho de petición: problema jurídico, hechos relevantes, marco normativo desarrollado, precedentes desarrollados, aplicación al caso, carga documental y solicitudes/pretensiones.

DATOS DEL CASO:
${JSON.stringify(record)}

DIAGNÓSTICO DETERMINÍSTICO:
${JSON.stringify(base.assessment)}

BIBLIOTECA JURÍDICA DESARROLLADA:
${library}`;

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
    let parsedAnalysis: any = null;
    try { parsedAnalysis = JSON.parse(outputText); } catch { parsedAnalysis = null; }

    if (!parsedAnalysis) return NextResponse.json({ ...base, ai: { enabled: false, reason: "La IA no devolvió una estructura jurídica válida" } });

    // La IA puede enriquecer el análisis, pero nunca reemplaza el fundamento
    // determinístico construido desde la biblioteca jurídica controlada.
    const mergedLegalFramework = [
      base.fundamentos,
      "",
      "IX. ENRIQUECIMIENTO MEDIANTE IA",
      parsedAnalysis.legalFramework || "",
    ].filter(Boolean).join("\n");

    const legalAnalysis = {
      ...parsedAnalysis,
      legalFramework: mergedLegalFramework,
      application: [base.assessment.reasoning.join(" "), parsedAnalysis.application || ""].filter(Boolean).join("\n\n"),
      authorities: base.legalAnalysis.authorities,
      deterministicConclusion: base.legalAnalysis.conclusion,
      caveat: base.legalAnalysis.caveat,
    };

    return NextResponse.json({ ...base, legalAnalysis, ai: { enabled: true, model } });
  } catch (error) {
    return NextResponse.json({ error: "No fue posible analizar jurídicamente el caso", detail: error instanceof Error ? error.message : "unknown" }, { status: 400 });
  }
}
