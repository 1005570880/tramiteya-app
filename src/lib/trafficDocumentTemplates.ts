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

export function buildTrafficPetitionText(data: any): string {
  const {
    organismo,
    comparendo,
    fechaHecho,
    valor,
    infraccion,
    nombre,
    cedula,
    correo,
    telefono,
    fuenteConocimiento,
    notificado,
    pago,
  } = data;

  const organismoLimpio = text(organismo).toUpperCase();
  const valorFormateado = formatCurrency(valor);

  let textoConocimiento = 'Me enteré de la existencia de este comparendo a través de una notificación de cobro.';
  if (fuenteConocimiento === 'simit') {
    textoConocimiento = 'Me enteré de la existencia de este comparendo al consultar directamente la plataforma SIMIT.';
  } else if (fuenteConocimiento === 'no_recuerdo') {
    textoConocimiento = 'No tengo claridad sobre el medio exacto por el cual se reportó inicialmente esta actuación.';
  }

  let textoDefensa = 'Sobre la oportunidad de ejercitar mi derecho a la defensa, manifiesto que no fui notificado en debida forma ni asistí a audiencia alguna.';
  if (notificado === 'si') {
    textoDefensa = 'Manifiesto que se adelantaron actuaciones sin garantizar plenamente las etapas procesales correspondientes.';
  }

  let textoPago = 'Aclaro que no he realizado pagos ni suscrito acuerdos de pago frente a esta obligación.';
  if (pago === 'acuerdo' || pago === 'completo') {
    textoPago = 'Respecto de la obligación, existe un antecedente de pago o acuerdo que requiere verificación en la carpeta administrativa.';
  }

  return `SEÑORES
${organismoLimpio}
E. S. D.

ASUNTO: DERECHO DE PETICIÓN — REVISIÓN DE DEBIDO PROCESO Y NOTIFICACIÓN
PETICIONARIO: ${text(nombre).toUpperCase()} — C.C. No. ${text(cedula)}
REFERENCIA: Actuación / comparendo No. ${text(comparendo)}
FECHA DEL HECHO: ${text(fechaHecho)}
VALOR REPORTADO: ${valorFormateado}

Yo, ${text(nombre)}, identificado con cédula de ciudadanía No. ${text(cedula)}, actuando en nombre propio, presento respetuosamente este derecho de petición en ejercicio del derecho fundamental consagrado en el artículo 23 de la Constitución Política de Colombia y la Ley 1755 de 2015.

Solicito que se revise integralmente la situación jurídica de la actuación No. ${text(comparendo)}, con base en los datos acreditados y el expediente administrativo que la autoridad debe demostrar documentalmente.

I. HECHOS ACREDITADOS Y DATOS DISPONIBLES

1. En el Estado de Cuenta SIMIT aportado figura la actuación No. ${text(comparendo)}, asociada a ${organismoLimpio}, con fecha del hecho ${text(fechaHecho)}.
2. La actuación se encuentra asociada a mi documento de identidad No. ${text(cedula)}.
3. El valor reportado para la obligación corresponde a ${valorFormateado}.
4. El registro identifica la infracción con el código ${text(infraccion)}.
5. El Estado de Cuenta SIMIT no permite identificar por sí solo el acto sancionatorio, su fecha de expedición ni su ejecutoria.
6. ${textoConocimiento}
7. ${textoDefensa}
8. ${textoPago}

II. ANÁLISIS JURÍDICO DEL CASO CONCRETO

La vía principal invocada corresponde a la verificación del DEBIDO PROCESO Y REGULARIDAD DE LA NOTIFICACIÓN. La validez de las actuaciones sancionatorias y la oportunidad real de defensa deben confrontarse directamente con las constancias físicas o digitales que reposen en el expediente administrativo.

III. FUNDAMENTOS DE DERECHO

- Artículo 23 de la Constitución Política de Colombia (Derecho Fundamental de Petición).
- Artículo 29 de la Constitución Política de Colombia (Garantía del Debido Proceso).
- Ley 1755 de 2015 (Reglamentaria del Derecho de Petición).
- Artículo 135 y concordantes de la Ley 769 de 2002 (Código Nacional de Tránsito).
- Artículo 91 de la Ley 1437 de 2011 (CPACA).

IV. PETICIONES

PRIMERO: Que se determine expresamente la situación jurídica actual de la actuación No. ${text(comparendo)}, indicando por qué continúa vigente o exigible.

SEGUNDO: Que se me entregue copia íntegra, legible y completa del expediente administrativo relacionado con la actuación No. ${text(comparendo)}.

TERCERO: Que se identifique el acto mediante el cual se impuso la sanción, indicando número, fecha, autoridad expedidora y constancia de ejecutoria, entregando copia del mismo.

CUARTO: Que se me entreguen las constancias de notificación de las actuaciones procesales (citación, resolución o mandamiento), con sus respectivos soportes de entrega o publicación.

QUINTO: Que se me informe si existe o existió proceso de cobro coactivo y se remita copia del mandamiento de pago y sus notificaciones.

SEXTO: Que, de acreditarse una irregularidad en la notificación o trámite que afecte la exigibilidad, se adopten de inmediato las consecuencias jurídicas procedentes.

SÉPTIMO: Que, si jurídicamente corresponde, se ordene la depuración o actualización del registro ante el SIMIT.

OCTAVO: Que se emita respuesta de fondo, clara, congruente y debidamente motivada.

V. ANEXOS

1. Copia del Estado de Cuenta SIMIT aportado por el suscrito peticionario.

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
  });
}
