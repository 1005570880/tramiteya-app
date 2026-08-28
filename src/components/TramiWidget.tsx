'use client';

import React, { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';

type ComparendoContext = {
  numero?: string;
  fecha?: string;
  organismo?: string;
  municipio?: string;
  valor?: string | number;
  fechaResolucion?: string;
  fechaEjecutoria?: string;
  fechaMandamiento?: string;
  fechaNotificacionMandamiento?: string;
  placa?: string;
  codigoInfraccion?: string;
  estado?: string;
};

type Message = { id: number; role: 'user' | 'assistant'; text: string };
type GuidedAnswers = Record<string, string>;

type GuidedQuestion = {
  key: string;
  text: string;
  required?: boolean;
  skipLabel?: string;
};

const QUICK_REPLIES = [
  '💡 ¿Mi multa está prescrita?',
  '🏛️ ¿A dónde se envía este escrito?',
  '⚖️ ¿Qué pasa si me responden que NO?',
  '📑 ¿Qué significan los hechos de mi escrito?',
  '⏳ ¿Puedo pedir caducidad?',
  '⚖️ ¿Puedo alegar pérdida de fuerza ejecutoria?',
];

const DRAFT_KEY = 'tramiteya:draft:procedure:derecho-de-peticion-eliminar-multa';
const SIMIT_SESSION_KEY = 'tramiteya:simit-upload:v1';
const TRAMI_ANSWERS_KEY = 'tramiteya:trami-questionnaire:v1';

const GUIDED_QUESTIONS: GuidedQuestion[] = [
  { key: 'nombresCompletos', text: 'Empecemos. ¿Cuál es tu nombre y apellido completos?' },
  { key: 'correo', text: '¿A qué correo quieres que quede asociado el trámite?' },
  { key: 'telefono', text: '¿Cuál es tu número de teléfono? Si prefieres no suministrarlo, escribe “omitir”.', skipLabel: 'Omitir teléfono' },
  { key: 'notificacionComparendo', text: 'Sobre este comparendo: ¿recibiste alguna notificación de la actuación? Puedes responder “sí”, “no” o “no sé”. Si recuerdas la fecha, inclúyela.' },
  { key: 'notificacionResolucion', text: '¿Recibiste o conoces una resolución que te impusiera la multa? Responde “sí”, “no” o “no sé” y, si la conoces, indica la fecha.' },
  { key: 'mandamientoPago', text: '¿Alguna vez recibiste un mandamiento de pago o comunicación de cobro por esta multa? Responde “sí”, “no” o “no sé” y, si recuerdas la fecha, indícala.' },
  { key: 'ejecutoria', text: '¿Sabes cuándo quedó en firme la resolución que impuso la multa? Si no lo sabes, responde “no sé”.', skipLabel: 'No sé' },
  { key: 'pagoAcuerdo', text: '¿Has pagado esta multa o celebrado un acuerdo de pago? Responde “sí”, “no” o “no sé”.' },
  { key: 'objetivo', text: 'Última pregunta: ¿qué quieres que revisemos principalmente: prescripción, caducidad, pérdida de ejecutoriedad o una revisión integral?' },
];

function normalizeValue(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function readLiveContext(): ComparendoContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const rawDraft = window.localStorage.getItem(DRAFT_KEY);
    if (rawDraft) {
      const parsed = JSON.parse(rawDraft) as { data?: Record<string, unknown> };
      const data = parsed?.data || {};
      const nested = data.__simitRecord && typeof data.__simitRecord === 'object' ? data.__simitRecord as Record<string, unknown> : {};
      const value = data.valor ?? data.valor_multa ?? nested.value;
      const context: ComparendoContext = {
        numero: normalizeValue(data.numero_comparendo || data.numero_acto || nested.number),
        fecha: normalizeValue(data.fecha_comparendo || nested.date),
        organismo: normalizeValue(data.autoridad || data.entidad || nested.authority),
        municipio: normalizeValue(data.municipio || data.ciudad || nested.municipality),
        valor: normalizeValue(value),
        fechaResolucion: normalizeValue(data.fechaResolucion || nested.resolutionDate),
        fechaEjecutoria: normalizeValue(data.fechaEjecutoria),
        fechaMandamiento: normalizeValue(data.fechaMandamiento),
        fechaNotificacionMandamiento: normalizeValue(data.fechaNotificacionMandamiento),
        placa: normalizeValue(data.placa || nested.plate),
        codigoInfraccion: normalizeValue(data.codigoInfraccion || nested.infractionCode),
        estado: normalizeValue(data.estadoComparendo || nested.status),
      };
      if (context.numero || context.fecha || context.organismo) return context;
    }

    const rawSession = window.sessionStorage.getItem(SIMIT_SESSION_KEY);
    if (rawSession) {
      const session = JSON.parse(rawSession) as { records?: Array<Record<string, unknown>>; documentNumber?: string; selectedRecord?: Record<string, unknown> | null };
      const record = session.selectedRecord || (Array.isArray(session.records) && session.records.length === 1 ? session.records[0] : null);
      if (record) return {
        numero: normalizeValue(record.number),
        fecha: normalizeValue(record.date),
        organismo: normalizeValue(record.authority),
        municipio: normalizeValue(record.municipality),
        valor: normalizeValue(record.value),
        fechaResolucion: normalizeValue(record.resolutionDate),
        fechaEjecutoria: undefined,
        fechaMandamiento: undefined,
        fechaNotificacionMandamiento: undefined,
        placa: normalizeValue(record.plate),
        codigoInfraccion: normalizeValue(record.infractionCode),
        estado: normalizeValue(record.status),
      };
    }
  } catch {
    // Context is optional; malformed browser storage must never break the wizard.
  }
  return null;
}

function readGuidedAnswers(): GuidedAnswers {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(TRAMI_ANSWERS_KEY) || '{}');
    return parsed?.answers && typeof parsed.answers === 'object' ? parsed.answers : {};
  } catch {
    return {};
  }
}

function writeGuidedAnswers(answers: GuidedAnswers, complete = false) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(TRAMI_ANSWERS_KEY, JSON.stringify({ version: 1, answers, complete, updatedAt: new Date().toISOString() }));
  } catch {}
}

export default function TramiWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [liveContext, setLiveContext] = useState<ComparendoContext | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'assistant', text: 'Hola. Soy Trámi, tu copiloto legal. Puedo ayudarte a entender tu comparendo, revisar prescripción, caducidad o pérdida de ejecutoriedad y preparar contigo el escrito.' },
  ]);
  const [guidedIndex, setGuidedIndex] = useState<number | null>(null);
  const [guidedAnswers, setGuidedAnswers] = useState<GuidedAnswers>({});
  const [guidedComplete, setGuidedComplete] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initializedGuided = useRef(false);

  const isTrafficWizard = typeof window !== 'undefined' && window.location.pathname.includes('/formulario-simit');

  useEffect(() => {
    const refresh = () => {
      const next = readLiveContext();
      setLiveContext(next);
      if (isTrafficWizard && next?.numero && !initializedGuided.current) {
        const saved = readGuidedAnswers();
        setGuidedAnswers(saved);
        const savedComplete = (() => { try { return Boolean(JSON.parse(window.sessionStorage.getItem(TRAMI_ANSWERS_KEY) || '{}').complete); } catch { return false; } })();
        setGuidedComplete(savedComplete);
        if (!savedComplete) {
          initializedGuided.current = true;
          setOpen(true);
          setGuidedIndex(Math.min(Object.keys(saved).length, GUIDED_QUESTIONS.length - 1));
          if (Object.keys(saved).length === 0) {
            setMessages([{ id: Date.now(), role: 'assistant', text: `Perfecto. Ya seleccionaste el comparendo ${next.numero}. Ahora no tendrás que llenar más formularios: yo te haré unas preguntas breves, una por una, y con tus respuestas prepararé el escrito.\n\nPregunta 1 de ${GUIDED_QUESTIONS.length}: ${GUIDED_QUESTIONS[0].text}` }]);
          }
        }
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 700);
    window.addEventListener('storage', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('storage', refresh); };
  }, [isTrafficWizard]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const context = liveContext;
  const contextLabel = context?.numero
    ? `📍 Contexto: Comparendo ${context.numero}${context.municipio ? ` · ${context.municipio}` : context.organismo ? ` · ${context.organismo}` : ''}`
    : '📍 Contexto: Sin comparendo seleccionado';

  const currentQuestion = guidedIndex != null ? GUIDED_QUESTIONS[guidedIndex] : null;
  const guidedProgress = useMemo(() => guidedIndex == null ? 0 : guidedIndex + 1, [guidedIndex]);

  function appendAssistant(text: string) {
    setMessages((current) => [...current, { id: Date.now() + Math.random(), role: 'assistant', text }]);
  }

  function completeGuided(nextAnswers: GuidedAnswers) {
    setGuidedAnswers(nextAnswers);
    setGuidedComplete(true);
    setGuidedIndex(null);
    writeGuidedAnswers(nextAnswers, true);
    appendAssistant('Listo. Ya tengo lo necesario. Voy a cruzar tus respuestas con los datos del SIMIT y revisar **prescripción, caducidad y pérdida de ejecutoriedad** para determinar qué vías son viables.\n\nNo necesitas llenar otro formulario. Estoy preparando el documento con la información que acabas de suministrar.');
    window.dispatchEvent(new CustomEvent('trami:questionnaire-complete', { detail: { answers: nextAnswers, comparendo: context } }));
  }

  function answerGuided(text: string) {
    if (!currentQuestion || loading) return;
    const value = text.trim();
    if (!value) return;
    const nextAnswers = { ...guidedAnswers, [currentQuestion.key]: value };
    setInput('');
    setGuidedAnswers(nextAnswers);
    writeGuidedAnswers(nextAnswers, false);
    setMessages((current) => [...current, { id: Date.now(), role: 'user', text: value }]);
    const nextIndex = (guidedIndex ?? 0) + 1;
    if (nextIndex >= GUIDED_QUESTIONS.length) {
      completeGuided(nextAnswers);
      return;
    }
    setGuidedIndex(nextIndex);
    window.setTimeout(() => appendAssistant(`Pregunta ${nextIndex + 1} de ${GUIDED_QUESTIONS.length}: ${GUIDED_QUESTIONS[nextIndex].text}`), 120);
  }

  async function sendMessage(text = input) {
    const value = text.trim();
    if (!value || loading) return;
    if (guidedIndex != null && !guidedComplete) {
      answerGuided(value);
      return;
    }
    setInput('');
    setMessages((current) => [...current, { id: Date.now(), role: 'user', text: value }]);
    setLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: value, comparendo: context }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No fue posible obtener una respuesta.');
      setMessages((current) => [...current, { id: Date.now() + 1, role: 'assistant', text: payload.text }]);
    } catch (error) {
      setMessages((current) => [...current, { id: Date.now() + 1, role: 'assistant', text: error instanceof Error ? error.message : 'No fue posible responder en este momento.' }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); }
  }

  function submit(event: FormEvent) { event.preventDefault(); void sendMessage(); }

  if (!open) {
    return (
      <div className="fixed bottom-5 right-5 z-[100] flex items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className="group relative flex items-center gap-2 rounded-full border border-white/20 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-bold text-white shadow-2xl shadow-indigo-900/30 transition hover:-translate-y-0.5" aria-label="Hablar con Trámi">
          <span className="absolute -inset-1 -z-10 animate-pulse rounded-full bg-indigo-500/30 blur-md" />
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-xl">🤖</span>
          <span>{isTrafficWizard && context?.numero && !guidedComplete ? 'Continuar con Trámi 🤖' : 'Hablar con Trámi 🤖'}</span>
        </button>
      </div>
    );
  }

  return (
    <section className="fixed bottom-5 right-5 z-[100] flex h-[min(700px,calc(100vh-40px))] w-[min(440px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" aria-label="Trámi · Copiloto Legal">
      <header className="flex items-center justify-between bg-gradient-to-r from-indigo-700 to-violet-700 px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-xl">🤖</div>
          <div><div className="font-bold">Trámi · Copiloto Legal</div><div className="flex items-center gap-1.5 text-xs text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-300" />En línea</div></div>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1 text-xl hover:bg-white/10" aria-label="Minimizar">─</button>
      </header>
      <div className="border-b border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-medium text-indigo-800">{contextLabel}</div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
        {guidedIndex != null && !guidedComplete && <div className="sticky top-0 z-10 rounded-xl border border-indigo-100 bg-white/95 p-2.5 text-xs font-semibold text-indigo-700 shadow-sm backdrop-blur">Cuestionario Trámi · Pregunta {guidedProgress} de {GUIDED_QUESTIONS.length}</div>}
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${message.role === 'user' ? 'rounded-br-md bg-indigo-600 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-700 shadow-sm'}`}>
              {message.text}
            </div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">Trámi está analizando…</div></div>}
      </div>

      <div className="border-t border-slate-200 bg-white p-3">
        {guidedIndex != null && !guidedComplete ? (
          <div className="mb-2 flex justify-end">
            <button type="button" onClick={() => answerGuided(currentQuestion?.skipLabel || 'omitir')} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:bg-indigo-50">{currentQuestion?.skipLabel || 'No lo sé / omitir'}</button>
          </div>
        ) : (
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {QUICK_REPLIES.map((reply) => <button key={reply} type="button" disabled={loading} onClick={() => void sendMessage(reply.replace(/^\S+\s/, ''))} className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50">{reply}</button>)}
          </div>
        )}
        <form onSubmit={submit} className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-2 py-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
          <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} disabled={loading} placeholder={guidedIndex != null && !guidedComplete ? 'Responde aquí…' : 'Escribe tu pregunta…'} className="min-w-0 flex-1 bg-transparent px-2 text-sm text-slate-800 outline-none placeholder:text-slate-400" aria-label="Mensaje para Trámi" autoFocus={guidedIndex != null && !guidedComplete} />
          <button type="submit" disabled={!input.trim() || loading} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-40" aria-label="Enviar">➤</button>
        </form>
        <p className="mt-2 text-center text-[10px] text-slate-400">Trámi orienta y organiza la información; la autoridad competente decide.</p>
      </div>
    </section>
  );
}
