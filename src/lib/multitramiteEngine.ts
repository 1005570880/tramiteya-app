import type { FormAnswers, FormField, FormStep } from '../types/form';
import type { Procedure } from '../types';
import { getFormDefinition } from '../data/forms';
import { buildDocumentText } from './documentTemplates';

export type ValidationIssue = {
  fieldId: string;
  label: string;
  message: string;
};

export type ProcedurePackage = {
  procedure: Procedure;
  steps: FormStep[];
  totalFields: number;
  requiredFields: number;
};

function visibleField(field: FormField, answers: FormAnswers): boolean {
  if (!field.condition) return true;
  const current = answers[field.condition.questionId];
  const expected = field.condition.value;
  if (field.condition.operator === 'equals') return String(current ?? '') === expected;
  if (field.condition.operator === 'notEquals') return String(current ?? '') !== expected;
  return String(current ?? '').includes(expected);
}

function hasValue(value: FormAnswers[string]): boolean {
  if (value === null || value === undefined || value === false) return false;
  if (Array.isArray(value)) return value.length > 0;
  return String(value).trim().length > 0;
}

export function getProcedurePackage(procedure: Procedure): ProcedurePackage {
  const definition = getFormDefinition(procedure.slug);
  const steps = definition?.steps ?? [];
  const fields = steps.flatMap((step) => step.fields);
  return {
    procedure,
    steps,
    totalFields: fields.length,
    requiredFields: fields.filter((field) => field.required).length,
  };
}

export function validateProcedureAnswers(procedure: Procedure, answers: FormAnswers): ValidationIssue[] {
  const definition = getFormDefinition(procedure.slug);
  if (!definition) return [{ fieldId: 'procedure', label: procedure.title, message: 'Este trámite aún no tiene un formulario configurado.' }];

  const issues: ValidationIssue[] = [];
  for (const field of definition.steps.flatMap((step) => step.fields)) {
    if (!field.required || !visibleField(field, answers)) continue;
    if (!hasValue(answers[field.id])) {
      issues.push({ fieldId: field.id, label: field.label, message: 'Este campo es obligatorio.' });
    }
  }
  return issues;
}

export function generateProcedureText(procedure: Procedure, answers: FormAnswers): string {
  const issues = validateProcedureAnswers(procedure, answers);
  if (issues.length) {
    throw new Error(`No se puede generar el documento: faltan ${issues.length} campo(s) obligatorio(s).`);
  }
  return buildDocumentText(procedure, answers);
}
