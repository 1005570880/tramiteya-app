import React from "react";

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-200 py-8">
      <div className="max-w-6xl mx-auto px-4 text-sm text-slate-500 flex flex-col sm:flex-row justify-between">
        <div>© {new Date().getFullYear()} TrámiteYa. Todos los derechos reservados.</div>
        <div className="mt-3 sm:mt-0">Contacto: soporte@tramiteya.example</div>
      </div>
    </footer>
  );
}
