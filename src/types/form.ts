export type FormFieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "date"
  | "select"
  | "radio"
  | "checkbox"
  | "file";

export type FormField = {
  id: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  condition?: { questionId: string; operator: "equals" | "notEquals" | "contains"; value: string };
};

export type FormStep = {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
};

export type FormAnswer = string | string[] | null | boolean;
export type FormAnswers = Record<string, FormAnswer | unknown>;
