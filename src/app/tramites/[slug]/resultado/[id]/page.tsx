"use client";

import React, { useEffect, useState } from "react";
import { procedureStorage } from "../../../../../lib/procedureStorage";
import type { ProcedureInstance } from "../../../../../types/procedure";
import { useRouter } from "next/navigation";
import Header from "../../../../../components/Header";
import Footer from "../../../../../components/Footer";
import WompiCheckout from "../../../../../components/WompiCheckout";

export default function ResultPage({ params }: { params: { slug: string; id: string } }) {
  const [instance, setInstance] = useState<ProcedureInstance | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [paid, setPaid] = useState(false);
  const [tab, setTab] = useState<"preview" | "history">("preview");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function load() {
    try {
      const response = await fetch(`/api/instances/${params.id}`, { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        setInstance(data);
        const latest = data.document;
        if (latest?.id) {
          const procedureId = data.procedureId || data.procedureSlug || params.slug;
          const paymentResponse = await fetch(`/api/payments?procedureId=${encodeURIComponent(procedureId)}&documentVersionId=${encodeURIComponent(latest.id)}`, { cache: "no-store" });
          if (paymentResponse.ok) setPaid(Boolean((await paymentResponse.json()).approved));
        }
        return;
      }

      const local = procedureStorage.get(params.id);
      setInstance(local);
      const latest = local?.document;
      if (latest?.id && local) {
        const procedureId = local.procedureId || local.procedureSlug || params.slug;
        const paymentResponse = await fetch(`/api/payments?procedureId=${encodeURIComponent(procedureId)}&documentVersionId=${encodeURIComponent(latest.id)}`, { cache: "no-store" });
        if (paymentResponse.ok) setPaid(Boolean((await paymentResponse.json()).approved));
      }
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [params.id, params.slug]);

  if (loading) return <main className="min-h-screen bg-slate-50"><Header /><section className="max-w-4xl mx-auto px-4 py-16">Cargando documento...</section><Footer /></main>;
  if (!instance) return <main className="min-h-screen bg-slate-50"><Header /><section className="max-w-4xl mx-auto px-4 py-16"><h1 className="text-2xl font-bold">Trámite no encontrado.</h1></section><Footer /></main>;

  const docs = history.length ? history : (instance.document ? [instance.document] : []);
  const latest = instance.document || docs[docs.length - 1];
  const edit = () => router.push(`/tramites/${params.slug}/formulario?instance=${encodeURIComponent(instance.id)}`);
  const markDownloaded = () => { procedureStorage.markDownloaded(instance.id); };
  const download = async (format: "docx" | "pdf", version?: number) => {
    if (!paid) { alert("Primero debes completar el pago para descargar el documento."); return; }
    markDownloaded();
    const suffix = version ? `?version=${encodeURIComponent(String(version))}` : "";
    const response = await fetch(`/api/documents/${instance.id}/download${format === "pdf" ? "/pdf" : ""}${suffix}`, { cache: "no-store" });
    if (!response.ok) { alert("La descarga todavía no está habilitada. Verifica que el pago haya sido confirmado."); return; }
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `tramiteya-${params.slug}.${format}`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  };
  const downloadButtonClass = (format: "word" | "pdf") => paid ? `px-4 py-3 rounded-lg ${format === "pdf" ? "bg-emerald-600 text-white" : "bg-slate-900 text-white"} font-medium hover:opacity-90` : "px-4 py-3 rounded-lg bg-slate-200 text-slate-400 font-medium cursor-not-allowed";

  return <main className="min-h-screen bg-slate-50 text-slate-900 font-sans"><Header /><section className="max-w-5xl mx-auto px-4 py-12"><div className="bg-white p-6 md:p-8 rounded-2xl shadow">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"><div><p className={`text-sm font-semibold ${paid ? "text-emerald-600" : "text-amber-600"}`}>DOCUMENTO • {paid ? "PAGO CONFIRMADO" : "PENDIENTE DE PAGO"}</p><h1 className="text-2xl font-bold mt-1">Revisa tu documento</h1><p className="text-sm text-slate-500 mt-1">Versión {latest?.version ?? latest?.meta?.version ?? 1} · generado {latest?.generatedAt ? new Date(latest.generatedAt).toLocaleString("es-CO") : "ahora"}</p></div><button onClick={edit} className="px-4 py-2 rounded-lg border font-medium">Editar respuestas</button></div>
    <div className="mt-6 flex gap-2 border-b"><button onClick={() => setTab("preview")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "preview" ? "border-emerald-600 text-emerald-600" : "border-transparent text-slate-500"}`}>Vista previa</button><button onClick={() => setTab("history")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "history" ? "border-emerald-600 text-emerald-600" : "border-transparent text-slate-500"}`}>Historial ({docs.length})</button></div>
    {tab === "preview" ? <div className="mt-6 space-y-4">
      <div className="rounded-xl border bg-white p-5 max-h-[560px] overflow-auto whitespace-pre-wrap text-sm leading-6">
        {latest?.content || "El documento todavía no tiene contenido disponible."}
      </div>
      {!paid && <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3"><div className="text-xl">🔒</div><div><h2 className="font-bold">Documento completo listo</h2><p className="text-sm text-slate-700 mt-1">Puedes revisar aquí el contenido y sus fundamentos jurídicos. El pago desbloquea únicamente la descarga del archivo Word/PDF.</p><div className="mt-4"><WompiCheckout procedureId={instance.procedureId || instance.procedureSlug || params.slug} documentVersionId={String(latest?.id || "")} onPending={() => undefined} /></div></div></div>
      </div>}
    </div> : <div className="mt-6 space-y-3">{docs.map((doc: any, i: number) => <div key={doc.id || i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border rounded-xl p-4"><div><div className="font-semibold">Versión {doc.version ?? doc.meta?.version ?? i + 1}</div><div className="text-xs text-slate-500">{doc.generatedAt ? new Date(doc.generatedAt).toLocaleString("es-CO") : doc.createdAt}</div></div><div className="flex gap-2"><button disabled={!paid} onClick={() => download("docx", Number(doc.version ?? doc.meta?.version ?? i + 1))} className={paid ? "px-3 py-2 rounded-lg border text-sm font-medium" : "px-3 py-2 rounded-lg bg-slate-100 text-slate-400 text-sm font-medium cursor-not-allowed"}>Word</button><button disabled={!paid} onClick={() => download("pdf", Number(doc.version ?? doc.meta?.version ?? i + 1))} className={paid ? "px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium" : "px-3 py-2 rounded-lg bg-slate-100 text-slate-400 text-sm font-medium cursor-not-allowed"}>PDF</button></div></div>)}</div>}
    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3"><button disabled={!paid} onClick={() => download("docx")} className={downloadButtonClass("word")}>Descargar Word (.docx)</button><button disabled={!paid} onClick={() => download("pdf")} className={downloadButtonClass("pdf")}>Descargar PDF</button></div><div className="mt-3"><button onClick={() => router.push("/tramites")} className="w-full px-4 py-3 rounded-lg border font-medium">Volver a trámites</button></div><p className="mt-5 text-xs text-slate-400">Revisa el contenido y sus fundamentos antes de presentarlo ante la autoridad competente.</p>
  </div></section><Footer /></main>;
}
