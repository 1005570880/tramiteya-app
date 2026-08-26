import React from "react";
import { procedures } from "../../../data/procedures";
import Header from "../../../components/Header";
import Footer from "../../../components/Footer";
import Link from "next/link";
import SimitUploadFirst from "../../../components/SimitUploadFirst";

// SIMIT: flujo definitivo = Estado de Cuenta PDF primero; la cédula se extrae del documento.
export default function ProcedureDetail({ params }: { params: { slug: string } }) {
  const procedure = procedures.find((p) => p.slug === params.slug);
  if (!procedure) {
    return <main className="min-h-screen bg-slate-50 text-slate-900 font-sans"><Header /><section className="max-w-4xl mx-auto px-4 py-12">No se encontró el trámite.</section><Footer /></main>;
  }

  const isSimitProcedure = procedure.slug === "derecho-de-peticion-eliminar-multa";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Header />
      <section className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white p-6 rounded-2xl shadow">
          <div className="flex items-start justify-between">
            <div><h1 className="text-2xl font-extrabold">{procedure.title}</h1><div className="text-sm text-slate-500 mt-1">{procedure.category} • {procedure.estimatedTime}</div></div>
            <span className={`text-sm px-3 py-1 rounded-full ${procedure.available ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{procedure.available ? 'Disponible' : 'Próximamente'}</span>
          </div>
          <div className="mt-4 text-slate-600">{procedure.description}</div>
          {isSimitProcedure ? <SimitUploadFirst slug={procedure.slug} /> : <>
            <div className="mt-6 grid gap-4">
              <div><h3 className="font-semibold">Para quién sirve</h3><p className="text-sm text-slate-500">Persona natural o jurídica que requiere solicitar información o proteger derechos en procesos administrativos y civiles según el trámite.</p></div>
              <div><h3 className="font-semibold">Información necesaria</h3><ul className="list-disc ml-6 text-sm text-slate-500"><li>Datos del solicitante</li><li>Datos del destinatario</li><li>Descripción de los hechos</li></ul></div>
              <div><h3 className="font-semibold">Documentos necesarios</h3><p className="text-sm text-slate-500">Documentos que acrediten identidad o soporte del caso (si aplica).</p></div>
              <div className="flex items-center gap-3"><Link href={`/tramites/${procedure.slug}/formulario`} className={`px-4 py-2 rounded-md font-semibold ${procedure.available ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600 cursor-not-allowed'}`}>Comenzar</Link><Link href="/tramites" className="text-sm text-slate-500">Volver al catálogo</Link></div>
            </div>
          </>}
        </div>
      </section>
      <Footer />
    </main>
  );
}
