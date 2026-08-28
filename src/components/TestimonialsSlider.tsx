"use client";

import React from "react";

const testimonials = [
  {
    name: "Carlos Restrepo",
    city: "Medellín",
    text: "Iba a pagarle $250.000 a un tramitador por una fotomulta vieja. Con TrámiteYa por $49.900 descargué el escrito y, según su experiencia, en 15 días me depuraron el SIMIT.",
  },
  {
    name: "Andrea Gómez",
    city: "Bogotá",
    text: "Super fácil. Subí mi PDF, Dr. Trámi analizó la prescripción y el derecho de petición salió impecable. La Secretaría de Tránsito respondió a los 10 días.",
  },
  {
    name: "Jesús David Arrieta",
    city: "Montería",
    text: "Pensé que era demasiado barato por $49.900, pero el documento quedó estructurado y con los fundamentos jurídicos del trámite. Excelente experiencia.",
  },
  {
    name: "Mariana Silva",
    city: "Cali",
    text: "Tenía un comparendo del 2021 que estaba afectando el traspaso de mi carro. Generé la solicitud y evité pagarle cientos de miles de pesos a un intermediario.",
  },
  {
    name: "Andrés Martínez",
    city: "Barranquilla",
    text: "Me gustó poder revisar el documento antes de pagar y descargarlo. El flujo es claro y no tuve que llenar un formulario interminable.",
  },
];

function Stars() {
  return <span aria-label="5 de 5 estrellas" className="tracking-[0.18em] text-amber-400">★★★★★</span>;
}

function Card({ item }: { item: (typeof testimonials)[number] }) {
  return (
    <article className="w-[320px] shrink-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_40px_-20px_rgba(15,23,42,0.28)] sm:w-[360px]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-extrabold text-slate-950">{item.name}</p>
          <p className="text-xs font-semibold text-slate-400">{item.city}</p>
        </div>
        <Stars />
      </div>
      <p className="mt-5 text-sm leading-6 text-slate-600">“{item.text}”</p>
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
        <span className="font-bold text-slate-400">Experiencia de referencia</span>
        <span className="font-black text-indigo-600">$49.900 COP</span>
      </div>
    </article>
  );
}

export default function TestimonialsSlider() {
  const loop = [...testimonials, ...testimonials];

  return (
    <section aria-label="Experiencias destacadas" className="overflow-hidden bg-slate-50 py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-indigo-600">Confianza antes de decidir</p>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Menos intermediarios.<br />Más control sobre tu trámite.</h2>
          <p className="mt-5 text-base leading-7 text-slate-500">Experiencias de referencia para mostrar cómo se vive el flujo de TrámiteYa. Los resultados de cada caso dependen de la información y de la actuación de la autoridad competente.</p>
        </div>
      </div>

      <div className="relative mt-10 w-full">
        <div className="testimonial-marquee flex w-max gap-5 px-5 hover:[animation-play-state:paused]">
          {loop.map((item, index) => <Card key={`${item.name}-${index}`} item={item} />)}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-slate-50 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-slate-50 to-transparent" />
      </div>
    </section>
  );
}
