"use client";

import React, { useEffect, useRef, useState } from "react";
import type { FormStep, FormField } from "../types/form";
import { localDraftStorage } from "../lib/draftStorage";
import type { FormAnswers } from "../types/form";

function visible(field: FormField, answers: FormAnswers) {
  if (!field.condition) return true;
  const current = String(answers[field.condition.questionId] ?? "");
  const expected = field.condition.value;
  if (field.condition.operator === "equals") return current === expected;
  if (field.condition.operator === "notEquals") return current !== expected;
  return current.includes(expected);
}

export default function StepForm({ steps, onComplete, draftKey, resetSignal }: { steps: FormStep[]; onComplete: (data: FormAnswers) => void; draftKey?: string; resetSignal?: number }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const step = steps[index];

  useEffect(() => {
    if (!draftKey) return;
    const saved = localDraftStorage.load(draftKey) as any;
    if (saved?.data) { setAnswers(saved.data as FormAnswers); setSavedAt(saved.savedAt || null); }
  }, [draftKey]);

  useEffect(() => {
    if (typeof resetSignal === "number") { setAnswers({}); setIndex(0); setSavedAt(null); setError(null); }
  }, [resetSignal]);

  useEffect(() => {
    if (!draftKey) return;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      try { localDraftStorage.save(draftKey, answers); setSavedAt(new Date().toISOString()); } catch { /* restricted storage */ }
    }, 500);
    return () => { if (timeoutRef.current) window.clearTimeout(timeoutRef.current); };
  }, [answers, draftKey]);

  function setField(id: string, value: any) { setAnswers((s) => ({ ...s, [id]: value })); setError(null); }

  function hasValue(value: any) {
    if (value === null || value === undefined || value === false) return false;
    if (Array.isArray(value)) return value.length > 0;
    return String(value).trim().length > 0;
  }

  function next() {
    const missing = step.fields.find((f) => f.required && visible(f, answers) && !hasValue(answers[f.id]));
    if (missing) { setError(`Complete el campo obligatorio: ${missing.label}`); return; }
    setError(null);
    if (index < steps.length - 1) setIndex(index + 1); else onComplete(answers);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h3 className="text-xl font-bold">{step.title}</h3>{step.description && <p className="text-sm text-slate-500 mt-1">{step.description}</p>}</div>
        <div className="text-sm text-slate-500">{savedAt ? `Guardado ${new Date(savedAt).toLocaleString()}` : "Sin guardar"}</div>
      </div>
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="grid gap-4">
        {step.fields.filter((field) => visible(field, answers)).map((field: FormField) => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}{field.required ? " *" : ""}</label>
            {field.type === "textarea" ? <textarea value={(answers[field.id] as string) || ""} onChange={(e) => setField(field.id, e.target.value)} className="w-full border rounded-md p-2" /> :
              field.type === "select" ? <select value={(answers[field.id] as string) || ""} onChange={(e) => setField(field.id, e.target.value)} className="w-full border rounded-md p-2"><option value="">Seleccione...</option>{field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select> :
              field.type === "radio" ? <div className="flex gap-4">{field.options?.map((o) => <label key={o.value} className="flex items-center gap-2"><input type="radio" name={field.id} checked={answers[field.id] === o.value} onChange={() => setField(field.id, o.value)} />{o.label}</label>)}</div> :
              <input value={(answers[field.id] as string) || ""} onChange={(e) => setField(field.id, e.target.value)} type={field.type === "phone" ? "tel" : field.type === "date" ? "date" : field.type === "email" ? "email" : "text"} className="w-full border rounded-md p-2" />}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button onClick={() => { if (index > 0) setIndex(index - 1); }} disabled={index === 0} className="px-4 py-2 rounded-md border text-slate-700 disabled:opacity-50">Atrás</button>
        <div className="flex items-center gap-3"><div className="text-sm text-slate-500">Paso {index + 1} de {steps.length}</div><button onClick={next} className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold">{index === steps.length - 1 ? "Generar documento" : "Continuar"}</button></div>
      </div>
    </div>
  );
}
