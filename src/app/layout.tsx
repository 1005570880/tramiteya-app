import React from 'react';

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
      <body>{children}</body>
    </html>
  );
}
