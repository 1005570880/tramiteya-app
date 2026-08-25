import React from 'react';
import Link from 'next/link';
import { procedures } from '../../data/procedures';
import { getProcedureLines } from '../../data/procedureCatalog';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export default function ProceduresPage() {
  const lines = getProcedureLines(procedures);
  const available = procedures.filter((p) => p.available);

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-slate-950">
      <Header />
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-indigo-600">Iniciar trámite</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.03em] sm:text-5xl">¿Qué necesitas resolver?</h1>
            <p className="mt-5 text-lg leading-8 text-slate-500">Selecciona una solución. TrámiteYa te llevará paso a paso y cargará el flujo correspondiente.</p>
          </div>
          <div className="mt-8 flex flex-wrap gap-2 text-xs font-bold text-slate-500"><span className="rounded-full bg-slate-100 px-3 py-1.5">{available.length} soluciones disponibles</span><span className="rounded-full bg-slate-100 px-3 py-1.5">Flujo guiado</span><span className="rounded-full bg-slate-100 px-3 py-1.5">Revisión antes de descargar</span></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
        <div className="space-y-14">
          {lines.map((line) => (
            <section key={line.id}>
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div><h2 className="text-2xl font-black tracking-tight">{line.title}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{line.description}</p></div>
              </div>
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {line.procedures.map((procedure, index) => (
                  <Link key={`${line.id}-${procedure.id}`} href={`/tramites/${procedure.slug}`} className="group flex min-h-[260px] flex-col rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl">
                    <div className="flex items-center justify-between"><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{procedure.estimatedTime}</span><span className="text-xs font-black text-slate-300">0{index + 1}</span></div>
                    <div className="mt-9 flex-1"><h3 className="text-xl font-black leading-tight tracking-tight">{procedure.title}</h3><p className="mt-3 text-sm leading-6 text-slate-500">{procedure.description}</p></div>
                    <div className="mt-7 flex items-center justify-between border-t border-slate-100 pt-5 text-sm font-extrabold"><span>Comenzar</span><span className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-indigo-600">→</span></div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
      <Footer />
    </main>
  );
}
