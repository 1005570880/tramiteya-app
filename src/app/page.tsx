import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { procedures } from '../data/procedures';
import ProcedureCard from '../components/ProcedureCard';
import Link from 'next/link';

const needs = [
  { icon: '🚗', title: 'Tengo un problema de tránsito', description: 'Comparendos, fotomultas, cobros y otros trámites de tránsito.', keywords: ['transito', 'comparendo'] },
  { icon: '🏥', title: 'Me negaron un servicio de salud', description: 'Medicamentos, procedimientos, tratamientos y servicios de salud.', keywords: ['salud', 'medicamento', 'tutela'] },
  { icon: '💳', title: 'Tengo un problema con mi reporte crediticio', description: 'Reportes, permanencia, corrección y actualización de información.', keywords: ['habeas', 'reporte', 'credito'] },
  { icon: '📄', title: 'Necesito un contrato', description: 'Encuentra el contrato que necesitas y complétalo paso a paso.', keywords: ['contrato'] },
  { icon: '⚖️', title: 'Necesito presentar una petición', description: 'Construye un derecho de petición adaptado a tu situación.', keywords: ['peticion'] },
  { icon: '🛡️', title: 'Necesito una tutela', description: 'Identifica el tipo de tutela y prepara la información necesaria.', keywords: ['tutela'] },
];

function findProcedure(keywords: string[]) {
  return procedures.find((p) => {
    const text = `${p.id} ${p.slug} ${p.title} ${p.category}`.toLowerCase();
    return keywords.some((keyword) => text.includes(keyword));
  });
}

export default function Home() {
  const featured = procedures.filter((p) => p.available).slice(0, 3);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Header />

      <section className="bg-white py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">TrámiteYa</p>
            <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-950">¿Qué necesitas resolver?</h1>
            <p className="mt-4 text-lg text-slate-600">Cuéntanos qué problema tienes. TrámiteYa te orienta hacia el trámite adecuado y te acompaña paso a paso.</p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {needs.map((need) => {
              const procedure = findProcedure(need.keywords);
              const href = procedure ? `/tramites/${procedure.slug}` : '/tramites';
              return (
                <Link
                  key={need.title}
                  href={href}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-2xl transition group-hover:bg-blue-50" aria-hidden="true">{need.icon}</span>
                    <span className="text-xl text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-500" aria-hidden="true">→</span>
                  </div>
                  <h2 className="mt-5 text-lg font-bold text-slate-900">{need.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{need.description}</p>
                  <div className="mt-5 text-sm font-semibold text-blue-600">Empezar →</div>
                </Link>
              );
            })}
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">No necesitas registrarte para comenzar.</p>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 py-10">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-slate-900">Así funciona</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-white p-5 border border-slate-200"><div className="font-semibold">1. Cuéntanos qué necesitas</div><div className="mt-1 text-sm text-slate-500">Elige la situación que más se parece a tu caso.</div></div>
            <div className="rounded-xl bg-white p-5 border border-slate-200"><div className="font-semibold">2. Responde lo esencial</div><div className="mt-1 text-sm text-slate-500">TrámiteYa adapta las preguntas al trámite.</div></div>
            <div className="rounded-xl bg-white p-5 border border-slate-200"><div className="font-semibold">3. Revisa y genera</div><div className="mt-1 text-sm text-slate-500">Analiza tu caso y genera tu documento cuando esté listo.</div></div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold">Trámites destacados</h2>
        <div className="mt-6 grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p) => <ProcedureCard key={p.id} procedure={p} />)}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-12">
        <h2 className="text-2xl font-bold">Preguntas frecuentes</h2>
        <div className="mt-4 grid gap-4">
          <details className="bg-white p-4 rounded-lg border"><summary className="font-semibold">¿TrámiteYa garantiza el resultado?</summary><div className="mt-2 text-sm text-slate-600">No. TrámiteYa facilita la elaboración del documento a partir de la información suministrada. La decisión de la autoridad competente no depende de la plataforma.</div></details>
          <details className="bg-white p-4 rounded-lg border"><summary className="font-semibold">¿Necesito crear una cuenta?</summary><div className="mt-2 text-sm text-slate-600">No necesitas registrarte para comenzar tu trámite.</div></details>
          <details className="bg-white p-4 rounded-lg border"><summary className="font-semibold">¿Puedo revisar el documento antes de descargarlo?</summary><div className="mt-2 text-sm text-slate-600">Sí. Puedes revisar tus respuestas y el resultado antes de generar el documento final.</div></details>
        </div>
      </section>

      <section className="border-t bg-slate-100 py-6">
        <div className="max-w-6xl mx-auto px-4 text-xs leading-5 text-slate-500">TrámiteYa es una herramienta tecnológica de automatización documental. La generación de un documento no constituye por sí misma asesoría jurídica personalizada ni garantiza el resultado de un procedimiento. El usuario es responsable de verificar la información suministrada y cumplir los requisitos aplicables.</div>
      </section>
      <Footer />
    </main>
  );
}
