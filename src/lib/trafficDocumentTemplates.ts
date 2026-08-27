import type { FormAnswers } from '../types/form';
import { evaluateTrafficCase, getApplicableTrafficRules } from './legalRules';

const v = (a: FormAnswers, k: string, f = '') => {
  const x = a[k];
  if (Array.isArray(x)) return x.join(', ');
  if (typeof x === 'boolean') return x ? 'Sí' : 'No';
  if (x == null) return f;
  const value = String(x).trim();
  // Never expose parser/UI fallback text as if it were a fact from SIMIT.
  if (/^no especificad[ao] en pdf$/i.test(value)) return f;
  return value;
};

export function buildTrafficDocument(slug: string, a: FormAnswers) {
  const titles: Record<string, string> = {
    'prescripcion-comparendo': 'SOLICITUD DE PRESCRIPCIÓN DE OBLIGACIÓN DE TRÁNSITO',
    'caducidad-comparendo': 'SOLICITUD DE REVISIÓN DE CADUCIDAD DE ACTUACIÓN DE TRÁNSITO',
    'revocatoria-comparendo': 'SOLICITUD DE REVOCATORIA / CORRECCIÓN DE ACTUACIÓN DE TRÁNSITO',
    'solicitud-soportes-comparendo': 'DERECHO DE PETICIÓN — SOLICITUD DE INFORMACIÓN Y SOPORTES DE TRÁNSITO',
    fotomultas: 'DERECHO DE PETICIÓN — SOLICITUD RELACIONADA CON FOTODETECCIÓN / FOTOMULTA',
    'derecho-de-peticion-eliminar-multa': 'DERECHO DE PETICIÓN — SOLICITUD DE REVISIÓN Y ELIMINACIÓN DE MULTA',
  };

  const title = titles[slug] ?? 'SOLICITUD ADMINISTRATIVA DE TRÁNSITO';
  const rules = getApplicableTrafficRules(a);
  const decisions = evaluateTrafficCase(a);
  const favorable = decisions.filter((d) => d.level === 'favorable');
  const uncertain = decisions.filter((d) => d.level !== 'favorable');
  const ruleLabels = rules.filter((r) => r.id !== 'soportes').map((r) => r.label).join(', ');

  const primaryRequest = favorable.length
    ? `Solicito que se declare o reconozca la procedencia de ${favorable.map((d) => d.id === 'prescripcion' ? 'la prescripción' : d.id === 'caducidad' ? 'la caducidad' : d.label.toLowerCase()).join(' y ')}, previo el análisis integral del expediente.`
    : `Solicito que se verifique la procedencia de ${ruleLabels || 'la actuación solicitada'} y se adopte la decisión jurídicamente correspondiente, sin presumir la existencia de los presupuestos que deban acreditarse.`;

  const evidenceRequest = uncertain.length
    ? `Para resolver lo anterior, solicito especialmente: ${uncertain.map((d) => d.nextStep).join(' ')}`
    : 'Solicito copia íntegra del expediente y de los soportes pertinentes.';

  const soportes = 'Solicito copia íntegra de los soportes que sustentan la actuación, incluyendo comparendo, evidencia, constancias de notificación, mandamiento de pago si existe, actos administrativos, recursos y demás documentos pertinentes.';
  const legalAnalysis = decisions.length
    ? decisions.map((d) => `• ${d.label}: ${d.reason} Siguiente actuación: ${d.nextStep} Fundamento orientador: ${d.legalBasis.join('; ')}.`).join('\n')
    : 'No se identificó una decisión jurídica automatizada concluyente. Se requiere revisión del expediente y de la información aportada.';

  const placa = v(a, 'placa');
  const solicitud = v(a, 'pretension', primaryRequest);
  const hechos = v(a, 'hechos');
  const header = [
    v(a, 'ciudad', 'Ciudad'),
    v(a, 'fecha', new Date().toLocaleDateString('es-CO')),
    '',
    v(a, 'entidad', v(a, 'autoridad', 'SEÑOR(A) AUTORIDAD DE TRÁNSITO')),
    '',
    title,
    '',
    `Solicitante: ${v(a, 'nombres')} ${v(a, 'apellidos')}`,
    `Documento: ${v(a, 'documento')}`,
    `Correo: ${v(a, 'correo')}`,
    `Comparendo / acto: ${v(a, 'numero_comparendo')}`,
    `Fecha: ${v(a, 'fecha_comparendo')}`,
  ];
  if (placa) header.push(`Placa: ${placa}`);

  return [
    ...header,
    '',
    'I. OBJETO',
    solicitud,
    '',
    'II. HECHOS',
    hechos,
    '',
    'III. ANÁLISIS JURÍDICO PRELIMINAR',
    legalAnalysis,
    '',
    'IV. PETICIONES',
    solicitud,
    `Solicito además que ${evidenceRequest.toLowerCase()}.`,
    'Se remita respuesta de fondo, clara, congruente y completa dentro del término legal aplicable.',
    '',
    'V. INFORMACIÓN Y SOPORTES',
    soportes,
    '',
    'VI. ANEXOS',
    v(a, 'anexos', 'Estado de Cuenta SIMIT aportado por el solicitante.'),
    '',
    'Atentamente',
    '',
    `${v(a, 'nombres')} ${v(a, 'apellidos')}`,
    `C.C. ${v(a, 'documento')}`,
  ].join('\n');
}
