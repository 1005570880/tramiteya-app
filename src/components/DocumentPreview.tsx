"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, FileText, Loader2, Scale, ShieldCheck, X } from "lucide-react";

declare global { interface Window { WidgetCheckout?: new (config: Record<string, unknown>) => { open: (callback: (result: { transaction?: { status?: string } }) => void) => void; }; } }

const WOMPI_AMOUNT_IN_CENTS = 4_990_000;
const WOMPI_CURRENCY = "COP";
const WOMPI_SCRIPT = "https://checkout.wompi.co/widget.js";

function cleanDisplayText(value: string) { return String(value || "").replace(/\r\n?/g, "\n").replace(/^\s*#{1,6}\s*/gm, "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/__(.*?)__/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/^\s*[-•]\s+/gm, "").replace(/^\s*\d+[.)]\s+/gm, "").replace(/\n{3,}/g, "\n\n").trim(); }
function isFundamentalsStart(line: string) { return /^\s*IV\.?\s+FUNDAMENTOS DE DERECHO\b/i.test(line.trim()); }
function makeReference(instanceId?: string) { const suffix = instanceId || Math.random().toString(36).slice(2, 12); return `TRAMITEYA-${suffix}-${Date.now()}`.replace(/[^A-Za-z0-9-]/g, "").slice(0, 48); }

export default function DocumentPreview({ content, instanceId, initiallyUnlocked = false, onUnlocked }: { content: string; instanceId?: string; initiallyUnlocked?: boolean; onUnlocked?: () => void; }) {
  const [unlocked, setUnlocked] = useState(initiallyUnlocked);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const sections = useMemo(() => { const lines = cleanDisplayText(content).split("\n"); const index = lines.findIndex(isFundamentalsStart); if (index < 0) return { visible: lines, protected: [] as string[] }; return { visible: lines.slice(0, index), protected: lines.slice(index) }; }, [content]);

  useEffect(() => { if (!checkoutOpen) return; const existing = document.querySelector(`script[src="${WOMPI_SCRIPT}"]`); if (existing) return; const script = document.createElement("script"); script.src = WOMPI_SCRIPT; script.async = true; document.body.appendChild(script); }, [checkoutOpen]);

  const startWompi = () => {
    const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;
    if (!publicKey) { setPaymentError("La pasarela de pago aún no está configurada en este entorno."); return; }
    if (!window.WidgetCheckout) { setPaymentError("No fue posible cargar Wompi. Intenta nuevamente en unos segundos."); return; }
    setPaying(true);
    const reference = makeReference(instanceId);
    const checkout = new window.WidgetCheckout({ currency: WOMPI_CURRENCY, amountInCents: WOMPI_AMOUNT_IN_CENTS, reference, publicKey });
    checkout.open((result) => {
      const status = result?.transaction?.status;
      setPaying(false);
      if (status === "APPROVED") { setUnlocked(true); setCheckoutOpen(false); setPaymentError(""); onUnlocked?.(); try { localStorage.setItem(`tramiteya:wompi-approved:${instanceId || reference}`, "true"); } catch {} }
      else if (status) setPaymentError(`La transacción terminó con estado ${status}. Si el pago fue aprobado, actualiza la página para verificarlo.`);
    });
  };

  useEffect(() => { if (!instanceId || initiallyUnlocked) return; try { if (localStorage.getItem(`tramiteya:wompi-approved:${instanceId}`) === "true") { setUnlocked(true); onUnlocked?.(); } } catch {} }, [instanceId, initiallyUnlocked, onUnlocked]);

  return <div className="relative">
    <div className="whitespace-pre-wrap p-8 font-sans leading-relaxed text-slate-900">{sections.visible.map((line, index) => <div key={index} className="whitespace-pre-wrap min-h-[1.5rem]">{line || "\u00a0"}</div>)}</div>
    {sections.protected.length > 0 && <div className="relative mt-6">
      <div className={unlocked ? "" : "pointer-events-none select-none"}><div className={unlocked ? "" : "blur-[12px] opacity-80"}>{sections.protected.map((line, index) => <div key={index} className="whitespace-pre-wrap min-h-[1.5rem]">{line || "\u00a0"}</div>)}</div></div>
      {!unlocked && <div className="absolute inset-0 flex items-center justify-center p-4"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-6 text-center shadow-2xl backdrop-blur-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg"><Scale className="h-7 w-7" /></div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">Documento protegido</p>
        <h3 className="mt-2 text-xl font-bold text-slate-900">Desbloquea tu escrito jurídico completo</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">Accede a los fundamentos jurídicos, peticiones, solicitud de pruebas, anexos y firma final de tu documento.</p>
        <button type="button" onClick={() => { setPaymentError(""); setCheckoutOpen(true); }} className="mt-5 w-full rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2">Desbloquear Documento Completo ($49.900 COP)</button>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-slate-500"><span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Pago seguro con Wompi</span><span className="rounded-full bg-slate-100 px-3 py-1">Sin registro</span></div>
      </div></div>}
    </div>}
    {unlocked && <div className="mx-8 mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><ShieldCheck className="h-5 w-5" />Documento desbloqueado: lectura y descarga en PDF y Word (.DOCX) disponibles.</div>}
    {checkoutOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"><div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
      <button type="button" aria-label="Cerrar" onClick={() => !paying && setCheckoutOpen(false)} className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
      <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white"><FileText className="h-5 w-5" /></div><div><h2 className="text-lg font-bold text-slate-900">Completa tu pago</h2><p className="text-sm text-slate-500">Documento jurídico completo · $49.900 COP</p></div></div>
      <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />Sin crear cuenta ni iniciar sesión</div><div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />Acceso inmediato al documento completo</div><div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />PDF y Word (.DOCX) disponibles después del pago</div></div>
      {paymentError && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{paymentError}</p>}
      <button type="button" disabled={paying} onClick={startWompi} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{paying && <Loader2 className="h-5 w-5 animate-spin" />}{paying ? "Abriendo checkout seguro..." : "Pagar $49.900 COP con Wompi"}</button>
      <p className="mt-3 text-center text-[11px] text-slate-400">Serás dirigido al checkout oficial de Wompi.</p>
    </div></div>}
  </div>;
}
