import { NextResponse } from "next/server";
import { z } from "zod";
import { selectLegalAuthorities } from "../../../../lib/legalLibrary";
import { assessTrafficRecord, generateLegalDraft, type SelectedRecordData } from "../../../../lib/legalEngine";

const RecordSchema = z.object({
  comparendo: z.string().optional().default(""), fecha: z.string().optional().default(""), organismo: z.string().optional().default(""), estado: z.string().optional().default(""), valor: z.string().optional().default(""),
  placa: z.string().optional(), cedula: z.string().optional(), codigo: z.string().optional(), fechaResolucion: z.string().optional(), fechaNotificacion: z.string().optional(), fechaMandamientoPago: z.string().optional(), fechaNotificacionMandamiento: z.string().optional(), fechaEjecutoria: z.string().optional(),
  actuacionesCobro: z.string().optional(), huboAudiencia: z.union([z.boolean(), z.string()]).optional(), existeResolucion: z.union([z.boolean(), z.string()]).optional(),
});

function deterministic(record: SelectedRecordData) {
  const draft = generateLegalDraft(record);
  const authorities = selectLegalAuthorities(draft.assessment.routes, `${draft.fundamentos} ${record.estado}`);
  const temporal = draft.assessment.temporal;
  return {
    ...draft,
    legalAnalysis: {
      conclusion: temporal?.temporalConclusion || `Ruta principal: ${draft.assessment.primaryRoute || "REVISIÓN INTEGRAL"}.`,
      certainty: draft.assessment.certainty,
      confidence: draft.assessment.certainty === "CONFIGURADO" || draft.assessment.certainty === "NO_CONFIGURADO" ? "alta" : "media",
      authorities,
      timeline: temporal?.events || [],
      scenarios: temporal?.scenarios || [],
      facts: temporal?.facts || [],
      inferences: temporal?.inferences || [],
      rules: temporal?.rules || [],
      evidenceQuestions: temporal?.evidenceQuestions || draft.assessment.missingEvidence,
      application: draft.fundamentos,
      caveat: "Una fecha calculada no equivale a una fecha probada. Las conclusiones condicionadas a actuaciones no acreditadas deben mantenerse expresamente como escenarios jurídicos.",
    },
  };
}

function developedLibrary(authorities: ReturnType<typeof selectLegalAuthorities>) {
  return authorities.map((a) => [
    `${a.source} — ${a.provision}`,
    `Contenido jurídico: ${a.rule}`,
    `Alcance: ${a.development}`,
    `Conexión con el caso: ${a.application}`,
    a.precedent ? `Jurisprudencia y criterio: ${a.precedent}` : "",
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
    const prompt = `Actúa como abogado colombiano especializado en derecho administrativo sancionatorio y tránsito. Vas a preparar el fundamento de un derecho de petición para un caso individual. El funcionario debe poder seguir tu razonamiento y verificar cada afirmación.

REGLA ABSOLUTA DE EVIDENCIA: trabaja exclusivamente con los datos del caso y la biblioteca jurídica suministrada. No inventes fechas, resoluciones, ejecutorias, audiencias, notificaciones, pagos, embargos, acuerdos ni actuaciones de cobro. Distingue siempre entre HECHO ACREDITADO, INFERENCIA/CÁLCULO y HECHO PENDIENTE DE PRUEBA.

REGLA DE CÓMPUTO: si existe fecha del hecho, calcula expresamente el término de tres años previsto por el artículo 159 de la Ley 769 de 2002 y muestra la fecha de vencimiento. Ejemplo de lógica: hecho 17/07/2012 → vencimiento inicial calculado 17/07/2015. Si no existe fecha de notificación del mandamiento, no supongas que ocurrió; explica que su existencia y fecha son determinantes.

REGLA DE ESCENARIOS: cuando falte la notificación del mandamiento, analiza al menos estos escenarios: (1) no hubo actuación interruptiva acreditada antes del vencimiento; (2) hubo mandamiento notificado válidamente antes del vencimiento; (3) la primera notificación eficaz ocurrió después del vencimiento. Explica la consecuencia jurídica de cada escenario sin convertir una hipótesis en hecho probado.

REGLA DE CADUCIDAD: si el registro evidencia multa/sanción, resolución, audiencia, estado de cobro o identificador sancionatorio, no presentes el artículo 161 como si el comparendo siguiera pendiente de decisión. En ese supuesto analiza acto sancionatorio, firmeza, notificación, exigibilidad, prescripción, cobro y fuerza ejecutoria. Si no hay sanción acreditada, analiza la caducidad confrontando la fecha del hecho con la fecha de decisión.

REGLA DE NOTIFICACIÓN: la ausencia de una fecha en SIMIT no demuestra que jamás se notificó. Identifica exactamente qué constancia falta, por qué importa y qué debe aportar la autoridad.

REGLA DE JURISPRUDENCIA: no hagas una lista de sentencias. Para cada precedente pertinente explica qué problema resolvió, qué criterio fijó y por qué ese criterio es aplicable a este caso. Usa únicamente precedentes presentes en la biblioteca.

REGLA DE PETICIONES: cada petición debe derivarse de una cuestión jurídica o probatoria identificada. Si falta una prueba crítica, solicita esa prueba y formula la consecuencia para el escenario en que la autoridad no pueda acreditarla. No solicites una declaración definitiva si los datos solo permiten una hipótesis objetiva.

ESTILO: prosa forense natural, firme y profesional. No menciones IA, motor, algoritmo, automatización ni biblioteca. No uses fórmulas vacías como “consulte el expediente” sin explicar qué actuación debe verificarse y qué efecto tendría. El escrito debe demostrar que el abogado hizo la cuenta y entendió el problema.

ESTRUCTURA: III. PROBLEMA JURÍDICO; IV. FUNDAMENTOS DE DERECHO; 4.1 Norma aplicable; 4.2 Cómputo del término en el caso concreto; 4.3 Actuaciones interruptivas y efectos de la notificación; 4.4 Hechos acreditados, inferencias y prueba pendiente; 4.5 Jurisprudencia aplicada al caso; 4.6 Escenarios jurídicos posibles; V. ANÁLISIS DEL CASO CONCRETO; VI. CONCLUSIÓN JURÍDICA; VII. DOCUMENTOS NECESARIOS PARA VERIFICAR LA ACTUACIÓN.

DATOS DEL CASO:
${JSON.stringify(record)}

DIAGNÓSTICO JURÍDICO DETERMINÍSTICO:
${JSON.stringify(base.assessment)}

BIBLIOTECA JURÍDICA CONTROLADA:
${library}`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, input: prompt, text: { format: { type: "json_schema", name: "legal_analysis", strict: true, schema: {
        type: "object", additionalProperties: false,
        properties: { title: { type: "string" }, problem: { type: "string" }, facts: { type: "string" }, legalFramework: { type: "string" }, application: { type: "string" }, requests: { type: "string" }, warnings: { type: "string" } },
        required: ["title", "problem", "facts", "legalFramework", "application", "requests", "warnings"],
      } } } }),
    });
    if (!response.ok) return NextResponse.json({ ...base, ai: { enabled: false, reason: `OpenAI ${response.status}` } });

    const data = await response.json();
    const outputText = data.output_text || data.output?.flatMap((item: any) => item.content || []).map((part: any) => part.text || "").join("") || "";
    let parsedAnalysis: any = null;
    try { parsedAnalysis = JSON.parse(outputText); } catch { parsedAnalysis = null; }
    if (!parsedAnalysis) return NextResponse.json({ ...base, ai: { enabled: false, reason: "La IA no devolvió una estructura jurídica válida" } });

    const legalFramework = [parsedAnalysis.legalFramework || "", parsedAnalysis.application ? `\n\nV. ANÁLISIS DEL CASO CONCRETO\n${parsedAnalysis.application}` : ""].filter(Boolean).join("").trim();
    const legalAnalysis = {
      ...base.legalAnalysis,
      ...parsedAnalysis,
      legalFramework,
      application: parsedAnalysis.application || base.legalAnalysis.application,
      authorities: base.legalAnalysis.authorities,
      deterministicConclusion: base.legalAnalysis.conclusion,
      deterministicAssessment: base.assessment,
      timeline: base.legalAnalysis.timeline,
      scenarios: base.legalAnalysis.scenarios,
      certainty: base.legalAnalysis.certainty,
      evidenceQuestions: base.legalAnalysis.evidenceQuestions,
      caveat: base.legalAnalysis.caveat,
    };
    return NextResponse.json({ ...base, legalAnalysis, ai: { enabled: true, model } });
  } catch (error) {
    return NextResponse.json({ error: "No fue posible analizar jurídicamente el caso", detail: error instanceof Error ? error.message : "unknown" }, { status: 400 });
  }
}
