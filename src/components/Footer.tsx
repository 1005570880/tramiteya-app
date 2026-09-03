import React from "react";

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-200 py-8">
      <div className="max-w-6xl mx-auto px-4 text-sm text-slate-500 flex flex-col sm:flex-row justify-between">
        <div>© 2026 TrámiteYa. Todos los derechos reservados.</div>
        <div className="mt-3 sm:mt-0">Soporte: <a href="mailto:arrietabogado@gmail.com" className="text-blue-600 hover:underline font-medium">arrietabogado@gmail.com</a></div>
      </div>
    </footer>
  );
}
