import { getLegalContext, type LegalContextInput } from './legalKnowledgeBase';

export type LegalAiInput = LegalContextInput & {
  documentType: string;
  draftingInstructions?: string;
};

export type LegalReasoning = {
  legalIssues: string[];
  rightsAffected: string[];
  applicableRules: Array<{
    sourceId: string;
    citation: string;
    article: string | null;
    proposition: string;
  }>;
  jurisprudence: Array<{
    sourceId: string;
    citation: string;
    proposition: string;
  }>;
  arguments: Array<{
    title: string;
    factsApplied: string[];
    legalBasis: string[];
    conclusion: string;
    riskLevel: string;
  }>;
  draftingNotes: string[];
};

export type LegalAiResult = {
  engineVersion: string;
  provider: 'openai' | 'deterministic-fallback';
  model: string | null;
  libraryVersion: string;
  reasoning: LegalReasoning;
  draft: string;
  verified: boolean;
  verificationWarnings: string[];
};

const ENGINE_VERSION = 'legal-ai-engine-v1.1.0';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';

function compact(value: unknown, max = 12000) {
  const text = JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}\n...[truncado]` : text;
}

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  const chunks: string[] = [];
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === 'string') chunks.push(content.text);
    }
  }
  return chunks.join('\n');
}

function parseJson(text: string): any {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('La IA no devolvió un objeto JSON válido.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeReasoning(raw: any): LegalReasoning {
  return {
    legalIssues: Array.isArray(raw?.legalIssues) ? raw.legalIssues.map(String) : [],
    rightsAffected: Array.isArray(raw?.rightsAffected) ? raw.rightsAffected.map(String) : [],
    applicableRules: Array.isArray(raw?.applicableRules) ? raw.applicableRules.map((item: any) => ({
      sourceId: String(item?.sourceId ?? ''),
      citation: String(item?.citation ?? ''),
      article: item?.article == null ? null : String(item.article),
      proposition: String(item?.proposition ?? ''),
    })) : [],
    jurisprudence: Array.isArray(raw?.jurisprudence) ? raw.jurisprudence.map((item: any) => ({
      sourceId: String(item?.sourceId ?? ''),
      citation: String(item?.citation ?? ''),
      proposition: String(item?.proposition ?? ''),
    })) : [],
    arguments: Array.isArray(raw?.arguments) ? raw.arguments.map((item: any) => ({
      title: String(item?.title ?? ''),
      factsApplied: Array.isArray(item?.factsApplied) ? item.factsApplied.map(String) : [],
      legalBasis: Array.isArray(item?.legalBasis) ? item.legalBasis.map(String) : [],
      conclusion: String(item?.conclusion ?? ''),
      riskLevel: String(item?.riskLevel ?? 'requires_verification'),
    })) : [],
    draftingNotes: Array.isArray(raw?.draftingNotes) ? raw.draftingNotes.map(String) : [],
  };
}

function deterministicDraft(input: LegalAiInput, reasoning: LegalReasoning) {
  const issues = reasoning.legalIssues.length ? reasoning.legalIssues.join('; ') : 'No se identificaron problemas jurídicos suficientes con la información disponible.';
  const rules = reasoning.applicableRules.map((r) => `${r.citation}${r.article ? `, artículo ${r.article}` : ''}: ${r.proposition}`).join('\n');
  const argumentsText = reasoning.arguments.map((a) => `## ${a.title}\n${a.conclusion}`).join('\n\n');
  return [
    `ASUNTO: ${input.documentType}`,
    '',
    'ANÁLISIS JURÍDICO PRELIMINAR',
    issues,
    '',
    'FUNDAMENTOS NORMATIVOS IDENTIFICADOS',
    rules || 'No existen reglas verificadas en la biblioteca jurídica para este caso.',
    '',
    'ARGUMENTACIÓN',
    argumentsText || 'La información disponible no permite construir una argumentación jurídica concluyente.',
    '',
    'ADVERTENCIA DE CALIDAD',
    'Este texto se construye únicamente con fuentes disponibles en la biblioteca jurídica versionada. La automatización no garantiza el resultado del trámite.',
  ].join('\n');
}

function validateReasoning(raw: any, context: Awaited<ReturnType<typeof getLegalContext>>) {
  const allowedSources = new Map(context.statutes.concat(context.jurisprudence).map((source) => [source.id, source]));
  const warnings: string[] = [];
  const reasoning = normalizeReasoning(raw);

  reasoning.applicableRules = reasoning.applicableRules.filter((rule) => {
    const valid = allowedSources.has(rule.sourceId) && allowedSources.get(rule.sourceId)?.citation === rule.citation;
    if (!valid) warnings.push(`Se descartó una regla no verificable: ${rule.citation || rule.sourceId}.`);
    return valid;
  });
  reasoning.jurisprudence = reasoning.jurisprudence.filter((item) => {
    const valid = allowedSources.has(item.sourceId) && allowedSources.get(item.sourceId)?.citation === item.citation;
    if (!valid) warnings.push(`Se descartó una referencia jurisprudencial no verificable: ${item.citation || item.sourceId}.`);
    return valid;
  });

  return { reasoning, warnings };
}

export async function runLegalAiEngine(input: LegalAiInput): Promise<LegalAiResult> {
  const context = await getLegalContext(input);

  if (!process.env.OPENAI_API_KEY) {
    const reasoning = normalizeReasoning({
      legalIssues: context.arguments.map((a) => a.title),
      rightsAffected: [],
      applicableRules: context.rules.map((rule) => ({
        sourceId: rule.source_id,
        citation: context.statutes.find((s) => s.id === rule.source_id)?.citation ?? '',
        article: rule.article,
        proposition: rule.rule_text,
      })),
      jurisprudence: context.jurisprudence.map((source) => ({ sourceId: source.id, citation: source.citation, proposition: 'Fuente jurisprudencial disponible; requiere selección contextual.' })),
      arguments: context.arguments.map((a) => ({ title: a.title, factsApplied: [], legalBasis: [], conclusion: a.argument_text, riskLevel: a.risk_level })),
      draftingNotes: ['OPENAI_API_KEY no está configurada; se utilizó fallback determinístico.'],
    });
    return { engineVersion: ENGINE_VERSION, provider: 'deterministic-fallback', model: null, libraryVersion: context.libraryVersion, reasoning, draft: deterministicDraft(input, reasoning), verified: true, verificationWarnings: [] };
  }

  const system = `Eres el motor jurídico de TrámiteYa. Relaciona hechos del usuario con LEGAL_CONTEXT, una biblioteca jurídica colombiana versionada. NO inventes normas, artículos, sentencias, radicados, fechas ni hechos. Solo puedes usar fuentes que aparezcan en LEGAL_CONTEXT. No prometas resultados. Devuelve exclusivamente JSON válido con: legalIssues, rightsAffected, applicableRules, jurisprudence, arguments, draftingNotes, draft y citationsUsed. citationsUsed debe contener únicamente los sourceId realmente usados. El campo draft debe ser el escrito jurídico solicitado, pero solo con fundamentos presentes en LEGAL_CONTEXT.`;
  const prompt = `${system}\n\nDOCUMENT_TYPE:\n${input.documentType}\n\nFACTS:\n${compact(input.facts)}\n\nLEGAL_CONTEXT:\n${compact(context)}\n\nDRAFTING_INSTRUCTIONS:\n${input.draftingInstructions ?? 'Relaciona los hechos con las normas y precedentes aplicables, explica la subsunción y redacta de forma profesional, clara y prudente.'}`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: DEFAULT_MODEL, input: prompt }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI respondió ${response.status}: ${detail.slice(0, 500)}`);
  }

  const payload = await response.json();
  const raw = parseJson(extractOutputText(payload));
  const { reasoning, warnings } = validateReasoning(raw, context);
  const allowedSourceIds = new Set(context.statutes.concat(context.jurisprudence).map((source) => source.id));
  const citationsUsed = Array.isArray(raw?.citationsUsed) ? raw.citationsUsed.map(String) : [];
  const invalidCitationIds = citationsUsed.filter((id: string) => !allowedSourceIds.has(id));
  if (invalidCitationIds.length) warnings.push('La IA reportó fuentes que no existen en la biblioteca jurídica; se activó el redactor seguro.');

  const aiDraft = typeof raw?.draft === 'string' ? raw.draft.trim() : '';
  const verified = warnings.length === 0 && invalidCitationIds.length === 0 && aiDraft.length > 100;
  const draft = verified ? aiDraft : deterministicDraft(input, reasoning);

  return { engineVersion: ENGINE_VERSION, provider: 'openai', model: DEFAULT_MODEL, libraryVersion: context.libraryVersion, reasoning, draft, verified, verificationWarnings: warnings };
}
