import React from "react";

export default function DocumentBlurPreview() {
  return (
    <section aria-labelledby="document-preview-title" className="rounded-[2rem] border border-slate-200 bg-slate-100 p-5 shadow-md sm:p-8">
      <div className="mb-6 text-center">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Vista previa</p>
        <h2 id="document-preview-title" className="mt-2 text-3xl font-black tracking-tight text-slate-950">Mira tu escrito antes de pagar.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">El primer párrafo queda visible para que compruebes la estructura. El contenido restante se desbloquea con la descarga.</p>
      </div>

      <div className="relative mx-auto max-w-3xl overflow-hidden rounded-xl bg-white shadow-[0_18px_50px_-24px_rgba(15,23,42,0.45)] ring-1 ring-slate-200">
        <div className="border-b border-slate-100 px-7 py-5 text-center sm:px-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">DERECHO DE PETICIÓN</p>
          <p className="mt-1 text-sm font-black text-slate-900">SOLICITUD DE REVISIÓN DE ACTUACIÓN DE TRÁNSITO</p>
        </div>
        <div className="px-7 py-8 sm:px-12 sm:py-10">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">ASUNTO: Revisión de situación jurídica</p>
          <p className="mt-6 text-sm leading-7 text-slate-800 sm:text-base">Yo, <strong>Jacob Elias Arrieta Florez</strong>, identificado con cédula de ciudadanía, actuando en nombre propio, presento respetuosamente este derecho de petición, en ejercicio del derecho fundamental consagrado en el artículo 23 de la Constitución Política de Colombia y desarrollado por la Ley 1755 de 2015.</p>

          <div className="relative mt-7 min-h-[250px] overflow-hidden">
            <div className="space-y-4 text-sm leading-7 text-slate-700 blur-[3px] select-none sm:text-base">
              <p>En ejercicio del derecho fundamental de petición, solicito que se revise integralmente la situación jurídica de la actuación administrativa, con base en los datos acreditados, el expediente y las actuaciones que la autoridad debe demostrar documentalmente.</p>
              <p><strong>I. OBJETO</strong></p>
              <p>Solicito que se determine la situación jurídica de la actuación y se verifiquen las actuaciones administrativas, notificaciones, firmeza, cobro y demás elementos relevantes.</p>
              <p><strong>II. HECHOS</strong></p>
              <p>La información disponible será incorporada al escrito y organizada cronológicamente para facilitar su análisis.</p>
              <p><strong>III. FUNDAMENTOS DE DERECHO</strong></p>
              <p>El documento desarrolla los fundamentos normativos pertinentes y las solicitudes que correspondan al caso concreto.</p>
            </div>
            <div className="absolute inset-0 bg-white/25 backdrop-blur-sm" />
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-white via-white/95 to-transparent px-5 pb-6 pt-20">
          <div className="rounded-2xl border border-indigo-100 bg-white px-5 py-4 text-center shadow-xl sm:px-7">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-lg text-indigo-700">🔒</div>
            <p className="mt-2 text-sm font-black text-slate-950">Paga $49.900 COP para desbloquear la descarga</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">PDF y Word · documento editable</p>
          </div>
        </div>
      </div>
    </section>
  );
}
