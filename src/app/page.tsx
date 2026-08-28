import React from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import TestimonialsSlider from '../components/TestimonialsSlider';
import TrustBadges from '../components/TrustBadges';
import ComparisonTable from '../components/ComparisonTable';
import DocumentBlurPreview from '../components/DocumentBlurPreview';
import { procedures } from '../data/procedures';

function Icon({ type }: { type: 'id' | 'ai' | 'doc' }) {
  if (type === 'id') return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8" cy="11" r="2" /><path d="M13 10h5M13 14h4" /></svg>;
  if (type === 'ai') return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M5.6 18.4l2.1-2.1M18.4 18.4l-2.1-2.1M21 12h-3M18.4 5.6l-2.1 2.1M12 18v3" /><path d="M9 14.5c-1.2-.9-2-2.3-2-3.9a5 5 0 0 1 10 0c0 1.6-.8 3-2 3.9-.7.5-1 1.1-1 1.9h-4c0-.8-.3-1.4-1-1.9Z" /><path d="M9.5 20h5" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13l2 2 4-4" /></svg>;
}

const steps = [
  { n: '01', icon: 'id' as const, title: 'Digita tu cédula o sube tu estado de cuenta SIMIT', text: 'Partimos de la información disponible para evitar formularios innecesarios.' },
  { n: '02', icon: 'ai' as const, title: 'El motor evalúa tu caso', text: 'Analiza prescripción, caducidad, indebida notificación y otros factores jurídicos relevantes.' },
  { n: '03', icon: 'doc' as const, title: 'Revisa y descarga tu documento', text: 'Obtén una vista previa y descarga el escrito en Word y PDF cuando decidas continuar.' },
];

export default function Home() {
  const available = procedures.filter((p) => p.available);
  const traffic = available.find((p) => p.slug.includes('multa') || p.slug.includes('comparendo'));
  const trafficHref = traffic ? `/tramites/${traffic.slug}` : '/tramites';

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-slate-950">
      <Header />

      {/* Social proof moved immediately below the header so trust is established before the user reaches the main conversion flow. */}
      <TestimonialsSlider />

      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute -right-40 -top-48 h-[34rem] w-[34rem] rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="absolute -bottom-56 left-1/4 h-[28rem] w-[28rem] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_.92fr]">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Automatización jurídica para Colombia</div>
              <h1 className="max-w-4xl text-4xl font-black leading-[1.03] tracking-[-0.045em] sm:text-5xl lg:text-6xl">Elimina tus multas de tránsito sin pagarle cientos de miles a un tramitador.</h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">Analizamos tu caso en SIMIT, aplicamos la ley colombiana y redactamos tu escrito legal listo en 2 minutos.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href={trafficHref} className="rounded-2xl bg-white px-6 py-4 text-center text-sm font-black text-slate-950 shadow-2xl shadow-black/30 transition hover:-translate-y-0.5">Analizar mi comparendo gratis →</Link>
                <Link href="/tramites" className="rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-center text-sm font-bold text-white transition hover:bg-white/10">Ver otros trámites</Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 text-sm font-semibold text-slate-400"><span>✓ Sin formularios interminables</span><span>✓ Vista previa</span><span>✓ Word + PDF</span></div>
            </div>

            <div className="relative">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-3 shadow-2xl shadow-black/40 backdrop-blur">
                <div className="rounded-[1.5rem] bg-white p-6 text-slate-950 sm:p-7">
                  <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">Diagnóstico inicial</p><h2 className="mt-2 text-2xl font-black">¿Tienes un comparendo?</h2></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700">GRATIS</span></div>
                  <div className="mt-6 space-y-3">
                    <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-bold text-slate-400">PASO 1</p><p className="mt-1 font-extrabold">Sube tu Estado de Cuenta SIMIT</p><p className="mt-1 text-xs leading-5 text-slate-500">También puedes digitar tu cédula.</p></div>
                    <div className="rounded-2xl bg-indigo-50 p-4"><p className="text-xs font-bold text-indigo-500">ANÁLISIS</p><p className="mt-1 font-extrabold text-indigo-950">TrámiteYa encuentra la vía jurídica</p><p className="mt-1 text-xs leading-5 text-indigo-900/70">Prescripción · caducidad · notificación · cobro</p></div>
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4"><div><p className="font-extrabold">Documento listo</p><p className="text-xs text-slate-500">Vista previa antes de pagar</p></div><span className="text-xl text-emerald-600">✓</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Así funciona</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Del comparendo al escrito, sin complicarte.</h2><p className="mt-4 text-base leading-7 text-slate-500">Un flujo diseñado para que la tecnología haga el trabajo pesado y tú mantengas el control.</p></div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((step) => <article key={step.n} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-md transition hover:-translate-y-1 hover:shadow-lg"><div className="flex items-center justify-between"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700"><Icon type={step.icon} /></div><span className="text-xs font-black tracking-[0.16em] text-slate-300">PASO {step.n}</span></div><h3 className="mt-7 text-xl font-black leading-tight">{step.title}</h3><p className="mt-3 text-sm leading-6 text-slate-500">{step.text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20"><ComparisonTable /></section>

      <section className="bg-slate-950 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8"><DocumentBlurPreview /></div>
      </section>

      <section className="border-t border-slate-200 bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="rounded-[2rem] border border-indigo-100 bg-indigo-50/60 p-7 sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Pago seguro</p><h2 className="mt-2 text-3xl font-black tracking-tight">Documento jurídico por $49.900 COP.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Revisa la vista previa antes de pagar y descarga tu documento en PDF y Word.</p></div>
              <Link href={trafficHref} className="rounded-2xl bg-indigo-600 px-7 py-4 text-center text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700">Continuar por $49.900 →</Link>
            </div>
            <TrustBadges />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8"><div className="rounded-[2rem] bg-indigo-600 px-7 py-12 text-white sm:px-12 lg:flex lg:items-center lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-200">TrámiteYa</p><h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">Empieza tu trámite sin enfrentarte solo a la burocracia.</h2></div><Link href={trafficHref} className="mt-7 inline-block rounded-2xl bg-white px-6 py-4 text-sm font-black text-indigo-700 lg:mt-0">Iniciar ahora →</Link></div></section>

      <section className="border-t border-slate-200 bg-[#f7f8fa] py-7"><div className="mx-auto max-w-7xl px-5 text-xs leading-5 text-slate-500 lg:px-8">TrámiteYa es una herramienta tecnológica de automatización documental. La generación de un documento no constituye por sí misma asesoría jurídica personalizada ni garantiza el resultado de un procedimiento. El usuario es responsable de verificar la información suministrada y cumplir los requisitos y términos aplicables.</div></section>
      <Footer />
    </main>
  );
}
