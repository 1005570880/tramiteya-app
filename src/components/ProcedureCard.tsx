"use client";

import React from "react";
import type { Procedure } from "../types";
import Link from "next/link";

export default function ProcedureCard({ procedure }: { procedure: Procedure }) {
  return (
    <article className="bg-white rounded-2xl shadow-md border p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">{procedure.title}</h3>
          <span className={`text-xs px-2 py-1 rounded-full ${procedure.available ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {procedure.available ? 'Disponible' : 'Próximamente'}
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-2">{procedure.description}</p>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-slate-400">{procedure.category} • {procedure.estimatedTime}</div>
        <Link href={`/tramites/${procedure.slug}`} className={`ml-4 px-3 py-2 rounded-xl font-semibold ${procedure.available ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600 cursor-not-allowed'}`}>
          Iniciar trámite
        </Link>
      </div>
    </article>
  );
}
