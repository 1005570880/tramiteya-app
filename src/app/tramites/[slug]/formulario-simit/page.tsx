"use client";

import React, { useState } from "react";
import Header from "../../../../components/Header";
import Footer from "../../../../components/Footer";
import StepForm from "../../../../components/StepForm";
import { getDynamicFormDefinition } from "../../../../data/dynamicForms";
import { procedures } from "../../../../data/procedures";
import { validateProcedureAnswers } from "../../../../lib/multitramiteEngine";
import { evaluateTrafficCase } from "../../../../lib/legalRules";
import { procedureStorage } from "../../../../lib/procedureStorage";
import { localDraftStorage } from "../../../../lib/draftStorage";
import { getSupabaseBrowser } from "../../../../lib/supabaseBrowserClient";
import type { FormAnswers } from "../../../../types/form";

type SimitRecord = { number?: string; date?: string; authority?: string; department?: string; plate?: string; ownerName?: string; documentNumber?: string; infractionCode?: string; description?: string; status?: string; value?: number; resolutionNumber?: string; resolutionDate?: string; notificationDate?: string; paymentDate?: string };

function fromSimit(record: SimitRecord): FormAnswers {
  const doc = String(record.documentNumber || "").replace(/\D/g, "");
  const name = String(record.ownerName || "").trim();
  return {
    documentType: "CC", documentNumber: doc, cedula: doc, numeroDocumento: doc, documento: doc,
    nombres: name, apellidos: "", correo: "", telefono: "", direccion: "",
    entidad: record.authority || "", ciudad: "", correo_dest: "",
    numero_acto: record.resolutionNumber || record.number || "", fecha_acto: record.resolutionDate || record.date || "",
    valor_multa: record.value != null ? String(record.value) : "", placa: record.plate || "",
    numero_comparendo: record.number || "", fecha_comparendo: record.date || "", autoridad: record.authority || "",
    valor: record.value != null ? String(record.value) : "", causal: "", hechos: "", pretension: "",
    anexos: "Estado de Cuenta SIMIT aportado por el solicitante.", fecha: new Date().toISOString().slice(0, 10),
    codigoInfraccion: record.infractionCode || "", descripcionInfraccion: record.description || "", estadoComparendo: record.status || "",
    departamento: record.department || "", numeroResolucion: record.resolutionNumber || "", fechaResolucion: record.resolutionDate || "",
    fechaNotificacion: record.notificationDate || "", fechaPago: record.paymentDate || "", __simitRecord: record,
  } as unknown as FormAnswers;
}

export default function SimitAutofillForm({ params }: { params: { slug: string } }) {
  const procedure = procedures.find((p) => p.slug === params.slug);
  const definition = getDynamicFormDefinition(params.slug);
  const [records, setRecords] = useState<SimitRecord[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [documentNumber, setDocumentNumber] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  if (!procedure || !definition || params.slug !== "derecho-de-peticion-eliminar-multa") {
    return <main className="min-h-screen bg-slate-50"><Header /><section className="mx-auto max-w-4xl px-4 py-16"><h1 className="text-2xl font-bold">Trámite no disponible</h1></section><Footer /></main>;
  }

  async function handleUpload(file?: File) {
    if (!file) return;
    setError(""); setUploading(true); setReady(false); setRecords([]); setSelected(null); setFileName(file.name);
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/simit/upload", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || "No fue posible analizar el Estado de Cuenta.");
      setDocumentNumber(data.documentNumber || "");
      setRecords(data.records || []);
      if (data.records?.length === 1) { setSelected(0); setReady(true); }
    } catch (e) { setError(e instanceof Error ? e.message : "No fue posible analizar el PDF."); }
    finally { setUploading(false); }
  }

  const selectedRecord = selected != null ? records[selected] : undefined;
  const initialAnswers = selectedRecord ? fromSimit({ ...selectedRecord, documentNumber: documentNumber || selectedRecord.documentNumber }) : undefined;

  async function complete(answers: FormAnswers) {
    const issues = validateProcedureAnswers(procedure, answers);
    if (issues.length) { setError(`Faltan ${issues.length} campo(s) obligatorio(s).`); return; }
    setError(""); setLoading(true);
    try {
      const decisions = evaluateTrafficCase(answers);
      const enriched = { ...answers, __legalDecisionEngine: { version: 1, generatedAt: new Date().toISOString(), decisions }, __simitSource: { type: "official_statement_pdf", fileName, selectedRecord: selectedRecord?.number } } as unknown as FormAnswers;
      const supabase = getSupabaseBrowser(); let instance: any = null;
      if (supabase) { const { data: { session } } = await supabase.auth.getSession(); if (session?.user) { const r = await fetch("/api/instances", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ procedureId: procedure.id, procedureSlug: procedure.slug, answers: enriched }) }); if (r.ok) instance = await r.json(); } }
      if (!instance) instance = procedureStorage.create(procedure.id, procedure.slug, enriched);
      const r = await fetch("/api/documents/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ procedureSlug: procedure.slug, answers: enriched, instanceId: instance.id }) });
      if (!r.ok) throw new Error("No fue posible generar el documento.");
      const document = await r.json(); procedureStorage.update(instance.id, { answers: enriched, status: "document_ready", document, completedAt: new Date().toISOString() });
      localDraftStorage.save(`procedure:${procedure.slug}`, { data: enriched, savedAt: new Date().toISOString() });
      window.location.href = `/tramites/${procedure.slug}/resultado/${instance.id}`;
    } catch (e) { console.error(e); setError(e instanceof Error ? e.message : "No fue posible generar el documento."); }
    finally { setLoading(false); }
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900"><Header /><section className="mx-auto max-w-5xl px-4 py-8 md:py-12">
    <div className="mb-8"><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">⚡ TrámiteYa · Automatización jurídica</div><h1 className="text-3xl font-bold tracking-tight md:text-4xl">{definition.title}</h1><p className="mt-3 max-w-3xl text-slate-600">Sube primero tu Estado de Cuenta oficial de SIMIT. TrámiteYa lo analiza, identifica los datos disponibles y prepara el trámite. Tú solo revisas y completas lo que realmente falte.</p></div>

    {!records.length && <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"><div className="mb-6 flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-600 text-xl text-white">PDF</div><div><h2 className="text-xl font-bold">1. Sube el Estado de Cuenta de SIMIT</h2><p className="mt-1 text-sm text-slate-500">Debe ser el PDF descargado directamente desde el portal oficial. No necesitas copiar ni transcribir datos.</p></div></div><label className="group flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-blue-400 hover:bg-blue-50"><input type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => handleUpload(e.target.files?.[0])} /><div className="mb-3 text-4xl">{uploading ? "⏳" : "📄"}</div><div className="text-lg font-semibold">{uploading ? "Analizando documento…" : "Seleccionar Estado de Cuenta PDF"}</div><div className="mt-2 text-sm text-slate-500">Máximo 10 MB · PDF oficial de SIMIT</div></label></div>}

    {records.length > 0 && <div className="space-y-6"><div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-semibold text-emerald-700">✓ Documento analizado</div><div className="mt-1 font-bold text-emerald-950">{fileName}</div><div className="mt-1 text-sm text-emerald-800">{records.length} registro(s) detectado(s){documentNumber ? ` · CC ${documentNumber}` : ""}</div></div><button type="button" onClick={() => { setRecords([]); setSelected(null); setReady(false); setDocumentNumber(""); }} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">Cambiar PDF</button></div></div>
      {!documentNumber && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><label className="block text-sm font-semibold text-amber-950">Cédula del titular</label><p className="mt-1 text-sm text-amber-800">No fue posible leerla del PDF. La solicitamos una sola vez.</p><input value={documentNumber} onChange={e => setDocumentNumber(e.target.value.replace(/\D/g, ""))} className="mt-3 w-full rounded-xl border border-amber-300 bg-white p-3 outline-none focus:ring-2 focus:ring-amber-400" placeholder="Número de cédula" /></div>}
      {records.length > 1 && <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">2. Elige el comparendo que vas a revisar</h2><p className="mt-1 text-sm text-slate-500">Un documento jurídico por comparendo. Selecciona solo uno.</p><div className="mt-5 grid gap-3 md:grid-cols-2">{records.map((r, i) => <button key={`${r.number}-${i}`} type="button" onClick={() => { setSelected(i); setReady(true); }} className={`rounded-2xl border p-5 text-left transition ${selected === i ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-blue-300"}`}><div className="flex items-center justify-between"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase">{r.kind || "comparendo"}</span><span className="text-lg">{selected === i ? "✓" : "○"}</span></div><div className="mt-4 text-lg font-bold">{r.number || "Sin número"}</div><div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-600"><span>📅 {r.date || "Fecha no leída"}</span><span>🚗 {r.plate || "Placa no leída"}</span><span>🏛️ {r.authority || "Autoridad no leída"}</span><span>💰 {r.value != null ? `$${r.value.toLocaleString("es-CO")}` : "Valor no leído"}</span></div></button>)}</div></div>}
      {selectedRecord && <div className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white">✓</div><div><h2 className="font-bold">{records.length > 1 ? "3." : "2."} Datos identificados</h2><p className="text-sm text-slate-500">TrámiteYa usará este registro para autocompletar el formulario.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Comparendo",selectedRecord.number],["Fecha",selectedRecord.date],["Placa",selectedRecord.plate],["Entidad",selectedRecord.authority]].map(([label,value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 font-semibold">{value || "Por completar"}</div></div>)}</div></div>}
      {selectedRecord && <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"><div className="mb-6 flex items-center justify-between"><div><h2 className="text-xl font-bold">{records.length > 1 ? "4." : "3."} Completa solo lo necesario</h2><p className="text-sm text-slate-500">Los datos del PDF ya están precargados. La información faltante la completas tú.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Autocompletado activo</span></div><StepForm key={`${selected}-${documentNumber}`} steps={definition.steps} initialAnswers={initialAnswers} draftKey={`procedure:${procedure.slug}`} onComplete={complete} /></div>}
    </div>}
    {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {loading && <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">Generando el documento jurídico…</div>}
  </section><Footer /></main>;
}
