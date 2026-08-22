import type { FormAnswers } from '../types/form';
import type { Procedure } from '../types';

function value(answers: FormAnswers, key: string, fallback = ''): string {
  const raw = answers[key];
  if (Array.isArray(raw)) return raw.join(', ');
  if (typeof raw === 'boolean') return raw ? 'Sí' : 'No';
  return raw == null ? fallback : String(raw);
}

function header(answers: FormAnswers): string[] {
  return [value(answers, 'ciudad', 'Ciudad'), value(answers, 'fecha', new Date().toLocaleDateString('es-CO')), ''];
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
  const measure = value(answers, 'medida_cautelar') === 'si' ? value(answers, 'medida_cautelar_detalle') : 'No se solicita medida provisional.';
  return [...header(answers), 'SEÑOR JUEZ (REPARTO)', '', 'ACCIÓN DE TUTELA', '', `Accionante: ${value(answers, 'accionante')} — ${value(answers, 'accionante_documento')}`, `Accionado: ${value(answers, 'accionado')}`, '', 'I. DERECHOS FUNDAMENTALES VULNERADOS', value(answers, 'derechos_vulnerados'), '', 'II. HECHOS', value(answers, 'hechos'), '', 'III. PRETENSIONES', value(answers, 'pretensiones'), '', 'IV. MEDIDA PROVISIONAL', measure, '', 'V. NOTIFICACIONES', value(answers, 'accionado_direccion')].join('\n');
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
