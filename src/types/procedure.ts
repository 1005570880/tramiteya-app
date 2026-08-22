export type Procedure = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  estimatedTime: string;
  available: boolean;
};

export type ProcedureStatus =
  | "draft"
  | "in_progress"
  | "pending_information"
  | "document_ready"
  | "completed";

export interface DocumentItem {
  id: string;
  title: string;
  procedureId: string;
  content: string;
  createdAt: string;
  status: "ready" | "error";
  version?: number;
  generatedAt?: string;
}

export interface ProcedureInstance {
  id: string;
  procedureId: string;
  procedureSlug: string;
  status: ProcedureStatus;
  answers: import("./form").FormAnswers;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  document?: DocumentItem;
}
