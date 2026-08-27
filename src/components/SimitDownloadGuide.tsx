"use client";

import Link from "next/link";

export default function SimitDownloadGuide() {
  return (
    <section className="border-b border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-5 md:py-6">
        <details className="group overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-600 text-xl text-white shadow-sm">?</div>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Antes de subir tu PDF</div>
                <h2 className="mt-1 text-lg font-bold text-slate-950 md:text-xl">¿No sabes cómo descargar el Estado de Cuenta de SIMIT?</h2>
                <p className="mt-1 text-sm text-slate-600">Te guiamos en menos de un minuto. No necesitas copiar ningún dato.</p>
              </div>
            </div>
            <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 sm:block group-open:hidden">Ver guía</span>
            <span className="hidden rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 sm:block group-open:block">Ocultar</span>
          </summary>

          <div className="border-t border-slate-100 px-5 pb-6 pt-5 md:px-6">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-sm font-black text-blue-700 shadow-sm">1</span><span className="text-sm font-bold">Entra a SIMIT</span></div>
                <p className="text-sm leading-6 text-slate-600">Abre el portal oficial y entra a la opción para consultar tus comparendos, multas o acuerdos de pago.</p>
                <a href="https://www.simit.org.co/" target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-bold text-blue-700 hover:underline">Abrir SIMIT oficial ↗</a>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-sm font-black text-blue-700 shadow-sm">2</span><span className="text-sm font-bold">Consulta tu información</span></div>
                <p className="text-sm leading-6 text-slate-600">Identifícate con los datos que solicite el portal y realiza la consulta. Verifica que aparezcan tus comparendos o multas.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-sm font-black text-blue-700 shadow-sm">3</span><span className="text-sm font-bold">Descarga el Estado de Cuenta</span></div>
                <p className="text-sm leading-6 text-slate-600">Busca la opción para generar o descargar el Estado de Cuenta y guarda el archivo en formato <strong>PDF</strong>.</p>
                <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">Importante: sube el PDF oficial, no una captura de pantalla.</div>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-slate-950 p-4 text-sm text-white sm:flex-row sm:items-center sm:justify-between">
              <div><strong>¿Ya tienes el PDF?</strong><span className="ml-1 text-slate-300">Cierra esta guía y continúa con la carga.</span></div>
              <button type="button" onClick={() => document.querySelector("summary")?.click()} className="rounded-xl bg-white px-4 py-2 font-bold text-slate-950 hover:bg-slate-100">Continuar</button>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
