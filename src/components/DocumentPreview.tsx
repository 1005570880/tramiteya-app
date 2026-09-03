"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Download, FileText, Scale, ShieldCheck, X } from "lucide-react";
import WompiCheckout, { CheckoutData } from "./WompiCheckout";

const WOMPI_PRICE_LABEL = "$49.900 COP";
const WOMPI_REFERENCE_PRICE_LABEL = "$180.000 COP";
const WOMPI_WIDGET_SRC = "https://checkout.wompi.co/widget.js";

function cleanDisplayText(value: string) {
  return String(value || "").replace(/\r\n?/g, "\n").replace(/^\s*#{1,6}\s*/gm, "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/__(.*?)__/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/^\s*[-•]\s+/gm, "").replace(/^\s*\d+[.)]\s+/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}
function isProtectionStart(line: string) { return /^\s*(?:III\.?\s+HECHOS\s+Y\s+ANTECEDENTES|Yo,\s+)/i.test(line.trim()); }
function lineClass(line: string) {
  const text = line.trim();
  if (/^(SEÑORES|ASUNTO:|PETICIONARIO:|REFERENCIA:)/i.test(text)) return "font-bold text-slate-950";
  if (/^(?:[IVX]+)\.?\s+/.test(text)) return "font-bold text-slate-950 tracking-[0.02em]";
  if (/^4\.[1-4]\./.test(text)) return "font-semibold text-slate-950";
  if (/^(PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|SÉPTIMO|OCTAVO|NOVENO|DÉCIMO):/i.test(text)) return "font-semibold text-slate-950";
  return "";
}

export default function DocumentPreview({ content, procedureId, instanceId, initiallyUnlocked = false }: { content: string; procedureId: string; instanceId?: string; initiallyUnlocked?: boolean; }) {
  const [unlocked, setUnlocked] = useState(initiallyUnlocked);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [wompiConfig, setWompiConfig] = useState<CheckoutData | null>(null);
  const [downloadLoading, setDownloadLoading] = useState<"pdf" | "docx" | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document !== "undefined" && !document.querySelector(`script[src="${WOMPI_WIDGET_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = WOMPI_WIDGET_SRC;
      script.async = true;
      script.setAttribute("data-tramiteya-wompi-preload", "true");
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (initiallyUnlocked || !instanceId) return;
    const paidVersion = localStorage.getItem(`tramiteya:paid-document:${instanceId}`);
    if (paidVersion) setUnlocked(true);
  }, [initiallyUnlocked, instanceId]);

  useEffect(() => {
    let cancelled = false;
    async function preGenerateCheckout() {
      if (!procedureId || (!instanceId && !content)) return;
      try {
        const response = await fetch("/api/payments/wompi", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-guest-access-token": instanceId || "" },
          body: JSON.stringify({ procedureId, instanceId: instanceId || undefined, amountInCents: 4990000, currency: "COP" }),
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as CheckoutData;
        if (!cancelled) setWompiConfig(data);
      } catch (error) {
        console.warn("TRAMITEYA_WOMPI_PREFETCH_ERROR", error);
      }
    }
    preGenerateCheckout();
    return () => { cancelled = true; };
  }, [procedureId, instanceId, content]);

  const sections = useMemo(() => {
    const lines = cleanDisplayText(content).split("\n");
    const index = lines.findIndex(isProtectionStart);
    if (index < 0) return { visible: lines, protected: [] as string[] };
    return { visible: lines.slice(0, index), protected: lines.slice(index) };
  }, [content]);

  async function download(format: "pdf" | "docx") {
    if (!unlocked || !procedureId) return;
    setDownloadLoading(format);
    setDownloadError(null);
    try {
      const response = await fetch("/api/documents/download", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(instanceId ? { "x-guest-access-token": instanceId } : {}) },
        body: JSON.stringify({ format, content: cleanDisplayText(content), procedureId, instanceId: instanceId || undefined, documentVersionId: wompiConfig?.documentVersionId || undefined, title: "TramiteYa - Derecho de Petición" }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "No fue posible descargar el documento.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = format === "pdf" ? "TramiteYa-Derecho-de-Peticion.pdf" : "TramiteYa-Derecho-de-Peticion.docx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "No fue posible descargar el documento.");
    } finally {
      setDownloadLoading(null);
    }
  }

  return <div className="relative">
    <div className="whitespace-pre-wrap p-8 font-sans leading-relaxed text-slate-900">{sections.visible.map((line, index) => <div key={index} className={`whitespace-pre-wrap min-h-[1.5rem] ${lineClass(line)}`}>{line || "\u00a0"}</div>)}</div>
    {sections.protected.length > 0 && <div className="relative mt-6">
      <div className={unlocked ? "pointer-events-auto select-text" : "pointer-events-none select-none"}><div className={unlocked ? "" : "blur-[12px] opacity-80"}>{sections.protected.map((line, index) => <div key={index} className={`whitespace-pre-wrap min-h-[1.5rem] ${lineClass(line)}`}>{line || "\u00a0"}</div>)}</div></div>
      {!unlocked && <div className="absolute inset-0 flex items-center justify-center p-4"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-6 text-center shadow-2xl backdrop-blur-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg"><Scale className="h-7 w-7" /></div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">Documento protegido</p>
        <h3 className="mt-2 text-xl font-bold text-slate-900">Desbloquea tu escrito jurídico completo</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">Valor de referencia <span className="line-through">{WOMPI_REFERENCE_PRICE_LABEL}</span> → <strong>{WOMPI_PRICE_LABEL}</strong> con TrámiteYa.</p>
        <div className="mt-5"><WompiCheckout procedureId={procedureId} instanceId={instanceId} prefetchedConfig={wompiConfig} content={cleanDisplayText(content)} onPending={() => setCheckoutOpen(true)} /></div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-slate-500"><span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Pago seguro con Wompi</span><span className="rounded-full bg-slate-100 px-3 py-1">Sin registro</span></div>
      </div></div>}
    </div>}
    {unlocked && <div className="mx-8 mb-6 space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><ShieldCheck className="h-5 w-5" />Documento desbloqueado: lectura y descarga disponibles.</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => download("pdf")} disabled={Boolean(downloadLoading)} className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-extrabold text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"><Download className="h-5 w-5" />{downloadLoading === "pdf" ? "Generando PDF…" : "Descargar PDF"}</button>
        <button type="button" onClick={() => download("docx")} disabled={Boolean(downloadLoading)} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-extrabold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"><FileText className="h-5 w-5" />{downloadLoading === "docx" ? "Generando Word…" : "Descargar Word (.DOCX)"}</button>
      </div>
      {downloadError && <p className="text-center text-xs font-semibold text-red-600">{downloadError}</p>}
    </div>}
    {checkoutOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"><div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
      <button type="button" aria-label="Cerrar" onClick={() => setCheckoutOpen(false)} className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
      <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white"><FileText className="h-5 w-5" /></div><div><h2 className="text-lg font-bold text-slate-900">Completa tu pago</h2><p className="text-sm text-slate-500">Documento jurídico completo · {WOMPI_PRICE_LABEL}</p></div></div>
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-center"><span className="text-xs font-semibold text-slate-400 line-through">{WOMPI_REFERENCE_PRICE_LABEL}</span><span className="mx-2 text-slate-300">→</span><strong className="text-xl text-slate-900">{WOMPI_PRICE_LABEL}</strong></div>
      <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />Sin crear cuenta ni iniciar sesión</div><div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />Acceso inmediato al documento completo</div><div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />PDF y Word (.DOCX) disponibles después del pago</div></div>
      <div className="mt-5"><WompiCheckout procedureId={procedureId} instanceId={instanceId} prefetchedConfig={wompiConfig} content={cleanDisplayText(content)} onPending={() => undefined} /></div>
      <p className="mt-3 text-center text-[11px] text-slate-400">Checkout oficial de Wompi · {WOMPI_PRICE_LABEL} · sin registro.</p>
    </div></div>}
  </div>;
}
