"use client";

import React from "react";
import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-sm font-black tracking-tight text-white shadow-sm">TY</div>
          <div>
            <div className="text-base font-black tracking-tight text-slate-950">TrámiteYa</div>
            <div className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 sm:block">Legal automation</div>
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-6">
          <Link href="/tramites" className="text-sm font-semibold text-slate-600 transition hover:text-slate-950">Trámites</Link>
          <Link href="/dashboard" className="hidden text-sm font-semibold text-slate-600 transition hover:text-slate-950 sm:block">Dashboard</Link>
          <Link href="/tramites" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800">Empezar</Link>
        </nav>
      </div>
    </header>
  );
}
