"use client";

import React, { useEffect, useRef, useState } from "react";
import type { FormStep, FormField, FormAnswers } from "../types/form";
import { localDraftStorage } from "../lib/draftStorage";
import { getSupabaseBrowser } from "../lib/supabaseBrowserClient";

function visible(field: FormField, answers: FormAnswers) {
  if (!field.condition) return true;
  const current = String(answers[field.condition.questionId] ?? "");
  const expected = field.condition.value;
  if (field.condition.operator === "equals") return current === expected;
  if (field.condition.operator === "notEquals") return current !== expected;
  return current.includes(expected);
}

function questionHint(field: FormField) {
  const text = `${field.label} ${field.placeholder ?? ""}`.toLowerCase();
  if (/nombre/.test(text)) return "Escríbelo tal como aparece en tu documento de identidad.";
  if (/correo|email/.test(text)) return "Lo usaremos únicamente para enviarte información del trámite si el flujo lo requiere.";
  if (/hecho|cuent|explique|describ/.test(text)) return "Cuéntamelo con tus propias palabras. TrámiteYa se encarga de convertirlo en lenguaje jurídico.";
  if (/fecha/.test(text)) return "Si no conoces la fecha exacta, continúa y el sistema te indicará si necesitamos verificarla.";
  if (/entidad|organismo|eps|autoridad/.test(text)) return "Empieza a escribir el nombre. La selección se utiliza para adaptar la ruta jurídica.";
  return "No necesitas utilizar lenguaje jurídico. Responde como se lo explicarías a un abogado.";
}

export default function StepForm({ steps, onComplete, draftKey, resetSignal, instanceId, onInstanceReady, initialAnswers, onFieldBlur }: { steps: FormStep[]; onComplete: (data: FormAnswers) => void; draftKey?: string; resetSignal?: number; instanceId?: string; onInstanceReady?: (id: string) => void; initialAnswers?: FormAnswers; onFieldBlur?: (id: string, value: FormAnswers[string], answers: FormAnswers) => void }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<FormAnswers>(initialAnswers || {});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const step = steps[index];
  const visibleFields = step.fields.filter((f) => visible(f, answers));
  const total = steps.length;
  const progress = Math.round(((index + 1) / total) * 100);

  useEffect(() => { if (initialAnswers) setAnswers(initialAnswers); }, [initialAnswers]);
  useEffect(() => { if (!draftKey) return; const saved = localDraftStorage.load(draftKey) as any; if (saved?.data && !initialAnswers) setAnswers(saved.data as FormAnswers); setSavedAt(saved?.savedAt || null); }, [draftKey, initialAnswers]);
  useEffect(() => { if (typeof resetSignal === "number") { setAnswers({}); setIndex(0); setSavedAt(null); setError(null); } }, [resetSignal]);
  useEffect(() => { inputRef.current?.focus(); }, [index]);
  useEffect(() => {
    if (!draftKey) return;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(async () => {
      try {
        localDraftStorage.save(draftKey, answers);
        const supabase = getSupabaseBrowser();
        if (supabase && instanceId) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) await fetch(`/api/instances/${instanceId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ answers, status: "in_progress" }) });
        }
        setSavedAt(new Date().toISOString());
      } catch { /* local draft remains the source of truth */ }
    }, 500);
    return () => { if (timeoutRef.current) window.clearTimeout(timeoutRef.current); };
  }, [answers, draftKey, instanceId]);

  function setField(id: string, value: FormAnswers[string]) { setAnswers((current) => ({ ...current, [id]: value })); setError(null); }
  function blurField(id: string) { onFieldBlur?.(id, answers[id], answers); }
  function hasValue(value: FormAnswers[string]) { if (value === null || value === undefined || value === false) return false; if (Array.isArray(value)) return value.length > 0; return String(value).trim().length > 0; }
  function next() {
    const missing = visibleFields.find((f) => f.required && !hasValue(answers[f.id]));
    if (missing) { setError(`Antes de continuar necesitamos: ${missing.label}`); return; }
    setError(null);
    setDirection("forward");
    if (index < total - 1) setIndex(index + 1); else onComplete(answers);
  }
  function back() { if (index > 0) { setDirection("back"); setError(null); setIndex(index - 1); } }

  function renderField(field: FormField) {
    const value = answers[field.id];
    const common = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-[16px] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
    if (field.type === "textarea") return <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} value={typeof value === "string" ? value : ""} placeholder={field.placeholder} onChange={(e) => setField(field.id, e.target.value)} onBlur={() => blurField(field.id)} className={`${common} min-h-36 resize-y`} />;
    if (field.type === "select") return <select ref={inputRef as React.RefObject<HTMLSelectElement>} value={typeof value === "string" ? value : ""} onChange={(e) => setField(field.id, e.target.value)} onBlur={() => blurField(field.id)} className={common}><option value="">Selecciona una opción</option>{field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
    if (field.type === "radio") return <div className="grid gap-3 sm:grid-cols-2">{field.options?.map((o) => { const active = value === o.value; return <button type="button" key={o.value} onClick={() => { setField(field.id, o.value); setTimeout(() => blurField(field.id), 0); }} className={`rounded-2xl border p-4 text-left transition ${active ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-slate-300 hover:-translate-y-0.5"}`}><span className="font-medium">{o.label}</span></button>; })}</div>;
    if (field.type === "checkbox") return <button type="button" onClick={() => { const next = value !== true; setField(field.id, next); setTimeout(() => onFieldBlur?.(field.id, next, { ...answers, [field.id]: next }), 0); }} className={`w-full rounded-2xl border p-4 text-left transition ${value === true ? "border-blue-600 bg-blue-50" : "border-slate-200"}`}><span className="font-medium">{value === true ? "✓ Sí" : "○ No"}</span></button>;
    return <input ref={inputRef as React.RefObject<HTMLInputElement>} value={typeof value === "string" ? value : ""} placeholder={field.placeholder} onChange={(e) => setField(field.id, e.target.value)} onBlur={() => blurField(field.id)} type={field.type === "phone" ? "tel" : field.type === "date" ? "date" : field.type === "email" ? "email" : "text"} className={common} />;
  }

  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-4"><span className="text-xs font-semibold uppercase tracking-wider text-blue-600">Paso {index + 1} de {total}</span><span className="text-xs text-slate-500">{savedAt ? "Guardado automáticamente" : "Guardando..."}</span></div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }} /></div>
    <div className={`rounded-3xl border border-slate-200 bg-slate-50/80 p-5 md:p-7 transition-all duration-300 ${direction === "forward" ? "translate-x-0" : "translate-x-0"}`}>
      <div className="mb-7"><div className="mb-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">TrámiteYa te acompaña</div><h3 className="text-2xl font-bold tracking-tight md:text-3xl">{step.title}</h3>{step.description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{step.description}</p>}<p className="mt-3 text-sm font-medium text-slate-500">Responde en lenguaje normal. Nosotros hacemos la traducción jurídica.</p></div>
      {error && <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="grid gap-6">{visibleFields.map((field) => <div key={field.id} className="rounded-2xl bg-white p-4 shadow-sm md:p-5"><label className="mb-2 block text-base font-semibold text-slate-800">{field.label}{field.required ? <span className="text-blue-600"> *</span> : null}</label><p className="mb-3 text-sm leading-5 text-slate-500">{questionHint(field)}</p>{renderField(field)}</div>)}</div>
    </div>
    <div className="flex items-center justify-between gap-3"><button type="button" onClick={back} disabled={index === 0} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Atrás</button><div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:inline">{progress}% completado</span><button type="button" onClick={next} className="rounded-2xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700">{index === total - 1 ? "Revisar mi caso →" : "Continuar →"}</button></div></div>
  </div>;
}
