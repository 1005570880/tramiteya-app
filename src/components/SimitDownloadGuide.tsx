"use client";

import React, { useEffect, useState } from "react";

const steps = [
  { title: "Entra al portal oficial de SIMIT", text: "Abre SIMIT y ubica el buscador de Estado de cuenta." },
  { title: "Escribe tu número de identificación", text: "Introduce la cédula del titular en el campo de consulta y pulsa la lupa azul." },
  { title: "Revisa el Estado de cuenta", text: "Verás el resumen y la tabla de Comparendos y Multas. Confirma que la consulta corresponda al titular." },
  { title: "Guarda el estado y descarga el PDF", text: "Pulsa “Guardar estado” y, en la ventana que aparece, pulsa “Descargar PDF”. Ese es el archivo que debes subir a TrámiteYa." },
];

function BrowserChrome() {
  return (
    <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2">
      <span className="h-2.5 w-2.5 rounded-full bg-red-300" /><span className="h-2.5 w-2.5 rounded-full bg-yellow-300" /><span className="h-2.5 w-2.5 rounded-full bg-green-300" />
      <div className="ml-2 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] text-slate-400">fcm.org.co/simit/#/estado-cuenta</div>
    </div>
  );
}

function VisualStep({ step }: { step: number }) {
  if (step === 0) return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><BrowserChrome /><div className="p-5 text-center md:p-7"><div className="text-2xl font-black tracking-tight text-blue-900">federación colombiana de municipios · simit</div><div className="mt-7 text-2xl font-bold text-blue-900">Estado de cuenta</div><div className="mt-1 text-xs text-slate-500">Consulta aquí comparendos, multas y acuerdos de pago</div><div className="mx-auto mt-5 flex max-w-md overflow-hidden rounded-lg border border-slate-200 shadow-sm"><span className="flex-1 px-3 py-3 text-left text-xs text-slate-400">Número de identificación o placa del vehículo</span><span className="grid w-12 place-items-center bg-blue-600 text-xl text-white">⌕</span></div></div></div>;

  if (step === 1) return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><BrowserChrome /><div className="p-5 md:p-7"><div className="text-xl font-bold text-blue-900">Estado de cuenta</div><div className="mt-4 flex max-w-md overflow-hidden rounded-lg border-2 border-blue-300 shadow-sm"><span className="flex-1 px-3 py-3 text-sm font-bold text-slate-800">Número de identificación</span><span className="grid w-12 place-items-center bg-blue-600 text-xl text-white">⌕</span></div><div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-900"><b>Haz clic en la lupa azul.</b> El resultado se abrirá en la pantalla de Estado de cuenta.</div></div></div>;

  if (step === 2) return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><BrowserChrome /><div className="p-4"><div className="mb-3 flex flex-wrap gap-4 rounded-xl bg-slate-50 p-3 text-[10px] font-bold text-slate-600"><span>Comparendos</span><span>Multas</span><span>Acuerdos de pago</span><span>Estado de cuenta</span></div><div className="mb-2 text-sm font-bold text-slate-800">Comparendos y Multas</div><div className="grid grid-cols-4 gap-2 border-y bg-slate-100 px-3 py-2 text-[9px] font-bold text-slate-600"><span>Tipo</span><span>Placa</span><span>Secretaría</span><span>Estado</span></div>{["Multa · AAH92G · Cartagena · Cobro coactivo","Multa · ULC77F · Cartagena · Cobro coactivo","Multa · FXX072 · Cartagena · Cobro coactivo"].map(row => { const p = row.split(" · "); return <div key={row} className="grid grid-cols-4 gap-2 border-b px-3 py-3 text-[9px] text-slate-700"><span className="font-bold">{p[0]}</span><span>{p[1]}</span><span>{p[2]}</span><span className="font-semibold">{p[3]}</span></div>; })}<div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900"><b>Ahora pulsa “Guardar estado”.</b> Se abrirá la ventana del paso final.</div></div></div>;

  return <div className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm"><div className="border-b border-slate-200 bg-slate-50 px-4 py-3"><div className="flex items-center justify-between gap-3"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Paso final · pantalla de SIMIT</span><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">Descargar PDF</span></div></div><div className="relative overflow-hidden bg-slate-500 p-3 md:p-5"><div className="relative min-h-[330px] overflow-hidden rounded-lg border border-slate-300 bg-white shadow-2xl"><div className="h-9 border-b border-slate-200 bg-white px-4 flex items-center"><span className="text-[11px] font-bold text-slate-500">federación colombiana de municipios · simit</span><span className="ml-auto text-[10px] text-slate-400">Ingresar</span></div><div className="h-2 bg-gradient-to-r from-blue-700 via-yellow-300 to-red-600" /><div className="absolute inset-0 bg-slate-900/45" /><div className="absolute left-1/2 top-1/2 w-[82%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-md border border-slate-300 bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3"><span className="text-sm font-bold text-blue-900">Estado de cuenta</span><span className="text-xl leading-none text-slate-400">×</span></div><div className="p-4"><p className="text-xs text-slate-600">Ingresa el correo electrónico al cual deseas enviar el estado de cuenta.</p><div className="mt-3 flex gap-2"><div className="flex-1 rounded border border-slate-300 px-3 py-2 text-[10px] text-slate-400">ej. usuario@ejemplo.com</div><button type="button" className="rounded bg-blue-600 px-4 py-2 text-[10px] font-bold text-white">Enviar</button><button type="button" className="rounded bg-blue-600 px-4 py-2 text-[10px] font-bold text-white ring-4 ring-blue-200">Descargar PDF</button></div></div></div></div></div><div className="border-t border-blue-100 bg-blue-50 p-4"><p className="text-sm font-bold text-blue-950">Este es el último paso.</p><p className="mt-1 text-xs leading-5 text-blue-900">Después de pulsar <b>“Guardar estado”</b>, aparece esta ventana. Pulsa <b>“Descargar PDF”</b> y luego vuelve a TrámiteYa para seleccionar el archivo.</p></div></div>;
}

export default function SimitDownloadGuide() {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);

  // La guía debe aparecer ANTES de que el usuario pueda subir el PDF.
  // Se muestra una vez por sesión para no interrumpir cada visita posterior.
  useEffect(() => {
    try {
      if (!sessionStorage.getItem("tramiteya:simit-guide-seen:v1")) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  function closeGuide() {
    try { sessionStorage.setItem("tramiteya:simit-guide-seen:v1", "1"); } catch {}
    setOpen(false);
  }

  return (
    <>
      <div className="mb-5 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">Antes de subir tu PDF</p><h3 className="mt-1 text-base font-black text-slate-950 md:text-lg">¿No sabes cómo descargar el Estado de Cuenta de SIMIT?</h3><p className="mt-1 text-sm text-slate-600">Te mostramos el procedimiento exacto en 4 pasos.</p></div>
          <button type="button" onClick={() => { setStep(0); setOpen(true); }} className="shrink-0 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700">Ver guía paso a paso</button>
        </div>
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><b>Importante:</b> TrámiteYa necesita el <b>Estado de Cuenta oficial en PDF</b>. No subas una captura, una foto ni un PDF creado a partir de una captura.</div>
      </div>

      {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="Guía para descargar el Estado de Cuenta de SIMIT">
        <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 md:px-6"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-600">Guía de descarga</p><h2 className="text-lg font-black text-slate-950">Cómo obtener tu Estado de Cuenta de SIMIT</h2></div><button type="button" onClick={closeGuide} className="rounded-full px-3 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100" aria-label="Cerrar">×</button></div>
          <div className="overflow-y-auto px-5 py-5 md:px-6"><div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"><div><div className="space-y-2">{steps.map((item, index) => <button key={item.title} type="button" onClick={() => setStep(index)} className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition ${step === index ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-slate-50"}`}><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-black ${step === index ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>{index + 1}</span><span><span className="block text-sm font-bold text-slate-900">{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{item.text}</span></span></button>)}</div><a href="https://www.simit.org.co/" target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700">Abrir SIMIT oficial ↗</a></div><div><div className="mb-3 flex items-center justify-between"><span className="text-xs font-black uppercase tracking-wide text-slate-400">Paso {step + 1} de {steps.length}</span><span className="text-xs font-bold text-blue-700">{step === 3 ? "Pantalla de descarga" : "Vista ilustrada"}</span></div><VisualStep step={step}/><div className="mt-4 flex items-center justify-between gap-3"><button type="button" disabled={step === 0} onClick={() => setStep(v => Math.max(0, v - 1))} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40">Atrás</button>{step < steps.length - 1 ? <button type="button" onClick={() => setStep(v => Math.min(steps.length - 1, v + 1))} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white">Siguiente</button> : <button type="button" onClick={closeGuide} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white">Ya tengo mi PDF ✓</button>}</div></div></div></div>
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-right md:px-6"><button type="button" onClick={closeGuide} className="text-sm font-semibold text-slate-600 hover:text-slate-900">Cerrar guía</button></div>
        </div>
      </div>}
    </>
  );
}
