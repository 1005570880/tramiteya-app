"use client";

import React, { useEffect, useState } from "react";
import { procedureStorage } from "../../../lib/procedureStorage";
import type { ProcedureInstance } from "../../../types/procedure";
import Link from "next/link";

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Array<{ instance: ProcedureInstance; doc: any }>>([]);

  useEffect(() => {
    const list = procedureStorage.list();
    const items = list
      .filter((i) => i.document)
      .map((i) => ({ instance: i, doc: i.document }));
    setDocs(items as any);
  }, []);

  if (docs.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow text-center">
        <h3 className="text-lg font-bold">No hay documentos</h3>
        <p className="text-sm text-slate-500 mt-2">Tus documentos aparecerán aquí cuando estén disponibles.</p>
        <div className="mt-4">
          <Link href="/tramites" className="px-4 py-2 bg-blue-600 text-white rounded-md">Iniciar trámite</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {docs.map(({ instance, doc }) => (
        <div key={doc.id} className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{doc.title}</div>
              <div className="text-sm text-slate-500">{new Date(doc.createdAt).toLocaleString()}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => alert(doc.content)} className="px-3 py-2 rounded-md border">Ver documento</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
