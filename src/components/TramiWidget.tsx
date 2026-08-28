'use client';

import React, { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';

type ComparendoContext = {
  numero?: string; fecha?: string; organismo?: string; municipio?: string;
  valor?: string | number; fechaResolucion?: string; fechaEjecutoria?: string;
  fechaMandamiento?: string; fechaNotificacionMandamiento?: string;
  placa?: string; codigoInfraccion?: string; estado?: string;
  documentNumber?: string; ownerName?: string;
};
type Message = { id: number; role: 'user' | 'assistant'; text: string };
type Answers = Record<string, string>;

const QUICK_REPLIES = [
  '💡 ¿Mi multa está prescrita?',
  '🏛️ ¿A dónde se envía este escrito?',
  '⚖️ ¿Qué pasa si me responden que NO?',
  '📑 ¿Qué significan los hechos de mi escrito?',
];
const DRAFT_KEY = 'tramiteya:draft:procedure:derecho-de-peticion-eliminar-multa';
const SIMIT_SESSION_KEY = 'tramiteya:simit-upload:v1';
const TRAMI_ANSWERS_KEY = 'tramiteya:trami-questionnaire:v2';

const clean = (v: unknown) => v == null ? undefined : String(v).trim() || undefined;

function readContext(): ComparendoContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const data = (JSON.parse(raw)?.data || {}) as Record<string, any>;
      const n = data.__simitRecord && typeof data.__simitRecord === 'object' ? data.__simitRecord : {};
      const c: ComparendoContext = {
        numero: clean(data.numero_comparendo || data.numero_acto || n.number),
        fecha: clean(data.fecha_comparendo || n.date),
        organismo: clean(data.autoridad || data.entidad || n.authority),
        municipio: clean(data.municipio || data.ciudad || n.municipality),
        valor: clean(data.valor ?? data.valor_multa ?? n.value),
        fechaResolucion: clean(data.fechaResolucion || n.resolutionDate),
        fechaEjecutoria: clean(data.fechaEjecutoria || n.executedDate),
        fechaMandamiento: clean(data.fechaMandamiento || n.mandamientoDate || n.paymentOrderDate),
        fechaNotificacionMandamiento: clean(data.fechaNotificacionMandamiento || n.paymentOrderNotificationDate),
        placa: clean(data.placa || n.plate),
        codigoInfraccion: clean(data.codigoInfraccion || n.infractionCode),
        estado: clean(data.estadoComparendo || n.status),
        documentNumber: clean(data.documentNumber || data.numeroDocumento || data.documento || data.cedula || n.documentNumber),
        ownerName: clean(data.nombres && data.apellidos ? `${data.nombres} ${data.apellidos}` : data.nombreCompleto || n.ownerName),
      };
      if (c.numero || c.fecha) return c;
    }
    const s = JSON.parse(sessionStorage.getItem(SIMIT_SESSION_KEY) || '{}') as { records?: any[]; documentNumber?: string; selectedRecord?: any };
    const r = s.selectedRecord || (s.records?.length === 1 ? s.records[0] : null);
    if (!r) return null;
    return {
      numero: clean(r.number), fecha: clean(r.date), organismo: clean(r.authority), municipio: clean(r.municipality),
      valor: clean(r.value), fechaResolucion: clean(r.resolutionDate), fechaEjecutoria: clean(r.executedDate),
      fechaMandamiento: clean(r.mandamientoDate || r.paymentOrderDate), fechaNotificacionMandamiento: clean(r.paymentOrderNotificationDate),
      placa: clean(r.plate), codigoInfraccion: clean(r.infractionCode), estado: clean(r.status),
      documentNumber: clean(s.documentNumber || r.documentNumber), ownerName: clean(r.ownerName),
    };
  } catch { return null; }
}

function readAnswers(): Answers {
  try {
    const p = JSON.parse(sessionStorage.getItem(TRAMI_ANSWERS_KEY) || '{}');
    return p?.answers && typeof p.answers === 'object' ? p.answers : {};
  } catch { return {}; }
}
function saveAnswers(answers: Answers, complete = false) {
  try { sessionStorage.setItem(TRAMI_ANSWERS_KEY, JSON.stringify({ version: 2, answers, complete, updatedAt: new Date().toISOString() })); } catch {}
}
function renderText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith('**') && p.endsWith('**')
    ? <strong key={i}>{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>);
}
function diagnosis(c: ComparendoContext) {
  const value = c.valor ? `**$${String(c.valor).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}**` : 'la obligación reportada';
  const date = c.fecha || 'la fecha reportada';
  const municipality = c.municipio || 'el municipio reportado';
  return `Hola. Ya analicé tu Estado de Cuenta de ${municipality} por ${value}. Como la infracción es del **${date}**, el término de prescripción inicial sigue en curso. Por eso, **el camino más fuerte en este momento es exigir la carpeta administrativa y verificar la validez de la notificación**.\n\nVoy a preparar tu escrito directamente contigo. Para dejarlo listo con rigor legal, solo necesito confirmar **los datos indispensables**.`;
}

export default function TramiWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<ComparendoContext | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [stage, setStage] = useState<'identity' | 'notification' | 'collection' | 'complete' | 'chat'>('identity');
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const isTraffic = typeof window !== 'undefined' && window.location.pathname.includes('/formulario-simit');

  const identityComplete = Boolean(answers.nombre && answers.correo && answers.telefono !== undefined);
  const contextSummary = useMemo(() => context?.numero ? `Expediente: Comparendo ${context.numero}${context.municipio ? ` · ${context.municipio}` : ''}` : 'Preparando expediente…', [context]);

  function persistAnswers(next: Answers) {
    setAnswers(next); saveAnswers(next);
    try {
      const raw = localStorage.getItem(DRAFT_KEY); const parsed = raw ? JSON.parse(raw) : { data: {} };
      const data = parsed.data || {};
      if (next.nombre) data.nombreCompleto = next.nombre;
      if (next.nombre) { const parts = next.nombre.trim().split(/\s+/); data.nombres = parts.slice(0, Math.max(1, parts.length - 2)).join(' '); data.apellidos = parts.slice(Math.max(1, parts.length - 2)).join(' '); }
      if (next.cedula) data.documentNumber = next.cedula;
      if (next.correo) data.correo = next.correo; if (next.telefono && next.telefono !== 'omitir') data.telefono = next.telefono;
      if (next.notificacion) data.tramiNotificacion = next.notificacion;
      if (next.cobro) data.tramiCobro = next.cobro;
      data.tramiAnswers = next;
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...parsed, data }));
    } catch {}
  }

  function start(c: ComparendoContext) {
    const saved = readAnswers();
    setContext(c); setAnswers(saved); setOpen(true);
    let meta: any = {}; try { meta = JSON.parse(sessionStorage.getItem(TRAMI_ANSWERS_KEY) || '{}'); } catch {}
    if (meta.complete) { setStage('complete'); setMessages([{ id: Date.now(), role: 'assistant', text: 'Listo. **Tu expediente ya está diligenciado.** Puedes continuar con la revisión del escrito.' }]); return; }
    if (!Object.keys(saved).length) setMessages([{ id: Date.now(), role: 'assistant', text: diagnosis(c) }]);
    if (saved.nombre && saved.correo && saved.telefono !== undefined) setStage(saved.notificacion ? (saved.cobro ? 'complete' : 'collection') : 'notification');
    else setStage('identity');
  }

  useEffect(() => {
    const refresh = () => { const c = readContext(); if (c?.numero) { setContext(c); if (isTraffic && !initialized.current) { initialized.current = true; start(c); } } };
    refresh();
    const restart = () => { initialized.current = false; setMessages([]); setAnswers({}); setStage('identity'); try { sessionStorage.removeItem(TRAMI_ANSWERS_KEY); } catch {} refresh(); };
    window.addEventListener('trami:restart', restart);
    const t = window.setInterval(refresh, 700);
    return () => { window.clearInterval(t); window.removeEventListener('trami:restart', restart); };
  }, [isTraffic]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, loading, stage]);
  function add(text: string) { setMessages(m => [...m, { id: Date.now() + Math.random(), role: 'assistant', text }]); }

  function submitIdentity(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nombre = String(form.get('nombre') || '').trim(); const correo = String(form.get('correo') || '').trim(); const telefono = String(form.get('telefono') || '').trim() || 'omitir';
    if (!nombre || !correo) return;
    const next = { ...answers, nombre, correo, telefono, cedula: context?.documentNumber || answers.cedula || '' };
    persistAnswers(next); setMessages(m => [...m, { id: Date.now(), role: 'user', text: `Nombre: ${nombre}\nCorreo: ${correo}\nTeléfono: ${telefono === 'omitir' ? 'Omitido' : telefono}` }]); setStage('notification');
    window.setTimeout(() => add('Perfecto, **ya tengo tus datos de contacto**. Ahora necesito una sola respuesta para reconstruir la cronología de notificación.'), 80);
  }
  function choose(key: 'notificacion' | 'cobro', value: string) {
    const next = { ...answers, [key]: value }; persistAnswers(next); setMessages(m => [...m, { id: Date.now(), role: 'user', text: value }]);
    if (key === 'notificacion') { setStage('collection'); window.setTimeout(() => add('Bien. Ahora una última verificación que puede cambiar la estrategia jurídica: **¿la autoridad llegó a iniciar cobro?**'), 80); }
    else { setStage('complete'); saveAnswers(next, true); window.setTimeout(() => add('Listo. **Ya tengo lo necesario.** Cruzaré tu identidad, el SIMIT y la cronología. Tú no tienes que escoger entre caducidad, prescripción o pérdida de ejecutoriedad: **Trámi determina la vía jurídica más sólida** y ajusta el escrito.'), 80); window.dispatchEvent(new CustomEvent('trami:questionnaire-complete', { detail: { answers: next, comparendo: context } })); }
  }
  async function send(text = input) {
    const value = text.trim(); if (!value || loading) return;
    if (stage === 'identity') { setInput(''); return; }
    if (stage === 'notification') return choose('notificacion', value);
    if (stage === 'collection') return choose('cobro', value);
    setInput(''); setMessages(m => [...m, { id: Date.now(), role: 'user', text: value }]); setLoading(true);
    try { const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: value, comparendo: context, answers }) }); const p = await r.json(); if (!r.ok) throw new Error(p.error || 'No fue posible responder.'); setMessages(m => [...m, { id: Date.now() + 1, role: 'assistant', text: p.text }]); }
    catch (e) { setMessages(m => [...m, { id: Date.now() + 1, role: 'assistant', text: e instanceof Error ? e.message : 'No fue posible responder.' }]); }
    finally { setLoading(false); }
  }
  function submit(e: FormEvent) { e.preventDefault(); void send(); }
  function onKey(e: KeyboardEvent<HTMLInputElement>) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }

  if (isTraffic && open) return <div className="fixed inset-0 z-[200] flex flex-col bg-slate-50">
    <header className="flex shrink-0 items-center justify-between bg-gradient-to-r from-indigo-700 via-violet-700 to-fuchsia-700 px-5 py-4 text-white shadow-lg">
      <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 text-2xl">🤖</div><div><div className="text-lg font-black">👋 Dr. Trámi · Abogado Virtual</div><div className="flex items-center gap-1.5 text-xs text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-300"/> En línea · guiando tu trámite</div></div></div>
      <button onClick={() => setOpen(false)} className="rounded-xl px-4 py-2 text-xl hover:bg-white/10" aria-label="Minimizar">─</button>
    </header>
    <div className="border-b border-indigo-100 bg-white px-5 py-2.5 text-sm font-semibold text-indigo-800">📍 <b>Expediente:</b> Comparendo <code>{context?.numero || '—'}</code> | <b>Cédula:</b> <code>{context?.documentNumber || answers.cedula || '—'}</code> | <b>Lugar:</b> {context?.municipio || '—'}</div>
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8"><div className="mx-auto max-w-3xl space-y-4">
      {context?.numero && <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm"><div className="text-xs font-bold uppercase tracking-wider text-indigo-500">Tu expediente</div><div className="mt-2 grid gap-2 text-sm sm:grid-cols-4"><span><b>Comparendo:</b> {context.numero}</span><span><b>Fecha:</b> {context.fecha || '—'}</span><span><b>Cédula:</b> {context.documentNumber || answers.cedula || '—'}</span><span><b>Valor:</b> {context.valor ? `$${context.valor}` : '—'}</span></div></div>}
      {messages.map(m => <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] leading-6 shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-800'}`}>{renderText(m.text)}</div></div>)}

      {stage === 'identity' && <form onSubmit={submitIdentity} className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm"><div className="mb-1 text-xs font-bold uppercase tracking-wider text-indigo-500">Pregunta 1 · Identificación</div><div className="mb-4 text-[15px] font-semibold text-slate-800">Perfecto. Para dejar el derecho de petición listo, necesito identificar al solicitante. <b>Confírmame estos datos en una sola tarjeta:</b></div><div className="grid gap-3"><label className="text-sm font-semibold">Nombre completo<input name="nombre" defaultValue={answers.nombre || context?.ownerName || ''} required placeholder="Ej. Juan Pérez Gómez" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-indigo-500" /></label><label className="text-sm font-semibold">Correo electrónico<input name="correo" type="email" defaultValue={answers.correo || ''} required placeholder="tu@email.com" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-indigo-500" /></label><label className="text-sm font-semibold">Teléfono <span className="font-normal text-slate-500">(opcional)</span><input name="telefono" defaultValue={answers.telefono === 'omitir' ? '' : answers.telefono || ''} placeholder="300 000 0000" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-indigo-500" /></label><div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">🔒 Cédula detectada automáticamente: <b>{context?.documentNumber || answers.cedula || 'no detectada'}</b></div><button className="rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-700">Confirmar y continuar →</button></div></form>}
      {stage === 'notification' && <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm"><div className="mb-1 text-xs font-bold uppercase tracking-wider text-indigo-500">Pregunta 2 · Notificación</div><div className="text-[15px] font-semibold leading-6 text-slate-800">¿Llegó alguna vez a tu dirección física o correo una <b>citación o notificación oficial</b> sobre este comparendo dentro de los 5 días siguientes al <b>{context?.fecha || 'hecho'}</b>?</div><div className="mt-3 grid gap-2 sm:grid-cols-3"><button onClick={() => choose('notificacion','❌ Nunca me notificaron')} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold hover:bg-slate-50">❌ Nunca me notificaron</button><button onClick={() => choose('notificacion','📩 Sí me llegó notificación')} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold hover:bg-slate-50">📩 Sí me llegó notificación</button><button onClick={() => choose('notificacion','❓ Me enteré apenas vi el SIMIT')} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold hover:bg-slate-50">❓ Me enteré apenas vi el SIMIT</button></div></div>}
      {stage === 'collection' && <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm"><div className="mb-1 text-xs font-bold uppercase tracking-wider text-indigo-500">Pregunta 3 · Cobro</div><div className="text-[15px] font-semibold leading-6 text-slate-800">¿Has recibido alguna <b>notificación de embargo, cobro coactivo o mandamiento de pago</b> por parte de la autoridad de tránsito de {context?.municipio || 'tu municipio'}?</div><div className="mt-3 grid gap-2 sm:grid-cols-3"><button onClick={() => choose('cobro','🏦 Tengo o tuve embargo')} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold hover:bg-slate-50">🏦 Tengo o tuve embargo</button><button onClick={() => choose('cobro','📜 Me llegó un documento de cobro')} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold hover:bg-slate-50">📜 Me llegó un documento de cobro</button><button onClick={() => choose('cobro','🟢 No tengo embargos ni cobros')} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold hover:bg-slate-50">🟢 No tengo embargos ni cobros</button></div></div>}
      {stage === 'complete' && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm"><div className="text-lg font-black text-emerald-800">✅ Expediente diligenciado</div><p className="mt-1 text-sm leading-6 text-emerald-900">La información quedó incorporada al expediente. **Trámi determinará automáticamente** si la vía más sólida es caducidad, prescripción, pérdida de ejecutoriedad, defecto de notificación u otra pretensión procedente.</p></div>}
      {loading && <div className="text-sm text-slate-500">Trámi está analizando…</div>}
    </div></div>
    <div className="border-t bg-white px-4 py-3"><div className="mx-auto max-w-3xl"><div className="mb-2 flex gap-2 overflow-x-auto pb-1">{QUICK_REPLIES.map(q => <button key={q} type="button" onClick={() => send(q)} className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">{q}</button>)}</div><form onSubmit={submit} className="flex gap-2"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} placeholder={stage === 'complete' ? 'Pregúntale algo a Trámi…' : 'Selecciona una respuesta arriba…'} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-500" disabled={loading || stage !== 'complete'}/><button className="rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white disabled:opacity-50" disabled={loading || stage !== 'complete' || !input.trim()}>➤</button></form></div></div>
  </div>;

  return <button type="button" onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-[190] flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-3 text-white shadow-xl"><span className="text-xl">🤖</span><span className="font-bold">Hablar con Trámi 🤖</span></button>;
}
