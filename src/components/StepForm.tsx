"use client";

import React, { useEffect, useState } from "react";
import type { FormStep, FormField } from "../types/form";
import { localDraftStorage } from "../lib/draftStorage";

export default function StepForm({
  steps,
  onComplete,
  draftKey,
  resetSignal,
}: {
  steps: FormStep[];
  onComplete: (data: any) => void;
  draftKey?: string;
  resetSignal?: number;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const step: FormStep = steps[index];

  useEffect(() => {
    if (!draftKey) return;
    const saved = localDraftStorage.load(draftKey) as any;
    if (saved && saved.data) {
      setAnswers(saved.data as Record<string, any>);
      setSavedAt(saved.savedAt || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (typeof resetSignal === 'number') {
      // clear answers and reset index
      setAnswers({});
      setIndex(0);
      setSavedAt(null);
    }
  }, [resetSignal]);

  function setField(id: string, value: any) {
    setAnswers((s) => {
      const next = { ...s, [id]: value };
      if (draftKey) {
        localDraftStorage.save(draftKey, next);
        setSavedAt(new Date().toISOString());
      }
      return next;
    });
  }

  function next() {
    // simple validation: required fields
    const missing = step.fields.find((f) => f.required && !answers[f.id]);
    if (missing) {
      alert(`Por favor complete: ${missing.label}`);
      return;
    }
    if (index < steps.length - 1) setIndex(index + 1);
    else onComplete(answers);
  }

  function back() {
    if (index > 0) setIndex(index - 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">{step.title}</h3>
          {step.description && <p className="text-sm text-slate-500 mt-1">{step.description}</p>}
        </div>
        <div className="text-sm text-slate-500">
          {savedAt ? `Guardado ${new Date(savedAt).toLocaleString()}` : 'Sin guardar'}
        </div>
      </div>

      <div className="grid gap-4">
        {step.fields.map((field: FormField) => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}{field.required ? ' *' : ''}</label>
            {field.type === 'textarea' ? (
              <textarea value={answers[field.id] || ''} onChange={(e) => setField(field.id, e.target.value)} className="w-full border rounded-md p-2" />
            ) : (
              <input
                value={answers[field.id] || ''}
                onChange={(e) => setField(field.id, e.target.value)}
                type={field.type === 'phone' ? 'tel' : (field.type === 'date' ? 'date' : field.type)}
                className="w-full border rounded-md p-2"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={back} disabled={index === 0} className="px-4 py-2 rounded-md border text-slate-700 disabled:opacity-50">Atrás</button>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500">Paso {index + 1} de {steps.length}</div>
          <button onClick={next} className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold">{index === steps.length -1 ? 'Finalizar' : 'Continuar'}</button>
        </div>
      </div>
    </div>
  );
}
