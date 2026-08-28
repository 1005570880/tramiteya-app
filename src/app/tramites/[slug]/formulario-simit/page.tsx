"use client";

import React, { useEffect, useState } from "react";
import Header from "../../../../components/Header";
import Footer from "../../../../components/Footer";
import SimitDownloadGuide from "../../../../components/SimitDownloadGuide";
import { getDynamicFormDefinition } from "../../../../data/dynamicForms";
import { procedures } from "../../../../data/procedures";
import { evaluateTrafficCase } from "../../../../lib/legalRules";
import { procedureStorage } from "../../../../lib/procedureStorage";
import { localDraftStorage } from "../../../../lib/draftStorage";
import { getSupabaseBrowser } from "../../../../lib/supabaseBrowserClient";
import type { FormAnswers } from "../../../../types/form";

type SimitRecord = { kind?: string; number?: string; date?: string; authority?: string; department?: string; municipality?: string; plate?: string; ownerName?: string; documentNumber?: string; infractionCode?: string; description?: string; status?: string; value?: number; resolutionNumber?: string; resolutionDate?: string; notificationDate?: string; paymentDate?: string };
type SimitSession = { records: SimitRecord[]; documentNumber: string; fileName: string; selectedRecord?: SimitRecord | null };
const SIMIT_SESSION_KEY = "tramiteya:simit-upload:v1";
const TRAMI_ANSWERS_KEY = "tramiteya:trami-questionnaire:v1";

function splitOwnerName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { nombres: value.trim(), apellidos: "" };
  if (parts.length === 2) return { nombres: parts[0], apellidos: parts[1] };
  if (parts.length === 3) return { nombres: parts[0], apellidos: parts.slice(1).join(" ") };
  return { nombres: parts.slice(0, 2).join(" "), apellidos: parts.slice(-2).join(" ") };
}

function buildLegalNarrative(record: SimitRecord) {
  const number = record.number || "el registro identificado en el Estado de Cuenta SIMIT";
  const date = record.date || "la fecha que consta en el Estado de Cuenta SIMIT";
  const authority = record.authority || "la autoridad de tránsito competente";
  const code = record.infractionCode ? `, código de infracción ${record.infractionCode}` : "";
  const description = record.description ? ` (${record.description})` : "";
  const status = record.status ? ` El estado reportado en el documento es: ${record.status}.` : "";
  const resolution = record.resolutionNumber ? ` Se identifica además la resolución/acto ${record.resolutionNumber}${record.resolutionDate ? ` de fecha ${record.resolutionDate}` : ""}.` : "";
  const notification = record.notificationDate ? ` Consta como fecha de notificación ${record.notificationDate}.` : "";
  const payment = record.paymentDate ? ` Consta como fecha de pago ${record.paymentDate}.` : "";
  return {
    causal: `Se solicita la revisión integral de la actuación administrativa asociada al registro ${number}. Con base exclusivamente en la información extraída del Estado de Cuenta SIMIT, se pide verificar la legalidad, vigencia, estado y trazabilidad de la actuación y determinar si existe fundamento para su eliminación, archivo, corrección o revocatoria. La causal definitiva deberá establecerse a partir del expediente administrativo y de las actuaciones efectivamente acreditadas; TrámiteYa no presume hechos que no consten en la documentación aportada.${resolution}${notification}`,
    hechos: `Del Estado de Cuenta SIMIT aportado se identifica el registro ${number}, asociado a la actuación de fecha ${date}, ante ${authority}${code}${description}.${status}${resolution}${notification}${payment} La información disponible permite individualizar la actuación, pero la procedencia de su eliminación o corrección depende de la verificación del expediente, los actos administrativos, las constancias de notificación, las actuaciones de cobro y demás soportes que obren en poder de la autoridad.`,
    pretension: `Solicito a ${authority}: (1) revisar integralmente la actuación administrativa asociada al registro ${number}; (2) remitir o poner a disposición el expediente y los soportes que fundamentan la anotación, incluidos comparendo, actos administrativos, evidencia, constancias de notificación y actuaciones de cobro cuando correspondan; (3) verificar la existencia de errores, inconsistencias, vencimiento de términos, irregularidades de notificación o cualquier otra circunstancia jurídicamente relevante; y (4) si de la verificación se acredita la procedencia, disponer el archivo, retiro, corrección, revocatoria o actualización del registro conforme al régimen aplicable.`
  };
}

function fromSimit(record: SimitRecord): FormAnswers {
  const doc = String(record.documentNumber || "").replace(/\D/g, "");
  const owner = splitOwnerName(String(record.ownerName || "").trim());
  const legal = buildLegalNarrative(record);
  return { documentType: "CC", documentNumber: doc, cedula: doc, numeroDocumento: doc, documento: doc, nombres: owner.nombres, apellidos: owner.apellidos, correo: "", telefono: "", direccion: "", entidad: record.authority || "", ciudad: record.municipality || "", correo_dest: "", numero_acto: record.resolutionNumber || record.number || "", fecha_acto: record.resolutionDate || record.date || "", valor_multa: record.value != null ? String(record.value) : "", placa: record.plate || "", numero_comparendo: record.number || "", fecha_comparendo: record.date || "", autoridad: record.authority || "", valor: record.value != null ? String(record.value) : "", causal: legal.causal, hechos: legal.hechos, pretension: legal.pretension, anexos: "Estado de Cuenta SIMIT aportado por el solicitante.", fecha: new Date().toISOString().slice(0, 10), codigoInfraccion: record.infractionCode || "", descripcionInfraccion: record.description || "", estadoComparendo: record.status || "", departamento: record.department || "", numeroResolucion: record.resolutionNumber || "", fechaResolucion: record.resolutionDate || "", fechaNotificacion: record.notificationDate || "", fechaPago: record.paymentDate || "", __simitRecord: record } as unknown as FormAnswers;
}

function splitFullName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { nombres: value.trim(), apellidos: "" };
  if (parts.length === 2) return { nombres: parts[0], apellidos: parts[1] };
  return { nombres: parts.slice(0, -2).join(" "), apellidos: parts.slice(-2).join(" ") };
}

function readQuestionnaire(): Record<string, string> {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(TRAMI_ANSWERS_KEY) || "{}");
    return parsed?.answers && typeof parsed.answers === "object" ? parsed.answers : {};
  } catch { return {}; }
}

function buildAnswers(record: SimitRecord, documentNumber: string, q: Record<string, string>): FormAnswers {
  const base = fromSimit({ ...record, documentNumber });
  const name = splitFullName(q.nombresCompletos || "");
  // Identity is now collected inside Trámi. Normalize the cédula once and
  // mirror it to every legacy field used by the traffic document templates.
  const cedula = String(q.cedula || documentNumber || record.documentNumber || "").replace(/\D/g, "");
  const correo = q.correo || "";
  const telefono = q.telefono === "omitir" ? "" : (q.telefono || "");
  const direccion = q.direccion === "omitir" ? "" : (q.direccion || "");
  return {
    ...base,
    documentNumber: cedula,
    cedula,
    numeroDocumento: cedula,
    documento: cedula,
    nombres: name.nombres || base.nombres,
    apellidos: name.apellidos || base.apellidos,
    correo,
    correo_dest: correo,
    telefono,
    direccion,
    hechos: `${base.hechos}\n\nInformación suministrada directamente por el solicitante durante el cuestionario de Trámi:\n- Notificación del comparendo: ${q.notificacionComparendo || "No informado"}.\n- Notificación de la resolución: ${q.notificacionResolucion || "No informado"}.\n- Mandamiento de pago o cobro: ${q.mandamientoPago || "No informado"}.\n- Fecha de ejecutoria conocida: ${q.ejecutoria || "No informada"}.\n- Pago o acuerdo de pago: ${q.pagoAcuerdo || "No informado"}.`,
    causal: `${base.causal}\n\nTrámi analizará de manera autónoma la procedencia de caducidad, prescripción, pérdida de fuerza ejecutoria, notificación, debido proceso u otra vía jurídicamente pertinente, sin trasladar esa decisión al usuario.`,
    __tramiQuestionnaire: q,
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
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [tramiDone, setTramiDone] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SIMIT_SESSION_KEY);
      if (!saved) return;
      const state = JSON.parse(saved) as SimitSession;
      if (Array.isArray(state.records) && state.records.length) {
        setRecords(state.records); setDocumentNumber(String(state.documentNumber || "").replace(/\D/g, "")); setFileName(state.fileName || "Estado de Cuenta SIMIT");
        if (state.selectedRecord) { const index = state.records.findIndex((r) => String(r.number || "") === String(state.selectedRecord?.number || "")); if (index >= 0) setSelected(index); }
      }
    } catch {}
  }, []);

  useEffect(() => {
    const onComplete = (event: Event) => {
      const custom = event as CustomEvent<{ answers?: Record<string, string> }>;
      if (!selectedRecord || !custom.detail?.answers) return;
      void generateWithTrami(custom.detail.answers);
    };
    window.addEventListener("trami:questionnaire-complete", onComplete);
    return () => window.removeEventListener("trami:questionnaire-complete", onComplete);
  });

  if (!procedure || !definition || params.slug !== "derecho-de-peticion-eliminar-multa") return <main className="min-h-screen bg-slate-50"><Header /><section className="mx-auto max-w-4xl px-4 py-16"><h1 className="text-2xl font-bold">Trámite no disponible</h1></section><Footer /></main>;

  async function handleUpload(file?: File) {
    if (!file) return;
    setError(""); setUploading(true); setRecords([]); setSelected(null); setTramiDone(false); setFileName(file.name);
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/simit/upload", { method: "POST", body: form });
      const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.message || "No fue posible analizar el Estado de Cuenta.");
      const nextRecords = (data.records || []) as SimitRecord[];
      const doc = String(data.documentNumber || data.extraction?.documentNumber || data.data?.documentNumber || "").replace(/\D/g, "");
      const hydrated = nextRecords.map((record) => ({ ...record, ...(doc ? { documentNumber: doc } : {}) }));
      setDocumentNumber(doc); setRecords(hydrated);
      sessionStorage.setItem(SIMIT_SESSION_KEY, JSON.stringify({ records: hydrated, documentNumber: doc, fileName: file.name, selectedRecord: null } satisfies SimitSession));
      if (hydrated.length === 1) selectRecord(0, hydrated);
    } catch (e) { setError(e instanceof Error ? e.message : "No fue posible analizar el PDF."); }
    finally { setUploading(false); }
  }

  function selectRecord(index: number, source = records) {
    const record = source[index]; if (!record) return;
    setSelected(index); setTramiDone(false); setError("");
    try {
      sessionStorage.removeItem(TRAMI_ANSWERS_KEY);
      sessionStorage.setItem(SIMIT_SESSION_KEY, JSON.stringify({ records: source, documentNumber, fileName, selectedRecord: record } satisfies SimitSession));
    } catch {}
    window.dispatchEvent(new CustomEvent("trami:restart"));
  }

  async function generateWithTrami(questionnaire: Record<string, string>) {
    if (!selectedRecord || generating) return;
    setGenerating(true); setError("");
    try {
      const answers = buildAnswers(selectedRecord, effectiveDocumentNumber, questionnaire);
      const decisions = evaluateTrafficCase(answers);
      const enriched = { ...answers, __legalDecisionEngine: { version: 2, generatedAt: new Date().toISOString(), decisions }, __simitSource: { type: "official_statement_pdf", fileName, selectedRecord: selectedRecord.number }, __trami: { completedAt: new Date().toISOString(), questionnaire } } as unknown as FormAnswers;
      const supabase = getSupabaseBrowser();
      let instance: any = null;
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const r = await fetch("/api/instances", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ procedureId: procedure!.id, procedureSlug: procedure!.slug, answers: enriched }) });
          if (r.ok) instance = await r.json();
        }
      }
      if (!instance) instance = procedureStorage.create(procedure!.id, procedure!.slug, enriched);
      const response = await fetch("/api/documents/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ procedureSlug: procedure!.slug, answers: enriched, instanceId: instance.id }) });
      if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error || "No fue posible generar el documento."); }
      const document = await response.json();
      procedureStorage.update(instance.id, { answers: enriched, status: "document_ready", document, completedAt: new Date().toISOString() });
      localDraftStorage.save(`procedure:${procedure!.slug}`, { data: enriched, savedAt: new Date().toISOString() });
      setTramiDone(true);
      try { sessionStorage.setItem(TRAMI_ANSWERS_KEY, JSON.stringify({ version: 5, answers: questionnaire, complete: true, generated: true, updatedAt: new Date().toISOString() })); } catch {}
      window.location.href = `/tramites/${procedure!.slug}/resultado/${instance.id}`;
    } catch (e) { console.error(e); setError(e instanceof Error ? e.message : "No fue posible generar el documento."); }
    finally { setGenerating(false); }
  }

  const selectedRecord = selected != null ? records[selected] : undefined;
  const effectiveDocumentNumber = String(documentNumber || selectedRecord?.documentNumber || "").replace(/\D/g, "");

  return <main className="min-h-screen bg-slate-50 text-slate-900"><Header /><section className="mx-auto max-w-5xl px-4 py-8 md:py-12">
    <div className="mb-8"><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">⚡ TrámiteYa · Automatización jurídica</div><h1 className="text-3xl font-bold tracking-tight md:text-4xl">{definition.title}</h1><p className="mt-3 max-w-3xl text-slate-600">Sube tu Estado de Cuenta oficial de SIMIT. Después de seleccionar el comparendo, <strong>no tendrás que llenar más formularios</strong>: Trámi te hará las preguntas necesarias directamente en el chat y construirá el escrito contigo.</p></div>
    <SimitDownloadGuide />
    {!records.length && <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"><div className="mb-6 flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-600 text-xl text-white">PDF</div><div><h2 className="text-xl font-bold">1. Sube el Estado de Cuenta de SIMIT</h2><p className="mt-1 text-sm text-slate-500">PDF descargado directamente del portal oficial. No necesitas copiar ni transcribir datos.</p></div></div><label className="group flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-blue-400 hover:bg-blue-50"><input type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => handleUpload(e.target.files?.[0])} /><div className="mb-3 text-4xl">{uploading ? "⏳" : "📄"}</div><div className="text-lg font-semibold">{uploading ? "Analizando documento…" : "Seleccionar Estado de Cuenta PDF"}</div><div className="mt-2 text-sm text-slate-500">Máximo 10 MB · PDF oficial de SIMIT</div></label></div>}
    {records.length > 0 && <div className="space-y-6">
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-semibold text-emerald-700">✓ Documento analizado</div><div className="mt-1 font-bold text-emerald-950">{fileName}</div><div className="mt-1 text-sm text-emerald-800">{records.length} registro(s) detectado(s){effectiveDocumentNumber ? ` · CC ${effectiveDocumentNumber}` : ""}</div></div><button type="button" onClick={() => { setRecords([]); setSelected(null); setDocumentNumber(""); setFileName(""); try { sessionStorage.removeItem(SIMIT_SESSION_KEY); sessionStorage.removeItem(TRAMI_ANSWERS_KEY); } catch {} }} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">Cambiar PDF</button></div></div>
      {!effectiveDocumentNumber && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><label className="block text-sm font-semibold text-amber-950">Cédula del titular</label><p className="mt-1 text-sm text-amber-800">No fue posible leerla del PDF. La solicitamos una sola vez.</p><input value={documentNumber} onChange={e => setDocumentNumber(e.target.value.replace(/\D/g, ""))} className="mt-3 w-full rounded-xl border border-amber-300 bg-white p-3 outline-none focus:ring-2 focus:ring-amber-400" placeholder="Número de cédula" /></div>}
      {records.length > 1 && selected === null && <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">2. Elige el comparendo que vas a revisar</h2><p className="mt-1 text-sm text-slate-500">Selecciona solo el registro sobre el que quieres presentar la petición.</p><div className="mt-5 grid gap-3 md:grid-cols-2">{records.map((r, i) => <button key={`${r.number}-${i}`} type="button" onClick={() => selectRecord(i)} className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-blue-300 hover:bg-blue-50"><div className="flex items-center justify-between"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase">{r.kind || "comparendo"}</span><span className="text-lg">→</span></div><div className="mt-4 text-lg font-bold">{r.number || "Sin número"}</div><div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-600"><span>📅 {r.date || "Fecha no leída"}</span>{r.plate && <span>🚗 {r.plate}</span>}<span>🏛️ {r.authority || "Autoridad no leída"}</span><span>💰 {r.value != null ? `$${r.value.toLocaleString("es-CO")}` : "Valor no leído"}</span></div></button>)}</div></div>}
      {selectedRecord && <>
        <div className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white">✓</div><div><h2 className="font-bold">2. Comparendo seleccionado</h2><p className="text-sm text-slate-500">Trámi ya tiene el expediente base y continuará contigo en el chat.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Cédula", effectiveDocumentNumber], ["Comparendo", selectedRecord.number], ["Fecha", selectedRecord.date], ...(selectedRecord.plate ? [["Placa", selectedRecord.plate]] : []), ["Entidad", selectedRecord.authority]].map(([label,value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 font-semibold">{value || "No identificada"}</div></div>)}</div></div>
        <div className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50 p-7 shadow-sm"><div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-600 text-xl text-white">🤖</div><div><div className="text-sm font-black uppercase tracking-[0.14em] text-indigo-600">Trámi · Copiloto Legal</div><h2 className="mt-1 text-2xl font-black">Ahora él te hace las preguntas.</h2><p className="mt-2 max-w-2xl leading-7 text-slate-600">No busques campos ni redactes hechos. Responde en el chat y Trámi organizará tus respuestas, verificará qué vía tiene sentido —<strong>prescripción, caducidad o pérdida de ejecutoriedad</strong>— y preparará el documento.</p></div></div><div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-indigo-700"><span className="rounded-full bg-white px-3 py-2 shadow-sm">✓ Sin formularios</span><span className="rounded-full bg-white px-3 py-2 shadow-sm">✓ Preguntas una por una</span><span className="rounded-full bg-white px-3 py-2 shadow-sm">✓ Análisis jurídico guiado</span><span className="rounded-full bg-white px-3 py-2 shadow-sm">✓ Documento automático</span></div></div>
        {generating && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">Trámi terminó el cuestionario. Cruzando respuestas, cronología y reglas jurídicas y generando el documento…</div>}
        {tramiDone && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">✓ Documento preparado. Redirigiendo a la revisión final…</div>}
      </>}
    </div>}
    {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
  </section><Footer /></main>;
}
