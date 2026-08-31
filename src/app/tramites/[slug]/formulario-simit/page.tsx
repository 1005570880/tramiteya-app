"use client";

import React, { useEffect, useRef, useState } from "react";
import Header from "../../../../components/Header";
import Footer from "../../../../components/Footer";
import TramiWidget from "../../../../components/TramiWidget";
import { getDynamicFormDefinition } from "../../../../data/dynamicForms";
import { procedures } from "../../../../data/procedures";
import { evaluateTrafficCase } from "../../../../lib/legalRules";
import { procedureStorage } from "../../../../lib/procedureStorage";
import { localDraftStorage } from "../../../../lib/draftStorage";
import { getSupabaseBrowser } from "../../../../lib/supabaseBrowserClient";
import type { FormAnswers } from "../../../../types/form";

type SimitRecord = {
  kind?: string; number?: string; date?: string; authority?: string; department?: string;
  municipality?: string; plate?: string; ownerName?: string; documentNumber?: string;
  infractionCode?: string; description?: string; status?: string; value?: number;
  resolutionNumber?: string; resolutionDate?: string; notificationDate?: string; paymentDate?: string;
};

type SimitSession = {
  records: SimitRecord[];
  documentNumber: string;
  fileName: string;
  selectedRecord?: SimitRecord | null;
};

const SIMIT_SESSION_KEY = "tramiteya:simit-upload:v1";
const TRAMI_ANSWERS_KEY = "tramiteya:trami-questionnaire:v3";

function splitFullName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { nombres: value.trim(), apellidos: "" };
  if (parts.length === 2) return { nombres: parts[0], apellidos: parts[1] };
  return { nombres: parts.slice(0, -2).join(" "), apellidos: parts.slice(-2).join(" ") };
}

function buildAnswers(record: SimitRecord, documentNumber: string, q: Record<string, string>): FormAnswers {
  const cedula = String(q.cedula || documentNumber || record.documentNumber || "").replace(/\D/g, "");
  const fullName = String(q.nombre || q.nombresCompletos || record.ownerName || "").trim();
  const name = splitFullName(fullName);
  const correo = q.correo || "";
  const telefono = q.telefono || "";

  return {
    documentType: "CC",
    documentNumber: cedula,
    cedula,
    numeroDocumento: cedula,
    documento: cedula,
    nombres: name.nombres,
    apellidos: name.apellidos,
    nombre: fullName,
    nombreCompleto: fullName,
    correo,
    correo_dest: correo,
    telefono,
    direccion: q.direccion || "",
    entidad: record.authority || "",
    ciudad: record.municipality || "",
    numero_acto: record.resolutionNumber || record.number || "",
    fecha_acto: record.resolutionDate || record.date || "",
    valor_multa: record.value != null ? String(record.value) : "",
    placa: record.plate || "",
    numero_comparendo: record.number || "",
    fecha_comparendo: record.date || "",
    autoridad: record.authority || "",
    valor: record.value != null ? String(record.value) : "",
    codigoInfraccion: record.infractionCode || "",
    descripcionInfraccion: record.description || "",
    estadoComparendo: record.status || "",
    departamento: record.department || "",
    numeroResolucion: record.resolutionNumber || "",
    fechaResolucion: record.resolutionDate || "",
    fechaNotificacion: record.notificationDate || "",
    fechaPago: record.paymentDate || "",
    hechos: `Información suministrada durante la entrevista de Trámi:\n- Conocimiento inicial del comparendo: ${q.conocimiento || "No informado"}.\n- Comunicación oficial: ${q.notificacion || "No informado"}.\n- Citación a descargos: ${q.audiencia || "No informado"}.\n- Resolución sancionatoria: ${q.resolucion || "No informado"}.\n- Gestión de cobro: ${q.cobro || "No informado"}.\n- Pagos o acuerdos: ${q.pagos || "No informado"}.\n- Evidencia adicional: ${q.evidencia || "No informado"}.`,
    causal: "Trámi determinará autónomamente la vía jurídica aplicable a partir del expediente, la cronología y las respuestas del ciudadano. No se presume una causal que no esté acreditada.",
    pretension: "Solicitar la revisión integral del expediente y la aplicación de la consecuencia jurídica que corresponda según los hechos y pruebas acreditadas.",
    anexos: "Estado de Cuenta SIMIT aportado por el solicitante.",
    fecha: new Date().toISOString().slice(0, 10),
    __simitRecord: record,
    __tramiQuestionnaire: q,
  } as unknown as FormAnswers;
}

export default function SimitAutofillForm({ params }: { params: { slug: string } }) {
  const procedure = procedures.find((p) => p.slug === params.slug);
  const definition = getDynamicFormDefinition(params.slug);
  const [selectedRecord, setSelectedRecord] = useState<SimitRecord | null>(null);
  const [hydratingSelection, setHydratingSelection] = useState(true);
  const [documentNumber, setDocumentNumber] = useState("");
  const [fileName, setFileName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const generationStarted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    try {
      const saved = sessionStorage.getItem(SIMIT_SESSION_KEY);
      if (!saved) {
        if (!cancelled) setHydratingSelection(false);
        return;
      }
      const state = JSON.parse(saved) as SimitSession;
      const selected = state.selectedRecord || null;
      if (!cancelled) {
        setSelectedRecord(selected);
        setDocumentNumber(String(state.documentNumber || selected?.documentNumber || "").replace(/\D/g, ""));
        setFileName(state.fileName || "Estado de Cuenta SIMIT");
        setHydratingSelection(false);
      }
    } catch {
      if (!cancelled) {
        setError("No fue posible recuperar el comparendo seleccionado. Regresa al Estado de Cuenta y selecciónalo nuevamente.");
        setHydratingSelection(false);
      }
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const tryGenerate = (questionnaire?: Record<string, string>) => {
      if (!questionnaire || generationStarted.current || !selectedRecord) return;
      const complete = Boolean(questionnaire.nombre && questionnaire.correo && questionnaire.telefono);
      if (!complete) return;
      generationStarted.current = true;
      void generateWithTrami(questionnaire);
    };

    const onComplete = (event: Event) => {
      const custom = event as CustomEvent<{ answers?: Record<string, string> }>;
      tryGenerate(custom.detail?.answers);
    };

    window.addEventListener("trami:questionnaire-complete", onComplete);

    const recoverCompletion = () => {
      try {
        const raw = sessionStorage.getItem(TRAMI_ANSWERS_KEY);
        if (!raw) return;
        const state = JSON.parse(raw) as { answers?: Record<string, string>; complete?: boolean };
        if (state.complete && state.answers) tryGenerate(state.answers);
      } catch {
        // El estado corrupto no debe bloquear el flujo principal.
      }
    };

    recoverCompletion();
    const timer = window.setInterval(recoverCompletion, 400);

    return () => {
      window.removeEventListener("trami:questionnaire-complete", onComplete);
      window.clearInterval(timer);
    };
  }, [selectedRecord, documentNumber, fileName]);

  async function generateWithTrami(questionnaire: Record<string, string>) {
    if (!selectedRecord || !procedure) return;
    setGenerating(true);
    setError("");
    try {
      const answers = buildAnswers(selectedRecord, documentNumber, questionnaire);
      const decisions = evaluateTrafficCase(answers);
      const enriched = {
        ...answers,
        __legalDecisionEngine: { version: 2, generatedAt: new Date().toISOString(), decisions },
        __simitSource: { type: "official_statement_pdf", fileName, selectedRecord: selectedRecord.number },
        __trami: { completedAt: new Date().toISOString(), questionnaire },
      } as unknown as FormAnswers;

      // Guest checkout must still have a real server-side instance. The old
      // flow only created it for authenticated users and then generated a
      // document referencing a client/local id, which could not satisfy the
      // Supabase foreign key on `documents.instance_id`.
      const supabase = getSupabaseBrowser();
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const instanceHeaders: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) instanceHeaders.Authorization = `Bearer ${session.access_token}`;

      const instanceResponse = await fetch("/api/instances", {
        method: "POST",
        headers: instanceHeaders,
        body: JSON.stringify({ procedureId: procedure.id, procedureSlug: procedure.slug, answers: enriched }),
      });

      if (!instanceResponse.ok) {
        const payload = await instanceResponse.json().catch(() => ({}));
        throw new Error(payload.error || "No fue posible crear el expediente del trámite.");
      }

      const instance = await instanceResponse.json();

      const response = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ procedureSlug: procedure.slug, answers: enriched, instanceId: instance.id }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "No fue posible generar el documento.");
      }

      const document = await response.json();
      procedureStorage.update(instance.id, { answers: enriched, status: "document_ready", document, completedAt: new Date().toISOString() });
      localDraftStorage.save(`procedure:${procedure.slug}`, { data: enriched, savedAt: new Date().toISOString() });
      sessionStorage.setItem(TRAMI_ANSWERS_KEY, JSON.stringify({ version: 5, answers: questionnaire, complete: true, generated: true, updatedAt: new Date().toISOString() }));
      window.location.href = `/tramites/${procedure.slug}/resultado/${instance.id}`;
    } catch (e) {
      console.error(e);
      generationStarted.current = false;
      setError(e instanceof Error ? e.message : "No fue posible generar el documento.");
    } finally {
      setGenerating(false);
    }
  }

  if (!procedure || !definition || params.slug !== "derecho-de-peticion-eliminar-multa") {
    return <main className="min-h-screen bg-slate-50"><Header /><section className="mx-auto max-w-4xl px-4 py-16"><h1 className="text-2xl font-bold">Trámite no disponible</h1></section><Footer /></main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      {hydratingSelection ? (
        <section className="mx-auto min-h-[calc(100vh-140px)] max-w-6xl px-4 py-6 md:px-6 md:py-8">
          <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
            <div className="animate-pulse space-y-3">
              <div className="h-3 w-40 rounded bg-slate-200" />
              <div className="h-5 w-72 rounded bg-slate-200" />
              <div className="h-4 w-full rounded bg-slate-100" />
            </div>
          </div>
        </section>
      ) : selectedRecord ? (
        <section className="mx-auto min-h-[calc(100vh-140px)] max-w-6xl px-4 py-6 md:px-6 md:py-8">
          <div className="mb-4 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-500">Expediente recuperado</div>
            <div className="mt-2 grid gap-2 text-sm sm:grid-cols-4">
              <span><b>Comparendo:</b> {selectedRecord.number || "—"}</span>
              <span><b>Fecha:</b> {selectedRecord.date || "—"}</span>
              <span><b>Cédula:</b> {documentNumber || "—"}</span>
              <span><b>Valor:</b> {selectedRecord.value != null ? `$${new Intl.NumberFormat("es-CO").format(selectedRecord.value)}` : "—"}</span>
            </div>
          </div>
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {generating && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Trámi está creando el expediente y redactando tu documento…</div>}
          <TramiWidget />
        </section>
      ) : (
        <section className="mx-auto max-w-2xl px-4 py-16">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
            <h1 className="text-xl font-bold text-amber-900">No hay un comparendo seleccionado</h1>
            <p className="mt-2 text-sm text-amber-800">El Estado de Cuenta ya no se vuelve a pedir aquí. Regresa al paso anterior, selecciona el comparendo y Trámi continuará directamente con la entrevista.</p>
          </div>
        </section>
      )}
      <Footer />
    </main>
  );
}
