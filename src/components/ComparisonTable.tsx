import React from "react";

const rows = [
  { factor: "Precio", traditional: "$150.000 – $300.000 COP", tramiteya: "$49.900 COP" },
  { factor: "Tiempo de preparación", traditional: "Hasta 3 días", tramiteya: "Aproximadamente 2 min" },
  { factor: "Transparencia", traditional: "Pagas a ciegas", tramiteya: "Vista previa gratuita" },
  { factor: "Sustento legal", traditional: "Depende del tramitador", tramiteya: "Análisis y estructura jurídica" },
];

export default function ComparisonTable() {
  return (
    <section aria-labelledby="comparison-title" className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-md sm:p-8">
      <div className="mb-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Comparación clara</p>
        <h2 id="comparison-title" className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">¿Por qué pagar de más?</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Conoce qué obtienes antes de tomar la decisión de pago.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid grid-cols-[1fr_1fr_1fr] bg-slate-950 text-[11px] font-black uppercase tracking-wide text-white sm:text-sm">
          <div className="p-4 sm:p-5">Factor</div>
          <div className="border-l border-white/10 p-4 sm:p-5">Tramitador tradicional</div>
          <div className="border-l border-indigo-400/30 bg-indigo-600 p-4 sm:p-5">TrámiteYa</div>
        </div>
        {rows.map((row) => (
          <div key={row.factor} className="grid grid-cols-[1fr_1fr_1fr] border-t border-slate-200 text-sm">
            <div className="p-4 font-extrabold text-slate-800 sm:p-5">{row.factor}</div>
            <div className="border-l border-slate-200 p-4 leading-6 text-slate-500 sm:p-5">{row.traditional}</div>
            <div className="border-l border-slate-200 bg-indigo-50/60 p-4 font-extrabold leading-6 text-indigo-950 sm:p-5"><span className="mr-1.5 text-emerald-600">✓</span>{row.tramiteya}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
