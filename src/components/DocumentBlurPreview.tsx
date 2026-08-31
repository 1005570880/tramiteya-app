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

function cleanText(text: string): string {
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
  const sectionIndex = lines.findIndex((line) => /^I\.\s+HECHOS\s*$/i.test(line.trim()));

  if (sectionIndex >= 0) {
    const factStart = sectionIndex + 1;
    let factCount = 0;
    let cutoff = factStart;

    for (let i = factStart; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (/^(PRIMERO|SEGUNDO)\.?\s+/i.test(line)) {
        factCount += 1;
        cutoff = i + 1;
        if (factCount === 2) break;
      }
    }

    if (factCount > 0) {
      return {
        visible: lines.slice(0, cutoff).join('\n').trim(),
        locked: lines.slice(cutoff).join('\n').trim(),
      };
    }
  }

  const cutoff = Math.min(lines.length - 1, Math.max(8, Math.floor(lines.length * 0.2)));
  return {
    visible: lines.slice(0, cutoff).join('\n').trim(),
    locked: lines.slice(cutoff).join('\n').trim(),
  };
}

function DocumentText({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).filter(Boolean);

  return (
    <div
      style={{
        fontFamily: '"Arial Narrow", Arial, Helvetica, sans-serif',
        fontSize: '12pt',
        lineHeight: '1.15',
        color: '#111827',
        textAlign: 'justify',
      }}
    >
      {blocks.map((block, index) => {
        const normalized = block.trim();
        const isHeading = /^(I\.|II\.|III\.|IV\.|V\.|VI\.|LÍNEA CRONOLÓGICA|ASUNTO:|PETICIONARIO:|C\.C\.:|REFERENCIA:|FECHA DEL HECHO:|INFRACCIÓN:|VALOR REPORTADO:)/i.test(normalized);

        return (
          <p
            key={`${index}-${normalized.slice(0, 30)}`}
            style={{
              margin: '0 0 0.75rem 0',
              fontWeight: isHeading ? 700 : 400,
              textAlign: 'justify',
              whiteSpace: 'pre-line',
            }}
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
    <section aria-labelledby="document-preview-title" style={{ width: '100%' }}>
      <div style={{ maxWidth: '48rem', margin: '0 auto 2rem', textAlign: 'center', color: '#ffffff' }}>
        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#a5b4fc' }}>
          Vista previa del documento
        </p>
        <h2 id="document-preview-title" style={{ margin: '0.5rem 0 0', fontSize: 'clamp(1.875rem, 4vw, 2.25rem)', lineHeight: 1.1, fontWeight: 900, color: '#ffffff' }}>
          Lee tu escrito antes de desbloquearlo.
        </h2>
        <p style={{ maxWidth: '42rem', margin: '0.75rem auto 0', fontSize: '0.875rem', lineHeight: 1.5, color: '#cbd5e1' }}>
          Consulta el inicio de tu escrito completamente nítido. El análisis jurídico y las pretensiones quedan protegidos hasta completar el desbloqueo.
        </p>
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '820px',
          margin: '0 auto',
          overflow: 'hidden',
          borderRadius: '2px',
          border: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ padding: '2.5rem', backgroundColor: '#ffffff' }}>
          <DocumentText text={visible} />

          <div style={{ position: 'relative', marginTop: '2rem', minHeight: '820px', overflow: 'hidden', borderTop: '1px solid #f1f5f9', paddingTop: '2rem' }}>
            <div
              aria-hidden="true"
              style={{
                filter: 'blur(6px)',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            >
              <DocumentText text={locked || visible} />
            </div>

            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '82%',
                background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.85) 15%, rgba(255,255,255,0.98) 35%, #ffffff 100%)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                pointerEvents: 'none',
                zIndex: 20,
              }}
            />

            <div
              style={{
                position: 'absolute',
                left: '1rem',
                right: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 30,
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: '28rem',
                  margin: '0 auto',
                  boxSizing: 'border-box',
                  border: '1px solid #e5e7eb',
                  borderRadius: '1rem',
                  backgroundColor: 'rgba(255,255,255,0.97)',
                  padding: '1.5rem',
                  textAlign: 'center',
                  boxShadow: '0 20px 60px rgba(15,23,42,0.18)',
                }}
              >
                <div style={{ width: '3rem', height: '3rem', margin: '0 auto 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0.75rem', backgroundColor: '#eef2ff', fontSize: '1.25rem' }} aria-hidden="true">
                  🔒
                </div>
                <h3 style={{ margin: 0, fontSize: '1.125rem', lineHeight: 1.25, fontWeight: 700, color: '#111827' }}>
                  Tu Derecho de Petición personalizado para {destino} está listo.
                </h3>
                <p style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', lineHeight: 1.5, color: '#4b5563' }}>
                  Incluye fundamentación en Sentencia C-038/20, Ley 1066/06, Art. 818 E.T. y pretensiones procesales redactadas en primera persona.
                </p>
                <button
                  type="button"
                  onClick={onUnlock}
                  style={{
                    width: '100%',
                    marginTop: '1.25rem',
                    border: 0,
                    borderRadius: '0.75rem',
                    backgroundColor: '#2563eb',
                    padding: '0.75rem 1rem',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                  }}
                >
                  Desbloquear y descargar documento completo ($49.900 COP)
                </button>
                <p style={{ margin: '0.75rem 0 0', fontSize: '0.6875rem', fontWeight: 600, color: '#9ca3af' }}>
                  Word (.docx) + PDF · Documento editable
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
