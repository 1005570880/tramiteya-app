"use client";

import React, { useMemo, useState } from "react";
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

type SimitRecord = {
  number?: string; date?: string; authority?: string; department?: string;
  plate?: string; ownerName?: string; documentNumber?: string; infractionCode?: string;
  description?: string; status?: string; value?: number; resolutionNumber?: string;
  resolutionDate?: string; notificationDate?: string; paymentDate?: string;
  organismId?: string; photoDetection?: boolean;
};

function fromSimit(record: SimitRecord): FormAnswers {
  const doc = String(record.documentNumber || "").replace(/\D/g, "");
  const fullName = String(record.ownerName || "").trim();
  return {
    documentType: "CC",
    documentNumber: doc,
    cedula: doc,
    numeroDocumento: doc,
    documento: doc,
    nombres: fullName,
    apellidos: "",
    correo: "",
    telefono: "",
    direccion: "",
    entidad: record.authority || "",
    ciudad: "",
    correo_dest: "",
    numero_acto: record.resolutionNumber || record.number || "",
    fecha_acto: record.resolutionDate || record.date || "",
    valor_multa: record.value != null ? String(record.value) : "",
    placa: record.plate || "",
    numero_comparendo: record.number || "",
    fecha_comparendo: record.date || "",
    autoridad: record.authority || "",
    valor: record.value != null ? String(record.value) : "",
    causal: "",
    hechos: "",
    pretension: "",
    anexos: "Estado de Cuenta SIMIT aportado por el solicitante.",
    fecha: new Date().toISOString().slice(0, 10),
    codigoInfraccion: record.infractionCode || "",
    descripcionInfraccion: record.description || "",
    estadoComparendo: record.status || "",
    departamento: record.department || "",
    numeroResolucion: record.resolutionNumber || "",
    fechaResolucion: record.resolutionDate || "",
    fechaNotificacion: record.notificationDate || "",
    fechaPago: record.paymentDate || "",
    idOrganismoTransito: record.organismId || "",
    fotodeteccion: Boolean(record.photoDetection),
    __simitRecord: record,
  } as unknown as FormAnswers;
}

export default function SimitAutofillForm({ params }: { params: { slug: string } }) {
  const procedure = procedures.find((p) => p.slug === params.slug);
  const definition = getDynamicFormDefinition(params.slug);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const initialAnswers = useMemo<FormAnswers | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    try {
      const raw = localStorage.getItem(`tramiteya:simit:${params.slug}`);
      if (!raw) return undefined;
      const saved = JSON.parse(raw);
      const record = saved?.record as SimitRecord | undefined;
      if (!record) return undefined;
      return fromSimit(record);
    } catch { return undefined; }
  }, [params.slug]);

  if (!procedure || !definition || params.slug !== "derecho-de-peticion-eliminar-multa") {
    return <main className="min-h-screen bg-slate-50"><Header /><section className="max-w-4xl mx-auto px-4 py-16"><h1 className="text-2xl font-bold">Trámite no disponible</h1></section><Footer /></main>;
  }

  async function complete(answers: FormAnswers) {
    const issues = validateProcedureAnswers(procedure, answers);
    if (issues.length) { setError(`Faltan ${issues.length} campo(s) obligatorio(s).`); return; }
    setError(""); setLoading(true);
    try {
      const decisions = evaluateTrafficCase(answers);
      const enriched = { ...answers, __legalDecisionEngine: { version: 1, generatedAt: new Date().toISOString(), decisions } } as unknown as FormAnswers;
      const supabase = getSupabaseBrowser();
      let instance: any = null;
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const r = await fetch("/api/instances", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ procedureId: procedure.id, procedureSlug: procedure.slug, answers: enriched }) });
          if (r.ok) instance = await r.json();
        }
      }
      if (!instance) instance = procedureStorage.create(procedure.id, procedure.slug, enriched);
      const r = await fetch("/api/documents/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ procedureSlug: procedure.slug, answers: enriched, instanceId: instance.id }) });
      if (!r.ok) throw new Error("No fue posible generar el documento.");
      const document = await r.json();
      procedureStorage.update(instance.id, { answers: enriched, status: "document_ready", document, completedAt: new Date().toISOString() });
      localDraftStorage.save(`procedure:${procedure.slug}`, { data: enriched, savedAt: new Date().toISOString() });
      window.location.href = `/tramites/${procedure.slug}/resultado/${instance.id}`;
    } catch (e) {
      console.error(e); setError(e instanceof Error ? e.message : "No fue posible generar el documento.");
    } finally { setLoading(false); }
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900"><Header /><section className="max-w-4xl mx-auto px-4 py-12"><div className="bg-white p-6 md:p-8 rounded-2xl shadow">
    <div className="mb-6"><p className="text-sm font-medium text-blue-600">{procedure.category}</p><h1 className="text-2xl md:text-3xl font-bold mt-1">{definition.title}</h1><p className="text-slate-500 mt-2">El Estado de Cuenta SIMIT es la fuente de información aportada por el usuario. TrámiteYa completa automáticamente los datos que puede identificar y deja para el usuario únicamente la información que no aparece en el documento.</p></div>
    {initialAnswers && <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><strong>✓ Estado de Cuenta procesado.</strong> Los datos identificados quedaron precargados. Revísalos y completa únicamente lo que falte.</div>}
    {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {loading && <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">Generando tu documento jurídico automáticamente…</div>}
    <StepForm steps={definition.steps} initialAnswers={initialAnswers} draftKey={`procedure:${procedure.slug}`} onComplete={complete} />
  </div></section><Footer /></main>;
}
