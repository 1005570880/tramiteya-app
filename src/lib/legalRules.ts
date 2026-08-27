import type { FormAnswers } from '../types/form';

export type LegalRule = { id: string; label: string; description: string; applies: (answers: FormAnswers) => boolean; instruction: string };
export type TrafficDecision = { id: string; label: string; level: 'favorable' | 'possible' | 'insufficient'; reason: string; nextStep: string; legalBasis: string[] };

const getDate = (a: FormAnswers, k: string) => {
  const value = a[k];
  if (!value) return null;
  const raw = String(value).trim();
  const normalized = /^\d{2}[/-]\d{2}[/-]\d{4}$/.test(raw)
    ? raw.split(/[/-]/).reverse().join('-')
    : raw;
  const d = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const ageYears = (a: FormAnswers, k: string) => {
  const d = getDate(a, k);
  return d ? (Date.now() - d.getTime()) / (365.2425 * 24 * 60 * 60 * 1000) : null;
};

const text = (a: FormAnswers, ...keys: string[]) => keys.map(k => String(a[k] ?? '')).join(' ').toLowerCase();
const cause = (a: FormAnswers) => text(a, 'causal_principal', 'causal', 'hechos', 'solicitud', 'pretension');

export const trafficRules: LegalRule[] = [
  { id: 'prescripcion', label: 'Prescripción', description: 'Revisión del término y de eventuales actuaciones de cobro.', applies: a => cause(a).includes('prescrip'), instruction: 'Verificar fecha del hecho, mandamiento de pago, notificación y actuaciones de cobro.' },
  { id: 'caducidad', label: 'Caducidad', description: 'Revisión del término para decidir la imposición de la sanción.', applies: a => cause(a).includes('caduc'), instruction: 'Verificar fecha del hecho, audiencia, decisión y régimen temporal aplicable.' },
  { id: 'perdida_ejecutoriedad', label: 'Pérdida de fuerza ejecutoria', description: 'Revisión del término de ejecutoriedad y de las actuaciones realizadas para ejecutar el acto.', applies: a => cause(a).includes('ejecutoriedad') || cause(a).includes('ejecutoria'), instruction: 'Verificar firmeza del acto, fecha relevante y todas las actuaciones de ejecución posteriores.' },
  { id: 'fotomulta', label: 'Fotodetección', description: 'Revisión reforzada de evidencia, identificación y notificación.', applies: a => /foto|fotomult|detecci[oó]n/.test(cause(a)), instruction: 'Solicitar evidencia, identificación, notificación y trazabilidad.' },
  { id: 'impugnacion', label: 'Impugnación / defensa', description: 'Revisión de contradicción y oportunidad de defensa.', applies: a => /impugn|inconform|defensa|descargo/.test(cause(a)), instruction: 'Verificar estado, audiencia, decisión, recursos y términos.' },
  { id: 'revocatoria', label: 'Revocatoria / corrección', description: 'Revisión de errores o inconsistencias y de la vía procedente.', applies: a => /revoc|correc|error|inconsistencia|placa|identificaci[oó]n/.test(cause(a)), instruction: 'Contrastar el acto con documentos oficiales y determinar la vía jurídica.' },
  { id: 'eliminacion', label: 'Eliminación / retiro', description: 'Revisión de procedencia de retirar o corregir una anotación.', applies: a => /elimin|retir|borrar|cancel/.test(cause(a)), instruction: 'Identificar el fundamento y la autoridad competente para modificar el registro.' },
  { id: 'notificacion', label: 'Notificación y debido proceso', description: 'Revisión de constancias de notificación y defensa.', applies: a => /notific|nunca me notific|no fui notificado/.test(cause(a)), instruction: 'Solicitar constancias completas de envío, entrega o notificación.' },
  { id: 'soportes', label: 'Solicitud de soportes', description: 'Pedir copia de los documentos que sustentan la actuación.', applies: () => true, instruction: 'Solicitar expediente, comparendo, evidencia, notificaciones, actos y soportes.' },
];

export function getApplicableTrafficRules(answers: FormAnswers) { return trafficRules.filter(r => r.applies(answers)); }

export function evaluateTrafficCase(a: FormAnswers): TrafficDecision[] {
  const out: TrafficDecision[] = [];
  const age = ageYears(a, 'fecha_comparendo');
  const mandAge = ageYears(a, 'fecha_mandamiento_pago');
  const audiencia = getDate(a, 'fecha_audiencia');
  const c = cause(a);

  if (c.includes('prescrip')) {
    if (mandAge !== null) out.push({ id: 'prescripcion', label: 'Prescripción: requiere verificación del cobro', level: 'possible', reason: 'Existe fecha de mandamiento de pago; deben verificarse su notificación y los efectos jurídicos sobre el término.', nextStep: 'Solicitar mandamiento de pago, constancia de notificación y actuaciones de cobro.', legalBasis: ['Ley 769 de 2002, art. 159'] });
    else if (age !== null && age >= 3) out.push({ id: 'prescripcion', label: 'Prescripción: indicio favorable', level: 'favorable', reason: 'Han transcurrido al menos tres años desde la fecha indicada y no se informó mandamiento de pago.', nextStep: 'Solicitar declaración de prescripción y expediente de cobro para verificación.', legalBasis: ['Ley 769 de 2002, art. 159'] });
    else out.push({ id: 'prescripcion', label: 'Prescripción: información insuficiente', level: 'insufficient', reason: 'Faltan datos sobre el término completo o actuaciones de cobro.', nextStep: 'Obtener expediente y constancias de cobro antes de afirmar la prescripción.', legalBasis: ['Ley 769 de 2002, art. 159'] });
  }

  if (c.includes('caduc')) {
    if (audiencia) out.push({ id: 'caducidad', label: 'Caducidad: verificar audiencia/decisión', level: 'possible', reason: 'Existe fecha de audiencia; debe compararse con el hecho y régimen temporal aplicable.', nextStep: 'Solicitar acta, decisión sancionatoria y recursos.', legalBasis: ['Ley 769 de 2002, art. 161'] });
    else if (age !== null && age >= 1) out.push({ id: 'caducidad', label: 'Caducidad: indicio favorable', level: 'favorable', reason: 'Ha transcurrido al menos un año desde el hecho y no se informó audiencia efectiva.', nextStep: 'Solicitar expediente y verificar si la decisión se adoptó dentro del término legal.', legalBasis: ['Ley 769 de 2002, art. 161'] });
    else out.push({ id: 'caducidad', label: 'Caducidad: información insuficiente', level: 'insufficient', reason: 'Faltan fechas relevantes o no ha transcurrido el término indicativo.', nextStep: 'Completar fechas y obtener expediente.', legalBasis: ['Ley 769 de 2002, art. 161'] });
  }

  if (c.includes('ejecutoriedad') || c.includes('ejecutoria') || mandAge !== null) {
    if (mandAge !== null && mandAge >= 5) out.push({ id: 'perdida_ejecutoriedad', label: 'Pérdida de fuerza ejecutoria: indicio favorable', level: 'favorable', reason: 'La fecha reportada del mandamiento de pago supera cinco años; debe verificarse la firmeza del acto y si existieron actuaciones de ejecución dentro del término relevante.', nextStep: 'Solicitar acto en firme, constancia de ejecutoria e historial completo de actuaciones de cobro posteriores.', legalBasis: ['Ley 1437 de 2011, art. 91', 'Ley 1437 de 2011, art. 92'] });
    else if (c.includes('ejecutoriedad') || c.includes('ejecutoria')) out.push({ id: 'perdida_ejecutoriedad', label: 'Pérdida de fuerza ejecutoria: requiere verificación', level: 'insufficient', reason: 'La hipótesis requiere establecer la firmeza del acto y las actuaciones realizadas para ejecutarlo.', nextStep: 'Obtener acto en firme, constancia de ejecutoria y trazabilidad del cobro.', legalBasis: ['Ley 1437 de 2011, art. 91', 'Ley 1437 de 2011, art. 92'] });
  }

  if (/foto|fotomult|detecci[oó]n/.test(c)) out.push({ id: 'fotomulta', label: 'Fotodetección: revisión reforzada', level: 'possible', reason: 'La procedencia depende del expediente, evidencia, identificación y notificación; no se presume responsabilidad solo por la imagen.', nextStep: 'Solicitar evidencia, constancias de notificación, acto sancionatorio y trazabilidad.', legalBasis: ['Ley 1843 de 2017', 'Ley 769 de 2002'] });
  if (/impugn|inconform|defensa|descargo/.test(c)) out.push({ id: 'impugnacion', label: 'Impugnación: revisar oportunidad y estado', level: 'possible', reason: 'La defensa depende del estado procesal y términos aplicables.', nextStep: 'Identificar audiencia, decisión o recurso pendiente y verificar términos.', legalBasis: ['Constitución Política, art. 29', 'Ley 769 de 2002'] });
  if (/revoc|correc|error|inconsistencia|placa|identificaci[oó]n/.test(c)) out.push({ id: 'revocatoria', label: 'Revocatoria/corrección: verificar vía', level: 'possible', reason: 'Un error no determina por sí solo la procedencia de una revocatoria; debe identificarse el acto y la vía.', nextStep: 'Obtener acto, registro y documentos que acrediten la inconsistencia.', legalBasis: ['Ley 1437 de 2011', 'Ley 769 de 2002'] });
  if (/elimin|retir|borrar|cancel/.test(c)) out.push({ id: 'eliminacion', label: 'Eliminación/retiro: requiere fundamento', level: 'possible', reason: 'La modificación del registro exige identificar la actuación y autoridad competente.', nextStep: 'Solicitar historial del registro y fundamento para corrección o retiro.', legalBasis: ['Ley 769 de 2002', 'Ley 1437 de 2011'] });
  if (/notific|nunca me notific|no fui notificado/.test(c)) out.push({ id: 'notificacion', label: 'Notificación: revisar expediente', level: 'possible', reason: 'Una irregularidad puede afectar la defensa, pero debe acreditarse documentalmente.', nextStep: 'Obtener constancias completas de notificación y trazabilidad.', legalBasis: ['Constitución Política, art. 29', 'Ley 769 de 2002'] });
  return out;
}
