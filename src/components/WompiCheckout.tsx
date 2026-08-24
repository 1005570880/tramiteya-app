"use client";

import { useEffect, useState } from 'react';

type CheckoutData = { publicKey: string; currency: 'COP'; amountInCents: number; reference: string; integrity: string; price: number; documentVersionId: string; guestAccessToken?: string | null };
declare global { interface Window { WidgetCheckout?: new (config: any) => { open: (callback?: (result: any) => void) => void }; } }

const guestTokenKey = (documentVersionId: string) => `tramiteya:guest-payment:${documentVersionId}`;

export default function WompiCheckout({ procedureId, documentVersionId, onPending }: { procedureId: string; documentVersionId: string; onPending?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestMode, setGuestMode] = useState(false);

  useEffect(() => {
    if (!document.getElementById('wompi-widget-script')) {
      const script = document.createElement('script');
      script.id = 'wompi-widget-script';
      script.src = 'https://checkout.wompi.co/widget.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabaseModule = await import('../lib/supabaseBrowserClient');
        const supabase = supabaseModule.getSupabaseBrowser();
        const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } } as any;
        if (active) {
          setAuthenticated(Boolean(session?.user));
          setGuestMode(!session?.user);
        }
      } catch { if (active) { setAuthenticated(false); setGuestMode(true); } }
    })();
    return () => { active = false; };
  }, []);

  async function waitForApproval(accessToken?: string, attempts = 20): Promise<boolean> {
    for (let i = 0; i < attempts; i += 1) {
      const params = new URLSearchParams({ procedureId, documentVersionId });
      if (accessToken) params.set('guestAccessToken', accessToken);
      const headers: Record<string, string> = {};
      const supabaseModule = await import('../lib/supabaseBrowserClient');
      const supabase = supabaseModule.getSupabaseBrowser();
      const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } } as any;
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const response = await fetch(`/api/payments?${params.toString()}`, { headers, cache: 'no-store' });
      if (response.ok && (await response.json()).approved) return true;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return false;
  }

  async function openCheckout() {
    setLoading(true); setError(null); onPending?.();
    try {
      const supabaseModule = await import('../lib/supabaseBrowserClient');
      const supabase = supabaseModule.getSupabaseBrowser();
      const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } } as any;
      const storedGuestToken = !session?.user ? window.localStorage.getItem(guestTokenKey(documentVersionId)) || '' : '';
      const response = await fetch('/api/payments/wompi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ procedureId, documentVersionId, guestAccessToken: storedGuestToken || undefined, guestEmail: guestEmail || undefined }),
      });
      const data: CheckoutData = await response.json();
      if (!response.ok) throw new Error((data as any).error || 'No fue posible preparar el pago.');
      if (!session?.user && data.guestAccessToken) window.localStorage.setItem(guestTokenKey(documentVersionId), data.guestAccessToken);

      let attempts = 0;
      while (!window.WidgetCheckout && attempts < 30) { await new Promise((resolve) => setTimeout(resolve, 200)); attempts += 1; }
      if (!window.WidgetCheckout) throw new Error('No se pudo cargar el checkout de Wompi.');

      const checkout = new window.WidgetCheckout({ currency: data.currency, amountInCents: data.amountInCents, reference: data.reference, publicKey: data.publicKey, signature: { integrity: data.integrity } });
      checkout.open(async (result: any) => {
        const status = String(result?.transaction?.status || '').toUpperCase();
        if (status === 'APPROVED') {
          const approved = await waitForApproval(session?.user ? undefined : (data.guestAccessToken || storedGuestToken));
          if (approved) window.location.reload();
          else setError('El pago fue aprobado, pero estamos esperando la confirmación del servidor. Actualiza esta página en unos segundos.');
        } else if (status === 'DECLINED' || status === 'ERROR' || status === 'VOIDED') setError('El pago no fue aprobado. Puedes intentarlo nuevamente.');
      });
    } catch (e) { setError(e instanceof Error ? e.message : 'No fue posible iniciar el pago.'); }
    finally { setLoading(false); }
  }

  const canPay = authenticated !== null;
  return <div className="space-y-2">
    {guestMode && <div><label className="block text-xs font-medium text-slate-600 mb-1">Correo para enviarte el comprobante (opcional)</label><input value={guestEmail} onChange={e => setGuestEmail(e.target.value)} type="email" placeholder="tu@email.com" className="w-full border rounded-lg px-3 py-2 text-sm" /></div>}
    <button type="button" onClick={openCheckout} disabled={loading || !canPay} className="w-full px-4 py-3 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-60">{loading ? 'Preparando pago…' : 'Pagar y desbloquear documento'}</button>
    {error && <p className="text-xs text-red-600">{error}</p>}
    <p className="text-[11px] text-slate-400 text-center">No necesitas crear una cuenta. Pago seguro procesado por Wompi.</p>
  </div>;
}
