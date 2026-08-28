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
const TRAMI_ANSWERS_KEY = "tramiteya:trami-questionnaire:v2";

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
    const parsed = JSON.parse(sessionStorage.getItem(TRAMI_ANSWERS_KEY) || sessionStorage.getItem("tramiteya:trami-questionnaire:v1") || "{}");
    return parsed?.answers && typeof parsed.answers === "object" ? parsed.answers : {};
  } catch { return {}; }
}

function buildAnswers(record: SimitRecord, documentNumber: string, q: Record<string, string>): FormAnswers {
  const base = fromSimit({ ...record, documentNumber });
  const fullName = String(q.nombre || q.nombresCompletos || "").trim();
  const name = splitFullName(fullName);
  const cedula = String(q.cedula || documentNumber || record.documentNumber || "").replace(/\D/g, "");
  const correo = q.correo || "";
  const telefono = q.telefono === "omitir" ? "" : (q.telefono || "");
  return {
    ...base,
    documentNumber: cedula, cedula, numeroDocumento: cedula, documento: cedula,
    nombres: name.nombres || base.nombres, apellidos: name.apellidos || base.apellidos,
    nombre: fullName || `${name.nombres} ${name.apellidos}`.trim(), nombreCompleto: fullName,
    correo, correo_dest: correo, telefono,
    hechos: `${base.hechos}\n\nInformación suministrada directamente por el solicitante durante la entrevista de Trámi:\n- Notificación dentro de los 5 días siguientes al hecho: ${q.notificacion || q.notificacionComparendo || "No informado"}.\n- Notificación de resolución: ${q.decision || q.notificacionResolucion || "No informado"}.\n- Cobro coactivo, embargo o mandamiento de pago: ${q.cobro || q.mandamientoPago || "No informado"}.`,
    causal: `${base.causal}\n\nTrámi analiza de manera autónoma la procedencia de caducidad, prescripción, pérdida de fuerza ejecutoria, notificación, debido proceso u otra vía jurídicamente pertinente, sin trasladar esa decisión al usuario.`,
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
      sessionStorage.removeItem("tramiteya:trami-questionnaire:v1");
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
    <div className="mb-8"><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">⚡ TrámiteYa · Automatización jurídica</div><h1 className="text-3xl font-bold tracking-tight md:text-4xl">{definition.title}</h1><p className="mt-3 max-w-3xl text-slate-600">Sube tu Estado de Cuenta SIMIT, selecciona el comparendo y deja que Trámi conduzca el resto del trámite.</p></div>
    <SimitDownloadGuide />
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-indigo-400"><span className="text-3xl">📄</span><span className="mt-2 font-bold">{uploading ? "Analizando Estado de Cuenta…" : "Sube el Estado de Cuenta oficial de SIMIT"}</span><span className="mt-1 text-sm text-slate-500">La guía es opcional. Trámi usará el expediente detectado.</span><input type="file" accept="application/pdf,.pdf" className="hidden" disabled={uploading} onChange={(e) => void handleUpload(e.target.files?.[0])} /></label>{error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}</div>
    {records.length > 0 && <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-bold">Selecciona el comparendo objeto de la petición</h2><div className="mt-4 space-y-2">{records.map((record, i) => <button key={`${record.number}-${i}`} onClick={() => selectRecord(i)} className={`w-full rounded-xl border p-4 text-left ${selected === i ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white"}`}><div className="font-bold">{record.number || "Registro sin número"}</div><div className="text-sm text-slate-600">{record.date || "Fecha no identificada"} · {record.authority || "Autoridad no identificada"} · {record.municipality || "Municipio no identificado"}</div></button>)}</div></div>}
    {selectedRecord && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6"><div className="font-black text-emerald-800">✓ Comparendo seleccionado</div><p className="mt-1 text-sm text-emerald-900">Trámi ya está guiando el expediente. **No necesitas diligenciar formularios adicionales.**</p>{generating && <p className="mt-2 text-sm font-semibold text-emerald-800">Trámi está redactando tu documento…</p>}{tramiDone && <p className="mt-2 text-sm font-semibold text-emerald-800">Documento generado. Redirigiendo…</p>}</div>}
  </section><Footer /></main>;
}
