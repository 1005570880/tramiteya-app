'use client';

import React from 'react';

type DocumentBlurPreviewProps = {
  documentText?: string;
  organismo?: string;
  onUnlock?: () => void;
};

const FALLBACK_DOCUMENT = `SEÑORES
SECRETARÍA DE TRÁNSITO Y TRANSPORTE DE SAMPUÉS – DEPARTAMENTO DE SUCRE
E. S. D.

ASUNTO: DERECHO DE PETICIÓN – SOLICITUD DE REVISIÓN INTEGRAL DE ACTUACIÓN DE TRÁNSITO, DEBIDO PROCESO, NOTIFICACIÓN, EJECUTORIA Y EVENTUAL COBRO COACTIVO
PETICIONARIO: JACOB ELÍAS ARRIETA FLÓREZ
C.C.: 1.067.934.306
REFERENCIA: Actuación / comparendo No. 70670001000056030485
FECHA DEL HECHO: 23 de junio de 2026
INFRACCIÓN: C29
VALOR REPORTADO: $633.111 COP

Yo, JACOB ELÍAS ARRIETA FLÓREZ, mayor de edad, identificado con cédula de ciudadanía No. 1.067.934.306, actuando en nombre propio, presento respetuosamente este derecho de petición.

I. HECHOS

PRIMERO. En el Estado de Cuenta SIMIT consultado y aportado con la presente petición figura registrada la actuación No. 70670001000056030485.

SEGUNDO. La referida actuación aparece asociada a mi documento de identidad.

TERCERO. El valor actualmente reportado corresponde a $633.111 COP.

CUARTO. El registro consultado identifica la infracción con el código C29.

QUINTO. El Estado de Cuenta SIMIT no permite establecer por sí solo la totalidad de las actuaciones administrativas adelantadas.

LÍNEA CRONOLÓGICA

23/06/2026 → Fecha del hecho reportado → Registro SIMIT → Verificación de citación, actuación, notificación, decisión y ejecutoria pendiente de acreditación.

II. CONSIDERACIONES JURÍDICAS DEL CASO CONCRETO

El registro de una obligación en el SIMIT no permite establecer por sí solo la regularidad integral del procedimiento administrativo.`;

function cleanText(text: string) {
  return text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/```/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

function getPreviewParts(text: string) {
  const cleaned = cleanText(text);
  const lines = cleaned.split('\n');
  const sectionIndex = lines.findIndex((line) => /^II\.\s+/i.test(line.trim()));

  // La frontera jurídica es preferente: el contenido visible termina antes de II.
  // Si el documento no trae esa sección, usamos aproximadamente el 34% del texto.
  if (sectionIndex > 0) {
    return {
      visible: lines.slice(0, sectionIndex).join('\n').trim(),
      locked: lines.slice(sectionIndex).join('\n').trim(),
    };
  }

  const cutoff = Math.min(lines.length - 1, Math.max(8, Math.floor(lines.length * 0.34)));
  return {
    visible: lines.slice(0, cutoff).join('\n').trim(),
    locked: lines.slice(cutoff).join('\n').trim(),
  };
}

function DocumentText({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).filter(Boolean);

  return (
    <div className="text-[12pt] leading-[1.15] text-[#111827] [font-family:'Arial_Narrow',Arial,Helvetica,sans-serif]">
      {blocks.map((block, index) => {
        const normalized = block.trim();
        const isHeading = /^(I\.|II\.|III\.|IV\.|V\.|VI\.|LÍNEA CRONOLÓGICA|ASUNTO:|PETICIONARIO:|C\.C\.:|REFERENCIA:|FECHA DEL HECHO:|INFRACCIÓN:|VALOR REPORTADO:)/i.test(normalized);
        const isOrdinal = /^(PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|SÉPTIMO|OCTAVO|NOVENO|DÉCIMO|DÉCIMA)/i.test(normalized);

        return (
          <p
            key={`${index}-${normalized.slice(0, 30)}`}
            className={`${isHeading ? 'font-bold' : ''} ${isOrdinal ? 'text-justify' : 'text-justify'} mb-3 whitespace-pre-line last:mb-0`}
          >
            {normalized}
          </p>
        );
      })}
    </div>
  );
}

export default function DocumentBlurPreview({ documentText, organismo, onUnlock }: DocumentBlurPreviewProps) {
  const text = documentText?.trim() || FALLBACK_DOCUMENT;
  const { visible, locked } = getPreviewParts(text);
  const destino = organismo?.trim() || 'el organismo de tránsito competente';

  return (
    <section aria-labelledby="document-preview-title" className="w-full">
      <div className="mx-auto mb-8 max-w-3xl text-center text-white">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-300">Vista previa del documento</p>
        <h2 id="document-preview-title" className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Lee tu escrito antes de desbloquearlo.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300">Consulta el inicio de tu escrito completamente nítido. El análisis jurídico y las pretensiones quedan protegidos hasta completar el desbloqueo.</p>
      </div>

      <div className="relative mx-auto max-w-[820px] overflow-hidden rounded-[2px] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] ring-1 ring-slate-200">
        <div className="px-9 py-10 sm:px-14 sm:py-14 lg:px-20 lg:py-16">
          <DocumentText text={visible} />

          <div className="relative mt-8 min-h-[820px] overflow-hidden border-t border-slate-100 pt-8">
            <div
              aria-hidden="true"
              className="pointer-events-none select-none blur-[5px]"
            >
              <DocumentText text={locked || visible} />
            </div>

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_0%,rgba(255,255,255,0.95)_40%,#ffffff_100%)]"
            />

            <div className="absolute inset-x-4 top-1/2 z-10 -translate-y-1/2 sm:inset-x-10">
              <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white/95 p-6 text-center shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-md sm:p-8">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-xl text-indigo-700" aria-hidden="true">🔒</div>
                <h3 className="mt-4 text-lg font-black leading-tight text-slate-950 sm:text-xl">Tu Derecho de Petición personalizado para {destino} está listo.</h3>
                <p className="mt-3 text-sm leading-6 text-slate-500">Incluye fundamentación jurídica, análisis del caso concreto y pretensiones procesales redactadas en primera persona.</p>
                <button
                  type="button"
                  onClick={onUnlock}
                  className="mt-5 w-full rounded-2xl bg-indigo-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:-translate-y-0.5 hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200"
                >
                  Desbloquear y descargar documento completo ($49.900 COP)
                </button>
                <p className="mt-3 text-[11px] font-semibold text-slate-400">Word (.docx) + PDF · Documento editable</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
