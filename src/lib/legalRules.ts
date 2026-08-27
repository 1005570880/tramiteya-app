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
const normalized = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * SIMIT no reemplaza el expediente. Sin embargo, cuando el registro ya
 * contiene señales de multa/sanción/cobro, el motor debe tratarlo como una
 * actuación que superó la etapa inicial del comparendo. En ese escenario no
 * se debe ofrecer caducidad como si todavía estuviera pendiente de decisión.
 */
const recordIsSanctioned = (a: FormAnswers) => {
  const state = normalized(a.estado ?? a.status ?? '');
  const number = String(a.comparendo ?? a.numero_comparendo ?? '').trim().toUpperCase();
  const sanctionId = /-SA(?:$|[-_\s])/i.test(number);
  const sanctionSignals = [
    'multa', 'sancion', 'sancionado', 'pendiente de pago', 'cobro coactivo',
    'cobro', 'mandamiento', 'acuerdo de pago', 'pagada', 'pagado', 'cancelada', 'cancelado'
  ];
  return Boolean(
    sanctionId ||
    a.fecha_resolucion ||
    a.fechaResolucion ||
    a.existe_resolucion === 'si' ||
    a.existeResolucion === 'si' ||
    a.hubo_audiencia === 'si' ||
    a.huboAudiencia === 'si'
  ) || sanctionSignals.some(signal => state.includes(normalized(signal)));
};

export const trafficRules: LegalRule[] = [
  {
    id: 'prescripcion',
    label: 'Prescripción',
    description: 'Revisión del término de prescripción y de las actuaciones de cobro coactivo.',
    applies: a => cause(a).includes('prescrip') || ageYears(a, 'fecha_comparendo') !== null,
    instruction: 'Reconstruir hecho, sanción, firmeza, mandamiento de pago, notificación y actuaciones posteriores de cobro.'
  },
  {
    id: 'caducidad',
    label: 'Caducidad',
    description: 'Revisión del término para decidir la imposición de la sanción, únicamente si la actuación aún no aparece culminada.',
    applies: a => !recordIsSanctioned(a) && cause(a).includes('caduc'),
    instruction: 'Solo verificar si no existe evidencia de sanción culminada: fecha del hecho, audiencia, decisión y término aplicable.'
  },
  {
    id: 'perdida_ejecutoriedad',
    label: 'Pérdida de fuerza ejecutoria',
    description: 'Revisión de los cinco años posteriores a la firmeza del acto y de los actos de ejecución realizados.',
    applies: a => cause(a).includes('ejecutoriedad') || cause(a).includes('ejecutoria') || ageYears(a, 'fecha_mandamiento_pago') !== null,
    instruction: 'No contar automáticamente desde el comparendo ni desde el mandamiento: identificar el acto ejecutable, su firmeza y las actuaciones ejecutivas realizadas durante el término relevante.'
  },
  {
    id: 'fotomulta',
    label: 'Fotodetección',
    description: 'Revisión reforzada de evidencia tecnológica, identificación, imputación personal y notificación.',
    applies: a => /foto|fotomult|detecci[oó]n|camara/.test(cause(a)),
    instruction: 'Solicitar evidencia técnica, identificación del infractor, comunicaciones y trazabilidad del procedimiento.'
  },
  {
    id: 'impugnacion',
    label: 'Impugnación / defensa',
    description: 'Revisión de contradicción, audiencia, pruebas, recursos y oportunidad de defensa.',
    applies: a => /impugn|inconform|defensa|descargo/.test(cause(a)),
    instruction: 'Verificar estado procesal, audiencia, decisión, recursos y términos.'
  },
  {
    id: 'revocatoria',
    label: 'Revocatoria / corrección',
    description: 'Revisión de errores, irregularidades y vía jurídica procedente frente al acto administrativo.',
    applies: a => /revoc|correc|error|inconsistencia|placa|identificaci[oó]n/.test(cause(a)),
    instruction: 'Contrastar el acto administrativo con los documentos oficiales y determinar la vía jurídica procedente.'
  },
  {
    id: 'eliminacion',
    label: 'Eliminación / retiro',
    description: 'Revisión de la causa jurídica que permitiría modificar o depurar el registro.',
    applies: a => /elimin|retir|borrar|cancel/.test(cause(a)),
    instruction: 'Identificar el acto, fundamento jurídico y autoridad competente antes de pedir eliminación del registro.'
  },
  {
    id: 'notificacion',
    label: 'Notificación y debido proceso',
    description: 'Revisión de las constancias que acreditan notificación y oportunidad real de defensa.',
    applies: a => /notific|nunca me notific|no fui notificado/.test(cause(a)) || !a.fecha_notificacion && !a.fechaNotificacion,
    instruction: 'Solicitar constancias de envío, entrega, contenido, destinatario y modalidad de notificación de cada acto relevante.'
  },
  {
    id: 'soportes',
    label: 'Solicitud de soportes',
    description: 'Solicitud del expediente y de los documentos que permitan probar la ruta jurídica.',
    applies: () => true,
    instruction: 'Solicitar expediente íntegro, comparendo, evidencia, decisiones, notificaciones, recursos, mandamiento y actuaciones de cobro.'
  },
];

export function getApplicableTrafficRules(answers: FormAnswers) {
  return trafficRules.filter(r => r.applies(answers));
}

export function evaluateTrafficCase(a: FormAnswers): TrafficDecision[] {
  const out: TrafficDecision[] = [];
  const age = ageYears(a, 'fecha_comparendo');
  const mandAge = ageYears(a, 'fecha_mandamiento_pago');
  const audiencia = getDate(a, 'fecha_audiencia');
  const c = cause(a);
  const sanctioned = recordIsSanctioned(a);

  // Caducidad SOLO tiene sentido como ruta cuando todavía no hay señales
  // suficientes de que la actuación ya produjo una sanción.
  if (c.includes('caduc')) {
    if (sanctioned) {
      out.push({
        id: 'caducidad',
        label: 'Caducidad: no es la ruta principal con una multa ya registrada',
        level: 'insufficient',
        reason: 'El registro contiene señales de que el comparendo ya mutó a multa, sanción o actuación de cobro. El artículo 161 se refiere al término para decidir sobre la imposición de la sanción; por ello no corresponde asumir que la actuación siga pendiente de decisión.',
        nextStep: 'Reconstruir resolución sancionatoria, ejecutoria, notificación y cobro; evaluar prescripción, pérdida de fuerza ejecutoria, notificación, debido proceso o revocatoria según las fechas.',
        legalBasis: ['Ley 769 de 2002, art. 161']
      });
    } else if (audiencia) {
      out.push({
        id: 'caducidad',
        label: 'Caducidad: verificar audiencia y decisión',
        level: 'possible',
        reason: 'Existe fecha de audiencia; debe compararse con la fecha del hecho y con la fecha de la decisión que impuso o negó la sanción.',
        nextStep: 'Solicitar acta de audiencia, decisión sancionatoria, recursos y constancia de ejecutoria.',
        legalBasis: ['Ley 769 de 2002, art. 161']
      });
    } else if (age !== null && age >= 1) {
      out.push({
        id: 'caducidad',
        label: 'Caducidad: hipótesis jurídicamente verificable',
        level: 'possible',
        reason: 'Ha transcurrido al menos un año desde el hecho y la información disponible no evidencia una sanción culminada. La conclusión depende del expediente y de la fecha real de la decisión.',
        nextStep: 'Solicitar expediente, acta de audiencia y decisión para establecer si la autoridad decidió dentro del término.',
        legalBasis: ['Ley 769 de 2002, art. 161']
      });
    } else {
      out.push({
        id: 'caducidad',
        label: 'Caducidad: información insuficiente',
        level: 'insufficient',
        reason: 'No ha transcurrido el término indicativo o faltan fechas para hacer el cómputo.',
        nextStep: 'Obtener expediente y fecha de la actuación decisoria antes de formular una pretensión de caducidad.',
        legalBasis: ['Ley 769 de 2002, art. 161']
      });
    }
  }

  // Para multas antiguas, la prescripción se analiza aunque el registro ya
  // esté sancionado: el objeto cambia de la acción contravencional al cobro.
  if (c.includes('prescrip') || (sanctioned && age !== null && age >= 3)) {
    if (mandAge !== null) {
      out.push({
        id: 'prescripcion',
        label: 'Prescripción: reconstruir mandamiento y cobro',
        level: 'possible',
        reason: 'Existe una fecha de mandamiento de pago. Debe verificarse su notificación y la cronología de las actuaciones de cobro para establecer los efectos sobre la prescripción.',
        nextStep: 'Solicitar mandamiento de pago, constancia de notificación y relación completa de actuaciones de cobro posteriores.',
        legalBasis: ['Ley 769 de 2002, art. 159', 'Ley 1066 de 2006, art. 5', 'Estatuto Tributario, art. 818']
      });
    } else if (age !== null && age >= 3) {
      out.push({
        id: 'prescripcion',
        label: 'Prescripción: hipótesis favorable a verificar',
        level: 'favorable',
        reason: 'Han transcurrido al menos tres años desde la fecha reportada y no se acredita en la información disponible un mandamiento de pago notificado. La conclusión definitiva requiere reconstruir la sanción y el expediente de cobro.',
        nextStep: 'Solicitar declaración de prescripción, mandamiento de pago y constancias de notificación; confrontar la cronología completa.',
        legalBasis: ['Ley 769 de 2002, art. 159', 'Ley 1066 de 2006, art. 5', 'Estatuto Tributario, art. 818']
      });
    } else {
      out.push({
        id: 'prescripcion',
        label: 'Prescripción: aún no acreditada',
        level: 'insufficient',
        reason: 'No están acreditados todos los presupuestos temporales y de cobro necesarios para afirmar prescripción.',
        nextStep: 'Solicitar expediente y, especialmente, mandamiento de pago y su notificación si existe.',
        legalBasis: ['Ley 769 de 2002, art. 159']
      });
    }
  }

  if (c.includes('ejecutoriedad') || c.includes('ejecutoria') || mandAge !== null) {
    if (mandAge !== null && mandAge >= 5) {
      out.push({
        id: 'perdida_ejecutoriedad',
        label: 'Pérdida de fuerza ejecutoria: revisar los cinco años',
        level: 'possible',
        reason: 'La fecha reportada del mandamiento supera cinco años. Esto justifica una revisión reforzada, pero el cómputo jurídico debe partir de la firmeza del acto ejecutable y confrontarse con las actuaciones realizadas para ejecutarlo.',
        nextStep: 'Solicitar acto sancionatorio en firme, constancia de ejecutoria, mandamiento y trazabilidad completa de las actuaciones de ejecución.',
        legalBasis: ['Ley 1437 de 2011, art. 91', 'Ley 1437 de 2011, art. 92']
      });
    } else if (c.includes('ejecutoriedad') || c.includes('ejecutoria')) {
      out.push({
        id: 'perdida_ejecutoriedad',
        label: 'Pérdida de fuerza ejecutoria: requiere verificación',
        level: 'insufficient',
        reason: 'La hipótesis requiere identificar el acto ejecutable, su firmeza y las actuaciones realizadas para ejecutarlo durante el periodo relevante.',
        nextStep: 'Obtener acto en firme, constancia de ejecutoria y trazabilidad del cobro.',
        legalBasis: ['Ley 1437 de 2011, art. 91', 'Ley 1437 de 2011, art. 92']
      });
    }
  }

  if (/foto|fotomult|detecci[oó]n/.test(c)) {
    out.push({ id: 'fotomulta', label: 'Fotodetección: revisión reforzada', level: 'possible', reason: 'La procedencia depende del expediente, evidencia, identificación, imputación personal y notificación; la sola existencia de una imagen no determina automáticamente responsabilidad.', nextStep: 'Solicitar evidencia técnica, identificación del infractor, constancias de notificación y acto sancionatorio.', legalBasis: ['Ley 1843 de 2017', 'Ley 769 de 2002', 'Constitución Política, art. 29'] });
  }
  if (/impugn|inconform|defensa|descargo/.test(c)) {
    out.push({ id: 'impugnacion', label: 'Defensa: revisar oportunidad y estado procesal', level: 'possible', reason: 'La viabilidad depende del estado procesal, la audiencia, la decisión y los términos aplicables.', nextStep: 'Identificar actuación, decisión, recursos y constancias de notificación.', legalBasis: ['Constitución Política, art. 29', 'Ley 769 de 2002'] });
  }
  if (/revoc|correc|error|inconsistencia|placa|identificaci[oó]n/.test(c)) {
    out.push({ id: 'revocatoria', label: 'Revocatoria/corrección: verificar causal y vía', level: 'possible', reason: 'Un error o irregularidad no determina por sí solo la procedencia de la revocatoria; debe identificarse el acto y la causal concreta.', nextStep: 'Obtener acto, expediente y documentos que acrediten la inconsistencia o causal invocada.', legalBasis: ['Ley 1437 de 2011', 'Ley 769 de 2002'] });
  }
  if (/elimin|retir|borrar|cancel/.test(c)) {
    out.push({ id: 'eliminacion', label: 'Eliminación/retiro: requiere fundamento', level: 'possible', reason: 'La depuración del registro es consecuencia de una decisión o situación jurídica acreditada; no se solicita como borrado autónomo.', nextStep: 'Identificar el acto y solicitar la actualización del registro como consecuencia de la decisión jurídica que corresponda.', legalBasis: ['Ley 769 de 2002', 'Ley 1437 de 2011'] });
  }
  if (/notific|nunca me notific|no fui notificado/.test(c) || !a.fecha_notificacion && !a.fechaNotificacion) {
    out.push({ id: 'notificacion', label: 'Notificación: reconstruir trazabilidad', level: 'possible', reason: 'El Estado de Cuenta SIMIT no acredita por sí solo fecha, modalidad, destinatario, contenido remitido ni efectividad de la notificación.', nextStep: 'Solicitar constancias completas de notificación de comparendo, resolución, recursos, mandamiento y demás actos relevantes.', legalBasis: ['Constitución Política, art. 29', 'Ley 1437 de 2011, arts. 67 a 69'] });
  }

  return out.filter((item, index, arr) => arr.findIndex(x => x.id === item.id) === index);
}
