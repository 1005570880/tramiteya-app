import { getLegalContext, type LegalContextInput } from './legalKnowledgeBase';

export type LegalAiInput = LegalContextInput & {
  documentType: string;
  draftingInstructions?: string;
};

export type LegalAiResult = {
  provider: 'openai' | 'deterministic-fallback';
  model: string | null;
  libraryVersion: string;
  draft: string;
  verified: boolean;
  verificationWarnings: string[];
  citationsUsed: string[];
};

function compact(value: unknown, max = 18000) {
  const text = JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}\n...[truncado]` : text;
}

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  return (payload?.output ?? []).flatMap((item: any) => item?.content ?? []).map((c: any) => c?.text).filter(Boolean).join('\n');
}

function parseJson(text: string): any {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('La IA no devolvió JSON válido.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function sanitizeDraft(draft: string) {
  return draft
    .replace(/\n?FUNDAMENTO NORMATIVO DE REFERENCIA[\s\S]*$/i, '')
    .replace(/\n?CRITERIO DE SELECCIÓN[\s\S]*$/i, '')
    .replace(/\n?ADVERTENCIA DE REVISIÓN[\s\S]*$/i, '')
    .replace(/\n?LEGAL_CONTEXT[\s\S]*$/i, '')
    .replace(/\n?Fuente:\s*https?:\/\/\S+/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function fallbackDraft(input: LegalAiInput, context: Awaited<ReturnType<typeof getLegalContext>>) {
  const sourceById = new Map(context.statutes.concat(context.jurisprudence).map((source) => [source.id, source]));
  const rules = context.rules
    .map((r) => {
      const source = sourceById.get(r.source_id);
      const citation = source?.citation || source?.title || r.source_id;
      return `${citation}${r.article ? `, ${r.article}` : ''}: ${r.rule_text}`;
    })
    .join('\n');

  return [
    input.documentType.toUpperCase(),
    '',
    'FUNDAMENTOS JURÍDICOS',
    rules || 'No se encontraron reglas suficientes en la biblioteca jurídica para construir una fundamentación automática segura.',
  ].join('\n');
}

export async function runLegalAiEngine(input: LegalAiInput): Promise<LegalAiResult> {
  const context = await getLegalContext(input);
  const allowed = new Map([...context.statutes, ...context.jurisprudence].map((s) => [s.id, s]));
  const model = process.env.OPENAI_MODEL || null;

  if (!process.env.OPENAI_API_KEY || !model) {
    return {
      provider: 'deterministic-fallback',
      model: null,
      libraryVersion: context.libraryVersion,
      draft: fallbackDraft(input, context),
      verified: true,
      verificationWarnings: ['La IA no está configurada; se utilizó el contexto jurídico versionado sin generación probabilística.'],
      citationsUsed: context.statutes.concat(context.jurisprudence).map((s) => s.id),
    };
  }

  const system = `Eres el motor jurídico de TrámiteYa para Colombia. Tu tarea es relacionar los hechos concretos con la biblioteca jurídica proporcionada y redactar un documento jurídico utilizable. REGLAS ABSOLUTAS: no inventes hechos, normas, artículos, sentencias, radicados, fechas ni autoridades; solo puedes citar sourceId presentes en LEGAL_CONTEXT; no conviertas una hipótesis en un hecho probado; si falta información, formula una pregunta o utiliza una redacción prudente; no incluyas URLs, fuentes, metadatos internos ni explicaciones sobre el motor dentro de DRAFT. Devuelve únicamente JSON con draft y citationsUsed.`;
  const prompt = `${system}\n\nTIPO DE DOCUMENTO:\n${input.documentType}\n\nHECHOS Y RESPUESTAS:\n${compact(input.facts)}\n\nLEGAL_CONTEXT:\n${compact(context)}\n\nINSTRUCCIONES:\n${input.draftingInstructions ?? 'Construye la argumentación mediante norma + regla jurisprudencial + hecho acreditado + aplicación al caso + conclusión. Mantén estructura jurídica profesional colombiana.'}`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, input: prompt }),
  });
  if (!response.ok) throw new Error(`OpenAI respondió ${response.status}.`);

  const payload = await response.json();
  const raw = parseJson(extractOutputText(payload));
  const citationsUsed = Array.isArray(raw?.citationsUsed) ? raw.citationsUsed.map(String) : [];
  const invalid = citationsUsed.filter((id: string) => !allowed.has(id));
  const warnings: string[] = [];
  if (invalid.length) warnings.push(`La IA intentó usar fuentes no presentes en la biblioteca: ${invalid.join(', ')}.`);

  const draft = sanitizeDraft(typeof raw?.draft === 'string' ? raw.draft : '');
  if (draft.length < 200) warnings.push('La IA no produjo un documento suficientemente extenso.');

  const verified = warnings.length === 0 && draft.length >= 200;
  return {
    provider: 'openai',
    model,
    libraryVersion: context.libraryVersion,
    draft: verified ? draft : fallbackDraft(input, context),
    verified,
    verificationWarnings: warnings,
    citationsUsed: citationsUsed.filter((id: string) => allowed.has(id)),
  };
}
