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
    title: '¿Dónde fue el comparendo?',
    description: 'No necesitas saber el nombre jurídico exacto de la Secretaría. TrámiteYa lo resolverá a partir del lugar.',
    fields: [
      { id: 'authorityMunicipality', label: 'Municipio', type: 'text', required: true, placeholder: 'Ej. Sampués' },
      { id: 'authorityDepartment', label: 'Departamento', type: 'text', required: true, placeholder: 'Ej. Sucre' },
    ],
  },
  {
    id: 'comparendos',
    title: 'Tus comparendos',
    description: 'Solo escribe el número de cada comparendo. No necesitas fechas, valores ni información jurídica.',
    fields: [
      { id: 'comparendos', label: 'Comparendos', type: 'textarea', required: true, placeholder: 'Los datos se cargarán mediante el formulario dinámico de comparendos.' },
    ],
  },
  {
    id: 'evidence',
    title: 'Revisión automática',
    description: 'TrámiteYa verificará los datos que normalmente requieren consultar el expediente. No tienes que adivinarlos.',
    fields: [],
  },
];

export type TransitPrescriptionAnswers = {
  fullName: string;
  documentType: string;
  documentNumber: string;
  email: string;
  authorityName?: string;
  authorityMunicipality: string;
  authorityDepartment: string;
  comparendos: Array<{
    number: string;
    violationDate?: string;
    coactiveDate?: string;
    origin?: string;
    infraction?: string;
    totalFine?: number;
    paymentOrderNoticeDate?: string;
  }>;
  hasPaymentOrderNotice?: 'yes' | 'no' | 'unknown';
  hasSubsequentActions?: 'yes' | 'no' | 'unknown';
  notes?: string;
};
