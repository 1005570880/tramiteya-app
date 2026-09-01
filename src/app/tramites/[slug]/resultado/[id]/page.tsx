"use client";

import React, { useEffect, useMemo, useState } from "react";
import { procedureStorage } from "../../../../../lib/procedureStorage";
import type { ProcedureInstance } from "../../../../../types/procedure";
import { getSupabaseBrowser } from "../../../../../lib/supabaseBrowserClient";
import { useRouter } from "next/navigation";
import Header from "../../../../../components/Header";
import Footer from "../../../../../components/Footer";
import WompiCheckout from "../../../../../components/WompiCheckout";
import TrustBadges from "../../../../../components/TrustBadges";
import TestimonialsSlider from "../../../../../components/TestimonialsSlider";

function cleanInlineMarkdown(value: string) {
  return value.replace(/\*\*(.*?)\*\*/g, "$1").replace(/__(.*?)__/g, "$1").replace(/`([^`]+)`/g, "$1").trim();
}

function DocumentBody({ content, paid }: { content: string; paid: boolean }) {
  const blocks = useMemo(() => {
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    const foundationIndex = lines.findIndex((line) => /^(?:#{1,6}\s*)?(?:\*\*\s*)?(?:III\.?\s*)?FUNDAMENTOS DE DERECHO/i.test(line.trim()) || /FUNDAMENTOS DE DERECHO/i.test(line.trim()));
    const thirtyPercentIndex = Math.max(1, Math.floor(lines.length * 0.3));
    const cutoff = foundationIndex >= 0 ? Math.max(thirtyPercentIndex, foundationIndex) : thirtyPercentIndex;
    return lines.map((line, index) => ({ line, blurred: !paid && index >= cutoff }));
  }, [content, paid]);

  return <div className="mx-auto w-full max-w-[850px] bg-white border border-slate-300 shadow-xl px-8 py-10 md:px-12 md:py-12 text-[15px] text-slate-900 leading-[1.3]" style={{ fontFamily: '"Arial Narrow", Arial, sans-serif' }}>
    <div className="whitespace-pre-wrap break-words">
      {blocks.map(({ line, blurred }, index) => {
        const trimmed = line.trim();
        const isHeading = /^#{1,6}\s+/.test(trimmed) || /^\*\*[^*]+\*\*$/.test(trimmed);
        const headingText = cleanInlineMarkdown(trimmed.replace(/^#{1,6}\s+/, ""));
        const className = blurred ? "relative select-none pointer-events-none filter blur-[5px] transition-all duration-500" : "";
        if (!trimmed) return <div key={index} className={`h-3 ${className}`} aria-hidden="true" />;
        if (isHeading) return <h3 key={index} className={`text-lg font-bold my-4 ${className}`}>{headingText}</h3>;
        if (/^[-•]\s+/.test(trimmed)) return <p key={index} className={`my-1 pl-4 ${className}`}>{cleanInlineMarkdown(trimmed)}</p>;
        if (/^\d+[.)]\s+/.test(trimmed)) return <p key={index} className={`my-2 ${className}`}>{cleanInlineMarkdown(trimmed)}</p>;
        return <p key={index} className={`my-2 ${className}`}>{cleanInlineMarkdown(line)}</p>;
      })}
    </div>
  </div>;
}

export default function ResultPage({ params }: { params: { slug: string; id: string } }) {
  const [instance, setInstance] = useState<ProcedureInstance | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [paid, setPaid] = useState(false);
  const [resolvedDocumentId, setResolvedDocumentId] = useState<string | null>(null);
  const [tab, setTab] = useState<"preview" | "history">("preview");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const guestHeaders = { "x-guest-access-token": params.id };

  async function load() {
    try {
      const supabase = getSupabaseBrowser();
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const headers = { Authorization: `Bearer ${session.access_token}` };
          const response = await fetch(`/api/instances/${params.id}`, { headers, cache: "no-store" });
          if (response.ok) {
            const data = await response.json();
            setInstance(data);
            const historyResponse = await fetch(`/api/instances/${params.id}/documents`, { headers, cache: "no-store" });
            if (historyResponse.ok) setHistory((await historyResponse.json()).data || []);
            const paymentResponse = await fetch(`/api/payments?procedureId=${encodeURIComponent(data.procedureId || data.procedureSlug || params.slug)}&instanceId=${encodeURIComponent(params.id)}`, { headers, cache: "no-store" });
            if (paymentResponse.ok) {
              const payment = await paymentResponse.json();
              setPaid(Boolean(payment.approved));
              if (payment.documentVersionId) setResolvedDocumentId(payment.documentVersionId);
            }
            return;
          }
        }
      }
      const local = procedureStorage.get(params.id);
      setInstance(local);
      const paymentResponse = await fetch(`/api/payments?procedureId=${encodeURIComponent(local?.procedureId || local?.procedureSlug || params.slug)}&instanceId=${encodeURIComponent(params.id)}`, { headers: guestHeaders, cache: "no-store" });
      if (paymentResponse.ok) {
        const payment = await paymentResponse.json();
        setPaid(Boolean(payment.approved));
        if (payment.documentVersionId) setResolvedDocumentId(payment.documentVersionId);
      }
      try {
        const stored = localStorage.getItem(`tramiteya:paid-document:${params.id}`);
        if (stored) setResolvedDocumentId(stored);
      } catch { /* localStorage may be unavailable */ }
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [params.id, params.slug]);

  if (loading) return <main className="min-h-screen bg-slate-50"><Header /><section className="max-w-4xl mx-auto px-4 py-16">Cargando documento...</section><Footer /></main>;
  if (!instance) return <main className="min-h-screen bg-slate-50"><Header /><section className="max-w-4xl mx-auto px-4 py-16"><h1 className="text-2xl font-bold">Trámite no encontrado.</h1></section><Footer /></main>;

  const docs = history.length ? history : (instance.document ? [instance.document] : []);
  const latest = instance.document || docs[docs.length - 1];
  const edit = () => router.push(`/tramites/${params.slug}/formulario?instance=${encodeURIComponent(instance.id)}`);

  const markDownloaded = async () => {
    procedureStorage.markDownloaded(instance.id);
    const supabase = getSupabaseBrowser();
    try {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) await fetch(`/api/instances/${instance.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ status: "downloaded" }) });
      }
    } catch (error) { console.error(error); }
  };

  const download = async (format: "docx" | "pdf", version?: number) => {
    if (!paid) { alert("Primero debes completar el pago para descargar el documento."); return; }
    await markDownloaded();
    const suffix = version ? `?version=${encodeURIComponent(String(version))}` : "";
    const supabase = getSupabaseBrowser();
    const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } } as any;
    const headers: Record<string,string> = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : guestHeaders;
    const downloadId = resolvedDocumentId || latest?.id || instance.id;
    const response = await fetch(`/api/documents/${downloadId}/download${format === "pdf" ? "/pdf" : ""}${suffix}`, { headers });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      alert(body.error === "Payment required" ? "Primero debes completar el pago para descargar el documento." : "La descarga todavía no está habilitada.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `tramiteya-${params.slug}.${format}`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  };

  const downloadButtonClass = (format: "word" | "pdf") => paid ? `px-4 py-3 rounded-lg ${format === "pdf" ? "bg-emerald-600 text-white" : "bg-slate-900 text-white"} font-medium hover:opacity-90` : "px-4 py-3 rounded-lg bg-slate-200 text-slate-400 font-medium cursor-not-allowed";

  return <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">
    <Header />
    <section className="max-w-5xl mx-auto px-4 py-12">
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div><p className={`text-sm font-semibold ${paid ? "text-emerald-600" : "text-amber-600"}`}>DOCUMENTO • {paid ? "PAGO CONFIRMADO" : "PENDIENTE DE PAGO"}</p><h1 className="text-2xl font-bold mt-1">Revisa tu documento</h1><p className="text-sm text-slate-500 mt-1">Versión {latest?.version ?? latest?.meta?.version ?? 1} · generado {latest?.generatedAt ? new Date(latest.generatedAt).toLocaleString("es-CO") : "ahora"}</p></div>
          <button onClick={edit} className="px-4 py-2 rounded-lg border font-medium">Editar respuestas</button>
        </div>
        <div className="mt-6 flex gap-2 border-b"><button onClick={() => setTab("preview")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "preview" ? "border-emerald-600 text-emerald-600" : "border-transparent text-slate-500"}`}>Vista previa</button><button onClick={() => setTab("history")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "history" ? "border-emerald-600 text-emerald-600" : "border-transparent text-slate-500"}`}>Historial ({docs.length})</button></div>

        {tab === "preview" ? <div className="mt-6"><div className="relative">
          <DocumentBody content={latest?.content || "El contenido del documento no está disponible todavía."} paid={paid} />
          {!paid && latest?.content && <div className="absolute left-1/2 top-[62%] z-20 w-[min(92%,460px)] -translate-x-1/2 -translate-y-1/2"><div className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-2xl backdrop-blur-md ring-1 ring-black/5">
            <div className="text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-xl">🔒</div><h2 className="text-xl font-extrabold text-slate-950">Desbloquea tu Derecho de Petición listo para radicar</h2><div className="mt-3 text-3xl font-black text-slate-950">$49.900 <span className="text-sm font-bold text-slate-500">COP</span></div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pago único</p></div>
            <ul className="mt-5 space-y-2 text-sm text-slate-700"><li>✓ Descarga inmediata en Word/PDF</li><li>✓ Jurisprudencia aplicada a tu comparendo</li><li>✓ Guía de radicación en la secretaría de tránsito</li></ul>
            <TrustBadges /><div className="mt-5"><WompiCheckout procedureId={instance.procedureId || instance.procedureSlug || params.slug} instanceId={instance.id} documentVersionId={resolvedDocumentId || latest?.id || undefined} onPending={() => undefined} /></div>
          </div></div>}
        </div></div> : <div className="mt-6 space-y-3">{docs.map((doc: any, i: number) => <div key={doc.id || i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border rounded-xl p-4"><div><div className="font-semibold">Versión {doc.version ?? doc.meta?.version ?? i + 1}</div><div className="text-xs text-slate-500">{doc.generatedAt ? new Date(doc.generatedAt).toLocaleString("es-CO") : doc.createdAt}</div></div><div className="flex gap-2"><button disabled={!paid} onClick={() => download("docx", Number(doc.version ?? doc.meta?.version ?? i + 1))} className={paid ? "px-3 py-2 rounded-lg border text-sm font-medium" : "px-3 py-2 rounded-lg bg-slate-100 text-slate-400 text-sm font-medium cursor-not-allowed"}>Word</button><button disabled={!paid} onClick={() => download("pdf", Number(doc.version ?? doc.meta?.version ?? i + 1))} className={paid ? "px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium" : "px-3 py-2 rounded-lg bg-slate-100 text-slate-400 text-sm font-medium cursor-not-allowed"}>PDF</button></div></div>)}</div>}

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3"><button disabled={!paid} onClick={() => download("docx")} className={downloadButtonClass("word")}>Descargar Word (.docx)</button><button disabled={!paid} onClick={() => download("pdf")} className={downloadButtonClass("pdf")}>Descargar PDF</button></div>
        <div className="mt-3"><button onClick={() => router.push("/dashboard")} className="w-full px-4 py-3 rounded-lg border font-medium">Volver a mis trámites</button></div>
        <p className="mt-5 text-xs text-slate-400">Revisa el contenido y sus fundamentos antes de presentarlo ante la autoridad competente.</p>
      </div>
    </section>
    {!paid && <TestimonialsSlider />}<Footer />
  </main>;
}
