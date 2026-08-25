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

function trafficCitationWarnings(draft: string, input: LegalAiInput) {
  const traffic = input.vertical === 'transito' || /tr[aá]nsito|comparendo|multa|fotomulta|prescripci[oó]n-comparendo|caducidad-comparendo/i.test(`${input.vertical} ${input.procedure}`);
  if (!traffic) return [];

  const warnings: string[] = [];
  const text = draft.toLowerCase();
  const fiveYears = /cinco\s*\(?5\)?\s*años|5\s*años/;
  const art91Num5 = /art(?:í|i)culo\s*91\s*(?:,|del)?\s*numeral\s*5|art\.?\s*91\s*(?:,|del)?\s*numeral\s*5/;
  const oldArt159 = /art(?:í|i)culo\s*159[^.\n]{0,180}(presentaci[oó]n\s+de\s+la\s+demanda|interrumpir[aá].{0,30}demanda)/;

  if (art91Num5.test(text) && fiveYears.test(text)) {
    warnings.push('Citación jurídica inválida: los cinco años corresponden al artículo 91 numeral 3 del CPACA, no al numeral 5.');
  }
  if (oldArt159.test(text)) {
    warnings.push('Citación jurídica desactualizada: para el texto vigente del artículo 159 de la Ley 769 de 2002, la interrupción de la prescripción ocurre con la notificación del mandamiento de pago.');
  }
  if (/art(?:í|i)culo\s*159/.test(text) && /prescrib.{0,80}cinco\s*años/.test(text)) {
    warnings.push('Citación jurídica inválida: el término especial del artículo 159 de la Ley 769 de 2002 es de tres años, sujeto a sus reglas de interrupción.');
  }
  return warnings;
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

  const system = `Eres el motor jurídico de TrámiteYa para Colombia. Relaciona hechos concretos con la biblioteca jurídica proporcionada y redacta un documento jurídico utilizable. REGLAS ABSOLUTAS: no inventes hechos, normas, artículos, sentencias, radicados, fechas ni autoridades; solo puedes citar sourceId presentes en LEGAL_CONTEXT; no conviertas una hipótesis en un hecho probado; si falta información, formula una pregunta o utiliza una redacción prudente; no incluyas URLs, fuentes, metadatos internos ni explicaciones sobre el motor dentro de DRAFT.\n\nCONTROL ESPECIAL PARA TRÁNSITO: el artículo 159 de la Ley 769 de 2002 establece un término de tres (3) años desde la ocurrencia del hecho y que la prescripción se interrumpe con la notificación del mandamiento de pago; el artículo 818 del Estatuto Tributario regula los efectos de la interrupción y el reinicio del término de la acción de cobro; el artículo 91 numeral 3 del CPACA es la causal de cinco (5) años por inactividad de la autoridad respecto de un acto en firme; el artículo 91 numeral 5 se refiere a pérdida de vigencia y NO es la causal de los cinco años. Nunca atribuyas los cinco años al numeral 5. No uses el texto histórico del artículo 159 que hablaba de interrupción con la presentación de la demanda. Devuelve únicamente JSON con draft y citationsUsed.`;
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
  warnings.push(...trafficCitationWarnings(draft, input));
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
