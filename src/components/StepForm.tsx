"use client";

import React, { useEffect, useRef, useState } from "react";
import type { FormStep, FormField, FormAnswers } from "../types/form";
import { localDraftStorage } from "../lib/draftStorage";
import { getSupabaseBrowser } from "../lib/supabaseBrowserClient";

type SimitComparendo = {
  number?: string; date?: string; authority?: string; department?: string; plate?: string;
  ownerName?: string; infractionCode?: string; description?: string; status?: string;
  value?: number; resolutionNumber?: string; resolutionDate?: string; notificationDate?: string;
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
  useEffect(() => { if (typeof resetSignal === "number") { setAnswers({}); setIndex(0); setSavedAt(null); setError(null); setSimitStatus("idle"); setSimitSummary(null); setSelectedComparendo(null); } }, [resetSignal]);
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

  async function lookupSimit(valueOverride?: FormAnswers[string]) {
    const documentNumber = String(valueOverride ?? answers.documento ?? "").replace(/[^0-9]/g, "");
    if (documentNumber.length < 6) { setError("Ingresa una cédula válida para consultar los comparendos."); return; }
    setSimitStatus("loading"); setError(null); setSelectedComparendo(null);
    try {
      const response = await fetch("/api/simit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentType: "CC", documentNumber }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No fue posible consultar SIMIT.");
      const comparendos = Array.isArray(data.comparendos) ? data.comparendos : [];
      const normalized: SimitData = { provider: data.provider, found: data.found, pendingCount: data.pendingCount ?? comparendos.length, totalDebt: data.totalDebt, personName: data.personName, comparendos, consultedAt: new Date().toISOString() };
      setAnswers((current) => ({ ...current, documento: documentNumber, __simitData: normalized }));
      setSimitSummary({ count: comparendos.length, totalDebt: normalized.totalDebt });
      setSimitStatus("ready");
    } catch (lookupError) {
      console.warn("SIMIT lookup unavailable", lookupError);
      setSimitStatus("error");
      setError(lookupError instanceof Error ? lookupError.message : "No fue posible consultar SIMIT.");
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
    const next: FormAnswers = {
      ...answers,
      numero_comparendo: item.number || "",
      fecha_comparendo: item.date || "",
      placa: item.plate || "",
      autoridad: item.authority || "",
      nombres: answers.nombres || nombres,
      apellidos: answers.apellidos || apellidos,
      tipo_actuacion: item.description?.toLowerCase().includes("foto") ? "fotomulta" : "comparendo",
      __selectedComparendo: item as unknown as Record<string, unknown>,
    };
    setAnswers(next);
    setError(null);
  }

  function hasValue(value: FormAnswers[string]) { if (value === null || value === undefined || value === false) return false; if (Array.isArray(value)) return value.length > 0; return String(value).trim().length > 0; }

  function next() {
    const missing = visibleFields.find((f) => f.required && !hasValue(answers[f.id]));
    if (missing) { setError(`Antes de continuar necesitamos: ${missing.label}`); return; }
    if (isSimitSelectionStep) {
      if (simitStatus !== "ready") { setError("Primero consulta SIMIT con tu cédula."); return; }
      if (!simitData?.comparendos.length) { setError("No encontramos comparendos para seleccionar. Verifica la consulta antes de continuar."); return; }
      if (selectedComparendo === null) { setError("Selecciona el comparendo que quieres revisar."); return; }
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
    return <input ref={inputRef as React.RefObject<HTMLInputElement>} value={typeof value === "string" ? value : ""} placeholder={field.placeholder} onChange={(e) => setField(field.id, e.target.value)} onBlur={onBlur} type={field.type === "phone" ? "tel" : field.type === "date" ? "date" : field.type === "email" ? "email" : "text"} className={common} />;
  }

  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-4"><span className="text-xs font-semibold uppercase tracking-wider text-blue-600">Paso {index + 1} de {total}</span><span className="text-xs text-slate-500">{savedAt ? "Guardado automáticamente" : "Guardando..."}</span></div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }} /></div>

    {isTrafficForm && <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-600">Consulta inteligente</p><h3 className="mt-1 text-xl font-bold text-slate-900">Primero buscamos tus comparendos</h3><p className="mt-1 text-sm text-slate-600">Ingresa la cédula y selecciona el comparendo que quieres eliminar o revisar.</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">SIMIT</span></div>
      {isSimitSelectionStep && <div className="mt-5 flex flex-col gap-3 sm:flex-row"><input value={typeof answers.documento === "string" ? answers.documento : ""} onChange={(e) => setField("documento", e.target.value.replace(/[^0-9]/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") lookupSimit(); }} placeholder="Número de cédula" inputMode="numeric" className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /><button type="button" onClick={() => lookupSimit()} disabled={simitStatus === "loading"} className="rounded-2xl bg-blue-600 px-6 py-3.5 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50">{simitStatus === "loading" ? "Consultando…" : "Consultar SIMIT"}</button></div>}
      {simitStatus === "ready" && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{simitSummary?.count ? `Encontramos ${simitSummary.count} comparendo(s)${simitSummary.totalDebt ? ` · deuda reportada: $${simitSummary.totalDebt.toLocaleString("es-CO")}` : ""}. Selecciona uno para continuar.` : "La consulta respondió correctamente, pero no trajo comparendos."}</div>}
      {simitStatus === "error" && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">La consulta automática no está disponible en este momento. No se inventarán datos.</div>}
      {isSimitSelectionStep && simitData?.comparendos.length ? <div className="mt-5 grid gap-3">{simitData.comparendos.map((item, itemIndex) => { const active = selectedComparendo === itemIndex; return <button type="button" key={`${item.number || "comparendo"}-${itemIndex}`} onClick={() => selectComparendo(itemIndex)} className={`rounded-2xl border p-4 text-left transition ${active ? "border-blue-600 bg-blue-600 text-white shadow-lg" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"}`}><div className="flex items-center justify-between gap-3"><div><p className={`text-xs font-semibold uppercase tracking-wide ${active ? "text-blue-100" : "text-slate-500"}`}>Comparendo {itemIndex + 1}</p><p className="mt-1 font-bold">{item.number || "Número no disponible"}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"}`}>{item.status || "Pendiente de revisión"}</span></div><div className={`mt-3 grid gap-2 text-sm sm:grid-cols-3 ${active ? "text-blue-50" : "text-slate-600"}`}><span>📅 {item.date || "Sin fecha"}</span><span>🚗 {item.plate || "Sin placa"}</span><span>🏛️ {item.authority || "Sin autoridad"}</span></div><p className={`mt-3 text-sm ${active ? "text-white" : "text-slate-700"}`}>{item.description || item.infractionCode || "Infracción sin descripción disponible"}</p></button>; })}</div> : null}
    </div>}

    {!isSimitSelectionStep && <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5 md:p-7"><div className="mb-7"><div className="mb-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">TrámiteYa te acompaña</div><h3 className="text-2xl font-bold tracking-tight md:text-3xl">{step.title}</h3>{step.description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{step.description}</p>}</div>{error && <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}<div className="grid gap-6">{visibleFields.map((field) => <div key={field.id} className="rounded-2xl bg-white p-4 shadow-sm md:p-5"><label className="mb-2 block text-base font-semibold text-slate-800">{field.label}{field.required ? <span className="text-blue-600"> *</span> : null}</label><p className="mb-3 text-sm leading-5 text-slate-500">{questionHint(field)}</p>{renderField(field)}</div>)}</div></div>}

    {isSimitSelectionStep && error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="flex items-center justify-between gap-3"><button type="button" onClick={back} disabled={index === 0} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Atrás</button><div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:inline">{progress}% completado</span><button type="button" onClick={next} className="rounded-2xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700">{index === total - 1 ? "Revisar mi caso →" : isSimitSelectionStep ? "Continuar con este comparendo →" : "Continuar →"}</button></div></div>
  </div>;
}
