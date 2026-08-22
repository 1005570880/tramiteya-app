"use client";

import { useEffect, useState } from 'react';

type CheckoutData = { publicKey: string; currency: 'COP'; amountInCents: number; reference: string; integrity: string; price: number; documentVersionId: string };
declare global { interface Window { WidgetCheckout?: new (config: any) => { open: (callback?: (result: any) => void) => void }; } }

export default function WompiCheckout({ procedureId, documentVersionId, onPending }: { procedureId: string; documentVersionId: string; onPending?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (document.getElementById('wompi-widget-script')) return;
    const script = document.createElement('script');
    script.id = 'wompi-widget-script'; script.src = 'https://checkout.wompi.co/widget.js'; script.async = true;
    document.body.appendChild(script);
  }, []);

  async function openCheckout() {
    setLoading(true); setError(null); onPending?.();
    try {
      const supabaseModule = await import('../lib/supabaseBrowserClient');
      const supabase = supabaseModule.getSupabaseBrowser();
      const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } } as any;
      if (!session?.access_token) throw new Error('Inicia sesión para continuar.');
      const response = await fetch('/api/payments/wompi', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ procedureId, documentVersionId }) });
      const data: CheckoutData = await response.json();
      if (!response.ok) throw new Error((data as any).error || 'No fue posible preparar el pago.');

      let attempts = 0;
      while (!window.WidgetCheckout && attempts < 30) { await new Promise(resolve => setTimeout(resolve, 200)); attempts += 1; }
      if (!window.WidgetCheckout) throw new Error('No se pudo cargar el checkout de Wompi.');
      const checkout = new window.WidgetCheckout({ currency: data.currency, amountInCents: data.amountInCents, reference: data.reference, publicKey: data.publicKey, signature: { integrity: data.integrity } });
      checkout.open((result: any) => { if (result?.transaction?.status === 'APPROVED') window.location.reload(); });
    } catch (e) { setError(e instanceof Error ? e.message : 'No fue posible iniciar el pago.'); }
    finally { setLoading(false); }
  }

  return <div className="space-y-2"><button type="button" onClick={openCheckout} disabled={loading} className="w-full px-4 py-3 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-60">{loading ? 'Preparando pago…' : 'Pagar y desbloquear documento'}</button>{error && <p className="text-xs text-red-600">{error}</p>}<p className="text-[11px] text-slate-400 text-center">Pago seguro procesado por Wompi.</p></div>;
}
