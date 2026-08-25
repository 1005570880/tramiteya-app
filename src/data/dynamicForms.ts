import { getFormDefinition, type FormDefinition } from './forms';
import { trafficSpecialForms } from './trafficProcedures';
import { laborClaimForm } from './lineForms';
import { getProcedureModule } from '../lib/genericProcedureEngine';
import '../data/procedureModules';

const titles: Record<string, string> = {
  'prescripcion-comparendo': 'Solicitud de prescripción de comparendo / obligación de tránsito',
  'caducidad-comparendo': 'Solicitud de caducidad de actuación de tránsito',
  'revocatoria-comparendo': 'Solicitud de revocatoria / corrección de actuación de tránsito',
  'solicitud-soportes-comparendo': 'Solicitud de información y soportes de comparendo',
  fotomultas: 'Solicitud relacionada con fotodetección / fotomulta',
  'reclamacion-laboral': 'Reclamación laboral',
  'peticion-salud': 'Derecho de petición en salud',
  'tutela-salud': 'Acción de tutela por salud',
  'negativa-medicamentos': 'Negativa de medicamentos',
  'negativa-procedimiento': 'Negativa de procedimiento o servicio',
  'habeas-data-reporte': 'Hábeas data financiero',
  'caducidad-datacredito': 'Revisión de permanencia de reporte crediticio',
  'rectificacion-reporte-crediticio': 'Rectificación de reporte crediticio',
  'contrato-de-arrendamiento': 'Contrato de arrendamiento comercial',
  'contrato-prestacion-servicios': 'Contrato de prestación de servicios',
  'contrato-compraventa': 'Contrato de compraventa',
};

export function getDynamicFormDefinition(slug: string): FormDefinition | undefined {
  const base = getFormDefinition(slug);
  if (base) return base;
  const traffic = trafficSpecialForms[slug];
  if (traffic) return { procedureSlug: slug, title: titles[slug] ?? slug, steps: traffic };
  if (slug === 'reclamacion-laboral') return { procedureSlug: slug, title: titles[slug], steps: laborClaimForm };

  const module = getProcedureModule(slug);
  if (!module) return undefined;
  return {
    procedureSlug: slug,
    title: titles[slug] ?? module.title,
    steps: module.steps.map((step) => ({
      id: step.id,
      title: step.title,
      description: step.description,
      fields: step.fields.map((field) => ({
        id: field.id,
        label: field.label,
        type: field.type,
        required: field.required,
        placeholder: field.placeholder,
        options: field.options,
        condition: field.condition ? { questionId: field.condition.field, operator: field.condition.operator as 'equals' | 'notEquals' | 'contains', value: String(field.condition.value ?? '') } : undefined,
      })),
    })),
  };
}
