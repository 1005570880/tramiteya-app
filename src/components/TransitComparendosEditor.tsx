'use client';

import type { Comparendo } from '@/lib/transitPrescription';

type Props = {
  value: Comparendo[];
  onChange: (value: Comparendo[]) => void;
};

const emptyComparendo = (): Comparendo => ({ number: '' });

export default function TransitComparendosEditor({ value, onChange }: Props) {
  const items = value.length ? value : [emptyComparendo()];

  function update(index: number, number: string) {
    onChange(items.map((item, i) => (i === index ? { ...item, number } : item)));
  }

  function remove(index: number) {
    if (items.length === 1) return onChange([emptyComparendo()]);
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <section key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Comparendo {index + 1}</p>
              <p className="text-xs text-slate-500">Solo necesitamos el número. TrámiteYa hará la verificación jurídica.</p>
            </div>
            {items.length > 1 && (
              <button type="button" onClick={() => remove(index)} className="text-sm text-red-600">Eliminar</button>
            )}
          </div>

          <label className="text-sm text-slate-700">
            Número de comparendo
            <input
              inputMode="numeric"
              autoComplete="off"
              className="mt-1 w-full rounded-xl border p-3"
              value={item.number}
              onChange={(e) => update(index, e.target.value.replace(/\D/g, ''))}
              placeholder="Ej. 7067001422267"
            />
          </label>
        </section>
      ))}

      <button type="button" onClick={() => onChange([...items, emptyComparendo()])} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
        + Agregar otro comparendo
      </button>
    </div>
  );
}
