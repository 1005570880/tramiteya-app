"use client";

import React, { useEffect, useRef, useState } from "react";
import type { FormStep, FormField, FormAnswers } from "../types/form";
import { localDraftStorage } from "../lib/draftStorage";
import { getSupabaseBrowser } from "../lib/supabaseBrowserClient";
import { generateLegalDraft } from "../lib/legalEngine";

function visible(field: FormField, answers: FormAnswers) {
  if (!field.condition) return true;
  const current = String(answers[field.condition.questionId] ?? "");
  const expected = field.condition.value;
  if (field.condition.operator === "equals") return current === expected;
  if (field.condition.operator === "notEquals") return current !== expected;
  return current.includes(expected);
}

export default function StepForm({
  steps,
  onComplete,
  draftKey,
  resetSignal,
  instanceId,
  onInstanceReady,
  initialAnswers,
}: {
  steps: FormStep[];
  onComplete: (data: FormAnswers) => void;
  draftKey?: string;
  resetSignal?: number;
  instanceId?: string;
  onInstanceReady?: (id: string) => void;
  initialAnswers?: FormAnswers;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<FormAnswers>(initialAnswers || {});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const step = steps[index];

  useEffect(() => {
    if (!initialAnswers) return;

    const source = (initialAnswers as FormAnswers & { __simitRecord?: any }).__simitRecord;
    if (!source) {
      setAnswers(initialAnswers);
      return;
    }

    const draft = generateLegalDraft({
      comparendo: String(source.number || ""),
      fecha: String(source.date || ""),
      organismo: String(source.authority || ""),
      estado: String(source.status || ""),
      valor:
        source.value != null
          ? `$${Number(source.value).toLocaleString("es-CO")}`
          : "no reportado",
      placa: source.plate,
      cedula: String(source.documentNumber || ""),
    });

    setAnswers({
      ...initialAnswers,
      causal: draft.fundamentos,
      hechos: draft.hechos,
      pretension: draft.solicitudConcreta,
      fundamentos: draft.fundamentos,
      solicitudConcreta: draft.solicitudConcreta,
    });
  }, [initialAnswers]);

  useEffect(() => {
    if (!draftKey) return;
    const saved = localDraftStorage.load(draftKey) as any;
    if (saved?.data && !initialAnswers) {
      setAnswers(saved.data as FormAnswers);
    }
    setSavedAt(saved?.savedAt || null);
  }, [draftKey, initialAnswers]);

  useEffect(() => {
    if (typeof resetSignal !== "number") return;
    setAnswers({});
    setIndex(0);
    setSavedAt(null);
    setError(null);
  }, [resetSignal]);

  useEffect(() => {
    if (!draftKey) return;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);

    timeoutRef.current = window.setTimeout(async () => {
      try {
        localDraftStorage.save(draftKey, answers);
        const supabase = getSupabaseBrowser();
        if (supabase && instanceId) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user) {
            await fetch(`/api/instances/${instanceId}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ answers, status: "in_progress" }),
            });
          }
        }
        setSavedAt(new Date().toISOString());
      } catch {
        // Draft persistence must never block the form.
      }
    }, 700);

    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [answers, draftKey, instanceId]);

  function setField(id: string, value: FormAnswers[string]) {
    setAnswers((current) => ({ ...current, [id]: value }));
    setError(null);
  }

  function hasValue(value: FormAnswers[string]) {
    if (value === null || value === undefined || value === false) return false;
    if (Array.isArray(value)) return value.length > 0;
    return String(value).trim().length > 0;
  }

  function next() {
    const missing = step.fields.find(
      (field) =>
        field.required &&
        visible(field, answers) &&
        !hasValue(answers[field.id])
    );

    if (missing) {
      setError(`Complete el campo obligatorio: ${missing.label}`);
      return;
    }

    setError(null);
    if (index < steps.length - 1) {
      setIndex(index + 1);
    } else {
      onComplete(answers);
    }
  }

  function renderField(field: FormField) {
    const value = answers[field.id];

    if (field.type === "textarea") {
      return (
        <textarea
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          onChange={(event) => setField(field.id, event.target.value)}
          className="w-full border rounded-md p-2 min-h-28"
        />
      );
    }

    if (field.type === "select") {
      return (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(event) => setField(field.id, event.target.value)}
          className="w-full border rounded-md p-2"
        >
          <option value="">Seleccione...</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "radio") {
      return (
        <div className="flex flex-wrap gap-4">
          {field.options?.map((option) => (
            <label key={option.value} className="flex items-center gap-2">
              <input
                type="radio"
                name={field.id}
                checked={value === option.value}
                onChange={() => setField(field.id, option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      );
    }

    if (field.type === "checkbox") {
      return (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(event) => setField(field.id, event.target.checked)}
          />
          Sí
        </label>
      );
    }

    return (
      <input
        value={typeof value === "string" ? value : ""}
        placeholder={field.placeholder}
        onChange={(event) => setField(field.id, event.target.value)}
        type={
          field.type === "phone"
            ? "tel"
            : field.type === "date"
              ? "date"
              : field.type === "email"
                ? "email"
                : "text"
        }
        className="w-full border rounded-md p-2"
      />
    );
  }

  if (!step) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">{step.title}</h3>
          {step.description && (
            <p className="text-sm text-slate-500 mt-1">{step.description}</p>
          )}
        </div>
        <div className="text-sm text-slate-500">
          {savedAt
            ? `Guardado ${new Date(savedAt).toLocaleString()}`
            : "Sin guardar"}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {step.fields.filter((field) => visible(field, answers)).map((field) => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {field.label}
              {field.required ? " *" : ""}
            </label>
            {renderField(field)}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => index > 0 && setIndex(index - 1)}
          disabled={index === 0}
          className="px-4 py-2 rounded-md border text-slate-700 disabled:opacity-50"
        >
          Atrás
        </button>

        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500">
            Paso {index + 1} de {steps.length}
          </div>
          <button
            onClick={next}
            className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold"
          >
            {index === steps.length - 1 ? "Vista previa" : "Continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}
