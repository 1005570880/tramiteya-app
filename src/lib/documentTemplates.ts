import type { FormAnswers } from '../types/form';
import type { Procedure } from '../types';

function value(answers: FormAnswers, key: string, fallback = ''): string {
  const raw = answers[key];
  if (Array.isArray(raw)) return raw.join(', ');
  if (typeof raw === 'boolean') return raw ? 'Sí' : 'No';
  return raw == null ? fallback : String(raw);
}
function header(answers: FormAnswers): string[] { return [value(answers, 'ciudad', 'Ciudad'), value(answers, 'fecha', new Date().toLocaleDateString('es-CO')), '']; }

function buildTrafficPetition(answers: FormAnswers): string {
  const analysis = (answers as any).__legalAnalysis || {};
  const assessment = (answers as any).__legalAssessment || {};
  const applicant = `${value(answers, 'nombres')} ${value(answers, 'apellidos')}`.trim() || 'EL/LA PETICIONARIO(A)';
  const authority = value(answers, 'entidad', value(answers, 'autoridad', 'AUTORIDAD DE TRÁNSITO COMPETENTE'));
  const number = value(answers, 'numero_comparendo', value(answers, 'numero_acto', 'no identificado'));
  const route = String(assessment.primaryRoute || value(answers, 'causal_principal', 'REVISION_INTEGRAL')).replace(/_/g, ' ').toLowerCase();
  const framework = String(analysis.legalFramework || value(answers, 'fundamentos', ''));
  const application = String(analysis.application || '');
  const facts = String(analysis.facts || value(answers, 'hechos', ''));
  const requests = String(analysis.requests || value(answers, 'solicitudConcreta', value(answers, 'solicitud', '')));
  const problem = String(analysis.problem || `Determinar si la actuación asociada al registro No. ${number} conserva validez, firmeza, ejecutoriedad y exigibilidad y qué consecuencia jurídica corresponde según las actuaciones acreditadas.`);
  const timeline = [
    `Fecha del comparendo/hecho: ${value(answers, 'fecha_comparendo', 'No acreditada')}`,
    `Acto o resolución sancionatoria: ${value(answers, 'fecha_resolucion', 'No acreditado en la información aportada')}`,
    `Notificación: ${value(answers, 'fecha_notificacion', 'No acreditada en la información aportada')}`,
    `Mandamiento de pago: ${value(answers, 'fecha_mandamiento_pago', 'No acreditado en la información aportada')}`,
  ].join('\n');
  const evidence = [
    '• Orden de comparendo y evidencia que la sustente.',
    '• Acta o constancia de audiencia y decisión adoptada.',
    '• Resolución o acto sancionatorio y constancia de ejecutoria.',
    '• Constancias completas de notificación: medio, destinatario, fecha, contenido y entrega/publicación.',
    '• Recursos interpuestos y decisiones que los resuelvan.',
    '• Mandamiento de pago, notificación y actuaciones posteriores de cobro coactivo.',
    '• Medidas cautelares, acuerdos, pagos y demás actuaciones relevantes para la exigibilidad.',
  ].join('\n');
  return [
    ...header(answers), authority.toUpperCase(), 'DEPENDENCIA COMPETENTE', '',
    `ASUNTO: DERECHO DE PETICIÓN — REVISIÓN JURÍDICA INTEGRAL DE LA ACTUACIÓN No. ${number}`,
    `REFERENCIA: Comparendo/acto No. ${number}`,
    '',
    `Yo, ${applicant}, identificado(a) con documento No. ${value(answers, 'documento', value(answers, 'cedula', ''))}, ejerzo el derecho fundamental de petición y solicito la revisión integral de la actuación administrativa individualizada, en los siguientes términos:`,
    '', 'I. OBJETO',
    `Solicito reconstruir y revisar la actuación asociada al registro No. ${number}, con énfasis en ${route}, así como en la validez, firmeza, notificación, ejecutoriedad y exigibilidad del acto sancionatorio y, cuando corresponda, del procedimiento de cobro coactivo.`,
    '', 'II. HECHOS RELEVANTES', facts,
    '', 'III. PROBLEMA JURÍDICO', problem,
    '', 'IV. MARCO NORMATIVO Y JURISPRUDENCIAL DESARROLLADO', framework,
    '', 'V. APLICACIÓN DEL MARCO JURÍDICO AL CASO CONCRETO', application,
    '', 'VI. CRONOLOGÍA OBJETO DE VERIFICACIÓN', timeline,
    '', 'VII. DOCUMENTOS Y ELEMENTOS PROBATORIOS', evidence,
    '', 'VIII. PETICIONES', requests,
    '', 'IX. CONCLUSIÓN Y RESERVA DE VERIFICACIÓN',
    'La información del Estado de Cuenta permite individualizar el registro y conocer su estado reportado, pero no sustituye el expediente administrativo. Por ello, no se tienen como probadas circunstancias —audiencia, notificación, ejecutoria, mandamiento o actuaciones de cobro— que no estén acreditadas documentalmente. La autoridad deberá resolver la ruta jurídica que corresponda a partir del expediente y de las fechas efectivamente demostradas.',
    '', 'X. NOTIFICACIONES', `Correo electrónico: ${value(answers, 'correo')}`, `Teléfono: ${value(answers, 'telefono')}`, `Dirección: ${value(answers, 'direccion')}`,
    '', 'XI. ANEXOS', value(answers, 'anexos', 'Estado de Cuenta SIMIT aportado por el solicitante.'),
    '', 'Atentamente,', '', applicant, `C.C. ${value(answers, 'documento', value(answers, 'cedula', ''))}`,
  ].join('\n');
}

export function buildPetitionText(procedure: Procedure, answers: FormAnswers): string {
  const applicant = `${value(answers, 'nombres')} ${value(answers, 'apellidos')}`.trim();
  return [...header(answers), value(answers, 'entidad', 'SEÑOR(A) DESTINATARIO'), value(answers, 'cargo'), '', `Asunto: ${value(answers, 'asunto', procedure.title)}`, '', `Yo, ${applicant || 'el/la suscrito(a)'}, identificado(a) con documento ${value(answers, 'documento')}, respetuosamente presento la siguiente petición:`, '', 'HECHOS', value(answers, 'hechos'), '', 'PETICIÓN', value(answers, 'solicitud'), '', 'NOTIFICACIONES', `Correo electrónico: ${value(answers, 'correo')}`, `Teléfono: ${value(answers, 'telefono')}`, `Dirección: ${value(answers, 'direccion')}`, '', 'ANEXOS', value(answers, 'anexos', 'No se relacionan anexos.'), '', 'Atentamente,', '', applicant || 'SOLICITANTE', `C.C. ${value(answers, 'documento')}`].join('\n');
}
export function buildCommercialLeaseText(answers: FormAnswers): string { const legalRep=value(answers,'representante_legal'); const codeudor=value(answers,'codeudor'); return [...header(answers),'CONTRATO DE ARRENDAMIENTO DE INMUEBLE PARA USO COMERCIAL','',`Entre ${value(answers,'arrendador')} identificado con ${value(answers,'arrendador_documento')}${legalRep?`, representado legalmente por ${legalRep}`:''}, en adelante EL ARRENDADOR, y ${value(answers,'arrendatario')} identificado con ${value(answers,'arrendatario_documento')}, en adelante EL ARRENDATARIO, se celebra el presente contrato:`,'','PRIMERA. INMUEBLE Y DESTINACIÓN',`El inmueble está ubicado en ${value(answers,'inmueble_direccion')}. Matrícula: ${value(answers,'inmueble_matricula')}. Destinación: ${value(answers,'destinacion_comercial')}.`,'','SEGUNDA. CANON Y PLAZO',`Canon mensual: $${value(answers,'canon')} COP. Plazo: ${value(answers,'plazo')}. Inicio: ${value(answers,'fecha_inicio')}.`,'','TERCERA. GARANTÍAS',value(answers,'garantia','No se pacta garantía adicional.'),codeudor?`Codeudor: ${codeudor}.`:'No se pacta codeudor.','','CUARTA. GASTOS Y SERVICIOS',value(answers,'servicios'),'','QUINTA. SUBARRIENDO',value(answers,'subarriendo'),'','SEXTA. CLÁUSULAS ESPECIALES',value(answers,'clausulas_especiales'),'','SÉPTIMA. ACEPTACIÓN','Las partes manifiestan que conocen y aceptan el contenido.','','EL ARRENDADOR',value(answers,'arrendador'),'','EL ARRENDATARIO',value(answers,'arrendatario')].join('\n'); }
export function buildTutelaText(answers: FormAnswers): string { const measure=value(answers,'medida_cautelar')==='si'?value(answers,'medida_cautelar_detalle'):'No se solicita medida provisional.'; return [...header(answers),'SEÑOR JUEZ (REPARTO)','','ACCIÓN DE TUTELA','',`Accionante: ${value(answers,'accionante')} — ${value(answers,'accionante_documento')}`,`Accionado: ${value(answers,'accionado')}`,'','I. DERECHOS FUNDAMENTALES VULNERADOS',value(answers,'derechos_vulnerados'),'','II. HECHOS',value(answers,'hechos'),'','III. PRETENSIONES',value(answers,'pretensiones'),'','IV. MEDIDA PROVISIONAL',measure,'','V. NOTIFICACIONES',value(answers,'accionado_direccion')].join('\n'); }
export function buildComparendoText(answers: FormAnswers): string { return [...header(answers),'IMPUGNACIÓN / SOLICITUD DE EXONERACIÓN DE COMPARENDO','',`Señor(a) autoridad de tránsito: ${value(answers,'autoridad')}`,'',`Infractor: ${value(answers,'infractor_nombre')} — ${value(answers,'infractor_documento')}`,`Comparendo No.: ${value(answers,'numero_comparendo')}`,`Fecha: ${value(answers,'fecha_comparendo')}`,`Placa: ${value(answers,'placa')}`,'','I. FUNDAMENTO',value(answers,'causal'),'','II. HECHOS',value(answers,'hechos'),'','III. SOLICITUD',value(answers,'solicitud_exoneracion'),'','Atentamente,',value(answers,'infractor_nombre'),`C.C. ${value(answers,'infractor_documento')}`].join('\n'); }
export function buildPowerText(answers: FormAnswers): string { return [...header(answers),'PODER ESPECIAL','',`Yo, ${value(answers,'poderdante_nombre')}, identificado(a) con ${value(answers,'poderdante_documento')}, confiero poder especial a ${value(answers,'apoderado_nombre')}, identificado(a) con ${value(answers,'apoderado_documento')}, abogado(a) con T.P. ${value(answers,'apoderado_tarjeta')}, para que me represente en:`,'',value(answers,'proceso'),'','FACULTADES',value(answers,'facultades_especificas'),'','EL PODERDANTE',value(answers,'poderdante_nombre'),'','EL APODERADO',value(answers,'apoderado_nombre')].join('\n'); }

export function buildDocumentText(procedure: Procedure, answers: FormAnswers): string {
  if (procedure.slug === 'derecho-de-peticion-eliminar-multa') return buildTrafficPetition(answers);
  switch (procedure.slug) { case 'derecho-de-peticion': return buildPetitionText(procedure, answers); case 'contrato-de-arrendamiento': return buildCommercialLeaseText(answers); case 'accion-de-tutela': return buildTutelaText(answers); case 'impugnacion-comparendos': return buildComparendoText(answers); case 'poder-especial': return buildPowerText(answers); default: return `${procedure.title}\n\n${Object.entries(answers).filter(([key])=>!key.startsWith('__')).map(([key,val])=>`${key}: ${Array.isArray(val)?val.join(', '):String(val??'')}`).join('\n')}`; }
}
