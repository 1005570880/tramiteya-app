import type { FormAnswers } from '../types/form';
import type { Procedure } from '../types';

function value(answers: FormAnswers, key: string, fallback = ''): string {
  const raw = answers[key];
  if (Array.isArray(raw)) return raw.join(', ');
  if (typeof raw === 'boolean') return raw ? 'Sí' : 'No';
  return raw == null ? fallback : String(raw);
}

export function buildPetitionText(procedure: Procedure, answers: FormAnswers): string {
  const applicant = `${value(answers, 'nombres')} ${value(answers, 'apellidos')}`.trim();
  const date = value(answers, 'fecha', new Date().toLocaleDateString('es-CO'));

  return [
    value(answers, 'ciudad', 'Ciudad'),
    date,
    '',
    value(answers, 'entidad', 'SEÑOR(A) DESTINATARIO'),
    value(answers, 'cargo'),
    '',
    `Asunto: ${value(answers, 'asunto', procedure.title)}`,
    '',
    `Yo, ${applicant || 'el/la suscrito(a)'}, identificado(a) con documento ${value(answers, 'documento')}, actuando en nombre propio, respetuosamente presento la siguiente petición:`,
    '',
    'HECHOS',
    value(answers, 'hechos'),
    '',
    'PETICIÓN',
    value(answers, 'solicitud'),
    '',
    'NOTIFICACIONES',
    `Correo electrónico: ${value(answers, 'correo')}`,
    `Teléfono: ${value(answers, 'telefono')}`,
    `Dirección: ${value(answers, 'direccion')}`,
    '',
    'ANEXOS',
    value(answers, 'anexos', 'No se relacionan anexos.'),
    '',
    'Atentamente,',
    '',
    applicant || 'SOLICITANTE',
    `C.C. ${value(answers, 'documento')}`,
  ].filter((line, index, arr) => !(line === '' && arr[index - 1] === '')).join('\n');
}

export function buildDocumentText(procedure: Procedure, answers: FormAnswers): string {
  if (procedure.slug === 'derecho-de-peticion') return buildPetitionText(procedure, answers);
  return `${procedure.title}\n\n${Object.entries(answers).map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : String(val ?? '')}`).join('\n')}`;
}
