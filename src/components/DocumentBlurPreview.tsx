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

Yo, JACOB ELÍAS ARRIETA FLÓREZ, mayor de edad, identificado con cédula de ciudadanía No. 1.067.934.306, actuando en nombre propio, en ejercicio del derecho fundamental de petición consagrado en el artículo 23 de la Constitución Política y desarrollado por la Ley 1755 de 2015, respetuosamente me permito solicitar la revisión integral de la actuación administrativa de tránsito.

I. HECHOS

PRIMERO. En el Estado de Cuenta SIMIT consultado y aportado con la presente petición figura registrada la actuación No. 70670001000056030485, asociada a la Secretaría de Tránsito y Transporte de Sampués – Departamento de Sucre.

SEGUNDO. La referida actuación aparece asociada a mi documento de identidad No. 1.067.934.306.

TERCERO. El valor actualmente reportado en el Estado de Cuenta SIMIT corresponde a SEISCIENTOS TREINTA Y TRES MIL CIENTO ONCE PESOS ($633.111 COP).

CUARTO. El registro consultado identifica la infracción con el código C29.

QUINTO. El Estado de Cuenta SIMIT constituye una fuente de información sobre el registro de la obligación, pero por sí solo no permite establecer integralmente cuáles fueron las actuaciones administrativas adelantadas.

SEXTO. Tuve conocimiento de la existencia de la referida obligación con ocasión de una notificación relacionada con cobro.

SÉPTIMO. Manifiesto que no fui notificado en debida forma de las actuaciones que hubieren dado lugar a la imposición de la sanción ni tuve conocimiento oportuno de una audiencia.

OCTAVO. No he realizado pagos ni suscrito acuerdos de pago respecto de la obligación.

LÍNEA CRONOLÓGICA

23/06/2026 → Fecha del hecho reportado → Registro SIMIT → Verificación de citación, actuación, notificación, decisión y ejecutoria pendiente de acreditación.

II. CONSIDERACIONES JURÍDICAS DEL CASO CONCRETO

El registro de una obligación en el SIMIT no permite establecer por sí solo la regularidad integral del procedimiento administrativo que dio lugar a su incorporación.`;

function cleanText(text: string) {
  return text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/```/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function getPreviewParts(text: string) {
  const cleaned = cleanText(text);
  const marker = cleaned.search(/(^|\n)(?:II\.|II\s*[-–—]\s*)/m);

  if (marker > 0) {
    return {
      visible: cleaned.slice(0, marker).trim(),
      locked: cleaned.slice(marker).trim(),
    };
  }

  const lines = cleaned.split('\n');
  const cutoff = Math.max(8, Math.floor(lines.length * 0.34));
  return {
    visible: lines.slice(0, cutoff).join('\n').trim(),
    locked: lines.slice(cutoff).join('\n').trim(),
  };
}

function DocumentText({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).filter(Boolean);

  return (
    <div className="space-y-3 text-[12pt] leading-[1.15] text-[#111827] [font-family:Arial_Narrow,Arial,Helvetica,sans-serif]">
      {blocks.map((block, index) => {
        const normalized = block.trim();
        const isHeading = /^(I\.|II\.|III\.|IV\.|V\.|VI\.|LÍNEA CRONOLÓGICA|ASUNTO:|PETICIONARIO:|C\.C\.:|REFERENCIA:|FECHA DEL HECHO:|INFRACCIÓN:|VALOR REPORTADO:)/i.test(normalized);
        const isList = /^(PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|SÉPTIMO|OCTAVO|NOVENO|DÉCIMO|DÉCIMA)/i.test(normalized);

        return (
          <p
            key={`${index}-${normalized.slice(0, 20)}`}
            className={`${isHeading ? 'font-bold' : ''} ${isList ? 'text-justify' : 'text-justify'} whitespace-pre-line`}
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
      <div className="mx-auto mb-7 max-w-3xl text-center text-white">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-300">Vista previa del documento</p>
        <h2 id="document-preview-title" className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Lee tu escrito antes de desbloquearlo.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300">Te mostramos el inicio del documento completamente nítido. La fundamentación jurídica y las pretensiones quedan protegidas hasta completar la compra.</p>
      </div>

      <div className="relative mx-auto max-w-[820px] overflow-hidden rounded-sm bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] ring-1 ring-slate-200">
        <div className="px-9 py-10 sm:px-14 sm:py-14 lg:px-20">
          <div className="max-w-none">
            <DocumentText text={visible} />
          </div>

          <div className="relative mt-8 min-h-[760px] overflow-hidden border-t border-slate-100 pt-8">
            <div aria-hidden="true" className="select-none pointer-events-none [filter:blur(5px)]">
              <DocumentText text={locked || FALLBACK_DOCUMENT} />
            </div>

            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_0%,rgba(255,255,255,0.95)_40%,#ffffff_100%)]" />

            <div className="absolute inset-x-4 top-1/2 z-10 -translate-y-1/2 sm:inset-x-10">
              <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white/95 p-6 text-center shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-md sm:p-8">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-xl text-indigo-700">🔒</div>
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
