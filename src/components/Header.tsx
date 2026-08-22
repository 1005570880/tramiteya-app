"use client";

import React from "react";
import Link from "next/link";

export default function Header() {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-700 rounded-md flex items-center justify-center text-white font-bold">TY</div>
            <div className="hidden sm:block">
              <div className="font-black text-lg text-slate-900">TrámiteYa</div>
              <div className="text-xs text-slate-500">Automatización jurídica</div>
            </div>
          </Link>
        </div>

        <nav className="flex items-center gap-4">
          <Link href="/tramites" className="text-slate-700 hover:text-slate-900">Trámites</Link>
          <Link href="/dashboard" className="text-slate-700 hover:text-slate-900">Dashboard</Link>
          <Link href="/tramites" className="hidden sm:inline-block bg-blue-600 text-white px-4 py-2 rounded-md font-semibold">Iniciar mi trámite</Link>
        </nav>
      </div>
    </header>
  );
}
