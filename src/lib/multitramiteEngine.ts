import type { FormAnswers, FormField, FormStep } from '../types/form';
import type { Procedure } from '../types';
import { getDynamicFormDefinition } from '../data/dynamicForms';
import { buildDocumentText } from './documentTemplates';
import { buildTrafficDocument } from './trafficDocumentTemplates';

export type ValidationIssue = { fieldId: string; label: string; message: string };
export type ProcedurePackage = { procedure: Procedure; steps: FormStep[]; totalFields: number; requiredFields: number };

function visibleField(field: FormField, answers: FormAnswers): boolean {
  if (!field.condition) return true;
  const current = answers[field.condition.questionId];
  const expected = field.condition.value;
  if (field.condition.operator === 'equals') return String(current ?? '') === expected;
  if (field.condition.operator === 'notEquals') return String(current ?? '') !== expected;
  return String(current ?? '').includes(expected);
}
function hasValue(value: FormAnswers[string]): boolean { if (value === null || value === undefined || value === false) return false; if (Array.isArray(value)) return value.length > 0; return String(value).trim().length > 0; }

export function getProcedurePackage(procedure: Procedure): ProcedurePackage {
  const definition = getDynamicFormDefinition(procedure.slug);
  const steps = definition?.steps ?? [];
  const fields = steps.flatMap((step) => step.fields);
  return { procedure, steps, totalFields: fields.length, requiredFields: fields.filter((field) => field.required).length };
}

export function validateProcedureAnswers(procedure: Procedure, answers: FormAnswers): ValidationIssue[] {
  const definition = getDynamicFormDefinition(procedure.slug);
  if (!definition) return [{ fieldId: 'procedure', label: procedure.title, message: 'Este trámite aún no tiene un formulario configurado.' }];
  return definition.steps.flatMap((step) => step.fields).filter((field) => field.required && visibleField(field, answers) && !hasValue(answers[field.id])).map((field) => ({ fieldId: field.id, label: field.label, message: 'Este campo es obligatorio.' }));
}

export function generateProcedureText(procedure: Procedure, answers: FormAnswers): string {
  const issues = validateProcedureAnswers(procedure, answers);
  if (issues.length) throw new Error(`No se puede generar el documento: faltan ${issues.length} campo(s) obligatorio(s).`);
  return ['prescripcion-comparendo', 'caducidad-comparendo', 'revocatoria-comparendo', 'solicitud-soportes-comparendo', 'fotomultas'].includes(procedure.slug) ? buildTrafficDocument(procedure.slug, answers) : buildDocumentText(procedure, answers);
}
