import type { FormAnswers } from '../types/form';
import type { Procedure } from '../types';

function value(answers: FormAnswers, key: string, fallback = ''): string {
  const raw = answers[key];
  if (Array.isArray(raw)) return raw.join(', ');
  if (typeof raw === 'boolean') return raw ? 'Sí' : 'No';
  return raw == null ? fallback : String(raw);
}

function has(answers: FormAnswers, key: string): boolean {
  const raw = answers[key];
  return raw !== undefined && raw !== null && String(raw).trim() !== '';
}

function header(answers: FormAnswers): string[] {
  return [value(answers, 'ciudad', 'Ciudad'), value(answers, 'fecha', new Date().toLocaleDateString('es-CO')), ''];
}

function numberedFacts(raw: string): string[] {
  const text = raw.trim();
  if (!text) return ['1. Bajo la gravedad del juramento, manifiesto los hechos que fundamentan la presente acción conforme a la información suministrada en el formulario.'];
  const parts = text.split(/\n+|(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ])/).map((x) => x.trim()).filter(Boolean);
  return parts.map((fact, index) => `${index + 1}. ${fact}`);
}

function buildHealthLegalGrounds(answers: FormAnswers): string[] {
  const medicine = value(answers, 'medicamento', value(answers, 'medicamentos', 'el medicamento prescrito'));
  const prescription = value(answers, 'prescripcion_medica', value(answers, 'orden_medica', 'la orden o prescripción médica suministrada'));
  const refusal = value(answers, 'motivo_negativa', value(answers, 'respuesta_entidad', 'la negativa o barrera informada por la entidad'));
  const urgency = value(answers, 'urgencia', value(answers, 'riesgo', 'la afectación o riesgo informado por el accionante'));

  return [
    '1. Fundamento constitucional y legal',
    'El artículo 86 de la Constitución Política consagra la acción de tutela como mecanismo preferente y sumario para obtener la protección inmediata de los derechos fundamentales cuando resulten vulnerados o amenazados por la acción u omisión de una autoridad pública o, en los casos previstos por la ley, de particulares. El artículo 49 de la Constitución reconoce la salud como derecho y servicio público a cargo del Estado.',
    'La Ley Estatutaria 1751 de 2015 reconoce el derecho fundamental a la salud como autónomo e irrenunciable y exige que su prestación se desarrolle bajo principios como accesibilidad, continuidad, oportunidad, integralidad y calidad. En consecuencia, el acceso efectivo a las tecnologías y servicios requeridos por el paciente no puede quedar sometido a barreras administrativas injustificadas.',
    'El Decreto 2591 de 1991 regula la acción de tutela, sus reglas de procedibilidad y las facultades del juez constitucional para adoptar las órdenes necesarias para hacer efectivo el amparo.',
    '',
    '2. Jurisprudencia constitucional aplicable al suministro de medicamentos',
    `La Corte Constitucional ha reiterado que la entrega oportuna y continua de medicamentos hace parte de la garantía efectiva del derecho fundamental a la salud. En la Sentencia T-098 de 2016 señaló que la dilación injustificada en el suministro puede suspender o impedir el tratamiento y vulnerar los derechos a la salud, integridad, dignidad y vida. La regla jurisprudencial exige que las entidades responsables remuevan barreras injustificadas que impidan el acceso efectivo al medicamento.`,
    `En la Sentencia T-185 de 2024, la Corte reiteró la vulneración del derecho a la salud y a la vida digna cuando no se suministra de manera continua y oportuna el medicamento ordenado por el médico tratante, destacando los principios de continuidad y oportunidad.`,
    `En la Sentencia T-377 de 2024, la Corte reiteró que las entidades prestadoras deben garantizar el suministro integral, oportuno y continuo de medicamentos y que las barreras injustificadas para su entrega pueden vulnerar el derecho fundamental a la salud.`,
    `La Sentencia T-461 de 2025 reiteró que el suministro de medicamentos ordenados por el médico tratante constituye una de las obligaciones principales de las EPS y que deben observar los principios de oportunidad y eficiencia.`,
    '',
    '3. Aplicación al caso concreto',
    `De acuerdo con la información suministrada, el accionante refiere que requiere ${medicine}, cuenta con ${prescription} y manifiesta que la entidad accionada no lo ha suministrado de manera efectiva. La razón indicada para la negativa o barrera corresponde a: ${refusal}. El riesgo o afectación informado es: ${urgency}.`,
    'Si estos hechos se encuentran respaldados por la orden médica, solicitudes, respuestas de la EPS/IPS, fórmulas, autorizaciones, constancias de entrega o demás documentos pertinentes, la situación debe ser valorada por el juez constitucional a la luz de los principios de oportunidad, continuidad e integralidad del derecho fundamental a la salud.',
    'La presente argumentación no presume hechos distintos de los informados por el accionante. La procedencia concreta del amparo dependerá de la acreditación de la orden médica, la conducta de la entidad accionada, la necesidad del servicio o medicamento y las demás circunstancias relevantes del caso.',
  ];
}

function buildGenericLegalGrounds(answers: FormAnswers): string[] {
  return [
    '1. Fundamento constitucional y legal',
    'El artículo 86 de la Constitución Política establece la acción de tutela como mecanismo preferente y sumario para la protección inmediata de los derechos fundamentales frente a su vulneración o amenaza.',
    'El Decreto 2591 de 1991 desarrolla el procedimiento de tutela y faculta al juez constitucional para adoptar las medidas necesarias para garantizar la protección efectiva de los derechos fundamentales.',
    'Los derechos invocados deben analizarse conforme a su contenido constitucional, a las circunstancias particulares acreditadas y a la jurisprudencia vigente aplicable al caso concreto.',
    '',
    '2. Caso concreto',
    `La vulneración alegada se sustenta en los siguientes hechos: ${value(answers, 'hechos', 'los hechos relatados por el accionante en el formulario')}.`,
    `La conducta atribuida a la parte accionada consiste en: ${value(answers, 'conducta_vulneradora', value(answers, 'respuesta_entidad', 'la conducta descrita por el accionante'))}.`,
    'La valoración constitucional deberá realizarse con base en los documentos y demás elementos de prueba aportados con la acción.',
  ];
}

export function buildPetitionText(procedure: Procedure, answers: FormAnswers): string {
  const applicant = `${value(answers, 'nombres')} ${value(answers, 'apellidos')}`.trim();
  return [...header(answers), value(answers, 'entidad', 'SEÑOR(A) DESTINATARIO'), value(answers, 'cargo'), '', `Asunto: ${value(answers, 'asunto', procedure.title)}`, '', `Yo, ${applicant || 'el/la suscrito(a)'}, identificado(a) con documento ${value(answers, 'documento')}, respetuosamente presento la siguiente petición:`, '', 'HECHOS', value(answers, 'hechos'), '', 'PETICIÓN', value(answers, 'solicitud'), '', 'NOTIFICACIONES', `Correo electrónico: ${value(answers, 'correo')}`, `Teléfono: ${value(answers, 'telefono')}`, `Dirección: ${value(answers, 'direccion')}`, '', 'ANEXOS', value(answers, 'anexos', 'No se relacionan anexos.'), '', 'Atentamente,', '', applicant || 'SOLICITANTE', `C.C. ${value(answers, 'documento')}`].join('\n');
}

export function buildCommercialLeaseText(answers: FormAnswers): string {
  const legalRep = value(answers, 'representante_legal');
  const codeudor = value(answers, 'codeudor');
  return [...header(answers), 'CONTRATO DE ARRENDAMIENTO DE INMUEBLE PARA USO COMERCIAL', '', `Entre ${value(answers, 'arrendador')} identificado con ${value(answers, 'arrendador_documento')}${legalRep ? `, representado legalmente por ${legalRep}` : ''}, en adelante EL ARRENDADOR, y ${value(answers, 'arrendatario')} identificado con ${value(answers, 'arrendatario_documento')}, en adelante EL ARRENDATARIO, se celebra el presente contrato:`, '', 'PRIMERA. INMUEBLE Y DESTINACIÓN', `El inmueble está ubicado en ${value(answers, 'inmueble_direccion')}. Matrícula: ${value(answers, 'inmueble_matricula')}. Su destinación será: ${value(answers, 'destinacion_comercial')}.`, '', 'SEGUNDA. CANON Y PLAZO', `El canon mensual será de $${value(answers, 'canon')} COP. Plazo: ${value(answers, 'plazo')}. Inicio: ${value(answers, 'fecha_inicio')}. Incremento: ${value(answers, 'incremento', 'Según lo pactado por las partes y la normativa aplicable.')}.`, '', 'TERCERA. GARANTÍAS', value(answers, 'garantia', 'No se pacta garantía adicional.'), codeudor ? `Actúa como codeudor ${codeudor}, identificado con ${value(answers, 'codeudor_documento')}.` : 'No se pacta codeudor.', '', 'CUARTA. GASTOS Y SERVICIOS', value(answers, 'servicios'), '', 'QUINTA. SUBARRIENDO', value(answers, 'subarriendo'), '', 'SEXTA. CLÁUSULAS ESPECIALES', value(answers, 'clausulas_especiales'), '', 'SÉPTIMA. ACEPTACIÓN', 'Las partes manifiestan que conocen y aceptan el contenido del presente contrato.', '', 'EL ARRENDADOR', value(answers, 'arrendador'), '', 'EL ARRENDATARIO', value(answers, 'arrendatario')].join('\n');
}

export function buildTutelaText(answers: FormAnswers): string {
  const applicant = value(answers, 'accionante', `${value(answers, 'nombres')} ${value(answers, 'apellidos')}`.trim());
  const applicantDoc = value(answers, 'accionante_documento', value(answers, 'documento'));
  const defendant = value(answers, 'accionado', value(answers, 'entidad', 'ENTIDAD ACCIONADA'));
  const rights = value(answers, 'derechos_vulnerados', 'derecho fundamental invocado');
  const measureRequested = value(answers, 'medida_cautelar') === 'si' || value(answers, 'medida_provisional') === 'si';
  const measure = measureRequested
    ? value(answers, 'medida_cautelar_detalle', value(answers, 'medida_provisional_detalle', 'Solicito que se adopte la medida provisional descrita en los hechos y respuestas suministradas, mientras se decide de fondo.'))
    : 'No se solicita medida provisional.';
  const healthCase = /salud|medic|eps|farmac|procedimiento|tratamiento/i.test(`${rights} ${value(answers, 'hechos')} ${value(answers, 'asunto')} ${value(answers, 'tipo_caso')}`);
  const legalGrounds = healthCase ? buildHealthLegalGrounds(answers) : buildGenericLegalGrounds(answers);
  const pretensiones = value(answers, 'pretensiones', value(answers, 'solicitud', `Amparar los derechos fundamentales de ${applicant || 'la parte accionante'} y ordenar a ${defendant} adoptar las medidas necesarias para superar la vulneración acreditada.`));
  const facts = numberedFacts(value(answers, 'hechos'));

  return [
    ...header(answers),
    'SEÑOR JUEZ (REPARTO)',
    value(answers, 'juzgado', ''),
    value(answers, 'ciudad', ''),
    '',
    'REF.: ACCIÓN DE TUTELA',
    `ACCIONANTE: ${applicant || '____________________________'}`,
    `ACCIONADO: ${defendant}`,
    `DERECHOS FUNDAMENTALES INVOCADOS: ${rights}`,
    '',
    'I. IDENTIFICACIÓN Y LEGITIMACIÓN',
    `Yo, ${applicant || '____________________________'}, identificado(a) con ${applicantDoc || '________________'}, actuando en nombre propio${value(answers, 'representante', '') ? ` por conducto de ${value(answers, 'representante')}` : ''}, presento acción de tutela contra ${defendant}, por la vulneración o amenaza de los derechos fundamentales que se indican a continuación.`,
    '',
    'II. DERECHOS FUNDAMENTALES VULNERADOS O AMENAZADOS',
    rights,
    '',
    'III. HECHOS',
    ...facts,
    '',
    'IV. FUNDAMENTOS DE PROCEDENCIA',
    'La acción se promueve para obtener la protección inmediata de derechos fundamentales cuya vulneración o amenaza se atribuye a la parte accionada. La procedencia concreta deberá ser valorada por el juez conforme a los principios de legitimación, inmediatez y subsidiariedad, atendiendo las circunstancias particulares acreditadas en el expediente.',
    '',
    'V. FUNDAMENTOS DE DERECHO Y JURISPRUDENCIA',
    ...legalGrounds,
    '',
    'VI. PRETENSIONES',
    `PRIMERA. ${pretensiones}`,
    `SEGUNDA. Ordenar a la entidad accionada que adopte las medidas necesarias para hacer efectiva la protección concedida, dentro del término que determine el despacho.`,
    ...(healthCase ? ['TERCERA. Cuando resulte jurídicamente procedente y esté respaldado por la información médica aportada, ordenar la prestación o suministro integral, oportuno y continuo del servicio, medicamento o tecnología requerida, evitando nuevas barreras administrativas injustificadas.'] : []),
    '',
    'VII. SOLICITUD DE MEDIDA PROVISIONAL',
    measure,
    '',
    'VIII. PRUEBAS Y ANEXOS',
    has(answers, 'pruebas') ? value(answers, 'pruebas') : '1. Orden médica, fórmula, autorización, respuesta, constancia de solicitud o documento relacionado con la vulneración, si obra en poder del accionante.\n2. Los demás documentos que acrediten los hechos expuestos.',
    '',
    'IX. JURAMENTO',
    `Bajo la gravedad del juramento, manifiesto que no he presentado otra acción de tutela respecto de los mismos hechos y derechos, ante otra autoridad judicial, salvo que se indique expresamente lo contrario en la información suministrada.`,
    '',
    'X. NOTIFICACIONES',
    `Accionante: ${value(answers, 'correo', 'Correo electrónico no informado')}${has(answers, 'telefono') ? ` — Teléfono: ${value(answers, 'telefono')}` : ''}${has(answers, 'direccion') ? ` — Dirección: ${value(answers, 'direccion')}` : ''}`,
    `Accionado: ${value(answers, 'accionado_correo', value(answers, 'correo_entidad', value(answers, 'accionado_direccion', 'Dirección/correo de la entidad no informado')))} `,
    '',
    'Atentamente,',
    '',
    applicant || '____________________________',
    applicantDoc ? `C.C. ${applicantDoc}` : 'C.C. ____________________',
  ].join('\n');
}

export function buildComparendoText(answers: FormAnswers): string {
  return [...header(answers), 'IMPUGNACIÓN / SOLICITUD DE EXONERACIÓN DE COMPARENDO', '', `Señor(a) autoridad de tránsito: ${value(answers, 'autoridad')}`, '', `Infractor: ${value(answers, 'infractor_nombre')} — ${value(answers, 'infractor_documento')}`, `Comparendo No.: ${value(answers, 'numero_comparendo')}`, `Fecha: ${value(answers, 'fecha_comparendo')}`, `Placa: ${value(answers, 'placa')}`, '', 'I. FUNDAMENTO', value(answers, 'causal'), '', 'II. HECHOS', value(answers, 'hechos'), '', 'III. SOLICITUD', value(answers, 'solicitud_exoneracion'), '', 'Atentamente,', value(answers, 'infractor_nombre'), `C.C. ${value(answers, 'infractor_documento')}`].join('\n');
}

export function buildPowerText(answers: FormAnswers): string {
  return [...header(answers), 'PODER ESPECIAL', '', `Yo, ${value(answers, 'poderdante_nombre')}, identificado(a) con ${value(answers, 'poderdante_documento')}, por medio del presente documento confiero poder especial a ${value(answers, 'apoderado_nombre')}, identificado(a) con ${value(answers, 'apoderado_documento')}, abogado(a) con tarjeta profesional ${value(answers, 'apoderado_tarjeta')}, para que me represente en:`, '', value(answers, 'proceso'), '', 'FACULTADES', value(answers, 'facultades_especificas'), '', `Facultad de sustitución: ${value(answers, 'facultad_sustituir', 'No')}`, `Facultad para recibir notificaciones: ${value(answers, 'facultad_recibir', 'Sí')}`, '', 'EL PODERDANTE', value(answers, 'poderdante_nombre'), `C.C./NIT ${value(answers, 'poderdante_documento')}`, '', 'EL APODERADO', value(answers, 'apoderado_nombre'), `T.P. ${value(answers, 'apoderado_tarjeta')}`].join('\n');
}

export function buildDocumentText(procedure: Procedure, answers: FormAnswers): string {
  switch (procedure.slug) {
    case 'derecho-de-peticion': return buildPetitionText(procedure, answers);
    case 'contrato-de-arrendamiento': return buildCommercialLeaseText(answers);
    case 'accion-de-tutela': return buildTutelaText(answers);
    case 'impugnacion-comparendos': return buildComparendoText(answers);
    case 'poder-especial': return buildPowerText(answers);
    default: return `${procedure.title}\n\n${Object.entries(answers).map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : String(val ?? '')}`).join('\n')}`;
  }
}
