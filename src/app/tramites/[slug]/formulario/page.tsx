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

type SimitRecord = { kind?: string; number?: string; date?: string; authority?: string; department?: string; plate?: string; ownerName?: string; documentNumber?: string; infractionCode?: string; description?: string; status?: string; value?: number; resolutionNumber?: string; resolutionDate?: string; notificationDate?: string; paymentDate?: string; organismId?: string; photoDetection?: boolean };
const SIMIT_SESSION_KEY = "tramiteya:simit-upload:v1";
const withTimeout = (ms: number) => AbortSignal.timeout(ms);

function money(value?: number) { return value == null ? "—" : new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value); }
function fromSimit(documentNumber: string, r: SimitRecord): FormAnswers { return { documentType: "CC", documentNumber, cedula: documentNumber, numeroDocumento: documentNumber, nombreCompleto: r.ownerName || "", nombres: r.ownerName || "", comparendo: r.number || "", numeroComparendo: r.number || "", multa: r.number || "", fechaComparendo: r.date || "", autoridad: r.authority || "", organismoTransito: r.authority || "", departamento: r.department || "", placa: r.plate || "", codigoInfraccion: r.infractionCode || "", descripcionInfraccion: r.description || "", estadoComparendo: r.status || "", valorMulta: r.value ?? "", numeroResolucion: r.resolutionNumber || "", fechaResolucion: r.resolutionDate || "", fechaNotificacion: r.notificationDate || "", fechaPago: r.paymentDate || "", idOrganismoTransito: r.organismId || "", fotodeteccion: Boolean(r.photoDetection), __simitRecord: r } as unknown as FormAnswers; }

export default function ProcedureForm({ params }: { params: { slug: string } }) {
  const router = useRouter(); const search = useSearchParams();
  const definition = getDynamicFormDefinition(params.slug); const procedure = procedures.find(p => p.slug === params.slug); const draftKey = `procedure:${params.slug}`; const requiresSimitFirst = params.slug === "derecho-de-peticion-eliminar-multa";
  const [instanceId, setInstanceId] = useState<string>(); const [remoteAnswers, setRemoteAnswers] = useState<FormAnswers>(); const [preview, setPreview] = useState<FormAnswers | null>(null); const [analysis, setAnalysis] = useState<any[]>([]); const [loading, setLoading] = useState(false); const [simitDocument, setSimitDocument] = useState(""); const [statementLoading, setStatementLoading] = useState(false); const [simitError, setSimitError] = useState(""); const [simitRecords, setSimitRecords] = useState<SimitRecord[]>([]); const [selectedSimit, setSelectedSimit] = useState<SimitRecord | null>(null);

  useEffect(() => { let cancelled = false; (async () => { try { const saved = localDraftStorage.load(draftKey) as any; const id = search.get("instance") || saved?.data?.__instanceId; const supabase = getSupabaseBrowser(); if (!supabase) return; const { data: { session } } = await supabase.auth.getSession(); if (!session?.user || cancelled) return; if (!id) return; const r = await fetch(`/api/instances/${id}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store", signal: withTimeout(10000) }); if (!r.ok || cancelled) return; const i = await r.json(); setInstanceId(i.id); setRemoteAnswers(i.answers || {}); const doc = String(i.answers?.documentNumber || i.answers?.cedula || ""); if (requiresSimitFirst) setSimitDocument(doc); localDraftStorage.save(draftKey, { data: { ...(saved?.data || {}), ...(i.answers || {}), __instanceId: i.id }, savedAt: new Date().toISOString() }); } catch (e) { console.warn("No se pudo cargar instancia remota", e); } })(); return () => { cancelled = true; }; }, [search, draftKey, requiresSimitFirst]);

  if (!definition || !procedure) return <main className="min-h-screen bg-slate-50"><Header /><section className="max-w-4xl mx-auto px-4 py-16"><h1 className="text-2xl font-bold">Trámite no disponible</h1></section><Footer /></main>;
  const currentProcedure = procedure;
  const analyze = (a: FormAnswers) => { const text = `${params.slug} ${currentProcedure.title} ${currentProcedure.category}`; const d = /multa|comparendo|fotomult|transito|tr[aá]nsito/i.test(text) ? evaluateTrafficCase(a) : []; setAnalysis(d); return d; };

  async function uploadStatement(file: File) {
    const documentNumber = simitDocument.replace(/\D/g, ""); if (!documentNumber) return setSimitError("Primero ingresa la cédula.");
    if (file.size > 10 * 1024 * 1024) return setSimitError("El PDF supera el límite de 10 MB.");
    setStatementLoading(true); setSimitError(""); setSimitRecords([]); setSelectedSimit(null);
    try {
      const form = new FormData(); form.append("file", file); form.append("documentNumber", documentNumber);
      // The timeout only protects the NETWORK request. The server fully awaits file.arrayBuffer() and pdf-parse before responding.
      const response = await fetch("/api/simit/upload", { method: "POST", body: form, signal: withTimeout(60000) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.message || "No fue posible analizar el estado de cuenta.");
      const records = (payload.records || []) as SimitRecord[];
      const rawText = typeof payload.rawText === "string" ? payload.rawText : "";
      if (!records.length) throw new Error("No encontramos comparendos en el PDF. Sube el Estado de Cuenta descargado directamente desde SIMIT.");

      // Persist extraction immediately in both sessionStorage and the draft. No database round-trip is required.
      const existing = (localDraftStorage.load(draftKey) as any)?.data || {};
      localDraftStorage.save(draftKey, { data: { ...existing, documentNumber, cedula: documentNumber, __simitRawText: rawText, __simitRecords: records, __simitFileName: file.name }, savedAt: new Date().toISOString() });
      try { sessionStorage.setItem(SIMIT_SESSION_KEY, JSON.stringify({ records, rawText, documentNumber, fileName: file.name, selectedRecord: null })); } catch {}
      setSimitRecords(records);
    } catch (e) { setSimitError(e instanceof Error ? e.message : "No fue posible analizar el estado de cuenta."); } finally { setStatementLoading(false); }
  }

  function selectSimitRecord(record: SimitRecord) {
    setSelectedSimit(record); const selected = fromSimit(simitDocument, record);
    const existing = (localDraftStorage.load(draftKey) as any)?.data || {};
    localDraftStorage.save(draftKey, { data: { ...existing, ...selected, __simitRecord: record, __simitSelected: true }, savedAt: new Date().toISOString() });
    try { const raw = sessionStorage.getItem(SIMIT_SESSION_KEY); const current = raw ? JSON.parse(raw) : {}; sessionStorage.setItem(SIMIT_SESSION_KEY, JSON.stringify({ ...current, documentNumber: simitDocument.replace(/\D/g, "") || record.documentNumber || "", selectedRecord: record })); } catch {}
  }

  async function ensureInstance(a: FormAnswers) { const saved = localDraftStorage.load(draftKey) as any; const supabase = getSupabaseBrowser(); if (supabase) { try { const { data: { session } } = await supabase.auth.getSession(); if (session?.user) { if (instanceId) { const r = await fetch(`/api/instances/${instanceId}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store", signal: withTimeout(8000) }); if (r.ok) return r.json(); } const r = await fetch("/api/instances", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ procedureId: currentProcedure.id, procedureSlug: currentProcedure.slug, answers: a }), signal: withTimeout(10000) }); if (r.ok) { const x = await r.json(); setInstanceId(x.id); return x; } } } catch (e) { console.warn("Instancia remota no disponible; usando almacenamiento local", e); } } const savedId = saved?.data?.__instanceId; if (savedId) { const x = procedureStorage.get(savedId); if (x) return x; } const x = procedureStorage.create(currentProcedure.id, currentProcedure.slug, a); setInstanceId(x.id); return x; }

  async function generate(a: FormAnswers) {
    const issues = validateProcedureAnswers(currentProcedure, a); if (issues.length) { alert(`Faltan ${issues.length} campo(s) obligatorio(s).`); return; }
    setLoading(true);
    try {
      const decisions = analyze(a); const instance = await ensureInstance(a); const enrichedAnswers = { ...a, __legalDecisionEngine: { version: 1, generatedAt: new Date().toISOString(), decisions } } as unknown as FormAnswers;
      const response = await fetch("/api/documents/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ procedureSlug: currentProcedure.slug, answers: enrichedAnswers, instanceId: instance.id }), signal: withTimeout(60000) });
      if (!response.ok) throw new Error(`Document generation failed (${response.status})`);
      const document = await response.json(); const completedAt = new Date().toISOString();
      procedureStorage.update(instance.id, { answers: enrichedAnswers, status: "document_ready", document, completedAt }); localDraftStorage.remove(draftKey);
      void (async () => { try { const supabase = getSupabaseBrowser(); if (!supabase) return; const { data: { session } } = await supabase.auth.getSession(); if (!session?.user) return; await fetch(`/api/instances/${instance.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ answers: enrichedAnswers, status: "document_ready", document, completedAt }), signal: withTimeout(10000) }); } catch (e) { console.warn("Persistencia remota diferida/fallida; resultado local conservado", e); } })();
      router.replace(`/tramites/${currentProcedure.slug}/resultado/${instance.id}`);
    } catch (e) { console.error(e); alert(e instanceof Error && e.name === "TimeoutError" ? "La generación está tardando demasiado. Inténtalo nuevamente." : "No fue posible generar el documento. Inténtalo nuevamente."); } finally { setLoading(false); }
  }

  function clearDraft() { localDraftStorage.remove(draftKey); setInstanceId(undefined); setRemoteAnswers(undefined); setPreview(null); setAnalysis([]); setSimitDocument(""); setSimitRecords([]); setSelectedSimit(null); setSimitError(""); try { sessionStorage.removeItem(SIMIT_SESSION_KEY); } catch {} }
  const selectedAnswers = selectedSimit ? fromSimit(simitDocument, selectedSimit) : undefined; const formInitialAnswers = selectedAnswers ? ({ ...(remoteAnswers || {}), ...selectedAnswers } as FormAnswers) : remoteAnswers;

  return <main className="min-h-screen bg-slate-50 text-slate-900"><Header /><section className="max-w-4xl mx-auto px-4 py-12"><div className="bg-white p-6 md:p-8 rounded-2xl shadow"><div className="mb-6"><p className="text-sm font-medium text-blue-600">{currentProcedure.category}</p><h1 className="text-2xl md:text-3xl font-bold mt-1">{definition.title}</h1><p className="text-slate-500 mt-2">{requiresSimitFirst ? "Descarga el Estado de Cuenta oficial de SIMIT y súbelo. TrámiteYa analizará los registros automáticamente." : "Completa los datos. TrámiteYa adaptará el flujo al trámite elegido."}</p></div><div className="flex justify-end mb-4"><button onClick={clearDraft} className="px-3 py-1 rounded-md border text-sm">Borrar borrador</button></div>{requiresSimitFirst && !selectedSimit ? <div className="space-y-6"><div className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><p className="text-sm font-semibold text-blue-700">Consulta inteligente</p><h2 className="text-xl font-bold mt-1">Tu Estado de Cuenta de SIMIT es la fuente</h2><p className="text-sm text-slate-600 mt-2">No tienes que copiar datos ni llenar manualmente el formulario.</p></div><div><label className="block text-sm font-semibold mb-2">Cédula del titular</label><input value={simitDocument} onChange={e => setSimitDocument(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg" placeholder="Ej. 73201464" /></div><label className={`flex cursor-pointer items-center justify-center rounded-xl px-5 py-4 font-semibold text-white ${statementLoading || !simitDocument ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}><input type="file" accept="application/pdf,.pdf" className="hidden" disabled={statementLoading || !simitDocument} onChange={e => { const f=e.target.files?.[0]; if(f) void uploadStatement(f); e.currentTarget.value=""; }} />{statementLoading ? "Analizando PDF automáticamente..." : "Seleccionar Estado de Cuenta PDF"}</label>{simitError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{simitError}</div>}{simitRecords.length>0 && <div className="space-y-3"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-800">Análisis completado: {simitRecords.length} registro(s).</div>{simitRecords.map((r,i)=><button key={`${r.number||"record"}-${i}`} type="button" onClick={()=>selectSimitRecord(r)} className="w-full text-left rounded-xl border p-4 hover:border-blue-500 hover:bg-blue-50"><div className="flex justify-between gap-3"><strong>{r.number || `Registro ${i+1}`}</strong><span>{money(r.value)}</span></div><div className="mt-2 text-sm text-slate-600">{r.date || "Fecha —"} · {r.authority || "Organismo —"} · {r.plate || "Placa —"}</div><div className="text-xs text-blue-700 mt-3 font-semibold">Usar este comparendo →</div></button>)}</div>}</div> : !preview ? <StepForm steps={definition.steps} onComplete={a=>{analyze(a);setPreview(a)}} draftKey={draftKey} instanceId={instanceId} initialAnswers={formInitialAnswers} /> : <div className="space-y-6"><div><h2 className="text-xl font-bold">Revisión del trámite</h2><p className="text-sm text-slate-500 mt-1">La información está lista. Verifica antes de generar.</p></div><pre className="max-h-96 overflow-auto rounded-xl bg-slate-50 p-4 text-xs">{JSON.stringify(preview,null,2)}</pre>{analysis.length>0&&<div className="rounded-xl border p-4"><h3 className="font-semibold mb-2">Análisis jurídico preliminar</h3>{analysis.map((d,i)=><div key={i} className="text-sm py-1">{d.label||d.id||"Regla aplicable"}</div>)}</div>}<div className="flex gap-3"><button type="button" onClick={()=>setPreview(null)} className="rounded-xl border px-5 py-3 font-semibold">Volver a editar</button><button type="button" onClick={()=>generate(preview)} disabled={loading} className="rounded-xl bg-blue-600 px-5 py-3 text-white font-semibold disabled:opacity-60">{loading?"Generando documento…":"Generar documento"}</button></div></div>}</div></section><Footer /></main>;
}
