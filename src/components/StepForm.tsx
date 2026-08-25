"use client";

import React, { useEffect, useRef, useState } from "react";
import type { FormStep, FormField, FormAnswers } from "../types/form";
import { localDraftStorage } from "../lib/draftStorage";
import { getSupabaseBrowser } from "../lib/supabaseBrowserClient";

type SimitRecordKind = "multa" | "comparendo";
type SimitComparendo = {
  kind?: SimitRecordKind; number?: string; date?: string; authority?: string; department?: string; plate?: string;
  ownerName?: string; infractionCode?: string; description?: string; status?: string;
  value?: number; resolutionNumber?: string; resolutionDate?: string; notificationDate?: string; paymentDate?: string;
};

type SimitData = {
  provider?: string; found?: boolean; pendingCount?: number; totalDebt?: number;
  personName?: string; comparendos: SimitComparendo[]; consultedAt?: string;
};

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
  if (/cédula|documento/.test(text)) return "Escribe tu número de cédula. TrámiteYa hará la consulta automáticamente.";
  if (/nombre/.test(text)) return "Si ya lo encontramos en la consulta, aparecerá automáticamente.";
  if (/correo|email/.test(text)) return "Lo usaremos para enviarte el documento y la información del trámite.";
  if (/hecho|cuent|explique|describ/.test(text)) return "Cuéntamelo con tus propias palabras. TrámiteYa lo convierte en lenguaje jurídico.";
  if (/fecha/.test(text)) return "Si el dato fue recuperado de SIMIT, aparecerá automáticamente.";
  return "No necesitas utilizar lenguaje jurídico.";
}

export default function StepForm({ steps, onComplete, draftKey, resetSignal, instanceId, onInstanceReady, initialAnswers, onFieldBlur }: { steps: FormStep[]; onComplete: (data: FormAnswers) => void; draftKey?: string; resetSignal?: number; instanceId?: string; onInstanceReady?: (id: string) => void; initialAnswers?: FormAnswers; onFieldBlur?: (id: string, value: FormAnswers[string], answers: FormAnswers) => void }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<FormAnswers>(initialAnswers || {});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simitStatus, setSimitStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [simitSummary, setSimitSummary] = useState<{ count: number; totalDebt?: number } | null>(null);
  const [selectedComparendo, setSelectedComparendo] = useState<number | null>(null);
  const [simitProviderError, setSimitProviderError] = useState(false);
  const [simitIntegrityError, setSimitIntegrityError] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const step = steps[index];
  const visibleFields = step.fields.filter((f) => visible(f, answers));
  const total = steps.length;
  const progress = Math.round(((index + 1) / total) * 100);
  const isTrafficForm = steps.some((s) => s.fields.some((f) => f.id === "numero_comparendo"));
  const simitData = (answers.__simitData && typeof answers.__simitData === "object" ? answers.__simitData : null) as SimitData | null;
  const isSimitSelectionStep = isTrafficForm && index === 0;

  useEffect(() => { if (initialAnswers) setAnswers(initialAnswers); }, [initialAnswers]);
  useEffect(() => { if (!draftKey) return; const saved = localDraftStorage.load(draftKey) as any; if (saved?.data && !initialAnswers) setAnswers(saved.data as FormAnswers); setSavedAt(saved?.savedAt || null); }, [draftKey, initialAnswers]);
  useEffect(() => { if (typeof resetSignal === "number") { setAnswers({}); setIndex(0); setSavedAt(null); setError(null); setSimitStatus("idle"); setSimitSummary(null); setSelectedComparendo(null); setSimitProviderError(false); setSimitIntegrityError(false); } }, [resetSignal]);
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

  function setField(id: string, value: FormAnswers[string]) { setAnswers((current) => ({ ...current, [id]: value })); setError(null); setSimitProviderError(false); setSimitIntegrityError(false); }

  async function lookupSimit(valueOverride?: FormAnswers[string]) {
    const documentNumber = String(valueOverride ?? answers.documento ?? "").replace(/[^0-9]/g, "");
    if (documentNumber.length < 6) { setError("Ingresa una cédula válida para consultar multas y comparendos."); return; }
    setSimitStatus("loading"); setError(null); setSimitProviderError(false); setSimitIntegrityError(false); setSelectedComparendo(null);
    try {
      const response = await fetch("/api/simit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentType: "CC", documentNumber }) });
      const data = await response.json().catch(() => ({}));
      const providerUnavailable = response.status === 502 || response.status === 503 || data?.code === "SIMIT_PROVIDER_UNAVAILABLE" || data?.error === "SIMIT_PROVIDER_UNAVAILABLE";
      const integrityError = response.status === 409 || data?.code === "SIMIT_DATA_INTEGRITY_ERROR" || data?.error === "SIMIT_DATA_INTEGRITY_ERROR";
      if (!response.ok) {
        if (integrityError) throw new Error("SIMIT_DATA_INTEGRITY_ERROR");
        if (providerUnavailable) throw new Error("SIMIT_PROVIDER_UNAVAILABLE");
        throw new Error(data?.error || "No fue posible consultar SIMIT.");
      }
      const records = Array.isArray(data.comparendos) ? data.comparendos : [];
      const normalized: SimitData = { provider: data.provider, found: data.found, pendingCount: data.pendingCount ?? records.length, totalDebt: data.totalDebt, personName: data.personName, comparendos: records, consultedAt: new Date().toISOString() };
      setAnswers((current) => ({ ...current, documento: documentNumber, __simitData: normalized }));
      setSimitSummary({ count: records.length, totalDebt: normalized.totalDebt });
      setSimitStatus("ready");
    } catch (lookupError) {
      console.warn("SIMIT lookup failed", lookupError);
      setSimitStatus("error");
      setSimitSummary(null);
      setSelectedComparendo(null);
      setAnswers((current) => { const next = { ...current }; delete next.__simitData; delete next.__selectedComparendo; return next; });
      const message = lookupError instanceof Error ? lookupError.message : "No fue posible consultar SIMIT.";
      if (message === "SIMIT_DATA_INTEGRITY_ERROR") {
        setSimitIntegrityError(true);
        setSimitProviderError(false);
        setError(null);
      } else if (message === "SIMIT_PROVIDER_UNAVAILABLE") {
        setSimitProviderError(true);
        setSimitIntegrityError(false);
        setError(null);
      } else {
        setSimitProviderError(false);
        setSimitIntegrityError(false);
        setError(message);
      }
    }
  }

  function selectComparendo(indexToSelect: number) {
    if (!simitData?.comparendos[indexToSelect]) return;
    const item = simitData.comparendos[indexToSelect];
    setSelectedComparendo(indexToSelect);
    const ownerName = item.ownerName || simitData.personName || "";
    const parts = ownerName.trim().split(/\s+/).filter(Boolean);
    const nombres = parts.length > 2 ? parts.slice(0, -2).join(" ") : parts[0] || "";
    const apellidos = parts.length > 2 ? parts.slice(-2).join(" ") : parts.slice(1).join(" ");
    const recordType = item.kind === "multa" ? "multa" : item.description?.toLowerCase().includes("foto") ? "fotomulta" : "comparendo";
    const next: FormAnswers = {
      ...answers,
      documento: String(answers.documento || ""),
      numero_comparendo: item.number || "",
      fecha_comparendo: item.date || item.resolutionDate || "",
      fecha: item.date || item.resolutionDate || "",
      placa: item.plate || "",
      autoridad: item.authority || "",
      secretaria: item.authority || "",
      departamento: item.department || "",
      nombres: answers.nombres || nombres,
      apellidos: answers.apellidos || apellidos,
      tipo_actuacion: recordType,
      numero_resolucion: item.resolutionNumber || "",
      resolucion: item.resolutionNumber || "",
      fecha_resolucion: item.resolutionDate || "",
      codigo_infraccion: item.infractionCode || "",
      infraccion: item.infractionCode || item.description || "",
      descripcion_infraccion: item.description || "",
      valor_multa: item.value != null ? String(item.value) : "",
      valor: item.value != null ? String(item.value) : "",
      estado: item.status || "",
      estado_multa: item.status || "",
      fecha_notificacion: item.notificationDate || "",
      fecha_pago: item.paymentDate || "",
      __selectedComparendo: { ...item, selectedAt: new Date().toISOString() } as unknown as Record<string, unknown>,
    };
    setAnswers(next);
    setError(null);
    setSimitProviderError(false);
    setSimitIntegrityError(false);
  }

  function hasValue(value: FormAnswers[string]) { if (value === null || value === undefined || value === false) return false; if (Array.isArray(value)) return value.length > 0; return String(value).trim().length > 0; }

  function next() {
    const missing = visibleFields.find((f) => f.required && !hasValue(answers[f.id]));
    if (missing) { setError(`Antes de continuar necesitamos: ${missing.label}`); return; }
    if (isSimitSelectionStep) {
      if (simitStatus !== "ready") { setError("Primero consulta SIMIT con tu cédula."); return; }
      if (!simitData?.comparendos.length) { setError("SIMIT no devolvió multas ni comparendos para seleccionar."); return; }
      if (selectedComparendo === null) { setError("Selecciona la multa o comparendo que quieres revisar."); return; }
    }
    setError(null);
    if (index < total - 1) setIndex(index + 1); else onComplete(answers);
  }

  function back() { if (index > 0) { setError(null); setIndex(index - 1); } }

  function renderField(field: FormField) {
    const value = answers[field.id];
    const common = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-[16px] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
    const onBlur = () => onFieldBlur?.(field.id, answers[field.id], answers);
    if (field.type === "textarea") return <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} value={typeof value === "string" ? value : ""} placeholder={field.placeholder} onChange={(e) => setField(field.id, e.target.value)} onBlur={onBlur} className={`${common} min-h-36 resize-y`} />;
    if (field.type === "select") return <select ref={inputRef as React.RefObject<HTMLSelectElement>} value={typeof value === "string" ? value : ""} onChange={(e) => setField(field.id, e.target.value)} onBlur={onBlur} className={common}><option value="">Selecciona una opción</option>{field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
    if (field.type === "radio") return <div className="grid gap-3 sm:grid-cols-2">{field.options?.map((o) => { const active = value === o.value; return <button type="button" key={o.value} onClick={() => { setField(field.id, o.value); onFieldBlur?.(field.id, o.value, { ...answers, [field.id]: o.value }); }} className={`rounded-2xl border p-4 text-left transition ${active ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-slate-300 hover:-translate-y-0.5"}`}><span className="font-medium">{o.label}</span></button>; })}</div>;
    if (field.type === "checkbox") return <button type="button" onClick={() => { const nextValue = value !== true; setField(field.id, nextValue); onFieldBlur?.(field.id, nextValue, { ...answers, [field.id]: nextValue }); }} className={`w-full rounded-2xl border p-4 text-left transition ${value === true ? "border-blue-600 bg-blue-50" : "border-slate-200"}`}><span className="font-medium">{value === true ? "✓ Sí" : "○ No"}</span></button>;
    return <input ref={inputRef as React.RefObject<HTMLInputElement>} value={typeof value === "string" ? value : value == null ? "" : String(value)} placeholder={field.placeholder} onChange={(e) => setField(field.id, e.target.value)} onBlur={onBlur} type={field.type === "phone" ? "tel" : field.type === "date" ? "date" : field.type === "email" ? "email" : "text"} className={common} />;
  }

  return <div className="space-y-6">