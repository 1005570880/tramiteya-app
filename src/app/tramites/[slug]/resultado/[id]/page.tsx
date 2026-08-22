"use client";

import React, { useEffect, useState } from "react";
import { procedureStorage } from "../../../../lib/procedureStorage";
import type { ProcedureInstance } from "../../../../types/procedure";
import { useRouter } from "next/navigation";
import Header from "../../../../components/Header";
import Footer from "../../../../components/Footer";
import Link from "next/link";

export default function ResultPage({ params }: { params: { slug: string; id: string } }) {
  const [instance, setInstance] = useState<ProcedureInstance | null>(null);
  const router = useRouter();

  useEffect(() => {
    const inst = procedureStorage.get(params.id);
    if (inst) setInstance(inst);
  }, [params.id]);

  if (!instance) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <Header />
        <section className="max-w-4xl mx-auto px-4 py-12">Trámite no encontrado.</section>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Header />
      <section className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-xl font-bold">Tu documento está listo</h2>
          <div className="mt-4">
            <div className="font-semibold">{instance.document?.title}</div>
            <div className="text-sm text-slate-500">{instance.procedureSlug} • {new Date(instance.completedAt || instance.updatedAt).toLocaleString()}</div>
          </div>

          <div className="mt-4 bg-slate-50 p-4 rounded">{instance.document?.content}</div>

          <div className="mt-4 flex gap-3">
            <button onClick={() => alert('Ver documento (vista previa)')} className="px-4 py-2 rounded-md border">Ver documento</button>
            <button onClick={() => router.push('/dashboard')} className="px-4 py-2 rounded-md bg-blue-600 text-white">Volver a mis trámites</button>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
