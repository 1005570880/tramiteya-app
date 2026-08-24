import { registerProcedureModule, type ProcedureModuleConfig } from '../lib/genericProcedureEngine';

const citizenFields = [
  { id: 'fullName', label: 'Nombre completo', type: 'text' as const, required: true },
  { id: 'documentType', label: 'Tipo de documento', type: 'select' as const, required: true, options: [{ label: 'Cédula de ciudadanía', value: 'CC' }, { label: 'Cédula de extranjería', value: 'CE' }, { label: 'NIT', value: 'NIT' }] },
  { id: 'documentNumber', label: 'Número de documento', type: 'text' as const, required: true },
  { id: 'email', label: 'Correo electrónico', type: 'email' as const, required: true },
];

export const procedureModules: ProcedureModuleConfig[] = [
  {
    id: 'transito-core', vertical: 'transito', title: 'Trámites de tránsito', description: 'Motor jurídico para prescripción, cobro, comparendos y actuaciones administrativas de tránsito.',
    procedureSlugs: ['prescripcion-comparendo', 'caducidad-comparendo', 'revocatoria-comparendo', 'solicitud-soportes-comparendo', 'fotomultas', 'impugnacion-comparendos'], priceCop: 49900,
    steps: [
      { id: 'citizen', title: 'Tus datos', fields: citizenFields },
      { id: 'authority', title: 'Entidad', fields: [{ id: 'authorityName', label: 'Organismo de tránsito', type: 'text', required: true }, { id: 'authorityMunicipality', label: 'Municipio', type: 'text', required: true }, { id: 'authorityDepartment', label: 'Departamento', type: 'text', required: true }] },
      { id: 'case', title: 'Caso', fields: [{ id: 'comparendos', label: 'Comparendos / obligaciones', type: 'textarea', required: true, placeholder: 'Un número por línea' }, { id: 'coactiveDate', label: 'Fecha de cobro coactivo, si la conoces', type: 'date' }, { id: 'paymentOrderNoticeDate', label: 'Fecha de notificación del mandamiento, si la conoces', type: 'date' }] },
      { id: 'evidence', title: 'Soportes', fields: [{ id: 'hasMandamientoDocument', label: 'Tengo copia del mandamiento de pago', type: 'checkbox' }, { id: 'hasCoactiveDocument', label: 'Tengo documentos del cobro coactivo', type: 'checkbox' }] },
    ],
    quality: { baseScore: 20, rules: [
      { id: 'citizen', field: 'fullName', operator: 'exists', points: 10, message: 'Solicitante identificado.' },
      { id: 'authority', field: 'authorityName', operator: 'exists', points: 10, message: 'Organismo de tránsito identificado.' },
      { id: 'comparendos', field: 'comparendos', operator: 'exists', points: 15, message: 'Se aportaron obligaciones para revisar.' },
      { id: 'coactive', field: 'coactiveDate', operator: 'exists', points: 15, message: 'Existe fecha de referencia para el cobro coactivo.' },
      { id: 'notice', field: 'paymentOrderNoticeDate', operator: 'exists', points: 15, message: 'Existe fecha de notificación del mandamiento para verificar.' },
      { id: 'support', field: 'hasMandamientoDocument', operator: 'equals', value: true, points: 10, message: 'Se dispone de soporte del mandamiento.' },
      { id: 'missing-notice', field: 'paymentOrderNoticeDate', operator: 'notExists', points: 0, message: 'Debe verificarse la notificación del mandamiento en el expediente.' },
    ] },
    document: { title: 'SOLICITUD ADMINISTRATIVA DE TRÁNSITO', sections: [
      { heading: 'I. IDENTIFICACIÓN', lines: [{ label: 'Solicitante', field: 'fullName' }, { label: 'Documento', field: 'documentNumber' }, { label: 'Correo', field: 'email' }] },
      { heading: 'II. AUTORIDAD', lines: [{ label: 'Organismo', field: 'authorityName' }, { label: 'Municipio', field: 'authorityMunicipality' }, { label: 'Departamento', field: 'authorityDepartment' }] },
      { heading: 'III. INFORMACIÓN DEL CASO', lines: [{ label: 'Comparendos / obligaciones', field: 'comparendos' }, { label: 'Fecha de cobro coactivo', field: 'coactiveDate', fallback: 'No informada' }, { label: 'Notificación del mandamiento', field: 'paymentOrderNoticeDate', fallback: 'No informada' }] },
      { heading: 'IV. PETICIONES', lines: ['Solicito verificar individualmente las obligaciones relacionadas y las actuaciones surtidas dentro de cada expediente.', 'Solicito que, si se encuentran acreditados los presupuestos legales, se declare la consecuencia jurídica correspondiente y se actualicen los registros que legalmente procedan.', 'Solicito respuesta de fondo, clara, congruente y completa.'] },
    ], legalBasis: ['Artículo 91 de la Ley 1437 de 2011 (CPACA), según la hipótesis de pérdida de ejecutoriedad aplicable.', 'Artículo 159 de la Ley 769 de 2002, y normas concordantes sobre prescripción de obligaciones de tránsito.', 'Artículo 818 del Estatuto Tributario, cuando resulte jurídicamente aplicable al cobro.'] },
  },
  {
    id: 'salud-core', vertical: 'salud', title: 'Derechos en salud', description: 'Motor para peticiones y tutelas relacionadas con medicamentos, procedimientos y servicios de salud.',
    procedureSlugs: ['peticion-salud', 'tutela-salud', 'negativa-medicamentos', 'negativa-procedimiento'], priceCop: 49900,
    steps: [
      { id: 'citizen', title: 'Paciente', fields: citizenFields },
      { id: 'health', title: 'Servicio solicitado', fields: [{ id: 'eps', label: 'EPS / entidad responsable', type: 'text', required: true }, { id: 'service', label: 'Medicamento, procedimiento o servicio', type: 'text', required: true }, { id: 'denialDate', label: 'Fecha de negativa o barrera', type: 'date' }, { id: 'urgency', label: '¿Existe urgencia o riesgo para la salud?', type: 'radio', options: [{ label: 'Sí', value: 'yes' }, { label: 'No', value: 'no' }], required: true }] },
      { id: 'facts', title: 'Situación', fields: [{ id: 'facts', label: 'Describe brevemente qué ocurrió', type: 'textarea', required: true }, { id: 'request', label: 'Qué necesitas que la entidad haga', type: 'textarea', required: true }] },
      { id: 'evidence', title: 'Soportes', fields: [{ id: 'medicalOrder', label: 'Tengo orden o concepto médico', type: 'checkbox' }, { id: 'denialEvidence', label: 'Tengo soporte de la negativa', type: 'checkbox' }] },
    ],
    quality: { baseScore: 15, rules: [
      { id: 'patient', field: 'fullName', operator: 'exists', points: 10, message: 'Paciente identificado.' }, { id: 'eps', field: 'eps', operator: 'exists', points: 15, message: 'Entidad responsable identificada.' }, { id: 'service', field: 'service', operator: 'exists', points: 15, message: 'Servicio de salud identificado.' }, { id: 'facts', field: 'facts', operator: 'exists', points: 15, message: 'Hechos descritos.' }, { id: 'medical-order', field: 'medicalOrder', operator: 'equals', value: true, points: 15, message: 'Existe soporte médico.' }, { id: 'urgency', field: 'urgency', operator: 'equals', value: 'yes', points: 15, message: 'Se reporta posible riesgo para la salud.' },
    ] },
    document: { title: 'DERECHO DE PETICIÓN — SERVICIO DE SALUD', sections: [
      { heading: 'I. IDENTIFICACIÓN DEL PACIENTE', lines: [{ label: 'Paciente', field: 'fullName' }, { label: 'Documento', field: 'documentNumber' }, { label: 'Correo', field: 'email' }] },
      { heading: 'II. ENTIDAD Y SERVICIO', lines: [{ label: 'EPS / responsable', field: 'eps' }, { label: 'Servicio solicitado', field: 'service' }, { label: 'Fecha de negativa', field: 'denialDate', fallback: 'No informada' }] },
      { heading: 'III. HECHOS', lines: [{ label: 'Situación', field: 'facts' }, { label: 'Solicitud concreta', field: 'request' }] },
      { heading: 'IV. PETICIONES', lines: ['Solicito garantizar el acceso efectivo al servicio requerido, remover la barrera administrativa identificada y emitir respuesta de fondo.', 'Solicito indicar las razones médicas, administrativas y jurídicas de cualquier negativa.'] },
    ], legalBasis: ['Ley Estatutaria 1751 de 2015 sobre el derecho fundamental a la salud.'] },
  },
  {
    id: 'habeas-data-core', vertical: 'habeas-data', title: 'Hábeas data financiero', description: 'Motor para solicitudes de actualización, rectificación y revisión de permanencia de reportes crediticios.',
    procedureSlugs: ['habeas-data-reporte', 'caducidad-datacredito', 'rectificacion-reporte-crediticio'], priceCop: 49900,
    steps: [
      { id: 'citizen', title: 'Tus datos', fields: citizenFields },
      { id: 'report', title: 'Reporte', fields: [{ id: 'operator', label: 'Central de riesgo', type: 'select', options: [{ label: 'Datacrédito / Experian', value: 'datacredito' }, { label: 'TransUnion', value: 'transunion' }, { label: 'Otra', value: 'other' }], required: true }, { id: 'creditor', label: 'Entidad que reporta', type: 'text', required: true }, { id: 'obligationDate', label: 'Fecha aproximada de la obligación', type: 'date' }, { id: 'paymentDate', label: 'Fecha de pago/extinción, si ocurrió', type: 'date' }] },
      { id: 'request', title: 'Solicitud', fields: [{ id: 'facts', label: 'Qué aparece en el reporte y por qué consideras que debe revisarse', type: 'textarea', required: true }, { id: 'request', label: 'Qué solicitas', type: 'textarea', required: true }] },
    ],
    quality: { baseScore: 20, rules: [{ id: 'identity', field: 'fullName', operator: 'exists', points: 10, message: 'Titular identificado.' }, { id: 'operator', field: 'operator', operator: 'exists', points: 15, message: 'Central de riesgo identificada.' }, { id: 'creditor', field: 'creditor', operator: 'exists', points: 15, message: 'Fuente del reporte identificada.' }, { id: 'payment', field: 'paymentDate', operator: 'exists', points: 20, message: 'Existe fecha de pago para analizar permanencia.' }, { id: 'facts', field: 'facts', operator: 'exists', points: 15, message: 'Reporte descrito por el titular.' }] },
    document: { title: 'SOLICITUD DE ACTUALIZACIÓN / RECTIFICACIÓN DE INFORMACIÓN FINANCIERA', sections: [
      { heading: 'I. TITULAR DE LA INFORMACIÓN', lines: [{ label: 'Nombre', field: 'fullName' }, { label: 'Documento', field: 'documentNumber' }, { label: 'Correo', field: 'email' }] },
      { heading: 'II. INFORMACIÓN REPORTADA', lines: [{ label: 'Central de riesgo', field: 'operator' }, { label: 'Entidad reportante', field: 'creditor' }, { label: 'Fecha de obligación', field: 'obligationDate', fallback: 'No informada' }, { label: 'Fecha de pago/extinción', field: 'paymentDate', fallback: 'No informada' }] },
      { heading: 'III. HECHOS Y SOLICITUD', lines: [{ label: 'Situación reportada', field: 'facts' }, { label: 'Petición', field: 'request' }] },
    ], legalBasis: ['Ley 1266 de 2008 sobre hábeas data financiero.', 'Ley 2157 de 2021 y normas concordantes sobre actualización y permanencia de información financiera.'] },
  },
  {
    id: 'contracts-core', vertical: 'contratos', title: 'Contratos', description: 'Generador modular de contratos con estructura reutilizable y campos parametrizados.',
    procedureSlugs: ['contrato-de-arrendamiento', 'contrato-prestacion-servicios', 'contrato-compraventa'], priceCop: 79900,
    steps: [
      { id: 'parties', title: 'Partes', fields: [{ id: 'partyA', label: 'Parte 1', type: 'text', required: true }, { id: 'partyADocument', label: 'Documento parte 1', type: 'text', required: true }, { id: 'partyB', label: 'Parte 2', type: 'text', required: true }, { id: 'partyBDocument', label: 'Documento parte 2', type: 'text', required: true }, { id: 'email', label: 'Correo para notificaciones', type: 'email', required: true }] },
      { id: 'terms', title: 'Condiciones', fields: [{ id: 'object', label: 'Objeto del contrato', type: 'textarea', required: true }, { id: 'value', label: 'Valor', type: 'text' }, { id: 'startDate', label: 'Fecha de inicio', type: 'date' }, { id: 'term', label: 'Plazo', type: 'text' }] },
      { id: 'clauses', title: 'Cláusulas especiales', fields: [{ id: 'specialClauses', label: 'Condiciones adicionales', type: 'textarea' }] },
    ],
    quality: { baseScore: 25, rules: [{ id: 'partyA', field: 'partyA', operator: 'exists', points: 10, message: 'Parte 1 identificada.' }, { id: 'partyB', field: 'partyB', operator: 'exists', points: 10, message: 'Parte 2 identificada.' }, { id: 'object', field: 'object', operator: 'exists', points: 20, message: 'Objeto contractual definido.' }, { id: 'email', field: 'email', operator: 'exists', points: 5, message: 'Canal de notificaciones registrado.' }] },
    document: { title: 'CONTRATO', sections: [
      { heading: 'I. PARTES', lines: [{ label: 'Parte 1', field: 'partyA' }, { label: 'Documento', field: 'partyADocument' }, { label: 'Parte 2', field: 'partyB' }, { label: 'Documento', field: 'partyBDocument' }] },
      { heading: 'II. OBJETO Y CONDICIONES ECONÓMICAS', lines: [{ label: 'Objeto', field: 'object' }, { label: 'Valor', field: 'value', fallback: 'Por definir' }, { label: 'Inicio', field: 'startDate', fallback: 'Por definir' }, { label: 'Plazo', field: 'term', fallback: 'Por definir' }] },
      { heading: 'III. CLÁUSULAS ESPECIALES', lines: [{ label: 'Condiciones adicionales', field: 'specialClauses', fallback: 'No se registraron condiciones adicionales.' }] },
      { heading: 'IV. NOTIFICACIONES Y ACEPTACIÓN', lines: [{ label: 'Correo', field: 'email' }, 'Las partes manifiestan que han leído y aceptan el contenido del presente documento, sujeto a revisión jurídica cuando corresponda.'] },
    ], legalBasis: ['La plantilla se adapta al tipo contractual seleccionado y debe revisarse frente a la legislación colombiana aplicable al negocio concreto.'] },
  },
];

for (const module of procedureModules) registerProcedureModule(module);
