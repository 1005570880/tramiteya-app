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

const cleanSentence = (value: string) => value.replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '.') ;

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
    : `Solicito que se verifique la procedencia de ${ruleLabels || 'la actuación administrativa cuestionada'} y se adopte la decisión jurídicamente correspondiente, sin presumir hechos o presupuestos que deban acreditarse.`;

  const evidenceItems = uncertain.map((d) => cleanSentence(d.nextStep));
  const evidenceRequest = evidenceItems.length
    ? evidenceItems.join(' ')
    : 'se remita copia íntegra del expediente y de los soportes pertinentes.';

  const soportes = 'Solicito copia íntegra de los soportes que sustentan la actuación, incluyendo la orden de comparendo, evidencia disponible, constancias de notificación, mandamiento de pago si existe, actos administrativos, recursos y demás documentos pertinentes.';
  const legalAnalysis = decisions.length
    ? decisions.map((d) => `• ${d.label}: ${d.reason} Siguiente actuación: ${d.nextStep} Fundamento orientador: ${d.legalBasis.join('; ')}.`).join('\n')
    : 'No se identificó una conclusión jurídica automatizada. Se requiere revisión del expediente y de la información aportada.';

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

  const objeto = `Solicito la revisión integral de la actuación administrativa asociada al comparendo No. ${v(a, 'numero_comparendo', 'no identificado')} de fecha ${v(a, 'fecha_comparendo', 'no identificada')}, con el fin de establecer, con base en el expediente y los soportes oficiales, si existe fundamento para la eliminación, archivo, revocatoria o reconocimiento de la situación jurídica que corresponda.`;

  return [
    ...header,
    '',
    'I. OBJETO',
    objeto,
    '',
    'II. HECHOS',
    hechos,
    '',
    'III. ANÁLISIS JURÍDICO PRELIMINAR',
    legalAnalysis,
    '',
    'IV. PETICIONES',
    solicitud,
    `Para resolver lo anterior, solicito especialmente que ${evidenceRequest}`,
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
