'use client';

import { useMemo } from 'react';
import type { Comparendo } from '@/lib/transitPrescription';
import { analyzeTransitPrescription } from '@/lib/transitPrescription';

type Props = {
  value: Comparendo[];
  onChange: (value: Comparendo[]) => void;
};

const emptyComparendo = (): Comparendo => ({ number: '', coactiveDate: '' });

export default function TransitComparendosEditor({ value, onChange }: Props) {
  const items = value.length ? value : [emptyComparendo()];
  const today = useMemo(() => new Date(), []);

  function update(index: number, patch: Partial<Comparendo>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function remove(index: number) {
    if (items.length === 1) return onChange([emptyComparendo()]);
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        const analysis = item.coactiveDate ? analyzeTransitPrescription(item, today) : null;
        return (
          <section key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Comparendo {index + 1}</p>
                <p className="text-xs text-slate-500">No necesitas redactar los hechos.</p>
              </div>
              {items.length > 1 && (
                <button type="button" onClick={() => remove(index)} className="text-sm text-red-600">Eliminar</button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-700">
                Número de comparendo
                <input className="mt-1 w-full rounded-xl border p-2.5" value={item.number} onChange={(e) => update(index, { number: e.target.value })} />
              </label>
              <label className="text-sm text-slate-700">
                Fecha del comparendo / infracción
                <input type="date" className="mt-1 w-full rounded-xl border p-2.5" value={item.violationDate ?? ''} onChange={(e) => update(index, { violationDate: e.target.value })} />
              </label>
              <label className="text-sm text-slate-700">
                Fecha del cobro coactivo
                <input type="date" className="mt-1 w-full rounded-xl border p-2.5" value={item.coactiveDate} onChange={(e) => update(index, { coactiveDate: e.target.value })} />
              </label>
              <label className="text-sm text-slate-700">
                Fecha de notificación del mandamiento de pago <span className="text-slate-400">(si la conoces)</span>
                <input type="date" className="mt-1 w-full rounded-xl border p-2.5" value={item.paymentOrderNoticeDate ?? ''} onChange={(e) => update(index, { paymentOrderNoticeDate: e.target.value })} />
              </label>
              <label className="text-sm text-slate-700">
                Secretaría / origen
                <input className="mt-1 w-full rounded-xl border p-2.5" value={item.origin ?? ''} onChange={(e) => update(index, { origin: e.target.value })} placeholder="Ej. Sampués - Sucre" />
              </label>
              <label className="text-sm text-slate-700">
                Infracción
                <input className="mt-1 w-full rounded-xl border p-2.5" value={item.infraction ?? ''} onChange={(e) => update(index, { infraction: e.target.value })} placeholder="Ej. C24" />
              </label>
              <label className="text-sm text-slate-700 md:col-span-2">
                Valor de la multa <span className="text-slate-400">(opcional)</span>
                <input type="number" min="0" className="mt-1 w-full rounded-xl border p-2.5" value={item.totalFine ?? ''} onChange={(e) => update(index, { totalFine: e.target.value ? Number(e.target.value) : undefined })} />
              </label>
            </div>

            {analysis && (
              <div className={`mt-4 rounded-xl p-3 text-sm ${analysis.meetsThreeYearThreshold ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                <strong>{analysis.elapsedYears} años completos transcurridos.</strong>{' '}
                Umbral de 3 años: {analysis.threeYearDate}. La fecha base utilizada es {analysis.basisDate === 'violationDate' ? 'la infracción' : 'el coactivo'}.
              </div>
            )}
          </section>
        );
      })}

      <button type="button" onClick={() => onChange([...items, emptyComparendo()])} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
        + Agregar otro comparendo
      </button>
    </div>
  );
}
