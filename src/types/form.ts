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

/**
 * Form answers may also contain structured internal enrichment data (for
 * example the normalized SIMIT result). Keeping that metadata in the same
 * draft object lets the document engine consume it without weakening the
 * public form model or forcing an unsafe cast at every call site.
 */
export type FormAnswer = string | string[] | null | boolean | Record<string, unknown>;
export type FormAnswers = Record<string, FormAnswer>;
