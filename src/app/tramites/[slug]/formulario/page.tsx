"use client";

import React, { useState } from "react";
import { petitionForm } from "../../../../data/forms";
import StepForm from "../../../../components/StepForm";
import Header from "../../../../components/Header";
import Footer from "../../../../components/Footer";
import { generateDocument } from "../../../../lib/generateDocument";
import { useRouter } from "next/navigation";
import { localDraftStorage } from "../../../../lib/draftStorage";
import { procedureStorage } from "../../../../lib/procedureStorage";
import type { FormAnswers } from "../../../../types/form";
import { procedures } from "../../../../data/procedures";

export default function PetitionForm({ params }: { params: { slug: string } }) {
  const [resultId, setResultId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const router = useRouter();
  const draftKey = `petition:${params.slug}`;

  function ensureInstance(existingDraft: any, answers: FormAnswers) {
    // If draft contains __instanceId, use it
    const instId = existingDraft?.data?.__instanceId as string | undefined;
    if (instId) {
      const inst = procedureStorage.get(instId);
      if (inst) return inst;
    }
    // create new instance
    const proc = procedures.find((p) => p.slug === params.slug);
    const created = procedureStorage.create(proc?.id || params.slug, params.slug, answers as any);
    // attach instance id to draft
    const saved = localDraftStorage.load(draftKey) as any;
    const payload = saved?.data || {};
    payload.__instanceId = created.id;
    localDraftStorage.save(draftKey, payload);
    return created;
  }

  async function handleComplete(data: FormAnswers) {
    setLoading(true);
    try {
      const existingDraft = localDraftStorage.load(draftKey) as any;
      const inst = ensureInstance(existingDraft, data);
      const proc = procedures.find((p) => p.slug === params.slug);
      if (!proc) throw new Error('Procedure not found');
      const doc = await generateDocument({ procedure: proc, answers: data });
      // update instance with answers and document
      procedureStorage.update(inst.id, { answers: data, status: 'document_ready', document: doc, completedAt: new Date().toISOString() });
      // remove draft but keep instance
      localDraftStorage.remove(draftKey);
      setResultId(inst.id);
      // navigate to result page
      router.push(`/tramites/${params.slug}/resultado/${inst.id}`);
    } catch (e) {
      console.error(e);
      // show error state — kept simple here
      alert('Error al generar el documento');
    } finally {
      setLoading(false);
    }
  }

  function handleClearDraft() {
    localDraftStorage.remove(draftKey);
    setResetSignal((s) => s + 1);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Header />
      <section className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white p-6 rounded-2xl shadow">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Formulario</h2>
              <p className="text-sm text-slate-500">Complete los pasos para generar su documento.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleClearDraft} className="px-3 py-1 rounded-md border text-sm">Borrar borrador</button>
            </div>
          </div>

          <StepForm steps={petitionForm} onComplete={handleComplete} draftKey={draftKey} resetSignal={resetSignal} />

          {loading && <div className="mt-4 text-sm text-slate-500">Generando documento...</div>}
        </div>
      </section>
      <Footer />
    </main>
  );
}
