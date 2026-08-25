import type { TransitPrescriptionAnalysis } from './transitPrescription';
import type { QualityLevel } from './legalQualityGate';

export const TRAFFIC_LEGAL_SOURCES = {
  statute159: 'Artículo 159 de la Ley 769 de 2002, modificado por el artículo 206 del Decreto Ley 019 de 2012',
  law1066: 'Artículo 5 de la Ley 1066 de 2006',
  et818: 'Artículo 818 del Estatuto Tributario',
  cpaca91: 'Artículo 91 numeral 3 de la Ley 1437 de 2011 (CPACA)',
  jurisprudence: 'Consejo de Estado, Sección Primera, sentencia de 11 de febrero de 2016, Rad. 11001-03-15-000-2015-03248-00(AC), C.P. Roberto Augusto Serrato Valdés',
} as const;

export type TrafficDoctrineContext = {
  qualityLevel: QualityLevel;
  analysis: TransitPrescriptionAnalysis;
  comparendoNumber: string;
};

function paragraphForPrescription(context: TrafficDoctrineContext): string {
  const { analysis, comparendoNumber, qualityLevel } = context;

  if (analysis.basisDate === 'none') {
    return `Respecto del comparendo ${comparendoNumber}, no existe en la información suministrada una fecha verificable de ocurrencia de la infracción. Por esa razón TrámiteYa no afirma que la obligación se encuentre prescrita. El artículo 159 de la Ley 769 de 2002 establece un término especial de tres (3) años para la prescripción de las sanciones por infracciones de tránsito, contado desde la ocurrencia del hecho, y dispone que la prescripción debe ser declarada de oficio y que se interrumpe con la notificación del mandamiento de pago. La determinación concreta exige confrontar el expediente administrativo, la ejecutoria del acto sancionatorio y las constancias de notificación.`;
  }

  if (analysis.meetsThreeYearThreshold && analysis.threeYearDate) {
    if (analysis.basisDate === 'violationDate') {
      const qualification = qualityLevel === 'green'
        ? 'La información disponible permite estructurar una solicitud jurídicamente sustentada, sin perjuicio de la verificación documental por la autoridad.'
        : 'El dato temporal es favorable, pero la conclusión definitiva depende de verificar el expediente y las actuaciones que hayan podido interrumpir o afectar el término.';
      return `En relación con el comparendo ${comparendoNumber}, la fecha de ocurrencia informada permite advertir que el término inicial de tres (3) años previsto por el artículo 159 de la Ley 769 de 2002 habría transcurrido, pues su vencimiento preliminar se ubica en ${analysis.threeYearDate}. ${qualification} La autoridad debe establecer, con soporte documental, si antes del vencimiento se notificó válidamente un mandamiento de pago. Si no existió esa actuación interruptiva dentro del término, la acción de cobro no puede mantenerse indefinidamente por el solo transcurso de actuaciones posteriores.`;
    }

    return `Respecto del comparendo ${comparendoNumber}, el término temporal actualmente identificado supera tres (3) años. No obstante, la fecha utilizada no sustituye la fecha de ocurrencia del hecho ni acredita por sí sola la prescripción especial del artículo 159 de la Ley 769 de 2002. Por ello se solicita que la autoridad confronte el expediente y determine la fecha exacta de ocurrencia, la ejecutoria y la notificación del mandamiento de pago.`;
  }

  return `Respecto del comparendo ${comparendoNumber}, con la fecha actualmente disponible no se acredita todavía el vencimiento del término inicial de tres (3) años previsto por el artículo 159 de la Ley 769 de 2002. El documento no formula una conclusión artificial de prescripción: solicita la verificación integral del expediente y de las actuaciones que determinen el término aplicable.`;
}

export function buildTrafficPrescriptionDoctrine(context: TrafficDoctrineContext): string[] {
  const { analysis, comparendoNumber } = context;

  const general = `La presente solicitud se fundamenta en el régimen especial de cobro de las sanciones de tránsito. El artículo 159 de la Ley 769 de 2002, en la redacción vigente dada por el artículo 206 del Decreto Ley 019 de 2012, atribuye a las autoridades de tránsito jurisdicción coactiva para el cobro de las sanciones y establece la prescripción en tres (3) años contados a partir de la ocurrencia del hecho, disponiendo además que la prescripción sea declarada de oficio y que se interrumpa con la notificación del mandamiento de pago. Esta regla especial debe leerse conjuntamente con el artículo 5 de la Ley 1066 de 2006, que ordena aplicar el procedimiento del Estatuto Tributario a las entidades públicas investidas de jurisdicción coactiva en lo no regulado especialmente.`;

  const interruption = `Una vez notificado el mandamiento de pago dentro del término jurídicamente relevante, el artículo 818 del Estatuto Tributario regula la interrupción de la prescripción y establece que, producida la interrupción por la notificación del mandamiento, el término vuelve a correr desde el día siguiente a dicha notificación, en los términos allí previstos. En consecuencia, TrámiteYa no equipara la fecha de expedición del mandamiento con su notificación: para el análisis de la prescripción debe acreditarse la notificación efectiva y su fecha. Esta distinción es determinante porque un mandamiento no notificado oportunamente no puede ser tratado automáticamente como una actuación interruptiva eficaz.`;

  const jurisprudence = `La Sección Primera del Consejo de Estado, en sentencia de 11 de febrero de 2016, Rad. 11001-03-15-000-2015-03248-00(AC), explicó la lectura armónica del artículo 159 de la Ley 769 de 2002 con la Ley 1066 de 2006 y el artículo 818 del Estatuto Tributario: las autoridades de tránsito, al ejercer cobro coactivo, deben acudir al Estatuto Tributario en lo no regulado por el Código Nacional de Tránsito, y el término interrumpido por la notificación del mandamiento vuelve a correr desde el día siguiente a dicha notificación. La misma providencia analizó la obligación de declarar de oficio la prescripción cuando se configuran sus presupuestos. Esta providencia es una sentencia de la Sección Primera y se cita como precedente relevante; TrámiteYa no la presenta como una sentencia de unificación cuando no existe base suficiente para calificarla así.`;

  const executory = `De manera alternativa, y sin confundirla con la prescripción de la acción de cobro, debe examinarse la pérdida de ejecutoriedad prevista en el artículo 91 de la Ley 1437 de 2011 (CPACA). La causal temporal pertinente es la del numeral 3, no la del numeral 5: el acto administrativo en firme pierde obligatoriedad cuando, al cabo de cinco (5) años de estar en firme, la autoridad no ha realizado los actos que le correspondan para ejecutarlo. El numeral 5 se refiere a la pérdida de vigencia del acto. Por ello, para invocar técnicamente la causal del numeral 3 deben verificarse la fecha de firmeza y las actuaciones materiales o jurídicas de ejecución realizadas por la administración.`;

  const application = paragraphForPrescription(context);

  const petition = analysis.meetsThreeYearThreshold
    ? `Para el comparendo ${comparendoNumber}, se solicita que la autoridad determine expresamente: (i) fecha de ocurrencia del hecho; (ii) fecha de ejecutoria del acto sancionatorio; (iii) fecha de expedición del mandamiento de pago; (iv) fecha y mecanismo de su notificación; (v) actuaciones posteriores que hayan tenido aptitud jurídica para afectar el término; y (vi) existencia de pago, acuerdo de pago, facilidad de pago o cualquier otra actuación relevante. Si del expediente se acredita la configuración de la prescripción, deberá declararse de oficio y cesar el cobro en los términos legalmente procedentes.`
    : `Para el comparendo ${comparendoNumber}, se solicita que la autoridad certifique las fechas y actuaciones necesarias para establecer el cómputo del término, especialmente la ocurrencia del hecho, la ejecutoria del acto sancionatorio y la eventual notificación del mandamiento de pago.`;

  return [general, interruption, jurisprudence, executory, application, petition];
}
