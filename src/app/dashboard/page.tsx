import React from "react";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import DashboardClient from "../../components/DashboardClient";

export default function Dashboard() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Header />

      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold">Bienvenido de nuevo</h1>
            <p className="text-sm text-slate-500 mt-1">Aquí verás tus trámites y actividad reciente.</p>
          </div>
        </div>

        <div className="mt-8">
          <DashboardClient />
        </div>
      </section>

      <Footer />
    </main>
  );
}
