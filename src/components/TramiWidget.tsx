'use client';

import React, { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';

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
};

type Message = { id: number; role: 'user' | 'assistant'; text: string };

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
        numero: String(data.numero_comparendo || data.numero_acto || nested.number || '').trim() || undefined,
        fecha: String(data.fecha_comparendo || nested.date || '').trim() || undefined,
        organismo: String(data.autoridad || data.entidad || nested.authority || '').trim() || undefined,
        municipio: String(data.municipio || data.ciudad || nested.municipality || '').trim() || undefined,
        valor: value != null && String(value).trim() ? String(value).trim() : undefined,
        fechaResolucion: String(data.fechaResolucion || nested.resolutionDate || '').trim() || undefined,
        fechaEjecutoria: String(data.fechaEjecutoria || '').trim() || undefined,
        fechaMandamiento: String(data.fechaMandamiento || '').trim() || undefined,
        fechaNotificacionMandamiento: String(data.fechaNotificacionMandamiento || '').trim() || undefined,
      };
      if (context.numero || context.fecha || context.organismo) return context;
    }

    const rawSession = window.sessionStorage.getItem(SIMIT_SESSION_KEY);
    if (rawSession) {
      const session = JSON.parse(rawSession) as { records?: Array<Record<string, unknown>>; documentNumber?: string };
      const record = Array.isArray(session.records) && session.records.length === 1 ? session.records[0] : null;
      if (record) return {
        numero: typeof record.number === 'string' ? record.number : undefined,
        fecha: typeof record.date === 'string' ? record.date : undefined,
        organismo: typeof record.authority === 'string' ? record.authority : undefined,
        municipio: typeof record.municipality === 'string' ? record.municipality : undefined,
        valor: record.value != null ? String(record.value) : undefined,
        fechaResolucion: typeof record.resolutionDate === 'string' ? record.resolutionDate : undefined,
        fechaMandamiento: undefined,
        fechaNotificacionMandamiento: undefined,
      };
    }
  } catch {
    // Context is optional; never break the wizard because local storage is malformed.
  }
  return null;
}

export default function TramiWidget({ comparendo }: { comparendo?: ComparendoContext | null }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [liveContext, setLiveContext] = useState<ComparendoContext | null>(comparendo || null);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'assistant', text: 'Hola. Soy Trámi, tu copiloto legal. Puedo ayudarte a entender tu comparendo, revisar la viabilidad de prescripción, caducidad o pérdida de ejecutoriedad y explicarte el escrito que estás preparando.' },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refresh = () => setLiveContext(comparendo || readLiveContext());
    refresh();
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener('storage', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', refresh);
    };
  }, [comparendo]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const context = comparendo || liveContext;
  const contextLabel = context?.numero
    ? `📍 Contexto: Comparendo ${context.numero}${context.municipio ? ` · ${context.municipio}` : context.organismo ? ` · ${context.organismo}` : ''}`
    : '📍 Contexto: Sin comparendo seleccionado';

  async function sendMessage(text = input) {
    const value = text.trim();
    if (!value || loading) return;
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
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendMessage();
  }

  if (!open) {
    return (
      <div className="fixed bottom-5 right-5 z-[100] flex items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className="group relative flex items-center gap-2 rounded-full border border-white/20 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-bold text-white shadow-2xl shadow-indigo-900/30 transition hover:-translate-y-0.5" aria-label="Hablar con Trámi">
          <span className="absolute -inset-1 -z-10 animate-pulse rounded-full bg-indigo-500/30 blur-md" />
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-xl">🤖</span>
          <span>Hablar con Trámi 🤖</span>
        </button>
      </div>
    );
  }

  return (
    <section className="fixed bottom-5 right-5 z-[100] flex h-[min(680px,calc(100vh-40px))] w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" aria-label="Trámi · Copiloto Legal">
      <header className="flex items-center justify-between bg-gradient-to-r from-indigo-700 to-violet-700 px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-xl">🤖</div>
          <div><div className="font-bold">Trámi · Copiloto Legal</div><div className="flex items-center gap-1.5 text-xs text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-300" />En línea</div></div>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1 text-xl hover:bg-white/10" aria-label="Minimizar">─</button>
      </header>

      <div className="border-b border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-medium text-indigo-800">{contextLabel}</div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[86%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${message.role === 'user' ? 'rounded-br-md bg-indigo-600 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-700 shadow-sm'}`}>
              {message.text}
            </div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">Trámi está analizando…</div></div>}
      </div>

      <div className="border-t border-slate-200 bg-white p-3">
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {QUICK_REPLIES.map((reply) => <button key={reply} type="button" disabled={loading} onClick={() => void sendMessage(reply.replace(/^\S+\s/, ''))} className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50">{reply}</button>)}
        </div>
        <form onSubmit={submit} className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-2 py-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
          <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} disabled={loading} placeholder="Escribe tu pregunta…" className="min-w-0 flex-1 bg-transparent px-2 text-sm text-slate-800 outline-none placeholder:text-slate-400" aria-label="Mensaje para Trámi" />
          <button type="submit" disabled={!input.trim() || loading} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-40" aria-label="Enviar">➤</button>
        </form>
        <p className="mt-2 text-center text-[10px] text-slate-400">Trámi orienta; la decisión jurídica corresponde a la autoridad competente.</p>
      </div>
    </section>
  );
}
