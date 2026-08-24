import type { FormStep } from '@/types/form';

export const transitPrescriptionInterview: FormStep[] = [
  {
    id: 'identity',
    title: 'Tus datos',
    description: 'Solo necesitamos la información básica para identificarte y recibir la respuesta.',
    fields: [
      { id: 'fullName', label: '¿Cuál es tu nombre completo?', type: 'text', required: true, placeholder: 'Ej. María Pérez Gómez' },
      { id: 'documentType', label: 'Tipo de documento', type: 'select', required: true, options: [{ label: 'Cédula de ciudadanía', value: 'CC' }, { label: 'Cédula de extranjería', value: 'CE' }, { label: 'Pasaporte', value: 'PAS' }] },
      { id: 'documentNumber', label: 'Número de documento', type: 'text', required: true },
      { id: 'email', label: '¿A qué correo quieres recibir la respuesta?', type: 'email', required: true },
    ],
  },
  {
    id: 'authority',
    title: '¿A quién le vamos a presentar la solicitud?',
    fields: [
      { id: 'authorityName', label: 'Secretaría u organismo de tránsito', type: 'text', required: true, placeholder: 'Ej. Secretaría de Tránsito y Transporte Departamental de Sucre' },
      { id: 'authorityMunicipality', label: 'Municipio', type: 'text', required: true, placeholder: 'Ej. Sampués' },
      { id: 'authorityDepartment', label: 'Departamento', type: 'text', required: true, placeholder: 'Ej. Sucre' },
    ],
  },
  {
    id: 'comparendos',
    title: 'Cuéntanos qué comparendos tienes',
    description: 'Puedes agregar uno, dos, tres o todos los que quieras incluir en la misma solicitud. No necesitas redactar nada.',
    fields: [
      { id: 'comparendos', label: 'Comparendos', type: 'textarea', required: true, placeholder: 'Los datos se cargarán mediante el formulario dinámico de comparendos.' },
    ],
  },
  {
    id: 'evidence',
    title: 'Información para revisar el caso',
    description: 'Estas preguntas evitan que TrámiteYa genere una solicitud sin verificar posibles interrupciones del término.',
    fields: [
      { id: 'hasPaymentOrderNotice', label: '¿Conoces la fecha en que te notificaron el mandamiento de pago?', type: 'radio', required: true, options: [{ label: 'Sí', value: 'yes' }, { label: 'No', value: 'no' }] },
      { id: 'hasSubsequentActions', label: '¿Después del mandamiento de pago hubo alguna actuación de cobro, acuerdo de pago o medida cautelar que conozcas?', type: 'radio', required: true, options: [{ label: 'Sí', value: 'yes' }, { label: 'No', value: 'no' }, { label: 'No lo sé', value: 'unknown' }] },
      { id: 'notes', label: '¿Hay algo importante que quieras contarnos?', type: 'textarea', required: false, placeholder: 'Opcional. Escríbelo con tus propias palabras; TrámiteYa se encarga de organizarlo jurídicamente.' },
    ],
  },
];

export type TransitPrescriptionAnswers = {
  fullName: string;
  documentType: string;
  documentNumber: string;
  email: string;
  authorityName: string;
  authorityMunicipality: string;
  authorityDepartment: string;
  comparendos: Array<{
    number: string;
    violationDate?: string;
    coactiveDate: string;
    origin?: string;
    infraction?: string;
    totalFine?: number;
    paymentOrderNoticeDate?: string;
  }>;
  hasPaymentOrderNotice?: 'yes' | 'no';
  hasSubsequentActions?: 'yes' | 'no' | 'unknown';
  notes?: string;
};
