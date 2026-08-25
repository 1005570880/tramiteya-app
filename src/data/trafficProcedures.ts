import type { FormStep } from '../types/form';

const identity: FormStep = {
  id: 'identity',
  title: 'Primero, consulta tus comparendos',
  description: 'Solo necesitamos tu cédula. TrámiteYa consultará la información disponible y te mostrará los comparendos para que elijas cuál quieres revisar.',
  fields: [
    { id: 'documento', label: 'Número de cédula', type: 'text', required: true, placeholder: 'Ej. 1000000000' },
  ],
};

const contact: FormStep = {
  id: 'contact',
  title: 'Tus datos de contacto',
  description: 'Los datos recuperados de la consulta se conservarán. Solo completa lo que realmente haga falta.',
  fields: [
    { id: 'nombres', label: 'Nombres', type: 'text', required: true },
    { id: 'apellidos', label: 'Apellidos', type: 'text', required: true },
    { id: 'correo', label: 'Correo electrónico', type: 'email', required: true },
    { id: 'telefono', label: 'Teléfono', type: 'phone' },
  ],
};

const trafficData: FormStep = {
  id: 'traffic',
  title: 'Datos del comparendo seleccionado',
  description: 'Estos datos se completan automáticamente con la información recuperada. Solo tendrás que corregir o complementar lo que falte.',
  fields: [
    { id: 'numero_comparendo', label: 'Número de comparendo / acto', type: 'text', required: true },
    { id: 'fecha_comparendo', label: 'Fecha del comparendo / acto', type: 'date', required: true },
    { id: 'placa', label: 'Placa', type: 'text' },
    { id: 'autoridad', label: 'Autoridad de tránsito', type: 'text', required: true },
    { id: 'tipo_actuacion', label: 'Tipo de actuación', type: 'select', required: true, options: [
      { label: 'Comparendo', value: 'comparendo' },
      { label: 'Multa / resolución sancionatoria', value: 'multa' },
      { label: 'Fotodetección / fotomulta', value: 'fotomulta' },
      { label: 'Otro', value: 'otro' },
    ] },
    { id: 'fecha_audiencia', label: 'Fecha de audiencia (si existe)', type: 'date' },
    { id: 'fecha_mandamiento_pago', label: 'Fecha del mandamiento de pago (si existe)', type: 'date' },
  ],
};

const process: FormStep = {
  id: 'process',
  title: 'Estado del trámite y notificaciones',
  fields: [
    { id: 'fue_notificado', label: '¿Fue notificado de la actuación?', type: 'radio', required: true, options: [
      { label: 'Sí', value: 'si' }, { label: 'No', value: 'no' }, { label: 'No lo sé', value: 'no_se' },
    ] },
    { id: 'fecha_notificacion', label: 'Fecha de notificación (si la conoces)', type: 'date', condition: { questionId: 'fue_notificado', operator: 'equals', value: 'si' } },
    { id: 'fecha_notificacion_mandamiento', label: 'Fecha de notificación del mandamiento de pago (si la conoces)', type: 'date', condition: { questionId: 'fecha_mandamiento_pago', operator: 'notEquals', value: '' } },
    { id: 'hubo_audiencia', label: '¿Hubo audiencia o comparecencia?', type: 'radio', required: true, options: [
      { label: 'Sí', value: 'si' }, { label: 'No', value: 'no' }, { label: 'No lo sé', value: 'no_se' },
    ] },
    { id: 'existe_resolucion', label: '¿Existe resolución sancionatoria?', type: 'radio', required: true, options: [
      { label: 'Sí', value: 'si' }, { label: 'No', value: 'no' }, { label: 'No lo sé', value: 'no_se' },
    ] },
  ],
};

const legalIssue: FormStep = {
  id: 'legal',
  title: 'Situación jurídica',
  fields: [
    { id: 'causal_principal', label: '¿Qué deseas revisar?', type: 'select', required: true, options: [
      { label: 'Prescripción', value: 'prescripcion' },
      { label: 'Caducidad', value: 'caducidad' },
      { label: 'Eliminar/corregir comparendo o multa', value: 'eliminacion' },
      { label: 'Impugnar / ejercer defensa', value: 'impugnacion' },
      { label: 'Revocatoria o corrección', value: 'revocatoria' },
      { label: 'Falta o defecto de notificación', value: 'notificacion' },
      { label: 'Fotomulta / fotodetección', value: 'fotomulta' },
      { label: 'Solicitud de información y soportes', value: 'soportes' },
      { label: 'Otro fundamento', value: 'otro' },
    ] },
    { id: 'error_identificacion', label: '¿Existe un error en placa, documento, nombre u otro dato?', type: 'radio', options: [{ label: 'Sí', value: 'si' }, { label: 'No', value: 'no' }] },
    { id: 'tipo_error', label: 'Describe el error', type: 'textarea', condition: { questionId: 'error_identificacion', operator: 'equals', value: 'si' } },
    { id: 'hechos', label: 'Explique los hechos', type: 'textarea', required: true },
    { id: 'solicitud', label: '¿Qué quieres obtener?', type: 'textarea', required: true },
    { id: 'solicitar_soportes', label: '¿Deseas solicitar copia de los soportes?', type: 'radio', options: [{ label: 'Sí', value: 'si' }, { label: 'No', value: 'no' }] },
  ],
};

export const trafficSpecialForms: Record<string, FormStep[]> = {
  'prescripcion-comparendo': [identity, contact, trafficData, process, legalIssue],
  'caducidad-comparendo': [identity, contact, trafficData, process, legalIssue],
  'revocatoria-comparendo': [identity, contact, trafficData, process, legalIssue],
  'solicitud-soportes-comparendo': [identity, contact, trafficData, process, legalIssue],
  fotomultas: [identity, contact, trafficData, process, legalIssue],
};
