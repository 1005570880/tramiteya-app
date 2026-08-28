'use client';

import React, { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';

type ComparendoContext = {
  numero?: string; fecha?: string; organismo?: string; municipio?: string; valor?: string | number;
  fechaResolucion?: string; fechaEjecutoria?: string; fechaMandamiento?: string;
  fechaNotificacionMandamiento?: string; placa?: string; codigoInfraccion?: string;
  estado?: string; documentNumber?: string; ownerName?: string;
};
type Message = { id: number; role: 'user' | 'assistant'; text: string };
type Answers = Record<string, string>;
type Question = { key: string; text: string; when?: (c: ComparendoContext, a: Answers) => boolean };

const QUICK_REPLIES = [
  '💡 ¿Mi multa está prescrita?',
  '🏛️ ¿A dónde se envía este escrito?',
  '⚖️ ¿Qué pasa si me responden que NO?',
  '📑 ¿Qué significan los hechos de mi escrito?',
];
const DRAFT_KEY = 'tramiteya:draft:procedure:derecho-de-peticion-eliminar-multa';
const SIMIT_SESSION_KEY = 'tramiteya:simit-upload:v1';
const TRAMI_ANSWERS_KEY = 'tramiteya:trami-questionnaire:v1';

// Trámi no pregunta al usuario qué figura jurídica quiere usar. Primero obtiene
// identidad y hechos indispensables; después el motor jurídico decide la vía.
const QUESTIONS: Question[] = [
  { key: 'nombresCompletos', text: 'Empecemos por tus datos. ¿Cuál es tu **nombre completo**, tal como quieres que aparezca en el derecho de petición?', when: (_c, a) => !a.nombresCompletos },
  { key: 'cedula', text: '¿Cuál es tu **número de cédula**? Si la que aparece arriba es correcta, respóndeme simplemente **sí**.', when: c => !c.documentNumber },
  { key: 'confirmarCedula', text: 'Tengo registrada la cédula **{cedula}**. ¿Es correcta? Responde sí o no.', when: c => !!c.documentNumber },
  { key: 'correo', text: '¿A qué **correo electrónico** quieres que la autoridad envíe la respuesta?', when: (_c, a) => !a.correo },
  { key: 'telefono', text: '¿Qué **número de teléfono** quieres incluir en tus datos de contacto? Si prefieres no incluirlo, responde **omitir**.', when: (_c, a) => !a.telefono },
  { key: 'direccion', text: '¿Qué **dirección de notificación** quieres incluir? Si prefieres que la autoridad use el correo electrónico como canal de respuesta, responde **omitir**.', when: (_c, a) => !a.direccion },
  { key: 'notificacionComparendo', text: 'Ahora sí, vamos al expediente. ¿Recibiste alguna **notificación relacionada con este comparendo**? Dime sí, no o no sé; si recuerdas una fecha, inclúyela.' },
  { key: 'notificacionResolucion', text: '¿Recibiste o conoces una **resolución que impusiera la multa**? Si conoces la fecha, dímela.', when: c => !c.fechaResolucion },
  { key: 'mandamientoPago', text: '¿Alguna vez recibiste un **mandamiento de pago** o una comunicación formal de cobro? Si recuerdas cuándo, dímelo.', when: c => !c.fechaMandamiento && !c.fechaNotificacionMandamiento },
  { key: 'ejecutoria', text: '¿Sabes cuándo quedó **en firme la resolución** que impuso la multa? Si no lo sabes, dime “no sé”.', when: c => !c.fechaEjecutoria },
  { key: 'pagoAcuerdo', text: '¿Has pagado esta multa o celebrado un **acuerdo de pago**? Responde sí, no o no sé.' },
];

const clean = (v: unknown) => v == null ? undefined : String(v).trim() || undefined;
function readContext(): ComparendoContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const data = (JSON.parse(raw)?.data || {}) as Record<string, any>;
      const nested = data.__simitRecord && typeof data.__simitRecord === 'object' ? data.__simitRecord : {};
      const c: ComparendoContext = {
        numero: clean(data.numero_comparendo || data.numero_acto || nested.number),
        fecha: clean(data.fecha_comparendo || nested.date),
        organismo: clean(data.autoridad || data.entidad || nested.authority),
        municipio: clean(data.municipio || data.ciudad || nested.municipality),
        valor: clean(data.valor ?? data.valor_multa ?? nested.value),
        fechaResolucion: clean(data.fechaResolucion || nested.resolutionDate),
        fechaEjecutoria: clean(data.fechaEjecutoria || nested.executedDate),
        fechaMandamiento: clean(data.fechaMandamiento || nested.mandamientoDate),
        fechaNotificacionMandamiento: clean(data.fechaNotificacionMandamiento || nested.paymentOrderNotificationDate),
        placa: clean(data.placa || nested.plate), codigoInfraccion: clean(data.codigoInfraccion || nested.infractionCode),
        estado: clean(data.estadoComparendo || nested.status),
        documentNumber: clean(data.documentNumber || data.numeroDocumento || data.documento || data.cedula || nested.documentNumber),
        ownerName: clean(data.nombres && data.apellidos ? `${data.nombres} ${data.apellidos}` : nested.ownerName),
      };
      if (c.numero || c.fecha) return c;
    }
    const session = JSON.parse(sessionStorage.getItem(SIMIT_SESSION_KEY) || '{}') as { records?: any[]; documentNumber?: string; selectedRecord?: any };
    const r = session.selectedRecord || (session.records?.length === 1 ? session.records[0] : null);
    if (!r) return null;
    return {
      numero: clean(r.number), fecha: clean(r.date), organismo: clean(r.authority), municipio: clean(r.municipality), value: undefined,
      valor: clean(r.value), fechaResolucion: clean(r.resolutionDate), fechaEjecutoria: clean(r.executedDate),
      fechaMandamiento: clean(r.mandamientoDate || r.paymentOrderDate), fechaNotificacionMandamiento: clean(r.paymentOrderNotificationDate),
      placa: clean(r.plate), codigoInfraccion: clean(r.infractionCode), estado: clean(r.status),
      documentNumber: clean(session.documentNumber || r.documentNumber), ownerName: clean(r.ownerName),
    };
  } catch { return null; }
}
function readAnswers(): Answers {
  try { const p = JSON.parse(sessionStorage.getItem(TRAMI_ANSWERS_KEY) || '{}'); return p?.answers && typeof p.answers === 'object' ? p.answers : {}; } catch { return {}; }
}
function saveAnswers(a: Answers, complete = false) {
  try { sessionStorage.setItem(TRAMI_ANSWERS_KEY, JSON.stringify({ version: 4, answers: a, complete, updatedAt: new Date().toISOString() })); } catch {}
}
function renderText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>);
}

export default function TramiWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<ComparendoContext | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState<number | null>(null);
  const [complete, setComplete] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const isTraffic = typeof window !== 'undefined' && window.location.pathname.includes('/formulario-simit');

  const questions = useMemo(() => QUESTIONS.filter(q => !q.when || q.when(context || {}, answers)), [context, answers]);
  const current = index != null ? questions[index] : null;

  function questionText(q: Question) {
    return q.text.replace('{cedula}', context?.documentNumber || answers.cedula || '');
  }

  function startFromContext(c: ComparendoContext | null) {
    if (!c?.numero) return;
    const saved = readAnswers();
    let meta: any = {};
    try { meta = JSON.parse(sessionStorage.getItem(TRAMI_ANSWERS_KEY) || '{}'); } catch {}
    setContext(c);
    setAnswers(saved);
    if (meta.complete) { setComplete(true); setIndex(null); return; }
    setComplete(false);
    setIndex(0);
    setOpen(true);
    if (!Object.keys(saved).length) {
      const identityHint = c.documentNumber ? ` Ya detecté tu cédula **${c.documentNumber}** en el Estado de Cuenta.` : ' Primero voy a confirmar tus datos de identificación.';
      setMessages([{ id: Date.now(), role: 'assistant', text: `Perfecto. Seleccionaste el comparendo **${c.numero}**${c.municipio ? ` de ${c.municipio}` : ''}.${identityHint}\n\nNo tendrás más formularios. Yo te haré únicamente las preguntas necesarias y, con el expediente y tus respuestas, determinaré automáticamente si procede **caducidad, prescripción, pérdida de ejecutoriedad u otra vía jurídica**.` }]);
    } else if (!messages.length) {
      setMessages([{ id: Date.now(), role: 'assistant', text: `Continuemos con el expediente **${c.numero}**. Ya conservaré las respuestas que hayas dado.` }]);
    }
  }

  useEffect(() => {
    const refresh = () => {
      const c = readContext();
      if (c?.numero) setContext(c);
      if (isTraffic && c?.numero && !initialized.current) { initialized.current = true; startFromContext(c); }
    };
    refresh();
    const restart = () => { initialized.current = false; setMessages([]); setAnswers({}); setComplete(false); setIndex(null); setOpen(true); refresh(); };
    window.addEventListener('trami:restart', restart);
    const t = window.setInterval(refresh, 700);
    return () => { window.clearInterval(t); window.removeEventListener('trami:restart', restart); };
  }, [isTraffic]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, loading]);

  function add(text: string) { setMessages(m => [...m, { id: Date.now() + Math.random(), role: 'assistant', text }]); }
  function finish(finalAnswers: Answers) {
    setComplete(true); setIndex(null); saveAnswers(finalAnswers, true);
    add('Listo. **Ya tengo los datos necesarios.** Ahora voy a cruzar tu identidad, el Estado de Cuenta SIMIT y la cronología del expediente. Tú no tienes que escoger ninguna figura jurídica: **Trámi determinará la vía jurídicamente más adecuada** y preparará el escrito.');
    window.dispatchEvent(new CustomEvent('trami:questionnaire-complete', { detail: { answers: finalAnswers, comparendo: context } }));
  }
  function answer(text: string) {
    if (!current || loading) return;
    const value = text.trim(); if (!value) return;
    const key = current.key;
    const next = { ...answers, [key]: value };
    // Para la cédula detectada, "sí" conserva el número del expediente.
    if (key === 'confirmarCedula' && /^(sí|si|correcta|correcto)$/i.test(value)) next.cedula = context?.documentNumber || '';
    if (key === 'telefono' && /^omitir$/i.test(value)) next.telefono = 'omitir';
    if (key === 'direccion' && /^omitir$/i.test(value)) next.direccion = 'omitir';
    setInput(''); setAnswers(next); saveAnswers(next);
    setMessages(m => [...m, { id: Date.now(), role: 'user', text: value }]);
    const ni = (index ?? 0) + 1;
    if (ni >= questions.length) { finish(next); return; }
    setIndex(ni);
    window.setTimeout(() => add(questionText(questions[ni])), 120);
  }
  async function send(text = input) {
    const value = text.trim(); if (!value || loading) return;
    if (index != null && !complete) { answer(value); return; }
    setInput(''); setMessages(m => [...m, { id: Date.now(), role: 'user', text: value }]); setLoading(true);
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: value, comparendo: context, answers }) });
      const p = await r.json(); if (!r.ok) throw new Error(p.error || 'No fue posible responder.');
      setMessages(m => [...m, { id: Date.now() + 1, role: 'assistant', text: p.text }]);
    } catch (e) {
      setMessages(m => [...m, { id: Date.now() + 1, role: 'assistant', text: e instanceof Error ? e.message : 'No fue posible responder.' }]);
    } finally { setLoading(false); }
  }
  function submit(e: FormEvent) { e.preventDefault(); void send(); }
  function key(e: KeyboardEvent<HTMLInputElement>) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }

  if (isTraffic && open) return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-slate-50">
      <header className="flex shrink-0 items-center justify-between bg-gradient-to-r from-indigo-700 via-violet-700 to-fuchsia-700 px-5 py-4 text-white shadow-lg">
        <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 text-2xl">🤖</div><div><div className="text-lg font-black">Trámi · Copiloto Legal</div><div className="flex items-center gap-1.5 text-xs text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-300"/> En línea · guiando tu trámite</div></div></div>
        <button onClick={() => setOpen(false)} className="rounded-xl px-4 py-2 text-xl hover:bg-white/10" aria-label="Minimizar">─</button>
      </header>
      <div className="border-b border-indigo-100 bg-white px-5 py-2.5 text-sm font-semibold text-indigo-800">📍 {context?.numero ? `Expediente: Comparendo ${context.numero}${context.municipio ? ` · ${context.municipio}` : ''}` : 'Preparando expediente…'}</div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8"><div className="mx-auto max-w-3xl space-y-4">
        {context?.numero && <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm"><div className="text-xs font-bold uppercase tracking-wider text-indigo-500">Tu expediente</div><div className="mt-2 grid gap-2 text-sm sm:grid-cols-3"><span><b>Comparendo:</b> {context.numero}</span><span><b>Fecha:</b> {context.fecha || 'pendiente'}</span><span><b>Cédula:</b> {context.documentNumber || 'la confirmaré contigo'}</span></div></div>}
        {messages.map(m => <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] leading-6 shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-800'}`}>{renderText(m.text)}</div></div>)}
        {current && !complete && <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-800"><span className="font-bold">Pregunta {index! + 1}</span> · Trámi está guiando el expediente · <span className="font-semibold">no necesitas saber de derecho</span></div>}
        {loading && <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">Trámi está analizando…</div>}
      </div></div>
      <div className="shrink-0 border-t border-slate-200 bg-white p-3 md:p-4"><div className="mx-auto max-w-3xl">
        {(!current || complete) && <div className="mb-3 flex gap-2 overflow-x-auto pb-1">{QUICK_REPLIES.map(q => <button key={q} type="button" onClick={() => void send(q)} className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50">{q}</button>)}</div>}
        <form onSubmit={submit} className="flex gap-2"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={key} placeholder={current ? 'Escribe tu respuesta aquí…' : 'Pregúntale a Trámi…'} className="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"/><button type="submit" disabled={!input.trim() || loading} className="rounded-2xl bg-indigo-600 px-5 py-3 font-bold text-white disabled:opacity-40">Enviar</button></form>
      </div></div>
    </div>
  );

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-[100] flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-4 py-3 font-bold text-white shadow-2xl"><span className="animate-pulse text-xl">🤖</span>{isTraffic && context?.numero && !complete ? 'Continuar con Trámi' : 'Hablar con Trámi 🤖'}</button>;
  return <div className="fixed bottom-5 right-5 z-[100] flex h-[min(700px,calc(100vh-40px))] w-[min(440px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><header className="flex items-center justify-between bg-indigo-700 px-4 py-3 text-white"><div className="font-bold">🤖 Trámi · Copiloto Legal<div className="text-xs font-normal text-emerald-200">● En línea</div></div><button onClick={() => setOpen(false)} className="px-3 text-xl">─</button></header><div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">{messages.map(m => <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-800 shadow-sm'}`}>{renderText(m.text)}</div></div>)}</div><form onSubmit={submit} className="flex gap-2 border-t p-3"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={key} className="min-w-0 flex-1 rounded-xl border p-3" placeholder="Pregúntale a Trámi…"/><button type="submit" disabled={!input.trim() || loading} className="rounded-xl bg-indigo-600 px-4 font-bold text-white disabled:opacity-40">→</button></form></div>;
}
