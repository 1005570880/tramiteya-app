import React from "react";
import { procedures } from "../../data/procedures";
import { getProcedureLines } from "../../data/procedureCatalog";
import ProcedureCard from "../../components/ProcedureCard";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

export default function ProceduresPage() {
  const lines = getProcedureLines(procedures);
  return <main className="min-h-screen bg-slate-50 text-slate-900 font-sans"><Header /><section className="max-w-6xl mx-auto px-4 py-12"><div className="mb-8"><p className="text-sm font-semibold text-blue-600">TRÁMITEYA</p><h1 className="text-3xl font-extrabold mt-1">¿Qué necesitas resolver?</h1><p className="text-slate-500 mt-2">Elige una línea jurídica y luego el trámite. El motor cargará automáticamente el formulario correspondiente.</p></div><div className="space-y-10">{lines.map((line) => <section key={line.id}><div className="mb-4"><h2 className="text-xl font-bold">{line.title}</h2><p className="text-sm text-slate-500 mt-1">{line.description}</p></div><div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">{line.procedures.map((procedure) => <ProcedureCard key={`${line.id}-${procedure.id}`} procedure={procedure} />)}</div></section>)}</div></section><Footer /></main>;
}
