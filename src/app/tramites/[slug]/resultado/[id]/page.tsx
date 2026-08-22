"use client";

import React, { useEffect, useState } from "react";
import { procedureStorage } from "../../../../lib/procedureStorage";
import type { ProcedureInstance } from "../../../../types/procedure";
import { useRouter } from "next/navigation";
import Header from "../../../../components/Header";
import Footer from "../../../../components/Footer";

export default function ResultPage({ params }: { params: { slug: string; id: string } }) {
  const [instance, setInstance] = useState<ProcedureInstance | null>(null);
  const router = useRouter();
  useEffect(() => { const inst = procedureStorage.get(params.id); if (inst) setInstance(inst); }, [params.id]);

  if (!instance) return <main className="min-h-screen bg-slate-50"><Header /><section className="max-w-4xl mx-auto px-4 py-16"><h1 className="text-2xl font-bold">Trámite no encontrado.</h1></section><Footer /></main>;

  const download = (format: 'docx' | 'pdf') => {
    window.open(`/api/documents/${instance.id}/download${format === 'pdf' ? '/pdf' : ''}`, '_blank');
  };

  return <main className="min-h-screen bg-slate-50 text-slate-900 font-sans"><Header /><section className="max-w-5xl mx-auto px-4 py-12"><div className="bg-white p-6 md:p-8 rounded-2xl shadow"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">✓</div><div><h1 className="text-2xl font-bold">Tu documento está listo</h1><p className="text-sm text-slate-500">{instance.document?.title}</p></div></div><div className="mt-6 bg-slate-50 p-5 rounded-xl whitespace-pre-wrap text-sm leading-6 max-h-[520px] overflow-auto">{instance.document?.content}</div><div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3"><button onClick={() => download('docx')} className="px-4 py-3 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800">Descargar Word (.docx)</button><button onClick={() => download('pdf')} className="px-4 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700">Descargar PDF</button></div><div className="mt-3"><button onClick={() => router.push('/dashboard')} className="w-full px-4 py-3 rounded-lg border font-medium">Volver a mis trámites</button></div><p className="mt-5 text-xs text-slate-400">El documento es generado automáticamente a partir de la información suministrada. Revísalo antes de presentarlo.</p></div></section><Footer /></main>;
}
