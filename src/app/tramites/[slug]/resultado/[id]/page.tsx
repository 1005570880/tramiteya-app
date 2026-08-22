"use client";
import React, { useEffect, useMemo, useState } from "react";
import { procedureStorage } from "../../../../lib/procedureStorage";
import type { ProcedureInstance } from "../../../../types/procedure";
import { useRouter } from "next/navigation";
import Header from "../../../../components/Header";
import Footer from "../../../../components/Footer";

export default function ResultPage({ params }: { params: { slug: string; id: string } }) {
  const [instance, setInstance] = useState<ProcedureInstance | null>(null);
  const [tab, setTab] = useState<"preview" | "history">("preview");
  const router = useRouter();
  useEffect(() => { setInstance(procedureStorage.get(params.id)); }, [params.id]);
  const history = useMemo(() => instance?.document ? [instance.document] : [], [instance]);
  if (!instance) return <main className="min-h-screen bg-slate-50"><Header/><section className="max-w-4xl mx-auto px-4 py-16"><h1 className="text-2xl font-bold">Trámite no encontrado.</h1></section><Footer/></main>;
  const download = (format: "docx" | "pdf") => { procedureStorage.markDownloaded(instance.id); window.open(`/api/documents/${instance.id}/download${format === "pdf" ? "/pdf" : ""}`, "_blank"); };
  return <main className="min-h-screen bg-slate-50 text-slate-900 font-sans"><Header/><section className="max-w-5xl mx-auto px-4 py-12"><div className="bg-white p-6 md:p-8 rounded-2xl shadow">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"><div><p className="text-sm font-semibold text-blue-600">DOCUMENTO • {instance.status === "downloaded" ? "DESCARGADO" : "LISTO"}</p><h1 className="text-2xl font-bold mt-1">Revisa tu documento</h1><p className="text-sm text-slate-500 mt-1">Versión {instance.document?.version ?? 1} · generado {instance.document?.generatedAt ? new Date(instance.document.generatedAt).toLocaleString("es-CO") : "ahora"}</p></div><button onClick={() => router.push(`/tramites/${params.slug}/formulario`)} className="px-4 py-2 rounded-lg border font-medium">Editar respuestas</button></div>
    <div className="mt-6 flex gap-2 border-b"><button onClick={() => setTab("preview")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "preview" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}>Vista previa</button><button onClick={() => setTab("history")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "history" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}>Historial</button></div>
    {tab === "preview" ? <div className="mt-6 bg-slate-50 p-5 rounded-xl whitespace-pre-wrap text-sm leading-6 max-h-[560px] overflow-auto">{instance.document?.content}</div> : <div className="mt-6 space-y-3">{history.map((doc) => <div key={doc.id} className="flex items-center justify-between border rounded-xl p-4"><div><div className="font-semibold">Versión {doc.version ?? 1}</div><div className="text-xs text-slate-500">{doc.generatedAt ? new Date(doc.generatedAt).toLocaleString("es-CO") : doc.createdAt}</div></div><span className="text-xs rounded-full bg-emerald-100 text-emerald-700 px-3 py-1">Generada</span></div>)}</div>}
    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3"><button onClick={() => download("docx")} className="px-4 py-3 rounded-lg bg-slate-900 text-white font-medium">Descargar Word (.docx)</button><button onClick={() => download("pdf")} className="px-4 py-3 rounded-lg bg-blue-600 text-white font-medium">Descargar PDF</button></div><div className="mt-3"><button onClick={() => router.push("/dashboard")} className="w-full px-4 py-3 rounded-lg border font-medium">Volver a mis trámites</button></div><p className="mt-5 text-xs text-slate-400">Revisa el contenido y sus fundamentos antes de presentarlo ante la autoridad competente.</p>
  </div></section><Footer/></main>;
}
