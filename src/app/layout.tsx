import './globals.css';
import React from 'react';
import TramiWidget from '../components/TramiWidget';

export const metadata = {
  title: 'TrámiteYa — Automatización Jurídica en Colombia',
  description: 'Plataforma para la generación automática de trámites y documentos jurídicos.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen flex flex-col">
        <main className="flex-1">
          {children}
        </main>
        <footer className="w-full py-6 border-t border-gray-200 text-center text-xs text-gray-500 space-y-2">
          <p>© 2026 TrámiteYa. Todos los derechos reservados.</p>
          <p>
            Soporte y contacto:{' '}
            <a href="mailto:arrietabogado@gmail.com" className="text-blue-600 hover:underline font-medium">
              arrietabogado@gmail.com
            </a>
          </p>
        </footer>
        <TramiWidget />
      </body>
    </html>
  );
}
