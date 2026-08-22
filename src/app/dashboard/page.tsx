import React from "react";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { procedures } from "../../data/procedures";
import ProcedureCard from "../../components/ProcedureCard";

export default function Dashboard() {
  const recent = procedures.slice(0, 3);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Header />

      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold">Bienvenido de nuevo</h1>
            <p className="text-sm text-slate-500 mt-1">Aquí verás tus trámites y actividad reciente.</p>
          </div>
          <div>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-md">Nuevo trámite</button>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {recent.map((p) => (
            <ProcedureCard key={p.id} procedure={p} />
          ))}
        </div>

        <div className="mt-8 bg-white p-6 rounded-lg border">
          <h3 className="font-semibold">Actividad reciente</h3>
          <ul className="mt-4 text-sm text-slate-600">
            <li>No hay actividad real — datos de ejemplo.</li>
          </ul>
        </div>
      </section>

      <Footer />
    </main>
  );
}
