import React from 'react';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-blue-900 text-white py-6 px-4 shadow-lg">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black tracking-wider">TrámiteYa</h1>
          <span className="text-xs bg-blue-800 text-blue-200 px-3 py-1 rounded-full border border-blue-700">
            LegalTech Colombia
          </span>
        </div>
      </header>

      <section className="max-w-4xl mx-auto text-center py-12 px-4">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-blue-950 mb-4">
          Automatización de Trámites y Documentos Jurídicos
        </h2>
        <p className="text-slate-600 text-base sm:text-lg mb-8 max-w-2xl mx-auto">
          Genera contratos, tutelas, derechos de petición y reclamos administrativos con validez legal en Colombia en menos de 2 minutos.
        </p>

        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-200 text-left max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-md uppercase tracking-wide">
              Trámite Comercial
            </span>
            <span className="text-sm font-semibold text-emerald-600">
              Disponible
            </span>
          </div>

          <h3 className="text-xl font-bold text-slate-800 mb-2">
            Contrato de Arrendamiento de Uso Comercial
          </h3>
          <p className="text-slate-500 text-sm mb-6">
            Generación automática parametrizada con cláusulas condicionales de representación, canon, garantías y normatividad comercial vigente.
          </p>

          <button 
            className="block text-center w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition duration-200 shadow-md hover:shadow-lg"
          >
            Iniciar Trámite Ahora
          </button>
        </div>
      </section>

      <footer className="text-center py-6 text-xs text-slate-400 border-t border-slate-200 mt-12">
        © 2026 TrámiteYa. Plataforma de Automatización Jurídica en Colombia.
      </footer>
    </main>
  );
}
