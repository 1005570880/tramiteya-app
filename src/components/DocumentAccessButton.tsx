"use client";

import React, { useState } from "react";
import { getSupabaseBrowser } from "../lib/supabaseBrowserClient";

function formatCop(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

export default function DocumentAccessButton({
  instanceId,
  procedureId,
  documentVersionId,
  price,
}: {
  instanceId: string;
  procedureId: string;
  documentVersionId?: string | null;
  price: number;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleAccess() {
    setLoading(true);
    setMessage(null);
    try {
      const supabase = getSupabaseBrowser();
      if (!supabase) throw new Error("La autenticación no está disponible.");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Inicia sesión para continuar.");

      const idempotencyKey = `checkout-${instanceId}-${documentVersionId || "latest"}`;
      const checkout = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ procedureId, documentVersionId: documentVersionId || null, idempotencyKey }),
      });
      const checkoutPayload = await checkout.json();
      if (!checkout.ok) throw new Error(checkoutPayload.error || "No fue posible procesar el pago.");

      const approved = await fetch(`/api/payments?procedureId=${encodeURIComponent(procedureId)}${documentVersionId ? `&documentVersionId=${encodeURIComponent(documentVersionId)}` : ""}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const paymentPayload = await approved.json();
      if (!approved.ok || !paymentPayload.approved) throw new Error("El pago todavía no está aprobado.");

      const download = await fetch(`/api/documents/${encodeURIComponent(instanceId)}/download${documentVersionId ? `?version=${encodeURIComponent(documentVersionId)}` : ""}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!download.ok) {
        const payload = await download.json().catch(() => ({}));
        throw new Error(payload.error === "Payment required" ? "El pago aún no habilita la descarga." : (payload.error || "No fue posible generar el documento."));
      }

      const blob = await download.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `tramiteya-${procedureId}.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage(`Pago aprobado · ${formatCop(price)} · descarga iniciada.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible completar la operación.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleAccess}
        disabled={loading}
        className="px-3 py-2 rounded-md bg-emerald-600 text-white font-semibold disabled:opacity-60"
      >
        {loading ? "Procesando…" : `Pagar y descargar · ${formatCop(price)}`}
      </button>
      {message && <span className="text-xs text-slate-600">{message}</span>}
    </div>
  );
}
