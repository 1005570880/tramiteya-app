import React from "react";

const paymentMethods = [
  { label: "Wompi", mark: "W" },
  { label: "Bancolombia", mark: "B" },
  { label: "PSE", mark: "PSE" },
  { label: "Nequi", mark: "N" },
  { label: "Visa", mark: "VISA" },
  { label: "Mastercard", mark: "MC" },
];

export default function TrustBadges() {
  return (
    <section aria-label="Seguridad y medios de pago" className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="grid divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-lg text-emerald-600">🔒</div>
            <div>
              <p className="font-extrabold text-slate-900">SSL y seguridad</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Encriptación SSL 256-bit — tus datos están protegidos durante la conexión.</p>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-lg text-indigo-600">✓</div>
            <div>
              <p className="font-extrabold text-slate-900">Datos de tránsito</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Análisis compatible con datos del SIMIT y RUNT, según la información disponible.</p>
            </div>
          </div>
        </div>

        <div className="p-5">
          <p className="font-extrabold text-slate-900">Pago seguro</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Pago procesado por Wompi y Bancolombia.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {paymentMethods.map((method) => (
              <span key={method.label} title={method.label} className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[10px] font-black tracking-tight text-slate-700">
                {method.mark}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
