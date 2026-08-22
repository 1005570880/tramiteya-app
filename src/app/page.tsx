import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { procedures } from '../data/procedures';
import ProcedureCard from '../components/ProcedureCard';
import Link from 'next/link';

export default function Home() {
  const featured = procedures.filter((p) => p.available).slice(0, 3);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Header />

      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4 grid gap-8 grid-cols-1 lg:grid-cols-2 items-center">
          <div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight">TrámiteYa — Automatiza tus trámites jurídicos en minutos</h1>
            <p className="mt-4 text-slate-600 max-w-xl">Genera solicitudes, derechos de petición y documentos legales con un flujo guiado, claro y adaptado a Colombia. Ahorra tiempo y reduce errores formales.</p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link href="/tramites" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-semibold">Iniciar mi trámite</Link>
              <Link href="/tramites" className="inline-block text-blue-600 px-6 py-3 rounded-md border border-blue-100">Ver trámites disponibles</Link>
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg border">
                <div className="text-sm font-semibold text-slate-700">Tiempo estimado</div>
                <div className="mt-1 text-lg font-bold">15-30 minutos</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border">
                <div className="text-sm font-semibold text-slate-700">Documentos</div>
                <div className="mt-1 text-lg font-bold">Plantillas profesionales</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border">
                <div className="text-sm font-semibold text-slate-700">Control</div>
                <div className="mt-1 text-lg font-bold">Revisión antes de presentar</div>
              </div>
            </div>
          </div>

          <div>
            <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl p-6 shadow-lg">
              <h3 className="text-lg font-bold">¿Qué trámite necesitas?</h3>
              <p className="text-sm text-slate-500 mt-2">Selecciona una categoría y comienza con un formulario guiado.</p>

              <div className="mt-4 grid gap-4">
                {featured.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-white p-3 rounded-lg border">
                    <div>
                      <div className="text-sm font-semibold">{p.title}</div>
                      <div className="text-xs text-slate-400">{p.category} • {p.estimatedTime}</div>
                    </div>
                    <Link href={`/tramites/${p.slug}`} className="px-3 py-2 bg-blue-600 text-white rounded-md">Iniciar</Link>
                  </div>
                ))}
              </div>

              <div className="mt-6 text-sm text-slate-500">¿No encuentras tu trámite? Escríbenos y te ayudamos a ubicarlo.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold">Cómo funciona</h2>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-4 bg-white rounded-lg border">
            <div className="font-semibold">1. Selecciona</div>
            <div className="text-sm text-slate-500 mt-2">Elige el trámite que necesitas.</div>
          </div>
          <div className="p-4 bg-white rounded-lg border">
            <div className="font-semibold">2. Completa</div>
            <div className="text-sm text-slate-500 mt-2">Responde a preguntas claras y simples.</div>
          </div>
          <div className="p-4 bg-white rounded-lg border">
            <div className="font-semibold">3. Revisa y descarga</div>
            <div className="text-sm text-slate-500 mt-2">Revisa el resultado y, una vez confirmado el pago, descarga tu documento en Word o PDF.</div>
          </div>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold">Trámites destacados</h2>
          <div className="mt-6 grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => (
              <ProcedureCard key={p.id} procedure={p} />
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold">Preguntas frecuentes</h2>
        <div className="mt-4 grid gap-4">
          <details className="bg-white p-4 rounded-lg border">
            <summary className="font-semibold">¿TrámiteYa garantiza el resultado del trámite?</summary>
            <div className="mt-2 text-sm text-slate-600">No. TrámiteYa facilita la elaboración del documento a partir de la información suministrada por el usuario. La decisión de la autoridad competente y el resultado del trámite no dependen de la plataforma.</div>
          </details>

          <details className="bg-white p-4 rounded-lg border">
            <summary className="font-semibold">¿Los documentos tienen validez legal automáticamente?</summary>
            <div className="mt-2 text-sm text-slate-600">La plataforma genera documentos jurídicos en formatos editables y descargables. Su eficacia depende del contenido, la información suministrada, los requisitos aplicables y, cuando corresponda, la firma, radicación o presentación ante la autoridad competente.</div>
          </details>

          <details className="bg-white p-4 rounded-lg border">
            <summary className="font-semibold">¿Puedo revisar el documento antes de descargarlo?</summary>
            <div className="mt-2 text-sm text-slate-600">Sí. Puedes revisar la vista previa, editar tus respuestas y consultar las versiones generadas antes de descargar el documento final.</div>
          </details>

          <details className="bg-white p-4 rounded-lg border">
            <summary className="font-semibold">¿TrámiteYa presenta el documento por mí?</summary>
            <div className="mt-2 text-sm text-slate-600">No en esta versión. La plataforma genera el documento para que el usuario lo revise y lo presente por el canal correspondiente.</div>
          </details>
        </div>
      </section>

      <section className="border-t bg-slate-100 py-6">
        <div className="max-w-6xl mx-auto px-4 text-xs leading-5 text-slate-500">
          TrámiteYa es una herramienta tecnológica de automatización documental. La generación de un documento no constituye por sí misma asesoría jurídica personalizada ni garantiza el resultado de un procedimiento administrativo, judicial o extrajudicial. El usuario es responsable de verificar la información suministrada y de cumplir los requisitos y términos aplicables.
        </div>
      </section>

      <Footer />
    </main>
  );
}
