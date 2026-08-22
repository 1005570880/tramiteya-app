"use client";

import React, { useEffect, useState } from "react";
import { procedureStorage } from "../../lib/procedureStorage";
import type { ProcedureInstance } from "../../types/procedure";
import Link from "next/link";

export default function DashboardClient() {
  const [instances, setInstances] = useState<ProcedureInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const list = procedureStorage.list();
      setInstances(list);
    } catch (e) {
      setError('Error al cargar trámites');
    } finally {
      setLoading(false);
    }
  }, []);

  function computeProgress(inst: ProcedureInstance) {
    const answers = inst.answers || {};
    const total = Object.keys(answers).length; // approximate
    // naive progress: based on number of answered fields (not exact)
    const answered = Object.values(answers).filter((v) => v !== null && v !== '').length;
    return total === 0 ? 0 : Math.round((answered / total) * 100);
  }

  function handleRemove(id: string) {
    if (!confirm('Eliminar trámite?')) return;
    procedureStorage.remove(id);
    setInstances((s) => s.filter((i) => i.id !== id));
  }

  if (loading) return <div>Cargando...</div>;
  if (error) return <div>{error}</div>;

  if (instances.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow text-center">
        <h3 className="text-lg font-bold">Todavía no tienes trámites.</h3>
        <p className="text-sm text-slate-500 mt-2">Comienza un trámite y lo verás aquí.</p>
        <div className="mt-4">
          <Link href="/tramites" className="px-4 py-2 bg-blue-600 text-white rounded-md">Iniciar mi primer trámite</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {instances.map((inst) => (
        <div key={inst.id} className="bg-white p-4 rounded-lg border flex items-center justify-between">
          <div>
            <div className="font-semibold">{inst.procedureSlug.replace(/-/g, ' ')}</div>
            <div className="text-sm text-slate-500">{inst.status} • {new Date(inst.createdAt).toLocaleString()}</div>
            <div className="text-sm text-slate-500">Progreso: {computeProgress(inst)}%</div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/tramites/${inst.procedureSlug}/formulario`} className="px-3 py-2 rounded-md border">Continuar</Link>
            {inst.document ? (
              <Link href={`/dashboard/documentos`} className="px-3 py-2 rounded-md bg-blue-600 text-white">Ver</Link>
            ) : (
              <button onClick={() => alert('Aún no hay documento')} className="px-3 py-2 rounded-md border">Ver</button>
            )}
            <button onClick={() => handleRemove(inst.id)} className="px-3 py-2 rounded-md border text-red-600">Eliminar</button>
          </div>
        </div>
      ))}
    </div>
  );
}
