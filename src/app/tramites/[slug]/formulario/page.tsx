"use client";

import React, { useState } from "react";
import { petitionForm } from "../../../../data/forms";
import StepForm from "../../../../components/StepForm";
import Header from "../../../../components/Header";
import Footer from "../../../../components/Footer";
import { generateDocument } from "../../../../lib/generateDocument";
import { useRouter } from "next/navigation";

export default function PetitionForm({ params }: { params: { slug: string } }) {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleComplete(data: any) {
    setLoading(true);
    try {
      const doc = await generateDocument(params.slug, data);
      setResult(doc);
    } catch (e) {
      setResult("Error al generar el documento.");
    } finally {
      setLoading(false);
    }
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
          <h2 className="text-xl font-bold mb-2">Formulario</h2>
          <p className="text-sm text-slate-500 mb-4">Complete los pasos para generar su documento.</p>

          <StepForm steps={petitionForm} onComplete={handleComplete} />

          {loading && <div className="mt-4 text-sm text-slate-500">Generando documento...</div>}
        </div>
      </section>
      <Footer />
    </main>
  );
}
