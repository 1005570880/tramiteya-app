import { NextResponse } from "next/server";
import { z } from "zod";
import { selectLegalAuthorities } from "../../../../lib/legalLibrary";
import { assessTrafficRecord, generateLegalDraft, type SelectedRecordData } from "../../../../lib/legalEngine";

const RecordSchema = z.object({
  comparendo: z.string().optional().default(""), fecha: z.string().optional().default(""), organismo: z.string().optional().default(""), estado: z.string().optional().default(""), valor: z.string().optional().default(""),
  placa: z.string().optional(), cedula: z.string().optional(), codigo: z.string().optional(), fechaResolucion: z.string().optional(), fechaNotificacion: z.string().optional(), fechaMandamientoPago: z.string().optional(),
  huboAudiencia: z.union([z.boolean(), z.string()]).optional(), existeResolucion: z.union([z.boolean(), z.string()]).optional(),
});

function deterministic(record: SelectedRecordData) {
  const draft = generateLegalDraft(record);
  const authorities = selectLegalAuthorities(draft.assessment.routes, `${draft.fundamentos} ${record.estado}`);
  return { ...draft, legalAnalysis: { conclusion: `Ruta principal: ${draft.assessment.primaryRoute || "REVISIÓN INTEGRAL"}.`, confidence: draft.assessment.missingEvidence.length ? "media" : "alta", authorities, caveat: "Las conclusiones que dependan de fechas o actuaciones no visibles en SIMIT quedan condicionadas a la verificación del expediente administrativo." } };
}

function developedLibrary(authorities: ReturnType<typeof selectLegalAuthorities>) {
  return authorities.map((a) => [
    `${a.source} — ${a.provision}`,
    `Fuente jurídica: ${a.source}, ${a.provision}.`,
    `Contenido jurídico: ${a.rule}`,
    `Alcance: ${a.development}`,
    `Conexión con el caso: ${a.application}`,
    a.precedent ? `Criterio jurisprudencial: ${a.precedent}` : "",
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
    const prompt = `Actúa como un abogado colombiano que prepara un derecho de petición administrativo para ser presentado ante una autoridad de tránsito. El texto final será leído por un funcionario, no por un programador. Debe sonar escrito por un abogado que estudió el expediente, no por una plantilla ni por una inteligencia artificial.

TRABAJA SOLO CON LOS DATOS DEL CASO Y CON LA BIBLIOTECA JURÍDICA SUMINISTRADA. No inventes hechos, fechas, resoluciones, audiencias, notificaciones, recursos, pagos, embargos ni actuaciones de cobro. Cuando un dato no esté acreditado, dilo con naturalidad y conviértelo en una solicitud de verificación documental.

REGLA CRÍTICA SOBRE CADUCIDAD: si el registro ya evidencia una multa/sanción, estado de cobro, resolución, audiencia o identificador sancionatorio, NO presentes la caducidad del artículo 161 como si el comparendo siguiera pendiente de decisión. En ese escenario, explica que la discusión debe concentrarse en el acto sancionatorio, su firmeza, notificación, exigibilidad, prescripción, cobro, fuerza ejecutoria y vicios concretos que puedan demostrarse.

REGLA CRÍTICA SOBRE PRESCRIPCIÓN: el artículo 159 de la Ley 769 de 2002 no debe aplicarse contando mecánicamente tres años desde la fecha visible en SIMIT. Reconstruye la secuencia hecho → sanción → firmeza → mandamiento de pago → notificación del mandamiento → actuaciones posteriores. Si faltan datos, solicita el expediente antes de afirmar que la obligación prescribió.

PROFUNDIDAD JURÍDICA: no te limites a mencionar normas. Explica su sentido dentro del sistema jurídico, qué protege, qué presupuesto debe estar probado para aplicarla y por qué ese presupuesto importa en este caso. Cuando exista un precedente de la biblioteca, explica su criterio y luego conecta ese criterio con la situación concreta. No hagas una colección de fichas normativas.

ESTILO FORENSE: escribe en prosa jurídica natural, sobria y convincente. Alterna la extensión de los párrafos. Usa transiciones propias de un escrito profesional: “En este punto”, “Ahora bien”, “De ahí que”, “Bajo esa consideración”, “Por lo anterior”, “No puede perderse de vista”. Evita frases de manual como “la regla es”, “el desarrollo es”, “la aplicación al caso es”. Evita repetir “resulta relevante”, “permite”, “corresponde” en cada párrafo. No menciones IA, motor jurídico, biblioteca jurídica, algoritmo, automatización ni “análisis determinístico” dentro del texto destinado al ciudadano.

ESTRUCTURA DEL TEXTO: entrega un fundamento jurídico completo, listo para incorporarse al documento, con estos títulos y subtítulos cuando sean pertinentes:
III. PROBLEMA JURÍDICO
IV. FUNDAMENTOS JURÍDICOS
4.1. Garantías constitucionales y debido proceso
4.2. Régimen especial de tránsito aplicable
4.3. Notificación, ejecutoria y eficacia del acto administrativo
4.4. Prescripción, cobro coactivo y fuerza ejecutoria
V. ANÁLISIS DEL CASO CONCRETO
VI. CONCLUSIÓN JURÍDICA
VII. DOCUMENTOS NECESARIOS PARA VERIFICAR LA ACTUACIÓN
No fuerces un subtítulo si la información no lo justifica. Si una materia no aplica, omítela.

IMPORTANTE: la biblioteca es una fuente de trabajo controlada. Conserva las referencias normativas y jurisprudenciales que realmente sean pertinentes, pero intégralas dentro del razonamiento. El resultado debe poder leerse de corrido como un escrito jurídico serio.

DATOS DEL CASO:
${JSON.stringify(record)}

DIAGNÓSTICO PRELIMINAR:
${JSON.stringify(base.assessment)}

BIBLIOTECA JURÍDICA:
${library}`;

    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, input: prompt, text: { format: { type: "json_schema", name: "legal_analysis", strict: true, schema: { type: "object", additionalProperties: false, properties: { title: { type: "string" }, problem: { type: "string" }, facts: { type: "string" }, legalFramework: { type: "string" }, application: { type: "string" }, requests: { type: "string" }, warnings: { type: "string" } }, required: ["title", "problem", "facts", "legalFramework", "application", "requests", "warnings"] } } } }) });
    if (!response.ok) return NextResponse.json({ ...base, ai: { enabled: false, reason: `OpenAI ${response.status}` } });

    const data = await response.json();
    const outputText = data.output_text || data.output?.flatMap((item: any) => item.content || []).map((part: any) => part.text || "").join("") || "";
    let parsedAnalysis: any = null;
    try { parsedAnalysis = JSON.parse(outputText); } catch { parsedAnalysis = null; }
    if (!parsedAnalysis) return NextResponse.json({ ...base, ai: { enabled: false, reason: "La IA no devolvió una estructura jurídica válida" } });

    const legalFramework = [parsedAnalysis.legalFramework || "", parsedAnalysis.application ? `\n\nV. ANÁLISIS DEL CASO CONCRETO\n${parsedAnalysis.application}` : ""].filter(Boolean).join("").trim();
    const legalAnalysis = { ...parsedAnalysis, legalFramework, application: parsedAnalysis.application || base.assessment.reasoning.join(" "), authorities: base.legalAnalysis.authorities, deterministicConclusion: base.legalAnalysis.conclusion, caveat: base.legalAnalysis.caveat };
    return NextResponse.json({ ...base, legalAnalysis, ai: { enabled: true, model } });
  } catch (error) {
    return NextResponse.json({ error: "No fue posible analizar jurídicamente el caso", detail: error instanceof Error ? error.message : "unknown" }, { status: 400 });
  }
}

// Humanización jurídica: las fuentes se conservan, pero el texto final se integra como argumentación continua.
