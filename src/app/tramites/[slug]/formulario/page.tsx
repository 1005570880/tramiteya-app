"use client";

import React, { useState } from "react";
import StepForm from "../../../../components/StepForm";
import Header from "../../../../components/Header";
import Footer from "../../../../components/Footer";
import { generateDocument } from "../../../../lib/generateDocument";
import { useRouter } from "next/navigation";
import { localDraftStorage } from "../../../../lib/draftStorage";
import { procedureStorage } from "../../../../lib/procedureStorage";
import type { FormAnswers } from "../../../../types/form";
import { procedures } from "../../../../data/procedures";
import { getFormDefinition } from "../../../../data/forms";

export default function ProcedureForm({ params }: { params: { slug: string } }) {
  const [loading, setLoading] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const router = useRouter();
  const definition = getFormDefinition(params.slug);
  const procedure = procedures.find((p) => p.slug === params.slug);
  const draftKey = `procedure:${params.slug}`;

  if (!definition || !procedure) {
    return <main className="min-h-screen bg-slate-50"><Header /><section className="max-w-4xl mx-auto px-4 py-16"><h1 className="text-2xl font-bold">Trámite no disponible</h1><p className="mt-2 text-slate-600">Aún no existe un formulario configurado para este trámite.</p></section><Footer /></main>;
  }

  function ensureInstance(answers: FormAnswers) {
    const saved = localDraftStorage.load(draftKey) as { data?: FormAnswers & { __instanceId?: string } } | null;
    const id = saved?.data?.__instanceId;
    if (id) { const existing = procedureStorage.get(id); if (existing) return existing; }
    const created = procedureStorage.create(procedure.id, procedure.slug, answers);
    localDraftStorage.save(draftKey, { ...(saved?.data || {}), __instanceId: created.id });
    return created;
  }

  async function handleComplete(answers: FormAnswers) {
    setLoading(true);
    try {
      const instance = ensureInstance(answers);
      const document = await generateDocument({ procedure, answers });
      procedureStorage.update(instance.id, { answers, status: "document_ready", document, completedAt: new Date().toISOString() });
      localDraftStorage.remove(draftKey);
      router.push(`/tramites/${params.slug}/resultado/${instance.id}`);
    } catch (error) {
      console.error(error);
      alert("No fue posible generar el documento. Inténtalo nuevamente.");
    } finally { setLoading(false); }
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900 font-sans"><Header /><section className="max-w-4xl mx-auto px-4 py-12"><div className="bg-white p-6 md:p-8 rounded-2xl shadow"><div className="mb-6"><p className="text-sm font-medium text-blue-600">{procedure.category}</p><h1 className="text-2xl md:text-3xl font-bold mt-1">{definition.title}</h1><p className="text-slate-500 mt-2">Completa los datos y TrámiteYa preparará tu documento.</p></div><div className="flex justify-end mb-4"><button onClick={() => { localDraftStorage.remove(draftKey); setResetSignal((s) => s + 1); }} className="px-3 py-1 rounded-md border text-sm">Borrar borrador</button></div><StepForm steps={definition.steps} onComplete={handleComplete} draftKey={draftKey} resetSignal={resetSignal} />{loading && <div className="mt-4 text-sm text-slate-500">Generando documento...</div>}</div></section><Footer /></main>;
}
