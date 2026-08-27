"use client";

import React, { useState } from "react";

const steps = [
  {
    title: "Entra al portal oficial de SIMIT",
    text: "Abre SIMIT y ubica el buscador de Estado de cuenta. Allí puedes consultar comparendos, multas y acuerdos de pago.",
  },
  {
    title: "Escribe tu número de identificación",
    text: "Introduce la cédula del titular en el campo “Número de identificación o placa del vehículo” y pulsa la lupa azul.",
  },
  {
    title: "Espera el Estado de cuenta",
    text: "Verás el resumen y la tabla de Comparendos y Multas. Revisa que la consulta corresponda al titular antes de continuar.",
  },
  {
    title: "Pulsa “Guardar estado”",
    text: "En la pantalla de resultados encontrarás “Guardar estado”. Pulsa esa opción y conserva el archivo que genera SIMIT para subirlo aquí.",
  },
];

function BrowserChrome() {
  return (
    <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2">
      <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
      <span className="h-2.5 w-2.5 rounded-full bg-yellow-300" />
      <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
      <div className="ml-2 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] text-slate-400">fcm.org.co/simit/#/estado-cuenta</div>
    </div>
  );
}

function VisualStep({ step }: { step: number }) {
  if (step === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <BrowserChrome />
        <div className="p-5 md:p-7">
          <div className="text-center">
            <div className="text-2xl font-black tracking-tight text-blue-900">federación colombiana de municipios · simit</div>
            <div className="mt-7 text-2xl font-bold text-blue-900">Estado de cuenta</div>
            <div className="mt-1 text-xs text-slate-500">Consulta aquí comparendos, multas y acuerdos de pago</div>
            <div className="mx-auto mt-5 flex max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <span className="flex-1 px-3 py-3 text-left text-xs text-slate-400">Número de identificación o placa del vehículo</span>
              <span className="grid w-12 place-items-center bg-blue-600 text-xl text-white">⌕</span>
            </div>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700">PASO 1 · ABRE SIMIT</div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <BrowserChrome />
        <div className="p-5 md:p-7">
          <div className="text-xl font-bold text-blue-900">Estado de cuenta</div>
          <div className="mt-4 flex max-w-md overflow-hidden rounded-lg border-2 border-blue-300 bg-white shadow-sm">
            <span className="flex-1 px-3 py-3 text-sm font-bold text-slate-800">73142064</span>
            <span className="grid w-12 place-items-center bg-blue-600 text-xl text-white">⌕</span>
          </div>
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-900">
            <b>Haz clic en la lupa azul.</b><br />El resultado se abrirá en la pantalla de Estado de cuenta.
          </div>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <BrowserChrome />
        <div className="p-4">
          <div className="mb-3 flex flex-wrap gap-4 rounded-xl bg-slate-50 p-3 text-[10px] font-bold text-slate-600">
            <span>Comparendos: 0</span><span>Multas: 4</span><span>Acuerdos de pago: 0</span><span>Cédula: 73142064</span>
          </div>
          <div className="mb-2 text-sm font-bold text-slate-800">Comparendos y Multas</div>
          <div className="grid grid-cols-4 gap-2 border-y bg-slate-100 px-3 py-2 text-[9px] font-bold text-slate-600"><span>Tipo</span><span>Placa</span><span>Secretaría</span><span>Estado</span></div>
          {["9822 · AAH92G · Cartagena · Cobro coactivo", "27199 · ULC77F · Cartagena · Cobro coactivo", "3262 · FXX072 · Cartagena · Cobro coactivo"].map((row) => {
            const parts = row.split(" · ");
            return <div key={row} className="grid grid-cols-4 gap-2 border-b px-3 py-3 text-[9px] text-slate-700"><span className="font-bold">Multa<br />{parts[0]}</span><span>{parts[1]}</span><span>{parts[2]}</span><span className="font-semibold">{parts[3]}</span></div>;
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <BrowserChrome />
      <div className="p-5 md:p-7">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <span className="text-xs font-bold text-slate-700">Estado de cuenta</span>
          <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-black text-blue-700">⇩ Guardar estado</span>
        </div>
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <div className="text-sm font-bold text-emerald-800">✓ Archivo guardado</div>
          <div className="mt-1 text-xs text-emerald-700">Ahora vuelve a TrámiteYa y selecciona el PDF.</div>
        </div>
      </div>
    </div>
  );
}

export default function SimitDownloadGuide() {
  const [step, setStep] = useState(0);

  return (
    <section className="border-b border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-5 md:py-7">
        <details className="group overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow-sm">?</div>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Antes de subir tu PDF</div>
                <h2 className="mt-1 text-lg font-black text-slate-950 md:text-xl">¿No sabes cómo descargar el Estado de Cuenta de SIMIT?</h2>
                <p className="mt-1 text-sm text-slate-600">Te mostramos exactamente qué debes hacer, paso a paso.</p>
              </div>
            </div>
            <span className="hidden rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 sm:block">Guía rápida</span>
          </summary>

          <div className="border-t border-slate-100 px-5 pb-6 pt-5 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <div className="space-y-2">
                  {steps.map((item, index) => (
                    <button key={item.title} type="button" onClick={() => setStep(index)} className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition ${step === index ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-slate-50"}`}>
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-black ${step === index ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>{index + 1}</span>
                      <span><span className="block text-sm font-bold text-slate-900">{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{item.text}</span></span>
                    </button>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="text-xs font-black uppercase tracking-wide text-amber-800">Importante</div>
                  <p className="mt-1 text-xs leading-5 text-amber-900">TrámiteYa necesita el <b>Estado de Cuenta oficial en PDF</b>. No subas una captura de pantalla, una foto ni un PDF creado a partir de una captura.</p>
                </div>

                <a href="https://www.simit.org.co/" target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700">Abrir SIMIT oficial ↗</a>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between"><span className="text-xs font-black uppercase tracking-wide text-slate-400">Paso {step + 1} de {steps.length}</span><span className="text-xs font-bold text-blue-700">Vista ilustrada</span></div>
                <VisualStep step={step} />
                <div className="mt-4 flex items-center justify-between gap-3">
                  <button type="button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40">Atrás</button>
                  {step < steps.length - 1 ? (
                    <button type="button" onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white">Siguiente</button>
                  ) : (
                    <button type="button" onClick={() => document.querySelector("summary")?.click()} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white">Ya tengo mi PDF ✓</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
