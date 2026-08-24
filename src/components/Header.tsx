"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "../lib/supabaseBrowserClient";

export default function Header() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setAuthenticated(Boolean(data.session?.user)));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(Boolean(session?.user));
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-10 h-10 bg-blue-700 rounded-md flex items-center justify-center text-white font-bold">TY</div>
          <div className="hidden sm:block"><div className="font-black text-lg text-slate-900">TrámiteYa</div><div className="text-xs text-slate-500">Automatización jurídica</div></div>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4 text-sm sm:text-base">
          <Link href="/tramites" className="text-slate-700 hover:text-slate-900">Trámites</Link>
          {authenticated ? <Link href="/dashboard" className="text-slate-700 hover:text-slate-900">Mis trámites</Link> : <><Link href="/login" className="text-slate-700 hover:text-slate-900">Iniciar sesión</Link><Link href="/registro" className="border border-blue-600 text-blue-700 px-3 py-2 rounded-md font-semibold hover:bg-blue-50">Crear cuenta</Link></>}
          <Link href="/tramites" className="hidden md:inline-block bg-blue-600 text-white px-4 py-2 rounded-md font-semibold">Iniciar mi trámite</Link>
        </nav>
      </div>
    </header>
  );
}
