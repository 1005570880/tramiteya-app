"use client";

import React, { useEffect, useState } from "react";
import StepForm from "../../../../components/StepForm";
import Header from "../../../../components/Header";
import Footer from "../../../../components/Footer";
import { validateProcedureAnswers } from "../../../../lib/multitramiteEngine";
import { evaluateTrafficCase } from "../../../../lib/legalRules";
import { useRouter, useSearchParams } from "next/navigation";
import { localDraftStorage } from "../../../../lib/draftStorage";
import { procedureStorage } from "../../../../lib/procedureStorage";
import { getSupabaseBrowser } from "../../../../lib/supabaseBrowserClient";
import type { FormAnswers } from "../../../../types/form";
import { procedures } from "../../../../data/procedures";
import { getDynamicFormDefinition } from "../../../../data/dynamicForms";

type SimitRecord = {
  kind?: string; number?: string; date?: string; authority?: string; department?: string;
  plate?: string; ownerName?: string; documentNumber?: string; infractionCode?: string;
  description?: string; status?: string; value?: number; resolutionNumber?: string;
  resolutionDate?: string; notificationDate?: string; paymentDate?: string;
  organismId?: string; photoDetection?: boolean;
};

function money(value?: number) {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

function fromSimit(documentNumber: string, record: SimitRecord): FormAnswers {
  return {
    documentType: "CC", documentNumber, cedula: documentNumber, numeroDocumento: documentNumber,
    nombreCompleto: record.ownerName || "", nombres: record.ownerName || "",
    comparendo: record.number || "", numeroComparendo: record.number || "", multa: record.number || "",
    fechaComparendo: record.date || "", autoridad: record.authority || "", organismoTransito: record.authority || "",
    departamento: record.department || "", placa: record.plate || "", codigoInfraccion: record.infractionCode || "",
    descripcionInfraccion: record.description || "", estadoComparendo: record.status || "",
    valorMulta: record.value ?? "", numeroResolucion: record.resolutionNumber || "",
    fechaResolucion: record.resolutionDate || "", fechaNotificacion: record.notificationDate || "",
    fechaPago: record.paymentDate || "", idOrganismoTransito: record.organismId || "",
    fotodeteccion: Boolean(record.photoDetection), __simitRecord: record,
  } as unknown as FormAnswers;
}

export default function ProcedureForm({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const search = useSearchParams();
  const definition = getDynamicFormDefinition(params.slug);
  const procedure = procedures.find((p) => p.slug === params.slug);
  const draftKey = `procedure:${params.slug}`;
  const requiresSimitFirst = params.slug === "derecho-de-peticion-eliminar-multa";

  const [resetSignal, setResetSignal] = useState(0);
  const [instanceId, setInstanceId] = useState<string | undefined>();
  const [remoteAnswers, setRemoteAnswers] = useState<FormAnswers | undefined>();
  const [preview, setPreview] = useState<FormAnswers | null>(null);
  const [analysis, setAnalysis] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [simitDocument, setSimitDocument] = useState("");
  const [simitLoading, setSimitLoading] = useState(false);
  const [simitError, setSimitError] = useState("");
  const [simitRecords, setSimitRecords] = useState<SimitRecord[]>([]);
  const [selectedSimit, setSelectedSimit] = useState<SimitRecord | null>(null);
  const [simitChecked, setSimitChecked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = localDraftStorage.load(draftKey) as any;
        const requested = search.get("instance");
        const supabase = getSupabaseBrowser();
        if (!supabase) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        let id = requested || saved?.data?.__instanceId;
        if (!id) {
          const r = await fetch("/api/instances", { headers: { Authorization: `Bearer ${session.access_token}` } });
          if (r.ok) {
            const p = await r.json();
            const existing = (p.data || []).find((i: any) => i.procedureSlug === params.slug && (i.status === "in_progress" || i.status === "draft"));
            if (existing) id = existing.id;
          }
        }
        if (!id) return;
        const r = await fetch(`/api/instances/${id}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (!r.ok) return;
        const i = await r.json();
        setInstanceId(i.id);
        setRemoteAnswers(i.answers || {});
        const savedDocument = String(i.answers?.documentNumber || i.answers?.cedula || "");
        if (requiresSimitFirst && savedDocument) setSimitDocument(savedDocument);
        localDraftStorage.save(draftKey, { data: { ...(saved?.data || {}), ...(i.answers || {}), __instanceId: i.id }, savedAt: new Date().toISOString() });
      } catch (e) { console.error(e); }
    })();
  }, [search, draftKey, params.slug, requiresSimitFirst]);

  if (!definition || !procedure) {
    return <main className="min-h-screen bg-slate-50"><Header /><section className="max-w-4xl mx-auto px-4 py-16"><h1 className="text-2xl font-bold">Trámite no disponible</h1></section><Footer /></main>;
  }

  const currentProcedure = procedure;

  function analyze(a: FormAnswers) {
    const text = `${params.slug} ${currentProcedure.title} ${currentProcedure.category}`;
    const decisions = /multa|comparendo|fotomult|transito|tr[aá]nsito/i.test(text) ? evaluateTrafficCase(a) : [];
    setAnalysis(decisions);
    return decisions;
  }

  async function consultSimit() {
    const documentNumber = simitDocument.replace(/\D/g, "");
    if (!documentNumber) { setSimitError("Ingresa la cédula para consultar SIMIT."); return; }
    setSimitLoading(true); setSimitError(""); setSimitRecords([]); setSelectedSimit(null); setSimitChecked(false);
    try {
      const response = await fetch("/api/simit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentType: "CC", documentNumber }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.message || `No fue posible consultar SIMIT (${payload.code || response.status}).`);
      const records = Array.isArray(payload.comparendos) ? payload.comparendos : [];
      setSimitDocument(documentNumber); setSimitRecords(records); setSimitChecked(true);
      if (!records.length) setSimitError("SIMIT no reportó multas o comparendos para esta cédula.");
    } catch (error) {
      setSimitChecked(false); setSimitError(error instanceof Error ? error.message : "No fue posible consultar SIMIT.");
    } finally { setSimitLoading(false); }
  }

  async function ensureInstance(a: FormAnswers) {
    const supabase = getSupabaseBrowser();
    const saved = localDraftStorage.load(draftKey) as any;
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        if (instanceId) {
          const r = await fetch(`/api/instances/${instanceId}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
          if (r.ok) return r.json();
        }
        const r = await fetch("/api/instances", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ procedureId: currentProcedure.id, procedureSlug: currentProcedure.slug, answers: a }) });
        if (r.ok) { const x = await r.json(); setInstanceId(x.id); return x; }
      }
    }
    const savedId = saved?.data?.__instanceId;
    if (savedId) { const x = procedureStorage.get(savedId); if (x) return x; }
    const x = procedureStorage.create(currentProcedure.id, currentProcedure.slug, a); setInstanceId(x.id); return x;
  }

  async function generate(a: FormAnswers) {
    const issues = validateProcedureAnswers(currentProcedure, a);
    if (issues.length) { alert(`Faltan ${issues.length} campo(s) obligatorio(s).`); return; }
    setLoading(true);
    try {
      const decisions = analyze(a);
      const instance = await ensureInstance(a);
      const enrichedAnswers = { ...a, __legalDecisionEngine: { version: 1, generatedAt: new Date().toISOString(), decisions } } as unknown as FormAnswers;
      const r = await fetch("/api/documents/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ procedureSlug: currentProcedure.slug, answers: enrichedAnswers, instanceId: instance.id }) });
      if (!r.ok) throw new Error("Document generation failed");
      const document = await r.json();
      if (getSupabaseBrowser()) {
        const supabase = getSupabaseBrowser();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) await fetch(`/api/instances/${instance.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ answers: enrichedAnswers, status: "document_ready", document, completedAt: new Date().toISOString() }) });
      }
      procedureStorage.update(instance.id, { answers: enrichedAnswers, status: "document_ready", document, completedAt: new Date().toISOString() });
      localDraftStorage.remove(draftKey);
      router.push(`/tramites/${currentProcedure.slug}/resultado/${instance.id}`);
    } catch (e) { console.error(e); alert("No fue posible generar el documento. Inténtalo nuevamente."); }
    finally { setLoading(false); }
  }

  function clearDraft() {
    localDraftStorage.remove(draftKey); setInstanceId(undefined); setRemoteAnswers(undefined); setAnalysis([]); setPreview(null); setResetSignal(x => x + 1);
    setSimitDocument(""); setSimitRecords([]); setSelectedSimit(null); setSimitChecked(false); setSimitError("");
  }

  const selectedAnswers = selectedSimit ? fromSimit(simitDocument, selectedSimit) : undefined;
  const formInitialAnswers = selectedAnswers ? ({ ...(remoteAnswers || {}), ...selectedAnswers } as FormAnswers) : remoteAnswers;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <section className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow">
          <div className="mb-6"><p className="text-sm font-medium text-blue-600">{currentProcedure.category}</p><h1 className="text-2xl md:text-3xl font-bold mt-1">{definition.title}</h1><p className="text-slate-500 mt-2">{requiresSimitFirst ? "Primero consultamos SIMIT para identificar la multa que quieres revisar. Después completaremos automáticamente los datos del trámite." : "Completa los datos. TrámiteYa adaptará el flujo según el trámite elegido."}</p></div>
          <div className="flex justify-end mb-4"><button onClick={clearDraft} className="px-3 py-1 rounded-md border text-sm">Borrar borrador</button></div>
          {requiresSimitFirst && !selectedSimit ? (
            <div className="space-y-6"><div className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><p className="text-sm font-semibold text-blue-700">Consulta inteligente</p><h2 className="text-xl font-bold mt-1">Primero buscamos tus multas y comparendos</h2><p className="text-sm text-slate-600 mt-2">Ingresa la cédula. TrámiteYa consultará SIMIT y te mostrará los registros encontrados para que selecciones exactamente el que quieres revisar.</p></div><div><label className="block text-sm font-semibold mb-2">Cédula</label><input value={simitDocument} onChange={e => setSimitDocument(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Ej. 73201464" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg outline-none focus:border-blue-600" /><p className="text-xs text-slate-500 mt-2">La consulta se realiza con tipo de documento CC.</p></div><button onClick={consultSimit} disabled={simitLoading} className="w-full rounded-xl bg-blue-600 px-5 py-3 text-white font-semibold disabled:opacity-60">{simitLoading ? "Consultando SIMIT..." : "Consultar SIMIT"}</button>{simitError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{simitError}</div>}{simitChecked && simitRecords.length > 0 && <div className="space-y-3"><div><h2 className="text-lg font-bold">Registros encontrados</h2><p className="text-sm text-slate-500">Selecciona uno para continuar. Los datos se cargarán automáticamente en el formulario.</p></div>{simitRecords.map((record, index) => <button type="button" key={`${record.number || "registro"}-${index}`} onClick={() => setSelectedSimit(record)} className="w-full text-left rounded-2xl border border-slate-200 p-4 hover:border-blue-500 hover:bg-blue-50 transition"><div className="flex items-center justify-between gap-4"><strong>{record.number || `Registro ${index + 1}`}</strong><span className="text-sm font-semibold">{money(record.value)}</span></div><div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm"><div><span className="text-slate-400 block">Placa</span>{record.plate || "—"}</div><div><span className="text-slate-400 block">Fecha</span>{record.date || "—"}</div><div><span className="text-slate-400 block">Organismo</span>{record.authority || "—"}</div><div><span className="text-slate-400 block">Estado</span>{record.status || "—"}</div></div></button>)}</div>}</div>
          ) : !preview ? (<><StepForm steps={definition.steps} onComplete={(a) => { analyze(a); setPreview(a); }} draftKey={draftKey} resetSignal={resetSignal} instanceId={instanceId} onInstanceReady={setInstanceId} initialAnswers={formInitialAnswers} /></>) : (
            <div className="space-y-6"><div><h2 className="text-xl font-bold">Revisión del trámite</h2><p className="text-sm text-slate-500 mt-1">Verifica la información antes de generar el documento.</p></div><pre className="max-h-96 overflow-auto rounded-xl bg-slate-50 p-4 text-xs">{JSON.stringify(preview, null, 2)}</pre>{analysis.length > 0 && <div className="rounded-xl border p-4"><h3 className="font-semibold mb-2">Análisis preliminar</h3>{analysis.map((d, i) => <div key={i} className="text-sm py-1">{d.label || d.id || "Regla aplicable"}</div>)}</div>}<div className="flex gap-3"><button type="button" onClick={() => setPreview(null)} className="rounded-xl border px-5 py-3 font-semibold">Volver a editar</button><button type="button" onClick={() => generate(preview)} disabled={loading} className="rounded-xl bg-blue-600 px-5 py-3 text-white font-semibold disabled:opacity-60">{loading ? "Generando..." : "Generar documento"}</button></div></div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
