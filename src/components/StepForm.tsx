"use client";

import React, { useState } from "react";
import type { FormStep, FormField } from "../types/form";

export default function StepForm({ steps, onComplete }: { steps: FormStep[]; onComplete: (data: any) => void }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const step = steps[index];

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
      <div>
        <h3 className="text-xl font-bold">{step.title}</h3>
        {step.description && <p className="text-sm text-slate-500 mt-1">{step.description}</p>}
      </div>

      <div className="grid gap-4">
        {step.fields.map((field) => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}{field.required ? ' *' : ''}</label>
            {field.type === 'textarea' ? (
              <textarea value={answers[field.id] || ''} onChange={(e) => setField(field.id, e.target.value)} className="w-full border rounded-md p-2" />
            ) : (
              <input
                value={answers[field.id] || ''}
                onChange={(e) => setField(field.id, e.target.value)}
                type={field.type === 'phone' ? 'tel' : field.type}
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
