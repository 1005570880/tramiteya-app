import React from "react";
import { procedures } from "../../data/procedures";
import ProcedureCard from "../../components/ProcedureCard";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

export default function ProceduresPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Header />

      <section className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-extrabold mb-6">Catálogo de trámites</h1>

        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {procedures.map((p) => (
            <ProcedureCard key={p.id} procedure={p} />
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
