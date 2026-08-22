import type { FormField, FormStep } from "../types/form";

export type Procedure = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  estimatedTime: string;
  available: boolean;
};

export type { FormField, FormStep };
