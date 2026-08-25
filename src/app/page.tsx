import React from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { procedures } from '../data/procedures';

const features = [
  { n: '01', title: 'Cuéntanos qué necesitas', text: 'Un flujo guiado convierte tu situación en información jurídica útil, sin formularios interminables.' },
  { n: '02', title: 'TrámiteYa analiza', text: 'El motor identifica la información relevante y adapta el trámite a los datos que suministras.' },
  { n: '03', title: 'Revisa antes de presentar', text: 'Obtén un documento profesional, editable y listo para revisar antes de descargarlo.' },
];

export default function Home() {
  const available = procedures.filter((p) => p.available);
  const traffic = available.find((p) => p.slug.includes('multa') || p.slug.includes('comparendo'));

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-slate-950">
      <Header />

      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute -right-32 -top-40 h-[30rem] w-[30rem] rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-48 left-1/3 h-[25rem] w-[25rem] rounded-full bg-blue-400/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-5 py-20 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:py-28">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Automatización jurídica en Colombia
            </div>
            <h1 className="max-w-3xl text-5xl font-black leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-7xl">Tu trámite jurídico.<br /><span className="text-indigo-300">Más simple.</span></h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">TrámiteYa transforma información y situaciones concretas en documentos jurídicos estructurados mediante un flujo inteligente, guiado y pensado para Colombia.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/tramites" className="rounded-2xl bg-white px-6 py-3.5 text-center text-sm font-extrabold text-slate-950 shadow-xl shadow-black/20 transition hover:-translate-y-0.5">Iniciar un trámite →</Link>
              <Link href="/tramites" className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 text-center text-sm font-bold text-white transition hover:bg-white/10">Explorar soluciones</Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-400">
              <span>✓ Flujo guiado</span><span>✓ Revisión antes de descargar</span><span>✓ Word y PDF</span>
            </div>
          </div>

          <div className="relative lg:pt-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-3 shadow-2xl shadow-black/30 backdrop-blur">
              <div className="rounded-[1.5rem] bg-white p-6 text-slate-950 sm:p-7">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Nuevo trámite</p><h2 className="mt-1 text-xl font-black">¿Qué necesitas resolver?</h2></div>
                  <div className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">Paso 1 de 5</div>
                </div>
                <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-1/5 rounded-full bg-indigo-600" /></div>
                <div className="mt-7 space-y-3">
                  <Link href="/tramites" className="group flex items-center gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/50">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-lg">⚖</div>
                    <div className="min-w-0"><p className="font-bold">Quiero hacer un trámite</p><p className="mt-0.5 text-sm text-slate-500">Encuentra la ruta jurídica adecuada</p></div><span className="ml-auto text-slate-300 transition group-hover:translate-x-1 group-hover:text-indigo-600">→</span>
                  </Link>
                  {traffic && <Link href={`/tramites/${traffic.slug}`} className="group flex items-center gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/50">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-lg">🚗</div>
                    <div className="min-w-0"><p className="font-bold">Tengo una multa o comparendo</p><p className="mt-0.5 text-sm text-slate-500">Consulta y revisa tu caso de tránsito</p></div><span className="ml-auto text-slate-300 transition group-hover:translate-x-1 group-hover:text-indigo-600">→</span>
                  </Link>}
                </div>
                <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">Tus respuestas se utilizan para construir el flujo y el documento correspondiente. Siempre podrás revisar la información antes de finalizar.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-slate-200 px-5 sm:grid-cols-4 lg:px-8">
          {[['01', 'Flujos inteligentes'], ['02', 'Documentos profesionales'], ['03', 'Revisión antes de descargar'], ['04', 'Diseñado para Colombia']].map(([n, t]) => <div key={n} className="px-4 py-7 first:pl-0 sm:px-7"><p className="text-xs font-black tracking-[0.18em] text-indigo-600">{n}</p><p className="mt-1 text-sm font-bold text-slate-800">{t}</p></div>)}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
        <div className="max-w-2xl"><p className="text-sm font-black uppercase tracking-[0.16em] text-indigo-600">Así funciona</p><h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Menos burocracia.<br />Más claridad.</h2><p className="mt-5 text-lg leading-8 text-slate-500">No necesitas saber cómo redactar el documento. TrámiteYa organiza el proceso para que tú te concentres en aportar la información correcta.</p></div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">{features.map((f) => <article key={f.n} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"><div className="text-sm font-black text-indigo-600">{f.n}</div><h3 className="mt-12 text-xl font-black">{f.title}</h3><p className="mt-3 leading-7 text-slate-500">{f.text}</p></article>)}</div>
      </section>

      <section className="bg-white py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-black uppercase tracking-[0.16em] text-indigo-600">Soluciones</p><h2 className="mt-2 text-4xl font-black tracking-tight">Empieza por lo que necesitas.</h2></div><Link href="/tramites" className="text-sm font-bold text-indigo-600 hover:text-indigo-800">Ver todos los trámites →</Link></div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">{available.slice(0, 3).map((p, i) => <Link key={p.id} href={`/tramites/${p.slug}`} className="group rounded-3xl border border-slate-200 bg-[#f8f9fb] p-7 transition hover:-translate-y-1 hover:border-indigo-200 hover:bg-white hover:shadow-xl"><div className="flex items-center justify-between"><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 shadow-sm">{p.category}</span><span className="text-slate-300 transition group-hover:text-indigo-600">0{i + 1}</span></div><h3 className="mt-12 text-xl font-black leading-tight">{p.title}</h3><p className="mt-3 text-sm leading-6 text-slate-500">{p.description}</p><div className="mt-7 text-sm font-extrabold text-slate-950 group-hover:text-indigo-600">Iniciar trámite →</div></Link>)}</div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8"><div className="rounded-[2rem] bg-indigo-600 px-7 py-12 text-white sm:px-12 lg:flex lg:items-center lg:justify-between lg:py-14"><div><p className="text-sm font-bold uppercase tracking-[0.16em] text-indigo-200">TrámiteYa</p><h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">Empieza tu trámite sin enfrentarte solo a la burocracia.</h2></div><Link href="/tramites" className="mt-7 inline-block rounded-2xl bg-white px-6 py-3.5 text-sm font-extrabold text-indigo-700 lg:mt-0">Iniciar ahora →</Link></div></section>

      <section className="border-t border-slate-200 bg-[#f7f8fa] py-7"><div className="mx-auto max-w-7xl px-5 text-xs leading-5 text-slate-500 lg:px-8">TrámiteYa es una herramienta tecnológica de automatización documental. La generación de un documento no constituye por sí misma asesoría jurídica personalizada ni garantiza el resultado de un procedimiento. El usuario es responsable de verificar la información suministrada y cumplir los requisitos y términos aplicables.</div></section>
      <Footer />
    </main>
  );
}
