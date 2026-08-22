// Repository interfaces and factory

import type { ProcedureInstance } from '../types/procedure';
import type { Procedure } from '../types';
import type { FormAnswers } from '../types/form';
import type { DocumentItem } from '../types/procedure';

export interface ProcedureRepository {
  listProcedures(): Promise<Procedure[]>;
  getProcedureBySlug(slug: string): Promise<Procedure | null>;
}

export interface InstanceRepository {
  create(procedureId: string, procedureSlug: string, answers?: FormAnswers, userId?: string): Promise<ProcedureInstance>;
  get(id: string): Promise<ProcedureInstance | null>;
  list(): Promise<ProcedureInstance[]>;
  update(id: string, patch: Partial<ProcedureInstance>): Promise<ProcedureInstance | null>;
  remove(id: string): Promise<boolean>;
}

export interface DocumentRepository {
  create(document: Omit<DocumentItem, 'id' | 'createdAt'>): Promise<DocumentItem>;
  get(id: string): Promise<DocumentItem | null>;
}

// Factory stub: server code will choose implementation based on env
export function createRepositories(env: any) {
  // For now, server will import specific implementations directly.
  return null;
}
