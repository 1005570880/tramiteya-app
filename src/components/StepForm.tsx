"use client";

import React, { useEffect, useRef, useState } from "react";
import type { FormStep, FormField } from "../types/form";
import { localDraftStorage } from "../lib/draftStorage";
import type { FormAnswers } from "../types/form";

export default function StepForm({
  steps,
  onComplete,
  draftKey,
  resetSignal,
}: {
  steps: FormStep[];
  onComplete: (data: FormAnswers) => void;
  draftKey?: string;
  resetSignal?: number;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const step: FormStep = steps[index];

  useEffect(() => {
    if (!draftKey) return;
    const saved = localDraftStorage.load(draftKey) as any;
    if (saved && saved.data) {
      setAnswers(saved.data as FormAnswers);
      setSavedAt(saved.savedAt || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (typeof resetSignal === "number") {
      // clear answers and reset index
      setAnswers({});
      setIndex(0);
      setSavedAt(null);
    }
  }, [resetSignal]);

  useEffect(() => {
    // debounce autosave
    if (!draftKey) return;
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    // @ts-ignore window.setTimeout returns number
    timeoutRef.current = window.setTimeout(() => {
      try {
        localDraftStorage.save(draftKey, answers);
        setSavedAt(new Date().toISOString());
      } catch (e) {
        // ignore errors
      }
    }, 500);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [answers, draftKey]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  function setField(id: string, value: any) {
    setAnswers((s) => ({ ...s, [id]: value }));
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
        <div className="text-sm text-slate-500">{savedAt ? `Guardado ${new Date(savedAt).toLocaleString()}` : "Sin guardar"}</div>
      </div>

      <div className="grid gap-4">
        {step.fields.map((field: FormField) => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {field.label}
              {field.required ? " *" : ""}
            </label>
            {field.type === "textarea" ? (
              <textarea value={(answers[field.id] as string) || ""} onChange={(e) => setField(field.id, e.target.value)} className="w-full border rounded-md p-2" />
            ) : (
              <input
                value={(answers[field.id] as string) || ""}
                onChange={(e) => setField(field.id, e.target.value)}
                type={field.type === "phone" ? "tel" : field.type === "date" ? "date" : (field.type as string)}
                className="w-full border rounded-md p-2"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={back} disabled={index === 0} className="px-4 py-2 rounded-md border text-slate-700 disabled:opacity-50">
          Atrás
        </button>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500">
            Paso {index + 1} de {steps.length}
          </div>
          <button onClick={next} className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold">
            {index === steps.length - 1 ? "Finalizar" : "Continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}
