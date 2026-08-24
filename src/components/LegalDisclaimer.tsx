import React from 'react';

export default function LegalDisclaimer() {
  return (
    <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-slate-700">
      <p className="font-semibold text-slate-900">Aviso importante</p>
      <p className="mt-2">
        TrámiteYa es una plataforma tecnológica de automatización y generación de documentos jurídicos a partir de la información suministrada por el usuario. El documento generado es una herramienta documental y no implica, por sí mismo, asesoría jurídica personalizada, representación judicial o administrativa, ni la existencia de una relación abogado-cliente entre el usuario y TrámiteYa.
      </p>
      <p className="mt-2">
        La información jurídica incorporada corresponde a referencias aplicables al momento de generación y debe ser revisada antes de su presentación. El usuario es responsable de verificar la exactitud, integridad y veracidad de la información suministrada y de los documentos que presente ante las autoridades. La generación del documento no garantiza una decisión favorable por parte de la autoridad competente.
      </p>
      <p className="mt-2">
        La utilización de TrámiteYa no constituye por sí misma la contratación de servicios profesionales de Arrieta &amp; Asociados Abogados ni genera una relación abogado-cliente con dicha firma.
      </p>
    </section>
  );
}
