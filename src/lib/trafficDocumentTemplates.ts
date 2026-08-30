import type { FormAnswers } from '../types/form';

function text(value: unknown): string {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function first(...values: unknown[]): string {
  for (const value of values) {
    const candidate = text(value);
    if (candidate) return candidate;
  }
  return '';
}

function formatCurrency(value: unknown): string {
  const raw = text(value);
  if (!raw) return '';
  if (/^\$/.test(raw) && /COP/i.test(raw)) return raw;
  const numeric = Number(raw.replace(/[^0-9-]/g, ''));
  if (!Number.isFinite(numeric)) return raw.includes('$') ? raw : `$ ${raw} COP`;
  return `$ ${numeric.toLocaleString('es-CO')} COP`;
}

function parseDate(value: unknown): Date | null {
  const raw = text(value);
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  const dmy = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmy) return new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date.getTime());
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function isOlderThanThreeYears(date: Date): boolean {
  const threshold = addYears(date, 3);
  return threshold.getTime() < Date.now();
}

export function formatOrganismoDestino(rawOrganismo: string): string {
  if (!rawOrganismo || rawOrganismo.trim().length === 0) {
    return 'SECRETARÍA DE TRÁNSITO Y TRANSPORTE MUNICIPAL';
  }

  const org = rawOrganismo.trim().toUpperCase();
  const entidadesConocidas = [
    'SECRETARIA', 'SECRETARÍA', 'INSPECCION', 'INSPECCIÓN', 'INSTITUTO',
    'DIRECCION', 'DIRECCIÓN', 'DEPARTAMENTO', 'ALCALDIA', 'ALCALDÍA',
  ];
  const tieneEntidad = entidadesConocidas.some(e => org.includes(e));

  if (tieneEntidad) return org;
  if (org.startsWith('DPTAL') || org.startsWith('DEPARTAMENTAL')) {
    return `INSTITUTO DE TRÁNSITO Y TRANSPORTE DE ${org}`;
  }
  return `SECRETARÍA DE TRÁNSITO Y TRANSPORTE DE ${org}`;
}

function isPrescriptionStrategy(data: any): boolean {
  const strategy = first(data.viaJuridica, data.estrategia, data.strategy, data.tipoEstrategia).toUpperCase();
  const slug = first(data.slug, data.procedureSlug).toLowerCase();
  return strategy.includes('PERDIDA_EJECUTORIEDAD') || strategy.includes('PÉRDIDA_EJECUTORIEDAD') || strategy.includes('PRESCRIPCION') || strategy.includes('PRESCRIPCIÓN') || slug.includes('prescripcion') || slug.includes('perdida-ejecutoriedad');
}

function isCoactive(data: any): boolean {
  const value = first(data.enCobroCoactivo, data.cobroCoactivo, data.cobro_coactivo, data.procesoCoactivo, data.estadoCobro).toUpperCase();
  return ['SI', 'SÍ', 'TRUE', 'COACTIVO', 'EN COBRO', 'EN COBRO COACTIVO'].includes(value) || Boolean(data.fechaMandamientoPago || data.fechaNotificacionMandamiento || data.fechaCoactivo || data.mandamientoPago);
}

function buildPrescriptionDoctrine(data: any): string {
  if (!isPrescriptionStrategy(data) && !isCoactive(data)) return '';
  return `

3. PRESCRIPCIÓN DE LA ACCIÓN DE COBRO COACTIVO Y REMISIÓN AL ESTATUTO TRIBUTARIO (LEY 1066 DE 2006 Y ARTÍCULO 818 DEL ESTATUTO TRIBUTARIO)

Conforme al artículo 5° de la Ley 1066 de 2006, el cobro coactivo de las obligaciones a favor de las entidades públicas se desarrolla bajo el procedimiento previsto en el Estatuto Tributario, en cuanto resulte aplicable. En materia de multas de tránsito, el artículo 159 de la Ley 769 de 2002 establece un término de prescripción de tres (3) años, contado desde la ocurrencia del hecho, y dispone que la prescripción se interrumpe con la notificación del mandamiento de pago. A su vez, el artículo 818 del Estatuto Tributario establece que, una vez interrumpido el término, este vuelve a correr desde el día siguiente a la notificación del mandamiento de pago.

Por ello, cuando se encuentre acreditada la notificación del mandamiento de pago y hayan transcurrido tres (3) años adicionales sin que opere una nueva causa legal de interrupción o suspensión, debe verificarse la configuración de la prescripción de la acción de cobro, con base en las fechas que consten en el expediente administrativo.

4. PRECEDENTE DEL CONSEJO DE ESTADO SOBRE LA PRESCRIPCIÓN DE MULTAS DE TRÁNSITO

En la sentencia de la Sección Primera del Consejo de Estado, radicación 11001-03-15-000-2015-03248-00(AC), de 11 de febrero de 2016, con ponencia del Consejero Roberto Augusto Serrato Valdés, se examinó la aplicación armónica del artículo 159 de la Ley 769 de 2002 con el artículo 818 del Estatuto Tributario para determinar la prescripción de las obligaciones derivadas de multas de tránsito. La providencia destacó que, una vez notificado el mandamiento de pago, el término vuelve a correr desde el día siguiente y que la autoridad debe observar el régimen de prescripción aplicable al cobro de estas obligaciones.

En consecuencia, solicito que la autoridad confronte las fechas de ocurrencia del hecho, expedición y notificación del mandamiento de pago y las demás actuaciones de cobro que consten en el expediente, y determine expresamente si se configuró la prescripción, sin trasladarme la carga de demostrar actuaciones que reposan en sus propios archivos.`;
}

function buildChronology(data: any): string {
  const factDate = parseDate(first(data.fechaHecho, data.fecha_comparendo));
  const coactiveDate = parseDate(first(data.fechaNotificacionMandamiento, data.fechaMandamientoPago, data.fechaCoactivo, data.fecha_cobro_coactivo));
  if (!factDate || !isOlderThanThreeYears(factDate)) return '';

  if (!coactiveDate) {
    return `\n\nLÍNEA CRONOLÓGICA: El hecho ocurrió el ${formatDate(factDate)} y, a la fecha de generación de este escrito, han transcurrido más de tres (3) años. La existencia, fecha y notificación de un eventual mandamiento de pago deberá acreditarse con el expediente administrativo.`;
  }

  const prescriptionDate = addYears(coactiveDate, 3);
  const lossOfEnforceabilityDate = addYears(factDate, 5);
  return `\n\nLÍNEA CRONOLÓGICA: Coactivo del ${formatDate(coactiveDate)} → término de prescripción de tres (3) años cumplido el ${formatDate(prescriptionDate)} y, como referencia temporal del término de cinco (5) años previsto para la pérdida de ejecutoriedad, ${formatDate(lossOfEnforceabilityDate)}.`;
}

export function buildTrafficPetitionText(data: any): string {
  const { organismo, comparendo, fechaHecho, valor, infraccion, nombre, cedula, correo, telefono, fuenteConocimiento, notificado, pago } = data;
  const organismoLimpio = text(organismo).toUpperCase();
  const entidadDestino = formatOrganismoDestino(organismoLimpio);
  const valorFormateado = formatCurrency(valor);
  const prescriptionDoctrine = buildPrescriptionDoctrine(data);
  const chronology = buildChronology(data);

  let textoConocimiento = 'Me enteré de la existencia de este comparendo a través de una notificación de cobro.';
  if (fuenteConocimiento === 'simit') textoConocimiento = 'Me enteré de la existencia de este comparendo al consultar directamente la plataforma SIMIT.';
  else if (fuenteConocimiento === 'no_recuerdo') textoConocimiento = 'No tengo claridad sobre el medio exacto por el cual se reportó inicialmente esta actuación.';

  let textoDefensa = 'Sobre la oportunidad de ejercitar mi derecho a la defensa, manifiesto que no fui notificado en debida forma ni asistí a audiencia alguna.';
  if (notificado === 'si') textoDefensa = 'Manifiesto que se adelantaron actuaciones sin garantizar plenamente las etapas procesales correspondientes.';

  let textoPago = 'Aclaro que no he realizado pagos ni suscrito acuerdos de pago frente a esta obligación.';
  if (pago === 'acuerdo' || pago === 'completo') textoPago = 'Respecto de la obligación, existe un antecedente de pago o acuerdo que requiere verificación en la carpeta administrativa.';

  return `SEÑORES
${entidadDestino}
E. S. D.

ASUNTO: DERECHO DE PETICIÓN — REVISIÓN DE DEBIDO PROCESO, PRESCRIPCIÓN Y NOTIFICACIÓN
PETICIONARIO: ${text(nombre).toUpperCase()} — C.C. No. ${text(cedula)}
REFERENCIA: Actuación / comparendo No. ${text(comparendo)}
FECHA DEL HECHO: ${text(fechaHecho)}
VALOR REPORTADO: ${valorFormateado}

Yo, ${text(nombre)}, identificado con cédula de ciudadanía No. ${text(cedula)}, actuando en nombre propio, presento respetuosamente este derecho de petición en ejercicio del derecho fundamental consagrado en el artículo 23 de la Constitución Política de Colombia y la Ley 1755 de 2015.

Solicito que se revise integralmente la situación jurídica de la actuación No. ${text(comparendo)}, con base en los datos acreditados y en el expediente administrativo que debe reposar en poder de la autoridad competente.

I. HECHOS ACREDITADOS Y DATOS DISPONIBLES

PRIMERO: En el Estado de Cuenta SIMIT aportado figura la actuación No. ${text(comparendo)}, asociada a ${organismoLimpio}, con fecha del hecho ${text(fechaHecho)}.

SEGUNDO: La actuación se encuentra asociada a mi documento de identidad No. ${text(cedula)}.

TERCERO: El valor reportado para la obligación corresponde a ${valorFormateado}.

CUARTO: El registro identifica la infracción con el código ${text(infraccion)}.

QUINTO: El Estado de Cuenta SIMIT no permite identificar por sí solo el acto sancionatorio, su fecha de expedición, su ejecutoria ni las constancias de notificación que reposen en el expediente.

SEXTO: ${textoConocimiento}

SÉPTIMO: ${textoDefensa}

OCTAVO: ${textoPago}.${chronology}

II. ANÁLISIS JURÍDICO DEL CASO CONCRETO

La situación debe analizarse a partir de las fechas y actuaciones que obren en el expediente administrativo. El Estado de Cuenta SIMIT constituye una fuente de información sobre el registro de la obligación, pero por sí solo no acredita la totalidad de las actuaciones procesales, sus notificaciones, la ejecutoria de los actos ni las actuaciones desplegadas dentro del eventual cobro coactivo.

La vía jurídica principal corresponde a la verificación del debido proceso, la regularidad de la notificación y, cuando resulte procedente según las fechas acreditadas, la prescripción de la acción de cobro o la pérdida de ejecutoriedad del acto administrativo.

III. FUNDAMENTOS DE DERECHO

1. Artículo 23 de la Constitución Política de Colombia: derecho fundamental de petición.
2. Artículo 29 de la Constitución Política de Colombia: garantía del debido proceso.
3. Ley 1755 de 2015: regulación del derecho de petición.
4. Artículo 159 de la Ley 769 de 2002: prescripción de las sanciones impuestas por infracciones de tránsito y reglas sobre cobro coactivo.
5. Artículo 162 de la Ley 769 de 2002: remisión a las normas de procedimiento aplicables.
6. Artículo 5° de la Ley 1066 de 2006: procedimiento aplicable al cobro de obligaciones públicas mediante jurisdicción coactiva.
7. Artículo 818 del Estatuto Tributario: interrupción y nuevo cómputo del término de prescripción de la acción de cobro.
8. Artículo 91 de la Ley 1437 de 2011 (CPACA): pérdida de ejecutoriedad del acto administrativo, cuando se configure alguno de los supuestos legalmente previstos.
${prescriptionDoctrine}

IV. PRETENSIONES

PRIMERO: Que se determine expresamente la situación jurídica actual de la actuación No. ${text(comparendo)}, indicando por qué continúa vigente, ejecutable o exigible y cuáles actuaciones sustentan dicha situación.

SEGUNDO: Que se me entregue copia íntegra, legible y completa del expediente administrativo relacionado con la actuación No. ${text(comparendo)}, incluidos los actos sancionatorios, constancias de ejecutoria y actuaciones de cobro.

TERCERO: Que se identifique el acto mediante el cual se impuso la sanción, indicando número, fecha, autoridad expedidora y constancia de ejecutoria, y se me entregue copia íntegra del mismo.

CUARTO: Que se me entreguen las constancias de notificación de las actuaciones procesales relevantes, especialmente la citación, la resolución sancionatoria y, si existe, el mandamiento de pago, con sus respectivos soportes.

QUINTO: Que se me informe si existe o existió proceso de cobro coactivo y, en caso afirmativo, se me indique la fecha de expedición y de notificación del mandamiento de pago, las actuaciones posteriores y el estado actual del proceso.

SEXTO: Que, si de las fechas acreditadas en el expediente se configura la prescripción de la acción de cobro, se declare la prescripción, se termine y archive la actuación de cobro y se adopten las consecuencias jurídicas correspondientes.

SÉPTIMO: Que, si se configura la pérdida de ejecutoriedad o cualquier otra causal legal que impida exigir la obligación, se reconozca expresamente dicha circunstancia y se adopten las medidas administrativas correspondientes.

OCTAVO: Que, si jurídicamente corresponde, se ordene la depuración, actualización o cancelación del registro ante el SIMIT y demás bases de datos institucionales, de acuerdo con la decisión que se adopte sobre la obligación.

NOVENO: Que se emita respuesta de fondo, clara, congruente, completa y debidamente motivada frente a cada una de las pretensiones formuladas.

V. ANEXOS

PRIMERO: Copia del Estado de Cuenta SIMIT aportado por el suscrito peticionario.

VI. NOTIFICACIONES

Solicito que la respuesta a la presente petición sea remitida al correo electrónico ${text(correo)} y/o al teléfono ${text(telefono)}.

Atentamente,

${text(nombre)}
C.C. No. ${text(cedula)}
Correo electrónico: ${text(correo)}
Teléfono: ${text(telefono)}`;
}

export function buildTrafficDocument(_slug: string, a: FormAnswers): string {
  const trami = (a as any).tramiAnswers && typeof (a as any).tramiAnswers === 'object' ? (a as any).tramiAnswers : {};
  const simit = (a as any).__simitRecord && typeof (a as any).__simitRecord === 'object' ? (a as any).__simitRecord : {};
  return buildTrafficPetitionText({
    slug: _slug,
    organismo: first(a.entidad, a.autoridad, simit.authority),
    comparendo: first(a.numero_comparendo, simit.number),
    fechaHecho: first(a.fecha_comparendo, simit.date),
    valor: first(a.valor, a.valor_multa, simit.value),
    infraccion: first(a.codigo_infraccion, simit.infractionCode, simit.code),
    nombre: first(a.nombre, a.nombreCompleto, trami.nombre, simit.name, simit.ownerName),
    cedula: first(a.documento, a.documentNumber, a.cedula, trami.cedula, simit.documentNumber),
    correo: first(a.correo, a.email, trami.correo, simit.email),
    telefono: first(a.telefono, a.phone, trami.telefono, simit.phone),
    fuenteConocimiento: first(trami.conocimiento, (a as any).fuenteConocimiento),
    notificado: first(trami.notificacion, (a as any).notificado),
    pago: first(trami.pagos, (a as any).pago),
    viaJuridica: first((a as any).viaJuridica, trami.viaJuridica, (a as any).estrategia, trami.estrategia),
    estrategia: first((a as any).estrategia, trami.estrategia),
    enCobroCoactivo: first((a as any).enCobroCoactivo, trami.enCobroCoactivo, (a as any).cobroCoactivo, trami.cobroCoactivo),
    fechaMandamientoPago: first((a as any).fechaNotificacionMandamiento, trami.fechaNotificacionMandamiento, (a as any).fechaMandamientoPago, trami.fechaMandamientoPago),
    fechaNotificacionMandamiento: first((a as any).fechaNotificacionMandamiento, trami.fechaNotificacionMandamiento),
    fechaCoactivo: first((a as any).fechaCoactivo, trami.fechaCoactivo),
  });
}