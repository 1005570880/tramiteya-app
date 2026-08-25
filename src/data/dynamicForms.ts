import { getFormDefinition, type FormDefinition } from './forms';
import { trafficSpecialForms } from './trafficProcedures';
import { laborClaimForm } from './lineForms';

const titles: Record<string, string> = {
  'prescripcion-comparendo': 'Solicitud de prescripción de comparendo / obligación de tránsito',
  'caducidad-comparendo': 'Solicitud de caducidad de actuación de tránsito',
  'revocatoria-comparendo': 'Solicitud de revocatoria / corrección de actuación de tránsito',
  'solicitud-soportes-comparendo': 'Solicitud de información y soportes de comparendo',
  'fotomultas': 'Solicitud relacionada con fotodetección / fotomulta',
  'derecho-de-peticion-eliminar-multa': 'Derecho de petición para eliminación/revisión de multa',
  'derecho-de-peticion-eliminar-comparendo': 'Derecho de petición para eliminación/corrección de comparendo',
  'impugnacion-comparendos': 'Impugnación de comparendo',
  'reclamacion-laboral': 'Reclamación laboral',
};

export function getDynamicFormDefinition(slug: string): FormDefinition | undefined {
  // Traffic workflows deliberately take precedence over the generic forms.
  // This is what makes the traffic experience SIMIT-first even when a legacy
  // generic definition exists in forms.ts for the same procedure slug.
  const traffic = trafficSpecialForms[slug];
  if (traffic) {
    return {
      procedureSlug: slug,
      title: titles[slug] ?? slug,
      steps: traffic,
    };
  }

  const base = getFormDefinition(slug);
  if (base) return base;
  if (slug === 'reclamacion-laboral') return { procedureSlug: slug, title: titles[slug], steps: laborClaimForm };
  return undefined;
}
