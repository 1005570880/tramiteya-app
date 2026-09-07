"use client";
import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabaseBrowserClient';

export type CheckoutData = { publicKey: string; currency: 'COP'; amountInCents: number; reference: string; integrity: string; price: number; documentVersionId: string; instanceId?: string; accessToken?: string };
declare global { interface Window { WidgetCheckout?: new (config: any) => { open: (callback?: (result: any) => void) => void }; } }

export default function WompiCheckout({ procedureId, documentVersionId, instanceId, prefetchedConfig, onPending, content }: { procedureId: string; documentVersionId?: string; instanceId?: string; prefetchedConfig?: CheckoutData | null; onPending?: () => void; content?: string }) {
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const lookup = instanceId || documentVersionId || '';
  useEffect(() => { if (document.getElementById('wompi-widget-script')) return; const script = document.createElement('script'); script.id = 'wompi-widget-script'; script.src = 'https://checkout.wompi.co/widget.js'; script.async = true; document.body.appendChild(script); }, []);

  async function getAuthHeaders(extra: Record<string, string> = {}) {
    const supabase = getSupabaseBrowser();
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) return { ...extra, Authorization: `Bearer ${session.access_token}` };
    }
    return { ...extra, 'x-guest-access-token': instanceId || documentVersionId || '' };
  }

  async function waitForApproval(resolvedDocumentId: string): Promise<boolean> {
    for (let i = 0; i < 30; i += 1) {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/payments?procedureId=${encodeURIComponent(procedureId)}&instanceId=${encodeURIComponent(instanceId || '')}&documentVersionId=${encodeURIComponent(resolvedDocumentId)}`, { cache: 'no-store', headers });
      if (response.ok) { const data = await response.json(); if (data.approved) return true; }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return false;
  }

  async function downloadPaidFile(resolvedDocumentId: string, format: 'pdf' | 'docx') {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/documents/${encodeURIComponent(resolvedDocumentId)}/download${format === 'pdf' ? '/pdf' : ''}`, { cache: 'no-store', headers });
    if (!response.ok) throw new Error(`No fue posible descargar el archivo ${format.toUpperCase()}.`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tramiteya-${procedureId}.${format}`;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function downloadPaidDocuments(resolvedDocumentId: string) {
    try {
      // The first download starts as soon as Wompi/server confirmation succeeds.
      await downloadPaidFile(resolvedDocumentId, 'pdf');
      // Stagger the second download so Chromium/WebKit can process the first one.
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await downloadPaidFile(resolvedDocumentId, 'docx');
      return true;
    } catch (downloadError) {
      console.warn('TRAMITEYA_PAID_DOCUMENT_DOWNLOAD_ERROR', downloadError);
      return false;
    }
  }

  async function sendPaidDocuments(resolvedDocumentId: string) {
    if (!content) return;
    try {
      const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
      const response = await fetch('/api/payments/email', { method: 'POST', headers, body: JSON.stringify({ procedureId, instanceId: instanceId || undefined, documentVersionId: resolvedDocumentId, content }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No fue posible enviar los documentos por correo.');
      setEmailStatus(`Documentos enviados a ${data.email}.`);
    } catch (emailError) {
      console.warn('TRAMITEYA_PAID_DOCUMENT_EMAIL_ERROR', emailError);
      setEmailStatus('Pago aprobado. No pudimos enviar el correo automáticamente; la descarga sigue disponible.');
    }
  }

  async function openCheckout() {
    setLoading(true); setError(null); setEmailStatus(null); onPending?.();
    try {
      let data = prefetchedConfig;
      const authHeaders = await getAuthHeaders({ 'Content-Type': 'application/json' });
      if (!data) {
        const response = await fetch('/api/payments/wompi', { method: 'POST', headers: authHeaders, body: JSON.stringify({ procedureId, instanceId: instanceId || undefined, documentVersionId: instanceId ? undefined : documentVersionId, amountInCents: 4990000, currency: 'COP' }) });
        data = await response.json();
        if (!response.ok) throw new Error((data as any).error || 'No fue posible preparar el pago.');
      }
      if (!data) throw new Error('No fue posible preparar el pago.');
      let attempts = 0;
      while (!window.WidgetCheckout && attempts < 30) { await new Promise((resolve) => setTimeout(resolve, 200)); attempts += 1; }
      if (!window.WidgetCheckout) throw new Error('No se pudo cargar el checkout de Wompi.');
      const checkout = new window.WidgetCheckout({ currency: 'COP', amountInCents: 4990000, reference: data.reference, publicKey: data.publicKey, signature: { integrity: data.integrity } });
      checkout.open(async (result: any) => {
        const status = String(result?.transaction?.status || '').toUpperCase();
        if (status === 'APPROVED') {
          const approved = await waitForApproval(data!.documentVersionId);
          if (approved) {
            if (instanceId) localStorage.setItem(`tramiteya:paid-document:${instanceId}`, data!.documentVersionId);
            const downloadsOk = await downloadPaidDocuments(data!.documentVersionId);
            await sendPaidDocuments(data!.documentVersionId);
            if (!downloadsOk) setError('Pago aprobado. El documento quedó desbloqueado; si el navegador bloqueó las descargas automáticas, usa los botones PDF y Word de la página.');
            window.setTimeout(() => window.location.reload(), 250);
          } else setError('El pago fue aprobado, pero estamos esperando la confirmación del servidor. Actualiza esta página en unos segundos.');
        } else if (status === 'DECLINED' || status === 'ERROR' || status === 'VOIDED') setError('El pago no fue aprobado. Puedes intentarlo nuevamente.');
      });
    } catch (e) { setError(e instanceof Error ? e.message : 'No fue posible iniciar el pago.'); } finally { setLoading(false); }
  }

  return <div className="space-y-2"><button type="button" onClick={openCheckout} disabled={loading || !lookup} className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-4 text-lg font-extrabold text-white shadow-lg shadow-emerald-200 transition-all hover:from-emerald-600 hover:to-green-700 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 animate-pulse hover:animate-none">{loading ? 'Abriendo checkout…' : '🔓 DESBLOQUEAR Y DESCARGAR DOCUMENTO ($49.900 COP)'}</button>{error && <p className="text-xs text-red-600">{error}</p>}{emailStatus && <p className="text-xs font-semibold text-emerald-700">{emailStatus}</p>}<p className="text-[11px] text-slate-400 text-center">Pago seguro procesado por Wompi. No necesitas crear una cuenta.</p></div>;
}
