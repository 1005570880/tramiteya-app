"use client";

import React, { useState } from "react";
import { petitionForm } from "../../../../data/forms";
import StepForm from "../../../../components/StepForm";
import Header from "../../../../components/Header";
import Footer from "../../../../components/Footer";
import { generateDocument } from "../../../../lib/generateDocument";
import { useRouter } from "next/navigation";
import { localDraftStorage } from "../../../../lib/draftStorage";

export default function PetitionForm({ params }: { params: { slug: string } }) {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const router = useRouter();
  const draftKey = `petition:${params.slug}`;

  async function handleComplete(data: any) {
    setLoading(true);
    try {
      const doc = await generateDocument(params.slug, data);
      setResult(doc);
      // Optionally remove draft on completion
      localDraftStorage.remove(draftKey);
    } catch (e) {
      setResult("Error al generar el documento.");
    } finally {
      setLoading(false);
    }
  }

  function handleClearDraft() {
    localDraftStorage.remove(draftKey);
    setResetSignal((s) => s + 1);
  }

  if (result) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <Header />
        <section className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-white p-6 rounded-2xl shadow">
            <h2 className="text-xl font-bold">Información recopilada correctamente.</h2>
            <p className="text-sm text-slate-600 mt-2">Puedes revisar el resumen y descargar el documento cuando corresponda.</p>
            <pre className="mt-4 p-4 bg-slate-50 rounded">{result}</pre>

            <div className="mt-4 flex gap-3">
              <button onClick={() => router.push('/tramites')} className="px-4 py-2 rounded-md border">Volver al catálogo</button>
            </div>
          </div>
        </section>
        <Footer />
      </main>
    );
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
