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
  const [statementLoading, setStatementLoading] = useState(false);
  const [simitError, setSimitError] = useState("");
  const [simitRecords, setSimitRecords] = useState<SimitRecord[]>([]);
  const [selectedSimit, setSelectedSimit] = useState<SimitRecord | null>(null);
  const [statementUploaded, setStatementUploaded] = useState(false);

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

  if (!definition || !procedure) return <main className="min-h-screen bg-slate-50"><Header /><section className="max-w-4xl mx-auto px-4 py-16"><h1 className="text-2xl font-bold">Trámite no disponible</h1></section><Footer /></main>;
  const currentProcedure = procedure;

  function analyze(a: FormAnswers) {
    const text = `${params.slug} ${currentProcedure.title} ${currentProcedure.category}`;
    const decisions = /multa|comparendo|fotomult|transito|tr[aá]nsito/i.test(text) ? evaluateTrafficCase(a) : [];
    setAnalysis(decisions); return decisions;
  }

  async function uploadStatement(file: File) {
    const documentNumber = simitDocument.replace(/\D/g, "");
    if (!documentNumber) { setSimitError("Primero ingresa la cédula."); return; }
    if (file.size > 10 * 1024 * 1024) { setSimitError("El PDF supera el límite de 10 MB."); return; }
    setStatementLoading(true); setSimitError(""); setSimitRecords([]); setSelectedSimit(null); setStatementUploaded(false);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("documentNumber", documentNumber);
      const response = await fetch("/api/simit/upload", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.message || "No fue posible analizar el estado de cuenta.");
      const records = (payload.records || []) as SimitRecord[];
      if (!records.length) throw new Error("No encontramos comparendos en el PDF. Sube el Estado de Cuenta descargado directamente desde SIMIT.");
      setSimitRecords(records);
      setStatementUploaded(true);
      try {
        sessionStorage.setItem(SIMIT_SESSION_KEY, JSON.stringify({ records, documentNumber, fileName: file.name, selectedRecord: null }));
      } catch {}
    } catch (error) {
      setSimitError(error instanceof Error ? error.message : "No fue posible analizar el estado de cuenta.");
    } finally { setStatementLoading(false); }
  }

  function selectSimitRecord(record: SimitRecord) {
    setSelectedSimit(record);
    try {
      const raw = sessionStorage.getItem(SIMIT_SESSION_KEY);
      const current = raw ? JSON.parse(raw) : {};
      sessionStorage.setItem(SIMIT_SESSION_KEY, JSON.stringify({
        ...current,
        documentNumber: simitDocument.replace(/\D/g, "") || current.documentNumber || record.documentNumber || "",
        selectedRecord: record,
      }));
    } catch {}
    const selected = fromSimit(simitDocument, record);
    localDraftStorage.save(draftKey, {
      data: {
        ...(localDraftStorage.load(draftKey) as any)?.data,
        ...selected,
        __simitRecord: record,
        __simitSelected: true,
      },
      savedAt: new Date().toISOString(),
    });
  }

  async function ensureInstance(a: FormAnswers) {
    const supabase = getSupabaseBrowser();
    const saved = localDraftStorage.load(draftKey) as any;
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        if (instanceId) { const r = await fetch(`/api/instances/${instanceId}`, { headers: { Authorization: `Bearer ${session.access_token}` } }); if (r.ok) return r.json(); }
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
      const decisions = analyze(a); const instance = await ensureInstance(a);
      const enrichedAnswers = { ...a, __legalDecisionEngine: { version: 1, generatedAt: new Date().toISOString(), decisions } } as unknown as FormAnswers;
      const r = await fetch("/api/documents/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ procedureSlug: currentProcedure.slug, answers: enrichedAnswers, instanceId: instance.id }) });
      if (!r.ok) throw new Error("Document generation failed");
      const document = await r.json(); const supabase = getSupabaseBrowser();
      if (supabase) { const { data: { session } } = await supabase.auth.getSession(); if (session?.user) await fetch(`/api/instances/${instance.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ answers: enrichedAnswers, status: "document_ready", document, completedAt: new Date().toISOString() }) }); }
      procedureStorage.update(instance.id, { answers: enrichedAnswers, status: "document_ready", document, completedAt: new Date().toISOString() }); localDraftStorage.remove(draftKey); router.push(`/tramites/${currentProcedure.slug}/resultado/${instance.id}`);
    } catch (e) { console.error(e); alert("No fue posible generar el documento. Inténtalo nuevamente."); } finally { setLoading(false); }
  }

  function clearDraft() {
    localDraftStorage.remove(draftKey); setInstanceId(undefined); setRemoteAnswers(undefined); setAnalysis([]); setPreview(null); setResetSignal(x => x + 1);
    setSimitDocument(""); setSimitRecords([]); setSelectedSimit(null); setSimitError(""); setStatementUploaded(false);
    try { sessionStorage.removeItem(SIMIT_SESSION_KEY); } catch {}
  }

  const selectedAnswers = selectedSimit ? fromSimit(simitDocument, selectedSimit) : undefined;
  const formInitialAnswers = selectedAnswers ? ({ ...(remoteAnswers || {}), ...selectedAnswers } as FormAnswers) : remoteAnswers;

  return <main className="min-h-screen bg-slate-50 text-slate-900"><Header /><section className="max-w-4xl mx-auto px-4 py-12"><div className="bg-white p-6 md:p-8 rounded-2xl shadow">
    <div className="mb-6"><p className="text-sm font-medium text-blue-600">{currentProcedure.category}</p><h1 className="text-2xl md:text-3xl font-bold mt-1">{definition.title}</h1><p className="text-slate-500 mt-2">{requiresSimitFirst ? "Ingresa la cédula y ten a la mano el Estado de Cuenta oficial de SIMIT. TrámiteYa analizará el PDF, identificará los comparendos y completará automáticamente la información del trámite." : "Completa los datos. TrámiteYa adaptará el flujo según el trámite elegido."}</p></div>
    <div className="flex justify-end mb-4"><button onClick={clearDraft} className="px-3 py-1 rounded-md border text-sm">Borrar borrador</button></div>
    {requiresSimitFirst && !selectedSimit ? <div className="space-y-6">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><p className="text-sm font-semibold text-blue-700">Consulta inteligente</p><h2 className="text-xl font-bold mt-1">Tu Estado de Cuenta de SIMIT es la fuente</h2><p className="text-sm text-slate-600 mt-2">No tienes que copiar datos ni llenar manualmente el formulario. Descarga el Estado de Cuenta desde SIMIT y súbelo aquí. TrámiteYa extraerá los datos del PDF y, si hay varios comparendos, te mostrará cada uno para que elijas solamente el que vas a revisar.</p></div>
      <div><label className="block text-sm font-semibold mb-2">Cédula del titular</label><input value={simitDocument} onChange={e => setSimitDocument(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Ej. 73201464" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg outline-none focus:border-blue-600" /><p className="text-xs text-slate-500 mt-2">Tipo de documento: CC. Esta cédula se utilizará para asociar el Estado de Cuenta al trámite.</p></div>
      <div className="rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-6"><div className="flex items-start gap-3"><div className="text-2xl">📄</div><div><h3 className="font-bold">Sube el Estado de Cuenta de SIMIT</h3><p className="text-sm text-slate-600 mt-1">Ten preparado el PDF que descargaste del portal oficial. TrámiteYa hará la extracción automáticamente.</p></div></div><label className={`mt-5 flex cursor-pointer items-center justify-center rounded-xl px-5 py-4 text-center font-semibold text-white ${statementLoading || !simitDocument ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}><input type="file" accept="application/pdf,.pdf" className="hidden" disabled={statementLoading || !simitDocument} onChange={e => { const file = e.target.files?.[0]; if (file) void uploadStatement(file); e.currentTarget.value = ""; }} />{statementLoading ? "Analizando PDF automáticamente..." : "Seleccionar Estado de Cuenta PDF"}</label><p className="text-xs text-slate-500 mt-3">PDF · máximo 10 MB. No se requiere copiar ni pegar información.</p></div>
      {simitError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{simitError}</div>}
      {statementUploaded && simitRecords.length > 0 && <div className="space-y-3"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-semibold text-emerald-800">Análisis completado</p><p className="text-sm text-emerald-700 mt-1">TrámiteYa identificó {simitRecords.length} registro(s). Selecciona uno. El documento jurídico solo se generará para el comparendo seleccionado.</p></div><h3 className="font-bold text-lg">Selecciona el comparendo que quieres revisar</h3>{simitRecords.map((record, index) => <button key={`${record.number}-${index}`} type="button" onClick={() => selectSimitRecord(record)} className="w-full text-left rounded-xl border p-4 hover:border-blue-500 hover:bg-blue-50"><div className="flex justify-between gap-3"><strong>{record.number || `Registro ${index + 1}`}</strong><span className="font-semibold">{money(record.value)}</span></div><div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-sm text-slate-600"><span>Fecha: {record.date || "—"}</span><span>Placa: {record.plate || "—"}</span><span>Organismo: {record.authority || "—"}</span><span>Estado: {record.status || "—"}</span></div>{record.description && <p className="text-sm text-slate-700 mt-2">{record.description}</p>}<p className="text-xs text-blue-700 mt-3 font-semibold">Usar este comparendo →</p></button>)}</div>}
    </div> : !preview ? <StepForm steps={definition.steps} onComplete={(a) => { analyze(a); setPreview(a); }} draftKey={draftKey} resetSignal={resetSignal} instanceId={instanceId} onInstanceReady={setInstanceId} initialAnswers={formInitialAnswers} /> : <div className="space-y-6"><div><h2 className="text-xl font-bold">Revisión del trámite</h2><p className="text-sm text-slate-500 mt-1">La información extraída del Estado de Cuenta ya fue incorporada. Verifica antes de generar el documento.</p></div><pre className="max-h-96 overflow-auto rounded-xl bg-slate-50 p-4 text-xs">{JSON.stringify(preview, null, 2)}</pre>{analysis.length > 0 && <div className="rounded-xl border p-4"><h3 className="font-semibold mb-2">Análisis jurídico preliminar</h3>{analysis.map((d, i) => <div key={i} className="text-sm py-1">{d.label || d.id || "Regla aplicable"}</div>)}</div>}<div className="flex gap-3"><button type="button" onClick={() => setPreview(null)} className="rounded-xl border px-5 py-3 font-semibold">Volver a editar</button><button type="button" onClick={() => generate(preview)} disabled={loading} className="rounded-xl bg-blue-600 px-5 py-3 text-white font-semibold disabled:opacity-60">{loading ? "Generando..." : "Generar documento"}</button></div></div>}
  </div></section><Footer /></main>;
}

const SIMIT_SESSION_KEY = "tramiteya:simit-upload:v1";
